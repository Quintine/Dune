import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep, type TruthMovementTransition,
} from './fixture-truth-movement';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthMovementGholaStep = TruthMovementStep;
export const actTruthMovementGhola = actTruthMovement;
export const truthMovementGholaClean = truthMovementClean;
export const truthMovementGholaPlayer = truthMovementPlayer;
export const truthMovementGholaInventory = truthMovementInventory;
const box = richeseCards().find(card => card.effect === 'nullentropyBox');
assert.ok(box);
export const TRUTH_MOVEMENT_GHOLA_BOX = box.id;

/** Real quiet controls; an owned shipped target and any unsealed human battle
 * remain caller choices. The optional purchase is an actual one-spice bid. */
export function nextTruthMovementGholaStep(game: Game, options: { buyBox?: boolean } = {}): TruthMovementGholaStep | null {
  if (game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard && game.decision) {
    const decision = game.decision, actor = decision.player, event = game.richeseBidding?.event;
    if (decision.kind === 'richeseBlackMarket')
      return { actor, action: { type: 'decision', event, decline: true } };
    if (decision.kind === 'richeseDeclaration')
      return { actor, action: { type: 'decision', event, position: 'first' } };
    if (decision.kind === 'richeseCache') {
      const card = game.richeseCache?.find(card => card.id === TRUTH_MOVEMENT_GHOLA_BOX) ?? game.richeseCache?.[0];
      assert.ok(card, 'Choose an original card still in the native cache');
      return { actor, action: { type: 'decision', event, card: card.id,
        method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision.kind === 'richeseUnbid')
      return { actor, action: { type: 'decision', event, keep: false } };
    if (decision.kind === 'faceDance') return { actor, action: { type: 'decision', reveal: false } };
  }
  if (truthMovementGholaClean(game)) {
    const lot = game.richeseAuction;
    if (lot && !lot.outcome) {
      const actor = lot.method === 'silent'
        ? lot.eligible.find(id => !Object.hasOwn(lot.sealed, id)) : lot.active;
      assert.ok(actor);
      const purchase = options.buyBox && actor === 'atreides' && lot.cardId === TRUTH_MOVEMENT_GHOLA_BOX && lot.bid === 0;
      return { actor, action: { type: 'richeseBid', event: lot.event,
        amount: purchase ? 1 : lot.method === 'silent' ? 0 : null, ...(purchase ? { allyPayment: 0 } : {}) } };
    }
    if (game.phase === 5 && game.active === 'atreides' && truthMovementGholaPlayer(game).shipped) return null;
  }
  const next = nextStrongholdFactionsNativeStep(game);
  // Printed Storm Start is sector1. Select actual first-turn dials to reach
  // sector18, so both later desert shipments are legal before the real 1+1
  // sweep crosses sector1 and ends in sector2. Never replace the Storm field.
  if (next?.action.type === 'stormDial' && game.turn === 1)
    next.action.amount = next.actor === game.stormDialers[0] ? 17 : 0;
  return next;
}
export function advanceTruthMovementGhola(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementGholaStep[] = [], options: { buyBox?: boolean } = {}): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ghola programme ended before its requested control');
    const next = nextTruthMovementGholaStep(game, options);
    assert.ok(next, 'Finish the original owned movement or human battle before continuing the Ghola source');
    game = actTruthMovementGhola(game, next.actor, next.action, actions);
  }
  throw Error('The original Ghola programme did not reach its finite boundary');
}

