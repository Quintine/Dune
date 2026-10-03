import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSpiceBankerIncomeGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { createTechTokens } from '../game/tech-tokens';
import { nextSkillsTechBattleStep, openSkillsTechBattle, finishSkillsTechBattle } from './fixture-skills-tech-battle';
import { assertAdvancedNativeCustody } from './fixture-advanced-native-skills';

export type RicheseSkillsTechOptions = {
  /** Fresh authenticated undealt E2 lobby; retain its original seat IDs/order. */
  initial?: Game;
  advanced?: boolean;
  kind?: 'marker' | 'stone' | 'shipment';
  marker?: 0 | 3 | 5;
  reserves?: number;
  band?: 'normal' | 'skilled';
  /** Atreides opponent exposes its original concealed-marker prescience fences. */
  opponent?: 'emperor' | 'atreides';
  /** A separate actual four-spice revival, never funding fabricated for shipment. */
  bankerPayment?: boolean;
  precedence?: 'double-traitor' | 'explosion';
};
export type RicheseSkillsTechStep = { actor: string; action: Action };
export type RicheseSkillsTechFixture = {
  game: Game;
  initial: Game;
  setup: Game;
  actions: RicheseSkillsTechStep[];
  staging: string[];
  owner: string;
  opponent: string;
  banker: string;
  trainer: string;
  territory: string;
  key: string;
  marker: 0 | 3 | 5;
  kind: 'marker' | 'stone' | 'shipment';
  beforeShipment: Game | null;
  shipmentAction: Action | null;
  afterShipment: Game | null;
  acquisition: { before: Game; actions: RicheseSkillsTechStep[]; after: Game };
  ownerPlan: Action;
  opponentPlan: Action;
};

export function richeseSkillsTechPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
}

