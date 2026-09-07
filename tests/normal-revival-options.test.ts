import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame } from '../game/engine';
import { leaders } from '../game/cards';
import { leaderRevivalOptions, newRevivalRules } from '../game/revival';
import { createDukeVidal } from '../game/duke-vidal';

function fixture() {
  const g = createGame('REVOPTIONS', newPlayer('a', 'Atreides', 'atreides'));
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.status = 'playing';
  g.phase = 4;
  g.revivalRules = newRevivalRules();
  g.order = ['a', 'h'];
  for (const p of g.players) {
    p.spice = 20;
    p.leaders = leaders(p.faction);
  }
  for (const l of g.players[0].leaders) {
    l.dead = true;
    l.deaths = 1;
  }
  return g;
}

void test('normal revival projection opens without mutating state and exposes only viewer options', () => {
  const g = fixture();
  const before = structuredClone(g);
  assert.equal(viewGame(g, 'a').revival.leaders.length, 5);
  assert.deepEqual(viewGame(g, 'h').revival.leaders, []);
  assert.deepEqual(g, before);
  const leader = viewGame(g, 'a').revival.leaders[0];
  const next = applyAction(g, 'a', { type: 'reviveLeader', leader: leader.id });
  assert.equal(next.players[0].spice, 20 - leader.cost);
  assert.equal(next.players[0].revivalCycle, 1);
  assert.deepEqual(viewGame(next, 'a').revival.leaders, []);
});

void test('opened cycle continues in later phases with a living returned leader', () => {
  let g = fixture();
  g = applyAction(g, 'a', {
    type: 'reviveLeader',
    leader: g.players[0].leaders[0].id,
  });
  g.turn += 1;
  g.players[0].leaderRevived = false;
  const options = viewGame(JSON.parse(JSON.stringify(g)), 'a').revival.leaders;
  assert.equal(options.length, 4);
  for (const option of options) {
    const next = applyAction(g, 'a', {
      type: 'reviveLeader',
      leader: option.id,
    });
    assert.equal(
      next.players[0].leaders.find((l) => l.id === option.id)?.dead,
      false,
    );
  }
});

void test('face-down second deaths, captured discs and foreign gholas are not ordinary targets', () => {
  const g = fixture();
  const p = g.players[0];
  p.revivalCycle = 1;
  p.leaders[0].dead = false;
  p.leaders[1].deaths = 2;
  p.leaders[2].capturedBy = 'h';
  p.leaders[3].gholaBy = 'h';
  const options = viewGame(g, 'a').revival.leaders;
  assert.deepEqual(
    options.map((l) => l.id),
    [p.leaders[4].id],
  );
  for (const l of p.leaders.slice(1, 4))
    assert.throws(() =>
      applyAction(g, 'a', { type: 'reviveLeader', leader: l.id }),
    );
});

void test('capture absence can open the ordinary cycle without exposing the captor identity', () => {
  const g = fixture();
  g.players[0].leaders[0].dead = false;
  g.players[0].leaders[0].capturedBy = 'h';
  const options = viewGame(g, 'a').revival.leaders;
  assert.equal(options.length, 4);
  assert.ok(options.every((o) => !('capturedBy' in o)));
  assert.doesNotThrow(() =>
    applyAction(g, 'a', { type: 'reviveLeader', leader: options[0].id }),
  );
});

void test('quotes show affordability and current ally discount without changing revival permission', () => {
  const g = fixture();
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.players[0].ally = 't';
  g.players[2].ally = 'a';
  g.revivalRules!.allyDiscount = 'a';
  g.players[0].spice = 0;
  for (const o of viewGame(g, 'a').revival.leaders) {
    assert.equal(o.cost, Math.ceil(o.normalCost / 2));
    assert.equal(o.affordable, false);
    assert.throws(() =>
      applyAction(g, 'a', { type: 'reviveLeader', leader: o.id }),
    );
  }
  g.revivalRules!.discountBlocked = true;
  assert.ok(
    viewGame(g, 'a').revival.leaders.every((o) => o.cost === o.normalCost),
  );
});

void test('Tleilaxu self early revival honors canceled targets while ordinary eligible targets remain usable', () => {
  const g = fixture();
  const p = g.players[0];
  p.faction = 'tleilaxu';
  p.leaders = leaders('tleilaxu');
  p.leaders[0].dead = true;
  p.leaders[0].deaths = 1;
  assert.equal(leaderRevivalOptions(g, p).leaders[0].early, true);
  p.leaderRevived = true;
  assert.equal(leaderRevivalOptions(g, p).leaders.length, 1);
  g.revivalRules!.earlyBlocked.push(`${p.id}:${p.leaders[0].id}`);
  assert.deepEqual(leaderRevivalOptions(g, p).leaders, []);
  p.leaderRevived = false;
  for (const l of p.leaders) {
    l.dead = true;
    l.deaths = 1;
  }
  assert.equal(leaderRevivalOptions(g, p).leaders.length, 5);
  assert.ok(leaderRevivalOptions(g, p).leaders.every((o) => !o.early));
});

void test('prevention and phase changes remove options including Kwisatz', () => {
  const g = fixture();
  g.advanced = true;
  g.players[0].kwisatz = { dead: true, revivalCycle: 1 };
  assert.equal(viewGame(g, 'a').revival.kwisatz?.cost, 2);
  g.revivalPrevention = { turn: g.turn, player: 'a' };
  assert.deepEqual(viewGame(g, 'a').revival.leaders, []);
  assert.equal(viewGame(g, 'a').revival.kwisatz, null);
  delete g.revivalPrevention;
  g.phase = 5;
  assert.deepEqual(viewGame(g, 'a').revival.leaders, []);
  assert.equal(viewGame(g, 'a').revival.kwisatz, null);
});

void test('shared Duke does not enter native revival projection or inventory', () => {
  const g = fixture();
  g.dukeVidal = createDukeVidal();
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths = 1;
  assert.equal(viewGame(g, 'a').revival.leaders.length, 5);
  assert.ok(
    viewGame(g, 'a').revival.leaders.every((l) => l.id !== 'duke-vidal'),
  );
  assert.equal(g.players[0].leaders.length, 5);
});
