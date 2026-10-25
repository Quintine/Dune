import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actTruthMovement, truthMovementClean, truthMovementPlayer, type TruthMovementStep,
} from './fixture-truth-movement';
import {
  nextTruthMovementNativeEarlyStep, type TruthMovementNativeEarlyAuction,
} from './fixture-truth-movement-native-early';

export type TruthtranceRichesePromisesKind = 'shipment' | 'movement';
export type TruthtranceRichesePromisesStep = TruthMovementStep;
export type TruthtranceRichesePromisesTransition = {
  before: Game; steps: TruthtranceRichesePromisesStep[]; after: Game;
};
export const actTruthtranceRichesePromises = actTruthMovement;
export const truthtranceRichesePromisesClean = truthMovementClean;
export const truthtranceRichesePromisesPlayer = (game: Game, actor = 'richese') => truthMovementPlayer(game, actor);
export function truthtranceRichesePromisesInventory(game: Game) {
  const start = (game.auction?.index ?? 0) + Number(game.currentAuctionSale?.origin === 'normal');
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(start) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical card has one current location');
  return ids;
}
export const truthtranceRichesePromisesPhysical = (game: Game) => game.players.map(p => ({
  player: p.id, reserves: p.reserves, tanks: p.tanks, forces: structuredClone(p.forces),
  elites: structuredClone(p.elites), noField: structuredClone(p.noField),
  shipped: p.shipped, moved: p.moved,
}));

/** Only original controls. Richese owns its real shipment/move and questions;
 * native cache defaults are first / Once Around / all pass / remove unbid. */
export function nextTruthtranceRichesePromises(game: Game,
  auction: TruthMovementNativeEarlyAuction = {}): TruthtranceRichesePromisesStep | null {
  if (game.truthtrance) {
    if (game.truthtrance.stage !== 'priority') return null;
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'truthPass' } };
  }
  if (truthtranceRichesePromisesClean(game) && game.status === 'playing' && game.phase === 5) {
    if (game.active === 'richese') return null;
    if (game.active === 'emperor') return { actor: 'emperor', action: { type: 'endMovement' } };
  }
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise', keepUnbid: false,
    card: 'richese-stone-burner', ...auction,
  });
}
export const nextTruthtranceRichesePromisesStep = nextTruthtranceRichesePromises;
export function advanceTruthtranceRichesePromises(game: Game, until: (state: Game) => boolean,
  actions: TruthtranceRichesePromisesStep[] = [], auction: TruthMovementNativeEarlyAuction = {}): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Richese source ended before its requested control');
    const step = nextTruthtranceRichesePromises(game, auction);
    assert.ok(step, `Choose the original Richese question, bid, shipment or move at ${game.turn}/${game.phase}/${game.truthtrance?.stage ?? game.decision?.kind}`);
    game = actTruthtranceRichesePromises(game, step.actor, step.action, actions);
  }
  throw Error('The native Richese promise source did not reach its finite boundary');
}
export function finishTruthtranceRichesePromises(game: Game, actions: TruthtranceRichesePromisesStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (game.phase === 7 && truthtranceRichesePromisesClean(game)) return game;
    const step = truthtranceRichesePromisesClean(game) && game.phase === 5 && game.active === 'richese'
      ? { actor: 'richese', action: { type: 'endMovement' } as Action }
      : nextTruthtranceRichesePromises(game);
    assert.ok(step, 'Complete the accepted original Richese promise before finishing movement');
    game = actTruthtranceRichesePromises(game, step.actor, step.action, actions);
  }
  throw Error('The native Richese movement did not reach original Collection');
}

/** Genuine public R/A/E, exact E2 main35/cache10, no modules. Select original
 * unopened deal/normal-lot/Spice positions only; native actions earn all state. */
