import assert from 'node:assert/strict';
import test from 'node:test';
import { dukeController } from '../game/duke-vidal';
import { viewGame } from '../game/engine';
import {
  assassinateAfterCapturedDukeUse, cancelMoritaniDukeReclaim,
  createMoritaniDukeCaptureFixture, reclaimMoritaniDuke, useMoritaniReclaimedDuke,
} from './fixture-moritani-duke-capture';
import { nextNexusDukeStep, nexusDukePlayer, stepNexusDuke } from './fixture-nexus-duke-capture';

void test('original Moritani qualification takes its real Harkonnen captive and releases after one native battle', () => {
  const f = createMoritaniDukeCaptureFixture();
  assert.equal(dukeController(f.game.dukeVidal!), f.captor);
  const reclaimed = reclaimMoritaniDuke(f);
  const duke = reclaimed.after.dukeVidal!;
  assert.equal(dukeController(duke), f.owner);
  assert.equal(duke.leader.capturedBy, undefined);
  assert.equal(duke.leader.concealed, undefined);
  assert.equal(duke.captureVisibility, undefined);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, f.game.dukeVidal!.leader.deaths);
  assert.equal(duke.source, 'moritani');
  assert.equal(nexusDukePlayer(reclaimed.after, f.owner).spice, nexusDukePlayer(reclaimed.before, f.owner).spice);
  const used = useMoritaniReclaimedDuke(reclaimed.after, f);
  assert.equal(dukeController(used.dukeVidal!), null);
  assert.equal(used.dukeVidal!.leader.dead, false);
  assert.equal(used.dukeVidal!.leader.usedAt, 'carthag');
  assert.equal(used.dukeVidal!.leader.capturedBy, undefined);
});

void test('unused original Moritani reclamation expires without restoring Harkonnen custody', () => {
  const f = createMoritaniDukeCaptureFixture();
  const reclaimed = reclaimMoritaniDuke(f);
  const expired = useMoritaniReclaimedDuke(reclaimed.after, f, false);
  assert.equal(dukeController(expired.dukeVidal!), null);
  assert.equal(expired.dukeVidal!.leader.dead, false);
  assert.equal(expired.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(expired.dukeVidal!.leader.deaths, f.game.dukeVidal!.leader.deaths);
});

void test('a qualified public acquisition cannot revive an actually executed captive Duke', () => {
  const f = createMoritaniDukeCaptureFixture({ execute: true });
  assert.equal(f.game.dukeVidal!.leader.dead, true);
  const resolved = reclaimMoritaniDuke(f);
  assert.equal(dukeController(resolved.after.dukeVidal!), null);
  assert.equal(resolved.after.dukeVidal!.leader.dead, true);
  assert.equal(resolved.after.dukeVidal!.leader.deaths, 2);
  assert.equal(resolved.after.dukeVidal!.leader.concealed, undefined);
  assert.equal(nexusDukePlayer(resolved.after, f.owner).spice, nexusDukePlayer(resolved.before, f.owner).spice);
});

void test('original Karama preserves the captive and its actual winning use still opens native Harkonnen Assassinate', () => {
  const f = createMoritaniDukeCaptureFixture({ karama: true });
  const karama = nexusDukePlayer(f.game, f.captor).hand.find(c => c.effect === 'karama')!;
  const canceled = cancelMoritaniDukeReclaim(f);
  assert.equal(dukeController(canceled.after.dukeVidal!), f.captor);
  assert.deepEqual(canceled.after.dukeVidal, canceled.before.dukeVidal);
  assert.ok(canceled.after.discard.some(c => c.id === karama.id));
  const used = assassinateAfterCapturedDukeUse(canceled.after, f);
  assert.equal(dukeController(used.window.dukeVidal!), null);
  assert.equal(used.window.dukeVidal!.leader.dead, false);
  const targetBefore = nexusDukePlayer(used.window, f.captor).leaders.find(l => l.id === f.target)!;
  const targetAfter = nexusDukePlayer(used.after, f.captor).leaders.find(l => l.id === f.target)!;
  assert.equal(targetAfter.dead, true);
  assert.equal(targetAfter.deaths, targetBefore.deaths + 1);
  assert.equal(nexusDukePlayer(used.after, f.owner).spice,
    nexusDukePlayer(used.window, f.owner).spice + targetBefore.strength);
  assert.equal(nexusDukePlayer(used.after, f.owner).traitors.includes(f.target), true);
  assert.equal(nexusDukePlayer(used.replaced, f.owner).traitors.includes(f.target), false);
  assert.equal(used.replaced.moritaniAssassinate!.opportunities.filter(r =>
    r.card === f.target && r.stage === 'replaced').length, 1);
});

void test('a private execution does not remove or identify the public qualifying acquisition window', () => {
  const living = createMoritaniDukeCaptureFixture({ karama: true });
  const executed = createMoritaniDukeCaptureFixture({ karama: true, execute: true });
  const open = (f: typeof living) => {
    const next = nextNexusDukeStep(f.game, f.plan);
    assert.ok(next);
    return stepNexusDuke(f.game, f.plan, next, f.actions);
  };
  const livePending = open(living), deadPending = open(executed);
  assert.equal(livePending.response?.kind, 'moritaniDuke');
  assert.equal(deadPending.response?.kind, 'moritaniDuke');
  const livePublic = viewGame(livePending, living.guild);
  const deadPublic = viewGame(deadPending, executed.guild);
  assert.deepEqual(deadPublic.response, livePublic.response);
  assert.deepEqual(deadPublic.dukeVidal, livePublic.dukeVidal);
  assert.equal(deadPending.dukeVidal!.leader.dead, true);
});
