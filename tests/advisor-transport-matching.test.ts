import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advisorTransportMatchingKey,
  AdvisorTransportMatchingError,
  quoteAdvisorTransportMatching,
  validateAdvisorTransportMatching,
  type AdvisorTransportMatchingContext,
  type AdvisorTransportMatchingIntent,
  type AdvisorTransportMatchingSource,
} from '../game/advisor-transport-matching';

function context(): AdvisorTransportMatchingContext {
  return {
    advanced: true, status: 'playing', turn: 4, phase: 5, active: 'b',
    advisorTransportMatchingOpportunity: 'private-original-transport-opportunity',
    players: [
      {
        id: 'b', faction: 'beneGesserit', shipped: false,
        forces: {
          'hagga_basin:12': 3, 'hagga_basin:13': 2, 'imperial_basin:9': 2,
          'carthag:11': 2, 'arrakeen:10': 1,
        },
        advisors: { imperial_basin: { lockedTurn: 4 }, carthag: {} },
      },
      { id: 'a', faction: 'atreides', forces: { 'imperial_basin:9': 1 } },
      { id: 'g', faction: 'guild', forces: {} },
    ],
    worlds: [
      { id: 'homeworld:atreides', forces: { b: { normal: 2, elite: 0 }, a: { normal: 8, elite: 0 } } },
      { id: 'homeworld:beneGesserit', forces: { b: { normal: 4, elite: 0 } } },
      { id: 'homeworld:guild', forces: { b: { normal: 1, elite: 0 }, g: { normal: 10, elite: 0 } } },
    ],
  };
}

function intent(fields: Partial<AdvisorTransportMatchingIntent> = {}): AdvisorTransportMatchingIntent {
  return {
    producer: 'guild', owner: 'b', origin: 'hagga_basin', destination: 'imperial_basin',
    sector: 10, advisors: true, group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 }, ...fields,
  };
}

function worldIntent(fields: Partial<AdvisorTransportMatchingIntent> = {}): AdvisorTransportMatchingIntent {
  return intent({
    producer: 'junction', origin: 'homeworld:atreides',
    group: { 'homeworld:beneGesserit': 2, 'homeworld:atreides': 1 }, ...fields,
  });
}

function source(ctx = context(), incoming = intent()): AdvisorTransportMatchingSource {
  const quote = quoteAdvisorTransportMatching(ctx, incoming);
  assert.ok(quote);
  return { event: 'matching-counter', ...quote };
}

void test('Guild and Junction board matching quote the selected incoming BG group in both directions before transport', () => {
  for (const producer of ['guild', 'junction'] as const) {
    const ctx = context();
    const incoming = intent({ producer });
    const before = structuredClone({ ctx, incoming });
    const quote = quoteAdvisorTransportMatching(ctx, incoming);
    assert.deepEqual(quote, {
      producer, owner: 'b', turn: 4, phase: 5, origin: 'hagga_basin',
      destination: 'imperial_basin', sector: 10, advisors: true,
      group: { 'hagga_basin:12': 1, 'hagga_basin:13': 1 },
    });
    assert.deepEqual({ ctx, incoming }, before);
    assert.notEqual(quote!.group, incoming.group);
    quote!.group['hagga_basin:12'] = 99;
    assert.equal(incoming.group['hagga_basin:12'], 1);
    const reverse = intent({
      producer, origin: 'carthag', destination: 'arrakeen', sector: 10, advisors: false,
      group: { 'carthag:11': 1 },
    });
    assert.equal(quoteAdvisorTransportMatching(ctx, reverse)?.advisors, false);
    assert.doesNotThrow(() => validateAdvisorTransportMatching(ctx, source(ctx, reverse)));
    assert.deepEqual(ctx, before.ctx);
  }
});

