import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { Card } from '../game/cards';
import type { NoFieldValue } from '../game/richese-no-field';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type NoFieldFullPlanStep = { actor: string; action: Action };
export type NoFieldFullPlanOptions = {
  initial?: Game;
  seatIds?: [string, string, string];
  marker?: NoFieldValue;
  /** Own physical reserves immediately before the original shipment. */
  reserves?: number;
  ordinaryAtMarker?: number;
  ordinaryOtherSector?: number;
  dial?: number;
  support?: number;
  ordinaryField?: 'leader' | 'weapon' | 'defense';
  traitor?: 'owner' | 'atreides';
};
export type NoFieldFullPlanFixture = {
  options: NoFieldFullPlanOptions;
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  shipmentStep: NoFieldFullPlanStep;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: NoFieldFullPlanStep;
  /** Original ordinary prescience, with native pre-leader preparation closed. */
  beforePrescience: Game;
  prescienceStep: NoFieldFullPlanStep;
  beforeAnswer: Game;
  answerStep: NoFieldFullPlanStep;
  /** Original fullPlanOffer, not consumed by a generic continuation driver. */
  game: Game;
  owner: string;
  atreides: string;
  opponent: string;
  observer: string;
  territory: string;
  location: string;
  otherLocation: string;
  token: { id: string; value: NoFieldValue };
  materializes: number;
  cards: { karama: Card; spareKarama: Card; weapon: Card; defense: Card; atreidesDefense: Card };
  inspectStep: NoFieldFullPlanStep;
  declineStep: NoFieldFullPlanStep;
  planActions: [NoFieldFullPlanStep, NoFieldFullPlanStep];
  nativeSteps: NoFieldFullPlanStep[];
  staging: string[];
};
export function noFieldFullPlanPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original full-plan seat ${actor}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

