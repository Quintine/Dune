import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advisorAmbassadorMatchingKey,
  AdvisorAmbassadorMatchingError,
  quoteAdvisorAmbassadorMatching,
  validateAdvisorAmbassadorMatching,
  type AdvisorAmbassadorMatchingContext,
  type AdvisorAmbassadorMatchingIntent,
  type AdvisorAmbassadorMatchingSource,
} from '../game/advisor-ambassador-matching';

function context(): AdvisorAmbassadorMatchingContext {
  return {
    advanced: true, status: 'playing', turn: 4, phase: 5,
    players: [
      {
        id: 'b', faction: 'beneGesserit',
        forces: {
          'hagga_basin:12': 3, 'hagga_basin:13': 2, 'imperial_basin:9': 2,
          'carthag:11': 2, 'arrakeen:10': 1,
        },
        advisors: { imperial_basin: { lockedTurn: 4 }, carthag: {} },
      },
      { id: 'a', faction: 'atreides', forces: { 'imperial_basin:9': 1 } },
      { id: 'e', faction: 'ecaz', forces: {} },
    ],
    pendingAmbassador: {
      event: 'original-fremen-ambassador', turn: 4, phase: 5,
      effect: 'fremen', stage: 'move', beneficiary: 'b',
    },
  };
}

function intent(fields: Partial<AdvisorAmbassadorMatchingIntent> = {}): AdvisorAmbassadorMatchingIntent {
  return {
    parent: 'original-fremen-ambassador', owner: 'b', origin: 'hagga_basin',
    destination: 'imperial_basin', sector: 10, advisors: true,
    group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 }, ...fields,
  };
}

function source(ctx = context(), incoming = intent()): AdvisorAmbassadorMatchingSource {
  const quote = quoteAdvisorAmbassadorMatching(ctx, incoming);
  assert.ok(quote);
  return { event: 'matching-counter', ...quote };
}

void test('Fremen Ambassador matching quotes only the selected incoming BG packet in either direction before transfer', () => {
  const ctx = context();
  const incoming = intent();
  const before = structuredClone({ ctx, incoming });
  const quote = quoteAdvisorAmbassadorMatching(ctx, incoming);
  assert.deepEqual(quote, {
    parent: 'original-fremen-ambassador', owner: 'b', turn: 4, phase: 5,
    origin: 'hagga_basin', destination: 'imperial_basin', sector: 10, advisors: true,
    group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 },
  });
  assert.deepEqual({ ctx, incoming }, before);
  assert.notEqual(quote!.group, incoming.group);
  quote!.group['hagga_basin:12'] = 99;
  assert.equal(ctx.players[0].forces['hagga_basin:12'], 3);
  assert.equal(incoming.group['hagga_basin:12'], 1);
  const reverse = intent({
    origin: 'carthag', destination: 'arrakeen', sector: 10, advisors: false,
    group: { 'carthag:11': 1 },
  });
  assert.equal(quoteAdvisorAmbassadorMatching(ctx, reverse)?.advisors, false);
  const original = source(ctx, reverse);
  assert.doesNotThrow(() => validateAdvisorAmbassadorMatching(ctx, original));
  assert.deepEqual(Object.keys(original).sort(), [
    'advisors', 'destination', 'event', 'group', 'origin', 'owner', 'parent', 'phase', 'sector', 'turn',
  ]);
  assert.deepEqual(ctx, before.ctx);
});

void test('Basic, foreign beneficiaries, same-type groups and absent residents do not open Ambassador matching', () => {
  for (const patch of [{ advanced: false }, { status: 'setup' }, { pendingAmbassador: null }]) {
    assert.equal(quoteAdvisorAmbassadorMatching({ ...context(), ...patch }, intent()), null);
  }
  const foreign = context();
  foreign.players[0].faction = 'atreides';
  assert.equal(quoteAdvisorAmbassadorMatching(foreign, intent()), null);
  assert.equal(quoteAdvisorAmbassadorMatching(context(), intent({ owner: 'missing' })), null);
  assert.equal(quoteAdvisorAmbassadorMatching(context(), intent({
    destination: 'arrakeen', sector: 10, advisors: false,
  })), null);
  assert.equal(quoteAdvisorAmbassadorMatching(context(), intent({
    origin: 'carthag', group: { 'carthag:11': 1 },
  })), null);
  const empty = context();
  empty.players[0].advisors = { ...empty.players[0].advisors, polar_sink: {} };
  assert.equal(quoteAdvisorAmbassadorMatching(empty, intent({ destination: 'polar_sink', sector: 0 })), null);
  const sameTerritory = intent({
    origin: 'imperial_basin', destination: 'imperial_basin', sector: 11,
    group: { 'imperial_basin:9': 1 },
  });
  assert.equal(quoteAdvisorAmbassadorMatching(context(), sameTerritory), null);
  assert.throws(() => validateAdvisorAmbassadorMatching(context(), {
    event: 'unnecessary-counter', turn: 4, phase: 5, ...sameTerritory,
  }), AdvisorAmbassadorMatchingError);
});

