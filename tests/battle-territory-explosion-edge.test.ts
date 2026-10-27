import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdvisorBattleFlipFixture as fixture,
  commitAdvisorBattleFlip as commit,
  advisorBattleFlipPlayer as player,
} from './fixture-advisor-battle-flip';

// The original Advanced game, forces, hands and Lasgun/Shield battle are real
// actions from the shared fixture. Prior leaders' usedAt/dead history and,
// for the mutual-Traitor case, exact physical Traitor custody are staged below:
// this supplement does not claim an earned first battle or Traitor deal.
function staged(mutualTraitors = false) {
  const f = fixture({ explosion: true });
  const game = structuredClone(f.game);
  if (mutualTraitors) {
    // Swap original identities across actual held/reserve slots; no Traitor is
    // invented or duplicated. The battle driver now calls the two real votes.
    const pools = [game.traitorReserve ?? [], ...game.players.flatMap(p => [p.traitors, p.traitorChoices])];
    for (const [actor, identity] of [[f.atreides, 'harkonnen-3'], [f.harkonnen, 'atreides-0']] as const) {
      const hand = player(game, actor).traitors;
      if (hand.includes(identity)) continue;
      const source = pools.find(pool => pool.includes(identity));
      assert.ok(source && hand.length > 0);
      const index = source.indexOf(identity);
      [hand[0], source[index]] = [source[index], hand[0]];
    }
    f.mutualTraitors = true;
  }
  const bg = player(game, f.bg);
  const [prior, elsewhere, unused, alreadyDead] = bg.leaders;
  assert.ok(prior && elsewhere && unused && alreadyDead);
  assert.ok([prior, elsewhere, unused, alreadyDead].every(leader => !leader.dead && !leader.usedAt));
  prior.usedAt = f.territory;
  elsewhere.usedAt = 'carthag';
  alreadyDead.dead = true;
  alreadyDead.deaths = 1;
  const current = player(game, f.atreides).leaders.find(leader => leader.id === f.atreidesPlan.leader);
  assert.ok(current && !current.dead && !current.usedAt);
  current.usedAt = f.territory;
  return { f, game, prior: prior.id, elsewhere: elsewhere.id, unused: unused.id,
    alreadyDead: alreadyDead.id, current: current.id };
}

void test('Advanced territory-wide explosion kills a prior noncombatant leader exactly once', () => {
  const s = staged(), done = commit(s.game, s.f).game;
  assert.equal(done.lastBattleContext?.result, 'explosion');
  const bg = player(done, s.f.bg);
  const byId = (id: string) => { const leader = bg.leaders.find(item => item.id === id); assert.ok(leader); return leader; };
  const prior = byId(s.prior);
  assert.equal(prior.dead, true);
  assert.equal(prior.deaths, 1);
  assert.equal(prior.usedAt, undefined);
  const current = player(done, s.f.atreides).leaders.find(leader => leader.id === s.current)!;
  assert.equal(current.dead, true);
  assert.equal(current.deaths, 1, 'The current plan leader is not killed twice');
  assert.equal(current.usedAt, undefined);
  assert.equal(byId(s.elsewhere).dead, false);
  assert.equal(byId(s.elsewhere).usedAt, 'carthag');
  assert.equal(byId(s.unused).dead, false);
  assert.equal(byId(s.unused).usedAt, undefined);
  assert.equal(byId(s.alreadyDead).dead, true);
  assert.equal(byId(s.alreadyDead).deaths, 1, 'A dead leader stays in the Tanks without another death');
});

void test('mutual Traitors take precedence over a revealed Lasgun and Shield', () => {
  const s = staged(true), done = commit(s.game, s.f).game;
  assert.equal(done.lastBattleContext?.result, 'mutualTraitors');
  const prior = player(done, s.f.bg).leaders.find(leader => leader.id === s.prior)!;
  assert.equal(prior.dead, false);
  assert.equal(prior.deaths, 0);
  assert.equal(prior.usedAt, s.f.territory);
});
