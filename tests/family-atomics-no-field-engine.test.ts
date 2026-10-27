import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { actFamilyAtomicsNoField as act, createFamilyAtomicsNoFieldFixture as fixture,
  familyAtomicsNoFieldInventory as inventory, familyAtomicsNoFieldPlayer as p,
  familyAtomicsNoFieldReload as reload, finishFamilyAtomicsNoFieldStorm as finishStorm } from './fixture-family-atomics-no-field';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function assertWallCasualties(f: ReturnType<typeof fixture>, game: Game) {
  const before = p(f.game, f.richese), after = p(game, f.richese), amount = Math.min(f.value, before.reserves);
  assert.equal(game.shieldWallDestroyed, true); assert.equal(after.noField!.deployed, null);
  assert.notEqual(after.noFieldEvent, f.event); assert.deepEqual(after.noField!.tokens, f.marker!.tokens);
  assert.equal(after.noField!.lastShipped, f.token);
  assert.equal(after.reserves, before.reserves - amount); assert.equal(after.tanks, before.tanks + amount);
  assert.equal(Object.entries(after.forces).some(([key, n]) => key.startsWith('shield_wall:') && n > 0), false);
  assert.deepEqual(inventory(game), f.original);
}

void test('native concealed zero alone qualifies Advanced Atomics and reveals without inventing Wall casualties', () => {
  const f = fixture({ value: 0 });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.firstDials, f.firstDials.length);
  assert.equal(f.sourceCounts.shipment, f.shipment.steps.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
  assert.ok(f.shipment.steps.some(step => step.actor === f.richese && step.action.type === 'ship' && step.action.noField === f.token));
  assert.equal(p(f.shipment.before, f.richese).spice - p(f.shipment.after, f.richese).spice, 2);
  assert.deepEqual(p(f.game, f.richese).forces, {}); assert.equal(f.game.stormPending, 1);
  const game = act(reload(f.game), f.owner, f.action); assertWallCasualties(f, game);
  assert.equal(p(game, f.richese).tanks, 0);
  assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
  assert.equal(game.discard.some(card => card.id === f.card), false);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  reject(game, f.owner, f.action);
});

void test('original concealed three and five materialize once before all real Wall forces enter Tanks', () => {
  for (const value of [3, 5] as const) {
    const f = fixture({ value }); let game = act(reload(f.game), f.owner, f.action);
    assertWallCasualties(f, game);
    assert.equal(p(game, f.richese).tanks, value);
    assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
    game = finishStorm(game);
    assert.equal(p(game, f.richese).tanks, value); assert.equal(p(game, f.richese).noField!.deployed, null);
    assert.equal(game.removedTreachery?.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(game), f.original);
  }
});

void test('adjacent concealed zero three and five qualify without revealing denomination or changing their event', () => {
  for (const value of [0, 3, 5] as const) {
    const f = fixture({ value, geometry: 'adjacent' }), before = p(f.game, f.richese);
    const game = act(reload(f.game), f.owner, f.action), after = p(game, f.richese);
    assert.equal(game.shieldWallDestroyed, true); assert.deepEqual(after.noField, f.marker);
    assert.equal(after.noFieldEvent, f.event); assert.equal(after.reserves, before.reserves);
    assert.equal(after.tanks, before.tanks); assert.deepEqual(after.forces, {});
    const foreign = viewGame(game, 'atreides').players.find(player => player.id === f.richese)!;
    assert.deepEqual(foreign.noField!.deployed, { controller: f.richese,
      location: { territory: 'imperial_basin', sector: 11 }, effectiveForces: 1 });
    assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
    assert.deepEqual(inventory(game), f.original);
  }
});

void test('a real intervening Storm blocks adjacent concealed zero before any card cost or marker revelation', () => {
  const f = fixture({ value: 0, geometry: 'blocked' });
  assert.deepEqual(f.firstDials.map(step => step.action.amount), [9, 0]); assert.equal(f.game.storm, 10);
  reject(f.game, f.owner, f.action);
  assert.equal(f.game.shieldWallDestroyed, false); assert.deepEqual(p(f.game, f.richese).noField, f.marker);
  assert.equal(p(f.game, f.richese).noFieldEvent, f.event); assert.equal(p(f.game, f.richese).tanks, 0);
  assert.ok(p(f.game, f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(f.game), f.original);
});

void test('Basic marker-only Atomics retains early Storm timing and ordinary physical discard for all printed values', () => {
  for (const value of [0, 3, 5] as const) {
    const f = fixture({ advanced: false, value }); assert.equal(f.game.stormPending, null);
    assert.equal(f.game.semutaPreview, true, 'Retain the actual public Basic Richese normalization marker');
    const game = act(reload(f.game), f.owner, f.action); assertWallCasualties(f, game);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(game.removedTreachery ?? [], []);
  }
});

void test('an actual classic adjacent qualifier detonates another owner concealed Wall marker through native revelation', () => {
  const f = fixture({ value: 5, foreignOwner: true }); assert.ok(f.physicalShipment);
  assert.equal(f.owner, 'emperor'); assert.equal(p(f.game, f.owner).forces['imperial_basin:9'], 1);
  assert.equal(p(f.physicalShipment.before, f.owner).spice - p(f.physicalShipment.after, f.owner).spice, 2);
  const game = act(reload(f.game), f.owner, f.action); assertWallCasualties(f, game);
  assert.equal(p(game, f.owner).forces['imperial_basin:9'], 1); assert.equal(p(game, f.owner).tanks, 0);
  assert.equal(p(game, f.richese).tanks, 5);
  assert.deepEqual(game.removedTreachery?.map(card => card.id), [f.card]);
  assert.equal(game.discard.some(card => card.id === f.card), false);
});

void test('all four minimal profiles confirm and complete actual Storm while an adjacent zero remains concealed', () => {
  const f = fixture({ value: 0, geometry: 'adjacent' });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const choice = botActions(view).find(action => action.type === 'ready'); assert.ok(choice);
    let game = act(reload(f.game), f.owner, choice); game = finishStorm(game);
    assert.equal(game.phase, 1); assert.equal(game.shieldWallDestroyed, false);
    assert.deepEqual(p(game, f.richese).noField, f.marker); assert.equal(p(game, f.richese).noFieldEvent, f.event);
    assert.ok(p(game, f.owner).hand.some(card => card.id === f.card)); assert.deepEqual(inventory(game), f.original);
  }
});
