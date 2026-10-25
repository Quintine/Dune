import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actFutureShipment, advanceFutureShipment, nextFutureShipmentStep, futureShipmentClean, futureShipmentPlayer,
  type FutureShipmentStep,
} from './fixture-truthtrance-future-shipment';

export type TruthtranceEarlyAdvancedShipmentPhase = 'storm' | 'charity' | 'bidding';
export type TruthtranceEarlyAdvancedShipmentStep = FutureShipmentStep;
export const actTruthtranceEarlyAdvancedShipment = actFutureShipment;
export const nextTruthtranceEarlyAdvancedShipmentStep = nextFutureShipmentStep;
export const nextTruthtranceEarlyAdvancedShipment = nextFutureShipmentStep;
export const advanceTruthtranceEarlyAdvancedShipment = advanceFutureShipment;
export const truthtranceEarlyAdvancedShipmentPlayer = futureShipmentPlayer;
export const truthtranceEarlyAdvancedShipmentClean = futureShipmentClean;
export function truthtranceEarlyAdvancedShipmentInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original base33 Treachery Card retains one physical slot'); return ids;
}
export const truthtranceEarlyAdvancedShipmentPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active,
  ready: game.ready, movementRemaining: game.movementRemaining,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, forces: player.forces,
    elites: player.elites, reserves: player.reserves, tanks: player.tanks, shipped: player.shipped, moved: player.moved })),
});

/** Actual public Advanced classic start and original five-card deal. Only
 * unopened starting/first-auction/dual-Spice positions and scalar lotteries
 * are selected. Stop before Truthtrance; no played state is installed. */
export function createTruthtranceEarlyAdvancedShipmentFixture(options: {
  phase?: TruthtranceEarlyAdvancedShipmentPhase;
} = {}) {
  const phase = options.phase ?? 'charity', phaseNumber = phase === 'storm' ? 0 : phase === 'charity' ? 2 : 3;
  const asker = 'atreides', target = 'emperor', counterHolder = 'harkonnen', guild = 'guild';
  let game = createGame('TRUTHEARLYADVANCEDSHIPMENT', newPlayer(asker, 'Atreides', 'atreides'), true);
  for (const faction of [target, counterHolder, guild] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: TruthtranceEarlyAdvancedShipmentStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceEarlyAdvancedShipment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceEarlyAdvancedShipment(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = truthtranceEarlyAdvancedShipmentInventory(game); assert.equal(originalInventory.length, 33);
  const truth = game.deck.find(card => card.effect === 'truthtrance'), karama = game.deck.find(card => card.effect === 'karama');
  const baliset = game.deck.find(card => card.name === 'Baliset'), shield = game.deck.find(card => card.kind === 'shield'),
    snooper = game.deck.find(card => card.kind === 'snooper');
  assert.ok(truth && karama && baliset && shield && snooper);
  const deal = [truth.id, baliset.id, karama.id, shield.id, snooper.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  // A genuinely bought ordinary weapon cannot introduce a second Karama
  // coupon into the respondent's later funding witness.
  const ordinaryLot = game.deck.find(card => !deal.includes(card.id) && card.kind === 'projectile' && !card.effect);
  assert.ok(ordinaryLot);
  const auctionFrom = game.deck.findIndex(card => card.id === ordinaryLot.id); assert.ok(auctionFrom >= deal.length);
  [game.deck[deal.length], game.deck[auctionFrom]] = [game.deck[auctionFrom], game.deck[deal.length]];
  const auctionOrder = { position: deal.length, from: auctionFrom, card: ordinaryLot.id };
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), afterSetupActionCount = actions.length;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeSpiceOrder = structuredClone(game);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === phaseNumber && futureShipmentClean(state) &&
    (phaseNumber !== 3 || !!state.auction));
  const respondent = futureShipmentPlayer(game, target);
  assert.equal(respondent.spice, 10); assert.equal(respondent.reserves, 20); assert.equal(respondent.tanks, 0);
  assert.deepEqual(respondent.forces, {}); assert.equal(respondent.shipped, false); assert.equal(respondent.moved, 0);
  assert.ok(futureShipmentPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.ok(futureShipmentPlayer(game, counterHolder).hand.some(card => card.id === karama.id));
  assert.ok(respondent.hand.some(card => card.id === baliset.id));
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.shipmentPromises, undefined);
  assert.deepEqual(truthtranceEarlyAdvancedShipmentInventory(game), originalInventory);
  const question: TruthQuestion = { kind: 'shipment', target, territory: 'carthag', minimum: 8 };
  const declarationStep: TruthtranceEarlyAdvancedShipmentStep = { actor: asker, action: { type: 'card', card: truth.id } };
  const askStep: TruthtranceEarlyAdvancedShipmentStep = { actor: asker, action: { type: 'truthAsk', question } };
  const shipment: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: 8, elite: 0, allyPayment: 0 };
  return { game, source: structuredClone(game), phase, phaseNumber, advanced: true as const,
    asker, target, counterHolder, guild, card: truth.id, truth: truth.id, karama: karama.id, baliset: baliset.id,
    question, declarationStep, askStep, territory: 'carthag', sector: 11, location: 'carthag:11', minimum: 8,
    shipment, bid: { type: 'bid', amount: 2, allyPayment: 0 } satisfies Action,
    bigBid: { type: 'bid', amount: 3, allyPayment: 0 } satisfies Action,
    bigBribe: { type: 'bribe', target: asker, amount: 3 } satisfies Action,
    purchaseCost: 2, shipmentCost: 8, purchaseCard: ordinaryLot.id,
    initial, lobby, setup, beforeStartingDeal, afterSetup, afterSetupActionCount,
    beforeSpiceOrder, spiceOrder, deal, dealOrder, auctionOrder, originalSpice,
    originalInventory, originalTreachery: originalInventory,
    physical: structuredClone(truthtranceEarlyAdvancedShipmentPhysical(game)),
    originalPhysical: structuredClone(truthtranceEarlyAdvancedShipmentPhysical(game)),
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Advanced A/E/H/G ready/start with advancedPreview:true, original base33 and no expansion or optional module. Every private Traitor and original setup control is an actual native action.',
      'Select five original unopened starting-card positions: A Truthtrance, E Baliset, H printed Karama plus Shield, G Snooper. Select one still-unopened ordinary first-auction weapon and two original ordinary Spice positions; physical inventory remains all33 originals.',
      phase === 'storm'
        ? 'Stop at clean original first Storm before its actual secret dials. The proposed commitment uses the current board, not an assumed future Storm outcome.'
        : phase === 'charity'
          ? 'Actually complete first Storm dials and both Advanced Spice blows, then stop at clean original Charity before Bidding.'
          : 'Actually complete first Storm, both Advanced Spice blows and Charity plus native auction-peek responses, then stop at the clean first ordinary lot before any bid.',
      'E retains its actual printed ten spice, twenty native reserves, no board forces and unused shipment. Truthtrance declaration and eight-force Carthag question are returned unplayed. No played hand, wallet, army, clock, promise or response is installed.',
      'The optional continuation genuinely buys the original weapon for two, uses actual Guild TAKE or WAIT/allowance controls, and ships at E actual native turn. It resolves original Guild interception/income and ends only E original turn, without a fabricated early shipment.',
    ],
  };
}
export type TruthtranceEarlyAdvancedShipmentFixture = ReturnType<typeof createTruthtranceEarlyAdvancedShipmentFixture>;

