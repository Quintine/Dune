import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createEmperorFaceDanceHomeworldFixture as fixture,
  actEmperorFaceDanceHomeworld as act,
  finishEmperorFaceDanceHomeworld as finish,
  emperorFaceDanceHomeworldPlayer as player,
  emperorFaceDanceHomeworldArmy as army,
  emperorFaceDanceHomeworldInventory as inventory,
  emperorFaceDanceHomeworldTraitors as traitors,
  type EmperorFaceDanceHomeworldFixture as Fixture,
  type EmperorFaceDanceHomeworldStep as Step,
} from './fixture-emperor-face-dance-homeworld';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function allowances(game: Game) {
  return {
    players: game.players.map(p => ({ id: p.id, spice: p.spice, shipped: p.shipped, moved: p.moved,
      revived: p.revived, freeForcesRevived: p.freeForcesRevived, leaderRevived: p.leaderRevived,
      revivalCycle: p.revivalCycle, eliteRevived: p.elites?.revived, battleLosses: p.battleLosses })),
    revivalRules: structuredClone(game.revivalRules), revivalRequests: structuredClone(game.revivalRequests),
    revivalFreeIncome: structuredClone(game.revivalFreeIncome), pendingRevival: structuredClone(game.pendingRevival),
  };
}
function source(f: Fixture) {
  assert.equal(f.lobby.status, 'lobby'); assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true);
  assert.deepEqual(f.setup.expansions, ['ix']); assert.equal(f.afterSetup.status, 'playing');
  assert.equal(f.game.homeworldOccupationPreview, f.afterSetup.homeworldOccupationPreview);
  assert.match(f.staging[1], /CONTROLLED/); assert.match(f.staging[1], /not native invasion evidence/);
  assert.match(f.staging[2], /CONTROLLED/); assert.equal(f.sourceActionCount, f.actions.length);
  assert.ok(f.sourceActionCount > 4); assert.deepEqual(f.rawGame, f.game);
  assert.equal(player(f.afterSetup, f.tleilaxu).reserves, 20);
  assert.equal(player(f.game, f.emperor).reserves, 17);
  assert.equal(player(f.game, f.emperor).elites!.reserves, 5 - f.visitors.elite);
  assert.equal(player(f.game, f.emperor).tanks, 0); assert.equal(player(f.game, f.emperor).elites!.tanks, 0);
  assert.deepEqual(army(f.game, f.emperor), f.visitors);
  assert.deepEqual(army(f.game, f.emperor, 'homeworld:emperor'), { normal: 15 - f.visitors.normal, elite: 0 });
  assert.deepEqual(army(f.game, f.emperor, 'homeworld:emperor:salusa'), { normal: 0, elite: 5 - f.visitors.elite });
  assert.equal(player(f.game, f.tleilaxu).reserves, 10); assert.equal(player(f.game, f.tleilaxu).tanks, 0);
  assert.equal(player(f.game, f.tleilaxu).forces['polar_sink:0'], 10);
  assert.deepEqual(army(f.game, f.tleilaxu), { normal: 10, elite: 0 });
  assert.equal(player(f.game, f.atreides).tanks, 3); assert.deepEqual(army(f.game, f.atreides), { normal: 0, elite: 0 });
  assert.equal(f.game.decision?.kind, 'faceDance'); assert.equal(f.game.decision?.player, f.tleilaxu);
  assert.equal(f.game.pendingFaceDance!.identity, f.winnerLeader);
  assert.equal(f.game.lastBattleContext!.winner, f.emperor); assert.equal(f.game.lastBattleContext!.result, 'normal');
  assert.equal(f.beforePreparation.battle!.attacker, f.emperor);
  assert.equal(f.beforePreparation.battle!.defender, f.atreides);
  assert.equal(player(f.game, f.emperor).leaders.find(disc => disc.id === f.winnerLeader)!.dead, false);
  const view = viewGame(f.game, f.tleilaxu); assert.ok(view.decision?.kind === 'faceDance');
  assert.equal(view.decision.blocked ?? null, null);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.originalInventory.length, 47);
  assert.deepEqual(traitors(f.game), f.originalTraitors);
  assert.deepEqual(f.game.players.map(p => ({ player: p.id, ids: p.leaders.map(disc => disc.id).sort() })), f.originalLeaders);
}
function returned(game: Game, f: Fixture, external: number, beforeLeader = player(f.game, f.emperor)
  .leaders.find(disc => disc.id === f.winnerLeader)!) {
  assert.equal(player(game, f.emperor).reserves, 20); assert.equal(player(game, f.emperor).elites!.reserves, 5);
  assert.deepEqual(army(game, f.emperor), { normal: 0, elite: 0 });
  assert.deepEqual(army(game, f.emperor, 'homeworld:emperor'), { normal: 15, elite: 0 });
  assert.deepEqual(army(game, f.emperor, 'homeworld:emperor:salusa'), { normal: 0, elite: 5 });
  assert.equal(player(game, f.emperor).tanks, 0); assert.equal(player(game, f.emperor).elites!.tanks, 0);
  assert.deepEqual(player(game, f.emperor).forces, player(f.game, f.emperor).forces);
  assert.deepEqual(player(game, f.emperor).elites!.forces, player(f.game, f.emperor).elites!.forces);
  assert.equal(player(game, f.tleilaxu).reserves, 10 + external);
  assert.deepEqual(army(game, f.tleilaxu), { normal: 10 + external, elite: 0 });
  assert.equal(player(game, f.tleilaxu).forces['polar_sink:0'], 10 - external);
  assert.equal(player(game, f.tleilaxu).tanks, 0);
  assert.equal(game.homeworlds!.custody!.visitors[f.territory]?.[f.tleilaxu], undefined);
  assert.deepEqual(player(game, f.atreides), player(f.game, f.atreides), 'The actual defeated visitor and its off-battle army stay unchanged');
  assert.deepEqual(game.lastBattleContext, f.originalContext, 'Face Dance preserves original sides, victory, casualties and rewards');
  assert.deepEqual(allowances(game), allowances(f.game), 'Replacement creates no payment, revival quota, income or new revival state');
  const leader = player(game, f.emperor).leaders.find(disc => disc.id === f.winnerLeader)!;
  assert.equal(leader.dead, true); assert.equal(leader.deaths, beforeLeader.deaths + 1);
  assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, true);
  assert.equal(game.pendingFaceDance ?? null, null);
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
}
function completed(game: Game, f: Fixture, actions: Step[] = []) {
  const done = finish(game, actions);
  assert.equal(done.phase, 7); assert.equal(done.battle ?? null, null); assert.equal(done.decision ?? null, null);
  assert.equal(done.pendingFaceDance ?? null, null); assert.equal(done.lastBattleContext!.winner, f.emperor);
  assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(traitors(done), f.originalTraitors);
  reject(done, f.tleilaxu, f.faceDanceAction); return done;
}

