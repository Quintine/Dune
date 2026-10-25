import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { distance, location, TERRITORIES } from '../game/board';
import { botGroundMoveAllowed } from '../game/bot-mobility';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';

export { actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer };
export type TruthMovementAdvancedStep = TruthMovementStep;
export type TruthMovementAdvancedTransition = { before: Game; steps: TruthMovementStep[]; after: Game };
export const actTruthMovementAdvanced = actTruthMovement;
export const truthMovementAdvancedClean = truthMovementClean;
export const truthMovementAdvancedInventory = truthMovementInventory;
export const truthMovementAdvancedPlayer = (game: Game, actor = game.players[0].id) => truthMovementPlayer(game, actor);

/** Native original setup and phase controls only. Truthtrance and the shipped
 * respondent's movement remain caller-owned; no promise is silently closed. */
export function nextTruthMovementAdvancedNativeStep(game: Game): TruthMovementStep | null {
  if (game.truthtrance) return null;
  const target = game.players[0].id;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard &&
      game.status === 'setup' && game.setupStage === 'forces' &&
      truthMovementPlayer(game, target).faction === 'fremen' && truthMovementPlayer(game, target).reserves === 20)
    return { actor: target, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 },
      elitePlacements: { 'sietch_tabr:14': 2 } } };
  if (game.phase === 5 && game.active === target && truthMovementPlayer(game, target).shipped && truthMovementClean(game)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthMovementAdvanced(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Advanced movement source ended before its requested control');
    const next = nextTruthMovementAdvancedNativeStep(game);
    assert.ok(next, `Supply the original Truthtrance or ground movement at ${game.turn}/${game.phase}/${game.truthtrance?.stage ?? game.decision?.kind}`);
    game = actTruthMovement(game, next.actor, next.action, actions);
  }
  throw Error('The original Advanced Truthtrance movement source did not reach its finite boundary');
}
export { advanceTruthMovementAdvanced as advanceTruthMovement };

/** Public rules selection and original Advanced preview start. Original Hajr
 * and Truthtrance are actually dealt; all later clocks/counters/payment arise
 * from native controls. The optional Fremen route earns a real auction Karama. */