/** Original public source only: no dealt hand, wallet, army or receipt is set. */
function originalGholaSetup(options: { box: boolean; tleilaxu: boolean }) {
  const asker = 'emperor', target = 'atreides';
  const expansions = options.box ? ['choam', ...(options.tleilaxu ? ['ix'] : [])] : options.tleilaxu ? ['ix'] : [];
  let game = createGame(options.box ? 'TRUTHMOVEMENTBOXGHOLA' : 'TRUTHMOVEMENTOWNGHOLA',
    newPlayer(target, 'Atreides', 'atreides'), false, expansions);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  if (options.box) joinGame(game, newPlayer('richese', 'Richese', 'richese'));
  if (options.tleilaxu) joinGame(game, newPlayer('tleilaxu', 'Tleilaxu', 'tleilaxu'));
  const actions: TruthMovementGholaStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovementGhola(game, actor, action, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game), lobbyActionCount = actions.length;
  act(game.host, { type: 'start' });
  const setup = structuredClone(game), setupActionCount = actions.length;
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthMovementGholaInventory(game);
  const originalMainDeck = game.deck.map(card => card.id), originalCache = (game.richeseCache ?? []).map(card => card.id);
  const ghola = game.deck.find(card => card.effect === 'ghola');
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const shield = game.deck.find(card => card.kind === 'shield');
  const baliset = game.deck.find(card => card.name === 'Baliset');
  assert.ok(ghola && truth && shield && baliset);
  const deal = options.box ? [shield.id, truth.id, ghola.id] : [ghola.id, truth.id];
  if (options.tleilaxu) deal.push(baliset.id);
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  game = advanceTruthMovementGhola(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game), afterSetupActionCount = actions.length;
  for (const [index, player] of game.players.entries()) assert.deepEqual(player.hand.map(card => card.id), [deal[index]]);
  const beforeSpiceOrder = structuredClone(game), originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = Array.from({ length: options.box ? 4 : 2 }, (_, position) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && !['cielago_north', 'cielago_depression'].includes(card.territory));
    assert.ok(from >= position, 'Choose an original ordinary Spice card outside both sacrificial sources');
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  return { game, actions, asker, target, ghola: ghola.id, truth: truth.id, expansions,
    tleilaxu: options.tleilaxu ? 'tleilaxu' : null, richese: options.box ? 'richese' : null,
    lobby, lobbyActionCount, setup, setupActionCount, beforeStartingDeal, deal, dealOrder,
    afterSetup, afterSetupActionCount, beforeSpiceOrder, spiceOrder, originalCards, originalMainDeck,
    originalCache, originalSpice };
}
const atTargetShipment = (game: Game) => game.phase === 5 && game.active === 'atreides' && truthMovementGholaClean(game);
function verifyGholaTarget(game: Game, expectedSpice: number) {
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false); assert.ok(atTargetShipment(game));
  const target = truthMovementGholaPlayer(game);
  assert.equal(target.shipped, false); assert.equal(target.moved, 0);
  assert.equal(target.reserves, 9); assert.equal(target.tanks, 1); assert.equal(target.spice, expectedSpice);
  assert.deepEqual(target.forces, { 'arrakeen:10': 10 });
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.movementPromises, undefined);
}
function futureGholaMovement(target: string, asker: string, truth: string, ghola: string) {
  const claim = { kind: 'movement' as const, target, territory: 'carthag', minimum: 20 };
  return {
    card: truth, claim, question: claim,
    truthStep: { actor: asker, action: { type: 'card', card: truth } } satisfies TruthMovementGholaStep,
    declarationStep: { actor: asker, action: { type: 'card', card: truth } } satisfies TruthMovementGholaStep,
    askStep: { actor: asker, action: { type: 'truthAsk', question: claim } } satisfies TruthMovementGholaStep,
    gholaStep: { actor: target, action: { type: 'card', card: ghola, amount: 1, elite: 0 } } satisfies TruthMovementGholaStep,
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 10, elite: 0, allyPayment: 0 } satisfies Action,
    shipmentCost: 10,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 20 } satisfies Action,
    endMovement: { type: 'endMovement' } satisfies Action,
  };
}

/** A real paid turn-one desert shipment becomes one Tank casualty in the next
 * ordinary 1+1 Storm. Actual Revival readiness leaves it dead and Ghola held. */
