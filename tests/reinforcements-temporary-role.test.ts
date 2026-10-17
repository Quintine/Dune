import assert from 'node:assert/strict';
import { test } from 'node:test';
import { casualtyOptions, maxCombatDial, maxCombatSupport, type CombatForces } from '../game/combat';
import { reinforcementsBattleForces } from '../game/reinforcements-homeworld';

function original(normal = 7, freeStars = true): CombatForces {
  return {normal,elite:0,temporaryElite:5,eliteStrength:2,freeSupport:false,eliteFreeSupport:freeStars};
}

void test('own-World fee spends unconverted normals first, then removes only paid temporary roles', () => {
  const before = original();
  assert.deepEqual([1,2,3].map(normal => {
    const remaining = reinforcementsBattleForces(before,{normal,elite:0});
    return [remaining.normal,remaining.temporaryElite,maxCombatDial(remaining)];
  }), [[6,5,11],[5,5,10],[4,4,8]]);
  const allConverted = reinforcementsBattleForces(original(5),{normal:3,elite:0});
  assert.deepEqual([allConverted.normal,allConverted.temporaryElite,maxCombatDial(allConverted)],[2,2,4]);
  assert.deepEqual(before,original(),'The declared five-counter group is unchanged.');
});

void test('reduced temporary force roles retain pre-fee support traits and ordinary physical casualties', () => {
  for (const freeStars of [false,true]) {
    const remaining = reinforcementsBattleForces(original(7,freeStars),{normal:3,elite:0});
    assert.equal(remaining.eliteFreeSupport,freeStars);
    assert.equal(maxCombatSupport(remaining),freeStars ? 0 : 4);
    const losses = casualtyOptions(remaining,4,freeStars ? 0 : 2);
    assert.ok(losses.length);
    assert.ok(losses.every(loss => loss.normal === 2 && loss.elite === 0));
  }
});

void test('off-World and zero allocations keep the original five roles; impossible local fees reject', () => {
  const before = original();
  assert.equal(reinforcementsBattleForces(before),before);
  assert.equal(reinforcementsBattleForces(before,{normal:0,elite:0}),before);
  assert.throws(()=>reinforcementsBattleForces(before,{normal:8,elite:0}));
  assert.throws(()=>reinforcementsBattleForces(before,{normal:0,elite:1}));
});