void test('Junction world matching uses owned normal physical counters and the first sorted source key without publishing the native scope', () => {
  const ctx = context();
  const incoming = worldIntent();
  const before = structuredClone({ ctx, incoming });
  const original = source(ctx, incoming);
  assert.equal(original.origin, 'homeworld:atreides');
  assert.equal(original.advisors, true);
  assert.deepEqual(original.group, { 'homeworld:beneGesserit': 2, 'homeworld:atreides': 1 });
  assert.doesNotThrow(() => validateAdvisorTransportMatching(ctx, original));
  assert.deepEqual(Object.keys(original).sort(), [
    'advisors', 'destination', 'event', 'group', 'origin', 'owner', 'phase', 'producer', 'sector', 'turn',
  ]);
  assert.ok(!JSON.stringify(original).includes(ctx.advisorTransportMatchingOpportunity!));
  assert.deepEqual({ ctx, incoming }, before);
  assert.throws(() => quoteAdvisorTransportMatching(ctx, worldIntent({ origin: 'homeworld:beneGesserit' })), AdvisorTransportMatchingError);
  assert.throws(() => quoteAdvisorTransportMatching(ctx, worldIntent({ producer: 'guild' })), AdvisorTransportMatchingError);
  assert.equal(quoteAdvisorTransportMatching(ctx, worldIntent({
    destination: 'arrakeen', sector: 10, advisors: false,
  })), null);
});

void test('Basic, inactive or spent native shipments, same-type groups, empty territories and return destinations need no matching quote', () => {
  for (const patch of [
    { advanced: false }, { status: 'setup' }, { phase: 4 }, { phase: 6 }, { phase: 8 }, { active: 'a' },
  ]) {
    assert.equal(quoteAdvisorTransportMatching({ ...context(), ...patch }, intent()), null);
  }
  const spent = context();
  spent.players[0].shipped = true;
  assert.equal(quoteAdvisorTransportMatching(spent, intent()), null);
  const foreign = context();
  foreign.players[0].faction = 'atreides';
  assert.equal(quoteAdvisorTransportMatching(foreign, intent()), null);
  assert.equal(quoteAdvisorTransportMatching(context(), intent({ owner: 'missing' })), null);
  assert.equal(quoteAdvisorTransportMatching(context(), intent({
    destination: 'arrakeen', sector: 10, advisors: false,
  })), null);
  assert.equal(quoteAdvisorTransportMatching(context(), intent({ origin: 'carthag', group: { 'carthag:11': 1 } })), null);
  assert.equal(quoteAdvisorTransportMatching(context(), intent({ destination: 'polar_sink', sector: 0 })), null);
  assert.equal(quoteAdvisorTransportMatching(context(), intent({
    origin: 'imperial_basin', sector: 11, group: { 'imperial_basin:9': 1 },
  })), null);
  const noScope = context();
  delete noScope.advisorTransportMatchingOpportunity;
  for (const destination of ['reserves', 'homeworld:beneGesserit']) {
    assert.equal(quoteAdvisorTransportMatching(noScope, intent({ destination, sector: 0 })), null);
  }
  assert.equal(quoteAdvisorTransportMatching(noScope, intent({ destination: 'polar_sink', sector: 0 })), null);
  assert.throws(() => quoteAdvisorTransportMatching(noScope, intent()), /original native opportunity/);
});

void test('the private opportunity scopes prevention while UUID, sector and group insertion order do not change the same packet key', () => {
  const original = source();
  const scope = context().advisorTransportMatchingOpportunity!;
  const key = advisorTransportMatchingKey(original, scope);
  assert.equal(advisorTransportMatchingKey({
    ...original, event: 'new-counter', sector: 11,
    group: { 'hagga_basin:13': 1, 'hagga_basin:12': 1 },
  }, scope), key);
  for (const change of [
    { turn: 5 }, { owner: 'other' }, { producer: 'junction' as const }, { origin: 'carthag' },
    { destination: 'carthag' }, { advisors: false }, { group: { 'hagga_basin:12': 1 } },
  ]) {
    assert.notEqual(advisorTransportMatchingKey({ ...original, ...change }, scope), key);
  }
  assert.notEqual(advisorTransportMatchingKey(original, 'later-native-opportunity'), key);
  assert.throws(() => advisorTransportMatchingKey(original, ''), AdvisorTransportMatchingError);
});

