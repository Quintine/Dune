import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { createNativeEcazCohortFixture, createNativeEcazSecondCohortFixture } from './fixture-ecaz-revival-cohort';
import { assertNexusDukeCustody, nexusDukePlayer, stepNexusDuke } from './fixture-nexus-duke-capture';

void test('five original native deaths and a real repeat death leave the unreturned Ecaz cohort revivable', () => {
  const f = createNativeEcazCohortFixture();
  const owner = nexusDukePlayer(f.game, f.owner);
  const first = owner.leaders.find(l => l.id === f.first.leader)!;
  assert.equal(first.dead, true);
  assert.equal(first.deaths, 2);
  const remaining = owner.leaders.filter(l => l.id !== first.id);
  const options = viewGame(f.game, f.owner).revival.leaders;
  assert.deepEqual(options.map(l => l.id).sort(), remaining.map(l => l.id).sort());
  const next = remaining.slice().sort((a, b) => a.strength - b.strength)[0];
  const after = stepNexusDuke(f.game, f.plan, { actor: f.owner,
    action: { type: 'reviveLeader', leader: next.id } }, f.actions);
  const revived = nexusDukePlayer(after, f.owner);
  assert.equal(revived.leaders.find(l => l.id === next.id)!.dead, false);
  assert.equal(revived.leaders.find(l => l.id === first.id)!.dead, true);
  assert.equal(revived.spice, owner.spice - next.strength);
  assert.equal(revived.leaderRevived, true);
  assert.equal(revived.leaders.length, 5);
  assert.equal(after.dukeVidal!.leader.capturedBy, f.captor);
  assert.equal(after.dukeVidal!.leader.dead, false);
  assert.equal(after.dukeVidal!.leader.deaths, 0);
  assertNexusDukeCustody(after);
});

void test('a second original Ecaz cohort opens with four repeated native deaths and the same Duke in Tanks', () => {
  const f = createNativeEcazSecondCohortFixture();
  const owner = nexusDukePlayer(f.game, f.owner);
  const returned = f.deaths.map(d => d.leader);
  const options = viewGame(f.game, f.owner).revival.leaders.filter(l => l.id !== f.game.dukeVidal!.leader.id);
  assert.deepEqual(options.map(l => l.id).sort(), returned.slice().sort());
  assert.equal(owner.leaders.find(l => !returned.includes(l.id))!.deaths, 0);
  assert.equal(owner.leaders.find(l => !returned.includes(l.id))!.dead, false);
  assert.ok(returned.every(id => owner.leaders.find(l => l.id === id)!.deaths === 2));
  const selected = owner.leaders.find(l => l.id === returned[0])!;
  const after = stepNexusDuke(f.game, f.plan, { actor: f.owner,
    action: { type: 'reviveLeader', leader: selected.id } }, f.actions);
  assert.equal(nexusDukePlayer(after, f.owner).leaders.find(l => l.id === selected.id)!.dead, false);
  assert.equal(nexusDukePlayer(after, f.owner).spice, owner.spice - selected.strength);
  assert.equal(nexusDukePlayer(after, f.owner).leaderRevived, true);
  assert.equal(after.dukeVidal!.leader.dead, true);
  assert.equal(after.dukeVidal!.leader.deaths, 1);
  assert.equal(after.dukeVidal!.controller, null);
  assertNexusDukeCustody(after);
});
