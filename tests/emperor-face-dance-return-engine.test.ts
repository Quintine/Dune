import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actEmperorFaceDanceReturn as act, commitEmperorFaceDanceReturn as commit,
  createEmperorFaceDanceReturnFixture as fixture, finishEmperorFaceDanceReturn as finish,
  emperorFaceDanceReturnHomes as homes, emperorFaceDanceReturnInventory as inventory,
  emperorFaceDanceReturnPhysical as physical, emperorFaceDanceReturnPlayer as player,
  type EmperorFaceDanceReturnFixture,
} from './fixture-emperor-face-dance-return';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function revival(game: Game) {
  return { freeRevival: game.freeRevival, emperorExtra: game.emperorExtra,
    players: game.players.map(seat => ({ id: seat.id, revived: seat.revived,
      eliteRevived: seat.elites?.revived, freeForcesRevived: seat.freeForcesRevived,
      leaderRevived: seat.leaderRevived, revivalCycle: seat.revivalCycle })) };
}
function source(f: EmperorFaceDanceReturnFixture) {
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, true);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 6);
  assert.deepEqual(f.game.expansions, ['ix']);
  assert.deepEqual(f.game.players.map(seat => seat.faction), ['emperor', 'tleilaxu', 'atreides']);
  assert.ok(f.game.homeworlds?.custody);
  assert.ok(!f.game.nexusCards && !f.game.leaderSkills && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.ok(f.game.decision?.kind === 'faceDance');
  assert.equal(f.game.decision.player, f.tleilaxu);
  assert.equal(f.game.decision.winner, f.emperor);
  assert.equal(f.game.decision.identity, f.winnerLeader);
  assert.equal(f.game.response ?? null, null); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  const offer = viewGame(f.game, f.tleilaxu).decision;
  assert.ok(offer?.kind === 'faceDance');
  assert.equal(offer.blocked ?? null, null,
    'The original Emperor opportunity must project as available after typed return integration');
  assert.equal(f.shipmentStep.actor, f.emperor);
  assert.equal(f.shipmentStep.action.amount, f.amount);
  assert.equal(f.shipmentStep.action.elite, f.elite);
  assert.deepEqual(f.shipmentStep.action.homeworldSources, {
    'homeworld:emperor': { normal: f.normal, elite: 0 },
    'homeworld:emperor:salusa': { normal: 0, elite: f.elite },
  });
  assert.equal(player(f.afterShipment, f.emperor).forces[f.location], f.amount);
  assert.equal(player(f.afterShipment, f.emperor).elites!.forces[f.location] ?? 0, f.elite);
  assert.deepEqual(homes(f.game)['homeworld:emperor'], { normal: 15 - f.normal, elite: 0 });
  assert.deepEqual(homes(f.game)['homeworld:emperor:salusa'], { normal: 0, elite: 5 - f.elite });
  assert.equal(player(f.game, f.emperor).forces[f.location], f.survivorCount);
  assert.equal(player(f.game, f.emperor).tanks, f.dial);
  assert.equal(player(f.game, f.emperor).elites!.tanks, 0);
  assert.equal(player(f.game, f.opponent).tanks, 10);
  assert.equal(player(f.game, f.opponent).forces[f.location] ?? 0, 0);
  assert.equal(f.game.lastBattleContext!.winner, f.emperor);
  assert.equal(f.game.lastBattleContext!.result, 'normal');
  assert.equal(f.game.lastBattleContext!.event, f.event);
  assert.deepEqual([...f.faceDancerDeal.order].sort(), [...f.faceDancerDeal.original].sort());
  assert.equal(f.faceDancerDeal.scalars.length, f.faceDancerDeal.original.length - 1);
  assert.equal(f.faceDancerDeal.order[0], f.winnerLeader);
  assert.ok(player(f.afterSetup, f.tleilaxu).faceDancers!.some(card => card.leader === f.winnerLeader && !card.revealed));
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function returned(f: EmperorFaceDanceReturnFixture, game: Game, replacement: number) {
  assert.equal(player(game, f.emperor).forces[f.location] ?? 0, 0);
  assert.equal(player(game, f.emperor).elites!.forces[f.location] ?? 0, 0);
  assert.equal(player(game, f.emperor).reserves, player(f.game, f.emperor).reserves + f.survivorCount);
  assert.equal(player(game, f.emperor).elites!.reserves, player(f.game, f.emperor).elites!.reserves + f.survivors.elite);
  assert.deepEqual(homes(game)['homeworld:emperor'], { normal: 15 - f.dial, elite: 0 },
    'Only the exact live normal counters return to Kaitain');
  assert.deepEqual(homes(game)['homeworld:emperor:salusa'], { normal: 0, elite: 5 },
    'Only the exact live Sardaukar return to Salusa');
  assert.equal(player(game, f.emperor).tanks, f.dial);
  assert.equal(player(game, f.emperor).elites!.tanks, 0);
  assert.equal(player(game, f.emperor).battleLosses, player(f.game, f.emperor).battleLosses);
  assert.equal(player(game, f.tleilaxu).forces[f.location] ?? 0, replacement);
  assert.equal(player(game, f.tleilaxu).reserves, player(f.game, f.tleilaxu).reserves - replacement);
  assert.deepEqual(homes(game)['homeworld:tleilaxu'], { normal: 20 - replacement, elite: 0 },
    'Replacement withdraws the same physical native reserve counters');
  const leader = player(game, f.emperor).leaders.find(candidate => candidate.id === f.winnerLeader)!;
  assert.equal(leader.dead, true);
  assert.equal(leader.deaths, player(f.game, f.emperor).leaders.find(candidate => candidate.id === f.winnerLeader)!.deaths + 1);
  assert.equal(player(game, f.tleilaxu).faceDancers!.filter(card => card.revealed).length, 1);
  assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, true);
  assert.equal(game.pendingFaceDance ?? null, null);
  assert.notEqual(game.decision?.kind, 'faceDance');
  assert.deepEqual(game.lastBattleContext, f.originalContext,
    'Face Dance preserves the completed original victory instead of resolving a second battle');
  assert.deepEqual(inventory(game), f.originalInventory);
}

