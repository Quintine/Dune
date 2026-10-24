import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdvisorGatherMatchingError,
  quoteAdvisorGatherMatching,
  type AdvisorGatherMatchingIntent,
} from '../game/advisor-gather-matching';
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
    advanced: true, status: 'playing', turn: 4, phase: 5, active: 'b',
    players: [
      {
        id: 'b', faction: 'beneGesserit', moved: 0,
        forces: {
          'hagga_basin:12': 3, 'hagga_basin:13': 2, 'arrakeen:10': 2,
          'carthag:11': 2, 'imperial_basin:9': 2,
        },
        advisors: { imperial_basin: { lockedTurn: 4 }, carthag: {} },
      },
      { id: 'a', faction: 'atreides', forces: { 'polar_sink:0': 1, 'imperial_basin:9': 1 } },
    ],
  };
}

function intent(fields: Partial<AdvisorGatherMatchingIntent> = {}): AdvisorGatherMatchingIntent {
  return {
    owner: 'b', move: 0, destination: 'imperial_basin', sector: 10, advisors: true,
    group: { 'hagga_basin:12': 1, 'arrakeen:10': 1 }, ...fields,
  };
}

function normal(fields: Partial<AdvisorMatchingIntent> = {}): AdvisorMatchingIntent {
  return {
    kind: 'movement', owner: 'b', move: 0, origin: 'hagga_basin',
    destination: 'imperial_basin', sector: 10, advisors: true,
    group: { 'hagga_basin:12': 1 }, ...fields,
  };
}

void test('resident gather returns one normal quote per changing origin in deterministic order without changing either packet', () => {
  const ctx = context();
  const incoming = intent({ group: { 'hagga_basin:13': 1, 'arrakeen:10': 1, 'hagga_basin:12': 2 } });
  const before = structuredClone({ ctx, incoming });
  const quotes = quoteAdvisorGatherMatching(ctx, incoming);
  assert.deepEqual(quotes, [
    {
      kind: 'movement', owner: 'b', turn: 4, move: 0, origin: 'arrakeen',
      destination: 'imperial_basin', sector: 10, advisors: true, group: { 'arrakeen:10': 1 },
    },
    {
      kind: 'movement', owner: 'b', turn: 4, move: 0, origin: 'hagga_basin',
      destination: 'imperial_basin', sector: 10, advisors: true,
      group: { 'hagga_basin:12': 2, 'hagga_basin:13': 1 },
    },
  ]);
  assert.deepEqual({ ctx, incoming }, before);
  assert.deepEqual(quoteAdvisorGatherMatching(ctx, intent({
    group: { 'hagga_basin:12': 2, 'hagga_basin:13': 1, 'arrakeen:10': 1 },
  })), quotes);
  quotes[1].group['hagga_basin:12'] = 99;
  assert.equal(incoming.group['hagga_basin:12'], 2);
  assert.equal(ctx.players[0].forces['hagga_basin:12'], 3);
});

void test('same-type halves need no counter and mixed gather quotes only its changing incoming half in either stance direction', () => {
  const ctx = context();
  const one = quoteAdvisorGatherMatching(ctx, intent({
    group: { 'carthag:11': 1, 'hagga_basin:12': 1 },
  }));
  assert.equal(one.length, 1);
  assert.equal(one[0].origin, 'hagga_basin');
  assert.equal(one[0].advisors, true);
  const fighters = quoteAdvisorGatherMatching(ctx, intent({
    destination: 'arrakeen', sector: 10, advisors: false,
    group: { 'imperial_basin:9': 1, 'carthag:11': 1 },
  }));
  assert.deepEqual(fighters.map((quote) => [quote.origin, quote.advisors]), [
    ['carthag', false], ['imperial_basin', false],
  ]);
  ctx.players[0].advisors = { imperial_basin: {} };
  assert.deepEqual(quoteAdvisorGatherMatching(ctx, intent({
    destination: 'arrakeen', sector: 10, advisors: false,
    group: { 'carthag:11': 1, 'hagga_basin:12': 1 },
  })), []);
});

