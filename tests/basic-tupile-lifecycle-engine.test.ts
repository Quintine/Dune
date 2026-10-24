import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handLimit, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  BASIC_TUPILE_WORLD, actBasicTupile, completeBasicTupileLifecycle, createBasicTupileLifecycleFixture,
  departBasicTupile, basicTupilePlayer as player, type BasicTupileLifecycleFixture,
} from './fixture-basic-tupile-lifecycle';

function source(f: BasicTupileLifecycleFixture) {
  assert.equal(f.game.advanced, false);
  assert.deepEqual(f.game.expansions, ['choam']);
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'homeworlds' && step.action.enabled === true));
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'start'));
  assert.equal(f.game.homeworldOccupationPreview, true);
  assert.equal(f.game.homeworldTupilePreview, true);
  assert.equal(player(f.afterSetup).hand.length, 1);
  assert.equal(f.purchases.filter(purchase => purchase.before.turn === 1).length, 3);
  assert.equal(player(f.filledFour).hand.length, 4);
  assert.equal(player(f.beforeFirstAuction).spice - player(f.filledFour).spice, 3);
  assert.equal(player(f.beforeIncome, f.incomePayer).spice - player(f.afterIncome, f.incomePayer).spice, 2);
  assert.equal(player(f.afterIncome).spice - player(f.beforeIncome).spice, 2);
  assert.equal(f.invasionQuote.cost, 1);
  assert.equal(player(f.beforeInvasion).spice - player(f.afterInvasion).spice, 1);
  assert.equal(player(f.beforeInvasion).reserves - player(f.afterInvasion).reserves, 2);
  assert.deepEqual(f.afterInvasion.homeworlds!.custody!.visitors[BASIC_TUPILE_WORLD].guild, { normal: 2, elite: 0 });
  assert.equal(player(f.occupied, f.native).reserves, 0);
  assert.equal(player(f.occupied, f.native).tanks, 20);
  assert.equal(player(f.occupied).tanks, 1);
  assert.deepEqual(f.occupied.homeworlds!.custody!.visitors[BASIC_TUPILE_WORLD].guild, { normal: 1, elite: 0 });
  assert.equal(player(f.occupied).tupileHandSlot, true);
  assert.equal(handLimit(player(f.occupied)), 5);
  assert.equal(f.occupied.homeworldTupileState!.leases.length, 1);
  assert.equal(f.game.homeworldTupileState!.leases.length, 1);
  assert.equal(f.game.homeworldTupileState!.current, 0);
  assert.equal(f.occupied.homeworldTupileState!.leases[0].source.qualification,
    f.game.homeworldTupileState!.leases[0].source.qualification);
  assert.equal(viewGame(f.game, f.occupier).homeworldTupileBlocked, null);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function departed(f: BasicTupileLifecycleFixture, result: ReturnType<typeof completeBasicTupileLifecycle>) {
  assert.equal(result.departure.quote.cost, 1);
  assert.equal(player(result.game).spice, player(f.game).spice - 1);
  assert.equal(player(result.game).reserves, player(f.game).reserves + 1);
  assert.equal(result.game.homeworlds!.custody!.visitors[BASIC_TUPILE_WORLD], undefined);
  assert.equal(player(result.game).tanks, player(f.game).tanks);
  assert.equal(player(result.game).tupileHandSlot, undefined);
  assert.equal(handLimit(player(result.game)), 4);
  assert.equal(result.game.homeworldTupileState!.current, null);
  assert.equal(result.game.homeworldTupileState!.cleanups.length, 1);
  assert.equal(result.game.homeworldTupileState!.cleanups[0].status, 'completed');
  assert.deepEqual(result.game.homeworldTupileState!.leases[0].lost, [f.occupier]);
  assert.equal(result.game.active, f.occupier);
  assert.equal(result.game.phase, 5);
  assert.equal(player(result.game).shipped, true);
  assert.equal(player(result.game).moved, 0);
  assert.ok(result.game.movementRemaining!.includes(f.occupier));
  assert.equal(viewGame(result.game, f.occupier).homeworldTupileBlocked, null);
  assert.equal(result.actions.filter(step => step.action.type === 'homeworldShip').length, 1);
  assert.throws(() => actBasicTupile(result.game, f.occupier, result.departure.step.action));
}

void test('genuine Basic Tupile battle grants one continuous slot and actual paid last departure loses it without a source block', () => {
  const f = createBasicTupileLifecycleFixture({ fifthCard: false }); source(f);
  const result = completeBasicTupileLifecycle(f); departed(f, result);
  assert.equal(result.cleanups.length, 0, 'The original four-card hand needs no extra discard prompt');
  assert.equal(player(result.game).hand.length, 4);
  assert.deepEqual(player(result.game).hand, player(f.game).hand);
});

void test('genuine fifth paid auction card uses the Basic Tupile slot and one actual departure cleanup discards exactly its excess', () => {
  const f = createBasicTupileLifecycleFixture(); source(f);
  assert.ok(f.beforeFifth && f.acquiredFifth);
  assert.equal(player(f.beforeFifth).hand.length, 4);
  assert.equal(handLimit(player(f.beforeFifth)), 5);
  assert.equal(player(f.acquiredFifth).hand.length, 5);
  assert.equal(player(f.beforeFifth).spice - player(f.acquiredFifth).spice, 1);
  assert.equal(f.purchases.filter(purchase => purchase.before.turn === 2).length, 1);
  const fifth = f.purchases.find(purchase => purchase.before.turn === 2)!;
  assert.ok(player(f.game).hand.some(card => card.id === fifth.card));
  const result = completeBasicTupileLifecycle(f); departed(f, result);
  assert.equal(result.cleanups.length, 1);
  const cleanup = result.cleanups[0], offer = viewGame(cleanup.before, f.occupier).homeworldTupileCleanup!;
  assert.equal(offer.excess, 1); assert.equal(offer.limit, 4); assert.equal(offer.blocked, null);
  const cards = cleanup.step.action.cards as string[];
  assert.equal(cards.length, 1);
  assert.ok(player(f.game).hand.some(card => card.id === cards[0]));
  assert.equal(result.game.discard.filter(card => card.id === cards[0]).length,
    f.game.discard.filter(card => card.id === cards[0]).length + 1);
  assert.equal(player(result.game).hand.length, 4);
  assert.throws(() => actBasicTupile(result.game, f.occupier, cleanup.step.action));
});

void test('all four minimal profiles resolve the genuine Basic excess using an actually held card and retain original unused movement', () => {
  const f = createBasicTupileLifecycleFixture(), departure = departBasicTupile(f);
  assert.equal(departure.game.decision?.kind, 'homeworldTupileCleanup');
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(departure.game, f.occupier);
    view.players.find(player => player.id === f.occupier)!.bot = difficulty;
    const offer = view.homeworldTupileCleanup!;
    const action = botActions(view).find(action => action.type === 'decision' && action.event === offer.event); assert.ok(action);
    assert.equal((action.cards as string[]).length, 1);
    assert.ok(offer.eligibleCards.includes((action.cards as string[])[0]));
    const game = actBasicTupile(structuredClone(departure.game), f.occupier, action);
    assert.equal(player(game).hand.length, 4);
    assert.equal(player(game).moved, 0);
    assert.equal(player(game).shipped, true);
    assert.equal(game.active, f.occupier);
    assert.equal(viewGame(game, f.occupier).homeworldTupileBlocked, null);
    assert.equal(game.homeworldTupileState!.cleanups[0].status, 'completed');
    assert.doesNotThrow(() => actBasicTupile(game, f.occupier, { type: 'endMovement' }));
  }
});
