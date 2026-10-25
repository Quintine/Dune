import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actSaphoRevivalOrder as act, advanceSaphoRevivalOrder as advance,
  createSaphoRevivalOrderFixture as fixture, createSaphoRevivalSemutaFixture,
  finishSaphoRevivalOrder as finish, reactSaphoRevivalSemuta,
  saphoRevivalOrderAction as action, saphoRevivalOrderClean as clean,
  saphoRevivalOrderInventory as inventory, saphoRevivalOrderPlayer as player,
  saphoRevivalOrderStocks as stocks,
} from './fixture-sapho-revival-order';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed));
  assert.deepEqual(game, before);
}
function expected(game: Game, owner: string, mode: 'first' | 'last') {
  const frame = game.revivalOrder; assert.ok(frame);
  const locked = frame.started ? [frame.remaining[0]] : [];
  const other = frame.remaining.filter(id => id !== owner && !locked.includes(id));
  return [...locked, ...(mode === 'first' ? [owner, ...other] : [...other, owner])];
}
function assertNativeSource(f: ReturnType<typeof fixture>) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.ok(f.beforeStartingDeal.players.every(seat => !seat.hand.length));
  assert.equal(f.acquisition.bid.actor, f.owner); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.owner).spice - player(f.acquisition.after, f.owner).spice, 1);
  assert.equal(player(f.acquisition.after, 'richese').spice - player(f.acquisition.before, 'richese').spice, 1);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.ok(f.sourceActionCount > 20);
  const dials = f.sourceActions.filter(step => step.action.type === 'stormDial');
  assert.equal(dials.length, 2);
  assert.ok(dials.every(step => typeof step.action.amount === 'number' && step.action.amount >= 0 && step.action.amount <= 20));
  assert.equal(f.firstRevival.storm, ((f.richeseCircle - 3 + 18) % 18) + 1);
  assert.deepEqual(f.staging, []); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.game.active, f.current); assert.equal(f.game.revivalOrder?.started, f.started);
  if (f.started) {
    assert.ok(f.shipment && f.storm && f.revival && f.casualtyLocation);
    assert.equal(player(f.shipment.after, f.current).forces[f.casualtyLocation], 1);
    assert.equal(f.storm.before.stormMovementSource?.kind, 'card');
    assert.equal(player(f.storm.after, f.current).tanks, 1);
    assert.equal(player(f.game, f.current).tanks, 0); assert.equal(player(f.game, f.current).revived, 1);
  }
}

for (const started of [false, true]) for (const mode of ['first', 'last'] as const) {
  void test(`native Sapho Revival ${mode} ${started ? 'queues behind an actual returned-force owner' : 'reorders clean unstarted turns'} and completes once`, () => {
    const f = fixture({ started }); assertNativeSource(f);
    const proposed = action(f.game, mode), option = viewGame(f.game, f.owner).saphoOptions.find(o =>
      o.scope === 'revival' && o.mode === mode); assert.ok(option);
    assert.deepEqual(Object.keys(proposed).sort(), ['card', 'event', 'mode', 'scope', 'type']);
    assert.equal('afterCurrent' in proposed, false);
    if (started) assert.equal((option as typeof option & { afterCurrent?: string }).afterCurrent, f.current);
    const before = stocks(f.game), physicalOrder = [...f.game.order];
    const wanted = expected(f.game, f.owner, mode);
    let game = act(f.game, f.owner, proposed);
    assert.equal(game.revivalOrder?.version, 2);
    assert.deepEqual(game.revivalOrder?.original, physicalOrder);
    assert.deepEqual(game.revivalOrder?.remaining, wanted);
    assert.deepEqual(game.revivalOrder?.completed, []);
    assert.equal(game.revivalOrder?.started, started);
    assert.equal(game.active, wanted[0]); assert.deepEqual(game.order, physicalOrder);
    assert.deepEqual(stocks(game), before);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), false);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(game), f.originalInventory);
    reject(game, f.owner, proposed);
    const completions: string[] = [];
    game = reload(game);
    while (game.phase === 4 && game.revivalOrder?.remaining.length) {
      assert.ok(clean(game)); const actor = game.revivalOrder.remaining[0]; completions.push(actor);
      game = act(game, actor, { type: 'ready' });
    }
    game = finish(game);
    assert.deepEqual(completions, wanted); assert.equal(new Set(completions).size, wanted.length);
    assert.equal(game.phase, 5); assert.deepEqual(game.order, physicalOrder);
    assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(stocks(game), before);
  });
}