void test('Basic, other windows, foreign or inactive owners, empty and enemy-only destinations keep their existing nonmatching branch', () => {
  for (const patch of [
    { advanced: false }, { status: 'setup' }, { phase: 4 }, { phase: 6 }, { active: 'a' },
  ]) {
    assert.deepEqual(quoteAdvisorGatherMatching({ ...context(), ...patch }, intent()), []);
  }
  const foreign = context();
  foreign.players[0].faction = 'atreides';
  assert.deepEqual(quoteAdvisorGatherMatching(foreign, intent()), []);
  assert.deepEqual(quoteAdvisorGatherMatching(context(), intent({ owner: 'missing' })), []);
  assert.deepEqual(quoteAdvisorGatherMatching(context(), intent({
    destination: 'polar_sink', sector: 0, advisors: false,
  })), []);
  const empty = context();
  empty.players[0].forces = { ...empty.players[0].forces, 'imperial_basin:9': 0 };
  assert.deepEqual(quoteAdvisorGatherMatching(empty, intent()), []);
  // The original native gather branch remains responsible for its original
  // physical order when there is no resident BG group to match.
  assert.deepEqual(quoteAdvisorGatherMatching(empty, intent({ group: {} })), []);
});

void test('resident gather validates every selected physical packet including a same-type half before any quote is usable', () => {
  const cases: Record<string, number>[] = [
    {}, { 'hagga_basin:12': 1, 'hagga_basin:13': 1 },
    { 'hagga_basin:12': 1, 'arrakeen:10': 1, 'carthag:11': 1 },
    { 'hagga_basin:12': 4, 'arrakeen:10': 1 },
    { 'hagga_basin:12': 1, 'carthag:11': 3 },
    { 'hagga_basin:12': 0, 'arrakeen:10': 1 },
    { 'hagga_basin:12': -1, 'arrakeen:10': 1 },
    { 'hagga_basin:12': 1.5, 'arrakeen:10': 1 },
    { 'hagga_basin:12.0': 1, 'arrakeen:10': 1 },
    { 'hagga_basin:11': 1, 'arrakeen:10': 1 },
    { reserves: 1, 'arrakeen:10': 1 },
    { 'homeworld:beneGesserit': 1, 'arrakeen:10': 1 },
    { 'missing:0': 1, 'arrakeen:10': 1 },
  ];
  for (const group of cases) {
    const ctx = context();
    const incoming = intent({ group });
    const before = structuredClone({ ctx, incoming });
    assert.throws(() => quoteAdvisorGatherMatching(ctx, incoming), AdvisorGatherMatchingError);
    assert.deepEqual({ ctx, incoming }, before);
  }
});

void test('normal movement prevention also denies its identical gather half despite selection reordering or a different destination sector', () => {
  const ctx = context();
  const original = quoteAdvisorMatching(ctx, normal());
  assert.ok(original);
  ctx.advisorMatchingDenied = [advisorMatchingKey(original)];
  const before = structuredClone(ctx);
  assert.throws(() => quoteAdvisorGatherMatching(ctx, intent()), (error: unknown) =>
    error instanceof AdvisorGatherMatchingError && /already prevented/.test(error.message));
  assert.throws(() => quoteAdvisorGatherMatching(ctx, intent({
    sector: 11, group: { 'arrakeen:10': 1, 'hagga_basin:12': 1 },
  })), AdvisorGatherMatchingError);
  assert.deepEqual(ctx, before);
  assert.equal(quoteAdvisorGatherMatching(ctx, intent({
    group: { 'arrakeen:10': 1, 'hagga_basin:12': 2 },
  })).length, 2);
  assert.equal(quoteAdvisorGatherMatching(ctx, intent({ destination: 'carthag', sector: 11 })).length, 2);
  ctx.players[0].moved = 1;
  assert.equal(quoteAdvisorGatherMatching(ctx, intent({ move: 1 })).length, 2);
  ctx.players[0].moved = 0;
  ctx.turn++;
  assert.equal(quoteAdvisorGatherMatching(ctx, intent()).length, 2);
});

