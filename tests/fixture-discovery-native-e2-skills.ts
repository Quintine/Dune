import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import type { Card } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { nextSkillsTechBattleStep, openSkillsTechBattle, finishSkillsTechBattle } from './fixture-skills-tech-battle';

export type DiscoveryNativeE2SkillsStep = { actor: string; action: Action };
export type DiscoveryNativeE2SkillsOptions = {
  /** Authenticated fresh lobby or its original undealt, unassigned setup. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  kind?: 'stash' | 'invoice' | 'marker';
  marker?: 0 | 3 | 5;
  reserveCap?: number;
  /** Human native-mechanics path: retain native random shuffle and select only
   * real available offers. Specific trained consumers require their actual skill. */
  useActualOffers?: boolean;
};
export type DiscoveryNativeE2SkillsFixture = {
  initial: Game;
  setup: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  game: Game;
  actions: DiscoveryNativeE2SkillsStep[];
  staging: string[];
  kind: 'stash' | 'invoice' | 'marker';
  richese: string;
  choam: string;
  guild: string;
  observer: string;
  collector: string;
  token: string;
  face: DiscoveryTokenFace;
  parent: string;
  parentSector: number;
  trainers: { richese: string; choam: string };
  green: string;
};
export type DiscoveryNativeE2SkillsCheckpoint = {
  beforeFirstMentat: Game;
  firstMentatStep: DiscoveryNativeE2SkillsStep;
  afterFirstMentat: Game;
  game: Game;
};
export type DiscoveryNativeE2MarkerBattle = {
  beforeShipment: Game;
  shipmentStep: DiscoveryNativeE2SkillsStep;
  afterShipment: Game;
  game: Game;
  token: string;
  value: 0 | 3 | 5;
  materialized: number;
  key: string;
  ownerPlan: Action;
  opponentPlan: Action;
};

export const discoveryNativeE2SkillsClean = (game: Game) => !game.response && !game.decision && !game.phaseOpening;
export function discoveryNativeE2SkillsPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player);
  return player;
}
const greenId = (game: Game) => game.advanced ? 'richese-residual-poison' : 'richese-nullentropy-box';