export function createTruthMovementAdvancedFixture(options: {
  hajr?: boolean; targetFaction?: 'atreides' | 'fremen';
} = {}) {
  const targetFaction = options.targetFaction ?? 'atreides', target = targetFaction, asker = 'emperor';
  const withHajr = options.hajr ?? true;
  let game = createGame('TRUTHMOVEMENTADVANCED', newPlayer(target, targetFaction === 'atreides' ? 'Atreides' : 'Fremen', targetFaction), false);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthMovementAdvanced(game, until, actions); };
  const transition = (run: () => void): TruthMovementAdvancedTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const rules = transition(() => { act(game.host, { type: 'rules', advanced: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.advancedPreview, true);
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalCards = truthMovementInventory(game); assert.equal(originalCards.length, 33);
  const targetCard = game.deck.find(card => withHajr ? card.effect === 'hajr' : card.kind === 'projectile');
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance');
  const karama = targetFaction === 'fremen' ? game.deck.find(card => card.effect === 'karama') : null;
  assert.ok(targetCard && truthtrance); assert.ok(targetFaction !== 'fremen' || karama);
  const selected = [targetCard, truthtrance, ...(karama ? [karama] : [])];
  const deal = selected.slice(0, 2).map(card => card.id);
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let fremenSetup: TruthMovementAdvancedTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextTruthMovementAdvancedNativeStep(game); assert.ok(next);
    const before = next.action.type === 'fremenSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) fremenSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthMovementPlayer(game, target).hand.map(card => card.id), [targetCard.id]);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [truthtrance.id]);
  if (targetFaction === 'atreides') assert.deepEqual(truthMovementPlayer(game, target).forces, { 'arrakeen:10': 10 });
  else {
    assert.ok(fremenSetup); assert.deepEqual(truthMovementPlayer(game, target).forces, { 'sietch_tabr:14': 10 });
    assert.equal(truthMovementPlayer(game, target).elites?.forces['sietch_tabr:14'], 2);
    assert.equal(truthMovementPlayer(game, target).elites?.reserves, 1);
  }
  const startingPositions = Object.fromEntries(game.players.map(player => [player.id, {
    forces: structuredClone(player.forces), reserves: player.reserves, spice: player.spice,
    elites: structuredClone(player.elites),
  }]));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let karamaAcquisition: TruthMovementAdvancedTransition | null = null;
  if (karama) {
    reach(state => state.phase === 3 && truthMovementClean(state) && state.auction?.active === asker &&
      state.auction.cards[state.auction.index]?.id === karama.id);
    karamaAcquisition = transition(() => {
      act(asker, { type: 'bid', amount: 1, allyPayment: 0 });
      reach(state => truthMovementClean(state) && truthMovementPlayer(state, asker).hand.some(card => card.id === karama.id));
    });
  }
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthMovementClean(state));
  const beforeShipment = structuredClone(game);
  assert.equal(truthMovementPlayer(game, target).shipped, false);
  const shipmentStep: TruthMovementStep = { actor: target, action: {
    type: 'ship', amount: 1, territory: 'polar_sink', sector: 0,
    elite: targetFaction === 'fremen' ? 1 : 0, allyPayment: 0,
  } };
  const shipment = transition(() => { act(shipmentStep.actor, shipmentStep.action); reach(truthMovementClean); });
  const player = truthMovementPlayer(game, target), shipmentCost = truthMovementPlayer(beforeShipment, target).spice - player.spice;
  assert.equal(game.phase, 5); assert.equal(game.turn, 1); assert.equal(game.active, target);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0); assert.equal(player.forces['polar_sink:0'], 1);
  assert.equal(player.reserves, 9); assert.equal(shipmentCost, targetFaction === 'fremen' ? 0 : 2);
  if (targetFaction === 'atreides') assert.equal(player.forces['arrakeen:10'], 10);
  else {
    assert.equal(player.elites?.forces['polar_sink:0'], 1); assert.equal(player.elites?.forces['sietch_tabr:14'], 2);
    assert.equal(player.elites?.reserves, 0); assert.ok(truthMovementPlayer(game, asker).hand.some(card => card.id === karama!.id));
  }
  assert.ok(player.hand.some(card => card.id === targetCard.id));
  assert.ok(truthMovementPlayer(game, asker).hand.some(card => card.id === truthtrance.id));
  assert.deepEqual(truthMovementInventory(game), originalCards);
  const truthStep: TruthMovementStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  const matchingMove: Action = targetFaction === 'atreides'
    ? { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 6 }
    : { type: 'move', from: 'polar_sink:0', territory: 'imperial_basin', sector: 9, amount: 1, elite: 1 };
  const questionAction: Action = { type: 'truthAsk', question: { kind: 'movement', target,
    territory: targetFaction === 'atreides' ? 'carthag' : 'imperial_basin', minimum: targetFaction === 'atreides' ? 6 : 1 } };
  let twoStepMove: Action | null = null, twoStepDestination: string | null = null;
  if (targetFaction === 'fremen') {
    const view = viewGame(game, target), own = view.players.find(candidate => candidate.id === target)!;
    const destination = TERRITORIES.flatMap(territory => territory.sectors.map(sector => ({ territory: territory.id, sector })))
      .find(to => to.sector !== game.storm && distance('polar_sink:0', location(to.territory, to.sector)) === 2 &&
        botGroundMoveAllowed(view, own, 'polar_sink:0', location(to.territory, to.sector), 1));
    assert.ok(destination, 'The original Fedaykin group has a legal native two-step movement');
    twoStepDestination = destination.territory;
    twoStepMove = { type: 'move', from: 'polar_sink:0', ...destination, amount: 1, elite: 1 };
  }
  return { game, source: structuredClone(game), initial, rules, lobby, setup, beforeStartingDeal, afterSetup,
    fremenSetup, beforeShipment, shipment: { ...shipment, step: shipmentStep }, shipmentStep, shipmentCost,
    targetFaction, asker, target, truth: truthtrance.id, truthtrance: truthtrance.id,
    hajr: withHajr ? targetCard.id : null, targetCard: targetCard.id, karama: karama?.id ?? null, karamaAcquisition,
    truthStep, declaration: truthStep.action, questionAction, matchingMove, twoStepMove, twoStepDestination,
    nonmatchingMove: targetFaction === 'atreides'
      ? { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 4 } satisfies Action : null,
    hajrAction: withHajr ? { type: 'card', card: targetCard.id } satisfies Action : null,
    typedGroup: targetFaction === 'fremen' ? { source: 'polar_sink:0', normal: 0, elite: 1 } : null,
    deal, dealOrder, spiceOrder, originalCards, originalInventory: originalCards, originalSpice, startingPositions,
    actions, steps: actions, sourceActionCount: actions.length,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    staging: [
      'Actual public two-seat classic lobby starts Basic, uses host rules advanced:true, readies both seats and submits exact start advancedPreview:true. No played Basic state is converted and no development initializer is used.',
      'Select only original scalar lotteries, unopened starting-deal positions and two original unopened ordinary Spice positions. The target really receives Hajr (or the explicitly requested ordinary projectile) and Emperor really receives Truthtrance from the native base33 deal.',
      targetFaction === 'atreides'
        ? 'Actual Atreides private Traitor setup retains its original ten Arrakeen counters and ten reserves. Native safe Storm, both Advanced Spice blows, Charity, Bidding and Revival precede an actual two-spice one-force Polar Sink shipment; the original ten Arrakeen forces and held Hajr remain.'
        : 'Actual Fremen setup places ten Tabr14 counters including two original Fedaykin, retaining one original reserve Fedaykin. Emperor actually wins the original next Karama auction lot with a one-spice invoice through native bidding/payment/income. Original Storm/forecast responses, both Spice blows, Charity and Revival precede a real free Polar Sink shipment of the last reserve Fedaykin.',
      'Stop at clean first Shipment and Movement with the target active, actual shipment used and ordinary ground movement unused. Source, beforeShipment, original paid/dealt cards and typed counters are real chronology snapshots. No hand, force, wallet, phase, allowance, movement promise, pending response or receipt is installed.',
      'Truthtrance declaration/question, Hajr play and returned original ground movements remain caller-owned. This source establishes native Advanced provenance only; it does not certify the expanded forecast, every faction/module or later-round movement semantics.',
    ] };
}
export type TruthMovementAdvancedFixture = ReturnType<typeof createTruthMovementAdvancedFixture>;
export function createFremenTruthMovementAdvancedFixture(options: { hajr?: boolean } = {}) {
  return createTruthMovementAdvancedFixture({ ...options, targetFaction: 'fremen' });
}

/** Submit a real declaration, priority passes and one structured question. */
export function askTruthMovementAdvanced(game: Game, asker: string, card: string,
  target: string, minimum = 6, territory = 'carthag') {
  game = actTruthMovement(game, asker, { type: 'card', card });
  for (const player of game.players) if (!game.truthtrance!.passed.includes(player.id))
    game = actTruthMovement(game, player.id, { type: 'truthPass' });
  return actTruthMovement(game, asker,
    { type: 'truthAsk', question: { kind: 'movement', target, territory, minimum } });
}
