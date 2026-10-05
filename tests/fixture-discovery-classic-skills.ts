import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type ClassicDiscoverySkillsStep = { actor: string; action: Action };
export type ClassicDiscoverySkillsOptions = {
  /** Authenticated fresh lobby or original staged setup; never a played save. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  seats?: 2 | 3 | 4 | 5 | 6;
  collector?: 'guild' | 'harkonnen';
  skill?: LeaderSkillId;
  skillOwner?: 'guild' | 'harkonnen' | 'emperor';
  face?: DiscoveryTokenFace;
  amount?: number;
};
export type ClassicDiscoverySkillsFixture = {
  initial: Game; setup: Game; game: Game; actions: ClassicDiscoverySkillsStep[];
  staging: string[]; collector: string; opponent: string; leader: string;
  token: string; face: DiscoveryTokenFace; parent: string; parentSector: number;
};
export const classicDiscoverySkillsClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;

export function nextClassicDiscoverySkillsStep(game: Game): ClassicDiscoverySkillsStep {
  if (game.decision?.kind === 'discoveryEntry') return { actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, accept: false } };
  if (game.battle?.preLeader?.closed === false && !game.response && !game.decision && !game.battle.preparation) {
    const frame = game.battle.preLeader;
    return { actor: frame.ready.includes(game.battle.attacker) ? game.battle.defender : game.battle.attacker,
      action: { type: 'battlePreparationReady', event: frame.event } };
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next, 'The original classic program needs a live owned continuation.');
  return next;
}
export function advanceClassicDiscoverySkills(state: Game, until: (game: Game) => boolean,
  actions?: ClassicDiscoverySkillsStep[]): Game {
  let game = state;
  for (let i = 0; !until(game) && i < 1600; i++) {
    assert.notEqual(game.status, 'finished');
    const next = nextClassicDiscoverySkillsStep(game);
    actions?.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'The connected classic program did not reach its original action window.');
  return game;
}

/** Physical offer lottery only: each original seat receives a source-clear skill.
 * The rest of setup entropy, including Treachery and Traitor cards, stays real. */
function withSkillOffers<T>(skills: LeaderSkillId[], operation: () => T): T {
  const original = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const current = LEADER_SKILL_CARDS.map(card => card.id) as LeaderSkillId[];
  const desired = Array<LeaderSkillId>(current.length);
  skills.forEach((skill, index) => { desired[index * 2] = skill; });
  const rest = current.filter(skill => !skills.includes(skill));
  for (let i = 0; i < desired.length; i++) if (!desired[i]) desired[i] = rest.shift()!;
  let index = current.length - 1;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index < 1) return Reflect.apply(original, crypto, [array]) as V;
    assert.ok(array instanceof Uint32Array && array.length === 1);
    const swap = current.indexOf(desired[index]);
    assert.ok(swap <= index);
    array[0] = Math.floor((swap + 0.5) / (index + 1) * 0x100000000);
    [current[index], current[swap]] = [current[swap], current[index]];
    index--;
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function withDiscoveryPlacement<T>(game: Game, face: DiscoveryTokenFace, operation: () => T): T {
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = eligible.findIndex(token => token.face === face);
  assert.ok(index >= 0);
  const original = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((index + 0.5) / eligible.length * 0x100000000);
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original base33/all14 staged setup, original Storm/Bidding/Shipment/Collection.
 * Explicit positions: actual skill offers, four unplayed Spice Cards and supply
 * token lottery. Never stage clocks, phases, wallets, forces or pending frames. */
export function createClassicDiscoverySkillsFixture(options: ClassicDiscoverySkillsOptions = {}): ClassicDiscoverySkillsFixture {
  const collectorFaction = options.collector ?? 'guild', requested = options.skill ?? 'planetologist';
  const face = options.face ?? 'cistern';
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions = [collectorFaction, 'emperor', collectorFaction === 'guild' ? 'harkonnen' : 'guild',
      'atreides', 'fremen', 'beneGesserit'] as FactionId[];
    game = createGame('CLASSICDISCOVERYSKILLS', newPlayer(factions[0], factions[0], factions[0]), options.advanced ?? false);
    for (const faction of factions.slice(1, options.seats ?? 3)) joinGame(game, newPlayer(faction, faction, faction));
  }
  assert.ok(game.status === 'lobby' || (game.status === 'setup' && game.turn === 1 && game.phase === 0));
  const controlledOffers = game.status === 'lobby';
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.strongholdCards && !game.spiceBankerIncomePreview);
  const collector = game.players.find(player => player.faction === collectorFaction)!.id;
  const opponent = game.players.find(player => player.faction === 'emperor')!.id;
  const skillOwner = game.players.find(player => player.faction === (options.skillOwner ?? collectorFaction))!.id;
  const choices = (['planetologist', 'killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz',
    'warmaster', 'master-of-assassins', 'bureaucrat'] as LeaderSkillId[]).filter(skill => skill !== requested);
  const skills = game.players.map(player => player.id === skillOwner ? requested : choices.shift()!);
  const actions: ClassicDiscoverySkillsStep[] = [];
  if (game.status === 'lobby') {
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    game.discoveryEnabled = true;
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  }
  const initial = structuredClone(game);
  if (game.status === 'lobby') game = withSkillOffers(skills, () => initializeLeaderSkillsGameForAudit(game));
  assert.ok(game.discoveryEnabled && game.discoveries && game.leaderSkills);
  const setup = structuredClone(game);
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage !== 'leaderSkills') {
      const next = nextClassicDiscoverySkillsStep(game);
      actions.push(next); game = applyAction(game, next.actor, next.action); continue;
    }
    const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
    const view = viewGame(game, actor).leaderSkills!;
    const skill = actor === skillOwner ? requested : offer.cards.find(card =>
      !['spice-banker', 'mentat', 'diplomat'].includes(card) && !view.unavailableSkills?.[card]);
    assert.ok(skill && offer.cards.includes(skill), 'Authenticated offer must contain the requested source-clear skill.');
    const eligible = view.eligibleLeaders.map(candidate => game.players.find(player => player.id === actor)!.leaders.find(leader => leader.id === candidate.id)!);
    const leader = eligible.sort((a, b) => b.strength - a.strength)[0];
    assert.ok(leader);
    const next: ClassicDiscoverySkillsStep = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    actions.push(next); game = applyAction(game, actor, next.action);
  }
  assert.equal(game.status, 'playing');
  const leader = game.leaderSkills!.assignments.find(assignment => assignment.owner === collector)!.leader;
  const printed = DISCOVERY_TOKEN_BY_ID[face].type === 'hiereg' ? 'discovery-hagga-basin' : 'discovery-wind-pass-north';
  const index = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed);
  assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
  for (let position = 1; position < 4; position++) {
    const ordinary = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && !card.discovery);
    assert.ok(ordinary >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(ordinary, 1)[0]);
  }
  const staging = [controlledOffers
    ? 'Selected original physical all14 offer lottery; reordered four original unplayed Spice Cards; selected original supply-token lottery.'
    : 'Kept actual already-dealt Skill offers and assignments; reordered four original unplayed Spice Cards; selected original supply-token lottery.'];
  game = advanceClassicDiscoverySkills(game, state => state.phase === 1 && classicDiscoverySkillsClean(state), actions);
  game = withDiscoveryPlacement(game, face, () => advanceClassicDiscoverySkills(game,
    state => state.discoveries!.tokens.some(token => token.face === face && token.status === 'placed'), actions));
  game = advanceClassicDiscoverySkills(game, state => state.phase === 5 && state.active === collector && classicDiscoverySkillsClean(state), actions);
  const placement = DISCOVERY_CARD_PLACEMENTS[printed];
  const shipment: ClassicDiscoverySkillsStep = { actor: collector, action: { type: 'ship',
    territory: placement.territory, sector: placement.sector, amount: options.amount ?? 3, elite: 0, allyPayment: 0 } };
  actions.push(shipment); game = applyAction(game, collector, shipment.action);
  game = advanceClassicDiscoverySkills(game, state => state.phase === 7 && classicDiscoverySkillsClean(state), actions);
  const token = game.discoveries!.tokens.find(candidate => candidate.face === face)!;
  assert.equal(game.turn, 1);
  const offer = viewGame(game, collector).discoveries!;
  assert.ok(offer.canInspect.includes(token.id) || offer.canReveal.includes(token.id));
  return { initial, setup, game, actions, staging, collector, opponent, leader,
    token: token.id, face, parent: placement.territory, parentSector: placement.sector };
}
export function revealClassicDiscoverySkills(fixture: ClassicDiscoverySkillsFixture): Game {
  let game = fixture.game;
  if (viewGame(game, fixture.collector).discoveries!.canInspect.some(token => token === fixture.token))
    game = applyAction(game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: false });
  return applyAction(game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: true });
}
export function classicDiscoverySkillsEntryWindow(fixture: ClassicDiscoverySkillsFixture): Game {
  return advanceClassicDiscoverySkills(revealClassicDiscoverySkills(fixture), game =>
    game.turn === 2 && game.decision?.kind === 'discoveryEntry' && game.decision.player === fixture.collector);
}
export function enterClassicDiscoverySkills(fixture: ClassicDiscoverySkillsFixture): Game {
  const game = classicDiscoverySkillsEntryWindow(fixture), view = viewGame(game, fixture.collector);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources);
  assert.ok(action);
  return applyAction(game, fixture.collector, action);
}
export function classicDiscoverySkillsShipmentWindow(state: Game, owner: string): Game {
  return advanceClassicDiscoverySkills(state, game => game.turn === 2 && game.phase === 5 &&
    game.active === owner && classicDiscoverySkillsClean(game));
}
export function settleClassicDiscoverySkillsArrival(state: Game): Game {
  return advanceClassicDiscoverySkills(state, game => !game.pendingShipment && classicDiscoverySkillsClean(game));
}

