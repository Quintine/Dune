import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame } from '../game/engine';
import { createDukeVidal } from '../game/duke-vidal';
import { newRevivalRules } from '../game/revival';
import { baseDeck } from '../game/cards';

function boundary() {
  const g = createGame('ECAZCOHORT', newPlayer('e', 'Ecaz', 'ecaz'), false, ['ecaz']);
  g.players.push(newPlayer('m', 'Moritani', 'moritani'));
  Object.assign(g, { status: 'playing', phase: 4, turn: 3, order: ['e', 'm'],
    dukeVidal: createDukeVidal(), revivalRules: newRevivalRules() });
  g.players[0].spice = 20;
  return g;
}
function dealGhola(g: ReturnType<typeof boundary>) {
  g.deck = baseDeck();
  const index = g.deck.findIndex(card => card.effect === 'ghola');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  g.players[0].hand.push(card);
  return card;
}

void test('an Ecaz repeat death does not suppress other native first-cohort returns', () => {
  const g = boundary();
  const owner = g.players[0];
  owner.spice = 20;
  owner.revivalCycle = 1;
  for (const leader of owner.leaders) { leader.dead = true; leader.deaths = 1; }
  owner.leaders[0].deaths = 2;
  const options = viewGame(g, owner.id).revival.leaders;
  assert.deepEqual(options.map(l => l.id).sort(), owner.leaders.slice(1).map(l => l.id).sort());
  const selected = owner.leaders[1];
  const after = applyAction(g, owner.id, { type: 'reviveLeader', leader: selected.id });
  assert.equal(after.players[0].leaders.find(l => l.id === selected.id)!.dead, false);
  assert.equal(after.players[0].leaders[0].dead, true);
  assert.equal(after.players[0].spice, owner.spice - selected.strength);
  assert.equal(after.players[0].leaderRevived, true);
  assert.equal(after.players[0].leaders.length, 5);
  assert.equal(after.dukeVidal!.leader.dead, false);
});

void test('a late first death joins an open later cohort without matching its generation number', () => {
  const g = boundary(), owner = g.players[0];
  owner.revivalCycle = 3;
  owner.ecazRevivalCohort = { cycle: 3, returned: owner.leaders.slice(0, 4).map(l => l.id) };
  for (const leader of owner.leaders.slice(0, 4)) { leader.dead = true; leader.deaths = 4; }
  const late = owner.leaders[4];
  late.dead = true;
  late.deaths = 1;
  const options = viewGame(g, owner.id).revival.leaders;
  assert.deepEqual(options.map(l => l.id), [late.id]);
  const after = applyAction(g, owner.id, { type: 'reviveLeader', leader: late.id });
  assert.equal(after.players[0].leaders.find(l => l.id === late.id)!.dead, false);
  assert.equal(after.players[0].spice, owner.spice - late.strength);
  assert.equal(after.players[0].leaders.filter(l => l.dead).length, 4);
});

void test('an actual native Ghola return spends no ordinary slot but cannot re-enter the same cohort after dying again', () => {
  const g = boundary(), owner = g.players[0];
  for (const leader of owner.leaders) { leader.dead = true; leader.deaths = 1; }
  const card = dealGhola(g), first = owner.leaders[0];
  const returned = applyAction(g, owner.id, { type: 'card', card: card.id, leader: first.id });
  assert.equal(returned.players[0].spice, owner.spice);
  assert.equal(returned.players[0].leaderRevived, false);
  const repeated = returned.players[0].leaders[0];
  repeated.dead = true;
  repeated.deaths++;
  const next = viewGame(returned, owner.id).revival.leaders;
  assert.deepEqual(next.map(l => l.id).sort(), owner.leaders.slice(1).map(l => l.id).sort());
  const second = owner.leaders[1];
  const after = applyAction(returned, owner.id, { type: 'reviveLeader', leader: second.id });
  assert.equal(after.players[0].leaders.find(l => l.id === second.id)!.dead, false);
  assert.equal(after.players[0].leaders[0].dead, true);
  assert.equal(after.players[0].spice, owner.spice - second.strength);
});

void test('an independent Duke Ghola preserves a real five-Tanks opening without aligning its repeated deaths', () => {
  const g = boundary(), owner = g.players[0];
  for (const leader of owner.leaders.slice(0, 4)) { leader.dead = true; leader.deaths = 1; }
  g.dukeVidal!.leader.dead = true;
  g.dukeVidal!.leader.deaths = 7;
  const card = dealGhola(g);
  const returned = applyAction(g, owner.id, { type: 'card', card: card.id, leader: g.dukeVidal!.leader.id });
  assert.equal(returned.dukeVidal!.leader.dead, false);
  assert.equal(returned.dukeVidal!.leader.deaths, 7);
  assert.equal(returned.dukeVidal!.controller, null);
  assert.equal(returned.players[0].leaderRevived, false);
  assert.equal(returned.players[0].spice, owner.spice);
  const options = viewGame(returned, owner.id).revival.leaders;
  assert.deepEqual(options.map(l => l.id).sort(), owner.leaders.slice(0, 4).map(l => l.id).sort());
  const native = owner.leaders[0];
  const after = applyAction(returned, owner.id, { type: 'reviveLeader', leader: native.id });
  assert.equal(after.players[0].leaders[0].dead, false);
  assert.equal(after.players[0].spice, owner.spice - native.strength);
  assert.equal(after.dukeVidal!.leader.deaths, 7);
});
