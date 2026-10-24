import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor, fighterCount } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorFaceDanceFlipFixture as fixture, actAdvisorFaceDanceFlip as act,
  commitAdvisorFaceDanceFlip as commit, finishAdvisorFaceDanceFlip as finish,
  advisorFaceDanceFlipPlayer as player, advisorFaceDanceFlipInventory as inventory,
  advisorFaceDanceFlipTraitors as traitors,
} from './fixture-advisor-face-dance-flip';

function allow(g: Game) {
  for (let count = 0; g.response?.automaticAdvisorFlip && count < 30; count++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id)); assert.ok(actor);
    g = act(g, actor.id, { type: 'passResponse' });
  }
  assert.ok(!g.response?.automaticAdvisorFlip); return g;
}
function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
const physical = (g: Game) => g.players.map(p => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, battleLosses: p.battleLosses, leaders: p.leaders }));

for (const zeroReplacement of [false, true]) for (const canceled of [false, true]) {
  void test(`native ${zeroReplacement ? 'zero replacement' : 'remote source'} ${canceled ? 'prevention' : 'allowance'} preserves completed Face Dance and resumes aftermath once`, () => {
    const f = fixture({ zeroReplacement }), before = structuredClone(f.game);
    const pending = commit(f.game, f).game;
    assert.deepEqual(f.game, before);
    assert.equal(pending.phase, 6); assert.equal(pending.battle, null);
    assert.equal(pending.decision, null); assert.equal(pending.pendingFaceDance, null);
    const source = pending.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'faceDance');
    assert.equal(source.faceDance.battle.event, pending.lastBattleContext?.event);
    assert.equal(source.faceDance.territory, f.battleTerritory);
    assert.equal(source.faceDance.amount, zeroReplacement ? 0 : 9);
    assert.deepEqual(source.faceDance.sources, f.sources);
    assert.deepEqual(source.faceDance.returned, { [f.winner]: 9 });
    assert.equal(player(pending, f.winner).reserves, player(before, f.winner).reserves + 9);
    assert.equal(player(pending, f.winner).forces[`${f.battleTerritory}:10`], undefined);
    const leader = player(pending, f.winner).leaders.find(l => l.id === f.winnerLeader)!;
    assert.equal(leader.dead, true);
    assert.equal(leader.deaths, player(before, f.winner).leaders.find(l => l.id === f.winnerLeader)!.deaths + 1);
    assert.equal(player(pending, f.tleilaxu).faceDancers!.find(c => c.leader === f.winnerLeader)!.revealed, true);
    assert.equal(player(pending, f.tleilaxu).forces[f.location], undefined);
    assert.equal(player(pending, f.tleilaxu).forces['imperial_basin:10'], zeroReplacement ? 2 : 9);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.deepEqual(pending.players.map(p => p.spice), before.players.map(p => p.spice), 'Face Dance grants no extra bounty');
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.karama));
    assert.ok(!JSON.stringify(viewGame(pending, f.holder).response).includes(f.winnerLeader));
    rejected(pending, f.tleilaxu, f.action);
    const committed = physical(pending), bgSpice = player(pending, f.bg).spice;
    let done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' }) : allow(pending);
    assert.equal(done.pendingAutomaticAdvisorFaceDance, undefined);
    assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    assert.deepEqual(physical(done), committed);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    done = finish(done);
    assert.equal(done.phase, 7);
    assert.equal(player(done, f.bg).spice, bgSpice + (canceled ? 0 : 2));
    assert.deepEqual(physical(done), committed);
    for (let read = 0; read < 3; read++) {
      done = normalizeAutomaticGame(done);
      assert.deepEqual(physical(done), committed);
      assert.equal(player(done, f.bg).spice, bgSpice + (canceled ? 0 : 2));
    }
    assert.equal(done.discard.filter(c => c.id === f.karama).length, canceled ? 1 : 0);
    assert.deepEqual(inventory(done), f.originalInventory);
    assert.deepEqual(traitors(done), f.originalTraitors);
  });
}

void test('declining native Face Dance creates no conversion and keeps the original winner and unrevealed card', () => {
  const f = fixture();
  rejected(f.game, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  const declined = act(f.game, f.tleilaxu, { type: 'decision', reveal: false });
  assert.equal(declined.pendingAutomaticAdvisorFaceDance, undefined);
  assert.equal(player(declined, f.winner).forces[`${f.battleTerritory}:10`], 9);
  assert.equal(player(declined, f.winner).leaders.find(l => l.id === f.winnerLeader)!.dead, false);
  assert.equal(player(declined, f.tleilaxu).faceDancers!.find(c => c.leader === f.winnerLeader)!.revealed, false);
  assert.equal(player(declined, f.tleilaxu).forces[f.location], 1);
  const done = finish(declined);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
  assert.deepEqual(inventory(done), f.originalInventory);
});

void test('a changed completed Face Dance parent rejects before another card, force or leader is consumed', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  pending.pendingAutomaticAdvisorFaceDance = { ...pending.pendingAutomaticAdvisorFaceDance!, amount: 8 };
  rejected(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.ok(player(pending, f.holder).hand.some(c => c.id === f.karama));
  assert.equal(player(pending, f.winner).leaders.find(l => l.id === f.winnerLeader)!.deaths, 1);
});

void test('all four existing profiles handle both Face Dance conversion causes legally', () => {
  for (const zeroReplacement of [false, true]) for (const profile of DIFFICULTIES) {
    const f = fixture({ zeroReplacement }), pending = commit(f.game, f).game, own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const actions = botActions(own); assert.ok(actions.length);
    const done = finish(allow(act(pending, f.holder, actions[0])));
    assert.equal(done.pendingAutomaticAdvisorFaceDance, undefined);
    assert.deepEqual(physical(done), physical(pending));
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});
