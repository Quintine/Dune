import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { actFamilyAtomics as act, createFamilyAtomicsFixture as fixture,
  familyAtomicsInventory as inventory, familyAtomicsPlayer as p, familyAtomicsReload as reload,
  finishFamilyAtomicsStorm as finishStorm, type FamilyAtomicsStep } from './fixture-family-atomics';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

void test('genuine Advanced Atomics source earns its Wall army and original automatically revealed second Storm', () => {
  const f = fixture();
  assert.equal(f.sourceCounts.setup, f.setupActions.length);
  assert.equal(f.sourceCounts.firstDials, f.firstDials.length);
  assert.equal(f.sourceCounts.shipment, f.shipment.steps.length);
  assert.equal(f.sourceCounts.beforeSecondStorm, f.beforeSecondStormActions.length);
  assert.equal(f.sourceCounts.secondStormOpening, f.secondStormOpening.length);
  assert.equal(f.sourceCounts.source, f.actions.length);
  assert.ok(f.shipment.steps.some(step => step.actor === f.owner && step.action.type === 'ship'));
  assert.equal(p(f.shipment.before, f.owner).spice - p(f.shipment.after, f.owner).spice, 4);
  assert.equal(p(f.game, f.owner).forces['shield_wall:9'], 2);
  assert.equal(f.firstBeforeDistance.turn, 1); assert.equal(f.firstBeforeDistance.stormPending, null);
  assert.equal(f.firstAfterDistance.stormPending, 0);
  reject(reload(f.firstBeforeDistance), f.owner, f.action);
  reject(reload(f.firstAfterDistance), f.owner, f.action);
  assert.equal(f.beforeSecondStorm.phase, 8);
  reject(reload(f.beforeSecondStorm), f.owner, f.action);
  assert.equal(f.secondStormOpening.length, 1);
  assert.equal(f.secondStormOpening[0].action.type, 'ready');
  assert.equal(f.game.turn, 2); assert.equal(f.game.stormPending, 1); assert.equal(f.game.storm, 1);
  assert.deepEqual(inventory(f.game), f.original);
});

void test('Advanced Atomics destroys actual Wall counters and removes its physical card once without a discard', () => {
  const f = fixture(); let game = reload(f.game);
  game = act(game, f.owner, { type: 'ready' }); assert.ok(game.ready.includes(f.owner));
  const spice = p(game, f.owner).spice;
  game = act(game, f.owner, f.action);
  assert.equal(game.shieldWallDestroyed, true); assert.deepEqual(game.ready, []);
  assert.equal(p(game, f.owner).forces['shield_wall:9'] ?? 0, 0);
  assert.equal(p(game, f.owner).tanks, 2); assert.equal(p(game, f.owner).spice, spice);
  assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
  assert.equal(p(game, f.owner).hand.some(card => card.id === f.card), false);
  assert.equal(game.discard.some(card => card.id === f.card), false);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  for (const player of game.players)
    assert.deepEqual(viewGame(game, player.id).removedTreachery.map(card => card.id), [f.card]);
  reject(game, f.owner, f.action);
  assert.deepEqual(inventory(game), f.original);
  game = finishStorm(game);
  assert.equal(game.phase, 1); assert.equal(game.removedTreachery?.filter(card => card.id === f.card).length, 1);
  assert.equal(p(game, f.owner).tanks, 2); assert.equal(game.discard.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.original);
});

void test('Advanced Atomics accepts genuine adjacent fighters with a clear path and preserves them off the Wall', () => {
  const f = fixture({ geometry: 'adjacent' });
  const game = act(reload(f.game), f.owner, f.action);
  assert.equal(game.storm, 1); assert.equal(game.shieldWallDestroyed, true);
  assert.equal(p(game, f.owner).forces['imperial_basin:11'], 2); assert.equal(p(game, f.owner).tanks, 0);
  assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
  assert.equal(game.discard.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.original);
});

void test('actual first dials can earn a Storm strictly between adjacent fighters and the touching Wall sector', () => {
  const f = fixture({ geometry: 'blocked' });
  assert.deepEqual(f.firstDials.map(step => step.action.type === 'stormDial' ? step.action.amount : null), [9, 0]);
  assert.equal(f.game.storm, 10); assert.equal(p(f.game, f.owner).forces['imperial_basin:11'], 2);
  reject(f.game, f.owner, f.action);
  assert.equal(f.game.shieldWallDestroyed, false); assert.equal(p(f.game, f.owner).tanks, 0);
  assert.ok(p(f.game, f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(f.game.removedTreachery ?? [], []); assert.deepEqual(inventory(f.game), f.original);
});

void test('Basic retains its real pre-distance Storm window and ordinary Atomics discard', () => {
  const f = fixture({ advanced: false, window: 'beforeDistance' });
  assert.equal(f.game.stormPending, null);
  const game = act(reload(f.game), f.owner, f.action);
  assert.equal(game.shieldWallDestroyed, true); assert.equal(p(game, f.owner).tanks, 2);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(p(game, f.owner).hand.some(card => card.id === f.card), false);
  assert.deepEqual(game.removedTreachery ?? [], []);
  assert.deepEqual(viewGame(game, f.owner).removedTreachery, []);
  assert.deepEqual(inventory(game), f.original);
});

void test('an actual Weather Control zero is a valid calculated Advanced distance before Atomics', () => {
  const f = fixture(); let game = act(reload(f.game), f.observer, { type: 'card', card: f.weather, amount: 0 });
  assert.equal(game.stormPending, 0); assert.equal(game.discard.filter(card => card.id === f.weather).length, 1);
  game = act(game, f.owner, f.action);
  assert.equal(game.shieldWallDestroyed, true); assert.equal(p(game, f.owner).tanks, 2);
  assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
  assert.equal(game.discard.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal Storm policies propose legal native confirmation without strategic Atomics requirements', () => {
  const f = fixture();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = reload(f.game); const actions: FamilyAtomicsStep[] = [];
    const view = viewGame(game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'ready');
    assert.ok(action, `${difficulty} supplies the actual native Storm confirmation`);
    game = act(game, f.owner, action, actions);
    assert.ok(game.ready.includes(f.owner)); assert.equal(actions.length, 1);
    assert.ok(p(game, f.owner).hand.some(card => card.id === f.card));
    assert.deepEqual(game.removedTreachery ?? [], []);
    assert.deepEqual(inventory(game), f.original);
  }
});