export function createTruthtranceRichesePromisesFixture(options: {
  advanced?: boolean; kind?: TruthtranceRichesePromisesKind;
} = {}) {
  const advanced = options.advanced ?? false, kind = options.kind ?? 'shipment';
  const target = 'richese', asker = 'atreides', observer = 'emperor';
  let game = createGame('TRUTHRICHESENATIVEPROMISES', newPlayer(target, 'Richese', 'richese'), false, ['choam']);
  joinGame(game, newPlayer(asker, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthtranceRichesePromisesStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceRichesePromises(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceRichesePromises(game, until, actions); };
  const transition = (run: () => void): TruthtranceRichesePromisesTransition => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  const rules = transition(() => { if (advanced) act(game.host, { type: 'rules', advanced: true }); });
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['choam']); assert.ok(game.players.every(p => !p.hand.length));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = truthtranceRichesePromisesInventory(game);
  const originalMainDeck = game.deck.map(card => card.id), originalCache = game.richeseCache!.map(card => card.id);
  assert.equal(originalInventory.length, 45); assert.equal(originalMainDeck.length, 35); assert.equal(originalCache.length, 10);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const shield = game.deck.find(card => card.kind === 'shield'), snooper = game.deck.find(card => card.kind === 'snooper');
  const ordinaryLot = game.deck.find(card => card.name === 'Baliset'); assert.ok(truth && shield && snooper && ordinaryLot);
  const deal = [shield.id, truth.id, snooper.id];
  const dealOrder = [...deal, ordinaryLot.id].map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  for (const [index, p] of game.players.entries()) assert.deepEqual(p.hand.map(card => card.id), [deal[index]]);
  const originalNoField = structuredClone(truthtranceRichesePromisesPlayer(game).noField);
  assert.ok(originalNoField); assert.equal(originalNoField.deployed, null);
  assert.deepEqual(truthtranceRichesePromisesPlayer(game).forces, {});
  assert.equal(truthtranceRichesePromisesPlayer(game).reserves, 20);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  reach(state => state.turn === 1 && state.phase === 2 && truthtranceRichesePromisesClean(state));
  const earlySource = structuredClone(game), earlyActionCount = actions.length;
  assert.equal(truthtranceRichesePromisesPlayer(game).spice, 5);
  const beforeBidding = structuredClone(game);
  const shipmentAction: Action = { type: 'ship', territory: kind === 'shipment' ? 'carthag' : 'arrakeen',
    sector: kind === 'shipment' ? 11 : 10,
    amount: kind === 'shipment' ? 5 : 1, elite: 0, allyPayment: 0 };
  const source = structuredClone(game), territory = 'carthag';
  const minimum = kind === 'shipment' ? 5 : 1, sector = 11;
  const question: TruthQuestion = { kind, target, territory, minimum };
  const moveAction: Action = { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 };
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.shipmentPromises?.length ?? 0, 0);
  assert.equal(game.movementPromises?.length ?? 0, 0);
  assert.deepEqual(truthtranceRichesePromisesInventory(game), originalInventory);
  assert.deepEqual([...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort(), originalSpice);
  return { game, source, advanced, kind, asker, target, richese: target, observer, emperor: observer,
    card: truth.id, truth: truth.id, truthtrance: truth.id, targetCard: shield.id, ordinaryLot: ordinaryLot.id,
    question, claim: question, minimum, impossibleMinimum: minimum + 1, territory, sector, location: `${territory}:${sector}`,
    declarationStep: { actor: asker, action: { type: 'card', card: truth.id } } satisfies TruthtranceRichesePromisesStep,
    askStep: { actor: asker, action: { type: 'truthAsk', question } } satisfies TruthtranceRichesePromisesStep,
    shipmentAction, shipmentStep: { actor: target, action: shipmentAction },
    moveAction, moveStep: { actor: target, action: moveAction }, action: kind === 'shipment' ? shipmentAction : moveAction,
    cacheCard: 'richese-stone-burner', cacheBid: { type: 'richeseBid', amount: 1, allyPayment: 0 } satisfies Action,
    normalBid: { type: 'bid', amount: 1, allyPayment: 0 } satisfies Action,
    initial, rules, lobby, setup, beforeStartingDeal, afterSetup, deal, dealOrder,
    originalMainDeck, originalCache, originalCards: originalInventory, originalInventory, originalSpice, spiceOrder, originalNoField,
    earlySource, beforeBidding, budget: truthtranceRichesePromisesPlayer(game).spice,
    originalRound: structuredClone(game.richeseBidding), originalFunding: structuredClone(game.richeseFunding),
    originalPhysical: truthtranceRichesePromisesPhysical(game),
    actions, steps: actions, sourceActionCount: actions.length, sourceCounts: { early: earlyActionCount, source: actions.length },
    staging: [
      `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Atreides/Emperor, exact CHOAM main35/cache10 and no modules. Only original unopened deal positions (R Shield, A Truthtrance, E Snooper, first ordinary lot Baliset), two unopened land Spice positions and original scalar lotteries are selected. No played hand, wallet, army, phase, No-Field, promise or receipt is installed.`,
      kind === 'shipment'
        ? 'Stop at actual turn1 Charity with native Richese five spice, twenty reserves, no board forces and unused shipment/movement. Original Black Market (Advanced), owned cache position/card/terms, native bids/unbid removal and ordinary invoices remain real future controls. Baseline asks for five actual ordinary city counters, financed solely by current Richese cash. Native one-spice own purchases leave four; no later cache-sale income is assumed.'
        : 'Stop at actual turn1 Charity with native Richese five spice, twenty reserves, no board forces and unused shipment/movement. The question asks for a later real one-counter ground move to Carthag. The native target-private completion guide must find an affordable original route on the later turn and may prefer an original No-Field. The ordinary physical case explicitly ships1 to Arrakeen, then uses the actual ground completion; minimal profiles retain their native chosen guide. No future landing, force, payment, route or outcome is preinstalled. Original cache and ordinary auctions remain caller-visible native controls.',
    ],
  };
}
export type TruthtranceRichesePromisesFixture = ReturnType<typeof createTruthtranceRichesePromisesFixture>;
export function askTruthtranceRichesePromises(game: Game, fixture: TruthtranceRichesePromisesFixture,
  question: TruthQuestion = fixture.question, actions: TruthtranceRichesePromisesStep[] = []): Game {
  game = actTruthtranceRichesePromises(game, fixture.asker, fixture.declarationStep.action, actions);
  game = advanceTruthtranceRichesePromises(game, state => state.truthtrance?.stage === 'ask', actions);
  return actTruthtranceRichesePromises(game, fixture.asker, { type: 'truthAsk', question }, actions);
}