/** Control only the original all14 shuffle, never an existing offer or later shuffle. */
function withOffers<T>(selected: LeaderSkillId[], operation: () => T): T {
  const working = LEADER_SKILL_CARDS.map(card => card.id);
  const remaining = working.filter(card => !selected.includes(card));
  const desired = selected.flatMap(card => [card, remaining.shift()!]);
  desired.push(...remaining);
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[cursor++];
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function requestedSkill(faction: string): LeaderSkillId | undefined {
  return faction === 'richese' ? 'planetologist' : faction === 'choam' ? 'smuggler' : faction === 'emperor' ? 'bureaucrat' : undefined;
}

/** Native no-call/no-spend continuation; acquire the first actual green cache lot.
 * Later unbid lots are removed normally, not counted as an exhausted-cache success. */
export function nextDiscoveryNativeE2SkillsStep(game: Game, useActualOffers = false): DiscoveryNativeE2SkillsStep {
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = game.leaderSkills!.offers[actor], view = viewGame(game, actor).leaderSkills!;
    const player = discoveryNativeE2SkillsPlayer(game, actor);
    const requested = requestedSkill(player.faction);
    const skill = useActualOffers
      ? offer.cards.find(card => card === requested && !view.unavailableSkills?.[card]) ?? offer.cards.find(card => !view.unavailableSkills?.[card])
      : requested ?? offer.cards.find(card => !view.unavailableSkills?.[card]);
    const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
    const leader = player.leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
    assert.ok(skill && offer.cards.includes(skill) && !view.unavailableSkills?.[skill] && leader,
      'The original offer must contain the requested native consumer skill; never replace an existing offer.');
    return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
  }
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision, actor = d.player, event = game.richeseBidding?.event;
    if (d.kind === 'richeseBlackMarket') return { actor, action: { type: 'decision', event, decline: true } };
    if (d.kind === 'richeseDeclaration') return { actor, action: { type: 'decision', event, position: 'first' } };
    if (d.kind === 'richeseCache') {
      const card = game.richeseCache!.find(c => c.id === greenId(game)) ?? game.richeseCache![0];
      assert.ok(card, 'The original cache must still have a physical lot.');
      return { actor, action: { type: 'decision', event, card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (d.kind === 'richeseUnbid') return { actor, action: { type: 'decision', event, keep: game.richeseAuction?.cardId === greenId(game) } };
    if (d.kind === 'discoveryEntry') return { actor, action: { type: 'decision', event: d.event, accept: false } };
  }
  const lot = game.richeseAuction;
  if (discoveryNativeE2SkillsClean(game) && lot && !lot.outcome) {
    const actor = lot.method === 'silent' ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id)) : lot.active;
    assert.ok(actor);
    return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
  }
  return nextSkillsTechBattleStep(game);
}
export function stepDiscoveryNativeE2Skills(game: Game, step: DiscoveryNativeE2SkillsStep, actions?: DiscoveryNativeE2SkillsStep[]): Game {
  actions?.push(structuredClone(step));
  return applyAction(game, step.actor, step.action);
}
export function advanceDiscoveryNativeE2Skills(game: Game, until: (state: Game) => boolean, actions?: DiscoveryNativeE2SkillsStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepDiscoveryNativeE2Skills(game, nextDiscoveryNativeE2SkillsStep(game), actions);
  }
  throw Error('Original E2 Discovery/Skills policy did not reach its requested window.');
}
export function completeDiscoveryNativeE2SkillsSetup(game: Game, useActualOffers = false, actions?: DiscoveryNativeE2SkillsStep[]): Game {
  for (let n = 0; game.status === 'setup' && n < 200; n++)
    game = stepDiscoveryNativeE2Skills(game, nextDiscoveryNativeE2SkillsStep(game, useActualOffers), actions);
  assert.equal(game.status, 'playing');
  return game;
}
export function settleDiscoveryNativeE2Skills(game: Game, actions?: DiscoveryNativeE2SkillsStep[]): Game {
  return advanceDiscoveryNativeE2Skills(game, state => discoveryNativeE2SkillsClean(state) &&
    !state.pendingShipment && !state.pendingTreacheryDiscard && !state.pendingChoamWorthless, actions);
}
export function holdDiscoveryNativeE2SkillsCard(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[] = []): Card {
  const p = discoveryNativeE2SkillsPlayer(game, actor), held = p.hand.find(matches);
  if (held) return held;
  assert.ok(p.hand.length < handLimit(p));
  const at = game.deck.findIndex(matches);
  let card: Card;
  if (at >= 0) card = game.deck.splice(at, 1)[0];
  else {
    const donor = game.players.find(other => other.id !== actor && other.hand.some(matches));
    if (donor) {
      card = donor.hand.splice(donor.hand.findIndex(matches), 1)[0];
      staging.push(`Conserved original ${card.id}: ${donor.faction} held position to ${p.faction}; no earned sale or payment claimed.`);
    } else {
      const discarded = game.discard.findIndex(matches);
      assert.ok(discarded >= 0, 'The original physical ordinary card must exist in current deck, hand or discard custody.');
      card = game.discard.splice(discarded, 1)[0];
      staging.push(`Controlled conserved original ${card.id}: actual public discard position to ${p.faction}'s hand; this is not an earned draw or a natural card history.`);
    }
  }
  p.hand.push(card);
  if (at >= 0) staging.push(`Conserved original ${card.id}: undealt ordinary deck to ${p.faction} hand.`);
  return card;
}
function withPlacement<T>(game: Game, face: DiscoveryTokenFace, operation: () => T): T {
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = eligible.findIndex(token => token.face === face);
  assert.ok(index >= 0);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = Math.floor((index + 0.5) * 0x100000000 / eligible.length);
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Human path: original ready lobby → all14 choices → Traitor choices → first
 * Storm → Discovery blow → zero-bid green cache acquisition → collector ships
 * one real force → Collection. Stops BEFORE inspect/reveal. No wallets, phases,
 * receipts, offers, Tech owners or paid marker histories are assigned. */
export function createDiscoveryNativeE2SkillsFixture(options: DiscoveryNativeE2SkillsOptions = {}): DiscoveryNativeE2SkillsFixture {
  const kind = options.kind ?? 'marker';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYNATIVEE2SKILLS', newPlayer('richese', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) for (const faction of ['choam', 'emperor', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.deepEqual(game.expansions, ['choam']);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.spiceBankerIncomePreview && !game.mentatQuestionPreview);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.leaderSkills?.assignments.length === 0 && game.players.every(p =>
      p.hand.length <= (p.faction === 'harkonnen' ? 2 : 1) && p.traitors.length === 0 && p.traitorChoices.length === 0),
  'Only a fresh lobby or its original unassigned skill setup can enter; printed starting hands remain authoritative.');
  const seat = (faction: string) => { const p = game.players.find(p => p.faction === faction); assert.ok(p); return p.id; };
  const richese = seat('richese'), choam = seat('choam'), guild = seat('guild'), observer = seat('emperor');
  const actions: DiscoveryNativeE2SkillsStep[] = [], staging: string[] = [];
  if (game.status === 'lobby') {
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
    game.discoveryEnabled = true;
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  }
  assert.equal(game.discoveryEnabled, true);
  assert.ok(!game.strongholdCards || game.advanced);
  const initial = structuredClone(game);
  if (game.status === 'lobby') {
    const passive: LeaderSkillId[] = ['warmaster', 'swordmaster-of-ginaz', 'killer-medic'];
    const selected = game.players.map(p => requestedSkill(p.faction) ?? passive.shift()!);
    game = options.useActualOffers
      ? initializeLeaderSkillsGameForAudit(game)
      : withOffers(selected, () => initializeLeaderSkillsGameForAudit(game));
    if (!options.useActualOffers) staging.push('Controlled only the original all14 offer shuffle; native subsequent deals and offers are authoritative.');
  }
  const setup = structuredClone(game);
  game = completeDiscoveryNativeE2SkillsSetup(game, options.useActualOffers, actions);
  const afterSetup = structuredClone(game);
  const face: DiscoveryTokenFace = kind === 'stash' ? 'treachery-card-stash' : 'shrine';
  const printed = DISCOVERY_TOKEN_BY_ID[face].type === 'hiereg' ? 'discovery-hagga-basin' : 'discovery-wind-pass-north';
  const placement = DISCOVERY_CARD_PLACEMENTS[printed];
  const index = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed);
  assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
  for (let position = 1; position < 4; position++) {
    const ordinary = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && !card.discovery);
    assert.ok(ordinary >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(ordinary, 1)[0]);
  }
  staging.push('Reordered four original unplayed Spice Cards and selected the original physical Discovery placement lottery.');
  game = advanceDiscoveryNativeE2Skills(game, g => g.phase === 1 && discoveryNativeE2SkillsClean(g), actions);
  const afterFirstStorm = structuredClone(game);
  game = withPlacement(game, face, () => advanceDiscoveryNativeE2Skills(game,
    g => g.discoveries!.tokens.some(token => token.face === face && token.status === 'placed'), actions));
  const collector = kind === 'stash' ? choam : guild;
  game = advanceDiscoveryNativeE2Skills(game, g => g.phase === 5 && g.active === collector && discoveryNativeE2SkillsClean(g), actions);
  assert.ok(discoveryNativeE2SkillsPlayer(game, richese).hand.some(card => card.id === greenId(game)),
    'Acquire the original physical green card through Richese declaration, auction and unbid decision.');
  game = stepDiscoveryNativeE2Skills(game, { actor: collector, action: {
    type: 'ship', territory: placement.territory, sector: placement.sector, amount: 1, elite: 0, allyPayment: 0,
  } }, actions);
  game = settleDiscoveryNativeE2Skills(game, actions);
  game = advanceDiscoveryNativeE2Skills(game, g => g.phase === 7 && discoveryNativeE2SkillsClean(g), actions);
  const token = game.discoveries!.tokens.find(t => t.face === face)!;
  assert.ok(viewGame(game, collector).discoveries!.canInspect.includes(token.id));
  const trainers = { richese: game.leaderSkills!.assignments.find(a => a.owner === richese)!.leader,
    choam: game.leaderSkills!.assignments.find(a => a.owner === choam)!.leader };
  return { initial, setup, afterSetup, afterFirstStorm, game, actions, staging, kind, richese, choam, guild, observer,
    collector, token: token.id, face, parent: placement.territory, parentSector: placement.sector, trainers, green: greenId(game) };
}

