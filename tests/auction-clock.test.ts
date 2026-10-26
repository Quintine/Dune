import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUCTION_BID_MS,
  AuctionClockError,
  quoteAuctionClock,
  viewAuctionClock,
  type AuctionClock,
} from '../game/auction-clock';

const opportunity = { source: 'ordinary-lot:1', player: 'atreides' };
function input(extra: Partial<Parameters<typeof quoteAuctionClock>[0]> = {}): Parameters<typeof quoteAuctionClock>[0] {
  return { opportunity, now: 1_000, blocked: false, controlEpoch: 'control:1', event: 'clock:1', ...extra };
}
function armed(extra: Partial<AuctionClock> = {}): AuctionClock {
  return { event: 'clock:1', source: opportunity.source, player: opportunity.player,
    remainingMs: AUCTION_BID_MS, startedAt: 1_000, controlEpoch: 'control:1', ...extra };
}

void test('a new ordinary bidder receives exactly ten seconds with the supplied source and event', () => {
  assert.equal(AUCTION_BID_MS, 10_000);
  const result = quoteAuctionClock(input());
  assert.deepEqual(result, { clock: armed(), expired: false, delayMs: 10_000 });
  assert.deepEqual(viewAuctionClock(result.clock!, 1_000), {
    event: 'clock:1', player: 'atreides', remainingMs: 10_000, running: true,
  });
});

void test('unrelated same-source requests retain the original event and deadline instead of resetting the budget', () => {
  const clock = armed();
  for (const now of [1_001, 2_500, 7_500, 10_999]) {
    const result = quoteAuctionClock(input({ clock, now, event: `unused:${now}` }));
    assert.equal(result.clock, clock);
    assert.equal(result.delayMs, 11_000 - now);
    assert.equal(result.expired, false);
    assert.equal(result.clock.event, 'clock:1');
  }
});

void test('the exact deadline expires once eligible and cannot be extended by a later request', () => {
  const clock = armed();
  assert.equal(quoteAuctionClock(input({ clock, now: 10_999.5 })).expired, false);
  const expired = quoteAuctionClock(input({ clock, now: 11_000 }));
  assert.deepEqual(expired, { clock: armed({ remainingMs: 0, startedAt: null }), expired: true, delayMs: null });
  assert.deepEqual(viewAuctionClock(expired.clock!, 11_000), {
    event: 'clock:1', player: 'atreides', remainingMs: 0, running: false,
  });
  const repeated = quoteAuctionClock(input({ clock: expired.clock, now: 20_000, event: 'unused:new' }));
  assert.equal(repeated.clock, expired.clock);
  assert.equal(repeated.expired, true);
  assert.equal(repeated.delayMs, null);
});

void test('a blocker suspends the exact retained budget and resumption does not grant a fresh ten seconds', () => {
  const clock = armed();
  const paused = quoteAuctionClock(input({ clock, now: 3_750, blocked: true }));
  assert.deepEqual(paused, { clock: armed({ remainingMs: 7_250, startedAt: null }), expired: false, delayMs: null });
  assert.deepEqual(viewAuctionClock(paused.clock!, 50_000), {
    event: 'clock:1', player: 'atreides', remainingMs: 7_250, running: false,
  });
  const stillPaused = quoteAuctionClock(input({ clock: paused.clock, now: 50_000, blocked: true, event: 'unused:pause' }));
  assert.equal(stillPaused.clock, paused.clock);
  const resumed = quoteAuctionClock(input({ clock: paused.clock, now: 50_000, event: 'unused:resume' }));
  assert.deepEqual(resumed, { clock: armed({ remainingMs: 7_250, startedAt: 50_000 }), expired: false, delayMs: 7_250 });
  assert.equal(quoteAuctionClock(input({ clock: resumed.clock, now: 57_249 })).expired, false);
  assert.equal(quoteAuctionClock(input({ clock: resumed.clock, now: 57_250 })).expired, true);
  assert.equal(clock.startedAt, 1_000);
  assert.equal(clock.remainingMs, 10_000);
});

void test('a newly observed blocked opportunity starts suspended and never spends its initial budget', () => {
  const paused = quoteAuctionClock(input({ blocked: true }));
  assert.deepEqual(paused, { clock: armed({ startedAt: null }), expired: false, delayMs: null });
  const resumed = quoteAuctionClock(input({ clock: paused.clock, now: 500_000 }));
  assert.equal(resumed.clock!.startedAt, 500_000);
  assert.equal(resumed.clock!.event, 'clock:1');
  assert.equal(resumed.delayMs, 10_000);
});

void test('a blocker suppresses an already elapsed deadline until the native opportunity resumes', () => {
  const paused = quoteAuctionClock(input({ clock: armed(), now: 11_000, blocked: true }));
  assert.equal(paused.expired, false);
  assert.equal(paused.delayMs, null);
  assert.deepEqual(paused.clock, armed({ remainingMs: 0, startedAt: null }));
  assert.equal(viewAuctionClock(paused.clock!, 50_000).event, 'clock:1');
  const resumed = quoteAuctionClock(input({ clock: paused.clock, now: 50_000 }));
  assert.equal(resumed.expired, true);
  assert.equal(resumed.delayMs, null);
});