for (const composition of ['mixed', 'normal', 'star'] as const) {
  void test(`Advanced controlled ${composition} Emperor visitors return to typed native homes after a real Homeworld victory`, () => {
    const f = fixture({ composition }); source(f); const actions: Step[] = [];
    const game = act(f.game, f.tleilaxu, f.faceDanceAction, actions); returned(game, f, 3);
    const done = completed(game, f, actions);
    assert.equal(player(done, f.emperor).reserves, 20); assert.equal(player(done, f.emperor).elites!.reserves, 5);
    assert.equal(player(done, f.tleilaxu).reserves, 13);
    assert.equal(actions.filter(step => step.action.reveal === true).length, 1);
    assert.equal(actions.some(step => step.action.type === 'revive'), false);
  });

  void test(`Advanced controlled ${composition} Emperor visitor victory preserves its army and native caller when Face Dance is declined`, () => {
    const f = fixture({ composition }); source(f);
    const players = structuredClone(f.game.players), custody = structuredClone(f.game.homeworlds!.custody);
    const game = act(f.game, f.tleilaxu, f.faceDanceDecline);
    assert.deepEqual(game.players, players); assert.deepEqual(game.homeworlds!.custody, custody);
    assert.deepEqual(game.lastBattleContext, f.originalContext); assert.equal(game.pendingFaceDance ?? null, null);
    assert.equal(game.decision ?? null, null); assert.equal(game.battle ?? null, null); assert.equal(game.phase, 6);
    assert.equal(player(game, f.emperor).leaders.find(disc => disc.id === f.winnerLeader)!.dead, false);
    assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, false);
    assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
    reject(game, f.tleilaxu, f.faceDanceAction);
  });
}

void test('Advanced controlled Homeworld reveal allows zero external replacement and treats selected native reserves as a physical no-op', () => {
  const f = fixture(); source(f);
  for (const action of [f.faceDanceZeroAction, f.faceDanceNativeAction,
    { type: 'decision', reveal: true, sources: { reserves: 2, 'polar_sink:0': 1 } } as Action]) {
    const external = (action.sources as Record<string, number>)['polar_sink:0'] ?? 0;
    const game = act(f.game, f.tleilaxu, action); returned(game, f, external); completed(game, f);
  }
});

void test('Advanced controlled Emperor Homeworld reveal rejects foreign owners, excess replacement and unavailable physical sources before mutation', () => {
  const f = fixture(); source(f);
  reject(f.game, f.emperor, f.faceDanceAction); reject(f.game, f.atreides, f.faceDanceAction);
  for (const sources of [
    { 'polar_sink:0': 4 }, { 'polar_sink:0': 11 }, { reserves: 11 },
    { reserves: 2, 'polar_sink:0': 2 }, { 'hagga_basin:12': 1 },
    { 'homeworld:tleilaxu': 1 }, { 'polar_sink:0': -1 }, { 'polar_sink:0': 1.5 },
  ]) reject(f.game, f.tleilaxu, { ...f.faceDanceAction, sources });
  completed(act(f.game, f.tleilaxu, f.faceDanceAction), f);
});

void test('all four minimal profiles use legal controls for the controlled Advanced Emperor visitor Homeworld Face Dance', () => {
  const f = fixture(); source(f);
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(f.game, f.tleilaxu); view.players.find(p => p.id === f.tleilaxu)!.bot = profile;
    const choices = botActions(view); assert.ok(choices.length);
    for (const action of choices) {
      const game = act(f.game, f.tleilaxu, action);
      if (action.reveal) {
        returned(game, f, Object.entries((action.sources ?? {}) as Record<string, number>).filter(([key]) => key !== 'reserves')
          .reduce((sum, [, amount]) => sum + amount, 0));
        completed(game, f);
      } else {
        assert.deepEqual(game.players, f.game.players); assert.deepEqual(game.homeworlds!.custody, f.game.homeworlds!.custody);
        assert.equal(game.pendingFaceDance ?? null, null); assert.equal(game.phase, 6);
      }
    }
  }
});
