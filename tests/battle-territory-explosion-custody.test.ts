import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { actSalusaGhola, advanceSalusaGhola, salusaGholaClean,
  type SalusaGholaStep } from './fixture-salusa-ghola';
import { createAdvisorBattleFlipFixture } from './fixture-advisor-battle-flip';

void test('Advanced explosion does not kill or reveal a captured disc with a stale territory stamp', () => {
  const f = createAdvisorBattleFlipFixture({ explosion: true });
  let game = structuredClone(f.game);
  // Controlled custody supplement: a real BG leader in its native roster has
  // already been captured by the actually seated Harkonnen. Preserve the
  // capture snapshot that hides its physical custody from the other player;
  // the inherited battle, plans, cards, armies and all costs are native.
  const owner = game.players.find(p => p.id === 'beneGesserit')!;
  const captive = owner.leaders[0]; assert.ok(captive && !captive.dead && !captive.capturedBy);
  captive.usedAt = 'arrakeen';
  captive.concealed = { captor: 'harkonnen', controller: owner.id, dead: captive.dead,
    deaths: captive.deaths, usedAt: captive.usedAt };
  captive.capturedBy = 'harkonnen';
  const id = captive.id, physicalBefore = structuredClone(captive);
  const viewBefore = viewGame(game,'atreides').players.find(p => p.id === owner.id)!.leaders.find(l => l.id === id)!;
  assert.equal(viewBefore.capturedBy,undefined);
  const steps: SalusaGholaStep[] = [];
  game = advanceSalusaGhola(game,g => salusaGholaClean(g) && !!g.battle && !g.battle.revealed &&
    !g.battle.preparation && (!g.battle.preLeader || g.battle.preLeader.closed),steps);
  for (const plan of f.plans) game = actSalusaGhola(game,plan.actor,plan.action,steps);
  game = advanceSalusaGhola(game,g => !g.battle && salusaGholaClean(g),steps);
  const after = game.players.find(p => p.id === owner.id)!.leaders.find(l => l.id === id)!;
  assert.equal(after.dead,physicalBefore.dead);
  assert.equal(after.deaths,physicalBefore.deaths);
  assert.equal(after.capturedBy,'harkonnen');
  assert.ok(after.concealed);
  const viewAfter = viewGame(game,'atreides').players.find(p => p.id === owner.id)!.leaders.find(l => l.id === id)!;
  assert.equal(viewAfter.capturedBy,undefined);
  assert.equal(viewAfter.dead,viewBefore.dead);
  assert.equal(viewAfter.deaths,viewBefore.deaths);
  assert.ok(game.log.some(entry => /Lasgun and shield exploded/.test(entry.text)));
});
