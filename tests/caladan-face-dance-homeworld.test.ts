import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createCaladanFaceDanceHomeworldFixture as fixture,
  actCaladanFaceDanceHomeworld as act,
  finishCaladanFaceDanceHomeworld as finish,
  caladanFaceDanceHomeworldPlayer as player,
  caladanFaceDanceHomeworldArmy as army,
  caladanFaceDanceHomeworldInventory as inventory,
  caladanFaceDanceHomeworldTraitors as traitors,
  type CaladanFaceDanceHomeworldFixture as Fixture,
  type CaladanFaceDanceHomeworldStep as Step,
} from './fixture-caladan-face-dance-homeworld';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.lobby.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.setup.advanced, f.advanced); assert.deepEqual(f.setup.expansions, ['ix']);
  assert.equal(f.afterSetup.status, 'playing'); assert.ok(f.afterSetup.homeworlds?.custody);
  assert.equal(f.game.homeworldOccupationPreview, f.afterSetup.homeworldOccupationPreview);
  assert.match(f.staging[1], /CONTROLLED/); assert.match(f.staging[2], /CONTROLLED/);
  assert.equal(f.sourceActionCount, f.actions.length); assert.ok(f.sourceActionCount > 4);
  assert.equal(player(f.controlled, f.atreides).reserves, 6); assert.equal(army(f.controlled, f.atreides), 3);
  assert.equal(player(f.controlled, f.atreides).forces['polar_sink:0'], 11);
  assert.equal(player(f.controlled, f.tleilaxu).reserves, 2);
  assert.equal(player(f.controlled, f.tleilaxu).forces['polar_sink:0'], 18);
  assert.equal(player(f.game, f.atreides).reserves, 6); assert.equal(army(f.game, f.atreides), 3);
  assert.equal(player(f.game, f.atreides).tanks, 0); assert.equal(player(f.game, f.tleilaxu).tanks, 2);
  assert.equal(player(f.game, f.tleilaxu).reserves, 0); assert.equal(army(f.game, f.tleilaxu), 0);
  assert.equal(f.game.decision?.kind, 'caladanReinforcement'); assert.equal(f.game.battle ?? null, null);
  assert.equal(f.game.pendingFaceDance!.player, f.tleilaxu); assert.equal(f.game.pendingFaceDance!.identity, f.winnerLeader);
  assert.equal(player(f.game, f.atreides).leaders.find(leader => leader.id === f.winnerLeader)!.dead, false);
  assert.equal(f.game.lastBattleContext!.winner, f.atreides); assert.equal(f.game.lastBattleContext!.result, 'normal');
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.originalInventory.length, 47);
  assert.deepEqual(traitors(f.game), f.originalTraitors);
  assert.deepEqual(f.game.players.map(p => ({ player: p.id, ids: p.leaders.map(leader => leader.id).sort() })), f.originalLeaders);
}
function give(f: Fixture, actions: Step[] = []) {
  source(f);
  const offer = viewGame(f.game, f.atreides).caladanReinforcement!;
  assert.equal(offer.blocked, null); assert.equal(offer.territory, f.territory);
  assert.deepEqual(offer.destinations.map(destination => ({ id: destination.id, blocked: destination.blocked })),
    [{ id: f.destination, blocked: null }]);
  const game = act(f.game, f.atreides, f.reinforcementAction, actions);
  assert.equal(player(game, f.atreides).reserves, 5); assert.equal(army(game, f.atreides), 4);
  assert.equal(player(game, f.atreides).forces['polar_sink:0'], 11); assert.equal(player(game, f.atreides).tanks, 0);
  assert.deepEqual(game.pendingFaceDance, f.originalPendingFaceDance);
  assert.equal(game.decision?.kind, 'faceDance'); assert.equal(game.decision?.player, f.tleilaxu);
  assert.equal(game.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(game.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function completed(game: Game, f: Fixture, actions: Step[] = []) {
  const done = finish(game, actions);
  assert.equal(done.phase, 7); assert.equal(done.battle ?? null, null); assert.equal(done.decision ?? null, null);
  assert.equal(done.pendingFaceDance ?? null, null); assert.equal(viewGame(done, f.atreides).caladanReinforcement, null);
  assert.equal(done.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(done.lastBattleContext!.event, f.event); assert.equal(done.lastBattleContext!.winner, f.atreides);
  assert.equal(done.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(traitors(done), f.originalTraitors);
  const history = f.game.homeworldOccupationHistory;
  if (history) {
    const actual = done.homeworldOccupationHistory; assert.ok(actual);
    assert.deepEqual(actual.sources.slice(0, history.sources.length), history.sources);
    assert.deepEqual(actual.snapshots.slice(0, history.snapshots.length), history.snapshots);
  }
  reject(done, f.atreides, f.reinforcementAction);
  reject(done, f.tleilaxu, f.faceDanceAction); return done;
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} controlled native Homeworld victory reinforces before Face Dance and returns all four winning visitors once`, () => {
    const f = fixture({ advanced }), actions: Step[] = [];
    let game = give(f, actions);
    const wallets = game.players.map(p => ({ id: p.id, spice: p.spice, shipped: p.shipped, moved: p.moved }));
    const beforeLeader = structuredClone(player(game, f.atreides).leaders.find(leader => leader.id === f.winnerLeader)!);
    game = act(game, f.tleilaxu, f.faceDanceAction, actions);
    assert.equal(player(game, f.atreides).reserves, 9); assert.equal(army(game, f.atreides), 0);
    assert.equal(player(game, f.atreides).forces['polar_sink:0'], 11); assert.equal(player(game, f.atreides).tanks, 0);
    assert.equal(player(game, f.tleilaxu).reserves, 4); assert.equal(player(game, f.tleilaxu).forces['polar_sink:0'], 14);
    assert.equal(player(game, f.tleilaxu).tanks, 2);
    const dead = player(game, f.atreides).leaders.find(leader => leader.id === f.winnerLeader)!;
    assert.equal(dead.dead, true); assert.equal(dead.deaths, beforeLeader.deaths + 1);
    assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, true);
    assert.deepEqual(game.players.map(p => ({ id: p.id, spice: p.spice, shipped: p.shipped, moved: p.moved })), wallets);
    game = completed(game, f, actions);
    assert.equal(actions.filter(step => step.action.reveal === true).length, 1);
    assert.equal(actions.filter(step => step.action.destination === f.destination).length, 1);
    assert.equal(player(game, f.atreides).reserves, 9); assert.equal(player(game, f.tleilaxu).reserves, 4);
  });

  void test(`${band} controlled native Homeworld victory keeps its fourth visitor when Tleilaxu declines Face Dance`, () => {
    const f = fixture({ advanced }), actions: Step[] = [];
    let game = give(f, actions);
    const before = structuredClone(game.players), custody = structuredClone(game.homeworlds!.custody);
    game = act(game, f.tleilaxu, f.faceDanceDecline, actions); game = completed(game, f, actions);
    assert.deepEqual(game.players, before); assert.deepEqual(game.homeworlds!.custody, custody);
    assert.equal(player(game, f.atreides).reserves, 5); assert.equal(army(game, f.atreides), 4);
    assert.equal(player(game, f.tleilaxu).reserves, 0); assert.equal(player(game, f.tleilaxu).forces['polar_sink:0'], 18);
    assert.equal(player(game, f.atreides).leaders.find(leader => leader.id === f.winnerLeader)!.dead, false);
    assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, false);
  });

  void test(`${band} controlled native Homeworld reinforcement decline leaves the original three-counter Face Dance cap`, () => {
    const f = fixture({ advanced }); source(f);
    let game = act(f.game, f.atreides, f.reinforcementDecline);
    assert.equal(game.decision?.kind, 'faceDance'); assert.equal(player(game, f.atreides).reserves, 6);
    assert.equal(army(game, f.atreides), 3); assert.deepEqual(game.pendingFaceDance, f.originalPendingFaceDance);
    reject(game, f.tleilaxu, f.faceDanceAction);
    game = act(game, f.tleilaxu, { ...f.faceDanceAction, sources: { 'polar_sink:0': 3 } });
    game = completed(game, f);
    assert.equal(player(game, f.atreides).reserves, 9); assert.equal(army(game, f.atreides), 0);
    assert.equal(player(game, f.tleilaxu).reserves, 3); assert.equal(player(game, f.tleilaxu).forces['polar_sink:0'], 15);
    assert.equal(player(game, f.tleilaxu).tanks, 2);
  });

  void test(`${band} controlled Homeworld reinforcement and subsequent Face Dance reject stale, foreign, quantity and live-source over-cap actions`, () => {
    const f = fixture({ advanced }); source(f);
    reject(f.game, f.tleilaxu, f.reinforcementAction);
    reject(f.game, f.atreides, { ...f.reinforcementAction, event: `${f.event}:stale` });
    reject(f.game, f.atreides, { ...f.reinforcementAction, amount: 2 });
    reject(f.game, f.atreides, { ...f.reinforcementAction, destination: 'homeworld:guild' });
    const game = give(f);
    reject(game, f.atreides, f.reinforcementAction);
    reject(game, f.atreides, f.faceDanceAction);
    reject(game, f.tleilaxu, { ...f.faceDanceAction, sources: { 'polar_sink:0': 5 } });
    reject(game, f.tleilaxu, { ...f.faceDanceAction, sources: { 'polar_sink:0': 19 } });
    reject(game, f.tleilaxu, { ...f.faceDanceAction, sources: { 'hagga_basin:12': 1 } });
    completed(act(game, f.tleilaxu, f.faceDanceAction), f);
  });
}

void test('all four minimal profiles use legal Caladan and native Homeworld Face Dance controls at the controlled Advanced source', () => {
  const f = fixture({ advanced: true }); source(f);
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(f.game, f.atreides); view.players.find(p => p.id === f.atreides)!.bot = profile;
    const choices = botActions(view); assert.ok(choices.length);
    for (const action of choices) {
      const game = act(f.game, f.atreides, action);
      assert.equal(game.decision?.kind, 'faceDance');
      const tleilaxu = viewGame(game, f.tleilaxu); tleilaxu.players.find(p => p.id === f.tleilaxu)!.bot = profile;
      const dance = botActions(tleilaxu); assert.ok(dance.length);
      for (const choice of dance) completed(act(game, f.tleilaxu, choice), f);
    }
  }
});