export function revealDiscoveryNativeE2Skills(fixture: DiscoveryNativeE2SkillsFixture): Game {
  const game = stepDiscoveryNativeE2Skills(fixture.game, { actor: fixture.collector,
    action: { type: 'discovery', token: fixture.token, reveal: false } }, fixture.actions);
  return stepDiscoveryNativeE2Skills(game, { actor: fixture.collector,
    action: { type: 'discovery', token: fixture.token, reveal: true } }, fixture.actions);
}
/** Exact next human path: inspect/reveal → original end-Mentat claims →
 * next-turn free parent-to-Shrine entry → Storm/Bidding → requested Movement.
 * Entitlements are never prefilled. */
export function discoveryNativeE2SkillsMovementWindow(fixture: DiscoveryNativeE2SkillsFixture, actor = fixture.richese): DiscoveryNativeE2SkillsCheckpoint {
  assert.notEqual(fixture.kind, 'stash');
  let game = revealDiscoveryNativeE2Skills(fixture);
  game = advanceDiscoveryNativeE2Skills(game, g => g.turn === 1 && g.phase === 8 && discoveryNativeE2SkillsClean(g), fixture.actions);
  let beforeFirstMentat = structuredClone(game), firstMentatStep = nextDiscoveryNativeE2SkillsStep(game);
  while (game.turn === 1) {
    beforeFirstMentat = structuredClone(game);
    firstMentatStep = nextDiscoveryNativeE2SkillsStep(game);
    game = stepDiscoveryNativeE2Skills(game, firstMentatStep, fixture.actions);
  }
  const afterFirstMentat = structuredClone(game);
  game = advanceDiscoveryNativeE2Skills(game, g => g.decision?.kind === 'discoveryEntry' && g.decision.player === fixture.collector, fixture.actions);
  const offer = viewGame(game, fixture.collector).discoveryEntry!;
  const entry = discoveryEntryMoveAction(viewGame(game, fixture.collector), offer.sources);
  assert.ok(entry);
  game = stepDiscoveryNativeE2Skills(game, { actor: fixture.collector, action: entry }, fixture.actions);
  game = settleDiscoveryNativeE2Skills(game, fixture.actions);
  assert.equal(discoveryNativeE2SkillsPlayer(game, fixture.collector).forces[`${fixture.face}:0`], 1);
  game = advanceDiscoveryNativeE2Skills(game, g => g.turn === 2 && g.phase === 5 && g.active === actor && discoveryNativeE2SkillsClean(g), fixture.actions);
  return { beforeFirstMentat, firstMentatStep, afterFirstMentat, game };
}
export function discoveryNativeE2SkillsInvoiceAction(game: Game): { action: Action; key: string } {
  const target = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm) &&
    game.players.every(p => Object.entries(p.forces).every(([key, n]) => !n || !key.startsWith(`${t.id}:`))));
  assert.ok(target);
  return { action: { type: 'ship', territory: target.id, sector: target.sectors[0], amount: 6, elite: 0, allyPayment: 0, smuggler: true },
    key: `${target.id}:${target.sectors[0]}` };
}
/** Marker-only: no companion, no ordinary Richese forces at the battle site.
 * Optional reserve cap conserves counters in Polar Sink. The original green
 * cache card is committed ONLY as Planetologist weapon, never its native power. */
