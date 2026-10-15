import assert from 'node:assert/strict';
import test from 'node:test';
import { DUKE_VIDAL_ID, dukeController } from '../game/duke-vidal';
import { createMoritaniDukeCaptureFixture, revealMoritaniTerrorVictim } from './fixture-moritani-duke-capture';
import { advanceNexusDuke, nexusDukeClean, nexusDukePlayer } from './fixture-nexus-duke-capture';

void test('the actual native Terror lottery kills the entrant’s captured Duke once and resumes its paid shipment', () => {
  const f = createMoritaniDukeCaptureFixture({ terror: true });
  assert.equal(f.game.pendingTerrorEntry!.entrant, f.captor);
  assert.equal(f.game.dukeVidal!.leader.capturedBy, f.captor);
  const revealed = revealMoritaniTerrorVictim(f, DUKE_VIDAL_ID);
  assert.equal(revealed.after.dukeVidal!.leader.dead, true);
  assert.equal(revealed.after.dukeVidal!.leader.deaths, revealed.before.dukeVidal!.leader.deaths + 1);
  assert.equal(dukeController(revealed.after.dukeVidal!), null);
  assert.equal(revealed.after.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(revealed.after.dukeVidal!.leader.concealed, undefined);
  assert.equal(revealed.after.dukeVidal!.captureVisibility, undefined);
  assert.equal(nexusDukePlayer(revealed.after, f.owner).spice,
    nexusDukePlayer(revealed.before, f.owner).spice + 6);
  assert.ok(nexusDukePlayer(revealed.after, f.captor).leaders.every(l => !l.dead));
  assert.equal(nexusDukePlayer(revealed.after, f.captor).forces['tueks_sietch:5'], 1);
  assert.equal(revealed.after.moritaniTerror!.tokens.find(t => t.id === f.terrorToken)!.status, 'removed');
  assert.ok(!revealed.after.pendingTerrorEntry);
  const settled = advanceNexusDuke(revealed.after,
    g => g.phase === 6 && nexusDukeClean(g), f.plan, f.actions);
  assert.equal(settled.dukeVidal!.leader.dead, true);
  assert.equal(dukeController(settled.dukeVidal!), null);
});

void test('an explicit empty-pool checkpoint spends the original revealed token with no death or bounty', () => {
  const f = createMoritaniDukeCaptureFixture({ terror: true, terrorEntrant: 'guild' });
  assert.equal(f.game.pendingTerrorEntry!.entrant, f.guild);
  // Controlled boundary: the original arrival/token are genuine; only the
  // entrant's preceding native-death history is staged for this empty edge.
  for (const leader of nexusDukePlayer(f.game, f.guild).leaders) {
    leader.dead = true;
    leader.deaths = 1;
  }
  const before = structuredClone(nexusDukePlayer(f.game, f.guild).leaders);
  const revealed = revealMoritaniTerrorVictim(f);
  assert.deepEqual(nexusDukePlayer(revealed.after, f.guild).leaders, before);
  assert.equal(nexusDukePlayer(revealed.after, f.owner).spice,
    nexusDukePlayer(revealed.before, f.owner).spice);
  assert.equal(revealed.after.moritaniTerror!.tokens.find(t => t.id === f.terrorToken)!.status, 'removed');
  assert.equal(nexusDukePlayer(revealed.after, f.guild).forces['arrakeen:10'], 1);
  assert.ok(!revealed.after.pendingTerrorEntry);
  assert.equal(revealed.after.active, f.guild);
});
