import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { nexusMoritaniAction } from '../game/nexus-moritani-options';
import { validateNexusMoritani } from '../game/nexus-moritani';
import { nexusMoritaniRecordSignature } from '../game/terror-location';
import {
  createE3IndependentNexusCardSetup, e3IndependentNexusCardPlayer as player,
  type E3IndependentNexusCardOptions,
} from './fixture-e3-independent-nexus-cards';
import {
  actAtomicsModules, advanceAtomicsModules, atomicsModulesClean,
  finishAtomicsModulesReveal, type AtomicsModulesStep,
} from './fixture-moritani-atomics-modules';

export type NexusMoritaniAtomicsOptions = E3IndependentNexusCardOptions;
export const NEXUS_ATOMICS_TERRITORY = 'pasty_mesa';

/** Only unopened original Spice Cards are ordered. In particular, the real
 * six-counter Moritani start is never exposed to a selected worm or sand blow. */
function orderOriginalBlow(game: Game, worm = false): void {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const index = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery &&
      !['pasty_mesa', 'tueks_sietch'].includes(card.territory));
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
function nativeShipment(game: Game, destination: string, sector: number, amount: number): Action {
  const sources = game.homeworlds ? nativeShipmentSources(viewGame(game, 'guild'), amount, 0) : undefined;
  assert.ok(!game.homeworlds || sources);
  return { type: 'ship', territory: destination, sector, amount, elite: 0, allyPayment: 0,
    ...(sources ? { homeworldSources: sources } : {}) };
}

/** Fresh selected E3/independent/Nexus setup, real closing draw and own
 * Moritani Cunning. No dealt hand, spice, army, token location or receipt is
 * assigned. The desert is Moritani's original physical starting territory. */
