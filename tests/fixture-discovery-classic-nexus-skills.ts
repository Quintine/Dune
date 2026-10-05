import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { classicNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { createStrongholdCards } from '../game/stronghold-cards';
import {
  advanceClassicDiscoveryNexus, applyClassicDiscoveryNexusStep, classicDiscoveryNexusClean,
  finishClassicDiscoveryNexusMentat, formClassicDiscoveryNexusAlliance,
  nextClassicDiscoveryNexusStep, openClassicDiscoveryNexusAlliance, revealClassicDiscoveryNexus,
  voteClassicDiscoveryNexus, withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken,
} from './fixture-discovery-classic-nexus';
import { holdNexusSkillsModulesPaymentsCard } from './fixture-nexus-skills-modules-payments';

export type DiscoveryClassicNexusSkillsStep = { actor: string; action: Action };
export type DiscoveryClassicNexusSkillsOptions = {
  /** Authenticated ready lobby or ORIGINAL unassigned turn-one setup, never a played save. */
  initial?: Game;
  gameId?: string;
  seatIds?: string[];
  seats?: 2 | 3 | 4 | 5 | 6;
  factions?: FactionId[];
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** Only a new, locally generated setup may position its physical offer lottery. */
  skill?: LeaderSkillId;
};
export type DiscoveryClassicNexusSkillsFixture = {
  initial: Game;
  setup: Game;
  trained: Game;
  collection: Game;
  firstMentat: { before: Game; step: DiscoveryClassicNexusSkillsStep; after: Game };
  game: Game;
  owner: string;
  opponent: string;
  leader: string;
  skill: LeaderSkillId;
  token: string;
  source: string;
  wormSource: string;
  actions: DiscoveryClassicNexusSkillsStep[];
  staging: string[];
};
export type DiscoveryClassicNexusSkillsClosing = {
  vote: Game;
  alliance: Game;
  beforeDraw: Game;
  drawStep: DiscoveryClassicNexusSkillsStep;
  game: Game;
};
export type DiscoveryClassicNexusSkillsBattle = {
  shipmentWindow: Game;
  shipmentStep: DiscoveryClassicNexusSkillsStep;
  arrived: Game;
  game: Game;
  weapon: string;
  plans: DiscoveryClassicNexusSkillsStep[];
};
export const discoveryClassicNexusSkillsClean = classicDiscoveryNexusClean;
export const advanceDiscoveryClassicNexusSkills = advanceClassicDiscoveryNexus;
export const stepDiscoveryClassicNexusSkills = applyClassicDiscoveryNexusStep;
export function discoveryClassicNexusSkillsPlayer(game: Game, actor: string): Player {
  const seat = game.players.find(player => player.id === actor);
  assert.ok(seat); return seat;
}

/** The thirteen scalar draws belong only to the original all14 shuffle. Native
 * UUID bytes and subsequent original component production remain unchanged. */
function offeredSkills<T>(selected: LeaderSkillId[], operation: () => T): T {
  const working = LEADER_SKILL_CARDS.map(card => card.id);
  const remainder = working.filter(skill => !selected.includes(skill));
  const desired = selected.flatMap(skill => [skill, remainder.shift()!]);
  desired.push(...remainder);
  const rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const swap = working.indexOf(desired[index]); assert.ok(swap >= 0 && swap <= index);
    rolls.push(Math.floor((swap + 0.5) / (index + 1) * 0x100000000));
    [working[index], working[swap]] = [working[swap], working[index]];
  }
  const native = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

export function initializeDiscoveryClassicNexusSkillsSetup(options: DiscoveryClassicNexusSkillsOptions = {}): Game {
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions = options.factions ?? ['atreides', 'harkonnen', 'beneGesserit', 'guild', 'emperor', 'fremen'];
    const count = options.seats ?? options.seatIds?.length ?? options.factions?.length ?? 3;
    assert.ok(count >= 2 && count <= 6 && factions.length >= count);
    if (options.seatIds) assert.equal(options.seatIds.length, count);
    game = createGame(options.gameId ?? 'DISCOVERYCLASSICNEXUSSKILLS',
      newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), options.advanced ?? false);
    for (let index = 1; index < count; index++)
      joinGame(game, newPlayer(options.seatIds?.[index] ?? factions[index], factions[index], factions[index]));
  }
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.deepEqual(game.expansions, []);
  if (game.status === 'lobby') {
    assert.ok(!game.leaderSkills && !game.discoveries);
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
    game.discoveryEnabled = true;
    game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    assert.ok(classicNexusLeaderSkillsProfile(game));
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    // A supplied human lobby must keep the real lottery; never demand one skill.
    if (options.initial) game = withClassicDiscoveryNexusLottery(() => initializeLeaderSkillsGameForAudit(game));
    else {
      const requested = options.skill ?? 'warmaster';
      const passive: LeaderSkillId[] = ['sandmaster', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins', 'swordmaster-of-ginaz', 'planetologist']
        .filter(skill => skill !== requested) as LeaderSkillId[];
      const selected = game.players.map((_, index) => index === 0 ? requested : passive.shift()!);
      game = offeredSkills(selected, () => initializeLeaderSkillsGameForAudit(game));
    }
  }
  assert.equal(game.status, 'setup'); assert.equal(game.turn, 1); assert.equal(game.phase, 0);
  assert.ok(['prediction', 'leaderSkills'].includes(game.setupStage!));
  assert.ok(game.leaderSkills && game.discoveries && game.nexusCards?.cards);
  assert.ok(classicNexusLeaderSkillsProfile(game));
  assert.equal(game.leaderSkills.assignments.length, 0);
  assert.ok(game.players.every(player => !player.traitors.length && !player.traitorChoices.length));
  if (game.strongholdCards) assert.deepEqual(game.strongholdCards, createStrongholdCards());
  if (options.tech !== undefined) assert.equal(!!game.techTokens, options.tech);
  if (options.strongholds !== undefined) assert.equal(!!game.strongholdCards, options.strongholds);
  return game;
}

