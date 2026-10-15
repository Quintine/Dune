import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireDuke, captureDuke, consumeDuke, createDukeVidal, dukeController, expireDuke } from '../game/duke-vidal';

void test('Moritani takes the actual living captive without restoring the captor after its tenure', () => {
  const initial = acquireDuke(createDukeVidal(), 'm', 1, 'moritani');
  initial.leader.deaths = 2;
  const captive = captureDuke(initial, 'h', 'm', 1, 'arrakeen');
  const before = structuredClone(captive);
  const taken = acquireDuke(captive, 'm', 2, 'moritani');
  assert.deepEqual(captive, before);
  assert.equal(dukeController(taken), 'm');
  assert.equal(taken.source, 'moritani');
  assert.equal(taken.leader.capturedBy, undefined);
  assert.equal(taken.leader.concealed, undefined);
  assert.equal(taken.captureVisibility, undefined);
  assert.equal(taken.leader.dead, false);
  assert.equal(taken.leader.deaths, 2);
  assert.equal(taken.leader.faction, 'ecaz');
  assert.equal(taken.leader.strength, 6);
  const unused = expireDuke(taken, 2);
  assert.equal(dukeController(unused), null);
  assert.equal(unused.leader.capturedBy, undefined);
  const used = consumeDuke(taken);
  assert.equal(dukeController(used), null);
  assert.equal(used.leader.deaths, 2);
});
