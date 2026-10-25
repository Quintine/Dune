import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { location, MOBILE_LOCATION, TERRITORIES } from '../game/board';
import { botGroundMoveAllowed, botMovementRange, groundMoveRouteDistance } from '../game/bot-mobility';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';
import {
  askTruthMovementAdvanced, nextTruthMovementAdvancedNativeStep,
  type TruthMovementAdvancedTransition,
} from './fixture-truth-movement-advanced';

export const actTruthMovementIxian = actTruthMovement;
export const truthMovementIxianClean = truthMovementClean;
export const truthMovementIxianInventory = truthMovementInventory;
export const truthMovementIxianPlayer = (game: Game, actor = 'ixians') => truthMovementPlayer(game, actor);
export { askTruthMovementAdvanced as askTruthMovementIxian };
export type TruthMovementIxianStep = TruthMovementStep;

/** Actual native choices only. Keep the original Karama in the inspected auction
 * pool by returning a different original card; no auction card is installed. */
export function nextTruthMovementIxianNativeStep(game: Game): TruthMovementStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard &&
      game.decision?.kind === 'ixAuction') {
    const card = game.ixAuction?.cards.find(card => card.effect !== 'karama');
    assert.ok(card, 'The original Ixian auction pool has a non-Karama card to return');
    return { actor: game.decision.player, action: { type: 'decision', card: card.id, position: 'bottom' } };
  }
  return nextTruthMovementAdvancedNativeStep(game);
}

export function advanceTruthMovementIxian(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ixian movement source ended before its requested control');
    const next = nextTruthMovementIxianNativeStep(game);
    assert.ok(next, `Supply the real Truthtrance or Ixian ground movement at ${game.turn}/${game.phase}/${game.truthtrance?.stage ?? game.decision?.kind}`);
    game = actTruthMovement(game, next.actor, next.action, actions);
  }
  throw Error('The original Ixian Truthtrance source did not reach its finite boundary');
}

/** Public Advanced preview, declared Ix expansion, and original Ixian forces.
 * Only unopened deal/Spice positions and native scalar lotteries are selected.
 * Actual setup, auction and shipment earn every held card and selected Cyborg. */