/** Native paid purchase, original Guild timing, and exact reserve delivery.
 * The caller has already asked/answered; this helper creates no promise. */
export function finishTruthtranceEarlyAdvancedShipment(f: TruthtranceEarlyAdvancedShipmentFixture, source: Game,
  options: { guildTake?: boolean; amount?: number } = {}) {
  const amount = options.amount ?? 8, take = options.guildTake ?? false;
  let game = source;
  const actions: TruthtranceEarlyAdvancedShipmentStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceEarlyAdvancedShipment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceEarlyAdvancedShipment(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  assert.equal(game.truthtrance ?? null, null);
  reach(state => state.phase === 3 && futureShipmentClean(state) && state.auction?.active === f.target);
  assert.equal(game.auction?.index, 0); assert.equal(game.auction?.cards[0].id, f.purchaseCard);
  const purchase = transition(() => {
    act(f.target, f.bid);
    reach(state => state.phase === 4 && futureShipmentClean(state));
  });
  assert.equal(futureShipmentPlayer(purchase.before, f.target).spice, 10);
  assert.equal(futureShipmentPlayer(game, f.target).spice, 8);
  assert.ok(futureShipmentPlayer(game, f.target).hand.some(card => card.id === f.purchaseCard));
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
  const timing: ReturnType<typeof transition>[] = [];
  const guildTurn: ReturnType<typeof transition>[] = [];
  const chooseTiming = (choice: boolean) => {
    assert.equal(game.decision?.kind, 'guildTiming');
    timing.push(transition(() => {
      act(f.guild, { type: 'decision', take: choice });
      reach(state => futureShipmentClean(state));
    }));
  };
  chooseTiming(take);
  if (take) {
    assert.equal(game.active, f.guild);
    guildTurn.push(transition(() => { act(f.guild, { type: 'endMovement' }); }));
  }
  reach(state => state.phase === 5 && futureShipmentClean(state) && state.active === f.asker);
  const askerEnd = transition(() => { act(f.asker, { type: 'endMovement' }); });
  if (!take) {
    reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
    chooseTiming(false);
  }
  reach(state => state.phase === 5 && futureShipmentClean(state) && state.active === f.target);
  const beforeShipment = structuredClone(game), shipmentAction: Action = { ...f.shipment, amount };
  const start = actions.length;
  act(f.target, shipmentAction);
  const declared = structuredClone(game), originalControls: Game[] = [];
  for (let count = 0; !futureShipmentClean(game) || !!game.pendingShipment; count++) {
    assert.ok(count < 100, 'Resolve only the original shipment permission/payment/income');
    originalControls.push(structuredClone(game));
    const step = nextFutureShipmentStep(game); assert.ok(step);
    act(step.actor, step.action);
  }
  const delivered = structuredClone(game), shipment = { before: beforeShipment, action: shipmentAction,
    declared, controls: originalControls, steps: structuredClone(actions.slice(start)), after: delivered };
  assert.equal(futureShipmentPlayer(game, f.target).forces[f.location], amount);
  assert.equal(futureShipmentPlayer(game, f.target).reserves, 20 - amount);
  assert.equal(futureShipmentPlayer(game, f.target).spice, 8 - amount);
  const end = transition(() => { act(f.target, { type: 'endMovement' }); });
  assert.deepEqual(truthtranceEarlyAdvancedShipmentInventory(game), f.originalInventory);
  return { game, purchase, timing, guildTurn, askerEnd, beforeShipment, shipmentAction, shipment, declared,
    delivered, end, actions, amount, guildTake: take };
}