/** Control only the original all14 offer shuffle. All later shuffles are native. */
function withOffers<T>(selected: LeaderSkillId[], initialize: () => T): T {
  const cards = LEADER_SKILL_CARDS.map(c => c.id);
  const remaining = cards.filter(c => !selected.includes(c));
  const desired = selected.flatMap(c => [c, remaining.shift()!]);
  desired.push(...remaining);
  const working = [...cards], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor(((j + 0.5) / (i + 1)) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[index++];
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Existing legal no-spend/no-call policy, with the actual Richese unbid producer. */
export function nextRicheseSkillsTechNativeStep(game: Game): RicheseSkillsTechStep {
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision, actor = d.player, event = game.richeseBidding?.event;
    if (d.kind === 'richeseBlackMarket') return { actor, action: { type: 'decision', event, decline: true } };
    if (d.kind === 'richeseDeclaration') return { actor, action: { type: 'decision', event, position: 'first' } };
    if (d.kind === 'richeseCache') {
      const card = game.richeseCache!.find(c => c.id === 'richese-stone-burner') ?? game.richeseCache![0];
      assert.ok(card);
      return { actor, action: { type: 'decision', event, card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (d.kind === 'richeseUnbid') return { actor, action: { type: 'decision', event, keep: game.richeseAuction?.cardId === 'richese-stone-burner' } };
    if (d.kind === 'stoneBurner') return { actor, action: { type: 'decision', event: d.event, mode: 'ignore' } };
  }
  const lot = game.richeseAuction;
  if (!game.response && !game.phaseOpening && !game.decision && lot && !lot.outcome) {
    const actor = lot.method === 'silent' ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id)) : lot.active;
    assert.ok(actor);
    return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
  }
  return nextSkillsTechBattleStep(game);
}
function step(game: Game, actions?: RicheseSkillsTechStep[]): Game {
  const next = nextRicheseSkillsTechNativeStep(game);
  actions?.push(next);
  return applyAction(game, next.actor, next.action);
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
export function advanceRicheseSkillsTechToPhase(state: Game, phase: number, actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let n = 0; (game.phase < phase || !clean(game)) && game.turn === state.turn && n < 1200; n++) game = step(game, actions);
  assert.equal(game.turn, state.turn);
  assert.ok(game.phase >= phase);
  assert.ok(clean(game));
  return game;
}
export function finishRicheseSkillsTechBattle(state: Game, stop: 'skill' | 'cleanup' | 'tech' | 'complete' = 'complete'): Game {
  return finishSkillsTechBattle(state, stop);
}
export function openRicheseSkillsTechBattle(fixture: RicheseSkillsTechFixture, hide = true): Game {
  return openSkillsTechBattle(fixture.game, fixture.owner, fixture.opponent, fixture.territory, hide);
}

function weakestUntrained(game: Game, id: string): string {
  const assigned = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const leader = richeseSkillsTechPlayer(game, id).leaders.filter(l => !assigned.has(l.id) && !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader);
  return leader.id;
}
/** Exchange original physical Traitor custody; never mint another identity. */
function exchangeTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = richeseSkillsTechPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const at = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(at >= 0 || donor);
  if (at >= 0) game.traitorReserve!.splice(at, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved native Traitor ${identity} exchanged for ${returned}.`);
}
function held(game: Game, actor: string, kind: Player['hand'][number]['kind'], staging: string[]): string {
  const player = richeseSkillsTechPlayer(game, actor);
  const at = game.deck.findIndex(c => c.kind === kind);
  assert.ok(at >= 0);
  const card = game.deck.splice(at, 1)[0]; player.hand.push(card);
  staging.push(`Conserved ${card.id}: undealt native deck to ${actor}'s hand.`);
  return card.id;
}

/** Original fresh setup, first Storm and canonical token ownership, real cache
 * acquisition and phase transitions. Only skill offers, unplayed Spice order,
 * conserved forces/cards/Traitors are controlled and explicitly labelled.
 * Never assign wallets, turn, phases, plans, receipts, marker or Tech ownership.
 * Shipment stops BEFORE the real marker/companion action for authenticated UI use;
 * battle stops BEFORE chooseBattle, with live native private plan controls next. */
export function createRicheseSkillsTechFixture(options: RicheseSkillsTechOptions = {}): RicheseSkillsTechFixture {
  const kind = options.kind ?? 'marker', marker = options.marker ?? 5;
  const skill = kind === 'shipment' ? 'smuggler' : 'suk-graduate';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('RICHESKILLTECH', newPlayer('richese', 'Richese', 'richese'), options.advanced ?? true, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('banker', 'Banker', 'atreides'));
    joinGame(game, newPlayer('opponent', 'Emperor', 'emperor'));
  }
  assert.equal(game.status, 'lobby', 'Only a fresh authenticated undealt lobby can enter.');
  assert.deepEqual(game.expansions, ['choam']);
  assert.ok(game.players.length >= 3 && game.players.length <= 6);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const owner = game.players.find(p => p.faction === 'richese')!.id;
  const opponent = game.players.find(p => p.faction === (options.opponent ?? 'emperor'))!.id;
  const banker = game.players.find(p => p.faction === 'atreides')!.id;
  assert.ok(owner && opponent && banker);
  if (!game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  assert.deepEqual(game.techTokens, createTechTokens());
  for (const seat of game.players) if (!seat.ready) game = applyAction(game, seat.id, { type: 'ready' });
  const initial = structuredClone(game), actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  const safe: LeaderSkillId[] = ['prana-bindu-adept', 'swordmaster-of-ginaz', 'warmaster', 'killer-medic'];
  const selected = game.players.map(p => p.id === owner ? skill : p.id === banker ? 'spice-banker' as const : safe.shift()!);
  const bySeat: Record<string, LeaderSkillId> = Object.fromEntries(game.players.map((p, i) => [p.id, selected[i]]));
  game = withOffers(selected, () => initializeSpiceBankerIncomeGameForAudit(game));
  const setup = structuredClone(game);
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const eligible = view.eligibleLeaders.map(l => l.id);
      const leaders = richeseSkillsTechPlayer(game, actor).leaders.filter(l => eligible.includes(l.id))
        .sort((a, b) => actor === owner ? b.strength - a.strength : a.strength - b.strength);
      const selectedSkill = bySeat[actor];
      assert.ok(offer.cards.includes(selectedSkill) && !view.unavailableSkills?.[selectedSkill] && leaders[0]);
      const action: Action = { type: 'leaderSkill', event: offer.event, skill: selectedSkill, leader: leaders[0].id };
      actions.push({ actor, action }); game = applyAction(game, actor, action);
    } else game = step(game, actions);
  }
  assert.equal(game.status, 'playing');
  // Two controlled, still-unplayed original blows, not minted cards or resources.
  const blows = game.spiceDeck.filter(c => 'territory' in c).slice(0, 2);
  for (const [position, card] of blows.entries()) {
    const at = game.spiceDeck.indexOf(card);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Original all14 offer shuffle and first two unplayed non-worm Spice Cards are controlled.');
  for (let n = 0; game.decision?.kind !== 'richeseCache' && n < 1000; n++) game = step(game, actions);
  assert.equal(game.decision?.kind, 'richeseCache');
  const acquisitionBefore = structuredClone(game), acquisitionActions: RicheseSkillsTechStep[] = [];
  for (let n = 0; !richeseSkillsTechPlayer(game, owner).hand.some(c => c.id === 'richese-stone-burner') && n < 100; n++) game = step(game, acquisitionActions);
  assert.ok(richeseSkillsTechPlayer(game, owner).hand.some(c => c.id === 'richese-stone-burner'));
  actions.push(...acquisitionActions);
  const acquisition = { before: acquisitionBefore, actions: acquisitionActions, after: structuredClone(game) };
  if (options.bankerPayment) {
    game = advanceRicheseSkillsTechToPhase(game, 4, actions);
    const payer = game.players.find(p => p.faction === 'emperor');
    assert.ok(payer);
    assert.ok(payer.reserves >= 3);
    payer.reserves -= 3; payer.tanks += 3;
    staging.push('Three original Emperor reserve counters conserved into Tanks before actual four-spice revival.');
    const action: Action = { type: 'revive', amount: 3 };
    actions.push({ actor: payer.id, action }); game = applyAction(game, payer.id, action);
  }
  game = advanceRicheseSkillsTechToPhase(game, 5, actions);
  for (let n = 0; game.active !== owner && n < 20; n++) game = step(game, actions);
  assert.equal(game.phase, 5); assert.equal(game.active, owner);
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
    const kept = p.id === owner ? p.hand.filter(c => c.id === 'richese-stone-burner') : [];
    game.deck.push(...p.hand.filter(c => !kept.includes(c))); p.hand = kept;
  }
  staging.push('Return original board counters to their own reserves and ordinary hands to undealt deck; retain the cache-acquired Stone in Richese custody.');
  const destination = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm));
  assert.ok(destination);
  const territory = destination.id, key = `${territory}:${destination.sectors[0]}`;
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === skill)!.leader;
  let beforeShipment: Game | null = null, shipmentAction: Action | null = null, afterShipment: Game | null = null;
  if (kind !== 'stone') {
    const own = richeseSkillsTechPlayer(game, owner), token = own.noField!.tokens.find(t => t.value === marker)!;
    shipmentAction = { type: 'ship', territory, sector: destination.sectors[0], noField: token.id, event: own.noFieldEvent,
      ...(kind === 'shipment' ? { smuggler: true } : {}) };
    beforeShipment = structuredClone(game);
    if (kind !== 'shipment') {
      actions.push({ actor: owner, action: shipmentAction }); game = applyAction(game, owner, shipmentAction);
      for (let n = 0; !clean(game) && n < 100; n++) game = step(game, actions);
      afterShipment = structuredClone(game);
    }
  }
  const dial = kind === 'marker' ? Math.min(marker, options.reserves ?? 20, 3) : 2;
  let ownerPlan: Action = { type: 'battlePlan', dial, support: game.advanced ? dial : 0,
    leader: options.band === 'normal' ? weakestUntrained(game, owner) : trainer };
  let opponentPlan: Action = { type: 'battlePlan', dial: 0, support: 0, leader: weakestUntrained(game, opponent) };
  if (kind !== 'shipment') {
    const own = richeseSkillsTechPlayer(game, owner), enemy = richeseSkillsTechPlayer(game, opponent);
    const reserveLimit = options.reserves ?? 20;
    assert.ok(reserveLimit >= 0 && reserveLimit <= own.reserves);
    if (kind === 'marker' && own.reserves > reserveLimit) {
      own.forces['polar_sink:0'] = own.reserves - reserveLimit; own.reserves = reserveLimit;
      staging.push(`Conserve Richese counters outside battle in Polar Sink, leaving ${reserveLimit} real reserves.`);
    }
    const enemyAmount = kind === 'stone' ? 4 : 6;
    enemy.reserves -= enemyAmount; enemy.forces[key] = enemyAmount;
    if (kind === 'stone') {
      own.reserves -= 8; own.forces[key] = 8;
      ownerPlan = { ...ownerPlan, weapon: 'richese-stone-burner' };
      opponentPlan = { ...opponentPlan, dial: 1, support: game.advanced ? 1 : 0 };
      if (options.precedence === 'explosion') {
        ownerPlan.defense = held(game, owner, 'shield', staging);
        opponentPlan.weapon = held(game, opponent, 'lasgun', staging);
      }
      if (options.precedence === 'double-traitor') {
        exchangeTraitor(game, owner, String(opponentPlan.leader), staging);
        exchangeTraitor(game, opponent, String(ownerPlan.leader), staging);
      }
    } else {
      ownerPlan.defense = held(game, owner, 'shield', staging);
      opponentPlan.weapon = held(game, opponent, 'worthless', staging);
    }
    staging.push(`Conserved ordinary opponent battle counters: ${enemyAmount}; Stone owner counters: ${kind === 'stone' ? 8 : 0}.`);
    game = advanceRicheseSkillsTechToPhase(game, 6, actions);
    assert.equal(game.phase, 6);
  }
  assertAdvancedNativeCustody(game);
  return { game, initial, setup, actions, staging, owner, opponent, banker, trainer, territory, key, marker, kind,
    beforeShipment, shipmentAction, afterShipment, acquisition, ownerPlan, opponentPlan };
}

export function payRicheseSkillsTechShipment(fixture: RicheseSkillsTechFixture): Game {
  assert.equal(fixture.kind, 'shipment'); assert.ok(fixture.shipmentAction);
  let game = applyAction(fixture.game, fixture.owner, fixture.shipmentAction);
  for (let n = 0; (!clean(game) || game.pendingShipment) && n < 200; n++) game = step(game);
  assert.ok(clean(game) && !game.pendingShipment);
  return game;
}
