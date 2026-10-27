import assert from 'node:assert/strict';
import test from 'node:test';
import { actSalusaGhola, advanceSalusaGhola, salusaGholaClean,
  type SalusaGholaStep } from './fixture-salusa-ghola';
import { createBattleTerritoryExplosionFixture } from './fixture-battle-territory-explosion';

void test('Advanced explosion kills leaders left from a completed earlier battle in the same territory', () => {
  const f = createBattleTerritoryExplosionFixture();
  const previous = f.afterFirst.players.find(p => p.id === 'atreides')!.leaders.find(l => l.id === f.priorLoser)!;
  const winner = f.afterFirst.players.find(p => p.id === f.priorWinnerOwner)!.leaders.find(l => l.id === f.priorWinner)!;
  assert.equal(previous.dead,false); assert.equal(previous.usedAt,f.territory);
  assert.equal(winner.dead,false); assert.equal(winner.usedAt,f.territory);
  const actions: SalusaGholaStep[] = [];
  let game = structuredClone(f.game);
  for (const plan of f.plans) game = actSalusaGhola(game,plan.actor,plan.action,actions);
  game = advanceSalusaGhola(game,g => !g.battle && salusaGholaClean(g),actions);
  assert.ok(actions.filter(step => step.action.type === 'traitorCall').every(step => step.action.call === false));
  for (const [owner,id] of [['atreides',f.priorLoser],[f.priorWinnerOwner,f.priorWinner],
    ['emperor',f.emperorLeader],['guild',f.guildLeader]] as const) {
    const leader = game.players.find(p => p.id === owner)!.leaders.find(l => l.id === id)!;
    assert.equal(leader.dead,true,`${owner}'s ${id} is killed by the territory-wide explosion`);
    assert.equal(leader.deaths,1);
  }
  assert.ok(game.log.some(entry => /Lasgun and shield exploded/.test(entry.text)));
  assert.equal(game.discard.filter(card => card.id === f.shield || card.id === f.lasgun).length,2);
  assert.equal(game.players.flatMap(p => Object.entries(p.forces).filter(([key]) => key.startsWith(`${f.territory}:`)))
    .reduce((sum,[,amount]) => sum + amount,0),0);
});
