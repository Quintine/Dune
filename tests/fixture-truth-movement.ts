import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthMovementStep = { actor: string; action: Action };
export type TruthMovementTransition = { before: Game; step: TruthMovementStep; after: Game };
export const truthMovementPlayer = (game: Game, actor = 'atreides') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const truthMovementClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function truthMovementInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []), ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical card has one current location');
  return ids;
}

/** Select original scalar lotteries only. UUID/byte entropy remains native. */
function withOriginalScalarLottery<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actTruthMovement(game: Game, actor: string, action: Action,
  actions: TruthMovementStep[] = []): Game {
  const next = withOriginalScalarLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}

/** Native windows only. The caller owns Truthtrance and the shipped target's
 * actual movement choices; this helper cannot silently finish those promises. */
export function nextTruthMovementNativeStep(game: Game): TruthMovementStep | null {
  if (game.truthtrance) return null;
  if (game.phase === 5 && game.active === 'atreides' &&
    truthMovementPlayer(game).shipped && truthMovementClean(game)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthMovement(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Basic programme ended before its next control');
    const next = nextTruthMovementNativeStep(game);
    assert.ok(next, `Supply the original Truthtrance or movement choice: ${JSON.stringify({
      status: game.status, turn: game.turn, phase: game.phase, active: game.active,
      truth: game.truthtrance?.stage, decision: game.decision,
    })}`);
    game = actTruthMovement(game, next.actor, next.action, actions);
  }
  throw Error('The original Basic Truthtrance movement source did not reach its finite boundary');
}

/** Genuine public Basic source with no installed hand, wallet, force, clock or
 * pending receipt. Choose only unopened starting-deal/Spice positions and native
 * scalar lotteries. The target's optional Hajr is its actually dealt card. */
export function createTruthMovementFixture(options: { hajr?: boolean } = {}) {
  const asker = 'emperor', target = 'atreides', withHajr = options.hajr ?? true;
  let game = createGame('TRUTHMOVEMENTSOURCE', newPlayer(target, 'Atreides', 'atreides'), false);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  const actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthMovement(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, []); assert.equal(game.deck.length, 33);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthMovementInventory(game);
  const targetCard = game.deck.find(card => withHajr ? card.effect === 'hajr' : card.kind === 'projectile');
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance');
  assert.ok(targetCard && truthtrance); assert.notEqual(targetCard.id, truthtrance.id);
  const deal = [targetCard.id, truthtrance.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthMovementPlayer(game, target).hand.map(card => card.id), [targetCard.id]);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [truthtrance.id]);
  assert.deepEqual(truthMovementPlayer(game, target).forces, { 'arrakeen:10': 10 });
  assert.equal(truthMovementPlayer(game, target).reserves, 10);
  const startingPositions = Object.fromEntries(game.players.map(player => [player.id, {
    forces: structuredClone(player.forces), reserves: player.reserves, spice: player.spice,
  }]));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthMovementClean(state));
  const beforeShipment = structuredClone(game);
  assert.equal(truthMovementPlayer(game, target).shipped, false);
  const shipmentStep: TruthMovementStep = { actor: target, action: {
    type: 'ship', amount: 1, territory: 'polar_sink', sector: 0, elite: 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action);
  reach(truthMovementClean);
  const shipment: TruthMovementTransition = { before: beforeShipment, step: shipmentStep, after: structuredClone(game) };
  const targetNow = truthMovementPlayer(game, target);
  assert.equal(game.active, target); assert.equal(game.phase, 5); assert.equal(game.turn, 1);
  assert.equal(targetNow.shipped, true); assert.equal(targetNow.moved, 0);
  assert.deepEqual(targetNow.forces, { 'arrakeen:10': 10, 'polar_sink:0': 1 });
  assert.equal(targetNow.reserves, 9);
  assert.equal(targetNow.spice, truthMovementPlayer(beforeShipment, target).spice - 2);
  assert.deepEqual(truthMovementInventory(game), originalCards);
  const source = structuredClone(game);
  const truthStep: TruthMovementStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  return {
    game, source, lobby, setup, beforeStartingDeal, afterSetup, beforeShipment, shipment, shipmentStep,
    asker, target, truth: truthtrance.id, truthtrance: truthtrance.id,
    hajr: withHajr ? targetCard.id : null, targetCard: targetCard.id,
    deal, dealOrder, spiceOrder, originalCards, originalSpice, startingPositions,
    truthStep, actions, sourceActionCount: actions.length,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    staging: [
      'Only two unopened original starting-deal positions, two unopened ordinary land Spice positions and native scalar lotteries are selected. Public Basic Atreides/Emperor setup retains the original 33-card deck. Emperor receives its original dealt Truthtrance; Atreides receives original dealt Hajr (or an ordinary projectile when explicitly requested). Real readiness, setup, Storm/Spice/Charity/Bidding/Revival precede a real two-spice one-force reserve shipment to Polar Sink. The original ten Arrakeen forces, native balances, real bought/dealt cards and all allowances remain. No hand, wallet, force, clock, pending decision, movement promise or receipt is installed. The source stops before any Truthtrance declaration or actual ground movement.',
    ],
  };
}
export type TruthMovementFixture = ReturnType<typeof createTruthMovementFixture>;