function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  staging.push('Conserved original board counters into their OWN reserves before actual movement completion; no death, wallet, clock, alliance or earned receipt assigned.');
}
export function positionDiscoveryClassicNexusSkillsOrdinary(game: Game, actor: string, key: string, amount: number, staging: string[]): void {
  const player = discoveryClassicNexusSkillsPlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= amount);
  player.reserves -= amount; player.forces[key] = (player.forces[key] ?? 0) + amount;
  staging.push(`Conserved ${amount} original ordinary ${actor} reserve counters at ${key}; subsequent native actions alone determine survival.`);
}
export function orderDiscoveryClassicNexusSkillsSpice(game: Game, secondTurn: boolean, staging: string[]): void {
  const take = (matches: (card: Game['spiceDeck'][number]) => boolean) => {
    const index = game.spiceDeck.findIndex(matches); assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  const front: Game['spiceDeck'] = [];
  if (secondTurn) front.push(take(card => 'worm' in card && !!card.greatMaker));
  front.push(take(card => 'territory' in card && (secondTurn ? !card.discovery && card.territory === 'broken_land'
    : card.discovery === 'discovery-hagga-basin')));
  if (game.advanced) front.push(take(card => 'territory' in card && !card.discovery &&
    (secondTurn ? card.territory !== 'broken_land' : card.territory === 'rock_outcroppings')));
  game.spiceDeck.unshift(...front);
  staging.push(secondTurn ? 'Conserved original unplayed Great Maker followed by BOTH Advanced land replacements; original discard history untouched.'
    : 'Conserved original undealt Hagga Discovery and optional Advanced Rock Outcroppings positions; original token lottery selects Cistern.');
}

/** Human endpoint is actual trained next-turn free entry BEFORE Storm. Supplied
 * offers/hands/IDs survive verbatim; only source-clear legal offered training is
 * selected. Original owner clocks, reveal and first Mentat own every transition. */
export function createDiscoveryClassicNexusSkillsFixture(options: DiscoveryClassicNexusSkillsOptions = {}): DiscoveryClassicNexusSkillsFixture {
  const setup = initializeDiscoveryClassicNexusSkillsSetup(options);
  const initial = options.initial ? structuredClone(options.initial) : structuredClone(setup);
  const owner = setup.players[0].id, opponent = setup.players[1].id;
  const actions: DiscoveryClassicNexusSkillsStep[] = [], staging: string[] = [];
  let game = structuredClone(setup);
  while (game.status === 'setup') {
    let step: DiscoveryClassicNexusSkillsStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], view = viewGame(game, actor).leaderSkills!;
      const legal = view.offer!.cards.filter(skill => !view.unavailableSkills?.[skill]);
      const desired = !options.initial && actor === owner ? options.skill ?? 'warmaster' : undefined;
      const skill = desired && legal.includes(desired) ? desired : legal[0];
      const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
      const leader = discoveryClassicNexusSkillsPlayer(game, actor).leaders.filter(leader => eligible.has(leader.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && leader, 'Human continuation requires genuinely offered legal training, never a substitute offer.');
      step = { actor, action: { type: 'leaderSkill', event: view.offer!.event, skill, leader: leader.id } };
    } else { const next = nextClassicDiscoveryNexusStep(game); assert.ok(next); step = next; }
    game = applyClassicDiscoveryNexusStep(game, step, actions);
  }
  const trained = structuredClone(game), assignment = game.leaderSkills!.assignments.find(item => item.owner === owner)!;
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 1 && classicDiscoveryNexusClean(state), actions);
  orderDiscoveryClassicNexusSkillsSpice(game, false, staging);
  for (let count = 0; !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed') && count < 100; count++) {
    const next = nextClassicDiscoveryNexusStep(game); assert.ok(next); actions.push(structuredClone(next));
    game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, next.actor, next.action));
  }
  assert.ok(game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed'));
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 5 && classicDiscoveryNexusClean(state), actions);
  reserveBoard(game, staging);
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const source = `${placement.territory}:${placement.sector}`, wormSource = 'hagga_basin:12';
  positionDiscoveryClassicNexusSkillsOrdinary(game, owner, source, 3, staging);
  positionDiscoveryClassicNexusSkillsOrdinary(game, owner, wormSource, 6, staging);
  if (game.strongholdCards) positionDiscoveryClassicNexusSkillsOrdinary(game, owner, 'arrakeen:10', 1, staging);
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 7 && classicDiscoveryNexusClean(state), actions);
  const collection = structuredClone(game), token = game.discoveries!.tokens.find(token => token.face === 'cistern')!;
  game = revealClassicDiscoveryNexus(game, owner, token.id, actions);
  const firstMentat = finishClassicDiscoveryNexusMentat(game, actions); game = firstMentat.after;
  assert.equal(game.turn, 2); assert.equal(game.decision?.kind, 'discoveryEntry'); assert.equal(game.decision!.player, owner);
  return { initial, setup, trained, collection, firstMentat, game, owner, opponent,
    leader: assignment.leader, skill: assignment.skill, token: token.id, source, wormSource, actions, staging };
}
export function enterDiscoveryClassicNexusSkills(fixture: DiscoveryClassicNexusSkillsFixture, amount = 3): Game {
  const game = structuredClone(fixture.game), view = viewGame(game, fixture.owner);
  const source = view.discoveryEntry!.sources.find(source => source.normal >= amount); assert.ok(source);
  const action = discoveryEntryMoveAction(view, [{ source: source.source, normal: amount, elite: 0 }]); assert.ok(action);
  return applyClassicDiscoveryNexusStep(game, { actor: fixture.owner, action }, fixture.actions);
}

