import assert from 'node:assert/strict';
import test from 'node:test';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthMixedBattle as act, bindTruthMixedBattle as bind,
  createTruthMixedBattleFixture as fixture, finishTruthMixedBattle as finish,
  revealTruthMixedBattle as reveal, truthMixedBattleAction as action,
  truthMixedBattleFact as fact, truthMixedBattleGroup as group,
  truthMixedBattleInventory as inventory, truthMixedBattlePlayer as player,
  truthMixedBattlePromise as promise,
} from './fixture-truth-mixed-battle';

void test('native mixed battle snapshots original spice before an actual bribe debit and still requires its promised projectile', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), action(f.weaponClaim));
  const originalSpice = player(f.game, f.target).spice, originalBribes = player(f.game, f.asker).bribes;
  const defeated = player(f.game, f.asker).leaders.find(leader => leader.id === f.ownPlan.leader);
  assert.ok(defeated); assert.equal(defeated.strength, 1);
  assert.ok(originalSpice >= 3); assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  let game = bind(f, 'yes', mixed).game; assert.equal(promise(game).fulfilled, false);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, originalSpice - 3); assert.equal(player(game, f.asker).bribes, originalBribes + 3);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, false);
  const before = structuredClone(game); assert.throws(() => act(game, f.target, f.targetPlan)); assert.deepEqual(game, before);
  game = reveal(game, f).game; assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.deepEqual(promise(game).mixed, mixed); assert.equal(game.battle!.plans[f.target].weapon, f.ordinary);
  game = finish(game, f); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.asker).leaders.find(leader => leader.id === defeated.id)!.dead, true);
  assert.equal(player(game, f.target).spice, originalSpice - 3 + defeated.strength);
  assert.equal(player(game, f.asker).bribes, originalBribes + 3);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native constant mixed battle Yes stays terminal after a real bribe changes its snapshotted spice fact', () => {
  const f = fixture(), mixed = group('or', fact(f.spiceFact), action(f.weaponClaim));
  const originalSpice = player(f.game, f.target).spice;
  let game = bind(f, 'yes', mixed).game; assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.truthPromises?.length ?? 0, 0);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, originalSpice - 3);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, true);
  game = reveal(game, f, f.targetPlan).game; assert.equal(game.battle!.plans[f.target].weapon, null);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(promise(finish(game, f)).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});
