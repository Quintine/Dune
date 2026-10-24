import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { createDukeAmbassadorFixture, actDukeAmbassador as act,
  advanceDukeAmbassador as advance, dukeAmbassadorClean as clean } from './fixture-duke-ambassador';
import { createAmbassadorRevivalIncomeFixture, actAmbassadorRevivalIncome as incomeAct } from './fixture-ambassador-revival-income';
import { createControlledAmbassadorKhRepeatFixture } from './fixture-ambassador-repeat-leaders';

const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
/** Original public Basic source through the paid Guild arrival, then explicit
 * controlled death/cohort/alliance inputs. These are not earned repeated deaths
 * or a genuine original full-game history. All choices/continuations are real. */
function scenario({ copied = false, owner = 'harkonnen', deaths = 2, open = true,
  used = false, poor = false } = {}) {
  const f = createDukeAmbassadorFixture({ copied });
  let game = structuredClone(f.offer);
  const p = player(game, owner);
  if (owner !== f.owner) {
    player(game, f.owner).ally = owner; p.ally = f.owner;
  }
  p.revivalCycle = deaths - 1;
  p.leaderRevived = used;
  if (poor) p.spice = 0;
  for (const [index, leader] of p.leaders.entries()) {
    leader.dead = open || index === 0;
    leader.deaths = open || index === 0 ? deaths : 0;
    delete leader.usedAt;
  }
  if (owner === 'ecaz') p.ecazRevivalCohort = {
    cycle: deaths - 1, returned: deaths > 1 ? p.leaders.map(l => l.id) : [],
  };
  const event = game.pendingAmbassador!.event;
  game = act(game, f.owner, { type: 'decision', event, trigger: true, beneficiary: owner, choice: 'effect' });
  if (copied) game = act(game, owner, { type: 'decision', event, effect: 'tleilaxu' });
  assert.equal(game.pendingAmbassador?.stage, 'revival');
  return { f, game, owner, event, leader: p.leaders[0].id };
}
function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
const counters = (g: Game, id: string) => {
  const p = player(g, id);
  return { spice: p.spice, tanks: p.tanks, reserves: p.reserves, hand: p.hand,
    revived: p.revived, freeForcesRevived: p.freeForcesRevived, leaderRevived: p.leaderRevived };
};
const revive = (s: ReturnType<typeof scenario>, leader = s.leader) =>
  act(s.game, s.owner, { type: 'decision', event: s.event, leader });

void test('a controlled all-first-dead Ambassador return preserves the newly opened ordinary cohort', () => {
  const s = scenario({ deaths: 1 });
  const done = revive(s);
  assert.equal(player(done, s.owner).revivalCycle, 1);
  assert.equal(player(done, s.owner).leaders.find(l => l.id === s.leader)!.dead, false);
  const ordinary = advance(done, g => g.turn === 3 && g.phase === 4 && clean(g));
  assert.equal(viewGame(ordinary, s.owner).revival.leaders.length, 4);
});

for (const copied of [false, true]) void test(`controlled ${copied ? 'copied' : 'native'} Ambassador returns an eligible repeated leader and retains the next ordinary return`, () => {
  const s = scenario({ copied, used: true }), before = structuredClone(s.game);
  assert.ok(viewGame(s.game, s.owner).ambassadorEntry!.revival!.leaders.some(l => l.id === s.leader));
  const done = revive(s), returned = player(done, s.owner).leaders.find(l => l.id === s.leader)!;
  assert.equal(returned.dead, false); assert.equal(returned.deaths, 2); assert.equal(returned.usedAt, undefined);
  assert.equal(player(done, s.owner).revivalCycle, 2);
  assert.deepEqual(counters(done, s.owner), counters(before, s.owner));
  assert.equal(done.pendingAmbassador, null); assert.equal(done.active, s.f.entrant);
  reject(done, s.owner, { type: 'decision', event: s.event, leader: s.leader });
  let ordinary = advance(done, g => g.turn === 3 && g.phase === 4 && clean(g));
  const choices = viewGame(ordinary, s.owner).revival.leaders;
  assert.equal(choices.length, 4);
  const choice = choices.find(l => l.affordable); assert.ok(choice);
  const balance = player(ordinary, s.owner).spice;
  ordinary = act(ordinary, s.owner, { type: 'reviveLeader', leader: choice.id });
  assert.equal(player(ordinary, s.owner).leaders.find(l => l.id === choice.id)!.dead, false);
  assert.equal(player(ordinary, s.owner).spice, balance - choice.cost);
  assert.equal(player(ordinary, s.owner).leaderRevived, true);
});