void test('source and bidder changes each bind a fresh supplied event and full budget', () => {
  const clock = armed({ remainingMs: 500 });
  for (const next of [{ source: 'ordinary-lot:2', player: 'atreides' },
    { source: opportunity.source, player: 'emperor' }]) {
    const result = quoteAuctionClock(input({ clock, opportunity: next, now: 5_000, event: 'clock:2' }));
    assert.deepEqual(result.clock, { ...clock, ...next, event: 'clock:2', remainingMs: 10_000, startedAt: 5_000 });
    assert.equal(result.delayMs, 10_000);
    assert.equal(result.expired, false);
  }
});

void test('a changed control epoch re-arms even when no intermediate admin pause was observed', () => {
  const expired = armed({ remainingMs: 0, startedAt: null });
  const resumed = quoteAuctionClock(input({ clock: expired, now: 60_000,
    controlEpoch: 'control:2', event: 'clock:2' }));
  assert.deepEqual(resumed, { clock: armed({ controlEpoch: 'control:2', event: 'clock:2', startedAt: 60_000 }),
    expired: false, delayMs: 10_000 });
  const suspended = quoteAuctionClock(input({ clock: expired, now: 60_000, blocked: true,
    controlEpoch: 'control:2', event: 'clock:2' }));
  assert.deepEqual(suspended, { clock: armed({ controlEpoch: 'control:2', event: 'clock:2', startedAt: null }),
    expired: false, delayMs: null });
});

void test('removing the native opportunity removes its frame and a later opportunity arms anew', () => {
  const result = quoteAuctionClock(input({ clock: armed(), opportunity: null, now: 5_000 }));
  assert.deepEqual(result, { clock: undefined, expired: false, delayMs: null });
  assert.equal(quoteAuctionClock(input({ clock: result.clock, now: 50_000, event: 'clock:2' })).delayMs, 10_000);
});

void test('clock rollback consumes no retained time and never expands its budget', () => {
  const clock = armed({ remainingMs: 2_500 });
  const result = quoteAuctionClock(input({ clock, now: 500 }));
  assert.equal(result.clock, clock);
  assert.equal(result.delayMs, 2_500);
  assert.equal(result.expired, false);
  assert.equal(viewAuctionClock(clock, 500).remainingMs, 2_500);
  const paused = quoteAuctionClock(input({ clock, now: 500, blocked: true }));
  assert.deepEqual(paused.clock, { ...clock, startedAt: null });
  assert.equal(quoteAuctionClock(input({ clock: paused.clock, now: 5_000 })).delayMs, 2_500);
});

void test('fractional elapsed time remains exact and a projected view never mutates the frame', () => {
  const clock = Object.freeze(armed({ remainingMs: 1_000.75, startedAt: 10.25 }));
  const before = structuredClone(clock);
  assert.equal(viewAuctionClock(clock, 110.5).remainingMs, 900.5);
  const paused = quoteAuctionClock(input({ clock, now: 110.5, blocked: true }));
  assert.equal(paused.clock!.remainingMs, 900.5);
  assert.deepEqual(clock, before);
});

void test('clock validation rejects missing, extra, mistyped or nonfinite stored fields before projecting or discarding', () => {
  const clock = armed();
  const invalid: unknown[] = [null, [], {}, { ...clock, event: '' }, { ...clock, source: ' source' },
    { ...clock, player: '' }, { ...clock, controlEpoch: '' }, { ...clock, deadline: 11_000 },
    ...[-1, 10_001, NaN, Infinity, '10000'].map(remainingMs => ({ ...clock, remainingMs })),
    ...[undefined, NaN, Infinity, '1000'].map(startedAt => ({ ...clock, startedAt }))];
  for (const field of Object.keys(clock)) {
    const missing: Record<string, unknown> = { ...clock };
    delete missing[field];
    invalid.push(missing);
  }
  for (const value of invalid) {
    assert.throws(() => viewAuctionClock(value as AuctionClock, 1_000), AuctionClockError);
    assert.throws(() => quoteAuctionClock(input({ clock: value as AuctionClock, opportunity: null })), AuctionClockError);
  }
});

void test('quotation validates complete native opportunity metadata and finite caller time without coercion', () => {
  const valid = input();
  const invalid: unknown[] = [null, [], {}, { ...valid, event: '' }, { ...valid, controlEpoch: ' epoch' },
    { ...valid, blocked: 0 }, { ...valid, deadline: 11_000 },
    ...[undefined, NaN, Infinity, '1000'].map(now => ({ ...valid, now })),
    ...[undefined, [], {}, { source: '', player: 'atreides' }, { source: 'lot', player: ' atreides' },
      { ...opportunity, bid: 1 }].map(opportunity => ({ ...valid, opportunity }))];
  for (const field of Object.keys(valid)) {
    const missing: Record<string, unknown> = { ...valid };
    delete missing[field];
    invalid.push(missing);
  }
  for (const value of invalid) assert.throws(() => quoteAuctionClock(value as typeof valid), AuctionClockError);
  for (const now of [NaN, Infinity, '1000', undefined])
    assert.throws(() => viewAuctionClock(armed(), now as number), AuctionClockError);
  assert.doesNotThrow(() => quoteAuctionClock(input({ opportunity: null })));
});
