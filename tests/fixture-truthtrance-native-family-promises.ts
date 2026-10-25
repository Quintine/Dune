import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TruthtranceNativeFamilyPromisesKind = 'shipment' | 'movement';
export type TruthtranceNativeFamilyPromisesStep = TruthMovementStep;
export const actTruthtranceNativeFamilyPromises = actTruthMovement;
export const truthtranceNativeFamilyPromisesPlayer = truthMovementPlayer;
export const truthtranceNativeFamilyPromisesInventory = truthMovementInventory;
export const truthtranceNativeFamilyPromisesClean = truthMovementClean;
export const truthtranceNativeFamilyPromisesPhysical = (game: Game) => game.players.map(p => ({
  id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves, tanks: p.tanks,
  elites: p.elites, leaders: p.leaders, ally: p.ally, moved: p.moved, shipped: p.shipped,
}));

/** Native quiet controls only. The original question and Ecaz's actual
 * shipment/movement remain caller-owned, including choosing to skip them. */
export function nextTruthtranceNativeFamilyPromises(game: Game): TruthMovementStep | null {
  if (game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'moritaniSetup')
      return { actor: decision.player, action: { type: 'decision', territory: 'oh_gap', sector: 9 } };
    if (decision?.kind === 'ecazPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (game.status === 'setup' && game.setupStage === 'forces' &&
      truthMovementPlayer(game, 'ecaz').reserves === 20)
      return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
  }
  if (game.status === 'playing' && game.phase === 5 && game.active === 'ecaz' && truthMovementClean(game)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export const nextTruthtranceNativeFamilyPromisesStep = nextTruthtranceNativeFamilyPromises;
export function advanceTruthtranceNativeFamilyPromises(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextTruthtranceNativeFamilyPromises(game);
    assert.ok(next, `Supply the original Truthtrance or Ecaz action at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actTruthMovement(game, next.actor, next.action, actions);
  }
  throw Error('The original E3 promise programme did not reach its finite boundary');
}
export function finishTruthtranceNativeFamilyPromises(game: Game, actions: TruthMovementStep[] = []): Game {
  return advanceTruthtranceNativeFamilyPromises(game, truthMovementClean, actions);
}

/** Actual public Basic/Advanced native E3 setup, original undealt card
 * positions and an unopened land Spice selection. No played custody is set. */
export function createTruthtranceNativeFamilyPromisesFixture(options: {
  advanced?: boolean; kind?: TruthtranceNativeFamilyPromisesKind;
} = {}) {
  const advanced = options.advanced ?? false, kind = options.kind ?? 'shipment';
  const asker = 'atreides', target = 'ecaz', moritani = 'moritani';
  let game = createGame(`TRUTHNATIVEFAMILYPROMISES${advanced ? 'ADV' : 'BASIC'}${kind.toUpperCase()}`,
    newPlayer(asker, 'Atreides', 'atreides'), advanced, ['ecaz']);
  joinGame(game, newPlayer(target, 'Ecaz', 'ecaz'));
  joinGame(game, newPlayer(moritani, 'Moritani', 'moritani'));
  const initial = structuredClone(game), actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceNativeFamilyPromises(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  const start: TruthMovementStep = { actor: game.host, action: advanced ? { type: 'start', advancedPreview: true } : { type: 'start' } };
  act(start.actor, start.action);
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthMovementInventory(game); assert.equal(originalCards.length, 33);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 2);
  assert.ok(truth); assert.equal(ordinary.length, 2);
  const selected = [truth, ...ordinary], deal = selected.map(card => card.id);
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), setupAt = actions.length;
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupSteps = structuredClone(actions.slice(setupAt));
  const ecazSetup = setupSteps.find(step => step.action.type === 'ecazSetup'); assert.ok(ecazSetup);
  const moritaniSetup = setupSteps.find(step => step.action.type === 'decision' && step.action.territory === 'oh_gap'); assert.ok(moritaniSetup);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.deepEqual(truthMovementPlayer(game, target).forces, { 'imperial_basin:10': 6 });
  assert.equal(truthMovementPlayer(game, target).reserves, 14);
  assert.equal(truthMovementPlayer(game, target).spice, 12);
  assert.equal(truthMovementPlayer(game, asker).forces['arrakeen:10'], 10);
  assert.deepEqual(truthMovementPlayer(game, moritani).forces, { 'oh_gap:9': 6 });
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const beforeSpiceOrder = structuredClone(game);
  const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
  const land = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(land);
  const spiceOrder = [{ position: 0, from, card: structuredClone(land) }], phaseAt = actions.length;
  reach(state => state.turn === 1 && state.phase === 2 && truthMovementClean(state));
  const nativePhases = { before: beforeSpiceOrder, steps: structuredClone(actions.slice(phaseAt)), after: structuredClone(game) };
  assert.equal(game.advanced, advanced); assert.deepEqual(game.ready, []);
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.shipmentPromises, undefined); assert.equal(game.movementPromises, undefined);
  assert.equal(truthMovementPlayer(game, target).spice, 12);
  assert.equal(truthMovementPlayer(game, target).reserves, 14);
  assert.equal(truthMovementPlayer(game, target).forces['imperial_basin:10'], 6);
  assert.deepEqual(truthMovementInventory(game), originalCards);
  assert.deepEqual([...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort(), originalSpice);
  const question = { kind, target, territory: kind === 'shipment' ? 'carthag' : 'arrakeen', minimum: kind === 'shipment' ? 5 : 6 };
  const declarationStep: TruthMovementStep = { actor: asker, action: { type: 'card', card: truth.id } };
  const askStep: TruthMovementStep = { actor: asker, action: { type: 'truthAsk', question } };
  const shipment: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: 5, elite: 0, allyPayment: 0 };
  const move: Action = { type: 'move', from: 'imperial_basin:10', territory: 'arrakeen', sector: 10, amount: 6 };
  return { game, source: structuredClone(game), advanced, kind, asker, target, owner: target, moritani,
    truth: truth.id, card: truth.id, question, claim: question, declarationStep, askStep, shipment, move,
    eventAction: kind === 'shipment' ? shipment : move, endMovement: { type: 'endMovement' } as Action,
    initial, lobby, start, setup, beforeStartingDeal, afterSetup, setupSteps, ecazSetup, moritaniSetup,
    beforeSpiceOrder, spiceOrder, originalSpice, originalCards, originalInventory: originalCards, deal, dealOrder, nativePhases,
    physical: structuredClone(truthtranceNativeFamilyPromisesPhysical(game)), actions, sourceActionCount: actions.length,
    staging: [
      `Original public ${advanced ? 'Advanced preview' : 'Basic'} Atreides/Ecaz/Moritani setup selects exact Ecaz and no optional module or independent Treachery variant. Original unopened starting positions deal Truthtrance to Atreides and ordinary cards to Ecaz/Moritani. Ecaz actually chooses six in Basin10, Moritani six in Oh Gap9, and Atreides retains its original Arrakeen10 garrison.`,
      'Actual Storm/Spice and readiness reach first Charity before declaration. Ecaz retains printed12 cash,14 reserves and its native six-counter group. A future reserve-city5 shipment pays real5, or a future adjacent ground move sends the original six to Arrakeen beside original Atreides10. No hand, army, wallet, phase clock, promise, parent or completed event is installed.',
    ] };
}
export type TruthtranceNativeFamilyPromisesFixture = ReturnType<typeof createTruthtranceNativeFamilyPromisesFixture>;
