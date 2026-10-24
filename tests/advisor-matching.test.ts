import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advisorMatchingKey,
  AdvisorMatchingError,
  quoteAdvisorMatching,
  validateAdvisorMatching,
  type AdvisorMatchingContext,
  type AdvisorMatchingIntent,
  type AdvisorMatchingSource,
} from '../game/advisor-matching';

function context(): AdvisorMatchingContext {
  return {
    advanced: true, status: 'playing', phase: 5, turn: 4, active: 'b',
    players: [
      {
        id: 'b', faction: 'beneGesserit', moved: 0, reserves: 10,
        forces: {
          'hagga_basin:12': 3, 'hagga_basin:13': 2, 'imperial_basin:9': 2,
          'carthag:11': 2, 'arrakeen:10': 1,
        },
        advisors: { imperial_basin: { lockedTurn: 4 }, carthag: {} },
      },
      { id: 'a', faction: 'atreides', forces: { 'imperial_basin:9': 1 } },
    ],
  };
}

function movement(fields: Partial<AdvisorMatchingIntent> = {}): AdvisorMatchingIntent {
  return {
    kind: 'movement', owner: 'b', move: 0, origin: 'hagga_basin', destination: 'imperial_basin',
    sector: 10, advisors: true, group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 }, ...fields,
  };
}

function shipment(fields: Partial<AdvisorMatchingIntent> = {}): AdvisorMatchingIntent {
  return {
    kind: 'shipment', owner: 'b', move: 0, origin: 'reserves', destination: 'imperial_basin',
    sector: 10, advisors: true, group: { reserves: 2 }, ...fields,
  };
}

function source(ctx = context(), intent = movement()): AdvisorMatchingSource {
  const quote = quoteAdvisorMatching(ctx, intent);
  assert.ok(quote);
  return { event: 'original-matching-response', ...quote };
}

void test('movement matching quotes only the selected incoming packet in both directions and never changes resident forces or stance', () => {
  const ctx = context();
  const incoming = movement();
  const before = structuredClone({ ctx, incoming });
  const quote = quoteAdvisorMatching(ctx, incoming);
  assert.deepEqual(quote, {
    kind: 'movement', owner: 'b', turn: 4, move: 0, origin: 'hagga_basin', destination: 'imperial_basin',
    sector: 10, advisors: true, group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 },
  });
  assert.deepEqual({ ctx, incoming }, before);
  assert.notEqual(quote!.group, incoming.group);
  quote!.group['hagga_basin:12'] = 99;
  assert.equal(ctx.players[0].forces['hagga_basin:12'], 3);
  assert.equal(incoming.group['hagga_basin:12'], 1);
  const reverse = movement({
    origin: 'carthag', destination: 'arrakeen', sector: 10, advisors: false,
    group: { 'carthag:11': 1 },
  });
  assert.equal(quoteAdvisorMatching(ctx, reverse)?.advisors, false);
  const original = source(ctx, reverse);
  assert.doesNotThrow(() => validateAdvisorMatching(ctx, original));
  assert.deepEqual(Object.keys(original).sort(), [
    'advisors', 'destination', 'event', 'group', 'kind', 'move', 'origin', 'owner', 'sector', 'turn',
  ]);
  assert.deepEqual(ctx, before.ctx);
});

void test('Basic, foreign actors, other windows, absent residents and same-type ground groups need no matching response', () => {
  for (const patch of [
    { advanced: false }, { status: 'setup' }, { phase: 4 }, { phase: 6 }, { active: 'a' },
  ]) {
    assert.equal(quoteAdvisorMatching({ ...context(), ...patch }, movement()), null);
  }
  const outsider = context();
  outsider.players[0].faction = 'atreides';
  assert.equal(quoteAdvisorMatching(outsider, movement()), null);
  assert.equal(quoteAdvisorMatching(context(), movement({ owner: 'missing' })), null);
  assert.equal(quoteAdvisorMatching(context(), movement({
    destination: 'arrakeen', sector: 10, advisors: false,
  })), null);
  assert.equal(quoteAdvisorMatching(context(), movement({
    origin: 'carthag', group: { 'carthag:11': 1 }, advisors: true,
  })), null);
  assert.equal(quoteAdvisorMatching(context(), movement({
    origin: 'imperial_basin', destination: 'imperial_basin', sector: 11,
    group: { 'imperial_basin:9': 1 },
  })), null);
  const empty = context();
  empty.players[0].advisors = { ...empty.players[0].advisors, polar_sink: {} };
  assert.equal(quoteAdvisorMatching(empty, movement({ destination: 'polar_sink', sector: 0 })), null);
});