/** Original two-turn nested battle: collector enters free, Emperor ships one
 * physical normal force at the printed nested rate, then original battle setup. */
export function openClassicDiscoverySkillsBattle(fixture: ClassicDiscoverySkillsFixture, hide = true): Game {
  let game = classicDiscoverySkillsShipmentWindow(enterClassicDiscoverySkills(fixture), fixture.opponent);
  game = applyAction(game, fixture.opponent, { type: 'ship', territory: fixture.face, sector: 0, amount: 1, elite: 0, allyPayment: 0 });
  game = advanceClassicDiscoverySkills(game, state => state.phase === 6 && !!state.active && classicDiscoverySkillsClean(state));
  const actor = game.active!;
  assert.ok(actor === fixture.collector || actor === fixture.opponent);
  game = applyAction(game, actor, { type: 'chooseBattle', territory: fixture.face,
    target: actor === fixture.collector ? fixture.opponent : fixture.collector });
  for (let i = 0; (game.response || game.decision || game.battle?.preparation || game.battle?.preLeader?.closed === false) && i < 100; i++) {
    if (game.decision?.kind === 'leaderSkillVisibility') game = applyAction(game, game.decision.player,
      { type: 'leaderSkillVisibility', event: game.decision.event, hide: game.decision.player === fixture.collector && hide });
    else {
      const next = nextClassicDiscoverySkillsStep(game); game = applyAction(game, next.actor, next.action);
    }
  }
  assert.ok(game.battle && !game.response && !game.decision);
  return game;
}