export function createTruthMovementGholaFixture(options: { tleilaxu?: boolean } = {}) {
  const seed = originalGholaSetup({ box: false, tleilaxu: options.tleilaxu ?? false });
  let game = seed.game;
  const actions = seed.actions;
  const act = (actor: string, action: Action) => { game = actTruthMovementGhola(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthMovementGhola(game, until, actions); };
  reach(state => state.turn === 1 && atTargetShipment(state));
  const beforeBribe = structuredClone(game), bribeStep: TruthMovementGholaStep = {
    actor: seed.asker, action: { type: 'bribe', target: seed.target, amount: 2 },
  };
  act(bribeStep.actor, bribeStep.action);
  const afterBribe = structuredClone(game), bribeActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(afterBribe, seed.asker).spice,
    truthMovementGholaPlayer(beforeBribe, seed.asker).spice - 2);
  assert.equal(truthMovementGholaPlayer(afterBribe).spice, truthMovementGholaPlayer(beforeBribe).spice);
  assert.equal(truthMovementGholaPlayer(afterBribe).bribes, 2);
  const beforeShipment = structuredClone(game), shipmentStep: TruthMovementGholaStep = { actor: seed.target, action: {
    type: 'ship', territory: 'cielago_north', sector: 1, amount: 1, elite: 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action); reach(truthMovementGholaClean);
  const afterShipment = structuredClone(game), shipmentActionCount = actions.length;
  const sourceShipment: TruthMovementTransition = { before: beforeShipment, step: shipmentStep, after: afterShipment };
  act(seed.target, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 8 && truthMovementGholaClean(state));
  const afterFirstCollection = structuredClone(game), collectionActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(game).spice, 10);
  reach(state => state.turn === 2 && state.phase === 0 && truthMovementGholaClean(state));
  const beforeStorm = structuredClone(game), beforeStormActionCount = actions.length;
  reach(state => state.turn === 2 && state.phase === 1 && truthMovementGholaClean(state));
  const afterStorm = structuredClone(game), stormActionCount = actions.length;
  assert.equal(game.storm, 2); assert.equal(truthMovementGholaPlayer(game).tanks, 1);
  assert.deepEqual(truthMovementGholaPlayer(game).forces, { 'arrakeen:10': 10 });
  reach(state => state.turn === 2 && state.phase === 4 && truthMovementGholaClean(state));
  const beforeRevival = structuredClone(game), beforeRevivalActionCount = actions.length;
  reach(state => state.turn === 2 && atTargetShipment(state));
  verifyGholaTarget(game, 10);
  assert.ok(truthMovementGholaPlayer(game).hand.some(card => card.id === seed.ghola));
  assert.ok(truthMovementGholaPlayer(game, seed.asker).hand.some(card => card.id === seed.truth));
  assert.deepEqual(truthMovementGholaInventory(game), seed.originalCards);
  return { ...seed, game, source: structuredClone(game), actions,
    beforeBribe, bribeStep, afterBribe, bribeActionCount,
    beforeShipment, shipmentStep, sourceShipment, afterShipment, shipmentActionCount,
    afterFirstCollection, collectionActionCount, beforeStorm, beforeStormActionCount, afterStorm, stormActionCount,
    beforeRevival, beforeRevivalActionCount, sourceActionCount: actions.length,
    sourceCounts: { setup: seed.afterSetupActionCount, bribe: bribeActionCount, shipment: shipmentActionCount,
      collection: collectionActionCount, beforeStorm: beforeStormActionCount, storm: stormActionCount,
      revival: beforeRevivalActionCount, source: actions.length },
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    ...futureGholaMovement(seed.target, seed.asker, seed.truth, seed.ghola),
    staging: [
      `Original public Basic Atreides/Emperor${seed.tleilaxu ? '/Tleilaxu' : ''} setup genuinely deals the original Ghola to Atreides and Truthtrance to Emperor. Only unopened original deal/ordinary Spice positions and scalar lotteries are selected. Actual first-turn 17+0 dials move printed Storm Start1 to18. Atreides really pays two spice to ship one reserve to printed Cielago North1, ends movement without a ground event, receives Emperor's actual two-spice bribe at Mentat Pause and waits for next-turn 1+1 dials. The actual 1+1 Storm sweep crosses sector1 and ends at2, killing that counter; actual Revival Ready controls decline ordinary revival. The clean turn-2 unshipped source retains ten original Arrakeen forces, nine reserves, one Tank, ten spice and its held original Ghola. Cielago North1 replaces the nonexistent Great Flat1; Great Flat has only printed sector15. Basic city occupation supplies no bank income. The bribe is an actual paid control, not an installed balance. No dealt hand, wallet, army, clock, death, answer, promise or receipt is installed. Future Ghola1, city shipment10 and ground movement20 remain caller actions.`,
    ],
  };
}
export type TruthMovementGholaFixture = ReturnType<typeof createTruthMovementGholaFixture>;