void test('the current Fremen parent authorizes a non-active beneficiary without using ordinary move or shipment slots', () => {
  const ctx = context();
  Object.defineProperty(ctx, 'active', { value: 'a' });
  Object.defineProperty(ctx.players[0], 'moved', { value: 9 });
  Object.defineProperty(ctx.players[0], 'shipped', { value: true });
  for (const phase of [1, 3, 5, 8]) {
    ctx.phase = phase;
    ctx.pendingAmbassador!.phase = phase;
    const original = source(ctx);
    assert.equal(original.phase, phase);
    assert.doesNotThrow(() => validateAdvisorAmbassadorMatching(ctx, original));
  }
  for (const patch of [
    { effect: 'guild' }, { stage: 'offer' }, { beneficiary: 'a' },
  ]) {
    const other = context();
    Object.assign(other.pendingAmbassador!, patch);
    assert.equal(quoteAdvisorAmbassadorMatching(other, intent()), null);
    assert.throws(() => validateAdvisorAmbassadorMatching(other, source()), AdvisorAmbassadorMatchingError);
  }
});

void test('matching rejects stale parent, turn, phase, resident stance and uncommitted physical selection without mutation', () => {
  const changes: ((ctx: AdvisorAmbassadorMatchingContext, original: AdvisorAmbassadorMatchingSource) => void)[] = [
    (ctx) => { ctx.turn++; },
    (ctx) => { ctx.phase = 3; },
    (ctx) => { ctx.pendingAmbassador!.event = 'another-ambassador'; },
    (ctx) => { ctx.pendingAmbassador!.turn = 3; },
    (ctx) => { ctx.pendingAmbassador!.phase = 1; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'hagga_basin:12': 0 }; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'imperial_basin:9': 0 }; },
    (ctx) => { ctx.players[0].advisors = { carthag: {} }; },
    (_ctx, original) => { original.event = ''; },
    (_ctx, original) => { original.parent = 'another-ambassador'; },
    (_ctx, original) => { original.owner = 'missing'; },
    (_ctx, original) => { original.turn = 3; },
    (_ctx, original) => { original.phase = 3; },
    (_ctx, original) => { original.advisors = false; },
    (_ctx, original) => { original.destination = 'missing'; },
    (_ctx, original) => { original.sector = 8; },
    (_ctx, original) => { original.group = {}; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 4 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 0 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 1.5 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12.0': 1 }; },
    (_ctx, original) => { original.group = { 'carthag:11': 1 }; },
    (_ctx, original) => { original.group = { reserves: 1 }; },
  ];
  for (const change of changes) {
    const ctx = context();
    const original = source(ctx);
    change(ctx, original);
    const before = structuredClone({ ctx, original });
    assert.throws(() => validateAdvisorAmbassadorMatching(ctx, original), (error: unknown) =>
      error instanceof AdvisorAmbassadorMatchingError && error.name === 'AdvisorAmbassadorMatchingError');
    assert.deepEqual({ ctx, original }, before);
  }
});

void test('the Ambassador denial key binds the original opportunity and packet while ignoring counter UUID and destination sector', () => {
  const original = source();
  const key = advisorAmbassadorMatchingKey(original);
  assert.equal(advisorAmbassadorMatchingKey({
    ...original, event: 'new-counter', sector: 11,
    group: { 'hagga_basin:13': 1, 'hagga_basin:12': 1 },
  }), key);
  for (const change of [
    { turn: 5 }, { parent: 'new-parent' }, { owner: 'other' }, { origin: 'carthag' },
    { destination: 'carthag' }, { advisors: false }, { group: { 'hagga_basin:12': 1 } },
  ]) {
    assert.notEqual(advisorAmbassadorMatchingKey({ ...original, ...change }), key);
  }
});