void test('a prevented gather origin uses the same normal denial key and cannot be retried as ordinary movement', () => {
  const ctx = context();
  const original = quoteAdvisorGatherMatching(ctx, intent())[0];
  assert.equal(original.origin, 'arrakeen');
  ctx.advisorMatchingDenied = [advisorMatchingKey(original)];
  const ordinary = normal({ origin: 'arrakeen', group: { 'arrakeen:10': 1 } });
  assert.throws(() => quoteAdvisorMatching(ctx, ordinary), AdvisorMatchingError);
  assert.throws(() => validateAdvisorMatching(ctx, {
    event: 'new-counter', ...original, sector: 11,
  }), AdvisorMatchingError);
  assert.ok(quoteAdvisorMatching(ctx, normal()));
});

void test('stale selected groups, current movement and resident stance produce the named gather error without changing the original action', () => {
  const changes: ((ctx: AdvisorMatchingContext, incoming: AdvisorGatherMatchingIntent) => void)[] = [
    (ctx) => { ctx.players[0].moved = 1; },
    (ctx) => { delete ctx.players[0].moved; },
    (ctx) => { ctx.players[0].forces = { ...ctx.players[0].forces, 'arrakeen:10': 0 }; },
    (ctx) => { ctx.players[0].advisors = { carthag: {} }; },
    (_ctx, incoming) => { incoming.advisors = false; },
    (_ctx, incoming) => { incoming.destination = 'imperial_basin'; incoming.sector = 8; },
  ];
  for (const change of changes) {
    const ctx = context();
    const incoming = intent();
    change(ctx, incoming);
    const before = structuredClone({ ctx, incoming });
    assert.throws(() => quoteAdvisorGatherMatching(ctx, incoming), (error: unknown) =>
      error instanceof AdvisorGatherMatchingError && error.name === 'AdvisorGatherMatchingError');
    assert.deepEqual({ ctx, incoming }, before);
  }
});

void test('gather emits the unchanged ordinary movement receipt shape and delegates its actual source validation', () => {
  const ctx = context();
  const quotes = quoteAdvisorGatherMatching(ctx, intent());
  for (const quote of quotes) {
    const original: AdvisorMatchingSource = { event: `counter-${quote.origin}`, ...quote };
    assert.deepEqual(Object.keys(original).sort(), [
      'advisors', 'destination', 'event', 'group', 'kind', 'move', 'origin', 'owner', 'sector', 'turn',
    ]);
    assert.equal(original.kind, 'movement');
    assert.doesNotThrow(() => validateAdvisorMatching(ctx, original));
    assert.throws(() => validateAdvisorMatching(ctx, {
      ...original, gatherOrder: 'private-parent',
    } as AdvisorMatchingSource), AdvisorMatchingError);
  }
});

void test('gather reads public physical counters and stance only, leaving private trainer, routes, concealed forces and funding to the native quote', () => {
  const ctx = context();
  const incoming = intent();
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'skills', 'noField', 'eliteForces', 'reserves', 'shipped']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Gather matching read ${player.id} private or unrelated ${field}`); },
      });
    }
  }
  for (const stance of Object.values(ctx.players[0].advisors!)) {
    for (const field of ['lockedTurn', 'aloneFlipHold']) {
      Object.defineProperty(stance, field, {
        get() { throw new Error(`Gather matching read unrelated stance ${field}`); },
      });
    }
  }
  for (const object of [ctx, incoming]) {
    for (const field of ['leaderSkills', 'planetologist', 'order', 'signature', 'forecast', 'stormCard', 'pendingMove', 'payment']) {
      Object.defineProperty(object, field, {
        get() { throw new Error(`Gather matching read private native ${field}`); },
      });
    }
  }
  Object.defineProperty(ctx.players[1], 'forces', {
    get() { throw new Error('Gather matching reran native foreign occupancy'); },
  });
  assert.equal(quoteAdvisorGatherMatching(ctx, incoming).length, 2);
  const unexpected = new Error('native physical getter failure');
  Object.defineProperty(ctx.players[0], 'moved', { get() { throw unexpected; } });
  assert.throws(() => quoteAdvisorGatherMatching(ctx, incoming), (error: unknown) => error === unexpected);
});