export function prepareDiscoveryNativeE2SkillsMarkerBattle(fixture: DiscoveryNativeE2SkillsFixture,
  options: Pick<DiscoveryNativeE2SkillsOptions, 'marker' | 'reserveCap'> = {}): DiscoveryNativeE2MarkerBattle {
  assert.ok(fixture.game.leaderSkills!.assignments.some(a => a.owner === fixture.richese && a.skill === 'planetologist'),
    'The specific green consumer requires a genuinely offered and selected Planetologist; the human marker window does not manufacture it.');
  const window = discoveryNativeE2SkillsMovementWindow(fixture);
  let game = window.game;
  const player = discoveryNativeE2SkillsPlayer(game, fixture.richese), value = options.marker ?? 5;
  if (options.reserveCap !== undefined) {
    assert.ok(options.reserveCap >= 0 && options.reserveCap <= player.reserves);
    const outside = player.reserves - options.reserveCap;
    player.forces['polar_sink:0'] = (player.forces['polar_sink:0'] ?? 0) + outside;
    player.reserves -= outside;
    fixture.staging.push(`Conserved ${outside} original Richese reserve counters into Polar Sink outside the nested battle.`);
  }
  const physical = player.noField!.tokens.find(token => token.value === value)!;
  const defense = holdDiscoveryNativeE2SkillsCard(game, fixture.richese, card => card.kind === 'shield', fixture.staging);
  const beforeShipment = structuredClone(game);
  const shipmentStep: DiscoveryNativeE2SkillsStep = { actor: fixture.richese, action: {
    type: 'ship', territory: fixture.face, sector: 0, noField: physical.id, event: player.noFieldEvent, allyPayment: 0,
  } };
  game = stepDiscoveryNativeE2Skills(game, shipmentStep, fixture.actions);
  game = settleDiscoveryNativeE2Skills(game, fixture.actions);
  const afterShipment = structuredClone(game);
  const enemy = discoveryNativeE2SkillsPlayer(game, fixture.guild);
  assert.ok(enemy.reserves >= 7);
  enemy.reserves -= 7;
  enemy.forces[`${fixture.face}:0`] += 7;
  fixture.staging.push('Conserved seven original Guild reserve counters into its actually entered Shrine, providing eight physical opposing battle counters.');
  game = advanceDiscoveryNativeE2Skills(game, g => g.phase === 6 && discoveryNativeE2SkillsClean(g), fixture.actions);
  game = openSkillsTechBattle(game, fixture.richese, fixture.guild, fixture.face, true);
  const assigned = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const trainer = discoveryNativeE2SkillsPlayer(game, fixture.richese).leaders.find(l => l.id === fixture.trainers.richese)!;
  const opponent = discoveryNativeE2SkillsPlayer(game, fixture.guild).leaders.filter(l => !l.dead && !l.usedAt && !assigned.has(l.id) &&
    l.strength <= trainer.strength + 1 && l.strength >= trainer.strength - 3).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(opponent);
  const opposingDial = trainer.strength + 1 - opponent.strength;
  assert.ok(opposingDial * (game.advanced ? 2 : 1) <= 8);
  const materialized = Math.min(value, discoveryNativeE2SkillsPlayer(game, fixture.richese).reserves);
  return { beforeShipment, shipmentStep, afterShipment, game, token: physical.id, value, materialized, key: `${fixture.face}:0`,
    ownerPlan: { type: 'battlePlan', leader: fixture.trainers.richese, dial: 0, support: 0, weapon: fixture.green, defense: defense.id },
    opponentPlan: { type: 'battlePlan', leader: opponent.id, dial: opposingDial, support: 0 } };
}
export function finishDiscoveryNativeE2SkillsBattle(game: Game, stop: 'cleanup' | 'complete' = 'complete'): Game {
  return finishSkillsTechBattle(game, stop);
}