void test('transport prevention retains the uncommitted packet and blocks its same-territory retry only within the original native scope', () => {
  const ctx = context();
  const original = source(ctx);
  ctx.advisorTransportMatchingDenied = [advisorTransportMatchingKey(original, ctx.advisorTransportMatchingOpportunity!)];
  const before = structuredClone(ctx);
  assert.throws(() => quoteAdvisorTransportMatching(ctx, intent()), /already prevented.*original transport opportunity/);
  assert.throws(() => validateAdvisorTransportMatching(ctx, {
    ...original, event: 'new-counter', sector: 11,
  }), AdvisorTransportMatchingError);
  assert.deepEqual(ctx, before);
  assert.ok(quoteAdvisorTransportMatching(ctx, intent({ group: { 'hagga_basin:12': 1 } })));
  assert.ok(quoteAdvisorTransportMatching(ctx, intent({ destination: 'carthag', sector: 11 })));
  assert.ok(quoteAdvisorTransportMatching(ctx, intent({ producer: 'junction' })));
  ctx.advisorTransportMatchingOpportunity = 'later-native-opportunity';
  assert.ok(quoteAdvisorTransportMatching(ctx, intent()));
  ctx.advisorTransportMatchingOpportunity = before.advisorTransportMatchingOpportunity;
  ctx.turn++;
  assert.ok(quoteAdvisorTransportMatching(ctx, intent()));
});

void test('validation rejects stale native windows, target stance and selected board sources without changing the action', () => {
  const changes: ((ctx: AdvisorTransportMatchingContext, original: AdvisorTransportMatchingSource) => void)[] = [
    (ctx) => { ctx.active = 'a'; },
    (ctx) => { ctx.phase = 6; },
    (ctx) => { ctx.turn++; },
    (ctx) => { ctx.players[0].shipped = true; },
    (ctx) => { delete ctx.advisorTransportMatchingOpportunity; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'hagga_basin:12': 0 }; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'imperial_basin:9': 0 }; },
    (ctx) => { ctx.players[0].advisors = { carthag: {} }; },
    (_ctx, original) => { original.event = ''; },
    (_ctx, original) => { original.owner = 'missing'; },
    (_ctx, original) => { original.turn = 3; },
    (_ctx, original) => { original.phase = 3; },
    (_ctx, original) => { original.advisors = false; },
    (_ctx, original) => { original.destination = 'missing'; },
    (_ctx, original) => { original.sector = 8; },
    (_ctx, original) => { original.group = {}; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 4 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 0 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': -1 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 1.5 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12.0': 1 }; },
    (_ctx, original) => { original.group = { 'hagga_basin:12': 1, 'carthag:11': 1 }; },
    (_ctx, original) => { original.group = { reserves: 1 }; },
  ];
  for (const change of changes) {
    const ctx = context();
    const original = source(ctx);
    change(ctx, original);
    const before = structuredClone({ ctx, original });
    assert.throws(() => validateAdvisorTransportMatching(ctx, original), (error: unknown) =>
      error instanceof AdvisorTransportMatchingError && error.name === 'AdvisorTransportMatchingError');
    assert.deepEqual({ ctx, original }, before);
  }
});

void test('Junction matching rejects absent, foreign-only, excessive or mixed board/world physical selections', () => {
  const changes: ((ctx: AdvisorTransportMatchingContext, incoming: AdvisorTransportMatchingIntent) => void)[] = [
    (ctx) => { delete ctx.worlds; },
    (ctx) => { ctx.worlds = ctx.worlds!.filter((world) => world.id !== 'homeworld:atreides'); },
    (ctx) => { ctx.worlds = [...ctx.worlds!, ctx.worlds![0]]; },
    (ctx) => { ctx.worlds![0].forces = { a: { normal: 10, elite: 0 } }; },
    (_ctx, incoming) => { incoming.group = { 'homeworld:atreides': 3 }; },
    (_ctx, incoming) => { incoming.group = { 'homeworld:atreides': 0 }; },
    (_ctx, incoming) => { incoming.group = { 'homeworld:atreides': 1, 'hagga_basin:12': 1 }; },
    (_ctx, incoming) => { incoming.group = { 'homeworld:missing': 1 }; },
    (_ctx, incoming) => { incoming.group = { 'homeworld:atreides:0': 1 }; },
  ];
  for (const change of changes) {
    const ctx = context();
    const incoming = worldIntent();
    change(ctx, incoming);
    assert.throws(() => quoteAdvisorTransportMatching(ctx, incoming), AdvisorTransportMatchingError);
  }
  const ctx = context();
  ctx.worlds![0].forces = { b: { normal: 0, elite: 2 } };
  assert.throws(() => quoteAdvisorTransportMatching(ctx, worldIntent()), AdvisorTransportMatchingError);
});