void test('prevention stops only the same Ambassador packet and destination during its original parent opportunity', () => {
  const ctx = context();
  const original = source(ctx);
  ctx.advisorAmbassadorMatchingDenied = [advisorAmbassadorMatchingKey(original)];
  const before = structuredClone(ctx);
  assert.throws(() => quoteAdvisorAmbassadorMatching(ctx, intent()), /already prevented.*original Ambassador opportunity/);
  assert.throws(() => validateAdvisorAmbassadorMatching(ctx, {
    ...original, event: 'new-counter', sector: 11,
  }), AdvisorAmbassadorMatchingError);
  assert.deepEqual(ctx, before);
  assert.ok(quoteAdvisorAmbassadorMatching(ctx, intent({ group: { 'hagga_basin:12': 1 } })));
  assert.ok(quoteAdvisorAmbassadorMatching(ctx, intent({ destination: 'carthag', sector: 11 })));
  ctx.pendingAmbassador!.event = 'later-original-ambassador';
  assert.ok(quoteAdvisorAmbassadorMatching(ctx, intent({ parent: 'later-original-ambassador' })));
  ctx.pendingAmbassador!.event = original.parent;
  ctx.turn = 5;
  ctx.pendingAmbassador!.turn = 5;
  assert.ok(quoteAdvisorAmbassadorMatching(ctx, intent()));
});

void test('strict matching receipts exclude private data, multi-origin packets and non-board locations', () => {
  const ctx = context();
  const original = source(ctx);
  for (const field of ['order', 'signature', 'token', 'noField', 'skills', 'move', 'payment', 'kind']) {
    assert.throws(() => validateAdvisorAmbassadorMatching(ctx, {
      ...original, [field]: 'private-or-unrelated',
    } as AdvisorAmbassadorMatchingSource), AdvisorAmbassadorMatchingError);
  }
  for (const malformed of [
    null, [], { ...original, advisors: 'true' }, { ...original, group: null },
    { ...original, group: { 'hagga_basin:12': 1, 'carthag:11': 1 } },
  ]) {
    assert.throws(() => validateAdvisorAmbassadorMatching(ctx,
      malformed as unknown as AdvisorAmbassadorMatchingSource), AdvisorAmbassadorMatchingError);
  }
  assert.throws(() => quoteAdvisorAmbassadorMatching(ctx,
    intent({ destination: 'homeworld:guild', sector: 0 })), AdvisorAmbassadorMatchingError);
  assert.throws(() => quoteAdvisorAmbassadorMatching(ctx,
    intent({ origin: 'homeworld:beneGesserit' })), AdvisorAmbassadorMatchingError);
});

void test('Ambassador matching reads only public parent identity, physical BG counters and stance, without private eligibility or native order data', () => {
  const ctx = context();
  const incoming = intent();
  const original = source(ctx);
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'skills', 'noField', 'elites', 'moved', 'reserves', 'shipped']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Ambassador matching read ${player.id} private or unrelated ${field}`); },
      });
    }
  }
  for (const stance of Object.values(ctx.players[0].advisors!)) {
    for (const field of ['lockedTurn', 'aloneFlipHold']) {
      Object.defineProperty(stance, field, {
        get() { throw new Error(`Ambassador matching read unrelated ${field}`); },
      });
    }
  }
  for (const object of [ctx, ctx.pendingAmbassador!, incoming]) {
    for (const field of ['active', 'order', 'signature', 'token', 'forecast', 'pendingMove', 'pendingShipment', 'advisorMatchingDenied']) {
      Object.defineProperty(object, field, {
        get() { throw new Error(`Ambassador matching read original private ${field}`); },
      });
    }
  }
  Object.defineProperty(ctx.players[1], 'forces', {
    get() { throw new Error('Ambassador matching reran foreign occupancy'); },
  });
  assert.ok(quoteAdvisorAmbassadorMatching(ctx, incoming));
  assert.doesNotThrow(() => validateAdvisorAmbassadorMatching(ctx, original));
  assert.deepEqual(Object.keys(quoteAdvisorAmbassadorMatching(ctx, incoming)!).sort(), [
    'advisors', 'destination', 'group', 'origin', 'owner', 'parent', 'phase', 'sector', 'turn',
  ]);
});
