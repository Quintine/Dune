import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { quoteGrummanCollection, quoteGrummanCollectionAction } from '../game/grumman-collection';
import { grummanCollectionSignature, validateGrummanCollection } from '../game/grumman-collection-return';
import { placeTerror, projectTerror, revealTerror, TERROR_KINDS } from '../game/moritani-terror';
import { nextNativeE3HomeworldStep } from './fixture-homeworld-native-e3-modules';
import { assertRuledGrummanInventory, createRuledGrummanFixture } from './fixture-ruled-grumman';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('native Grumman removal returns the unrevealed face to rotated supply, credits four spice once and preserves Mentat use', () => {
  for (const advanced of [false, true]) {
    const f = createRuledGrummanFixture({ advanced });
    const original = structuredClone(f.game);
    const prior = f.game.moritaniTerror!;
    const face = prior.tokens.find(t => t.id === f.placed)!.kind;
    const owner = f.game.players.find(p => p.id === f.owner)!;
    const request: Action = { type: 'decision', event: f.game.grummanCollection!.event, mode: 'remove', token: f.placed };
    reject(f.game, 'guild', request);
    for (const token of [prior.tokens.find(t => t.status === 'available')!.id, 'missing'])
      reject(f.game, f.owner, { ...request, token });
    let game = applyAction(f.game, f.owner, request);
    assert.deepEqual(f.game, original);
    assert.equal(game.players.find(p => p.id === f.owner)!.spice, owner.spice + 4);
    assert.equal(game.grummanCollection!.stage, 'complete');
    assert.equal(game.grummanCollection!.outcome, 'remove');
    assert.equal(game.grummanCollection!.token, f.placed);
    assert.equal(game.grummanCollection!.territory, f.placedTerritory);
    assert.equal(game.moritaniTerror!.placementTurn, prior.placementTurn);
    assert.equal(game.moritaniTerror!.supplyEpoch, (prior.supplyEpoch ?? 0) + 1);
    assert.deepEqual(game.moritaniTerror!.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
    assert.ok(game.moritaniTerror!.tokens.every(t => t.status === 'available' && t.location === null));
    assert.ok(game.moritaniTerror!.tokens.every(t => !prior.tokens.some(old => old.id === t.id)));
    assert.deepEqual(projectTerror(game.moritaniTerror!, false).tokens, []);
    assertRuledGrummanInventory(game);
    validateGrummanCollection(game);
    reject(game, f.owner, request);
    reject(game, f.owner, { ...request, mode: 'add', token: game.moritaniTerror!.tokens[0].id, territory: f.placedTerritory });
    for (let count = 0; game.decision?.kind !== 'moritaniPlacement' && count < 100; count++) {
      const step = nextNativeE3HomeworldStep(game); assert.ok(step);
      game = applyAction(game, step.actor, step.action);
    }
    assert.equal(game.decision?.kind, 'moritaniPlacement');
    const returned = game.moritaniTerror!.tokens.find(t => t.kind === face)!;
    assert.notEqual(returned.id, f.placed);
    game = applyAction(game, f.owner, { type: 'decision', token: returned.id, territory: 'carthag' });
    for (let count = 0; game.response && count < 20; count++) {
      const step = nextNativeE3HomeworldStep(game); assert.ok(step);
      game = applyAction(game, step.actor, step.action);
    }
    assert.equal(game.moritaniTerror!.placementTurn, 2);
    const redeployed = projectTerror(game.moritaniTerror!, false).tokens.find(t => t.id === returned.id)!;
    assert.deepEqual(redeployed, { id: returned.id, location: 'carthag', status: 'placed' });
    assertRuledGrummanInventory(game);
    assert.ok(!JSON.stringify(viewGame(game, 'guild').moritaniTerror).includes(f.placed));
  }
});

void test('return quote remains available without ADD supply and preserves other placements and spent faces', () => {
  const f = createRuledGrummanFixture();
  const game = structuredClone(f.game);
  // Pure custody input: all faces are physically placed, so no addition exists.
  game.moritaniTerror = placeTerror(game.moritaniTerror!, game.moritaniTerror!.tokens.find(t => t.kind === 'sabotage')!.id, 'carthag', 2);
  for (const token of game.moritaniTerror.tokens)
    if (token.status === 'available') { token.status = 'placed'; token.location = 'carthag'; }
  const quote = quoteGrummanCollection(game, f.owner);
  assert.ok(quote.blocked);
  assert.equal(quote.removeBlocked, null);
  assert.equal(quote.removable.length, 6);
  quote.removable[0].location = 'not-a-location';
  assert.notEqual(game.moritaniTerror.tokens[0].location, 'not-a-location');
  const before = structuredClone(game);
  const result = quoteGrummanCollectionAction(game, f.owner, { mode: 'remove', token: f.placed }, () => 0);
  assert.equal(result.amount, 4);
  assert.equal(result.state.placementTurn, 2);
  assert.deepEqual(result.state.tokens.filter(t => t.status === 'placed'), before.moritaniTerror!.tokens.filter(t => t.id !== f.placed));
  assert.equal(result.state.tokens.filter(t => t.status === 'available').length, 1);
  assert.deepEqual(game, before);
  for (const kind of ['robbery', 'extortion'] as const) {
    const source = structuredClone(f.game);
    const selected = source.moritaniTerror!.tokens.find(t => t.kind === kind)!;
    if (selected.status === 'available') source.moritaniTerror = placeTerror(source.moritaniTerror!, selected.id, 'carthag', 2);
    source.moritaniTerror = revealTerror(source.moritaniTerror!, selected.id);
    const invalid = structuredClone(source);
    assert.throws(() => quoteGrummanCollectionAction(source, f.owner, { mode: 'remove', token: selected.id }, () => 0));
    assert.deepEqual(source, invalid);
    if (kind === 'extortion') {
      const returned = quoteGrummanCollectionAction(source, f.owner, { mode: 'remove', token: f.placed }, () => 0);
      assert.deepEqual(returned.state.tokens.find(t => t.id === selected.id), source.moritaniTerror.tokens.find(t => t.id === selected.id));
    }
  }
});

void test('stale rotated IDs, inactive Grumman, low native population and foreign owners cannot quote a return', () => {
  const f = createRuledGrummanFixture();
  const action = { mode: 'remove', token: f.placed } as const;
  const result = quoteGrummanCollectionAction(f.game, f.owner, action, () => 0);
  const returned = { ...f.game, moritaniTerror: result.state };
  assert.throws(() => quoteGrummanCollectionAction(returned, f.owner, action, () => 0));
  for (const context of [
    { ...f.game, homeworlds: undefined },
    { ...f.game, players: f.game.players.map(p => p.id === f.owner ? { ...p, reserves: 7 } : p) },
  ]) {
    const before = structuredClone(context);
    assert.ok(quoteGrummanCollection(context, f.owner).removeBlocked);
    assert.deepEqual(quoteGrummanCollection(context, f.owner).removable, []);
    assert.throws(() => quoteGrummanCollectionAction(context, f.owner, action, () => 0));
    assert.deepEqual(context, before);
  }
  assert.throws(() => quoteGrummanCollectionAction(f.game, 'guild', action, () => 0));
  assert.throws(() => quoteGrummanCollectionAction(f.game, f.owner, { ...action, token: 'missing' }, () => 0));
});

void test('native removal historical frame binds its original ID and territory without requiring a live token', () => {
  const f = createRuledGrummanFixture();
  const game = applyAction(f.game, f.owner, { type: 'decision', event: f.game.grummanCollection!.event, mode: 'remove', token: f.placed });
  assert.ok(!game.moritaniTerror!.tokens.some(t => t.id === f.placed));
  validateGrummanCollection(game);
  for (const changes of [
    { territory: 'homeworld:moritani' }, { territory: 'mobile_stronghold' }, { token: undefined },
    { nexusEvent: 'unearned' }, { outcome: 'decline' as const },
  ]) {
    const bad = structuredClone(game);
    Object.assign(bad.grummanCollection!, changes);
    bad.grummanCollection!.signature = grummanCollectionSignature(bad.grummanCollection!);
    assert.throws(() => validateGrummanCollection(bad));
  }
});
