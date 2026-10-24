import assert from 'node:assert/strict';
import test from 'node:test';
import {
  spiritualAdvisorArrival,
  spiritualAdvisorMatchingKey,
  spiritualAdvisorTargetBlock,
  SpiritualAdvisorError,
  validateSpiritualAdvisorSource,
  type SpiritualAdvisorContext,
  type SpiritualAdvisorSource,
} from '../game/spiritual-advisor';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';

function context(): SpiritualAdvisorContext {
  return {
    advanced: true, status: 'playing', phase: 5, turn: 4,
    players: [
      {
        id: 'b', faction: 'beneGesserit',
        forces: { 'carthag:11': 2, 'imperial_basin:9': 1, 'polar_sink:0': 1 },
        advisors: { imperial_basin: { lockedTurn: 4 } },
      },
      { id: 'a', faction: 'atreides', forces: { 'carthag:11': 1, 'imperial_basin:9': 1 } },
      { id: 'r', faction: 'richese', forces: {} },
    ],
  };
}

function source(fields: Partial<SpiritualAdvisorSource> = {}): SpiritualAdvisorSource {
  return {
    event: 'original-public-spiritual-opportunity', owner: 'b', turn: 4, phase: 5,
    territory: 'polar_sink', sector: 0, amount: 1, ...fields,
  };
}

void test('Advanced Spiritual Advisors cannot accompany retained non-Polar fighters but retain Polar and post-Intrusion choices', () => {
  const ctx = context();
  const before = structuredClone(ctx);
  assert.match(spiritualAdvisorTargetBlock(ctx, 'b', 'carthag')!, /non-Polar territory containing your fighters/);
  assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', 'polar_sink'), null);
  assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', { territory: 'imperial_basin', sector: 10 }), null);
  assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', 'arrakeen'), null);
  assert.deepEqual(ctx, before);
  ctx.players[0].advisors = { ...ctx.players[0].advisors, carthag: {} };
  assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', 'carthag'), null);
});

void test('Advanced incoming advisors match only the incoming group while alone is determined by foreign effective presence', () => {
  const ctx = context();
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'carthag'), { advisors: false, matching: true, alone: false });
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'imperial_basin'), { advisors: true, matching: false, alone: false });
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'polar_sink'), { advisors: false, matching: true, alone: true });
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'arrakeen'), { advisors: true, matching: false, alone: true });
  ctx.players[0].forces = { ...ctx.players[0].forces, 'polar_sink:0': 0 };
  ctx.players[0].advisors = { ...ctx.players[0].advisors, polar_sink: {} };
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'polar_sink'), { advisors: true, matching: false, alone: true });
  ctx.players[2].noField = { deployed: { location: { territory: 'polar_sink', sector: 0 } } };
  Object.defineProperty(ctx.players[2].noField, 'tokens', {
    get() { throw new Error('Spiritual arrival inspected concealed denominations'); },
  });
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'polar_sink'), { advisors: true, matching: false, alone: false });
});

void test('Basic arrivals retain their fighter behavior without applying Advanced matching or alone rules', () => {
  const ctx = context();
  ctx.advanced = false;
  for (const player of ctx.players) {
    Object.defineProperty(player, 'forces', {
      get() { throw new Error('Basic arrival read Advanced stance eligibility'); },
    });
  }
  for (const target of ['carthag', 'imperial_basin', 'polar_sink', 'arrakeen']) {
    assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', target), null);
    assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', target), { advisors: false, matching: false, alone: false });
  }
});

void test('public source metadata has exactly seven fields and binds native BG, current turn, permitted phase and amount', () => {
  for (const advanced of [false, true]) {
    for (const phase of [1, 3, 5, 8]) {
      const ctx = context();
      ctx.advanced = advanced;
      ctx.phase = phase;
      for (const amount of [1, 2]) {
        const receipt = source({ phase, amount });
        const before = structuredClone({ ctx, receipt });
        assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, receipt));
        assert.deepEqual({ ctx, receipt }, before);
        assert.deepEqual(Object.keys(receipt).sort(), ['amount', 'event', 'owner', 'phase', 'sector', 'territory', 'turn']);
      }
    }
  }
});