void test('a controlled closed repeated cohort stays unavailable while a closed first-death leader retains the independent grant', () => {
  const blocked = scenario({ open: false });
  assert.equal(viewGame(blocked.game, blocked.owner).ambassadorEntry!.revival!.leaders.some(l => l.id === blocked.leader), false);
  reject(blocked.game, blocked.owner, { type: 'decision', event: blocked.event, leader: blocked.leader });
  const first = scenario({ open: false, deaths: 1, used: true, poor: true });
  const before = counters(first.game, first.owner), done = revive(first);
  assert.equal(player(done, first.owner).revivalCycle, 0, 'An independent first death must not open a closed cohort');
  assert.deepEqual(counters(done, first.owner), before);
});

void test('a controlled Ecaz repeated Ambassador return records the native identity before clearing death', () => {
  const s = scenario({ owner: 'ecaz' }), before = counters(s.game, s.owner);
  assert.ok(viewGame(s.game, s.owner).ambassadorEntry!.revival!.leaders.some(l => l.id === s.leader));
  const done = revive(s), p = player(done, s.owner);
  assert.equal(p.leaders.find(l => l.id === s.leader)!.deaths, 2);
  assert.equal(p.revivalCycle, 2);
  assert.deepEqual(p.ecazRevivalCohort, { cycle: 2, returned: [s.leader] });
  assert.deepEqual(counters(done, s.owner), before);
  assert.equal(p.leaders.length, 5);
  const ordinary = advance(done, g => g.turn === 3 && g.phase === 4 && clean(g));
  assert.equal(viewGame(ordinary, s.owner).revival.leaders.filter(l => l.id !== 'duke-vidal').length, 4);
});

void test('controlled repeated choices preserve event ownership, exclusive alternatives and zero price', () => {
  const s = scenario({ used: true, poor: true });
  reject(s.game, s.owner, { type: 'decision', event: 'expired', leader: s.leader });
  reject(s.game, s.f.entrant, { type: 'decision', event: s.event, leader: s.leader });
  reject(s.game, s.owner, { type: 'decision', event: s.event, leader: s.leader, forces: 1 });
  const done = revive(s);
  assert.equal(player(done, s.owner).leaders.find(l => l.id === s.leader)!.dead, false);
  assert.equal(player(done, s.owner).spice, 0);
  assert.equal(player(done, s.owner).leaderRevived, true);
});

void test('all four existing profiles select a legal repeated return when every beneficiary option is repeated', () => {
  for (const copied of [false, true]) {
    const s = scenario({ copied });
    // Controlled physical reallocation isolates the new leader alternative;
    // ordinary policy prefers a force return whenever one remains available.
    const p = player(s.game, s.owner); p.reserves += p.tanks; p.tanks = 0;
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(s.game, s.owner); view.players.find(p => p.id === s.owner)!.bot = difficulty;
      const action = botActions(view)[0]; assert.equal(action.type, 'decision'); assert.ok(action.leader);
      const done = act(s.game, s.owner, action);
      assert.equal(player(done, s.owner).leaders.find(l => l.id === action.leader)!.dead, false);
      assert.equal(player(done, s.owner).leaders.find(l => l.id === action.leader)!.deaths, 2);
      assert.equal(done.pendingAmbassador, null); assert.equal(done.active, s.f.entrant);
    }
  }
});