void test('public Advanced Emperor shipment, original Face Dancer deal and real normal casualty earn an unblocked offer', () => {
  const f = fixture(); source(f);
  assert.deepEqual(f.survivors, { normal: 2, elite: 2 });
  assert.deepEqual(physical(f.game), f.originalPhysical);
});

for (const army of ['mixed', 'normal', 'elite'] as const) for (const zero of [false, true]) {
  void test(`native Advanced Emperor ${army} survivors return to exact Homeworlds with ${zero ? 'zero' : 'positive'} replacement`, () => {
    const f = fixture({ army }); source(f);
    const before = structuredClone(f.game), amount = zero ? 0 : f.survivorCount;
    let game = commit(f, f.game, zero ? f.zero : f.action);
    assert.deepEqual(f.game, before, 'Submitting the original action does not mutate its input');
    returned(f, game, amount);
    assert.deepEqual(game.players.map(seat => seat.spice), before.players.map(seat => seat.spice),
      'The return grants no bounty, income, revival or transport charge');
    assert.deepEqual(revival(game), revival(before), 'Returning live survivors consumes no revival allowance');
    const counters = physical(game);
    rejected(game, f.tleilaxu, f.action);
    game = finish(game);
    assert.equal(game.phase, 7); returned(f, game, amount);
    assert.deepEqual(physical(game), counters);
    assert.deepEqual(revival(game), revival(before));
  });
}

void test('declining the original Advanced Emperor Face Dance preserves the typed army, native pools and living leader', () => {
  const f = fixture(); source(f);
  const before = physical(f.game), wallets = f.game.players.map(seat => seat.spice);
  let game = commit(f, f.game, f.decline);
  assert.deepEqual(physical(game), before);
  assert.deepEqual(game.players.map(seat => seat.spice), wallets);
  assert.equal(player(game, f.emperor).leaders.find(leader => leader.id === f.winnerLeader)!.dead, false);
  assert.equal(player(game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)!.revealed, false);
  assert.equal(game.pendingFaceDance ?? null, null);
  game = finish(game);
  assert.equal(game.phase, 7); assert.deepEqual(physical(game), before);
  assert.deepEqual(game.lastBattleContext, f.originalContext);
  assert.deepEqual(inventory(game), f.originalInventory);
  rejected(game, f.tleilaxu, f.action);
});

void test('native Emperor Face Dance rejects foreign, stale and excessive replacement sources before its outcome', () => {
  const f = fixture(); source(f);
  rejected(f.game, f.emperor, f.action);
  rejected(f.game, f.opponent, f.action);
  rejected(f.game, f.tleilaxu, { ...f.action, sources: { 'homeworld:emperor': 1 } });
  rejected(f.game, f.tleilaxu, { ...f.action, sources: { [f.location]: 1 } });
  rejected(f.game, f.tleilaxu, { ...f.action, sources: { reserves: f.survivorCount + 1 } });
  rejected(f.game, f.tleilaxu, { ...f.action, sources: { reserves: player(f.game, f.tleilaxu).reserves + 1 } });
  rejected(f.game, f.tleilaxu, { ...f.action, sources: { reserves: -1 } });
  rejected(f.game, f.tleilaxu, { ...f.action, sector: 9 });
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.deepEqual(inventory(f.game), f.originalInventory);
  const committed = commit(f);
  rejected(committed, f.tleilaxu, f.action);
  returned(f, committed, f.survivorCount);
});

void test('all four minimal profiles use the real unblocked Emperor offer and exact native replacement source', () => {
  const f = fixture(); source(f);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.tleilaxu);
    view.players.find(seat => seat.id === f.tleilaxu)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.deepEqual(action, f.action, `${difficulty} submits the original projected Face Dance action`);
    let game = act(f.game, f.tleilaxu, action);
    returned(f, game, f.survivorCount);
    game = finish(game);
    assert.equal(game.phase, 7); returned(f, game, f.survivorCount);
  }
});
