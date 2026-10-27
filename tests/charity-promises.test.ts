import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindCharityPromise, charityPromiseAnswers, CharityPromiseError,
  guardCharityClaim, guardCharityReady, liveCharityPromises, reconcileCharityPromises, validateCharityPromises,
  type CharityPromise,
} from '../game/charity-promises';

const ctx = { player: 'emperor', asker: 'atreides', turn: 3 };
const empty: CharityPromise[] = [];
const bind = (rows: readonly CharityPromise[], answer: boolean, canClaim = true) =>
  bindCharityPromise(rows, ctx.player, ctx.asker, ctx.turn, answer, canClaim);

void test('Charity answer availability follows actual eligibility and incompatible earlier answers', () => {
  assert.deepEqual(charityPromiseAnswers(empty, ctx.player, ctx.turn, true), ['yes', 'no']);
  assert.deepEqual(charityPromiseAnswers(empty, ctx.player, ctx.turn, false), ['no']);
  assert.deepEqual(charityPromiseAnswers(bind(empty, true), ctx.player, ctx.turn, true), ['yes']);
  assert.deepEqual(charityPromiseAnswers(bind(empty, false), ctx.player, ctx.turn, true), ['no']);
  assert.throws(() => bind(bind(empty, true), false), CharityPromiseError);
  assert.throws(() => bind(bind(empty, false), true), CharityPromiseError);
  assert.throws(() => bind(empty, true, false), CharityPromiseError);
  assert.throws(() => bindCharityPromise(empty, ctx.player, ctx.player, ctx.turn, false, true), CharityPromiseError);
  assert.deepEqual(empty, []);
});

void test('a Yes blocks ready until the actual claim and a No blocks the actual claim', () => {
  const yes = bind(bind(empty, true), true);
  assert.throws(() => guardCharityReady(yes, ctx.player, ctx.turn, true), CharityPromiseError);
  assert.doesNotThrow(() => guardCharityReady(yes, ctx.player, ctx.turn, false));
  const claimed = guardCharityClaim(yes, ctx.player, ctx.turn);
  assert.equal(claimed.every(row => row.fulfilled && !row.released), true);
  assert.equal(yes.every(row => !row.fulfilled), true, 'the original input is unchanged');
  assert.doesNotThrow(() => guardCharityReady(claimed, ctx.player, ctx.turn, true));
  assert.throws(() => guardCharityClaim(bind(empty, false), ctx.player, ctx.turn), CharityPromiseError);
});

void test('an external loss releases Yes, while a voluntary loss or phase exit rejects unchanged', () => {
  const yes = bind(empty, true);
  for (const phaseOpen of [true, false]) {
    assert.throws(() => reconcileCharityPromises(yes, ctx.player, ctx.turn,
      { phaseOpen, canClaim: false, change: 'voluntary' }), CharityPromiseError);
    assert.equal(yes[0].released, false);
    const released = reconcileCharityPromises(yes, ctx.player, ctx.turn,
      { phaseOpen, canClaim: false, change: 'external' });
    assert.equal(released[0].released, true);
    assert.equal(released[0].fulfilled, false);
  }
});

void test('No survives Basic ready while the phase is open and finishes at phase close', () => {
  const no = bind(empty, false);
  const ready = reconcileCharityPromises(no, ctx.player, ctx.turn,
    { phaseOpen: true, canClaim: true, change: 'voluntary' });
  assert.deepEqual(liveCharityPromises(ready, ctx.player, ctx.turn), no);
  assert.throws(() => guardCharityClaim(ready, ctx.player, ctx.turn), CharityPromiseError);
  const closed = reconcileCharityPromises(ready, ctx.player, ctx.turn,
    { phaseOpen: false, canClaim: false, change: 'voluntary' });
  assert.equal(closed[0].fulfilled, true);
  assert.equal(closed[0].released, false);
  assert.deepEqual(liveCharityPromises(closed, ctx.player, ctx.turn), []);
});

void test('promises for other players, turns and completed answers are unaffected', () => {
  const yes = bind(empty, true);
  const other = bindCharityPromise(yes, 'guild', 'atreides', 3, true, true);
  const later = bindCharityPromise(other, 'emperor', 'atreides', 4, false, true);
  const settled = guardCharityClaim(later, ctx.player, ctx.turn);
  assert.equal(settled[0].fulfilled, true);
  assert.deepEqual(settled.slice(1), later.slice(1));
  assert.deepEqual(charityPromiseAnswers(settled, ctx.player, ctx.turn, true), ['yes', 'no']);
  assert.throws(() => liveCharityPromises(settled, ctx.player, 0), CharityPromiseError);
});

void test('every answer has a stable unique receipt event through claim, release and closure', () => {
  const yes = bindCharityPromise(empty, ctx.player, ctx.asker, ctx.turn, true, true, 'event-yes');
  assert.equal(yes[0].event, 'event-yes');
  assert.equal(guardCharityClaim(yes, ctx.player, ctx.turn)[0].event, 'event-yes');
  assert.equal(reconcileCharityPromises(yes, ctx.player, ctx.turn,
    { phaseOpen: true, canClaim: false, change: 'external' })[0].event, 'event-yes');
  const no = bindCharityPromise(yes, 'guild', ctx.asker, ctx.turn, false, true, 'event-no');
  assert.equal(reconcileCharityPromises(no, 'guild', ctx.turn,
    { phaseOpen: false, canClaim: false, change: 'voluntary' })[1].event, 'event-no');
  assert.throws(() => bindCharityPromise(yes, 'guild', ctx.asker, ctx.turn, true, true, 'event-yes'), CharityPromiseError);
  assert.throws(() => validateCharityPromises([{ ...yes[0], event: '' }]), CharityPromiseError);
  assert.throws(() => validateCharityPromises([{ ...yes[0], fulfilled: true, released: true }]), CharityPromiseError);
  assert.ok(bind(empty, false)[0].event, 'normal binding assigns an event');
});