export function createNexusMoritaniAtomicsFixture(options: NexusMoritaniAtomicsOptions = {}) {
  const source = createE3IndependentNexusCardSetup(options), actions = source.actions;
  let game = structuredClone(source.game);
  const reach = (until: (state: Game) => boolean) => { game = advanceAtomicsModules(game, until, actions); };
  const act = (actor: string, action: Action) => { game = actAtomicsModules(game, actor, action, actions); };
  orderOriginalBlow(game);
  reach(state => state.turn === 2 && state.phase === 1 && atomicsModulesClean(state));
  orderOriginalBlow(game, true);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && atomicsModulesClean(state));
  const beforeAlliance = structuredClone(game);
  act('guild', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'guild' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && atomicsModulesClean(state));
  const deck = game.nexusCards!.cards!.deck, index = deck.indexOf('moritani'); assert.ok(index >= 0);
  deck.unshift(deck.splice(index, 1)[0]);
  const drawBefore = structuredClone(game), drawStep: AtomicsModulesStep = { actor: 'moritani', action: {
    type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  act(drawStep.actor, drawStep.action);
  const drawAfter = structuredClone(game);
  // Basic cannot use the Advanced three-territory flight from the original
  // Tuek's army. Earn a separate adjacent counter with an earlier paid native
  // shipment; the original five remain at Tuek's throughout the Basic scene.
  let movementSupply: { before: Game; step: AtomicsModulesStep; after: Game } | null = null;
  if (!game.advanced) {
    reach(state => state.turn === 2 && state.phase === 5 && state.active === 'guild' && atomicsModulesClean(state));
    const before = structuredClone(game), step: AtomicsModulesStep = {
      actor: 'guild', action: nativeShipment(game, 'south_mesa', 6, 1) };
    act(step.actor, step.action); reach(atomicsModulesClean);
    assert.equal(player(game, 'guild').forces['south_mesa:6'], 1);
    assert.equal(player(game, 'guild').forces['tueks_sietch:5'], 5);
    movementSupply = { before, step, after: structuredClone(game) };
  }
  reach(state => state.turn === 2 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const atomics = game.moritaniTerror!.tokens.find(token => token.kind === 'atomics' && token.status === 'available'); assert.ok(atomics);
  const own = viewGame(game, 'moritani'), offer = own.nexusMoritani; assert.ok(offer);
  const cunning = nexusMoritaniAction(own, offer.event, atomics.id, NEXUS_ATOMICS_TERRITORY); assert.ok(cunning);
  const placementBefore = structuredClone(game), placementStep: AtomicsModulesStep = { actor: 'moritani', action: cunning };
  act(placementStep.actor, placementStep.action);
  const placementPending = structuredClone(game);
  reach(state => state.nexusMoritaniLast?.stage === 'complete' && atomicsModulesClean(state));
  const placementAfter = structuredClone(game), record = game.nexusMoritaniHistory?.find(record =>
    record.receipt.event === game.nexusMoritaniLast!.event && record.stage === 'complete');
  assert.ok(record, 'The completed Cunning pointer must identify its original committed placement');
  assert.equal(record.signature, nexusMoritaniRecordSignature(record));
  validateNexusMoritani(game, record.receipt);
  const receipt = structuredClone(record.receipt);
  reach(state => state.turn === 3 && state.phase === 1 && atomicsModulesClean(state));
  orderOriginalBlow(game);
  reach(state => state.turn === 3 && state.phase === 5 && state.active === 'guild' && atomicsModulesClean(state));
  assert.equal(player(game, 'moritani').forces['pasty_mesa:5'], 6);
  assert.equal(player(game, 'guild').forces['tueks_sietch:5'], 5);
  const sector = territory(NEXUS_ATOMICS_TERRITORY).sectors.find(sector => sector !== game.storm); assert.ok(sector !== undefined);
  const beforeEntry = structuredClone(game), entry: AtomicsModulesStep = {
    actor: 'guild', action: nativeShipment(game, NEXUS_ATOMICS_TERRITORY, sector, 3) };
  act(entry.actor, entry.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniTerror');
  source.staging.push('Keep original armies; use an actual worm and reciprocal Guild/Emperor alliance to draw the unopened Moritani Nexus, then spend it on original Mentat supply Atomics in Pasty Mesa and enter with three paid Guild counters.');
  return { ...source, game, actions, beforeAlliance, atomics: atomics.id, receipt, movementSupply,
    draw: { before: drawBefore, step: drawStep, after: drawAfter },
    placement: { before: placementBefore, step: placementStep, pending: placementPending, after: placementAfter },
    beforeEntry, entry };
}

/** Finite native runtime smoke: activate desert Atomics, retain the unused
 * Guild movement, then reach a later fresh shipment and provide the real
 * forbidden Aftermath request. A separate original paid shipment remains legal. */
export function continueNexusMoritaniAtomics(game: Game, actions: AtomicsModulesStep[] = []) {
  const activation = finishAtomicsModulesReveal(game, actions); game = activation.game;
  const beforeMove = structuredClone(game), sector = territory(NEXUS_ATOMICS_TERRITORY).sectors.find(sector => sector !== game.storm);
  assert.ok(sector !== undefined);
  const from = game.advanced ? 'tueks_sietch:5' : 'south_mesa:6', amount = game.advanced ? 5 : 1;
  assert.equal(player(game, 'guild').forces[from], amount);
  const movement: AtomicsModulesStep = { actor: 'guild', action: { type: 'move', from,
    amount, territory: NEXUS_ATOMICS_TERRITORY, sector } };
  game = actAtomicsModules(game, movement.actor, movement.action, actions);
  game = advanceAtomicsModules(game, atomicsModulesClean, actions);
  const afterMove = structuredClone(game), nextTurn = game.turn + 1;
  game = advanceAtomicsModules(game, state => state.turn === nextTurn && state.phase === 1 && atomicsModulesClean(state), actions);
  orderOriginalBlow(game);
  game = advanceAtomicsModules(game, state => state.turn === nextTurn && state.phase === 5 && state.active === 'guild' && atomicsModulesClean(state), actions);
  assert.equal(player(game, 'guild').shipped, false);
  const forbiddenSector = territory(NEXUS_ATOMICS_TERRITORY).sectors.find(sector => sector !== game.storm); assert.ok(forbiddenSector !== undefined);
  const beforeShipment = structuredClone(game), blockedShipment = nativeShipment(game, NEXUS_ATOMICS_TERRITORY, forbiddenSector, 1);
  const allowedShipment: AtomicsModulesStep = { actor: 'guild', action: nativeShipment(game, 'polar_sink', 0, 1) };
  game = actAtomicsModules(game, allowedShipment.actor, allowedShipment.action, actions);
  game = advanceAtomicsModules(game, atomicsModulesClean, actions);
  return { game, actions, activation, beforeMove, movement, afterMove, beforeShipment, blockedShipment, allowedShipment };
}
