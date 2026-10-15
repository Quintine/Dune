import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireDuke, captureDuke, consumeDuke, createDukeVidal, dukeController,
  executeCapturedDuke, expireDuke, releaseCapturedDuke, returnedDukeCapture, type DukeState,
} from '../game/duke-vidal';

void test('capture overrides effective control without replacing the unused original tenure or death history', () => {
  for (const source of ['ecaz', 'moritani', 'ecazNexus', 'ally'] as const) {
    const original = acquireDuke(createDukeVidal(), 'loser', 3, source);
    original.leader.deaths = 2;
    const before = structuredClone(original);
    const captured = captureDuke(original, 'harkonnen', 'loser', 3, 'arrakeen');
    assert.equal(dukeController(captured), 'harkonnen');
    assert.deepEqual(original, before);
    assert.deepEqual(releaseCapturedDuke(captured, 'harkonnen', 3), original);
    assert.equal(dukeController(captured), 'harkonnen', 'pure release does not mutate the captured input');
  }
});

void test('captivity preserves expired underlay but early release restores only still-valid tenure', () => {
  for (const source of ['ecaz', 'moritani', 'ecazNexus', 'ally'] as const) {
    const held = acquireDuke(createDukeVidal(), 'loser', 2, source);
    const captured = captureDuke(held, 'harkonnen', 'loser', 2, 'carthag');
    const afterTurn = expireDuke(captured, 2);
    assert.deepEqual(afterTurn, captured);
    const returned = releaseCapturedDuke(afterTurn, 'harkonnen', 3);
    assert.equal(dukeController(returned), source === 'ecaz' ? 'loser' : null);
    assert.equal(returned.source, source === 'ecaz' ? 'ecaz' : null);
    assert.equal(returned.leader.capturedBy, undefined);
    assert.equal(returned.leader.concealed, undefined);
    if (source !== 'ecaz') {
      assert.equal(returned.acquiredTurn, null);
      const renewed = acquireDuke(returned, 'ecaz', 3, 'ecaz');
      assert.equal(dukeController(renewed), 'ecaz');
    }
  }
});

void test('the original just-used losing Duke remains capturable after release only with a matching battle witness', () => {
  const used = acquireDuke(createDukeVidal(), 'loser', 4, 'moritani');
  used.leader.deaths = 3;
  used.leader.usedAt = 'arrakeen';
  const released = consumeDuke(used);
  const witness = { deaths: 3, usedAt: 'arrakeen' };
  assert.throws(() => captureDuke(released, 'h', 'loser', 4, 'arrakeen'));
  assert.throws(() => captureDuke(used, 'h', 'loser', 4, 'arrakeen', witness));
  const captured = captureDuke(released, 'h', 'loser', 4, 'arrakeen', witness);
  assert.equal(dukeController(captured), 'h');
  assert.throws(() => acquireDuke(captured, 'ecaz', 4, 'ecazNexus'));
  const returned = releaseCapturedDuke(captured, 'h', 4);
  assert.equal(dukeController(returned), null);
  assert.equal(returned.leader.usedAt, 'arrakeen');
  assert.equal(returned.leader.deaths, 3);
  for (const [territory, evidence] of [
    ['carthag', witness],
    ['arrakeen', { deaths: 2, usedAt: 'arrakeen' }],
    ['arrakeen', { deaths: 3, usedAt: 'carthag' }],
  ] as const) {
    assert.throws(() => captureDuke(released, 'h', 'loser', 4, territory, evidence));
  }
});

void test('captive use and execution set aside the same disc rather than restoring an active native Ecaz leader', () => {
  const original = acquireDuke(createDukeVidal(), 'ecaz', 1, 'ecaz');
  original.leader.deaths = 2;
  const captured = captureDuke(original, 'h', 'ecaz', 2, 'arrakeen');
  for (const dead of [false, true]) {
    const resolved = structuredClone(captured);
    resolved.leader.usedAt = 'carthag';
    resolved.leader.dead = dead;
    if (dead) resolved.leader.deaths++;
    const returned = consumeDuke(releaseCapturedDuke(resolved, 'h', 2));
    assert.equal(dukeController(returned), null);
    assert.equal(returned.leader.dead, dead);
    assert.equal(returned.leader.deaths, dead ? 3 : 2);
    assert.equal(returned.leader.capturedBy, undefined);
    assert.equal(returned.leader.concealed, undefined);
    if (dead) {
      const resurrected = acquireDuke(returned, 'ecaz', 2, 'ecazNexus');
      assert.equal(resurrected.leader.dead, false);
      assert.equal(resurrected.leader.deaths, 3);
      assert.equal(resurrected.leader.usedAt, undefined);
      assert.equal(resurrected.source, 'ecazNexus');
    }
  }
});