void test('native completed holder keeps its physical Sapho without reopening its finished Revival', () => {
  const f = fixture(), old = action(f.game, 'last');
  let game = advance(f.game, state => clean(state) && state.revivalOrder?.remaining[0] === f.owner);
  game = act(game, f.owner, { type: 'ready' });
  assert.ok(game.revivalOrder?.completed.includes(f.owner));
  assert.ok(player(game, f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(viewGame(game, f.owner).saphoOptions.filter(option => option.scope === 'revival'), []);
  reject(game, f.owner, old);
  game = finish(game); assert.equal(game.phase, 5);
});

void test('native Sapho Revival rejects forged display metadata and a changed event before disposal', () => {
  const f = fixture({ started: true }), proposed = action(f.game, 'first');
  reject(f.game, f.owner, { ...proposed, afterCurrent: f.current });
  reject(f.game, f.owner, { ...proposed, event: 'stale-revival-event' });
  reject(f.game, 'atreides', proposed);
  assert.equal(f.game.discard.filter(card => card.id === f.card).length, 0);
  assert.equal(player(f.game, f.current).revived, 1);
});

void test('all four minimal profiles propose an accepted native queued Revival order change', () => {
  const f = fixture({ started: true });
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(f.game, f.owner); view.players.find(seat => seat.id === f.owner)!.bot = level;
    const proposed = botActions(view).find(candidate => candidate.type === 'card' && candidate.scope === 'revival');
    assert.ok(proposed, `${level} offers the physical owned card's legal Revival path`);
    const game = act(f.game, f.owner, proposed);
    assert.equal(game.active, f.current); assert.equal(game.revivalOrder?.started, true);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  }
});

void test('controlled conserved-card supplement refuses to split the genuine started owner opportunity', () => {
  const f = fixture({ started: true }), game = structuredClone(f.game);
  // This supplement conserves the actual paid card but does not claim a native
  // transfer to Richese. Its force return and started opportunity remain native.
  const donor = player(game, f.owner), index = donor.hand.findIndex(card => card.id === f.card); assert.ok(index >= 0);
  player(game, f.current).hand.push(donor.hand.splice(index, 1)[0]);
  assert.equal(game.revivalOrder?.started, true);
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.deepEqual(viewGame(game, f.current).saphoOptions.filter(option => option.scope === 'revival'), []);
  const borrowed = action(f.game, 'last');
  reject(game, f.current, borrowed);
});

for (const claim of [false, true]) {
  void test(`controlled Semuta acquisition supplement ${claim ? 'claims the actual Sapho discard' : 'passes the actual Sapho discard'} and restores the same Revival scope`, () => {
    const f = createSaphoRevivalSemutaFixture();
    assert.equal(f.nativeAcquisition, false); assert.ok(f.staging.length > 0);
    const before = stocks(f.game), original = [...f.game.order];
    const paused = act(f.game, f.owner, f.action);
    assert.equal(paused.pendingTreacheryDiscard?.continuation?.kind, 'saphoRevivalDiscard');
    assert.ok(paused.pendingTreacheryDiscard?.reaction);
    const queue = structuredClone(paused.revivalOrder), requests = structuredClone(paused.revivalRequests);
    for (const seat of paused.players)
      assert.deepEqual(viewGame(paused, seat.id).saphoOptions.filter(option => option.scope === 'revival'), [],
        'The live discard reaction supplies no competing Revival reorder');
    let game = reactSaphoRevivalSemuta(reload(paused), f.holder, claim);
    game = advance(game, clean);
    assert.deepEqual(game.revivalOrder, queue); assert.deepEqual(game.revivalRequests, requests);
    assert.equal(game.active, queue?.remaining[0]); assert.deepEqual(game.order, original);
    assert.deepEqual(stocks(game), before); assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), false);
    if (claim) {
      assert.ok(player(game, f.holder).hand.some(card => card.id === f.card));
      assert.equal(player(game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
      assert.equal(game.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    } else assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    game = finish(game);
    assert.equal(game.phase, 5); assert.deepEqual(inventory(game), f.originalInventory);
  });
}