export function createTruthMovementIxianFixture() {
  const target = 'ixians', asker = 'emperor';
  let game = createGame('TRUTHMOVEMENTIXIAN', newPlayer(target, 'Ixians', 'ixians'), false, ['ix']);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthMovementIxian(game, until, actions); };
  const transition = (run: () => void): TruthMovementAdvancedTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const rules = transition(() => { act(game.host, { type: 'rules', advanced: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(actions.at(-1)?.action, { type: 'start', advancedPreview: true });
  assert.deepEqual(game.expansions, ['ix']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthMovementInventory(game); assert.equal(originalCards.length, 47);
  const targetCard = game.deck.find(card => card.kind === 'projectile' && !card.effect);
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance');
  const karama = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  assert.ok(targetCard && truthtrance && karama);
  const deal = [targetCard.id, truthtrance.id];
  const dealOrder = [...deal, karama.id].map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  let ixianSetup: TruthMovementAdvancedTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextTruthMovementIxianNativeStep(game); assert.ok(next);
    const before = game.decision?.kind === 'ixSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) ixianSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(ixianSetup);
  const afterSetup = structuredClone(game), originalIxians = truthMovementPlayer(game, target);
  assert.deepEqual(originalIxians.hand.map(card => card.id), [targetCard.id]);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [truthtrance.id]);
  assert.deepEqual(originalIxians.forces, { [MOBILE_LOCATION]: 6 });
  assert.equal(originalIxians.elites?.forces[MOBILE_LOCATION], 3);
  assert.equal(originalIxians.elites?.reserves, 4); assert.equal(originalIxians.reserves, 14);
  const startingPositions = Object.fromEntries(game.players.map(player => [player.id, {
    forces: structuredClone(player.forces), elites: structuredClone(player.elites),
    reserves: player.reserves, spice: player.spice,
  }]));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 3 && truthMovementClean(state) &&
    state.auction?.active === asker && state.auction.cards[state.auction.index]?.id === karama.id);
  const karamaAcquisition = transition(() => {
    act(asker, { type: 'bid', amount: 1, allyPayment: 0 });
    reach(state => truthMovementClean(state) && truthMovementPlayer(state, asker).hand.some(card => card.id === karama.id));
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthMovementClean(state));
  const beforeShipment = structuredClone(game);
  assert.equal(truthMovementPlayer(game, target).shipped, false);
  const shipmentStep: TruthMovementStep = { actor: target, action: {
    type: 'ship', amount: 2, territory: 'polar_sink', sector: 0, elite: 2, allyPayment: 0,
  } };
  const shipment = transition(() => { act(shipmentStep.actor, shipmentStep.action); reach(truthMovementClean); });
  const player = truthMovementPlayer(game, target), shipmentCost = truthMovementPlayer(beforeShipment, target).spice - player.spice;
  assert.equal(game.turn, 1); assert.equal(game.phase, 5); assert.equal(game.active, target);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0);
  assert.equal(player.forces['polar_sink:0'], 2); assert.equal(player.elites?.forces['polar_sink:0'], 2);
  assert.equal(player.reserves, 12); assert.equal(player.elites?.reserves, 2); assert.equal(shipmentCost, 4);
  assert.equal(player.forces[MOBILE_LOCATION], 6); assert.equal(player.elites?.forces[MOBILE_LOCATION], 3);
  assert.equal(game.mobileStronghold?.location, 'polar_sink:0');
  assert.ok(!Object.entries(player.forces).some(([key, amount]) => amount > 0 && /^(arrakeen|carthag):/.test(key)));
  assert.ok(player.hand.some(card => card.id === targetCard.id));
  for (const card of [truthtrance, karama]) assert.ok(truthMovementPlayer(game, asker).hand.some(held => held.id === card.id));
  assert.deepEqual(truthMovementInventory(game), originalCards);
  const view = viewGame(game, target), own = view.players.find(player => player.id === target)!;
  assert.equal(botMovementRange(view, own, 2), 2);
  const destination = TERRITORIES.filter(territory => territory.type === 'sand')
    .flatMap(territory => territory.sectors.map(sector => ({ territory: territory.id, sector })))
    .find(to => to.sector !== game.storm && groundMoveRouteDistance(view, own, 'polar_sink:0', location(to.territory, to.sector)) === 2 &&
      botGroundMoveAllowed(view, own, 'polar_sink:0', location(to.territory, to.sector), 2));
  assert.ok(destination, 'The two original shipped Cyborgs have a legal native two-step route');
  const matchingMove: Action = { type: 'move', forces: { 'polar_sink:0': 2 },
    eliteForces: { 'polar_sink:0': 2 }, ...destination };
  const truthStep: TruthMovementStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  const questionAction: Action = { type: 'truthAsk', question: {
    kind: 'movement', target, territory: destination.territory, minimum: 2,
  } };
  return { game, source: structuredClone(game), initial, rules, lobby, setup, beforeStartingDeal, afterSetup,
    ixianSetup, beforeShipment, shipment: { ...shipment, step: shipmentStep }, shipmentStep, shipmentCost,
    targetFaction: 'ixians' as const, asker, target, truth: truthtrance.id, truthtrance: truthtrance.id,
    targetCard: targetCard.id, hajr: null, karama: karama.id, karamaAcquisition,
    truthStep, declaration: truthStep.action, questionAction, matchingMove,
    twoStepMove: matchingMove, twoStepDestination: destination.territory, destination,
    typedGroup: { source: 'polar_sink:0', normal: 0, elite: 2 },
    deal, dealOrder, spiceOrder, originalCards, originalInventory: originalCards, originalSpice, startingPositions,
    actions, steps: actions, sourceActionCount: actions.length,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    staging: [
      'Actual public two-seat Ixians/Emperor lobby declares only the Ix expansion, selects Advanced through host rules, readies both seats and submits start advancedPreview:true. No optional module or development initializer is used.',
      'Select only original scalar lotteries, three unopened Treachery positions and two unopened ordinary land Spice positions. Ixians actually choose the original ordinary projectile from their starting inspection; Emperor receives the remaining original Truthtrance. The original 47-card Ix deck is conserved.',
      'Actual first Storm places the original Hidden Mobile Stronghold at Polar Sink with its untouched six native counters including three Cyborgs. The actual Ixian pre-auction inspection returns a non-Karama card to the bottom; Emperor buys the original Karama through an actual one-spice winning bid and native invoice/payment/income.',
      'Both Advanced Spice blows, Charity, Bidding and Revival precede an actual four-spice two-Cyborg reserve shipment to Polar Sink. Original HMS counters remain there and the selected board group has no city ornithopter range. The returned move selects both physical Cyborgs explicitly with forces and eliteForces and has an actual legal distance-two route.',
      'Stop at clean turn-one Shipment and Movement with Ixians active, shipment spent and moved zero. Truthtrance declaration/question/answer, the exact ground movement and its native Ixian counter remain caller-owned. No played hand, force, wallet, phase, allowance, promise, response or receipt is installed. This source establishes only this native Advanced expansion chronology.',
    ] };
}

export { createTruthMovementIxianFixture as createIxianTruthMovementAdvancedFixture };
export type TruthMovementIxianFixture = ReturnType<typeof createTruthMovementIxianFixture>;
