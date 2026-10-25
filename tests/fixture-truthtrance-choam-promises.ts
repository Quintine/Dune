import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actFutureShipment, nextFutureShipmentStep, futureShipmentClean, futureShipmentPlayer,
  type FutureShipmentStep,
} from './fixture-truthtrance-future-shipment';

export type TruthtranceChoamPromiseKind = 'shipment' | 'movement';
export type TruthtranceChoamPromisesStep = FutureShipmentStep;
export const actTruthtranceChoamPromises = actFutureShipment;
export const truthtranceChoamPromisesPlayer = futureShipmentPlayer;
export const truthtranceChoamPromisesClean = futureShipmentClean;
export const truthtranceChoamPromisesPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active,
  ready: game.ready, movementRemaining: game.movementRemaining,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, forces: player.forces,
    elites: player.elites, reserves: player.reserves, tanks: player.tanks, shipped: player.shipped, moved: player.moved })),
});
export function truthtranceChoamPromisesInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original exact-CHOAM Treachery Card has one physical slot'); return ids;
}
/** Never infer allowance from an early Yes. The real CHOAM opening response
 * stays caller-owned until an explicit native pass or cancellation. */
export function nextTruthtranceChoamPromisesStep(game: Game): TruthtranceChoamPromisesStep | null {
  if (game.response?.kind === 'choamCharity') return null;
  if (!game.truthtrance && !game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'choamMarket' || game.decision?.kind === 'choamMentat')
      return { actor: game.decision.player, action: { type: 'decision', done: true } };
    if (game.decision?.kind === 'choamMovement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  }
  return nextFutureShipmentStep(game);
}
export const nextTruthtranceChoamPromises = nextTruthtranceChoamPromisesStep;
export function advanceTruthtranceChoamPromises(game: Game, until: (state: Game) => boolean,
  actions: TruthtranceChoamPromisesStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextTruthtranceChoamPromisesStep(game);
    assert.ok(step, 'Choose the real CHOAM income response or structured Truth answer before continuing');
    game = actTruthtranceChoamPromises(game, step.actor, step.action, actions);
  }
  throw Error('The native CHOAM promise programme did not reach its finite boundary');
}
export function allowTruthtranceChoamPromisesIncome(game: Game, actions: TruthtranceChoamPromisesStep[] = []): Game {
  assert.equal(game.response?.kind, 'choamCharity');
  for (let count = 0; game.response?.kind === 'choamCharity' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthtranceChoamPromises(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'choamCharity');
  return advanceTruthtranceChoamPromises(game, state => state.phase === 2 && futureShipmentClean(state), actions);
}

/** Fresh public native A/C/E/H source before the first CHOAM opening income.
 * Only original unopened deal/first-lot/Spice positions and native scalar
 * lotteries are selected. Raw cash remains two until the real response ends. */
export function createTruthtranceChoamPromisesFixture(options: {
  advanced?: boolean; kind?: TruthtranceChoamPromiseKind;
} = {}) {
  const advanced = options.advanced ?? false, kind = options.kind ?? 'shipment';
  const asker = 'atreides', target = 'choam', counterHolder = 'emperor', harkonnen = 'harkonnen';
  let game = createGame('TRUTHCHOAMPROMISES', newPlayer(asker, 'Atreides', 'atreides'), advanced, ['choam']);
  for (const faction of [target, counterHolder, harkonnen] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: TruthtranceChoamPromisesStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceChoamPromises(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceChoamPromises(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['choam']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = truthtranceChoamPromisesInventory(game); assert.equal(originalInventory.length, 35);
  assert.equal(game.richeseCache ?? null, null);
  const truth = game.deck.find(card => card.effect === 'truthtrance'), karama = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.find(card => card.kind === 'projectile' && !card.effect),
    shield = game.deck.find(card => card.kind === 'shield'), snooper = game.deck.find(card => card.kind === 'snooper');
  assert.ok(truth && karama && ordinary && shield && snooper);
  const deal = [truth.id, ordinary.id, karama.id, shield.id, snooper.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const auctionCard = game.deck.find(card => !deal.includes(card.id) && card.kind === 'poison' && !card.effect); assert.ok(auctionCard);
  const auctionFrom = game.deck.findIndex(card => card.id === auctionCard.id); assert.ok(auctionFrom >= deal.length);
  [game.deck[deal.length], game.deck[auctionFrom]] = [game.deck[auctionFrom], game.deck[deal.length]];
  const auctionOrder = { position: deal.length, from: auctionFrom, card: auctionCard.id };
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), afterSetupActionCount = actions.length;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  const rawCash = futureShipmentPlayer(game, target).spice, originalReserves = futureShipmentPlayer(game, target).reserves;
  assert.equal(rawCash, 2); assert.equal(originalReserves, 20);
  assert.deepEqual(futureShipmentPlayer(game, target).forces, {});
  assert.ok(futureShipmentPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.ok(futureShipmentPlayer(game, counterHolder).hand.some(card => card.id === karama.id));
  assert.ok(futureShipmentPlayer(game, target).hand.every(card => !card.effect && card.kind === 'projectile'));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeSpiceOrder = structuredClone(game);
  const spiceOrder = Array.from({ length: advanced ? 2 : 1 }, (_, position) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.phase === 0 && futureShipmentClean(state));
  assert.equal(game.turn, 1); assert.equal(futureShipmentPlayer(game, target).spice, rawCash);
  assert.equal(game.choamCharity, undefined); assert.equal(game.truthtrance ?? null, null);
  assert.equal(game.shipmentPromises, undefined); assert.equal(game.movementPromises, undefined);
  const incomeAmount = game.players.length * 2, minimum = kind === 'shipment' ? 10 : 6;
  assert.equal(incomeAmount, 8);
  const question: TruthQuestion = kind === 'shipment'
    ? { kind: 'shipment', target, territory: 'carthag', minimum }
    : { kind: 'movement', target, territory: 'carthag', minimum };
  const declarationStep: TruthtranceChoamPromisesStep = { actor: asker, action: { type: 'card', card: truth.id } };
  const askStep: TruthtranceChoamPromisesStep = { actor: asker, action: { type: 'truthAsk', question } };
  const shipment: Action = { type: 'ship', territory: kind === 'shipment' ? 'carthag' : 'arrakeen',
    sector: kind === 'shipment' ? 11 : 10, amount: minimum, elite: 0, allyPayment: 0 };
  const move: Action = { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 6, elite: 0 };
  return { game, source: structuredClone(game), advanced, kind, asker, target, choam: target, counterHolder,
    spender: counterHolder, emperor: counterHolder, harkonnen, card: truth.id, truth: truth.id, karama: karama.id,
    question, declarationStep, askStep, territory: 'carthag', sector: 11, location: 'carthag:11', minimum,
    rawCash, incomeAmount, allowedCash: rawCash + incomeAmount, originalReserves,
    shipment, move, shipmentLocation: kind === 'shipment' ? 'carthag:11' : 'arrakeen:10',
    bid: { type: 'bid', amount: 2, allyPayment: 0 } satisfies Action, purchaseCard: auctionCard.id,
    purchaseCost: kind === 'movement' ? 2 : 0,
    blockedBid: { type: 'bid', amount: kind === 'shipment' ? 1 : 5, allyPayment: 0 } satisfies Action,
    blockedBribe: { type: 'bribe', target: asker, amount: kind === 'shipment' ? 1 : 5 } satisfies Action,
    cancelIncome: { type: 'card', card: karama.id, mode: 'cancel' } satisfies Action,
    initial, lobby, setup, beforeStartingDeal, afterSetup, afterSetupActionCount,
    beforeSpiceOrder, spiceOrder, originalSpice, deal, dealOrder, auctionOrder,
    originalInventory, originalTreachery: originalInventory,
    originalPhysical: structuredClone(truthtranceChoamPromisesPhysical(game)),
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      `Actual public ${advanced ? 'Advanced preview' : 'Basic'} native A/C/E/H ready/start, exact CHOAM with all35 original main-deck Treachery Cards, no Richese cache and no optional modules. No Basic game is converted or new profile gate opened.`,
      'Select only five unopened starting positions: A Truthtrance, C ordinary projectile with no Karama/Worthless effect, E printed Karama, H Shield/Snooper. Select a distinct ordinary first-auction poison card and original ordinary first-Spice positions; no played hand or future draw is installed.',
      'Actually finish original private Traitor/setup controls and stop at clean first Storm. C still has its native two spice, twenty reserves, no board forces and no opening-income stamp. Truth declaration and question remain unplayed.',
      kind === 'shipment'
        ? 'The proposed ten-force Carthag shipment needs the printed eight-spice four-seat opening. Actual allowance later yields ten; no ordinary auction cost can consume that reserved shipment budget.'
        : 'The proposed six-force ground move needs a real six-force city shipment first. Actual opening allowance later funds a genuine normal purchase2, shipment6 to Arrakeen and ornithopter-range movement6 to Carthag. The preceding shipment alone does not fulfill the ground promise.',
      'The native CHOAM opening response remains explicitly caller-owned. An early answer creates no credit, waiver or invented allowance. Native printed Karama cancellation, native income allowance and all later controls use their original actions; no wallet, force, clock, promise or response is installed.',
    ],
  };
}
export type TruthtranceChoamPromisesFixture = ReturnType<typeof createTruthtranceChoamPromisesFixture>;

/** Continue only after the caller has allowed the actual opening. No hidden
 * auction windfall, foreign gift or scripted income is supplied to the route. */
export function finishTruthtranceChoamPromises(f: TruthtranceChoamPromisesFixture, source: Game,
  options: { answer?: 'yes' | 'no' } = {}) {
  const answer = options.answer ?? 'yes'; let game = source;
  const actions: TruthtranceChoamPromisesStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceChoamPromises(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceChoamPromises(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
  assert.equal(futureShipmentPlayer(game, f.target).spice, f.allowedCash);
  reach(state => state.phase === 3 && futureShipmentClean(state) && state.auction?.active === f.target);
  const beforeBid = structuredClone(game);
  let purchase: ReturnType<typeof transition> | null = null;
  if (f.kind === 'movement') {
    assert.equal(game.auction?.index, 0); assert.equal(game.auction.cards[0].id, f.purchaseCard);
    purchase = transition(() => {
      act(f.target, f.bid); reach(state => state.phase === 4 && futureShipmentClean(state));
    });
    assert.equal(futureShipmentPlayer(game, f.target).spice, f.allowedCash - 2);
    assert.ok(futureShipmentPlayer(game, f.target).hand.some(card => card.id === f.purchaseCard));
  }
  reach(state => state.phase === 5 && futureShipmentClean(state) && state.active === f.target);
  const beforeShipment = structuredClone(game);
  const shipmentAction: Action = f.kind === 'shipment' && answer === 'no' ? { ...f.shipment, amount: 9 } : f.shipment;
  const shipment = transition(() => { act(f.target, shipmentAction); reach(state => futureShipmentClean(state) && !state.pendingShipment); });
  const afterShipment = structuredClone(game);
  let move: ReturnType<typeof transition> | null = null;
  const moveAction: Action = f.kind === 'movement' && answer === 'no' ? { ...f.move, amount: 5 } : f.move;
  if (f.kind === 'movement') move = transition(() => {
    act(f.target, moveAction); reach(futureShipmentClean);
  });
  const delivered = structuredClone(game);
  let turnEnd: ReturnType<typeof transition> | null = null;
  if (f.kind === 'movement' && answer === 'no') turnEnd = transition(() => {
    act(f.target, { type: 'endMovement' });
    assert.ok(!game.movementRemaining?.includes(f.target));
  });
  const finished = structuredClone(game);
  assert.deepEqual(truthtranceChoamPromisesInventory(game), f.originalInventory);
  return { game, beforeBid, purchase, beforeShipment, shipmentAction, shipment, afterShipment,
    moveAction, move, delivered, turnEnd, finished, answer, actions };
}