function initialize(game: Game): Game {
  // Scope deterministic dealer randomness to the original fresh initializer only.
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeFactionExpansionsGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function place(game: Game, actor: string, location: string, amount: number) {
  const player = noFieldFullPlanPlayer(game, actor);
  assert.ok(Number.isSafeInteger(amount) && amount >= 0 && amount <= player.reserves);
  player.reserves -= amount;
  if (amount) player.forces[location] = (player.forces[location] ?? 0) + amount;
}
function take(game: Game, actor: string, matches: (card: Card) => boolean): Card {
  const player = noFieldFullPlanPlayer(game, actor);
  assert.ok(player.hand.length < 4);
  const at = game.deck.findIndex(matches);
  assert.ok(at >= 0, 'Move only a physical card from the originally selected native deck');
  const card = game.deck.splice(at, 1)[0];
  player.hand.push(card);
  return structuredClone(card);
}
function exchangeTraitor(game: Game, actor: string, identity: string, staging: string[]) {
  const player = noFieldFullPlanPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const at = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(at >= 0 || donor, 'Exchange an original physical Traitor, never fabricate one');
  if (at >= 0) game.traitorReserve!.splice(at, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved original Traitor ${identity} exchanged for ${returned} into ${actor}'s hand.`);
}

/** Original Advanced faction setup, native CHOAM-selected deck and separate
 * Richese cache. Only labeled conserved board/hand/bank staging follows setup;
 * shipment, chooser, pre-leader readiness, prescience and offer are real actions. */
export function createNoFieldFullPlanFixture(options: NoFieldFullPlanOptions = {}): NoFieldFullPlanFixture {
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => !p.hand.length));
    assert.equal(game.advanced, true);
    assert.deepEqual(game.expansions, ['choam']);
    assert.deepEqual(game.players.map(p => p.faction).sort(), ['atreides', 'guild', 'richese']);
    assert.equal(game.ecazTreachery, undefined);
  } else {
    const ids = options.seatIds ?? ['richese', 'atreides', 'guild'];
    game = createGame('NOFIELDFULLPLAN', newPlayer(ids[0], 'Richese', 'richese'), true, ['choam']);
    joinGame(game, newPlayer(ids[1], 'Atreides', 'atreides'));
    joinGame(game, newPlayer(ids[2], 'Guild', 'guild'));
  }
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    let step: NoFieldFullPlanStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, `Original full-plan setup stalled at ${game.setupStage}`);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'richese')!.id;
  const atreides = game.players.find(p => p.faction === 'atreides')!.id;
  const observer = game.players.find(p => p.faction === 'guild')!.id;
  const territory = 'imperial_basin', sector = 9;
  const location = `${territory}:${sector}`, otherLocation = `${territory}:10`;
  const staging: string[] = [], nativeSteps: NoFieldFullPlanStep[] = [];
  const act = (step: NoFieldFullPlanStep) => {
    nativeSteps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  };
  const advance = (predicate: (state: Game) => boolean) => {
    for (let count = 0; count < 1600; count++) {
      if (predicate(game)) return;
      // Never silently decline ordinary prescience or the special inspection.
      assert.notEqual(game.decision?.kind, 'fullPlanOffer');
      assert.ok(!game.battle?.preparation || game.response || game.battle.preLeader && !game.battle.preLeader.closed);
      const step = nextRicheseStrongholdsNativeStep(game);
      assert.ok(step, 'Native continuation stops before either human plan');
      if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 0;
      act(step);
    }
    throw Error('Native full-plan continuation did not reach its boundary');
  };
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    player.spice = 30;
  }
  staging.push('After actual faction setup: return each original board counter to its own reserves and stage thirty-spice bank balances.');
  advance(g => g.phase === 5 && g.active === owner && clean(g));
  const ordinary = (options.ordinaryAtMarker ?? 0) + (options.ordinaryOtherSector ?? 0);
  const reserves = options.reserves ?? 20 - ordinary;
  assert.ok(Number.isSafeInteger(reserves) && reserves >= 0 && reserves + ordinary <= 20);
  place(game, owner, location, options.ordinaryAtMarker ?? 0);
  place(game, owner, otherLocation, options.ordinaryOtherSector ?? 0);
  place(game, owner, 'polar_sink:0', 20 - reserves - ordinary);
  place(game, atreides, location, 5);
  staging.push(`Before actual shipment: conserve ${ordinary} ordinary Richese battle counters, ${reserves} own reserves, the remainder in Polar Sink and five opposing Atreides counters at ${location}.`);
  const beforeShipment = structuredClone(game);
  const token = structuredClone(noFieldFullPlanPlayer(game, owner).noField!.tokens.find(t => t.value === (options.marker ?? 3))!);
  assert.ok(token);
  const shipmentStep: NoFieldFullPlanStep = { actor: owner, action: {
    type: 'ship', territory, sector, noField: token.id,
    event: noFieldFullPlanPlayer(game, owner).noFieldEvent,
  } };
  act(shipmentStep);
  advance(clean);
  const afterShipment = structuredClone(game);
  advance(g => g.phase === 6 && clean(g));
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  const cards = {
    karama: take(game, atreides, c => c.effect === 'karama'),
    spareKarama: take(game, atreides, c => c.effect === 'karama'),
    weapon: take(game, owner, c => c.kind === 'poison'),
    defense: take(game, owner, c => c.kind === 'shield'),
    atreidesDefense: take(game, atreides, c => c.kind === 'snooper'),
  };
  staging.push('Before actual battle admission: return original dealt hands to their original deck; transfer two physical Karama and Snooper to Atreides, poison weapon and Shield to Richese. Cache/removed custody is unchanged; no hand exceeds four.');
  const ownLeader = noFieldFullPlanPlayer(game, owner).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  const otherLeader = noFieldFullPlanPlayer(game, atreides).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && otherLeader);
  if (options.traitor === 'owner') exchangeTraitor(game, owner, otherLeader.id, staging);
  if (options.traitor === 'atreides') exchangeTraitor(game, atreides, ownLeader.id, staging);
  const materializes = Math.min(token.value, reserves);
  const dial = options.dial ?? Math.min(2, ordinary + materializes);
  const planActions: [NoFieldFullPlanStep, NoFieldFullPlanStep] = [
    { actor: owner, action: { type: 'battlePlan', dial, support: options.support ?? dial,
      leader: ownLeader.id, weapon: cards.weapon.id, defense: cards.defense.id } },
    { actor: atreides, action: { type: 'battlePlan', dial: 5, support: 5,
      leader: otherLeader.id, defense: cards.atreidesDefense.id } },
  ];
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === territory);
  assert.ok(choice, 'A genuine concealed zero must still enter an ordinary battle');
  const battleStep: NoFieldFullPlanStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep);
  // Stop at original ordinary prescience rather than letting the shared driver decline it.
  advance(g => g.battle?.preparation?.kind === 'prescience' && !g.response && !g.decision && !!g.battle.preLeader?.closed);
  const beforePrescience = structuredClone(game);
  const field = options.ordinaryField ?? 'leader';
  const prescienceStep: NoFieldFullPlanStep = { actor: atreides, action: { type: 'prescience', field } };
  act(prescienceStep);
  while (game.response) {
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next); act(next);
  }
  const beforeAnswer = structuredClone(game);
  const answerStep: NoFieldFullPlanStep = { actor: owner, action: {
    type: 'prescienceAnswer', value: field === 'leader' ? ownLeader.id : cards[field].id,
  } };
  act(answerStep);
  assert.ok(game.decision?.kind === 'fullPlanOffer');
  assert.equal(game.decision.player, atreides);
  assert.equal(game.battle?.preparation, undefined);
  assert.deepEqual(game.battle?.plans, {});
  return { options: { ...options, initial: undefined }, initial, afterSetup,
    beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep,
    beforePrescience, prescienceStep, beforeAnswer, answerStep, game,
    owner, atreides, opponent: atreides, observer, territory, location, otherLocation,
    token, materializes, cards,
    inspectStep: { actor: atreides, action: { type: 'card', mode: 'special', card: cards.karama.id, target: owner } },
    declineStep: { actor: atreides, action: { type: 'decision', decline: true } },
    planActions, nativeSteps, staging };
}

export function applyNoFieldFullPlanStep(game: Game, step: NoFieldFullPlanStep): Game {
  return applyAction(game, step.actor, step.action);
}
/** Consume only actual response queues; never decide a power or seal a plan. */
export function finishNoFieldFullPlanResponses(game: Game): Game {
  for (let count = 0; game.response && count < 80; count++) {
    const step = nextRicheseStrongholdsNativeStep(game); assert.ok(step);
    game = applyNoFieldFullPlanStep(game, step);
  }
  assert.equal(game.response, null);
  return game;
}
/** Original Traitor declarations, native loss allocation, cards and aftermath. */
export function finishNoFieldFullPlanBattle(game: Game, callers: string[] = []): Game {
  assert.ok(game.battle?.revealed, 'Both original plans must already be sealed');
  for (let count = 0; count < 160; count++) {
    if (!game.battle && clean(game) && !game.pendingTreacheryDiscard) return game;
    const step = nextRicheseStrongholdsNativeStep(game);
    assert.ok(step, 'Native aftermath cannot invent a battle plan');
    if (step.action.type === 'traitorCall') step.action.call = callers.includes(step.actor);
    game = applyNoFieldFullPlanStep(game, step);
  }
  throw Error('Original full-plan No-Field battle did not finish');
}