/** Native Richese sells its original cache Box for one spice. Separate actual
 * sacrificial shipments avoid a human battle; Richese's later real Ghola play
 * exposes that original card in the discard, while Atreides keeps its Box. */
export function createTruthMovementBoxGholaFixture(options: { tleilaxu?: boolean } = {}) {
  const seed = originalGholaSetup({ box: true, tleilaxu: options.tleilaxu ?? false });
  let game = seed.game;
  const actions = seed.actions;
  const act = (actor: string, action: Action) => { game = actTruthMovementGhola(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean, buyBox = false) => {
    game = advanceTruthMovementGhola(game, until, actions, { buyBox });
  };
  reach(state => state.turn === 1 && state.phase === 2 && truthMovementGholaClean(state));
  const beforePurchases = structuredClone(game), beforePurchasesActionCount = actions.length;
  reach(state => truthMovementGholaPlayer(state).hand.some(card => card.id === TRUTH_MOVEMENT_GHOLA_BOX), true);
  reach(truthMovementGholaClean);
  const afterPurchase = structuredClone(game), purchaseActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(game).spice, 9);
  reach(state => state.turn === 1 && state.phase === 5 && truthMovementGholaClean(state));
  const beforeBribe = structuredClone(game), bribeStep: TruthMovementGholaStep = {
    actor: seed.asker, action: { type: 'bribe', target: seed.target, amount: 6 },
  };
  act(bribeStep.actor, bribeStep.action);
  const afterBribe = structuredClone(game), bribeActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(afterBribe, seed.asker).spice,
    truthMovementGholaPlayer(beforeBribe, seed.asker).spice - 6);
  assert.equal(truthMovementGholaPlayer(afterBribe).spice, truthMovementGholaPlayer(beforeBribe).spice);
  assert.equal(truthMovementGholaPlayer(afterBribe).bribes, 6);
  const shipments: TruthMovementTransition[] = [];
  for (let count = 0; count < 500; count++) {
    if (game.turn === 1 && game.phase === 8 && truthMovementGholaClean(game)) break;
    if (game.turn === 1 && game.phase === 5 && truthMovementGholaClean(game) &&
      (game.active === seed.target || game.active === 'richese')) {
      const actor = game.active, before = structuredClone(game), step: TruthMovementGholaStep = { actor, action: {
        type: 'ship', territory: actor === seed.target ? 'cielago_north' : 'cielago_depression',
        sector: 1, amount: 1, elite: 0, allyPayment: 0,
      } };
      assert.equal(truthMovementGholaPlayer(game, actor).shipped, false);
      act(step.actor, step.action); reach(truthMovementGholaClean);
      shipments.push({ before, step, after: structuredClone(game) });
      act(actor, { type: 'endMovement' });
    } else {
      const next = nextTruthMovementGholaStep(game); assert.ok(next, 'Do not invent a human battle or owned movement');
      act(next.actor, next.action);
    }
  }
  assert.equal(game.turn, 1); assert.equal(game.phase, 8); assert.ok(truthMovementGholaClean(game));
  assert.equal(shipments.length, 2);
  const afterFirstCollection = structuredClone(game), collectionActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(game).spice, 13);
  reach(state => state.turn === 2 && state.phase === 0 && truthMovementGholaClean(state));
  const beforeStorm = structuredClone(game), beforeStormActionCount = actions.length;
  reach(state => state.turn === 2 && state.phase === 1 && truthMovementGholaClean(state));
  const afterStorm = structuredClone(game), stormActionCount = actions.length;
  assert.equal(game.storm, 2); assert.equal(truthMovementGholaPlayer(game).tanks, 1);
  assert.equal(truthMovementGholaPlayer(game, 'richese').tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && truthMovementGholaClean(state));
  const beforeGhola = structuredClone(game), richeseGholaStep: TruthMovementGholaStep = { actor: 'richese', action: {
    type: 'card', card: seed.ghola, amount: 1, elite: 0,
  } };
  act(richeseGholaStep.actor, richeseGholaStep.action); reach(truthMovementGholaClean);
  const afterGhola = structuredClone(game), gholaActionCount = actions.length;
  assert.equal(truthMovementGholaPlayer(game, 'richese').tanks, 0);
  assert.ok(game.discard.some(card => card.id === seed.ghola));
  reach(state => state.turn === 2 && atTargetShipment(state));
  verifyGholaTarget(game, 13);
  assert.ok(truthMovementGholaPlayer(game).hand.some(card => card.id === TRUTH_MOVEMENT_GHOLA_BOX));
  assert.ok(truthMovementGholaPlayer(game).hand.length < 4, 'The held Box must have its actual free hand slot');
  assert.ok(truthMovementGholaPlayer(game, seed.asker).hand.some(card => card.id === seed.truth));
  assert.ok(game.discard.some(card => card.id === seed.ghola), 'The actual revealed Ghola remains in current discard');
  assert.deepEqual(truthMovementGholaInventory(game), seed.originalCards);
  return { ...seed, game, source: structuredClone(game), actions, box: TRUTH_MOVEMENT_GHOLA_BOX,
    beforeBribe, bribeStep, afterBribe, bribeActionCount,
    beforePurchases, beforePurchasesActionCount, afterPurchase, purchaseActionCount, shipments,
    afterFirstCollection, collectionActionCount, beforeStorm, beforeStormActionCount, afterStorm, stormActionCount,
    beforeGhola, richeseGholaStep, afterGhola, gholaActionCount, sourceActionCount: actions.length,
    sourceCounts: { setup: seed.afterSetupActionCount, beforePurchases: beforePurchasesActionCount,
      purchase: purchaseActionCount, bribe: bribeActionCount, collection: collectionActionCount, beforeStorm: beforeStormActionCount,
      storm: stormActionCount, ghola: gholaActionCount, source: actions.length },
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    ...futureGholaMovement(seed.target, seed.asker, seed.truth, seed.ghola),
    boxStep: { actor: seed.target, action: { type: 'card', card: TRUTH_MOVEMENT_GHOLA_BOX } } satisfies TruthMovementGholaStep,
    boxSelection: { type: 'decision', card: seed.ghola } satisfies Action,
    boxCost: 2,
    staging: [
      `Original public Basic Atreides/Emperor/Richese${seed.tleilaxu ? '/Tleilaxu' : ''} setup genuinely deals Shield/Truthtrance/Ghola and preserves the original main deck and ten-card cache. Actual first-turn 17+0 dials move printed Storm Start1 to18. Atreides actually buys the original cache Box for one spice in Richese's first Once Around auction. Atreides and Richese really pay for separate one-force shipments to Cielago North1 and Cielago Depression1, then end without ground movement. Emperor actually pays a six-spice bribe, which becomes spendable at Mentat Pause. Native next-turn 1+1 dials ending at2 supply both Tank casualties without a shared-territory battle. Basic city occupation supplies no bank income. Richese really plays its held Ghola to return its own counter; that exposed original Ghola remains in the current discard. Actual normal revival declines reach clean turn-2 Atreides Shipment with Box held, a free hand slot, ten Arrakeen forces, nine reserves, one Tank and thirteen spice. No unknown card is acquired, and no dealt hand, wallet, army, clock, death, discard, answer, promise or completed receipt is installed. Future Box2/search, Ghola1, city shipment10 and ground movement20 remain caller actions.`,
    ],
  };
}
export type TruthMovementBoxGholaFixture = ReturnType<typeof createTruthMovementBoxGholaFixture>;