void test('transport sources contain exactly ten public fields and current board locations remain room-specific', () => {
  const ctx = context();
  const original = source(ctx);
  for (const field of ['opportunity', 'advisorTransportMatchingOpportunity', 'order', 'signature', 'grant', 'token', 'noField', 'payment', 'rate']) {
    assert.throws(() => validateAdvisorTransportMatching(ctx, {
      ...original, [field]: 'private-or-unrelated',
    } as AdvisorTransportMatchingSource), AdvisorTransportMatchingError);
  }
  for (const malformed of [
    null, [], { ...original, producer: 'ambassador' }, { ...original, advisors: 'true' }, { ...original, group: null },
  ]) {
    assert.throws(() => validateAdvisorTransportMatching(ctx,
      malformed as unknown as AdvisorTransportMatchingSource), AdvisorTransportMatchingError);
  }
  const mobile = intent({ destination: 'hidden_mobile_stronghold', sector: 0 });
  assert.throws(() => quoteAdvisorTransportMatching(ctx, mobile), AdvisorTransportMatchingError);
  ctx.mobileStronghold = { location: 'hagga_basin:12' };
  ctx.players[0].forces = { ...ctx.players[0].forces, 'hidden_mobile_stronghold:0': 1 };
  ctx.players[0].advisors = { ...ctx.players[0].advisors, hidden_mobile_stronghold: {} };
  assert.ok(quoteAdvisorTransportMatching(ctx, mobile));
  assert.doesNotThrow(() => validateAdvisorTransportMatching(ctx, source(ctx, mobile)));
});

void test('board matching avoids native grants, hands, wallets, concealed forces, forecasts and unrelated world custody', () => {
  const ctx = context();
  const incoming = intent();
  const original = source(ctx);
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'skills', 'noField', 'eliteForces', 'reserves', 'moved']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Transport matching read ${player.id} private or unrelated ${field}`); },
      });
    }
  }
  for (const stance of Object.values(ctx.players[0].advisors!)) {
    for (const field of ['lockedTurn', 'aloneFlipHold']) {
      Object.defineProperty(stance, field, {
        get() { throw new Error(`Transport matching read unrelated stance ${field}`); },
      });
    }
  }
  for (const object of [ctx, incoming]) {
    for (const field of ['worlds', 'homeworlds', 'nexus', 'grant', 'signature', 'rate', 'forecast', 'stormCard', 'pendingShipment', 'advisorMatchingDenied']) {
      Object.defineProperty(object, field, {
        get() { throw new Error(`Transport matching read private native ${field}`); },
      });
    }
  }
  Object.defineProperty(ctx.players[1], 'forces', {
    get() { throw new Error('Transport matching reran native foreign occupancy'); },
  });
  assert.ok(quoteAdvisorTransportMatching(ctx, incoming));
  assert.doesNotThrow(() => validateAdvisorTransportMatching(ctx, original));
});

void test('world matching reads only the selected owner normal counters without other-world or other-owner values', () => {
  const ctx = context();
  const original = source(ctx, worldIntent());
  for (const world of ctx.worlds!) {
    for (const owner of ['a', 'g']) {
      Object.defineProperty(world.forces, owner, {
        get() { throw new Error(`World matching read foreign ${owner} counters`); },
      });
    }
    Object.defineProperty(world.forces.b, 'elite', {
      get() { throw new Error('World matching used special instead of normal BG counters'); },
    });
  }
  Object.defineProperty(ctx.worlds![2], 'forces', {
    get() { throw new Error('World matching read an unselected world'); },
  });
  for (const player of ctx.players) {
    Object.defineProperty(player, 'reserves', {
      get() { throw new Error('World matching read private native reserve bookkeeping'); },
    });
  }
  assert.ok(quoteAdvisorTransportMatching(ctx, worldIntent()));
  assert.doesNotThrow(() => validateAdvisorTransportMatching(ctx, original));
});