void test('controlled repeated returns retain their original death receipt through native and copied income allowance or cancellation', () => {
  for (const copied of [false, true]) {
    const f = createAmbassadorRevivalIncomeFixture({ copied }), source = structuredClone(f.game);
    const p = player(source, f.owner);
    for (const leader of p.leaders) { leader.dead = true; leader.deaths = 2; }
    p.revivalCycle = 1; p.ecazRevivalCohort = { cycle: 1, returned: p.leaders.map(l => l.id) };
    p.leaderRevived = true;
    const leader = p.leaders[0].id, bankIncome = player(source, f.incomeOwner).spice;
    const earned = incomeAct(source, f.owner, { type: 'decision', event: f.event, leader });
    assert.deepEqual(earned.pendingAmbassador!.revivalReceipt!.returned, { kind: 'leader', leader, deaths: 2 });
    assert.equal(earned.response?.source, 'ambassadorRevival');
    for (const canceled of [false, true]) {
      let done = earned;
      if (canceled) done = incomeAct(done, f.cancelActor, { type: 'card', card: f.cancelCard, mode: 'cancel' });
      while (done.response) done = incomeAct(done,
        done.players.find(p => !done.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
      assert.equal(done.pendingAmbassador, null);
      assert.equal(player(done, f.owner).leaders.find(l => l.id === leader)!.dead, false);
      assert.equal(player(done, f.owner).leaders.find(l => l.id === leader)!.deaths, 2);
      assert.equal(player(done, f.owner).revivalCycle, 2);
      assert.equal(player(done, f.owner).leaderRevived, true);
      assert.equal(player(done, f.incomeOwner).spice, bankIncome + (canceled ? 0 : 1));
      done = incomeAct(done, f.entrantContinuation.actor, f.entrantContinuation.action);
      assert.equal(done.movementRemaining?.includes(f.entrant) ?? false, false);
    }
  }
});

void test('a controlled repeated KH return advances past the actual newly opened cohort rather than its stale owner marker', () => {
  const { game, event } = createControlledAmbassadorKhRepeatFixture(), before = counters(game, 'atreides');
  assert.ok(viewGame(game, 'atreides').ambassadorEntry!.revival!.leaders.some(l => l.id === 'kwisatz'));
  const done = act(game, 'atreides', { type: 'decision', event, leader: 'kwisatz' });
  const p = player(done, 'atreides');
  assert.equal(p.revivalCycle, 3); assert.equal(p.kwisatz!.revivalCycle, 4);
  assert.equal(p.kwisatz!.dead, false); assert.equal(p.kwisatz!.usedAt, undefined);
  assert.equal(p.battleLosses, 10); assert.equal(p.leaders.length, 5);
  assert.ok(p.leaders.every(l => l.dead && l.deaths === 3));
  assert.deepEqual(counters(done, 'atreides'), before);
  assert.equal(done.pendingAmbassador, null); assert.equal(done.active, 'guild');
  const blocked = createControlledAmbassadorKhRepeatFixture(4);
  assert.equal(viewGame(blocked.game, 'atreides').ambassadorEntry!.revival!.leaders.some(l => l.id === 'kwisatz'), false);
  reject(blocked.game, 'atreides', { type: 'decision', event: blocked.event, leader: 'kwisatz' });
});

void test('all existing profiles use the controlled repeated KH alternative without adding a native leader or ordinary slot', () => {
  const { game } = createControlledAmbassadorKhRepeatFixture(2, true);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, 'atreides'); view.players.find(p => p.id === 'atreides')!.bot = difficulty;
    const action = botActions(view)[0]; assert.equal(action.leader, 'kwisatz');
    const done = act(game, 'atreides', action), p = player(done, 'atreides');
    assert.equal(p.kwisatz!.revivalCycle, 4); assert.equal(p.leaders.length, 5);
    assert.equal(p.leaderRevived, true); assert.equal(p.battleLosses, 10);
  }
});