void test('ordinary reserve shipments use the provisional fighter default and only joining resident advisors needs conversion', () => {
  const ctx = context();
  const before = structuredClone(ctx);
  assert.deepEqual(quoteAdvisorMatching(ctx, shipment()), {
    kind: 'shipment', owner: 'b', turn: 4, move: 0, origin: 'reserves', destination: 'imperial_basin',
    sector: 10, advisors: true, group: { reserves: 2 },
  });
  assert.doesNotThrow(() => validateAdvisorMatching(ctx, source(ctx, shipment())));
  assert.equal(quoteAdvisorMatching(ctx, shipment({ destination: 'arrakeen', sector: 10, advisors: false })), null);
  assert.equal(quoteAdvisorMatching(ctx, shipment({ destination: 'polar_sink', sector: 0, advisors: false })), null);
  assert.deepEqual(ctx, before);
  assert.throws(() => quoteAdvisorMatching(ctx, shipment({ move: 1 })), AdvisorMatchingError);
  assert.throws(() => quoteAdvisorMatching(ctx, shipment({ group: { 'hagga_basin:12': 2 } })), AdvisorMatchingError);
  ctx.players[0].reserves = 1;
  assert.throws(() => quoteAdvisorMatching(ctx, shipment()), AdvisorMatchingError);
});

void test('stable matching keys ignore response UUID, destination sector and map insertion order while binding the owned opportunity and packet', () => {
  const original = source();
  const key = advisorMatchingKey(original);
  assert.equal(advisorMatchingKey({
    ...original, event: 'new-response-uuid', sector: 11,
    group: { 'hagga_basin:13': 1, 'hagga_basin:12': 1 },
  }), key);
  for (const change of [
    { turn: 5 }, { owner: 'other' }, { kind: 'shipment' as const }, { move: 1 },
    { destination: 'carthag' }, { advisors: false }, { group: { 'hagga_basin:12': 1 } },
  ]) {
    assert.notEqual(advisorMatchingKey({ ...original, ...change }), key);
  }
});

void test('Karama denial stops the same packet to the same territory only in its current owned opportunity', () => {
  const ctx = context();
  const original = source(ctx);
  ctx.advisorMatchingDenied = [advisorMatchingKey(original)];
  const before = structuredClone(ctx);
  assert.throws(() => quoteAdvisorMatching(ctx, movement()), /already prevented.*current owned opportunity/);
  assert.throws(() => quoteAdvisorMatching(ctx, movement({ sector: 11 })), AdvisorMatchingError);
  assert.throws(() => validateAdvisorMatching(ctx, { ...original, event: 'different-uuid', sector: 9 }), AdvisorMatchingError);
  assert.deepEqual(ctx, before);
  assert.ok(quoteAdvisorMatching(ctx, movement({ group: { 'hagga_basin:12': 1 } })));
  assert.ok(quoteAdvisorMatching(ctx, movement({ destination: 'carthag', sector: 11 })));
  assert.ok(quoteAdvisorMatching(ctx, shipment()));
  ctx.players[0].moved = 1;
  assert.ok(quoteAdvisorMatching(ctx, movement({ move: 1 })));
  ctx.players[0].moved = 0;
  ctx.turn = 5;
  assert.ok(quoteAdvisorMatching(ctx, movement()));
  ctx.turn = 4;
  ctx.players[0].advisors = { carthag: {} };
  assert.equal(quoteAdvisorMatching(ctx, movement({ advisors: false })), null);
});

