import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { newRevivalRules } from '../game/revival';

function fixture(faction: FactionId = 'atreides', service = false): Game {
  const g = createGame(
    'REVIVALBOT',
    newPlayer('p', 'Returning', faction),
    true,
  );
  g.players.push(newPlayer('other', 'Other', service ? 'tleilaxu' : 'emperor'));
  g.status = 'playing';
  g.phase = 4;
  g.turn = 3;
  g.order = g.players.map((p) => p.id);
  g.revivalRules = newRevivalRules();
  g.revivalRequests = {};
  const p = g.players[0];
  p.spice = 30;
  p.revivalCycle = 1;
  for (const leader of p.leaders) {
    leader.dead = true;
    leader.deaths = 1;
  }
  return g;
}
function actionsFor(g: Game, difficulty: (typeof DIFFICULTIES)[number]) {
  const state = structuredClone(g);
  state.players[0].bot = difficulty;
  return botActions(viewGame(state, 'p'));
}
const leaderActions = (actions: Action[]) =>
  actions.filter((action) => action.type === 'reviveLeader');
function checkLegal(g: Game, actions: Action[]) {
  for (const action of actions)
    assert.doesNotThrow(() => applyAction(g, 'p', action));
}

void test('all four profiles continue an opened normal cycle with a returned living leader', () => {
  let g = fixture();
  const first = g.players[0].leaders[0];
  g = applyAction(g, 'p', { type: 'reviveLeader', leader: first.id });
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].revivalCycle, 1);
  // The next Revival phase restores the ordinary one-leader allowance.
  g.turn++;
  g.players[0].leaderRevived = false;
  g = JSON.parse(JSON.stringify(g));
  const expected = g.players[0].leaders.filter((l) => l.dead).map((l) => l.id);
  for (const difficulty of DIFFICULTIES) {
    const actions = leaderActions(actionsFor(g, difficulty));
    assert.deepEqual(
      actions.map((a) => a.leader),
      expected,
      difficulty,
    );
    checkLegal(g, actions);
  }
});

void test('all profiles exclude wrong-cycle, captured and ghola targets despite other eligible deaths', () => {
  const g = fixture();
  const p = g.players[0];
  p.leaders[0].dead = false;
  p.leaders[1].deaths = 2;
  p.leaders[2].capturedBy = 'other';
  p.leaders[3].gholaBy = 'other';
  for (const difficulty of DIFFICULTIES) {
    const actions = leaderActions(actionsFor(g, difficulty));
    assert.deepEqual(
      actions.map((a) => a.leader),
      [p.leaders[4].id],
      difficulty,
    );
    checkLegal(g, actions);
  }
});

void test('all profiles stop ordinary leader and Kwisatz revival after the slot is used', () => {
  const g = fixture();
  g.players[0].leaderRevived = true;
  g.players[0].kwisatz = { dead: true, revivalCycle: 1 };
  for (const difficulty of DIFFICULTIES) {
    const actions = actionsFor(g, difficulty);
    assert.deepEqual(leaderActions(actions), [], difficulty);
    assert.equal(
      actions.some((a) => a.type === 'reviveKwisatz'),
      false,
      difficulty,
    );
  }
});

void test('all profiles respect projected prices and avoid unaffordable normal revivals', () => {
  const g = fixture();
  g.players[0].spice = 2;
  const expected = g.players[0].leaders
    .filter((l) => l.strength <= 2)
    .map((l) => l.id);
  assert.ok(expected.length > 0);
  for (const difficulty of DIFFICULTIES) {
    const actions = leaderActions(actionsFor(g, difficulty));
    assert.deepEqual(
      actions.map((a) => a.leader),
      expected,
      difficulty,
    );
    checkLegal(g, actions);
    const poor = structuredClone(g);
    poor.players[0].spice = 0;
    assert.deepEqual(
      leaderActions(actionsFor(poor, difficulty)),
      [],
      difficulty,
    );
  }
});

void test('Kwisatz candidates require projected cycle eligibility and affordable cost for every profile', () => {
  const g = fixture();
  g.players[0].kwisatz = { dead: true, revivalCycle: 1 };
  g.players[0].spice = 2;
  for (const difficulty of DIFFICULTIES) {
    const candidates = actionsFor(g, difficulty).filter(
      (a) => a.type === 'reviveKwisatz',
    );
    assert.equal(candidates.length, 1, difficulty);
    checkLegal(g, candidates);
    for (const blocked of ['cost', 'cycle', 'living'] as const) {
      const state = structuredClone(g);
      if (blocked === 'cost') state.players[0].spice = 1;
      if (blocked === 'cycle') state.players[0].kwisatz!.revivalCycle = 2;
      if (blocked === 'living') state.players[0].kwisatz!.dead = false;
      assert.equal(
        actionsFor(state, difficulty).some((a) => a.type === 'reviveKwisatz'),
        false,
        `${difficulty}: ${blocked}`,
      );
    }
  }
});

void test('ordinary projected targets suppress unnecessary new native early-service requests', () => {
  const g = fixture('atreides', true);
  g.players[0].leaders[0].dead = false;
  g.players[0].leaders[1].dead = false;
  for (const difficulty of DIFFICULTIES) {
    const actions = actionsFor(g, difficulty);
    assert.ok(leaderActions(actions).length > 0, difficulty);
    assert.equal(
      actions.some((a) => a.type === 'requestLeaderRevival'),
      false,
      difficulty,
    );
    checkLegal(g, leaderActions(actions));
  }
});

void test('normal options preserve foreign-ghola buyback and existing negotiated quotes', () => {
  const g = fixture('atreides', true);
  g.players[0].leaders[0].dead = false;
  g.players[0].leaders[1].gholaBy = 'other';
  const target = g.players[0].leaders[1].id;
  for (const difficulty of DIFFICULTIES) {
    const requests = actionsFor(g, difficulty).filter(
      (a) => a.type === 'requestLeaderRevival',
    );
    assert.deepEqual(
      requests,
      [{ type: 'requestLeaderRevival', leader: target }],
      difficulty,
    );
    checkLegal(g, requests);
    const quoted = structuredClone(g);
    quoted.revivalRequests!.p = { leader: target, price: 2 };
    const accepts = actionsFor(quoted, difficulty).filter(
      (a) => a.type === 'acceptLeaderRevival',
    );
    assert.equal(accepts.length, 1, difficulty);
    checkLegal(quoted, accepts);
  }
});

void test('legitimate unopened-cycle requests and self-Tleilaxu early options remain available', () => {
  const g = fixture('atreides', true);
  g.players[0].leaders[0].dead = false;
  g.players[0].revivalCycle = 0;
  const tleilaxu = fixture('tleilaxu');
  tleilaxu.players[0].leaders[0].dead = false;
  tleilaxu.players[0].revivalCycle = 0;
  tleilaxu.players[0].leaderRevived = true;
  tleilaxu.revivalRules!.earlyBlocked.push(
    `p:${tleilaxu.players[0].leaders[1].id}`,
  );
  for (const difficulty of DIFFICULTIES) {
    const requests = actionsFor(g, difficulty).filter(
      (a) => a.type === 'requestLeaderRevival',
    );
    assert.equal(requests.length, 1, difficulty);
    checkLegal(g, requests);
    const early = leaderActions(actionsFor(tleilaxu, difficulty));
    assert.deepEqual(
      early.map((a) => a.leader),
      tleilaxu.players[0].leaders.slice(2).map((l) => l.id),
      difficulty,
    );
    checkLegal(tleilaxu, early);
  }
});