void test('a secretly executed returned disc is revivable without treating its privacy snapshot as active captivity', () => {
  const captured = captureDuke(acquireDuke(createDukeVidal(), 'loser', 2, 'ally'),
    'h', 'loser', 2, 'arrakeen');
  const before = structuredClone(captured);
  const returned = executeCapturedDuke(captured, 'h', 2);
  const hidden = captured.leader.concealed;
  assert.deepEqual(captured, before, 'execution must not mutate the original capture');
  assert.equal(returned.controller, null);
  assert.equal(returned.source, null);
  assert.equal(returned.acquiredTurn, null);
  assert.equal(returned.leader.deaths, 2, 'original first-life Harkonnen execution advances to two deaths');
  assert.equal(returned.leader.capturedBy, undefined);
  assert.throws(() => executeCapturedDuke(captured, 'wrong', 2));
  assert.throws(() => executeCapturedDuke(returned, 'h', 2));
  assert.equal(returnedDukeCapture(returned), true);
  assert.equal(dukeController(returned), null);
  const revived = acquireDuke(returned, 'ecaz', 2, 'ecazNexus');
  assert.equal(revived.leader.dead, false);
  assert.equal(revived.leader.deaths, 2);
  assert.equal(revived.leader.concealed, undefined);
  assert.equal(revived.leader.capturedBy, undefined);
  assert.equal(revived.captureVisibility, undefined);
  assert.equal(revived.source, 'ecazNexus');
  assert.deepEqual(returned.leader.concealed, hidden);
  for (const mutate of [
    (state: DukeState) => { state.leader.dead = false; },
    (state: DukeState) => { state.leader.concealed!.deaths += 2; },
    (state: DukeState) => { state.leader.gholaBy = 'tleilaxu'; },
    (state: DukeState) => { state.leader.usedAt = 'carthag'; },
    (state: DukeState) => { state.controller = 'loser'; },
    (state: DukeState) => { state.captureVisibility!.controller = 'other'; },
    (state: DukeState) => { state.captureVisibility!.source = null; },
    (state: DukeState) => { delete state.captureVisibility; },
  ]) {
    const broken = structuredClone(returned);
    mutate(broken);
    assert.equal(returnedDukeCapture(broken), false);
    assert.throws(() => acquireDuke(broken, 'ecaz', 2, 'ecazNexus'));
  }
});

void test('Cunning liberates actual captivity, never saves a captor to restore after its own expiry', () => {
  const held = acquireDuke(createDukeVidal(), 'ecaz', 1, 'ecaz');
  held.leader.deaths = 4;
  const captive = captureDuke(held, 'h', 'ecaz', 3, 'arrakeen');
  const liberated = acquireDuke(captive, 'ecaz', 3, 'ecazNexus');
  assert.equal(dukeController(liberated), 'ecaz');
  assert.equal(liberated.source, 'ecazNexus');
  assert.equal(liberated.leader.capturedBy, undefined);
  assert.equal(liberated.leader.concealed, undefined);
  assert.equal(liberated.leader.deaths, 4);
  assert.equal(dukeController(expireDuke(liberated, 3)), null);
  assert.equal(dukeController(captive), 'h');
  for (const source of ['ecaz', 'moritani', 'ally'] as const)
    assert.throws(() => acquireDuke(captive, 'other', 3, source));
  const foreign = structuredClone(captive);
  foreign.leader.gholaBy = 'tleilaxu';
  assert.throws(() => acquireDuke(foreign, 'ecaz', 3, 'ecazNexus'));
});

void test('capture and return reject wrong original controller, invalid tenure and corrupted physical custody without mutation', () => {
  const held = acquireDuke(createDukeVidal(), 'loser', 2, 'moritani');
  assert.throws(() => captureDuke(held, 'h', 'other', 2, 'arrakeen'));
  assert.throws(() => captureDuke(held, 'h', 'loser', 3, 'arrakeen'));
  const mutations: ((state: DukeState) => void)[] = [
    state => { state.leader.dead = true; },
    state => { state.leader.capturedBy = 'already'; },
    state => { state.leader.gholaBy = 'tleilaxu'; },
    state => { state.leader.id = 'replacement'; },
    state => { state.leader.deaths = -1; },
    state => { state.acquiredTurn = 3; },
    state => { state.source = null; },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(held);
    mutate(broken);
    const before = structuredClone(broken);
    assert.throws(() => captureDuke(broken, 'h', 'loser', 2, 'arrakeen'));
    assert.deepEqual(broken, before);
  }
  const captive = captureDuke(held, 'h', 'loser', 2, 'arrakeen');
  assert.throws(() => releaseCapturedDuke(captive, 'other', 2));
  for (const mutate of [
    (state: DukeState) => { state.leader.concealed!.captor = 'other'; },
    (state: DukeState) => { state.leader.concealed!.controller = 'other'; },
    (state: DukeState) => { state.leader.concealed!.deaths++; },
    (state: DukeState) => { state.captureVisibility!.source = 'ecaz'; },
    (state: DukeState) => { delete state.captureVisibility; },
  ]) {
    const broken = structuredClone(captive);
    mutate(broken);
    assert.throws(() => releaseCapturedDuke(broken, 'h', 2));
    assert.throws(() => acquireDuke(broken, 'ecaz', 2, 'ecazNexus'));
  }
});