void test('source validation rejects stale owner, opportunity, physical selection and resident stance without changing the uncommitted action', () => {
  const changes: ((ctx: AdvisorMatchingContext, original: AdvisorMatchingSource) => void)[] = [
    (ctx) => { ctx.active = 'a'; },
    (ctx) => { ctx.turn++; },
    (ctx) => { ctx.phase = 6; },
    (ctx) => { ctx.players[0].moved = 1; },
    (ctx) => { delete ctx.players[0].moved; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'hagga_basin:12': 0 }; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'imperial_basin:9': 0 }; },
    (ctx) => { ctx.players[0].advisors = { carthag: {} }; },
    (_ctx, original) => { original.event = ''; },
    (_ctx, original) => { original.owner = 'missing'; },
    (_ctx, original) => { original.turn = 3; },
    (_ctx, original) => { original.move = 1; },
    (_ctx, original) => { original.advisors = false; },
    (_ctx, original) => { original.destination = 'missing'; },
    (_ctx, original) => { original.sector = 8; },
    (_ctx, original) => { original.group = {}; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 4 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 0 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 1.5 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12.0': 1 }; },
    (_ctx, original) => { original.group = { 'carthag:11': 1 }; },
  ];
  for (const change of changes) {
    const ctx = context();
    const original = source(ctx);
    change(ctx, original);
    const before = structuredClone({ ctx, original });
    assert.throws(() => validateAdvisorMatching(ctx, original), (error: unknown) =>
      error instanceof AdvisorMatchingError && error.name === 'AdvisorMatchingError');
    assert.deepEqual({ ctx, original }, before);
  }
});

void test('matching receipt shapes reject private order data, multiple-origin groups and non-board destinations', () => {
  const ctx = context();
  const original = source(ctx);
  for (const field of ['order', 'signature', 'leader', 'skills', 'payment', 'aloneFlipHold', 'phase']) {
    assert.throws(() => validateAdvisorMatching(ctx, { ...original, [field]: 'private-or-unrelated' } as AdvisorMatchingSource), AdvisorMatchingError);
  }
  for (const malformed of [
    null, [], { ...original, kind: 'ambassador' }, { ...original, advisors: 'true' },
    { ...original, group: null }, { ...original, group: { 'hagga_basin:12': 1, 'carthag:11': 1 } },
  ]) {
    assert.throws(() => validateAdvisorMatching(ctx, malformed as unknown as AdvisorMatchingSource), AdvisorMatchingError);
  }
  assert.throws(() => quoteAdvisorMatching(ctx, movement({ destination: 'homeworld:guild', sector: 0 })), AdvisorMatchingError);
  assert.throws(() => quoteAdvisorMatching(ctx, movement({ origin: 'homeworld:beneGesserit' })), AdvisorMatchingError);
});

void test('matching uses only the selected public counters and stance identity without private funding, leaders or automatic-flip holds', () => {
  const ctx = context();
  const original = source(ctx);
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'skills', 'ready']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Advisor matching read ${player.id} private or unrelated ${field}`); },
      });
    }
  }
  for (const stance of Object.values(ctx.players[0].advisors!)) {
    for (const field of ['lockedTurn', 'aloneFlipHold']) {
      Object.defineProperty(stance, field, {
        get() { throw new Error(`Matching interpreted unrelated arrival or automatic-flip ${field}`); },
      });
    }
  }
  for (const field of ['pendingMove', 'pendingShipment', 'leaderSkills', 'matchingOrder']) {
    Object.defineProperty(ctx, field, {
      get() { throw new Error(`Matching read private original parent ${field}`); },
    });
  }
  assert.ok(quoteAdvisorMatching(ctx, movement()));
  assert.doesNotThrow(() => validateAdvisorMatching(ctx, original));
  assert.ok(quoteAdvisorMatching(ctx, shipment()));
});