/** Actual Great Maker death -> all votes -> reserve ride -> settled alliance ->
 * ENTIRE Spice Blow closure. Omitting target preserves the genuine original draw
 * for human continuation; targeting only reorders an unplayed deck singleton. */
export function closeDiscoveryClassicNexusSkills(fixture: DiscoveryClassicNexusSkillsFixture, target?: FactionId): DiscoveryClassicNexusSkillsClosing {
  assert.ok(fixture.game.players.length >= 3, 'An unallied draw needs two other actual alliance seats.');
  let game = enterDiscoveryClassicNexusSkills(fixture);
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 1 && classicDiscoveryNexusClean(state), fixture.actions);
  orderDiscoveryClassicNexusSkillsSpice(game, true, fixture.staging);
  game = advanceClassicDiscoveryNexus(game, state => state.greatMaker?.stage === 'vote', fixture.actions);
  const vote = structuredClone(game);
  game = voteClassicDiscoveryNexus(game, game.players.map(() => true), fixture.actions);
  game = openClassicDiscoveryNexusAlliance(game);
  const others = game.players.filter(player => player.id !== fixture.owner);
  game = formClassicDiscoveryNexusAlliance(game, others[0].id, others[1].id);
  const alliance = structuredClone(game);
  game = advanceClassicDiscoveryNexus(game, state => state.nexusCards?.phase?.stage === 'drawing', fixture.actions);
  const cards = game.nexusCards!.cards!;
  if (target) {
    const index = cards.deck.indexOf(target); assert.ok(index >= 0, 'Only an original unplayed singleton may supply the targeted draw.');
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    fixture.staging.push(`Positioned original UNPLAYED ${target} Nexus singleton before actual closing draw; never a held-hand assignment.`);
  }
  const beforeDraw = structuredClone(game), drawStep: DiscoveryClassicNexusSkillsStep = { actor: fixture.owner,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[fixture.owner], choice: 'draw', ownRedraws: 0 } };
  game = applyClassicDiscoveryNexusStep(game, drawStep, fixture.actions);
  return { vote, alliance, beforeDraw, drawStep, game };
}