void test('current board source validation admits placed HMS and revealed Discovery interiors without adding arrival permission', () => {
  const ctx = context();
  const mobile = source({ territory: MOBILE_STRONGHOLD, sector: 0 });
  assert.throws(() => validateSpiritualAdvisorSource(ctx, mobile), SpiritualAdvisorError);
  ctx.mobileStronghold = { location: 'imperial_basin:9' };
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, mobile));
  ctx.players[0].forces = { [MOBILE_LOCATION]: 1 };
  assert.match(spiritualAdvisorTargetBlock(ctx, 'b', MOBILE_STRONGHOLD)!, /non-Polar/);
  const interior = source({ territory: 'cistern', sector: 0 });
  ctx.discoveries = {
    tokens: [{ face: 'cistern', status: 'placed', territory: 'hagga_basin', sector: 12, revealedTurn: 1 }],
  };
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, interior));
  ctx.discoveries.tokens[0].revealedTurn = null;
  assert.throws(() => validateSpiritualAdvisorSource(ctx, interior), SpiritualAdvisorError);
});

void test('stale source fields, wrong owner, malformed quantities and private payloads throw the named source error', () => {
  const changes: ((ctx: SpiritualAdvisorContext, receipt: SpiritualAdvisorSource) => void)[] = [
    (ctx) => { ctx.status = 'setup'; },
    (ctx) => { ctx.turn++; },
    (ctx) => { ctx.phase = 6; },
    (ctx) => { ctx.players[0].faction = 'atreides'; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[0] }]; },
    (_ctx, receipt) => { receipt.event = ''; },
    (_ctx, receipt) => { receipt.owner = 'a'; },
    (_ctx, receipt) => { receipt.owner = 'missing'; },
    (_ctx, receipt) => { receipt.turn = 3; },
    (_ctx, receipt) => { receipt.phase = 0; },
    (_ctx, receipt) => { receipt.territory = 'homeworld:guild'; },
    (_ctx, receipt) => { receipt.territory = 'missing'; },
    (_ctx, receipt) => { receipt.sector = 1; },
    (_ctx, receipt) => { receipt.amount = 0; },
    (_ctx, receipt) => { receipt.amount = 3; },
    (_ctx, receipt) => { receipt.amount = 1.5; },
  ];
  for (const change of changes) {
    const ctx = context();
    const receipt = source();
    change(ctx, receipt);
    const before = structuredClone({ ctx, receipt });
    assert.throws(() => validateSpiritualAdvisorSource(ctx, receipt), (error: unknown) =>
      error instanceof SpiritualAdvisorError && error.name === 'SpiritualAdvisorError');
    assert.deepEqual({ ctx, receipt }, before);
  }
  for (const malformed of [
    null, [], { ...source(), order: 'private-parent' }, { ...source(), card: 'private-cost' },
    { ...source(), amount: '1' }, { ...source(), sector: NaN },
  ]) {
    assert.throws(() => validateSpiritualAdvisorSource(context(), malformed as unknown as SpiritualAdvisorSource), SpiritualAdvisorError);
  }
});

void test('the matching denial key preserves the original event and packet while ignoring only destination sector', () => {
  const original = source({ territory: 'imperial_basin', sector: 9 });
  const key = spiritualAdvisorMatchingKey(original);
  assert.equal(spiritualAdvisorMatchingKey({ ...original, sector: 10 }), key);
  for (const fields of [
    { event: 'another-original-opportunity' }, { owner: 'other' }, { turn: 5 },
    { territory: 'carthag' }, { amount: 2 },
  ]) {
    assert.notEqual(spiritualAdvisorMatchingKey({ ...original, ...fields }), key);
  }
});

void test('stance and source helpers never inspect resources, private original frames or automatic-flip hold contents', () => {
  const ctx = context();
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'reserves', 'moved', 'shipped']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Spiritual helper read ${player.id} private entitlement ${field}`); },
      });
    }
  }
  for (const stance of Object.values(ctx.players[0].advisors!)) {
    for (const field of ['lockedTurn', 'aloneFlipHold']) {
      Object.defineProperty(stance, field, {
        get() { throw new Error(`Spiritual helper read an unrelated stance hold ${field}`); },
      });
    }
  }
  for (const field of ['pendingSpiritualAdvisor', 'pendingShipment', 'stormCard', 'stormForecast', 'homeworlds']) {
    Object.defineProperty(ctx, field, {
      get() { throw new Error(`Spiritual helper read private original parent ${field}`); },
    });
  }
  assert.equal(spiritualAdvisorTargetBlock(ctx, 'b', 'imperial_basin'), null);
  assert.deepEqual(spiritualAdvisorArrival(ctx, 'b', 'imperial_basin'), { advisors: true, matching: false, alone: false });
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source({ amount: 2 })));
});
