import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { reorderSaphoMovementOrder, saphoMovementOrderEvent, SaphoMovementOrderError,
  type SaphoMovementOrderContext } from '../game/sapho-movement-order';
import { advanceSaphoStartedMovement, createSaphoStartedMovementFixture, saphoStartedMovementClean,
  saphoStartedMovementInventory, saphoStartedMovementPlayer, STARTED_MOVEMENT_SAPHO } from './fixture-sapho-started-movement';

function order(started = false): SaphoMovementOrderContext {
  return { queue: { event: 'movement:3', eligible: ['done', 'active', 'later', 'owner'],
    completed: ['done'], remaining: ['active', 'later', 'owner'], current: 'active',
    currentStarted: started, protectedLast: 'owner' },
    started: started ? ['done', 'active'] : ['done'], guild: null };
}
function reorder(context: SaphoMovementOrderContext, player: string, mode: 'first' | 'last') {
  return reorderSaphoMovementOrder(context, { event: saphoMovementOrderEvent(context), player, mode });
}

void test('a fresh Sapho First relinquishes the same holder’s prior Last protection', () => {
  for (const started of [false, true]) {
    const context = order(started), before = structuredClone(context);
    const quote = reorder(context, 'owner', 'first');
    assert.deepEqual(quote.next.remaining, started ? ['active', 'owner', 'later'] : ['owner', 'active', 'later']);
    assert.equal(quote.next.protectedLast, null);
    assert.deepEqual(quote.next.completed, ['done']);
    assert.equal(quote.afterCurrent, started ? 'active' : null);
    assert.deepEqual(context, before);
  }
});

void test('another seat cannot replace an existing Last, and replay cannot duplicate it', () => {
  const context = order(), before = structuredClone(context), event = saphoMovementOrderEvent(context);
  for (const [player, mode] of [['later', 'first'], ['later', 'last'], ['owner', 'last']] as const)
    assert.throws(() => reorderSaphoMovementOrder(context, { event, player, mode }), SaphoMovementOrderError);
  assert.throws(() => reorderSaphoMovementOrder(context, { event: 'movement:4', player: 'owner', mode: 'first' }), SaphoMovementOrderError);
  assert.deepEqual(context, before);
  const guild = order(); guild.guild = { player: 'active', granted: true, locked: false };
  assert.throws(() => reorder(guild, 'owner', 'first'), SaphoMovementOrderError);
  const suspended = order(); suspended.started = ['done', 'owner'];
  assert.throws(() => saphoMovementOrderEvent(suspended), SaphoMovementOrderError);
});

function movementAction(game: Game, actor: string, mode: 'first' | 'last'): Action {
  const option = viewGame(game, actor).saphoOptions.find(item => item.scope === 'movement' && item.mode === mode);
  assert.ok(option, `Sapho ${mode} must be available to its holder`);
  return { type: 'card', card: STARTED_MOVEMENT_SAPHO, scope: 'movement', event: option.event, mode };
}

void test('paid Box recovers the physical Sapho for First after its own Last in a Basic movement phase', () => {
  const f = createSaphoStartedMovementFixture();
  let game = structuredClone(f.beforeShipment);
  const owner = saphoStartedMovementPlayer(game, f.owner);
  // Supplemental staging exchanges one unopened cache card for an existing held
  // card. Setup, the Sapho purchase and the original movement entry are real.
  const index = game.richeseCache!.findIndex(card => card.effect === 'nullentropyBox');
  assert.ok(index >= 0 && owner.hand.length > 1);
  const [box] = game.richeseCache!.splice(index, 1);
  const exchange = owner.hand.findIndex(card => card.id !== STARTED_MOVEMENT_SAPHO);
  assert.ok(exchange >= 0); game.richeseCache!.push(owner.hand.splice(exchange, 1)[0]); owner.hand.push(box);
  assert.ok(owner.spice >= 2); assert.deepEqual(saphoStartedMovementInventory(game), f.originalInventory);
  const beforeLast = structuredClone(game), last = movementAction(game, f.owner, 'last');
  game = applyAction(game, f.owner, last);
  game = advanceSaphoStartedMovement(game, saphoStartedMovementClean);
  assert.equal(game.saphoMovementLast?.player, f.owner);
  assert.equal(game.movementRemaining!.at(-1), f.owner);
  assert.ok(game.discard.some(card => card.id === STARTED_MOVEMENT_SAPHO));
  assert.equal(saphoStartedMovementPlayer(game, f.owner).spice, owner.spice);
  const savedQueue = [...game.movementRemaining!], cash = saphoStartedMovementPlayer(game, f.owner).spice;
  game = applyAction(game, f.owner, { type: 'card', card: box.id });
  if (game.pendingNullentropy) game = applyAction(game, f.owner, { type: 'decision',
    event: game.pendingNullentropy.event, card: STARTED_MOVEMENT_SAPHO });
  game = advanceSaphoStartedMovement(game, saphoStartedMovementClean);
  assert.equal(saphoStartedMovementPlayer(game, f.owner).spice, cash - 2);
  assert.ok(saphoStartedMovementPlayer(game, f.owner).hand.some(card => card.id === STARTED_MOVEMENT_SAPHO));
  assert.deepEqual(game.movementRemaining, savedQueue);
  const first = movementAction(game, f.owner, 'first');
  game = applyAction(game, f.owner, first);
  game = advanceSaphoStartedMovement(game, saphoStartedMovementClean);
  assert.equal(game.movementRemaining![0], f.owner);
  assert.equal(game.saphoMovementLast, null);
  assert.equal(game.discard.filter(card => card.id === STARTED_MOVEMENT_SAPHO).length, 1);
  assert.deepEqual(game.order, beforeLast.order);
  assert.deepEqual(saphoStartedMovementInventory(game), f.originalInventory);
});