/** Borrowed Guild tariff is spent through an actual nested shipment. The trained
 * Warmaster remains the physical actor; Arrakeen custody is not nested support. */
export function openDiscoveryClassicNexusSkillsBattle(fixture: DiscoveryClassicNexusSkillsFixture, state: Game): DiscoveryClassicNexusSkillsBattle {
  assert.equal(fixture.skill, 'warmaster');
  let game = advanceClassicDiscoveryNexus(state, game => game.phase === 5 && game.active === fixture.owner && classicDiscoveryNexusClean(game), fixture.actions);
  const shipmentWindow = structuredClone(game), offer = viewGame(game, fixture.owner).nexusGuildSecretAlly;
  assert.ok(offer && !offer.blocked);
  const shipmentStep: DiscoveryClassicNexusSkillsStep = { actor: fixture.owner, action: {
    type: 'ship', territory: 'cistern', sector: 0, amount: 3, elite: 0, nexus: offer.event } };
  game = applyClassicDiscoveryNexusStep(game, shipmentStep, fixture.actions);
  game = advanceClassicDiscoveryNexus(game, game => !game.pendingShipment && classicDiscoveryNexusClean(game), fixture.actions);
  const arrived = structuredClone(game);
  positionDiscoveryClassicNexusSkillsOrdinary(game, fixture.opponent, 'cistern:0', 2, fixture.staging);
  const weapon = holdNexusSkillsModulesPaymentsCard(game, fixture.owner, 'worthless', fixture.staging).id;
  const enemy = discoveryClassicNexusSkillsPlayer(game, fixture.opponent).leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills!.assignments.some(assignment => assignment.leader === leader.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(enemy);
  game = advanceClassicDiscoveryNexus(game, game => game.phase === 6 && classicDiscoveryNexusClean(game), fixture.actions);
  const actor = game.active!; assert.ok(actor === fixture.owner || actor === fixture.opponent);
  game = applyClassicDiscoveryNexusStep(game, { actor, action: { type: 'chooseBattle', territory: 'cistern',
    target: actor === fixture.owner ? fixture.opponent : fixture.owner } }, fixture.actions);
  for (let count = 0; count < 160; count++) {
    const next = nextClassicDiscoveryNexusStep(game);
    if (!next) break;
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === fixture.owner;
    game = applyClassicDiscoveryNexusStep(game, next, fixture.actions);
  }
  assert.ok(game.battle && !game.battle.revealed && classicDiscoveryNexusClean(game));
  return { shipmentWindow, shipmentStep, arrived, game, weapon, plans: [
    { actor: fixture.owner, action: { type: 'battlePlan', dial: 1, support: game.advanced ? 1 : 0,
      leader: fixture.leader, weapon, defense: null } },
    { actor: fixture.opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: enemy.id, weapon: null, defense: null } },
  ] };
}
export function revealDiscoveryClassicNexusSkillsBattle(battle: DiscoveryClassicNexusSkillsBattle): Game {
  let game = structuredClone(battle.game);
  for (const step of battle.plans) {
    game = applyClassicDiscoveryNexusStep(game, step);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextClassicDiscoveryNexusStep(game); assert.ok(next); game = applyClassicDiscoveryNexusStep(game, next);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function finishDiscoveryClassicNexusSkillsBattle(state: Game, stopAtCleanup = false): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 240; count++) {
    if (stopAtCleanup && game.decision?.kind === 'battleCards') return game;
    if (!game.battle && classicDiscoveryNexusClean(game) && !game.pendingTreacheryDiscard) return game;
    const next = nextClassicDiscoveryNexusStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = false;
    game = applyClassicDiscoveryNexusStep(game, next);
  }
  throw Error('Original trained nested battle did not finish its cleanup.');
}
