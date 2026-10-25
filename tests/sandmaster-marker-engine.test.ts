import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import { splitLocation } from '../game/board';
import { sandmasterActionOrder, sandmasterOrderSources, quoteSandmasterMovement, validateSandmasterMovement } from '../game/sandmaster-movement';
import { createSandmasterMarkerFixture } from './fixture-sandmaster-marker';

for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) for (const physical of [false, true]) {
  void test(`controlled ${advanced ? 'Advanced' : 'Basic'} Sandmaster marker${value} ${physical ? 'with physical companions' : 'alone'} collects without materialization`, () => {
    const f = createSandmasterMarkerFixture(value, physical, advanced), before = structuredClone(f.game);
    const order = sandmasterActionOrder(viewGame(f.game, f.actor), f.actor, f.action); assert.ok(order);
    assert.deepEqual(sandmasterOrderSources(order), [f.source]);
    assert.equal(order.group.length, physical ? 1 : 0); assert.equal(order.noField!.tokenId, f.token.id);
    const next = applyAction(f.game, f.actor, f.action), owner = next.players.find(p => p.id === f.actor)!;
    assert.deepEqual(f.game, before);
    assert.equal(owner.reserves, 16); assert.equal(owner.tanks, 0); assert.equal(owner.moved, 1);
    assert.equal(owner.forces[f.source] ?? 0, physical ? 0 : 3);
    assert.equal(owner.forces[f.target] ?? 0, physical ? 3 : 0);
    assert.equal(presenceAt(owner, splitLocation(f.target).territory), physical ? 4 : 1);
    assert.deepEqual(owner.noField!.tokens, f.originalNoField.tokens);
    assert.equal(owner.noField!.lastShipped, f.originalNoField.lastShipped);
    assert.deepEqual(owner.noField!.deployed!.location, splitLocation(f.target));
    assert.notEqual(owner.noFieldEvent, f.originalEvent); assert.equal(owner.spice, f.originalWallet + 2);
    for (const pile of f.choice.collect) assert.equal(next.spice[pile], f.originalSpice[pile] - 1);
    const unchanged = structuredClone(next);
    assert.throws(() => applyAction(next, f.actor, f.action)); assert.deepEqual(next, unchanged);
  });
}

void test('marker route receipts bind current source and event while stale and foreign declarations reject immutably', () => {
  const f = createSandmasterMarkerFixture(), view = viewGame(f.game, f.actor);
  const order = sandmasterActionOrder(view, f.actor, f.action); assert.ok(order);
  const receipt = quoteSandmasterMovement(f.game, f.actor, order, f.choice);
  assert.doesNotThrow(() => validateSandmasterMovement(f.game, f.actor, order, receipt));
  assert.throws(() => validateSandmasterMovement(f.game, f.actor,
    { ...order, noField: { ...order.noField!, event: 'changed-event' } }, receipt));
  const before = structuredClone(f.game);
  for (const [actor, action] of [[f.actor, { ...f.action, event: 'stale-event' }],
    [f.actor, { ...f.action, noField: 'unowned-marker' }], ['h', f.action]] as [string, Action][]) {
    assert.throws(() => applyAction(f.game, actor, action)); assert.deepEqual(f.game, before);
  }
});
