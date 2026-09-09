import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTupileIntelligenceObservation as append,
  createTupileIntelligenceState as create,
  validateTupileIntelligenceState as validate,
  tupileIntelligenceUsedFactions as used,
  tupileIntelligenceObservationSignature,
  tupileIntelligenceStateSignature,
  type TupileIntelligenceObservation,
  type TupileIntelligenceState,
} from '../game/tupile-intelligence-state';
import type { FactionId } from '../game/catalog';

const players = [
  { id: 'c', faction: 'choam' as const },
  { id: 'e', faction: 'emperor' as const },
  { id: 'a', faction: 'atreides' as const },
];
function observation(): Omit<TupileIntelligenceObservation, 'signature'> {
  return {
    event: 'first-query',
    owner: 'c',
    target: 'e',
    faction: 'emperor',
    category: 'weapons',
    spice: 17,
    count: 2,
    turn: 2,
    phase: 6,
    contact: [
      'homeworld:emperor',
      'homeworld:emperor:salusa',
      'homeworld:choam',
    ],
  };
}
function two() {
  return append(append(create('c'), observation()), {
    ...observation(),
    event: 'second-query',
    target: 'a',
    faction: 'atreides',
    category: 'defenses',
    turn: 3,
    phase: 0,
    spice: 0,
    count: 0,
    contact: ['homeworld:atreides'],
  });
}

void test('new owner ledger and detached observations preserve a historical private answer through JSON and later turns', () => {
  const empty = create('c');
  validate(empty, players, 1);
  assert.deepEqual(used(empty), []);
  const input = observation();
  const state = append(empty, input);
  assert.equal(empty.receipts.length, 0);
  assert.deepEqual(used(state), ['emperor']);
  validate(
    JSON.parse(JSON.stringify(state)) as TupileIntelligenceState,
    players,
    10,
  );
  input.spice = 0;
  input.count = 0;
  input.contact.pop();
  assert.equal(state.receipts[0].spice, 17);
  assert.equal(state.receipts[0].count, 2);
  assert.equal(state.receipts[0].contact.length, 3);
  assert.deepEqual(Object.keys(state).sort(), [
    'owner',
    'receipts',
    'signature',
    'version',
  ]);
});

void test('faction lifetime use never resets with another turn, phase, category, contact direction or target ID', () => {
  const state = append(create('c'), observation());
  const before = JSON.stringify(state);
  for (const change of [
    { event: 'new-query' },
    { event: 'new-query', turn: 7, phase: 0 },
    { event: 'new-query', category: 'defenses' as const },
    { event: 'new-query', contact: ['homeworld:choam'] },
    { event: 'new-query', contact: ['homeworld:emperor:salusa'] },
    { event: 'new-query', target: 'new-emperor-seat' },
  ])
    assert.throws(() => append(state, { ...observation(), ...change }));
  assert.throws(() =>
    append(state, {
      ...observation(),
      target: 'a',
      faction: 'atreides',
      contact: ['homeworld:atreides'],
    }),
  );
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(used(two()), ['emperor', 'atreides']);
});

void test('only physical owner/target Homeworld IDs supply historical provenance, with both Emperor worlds allowed', () => {
  for (const contact of [
    ['homeworld:choam'],
    ['homeworld:emperor'],
    ['homeworld:emperor:salusa'],
  ])
    validate(append(create('c'), { ...observation(), contact }), players, 2);
  for (const contact of [
    [],
    ['homeworld:emperor', 'homeworld:emperor'],
    ['kaitain'],
    ['salusa_secundus'],
    ['homeworld:atreides'],
    ['arrakeen'],
    ['homeworld:choam:salusa'],
  ])
    assert.throws(() => append(create('c'), { ...observation(), contact }));
  assert.throws(() =>
    append(create('c'), {
      ...observation(),
      target: 'a',
      faction: 'atreides',
      contact: ['homeworld:emperor:salusa'],
    }),
  );
});

void test('every signed observation field and the ledger order, version and receipt membership resist corruption', () => {
  const original = two();
  const mutations: ((state: TupileIntelligenceState) => void)[] = [
    (s) => {
      s.owner = 'a';
    },
    (s) => {
      s.version = 0 as 1;
    },
    (s) => {
      s.receipts.pop();
    },
    (s) => {
      s.receipts.reverse();
    },
    (s) => {
      s.receipts[0].event = 'changed';
    },
    (s) => {
      s.receipts[0].owner = 'a';
    },
    (s) => {
      s.receipts[0].target = 'a';
    },
    (s) => {
      s.receipts[0].faction = 'atreides';
    },
    (s) => {
      s.receipts[0].category = 'defenses';
    },
    (s) => {
      s.receipts[0].spice++;
    },
    (s) => {
      s.receipts[0].count++;
    },
    (s) => {
      s.receipts[0].turn++;
    },
    (s) => {
      s.receipts[0].phase++;
    },
    (s) => {
      s.receipts[0].contact.reverse();
    },
    (s) => {
      delete (s.receipts[0] as Partial<TupileIntelligenceObservation>)
        .signature;
    },
    (s) => {
      delete (s as Partial<TupileIntelligenceState>).signature;
    },
  ];
  for (const mutate of mutations) {
    const state = structuredClone(original);
    mutate(state);
    const before = JSON.stringify(state);
    assert.throws(() => validate(state, players, 5));
    assert.throws(() => used(state));
    assert.equal(JSON.stringify(state), before);
  }
  // Object key order is not observation order and survives ordinary JSON tooling.
  const reordered = JSON.parse(
    JSON.stringify(original),
    (_key, value: unknown) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value,
  ) as TupileIntelligenceState;
  validate(reordered, players, 5);
});

void test('valid signatures cannot disguise invalid participants, duplicate faction use or a future observation', () => {
  const state = append(create('c'), observation());
  for (const seats of [
    players.filter((p) => p.id !== 'e'),
    players.map((p) =>
      p.id === 'e' ? { ...p, faction: 'guild' as const } : p,
    ),
    players.map((p) =>
      p.id === 'c' ? { ...p, faction: 'guild' as const } : p,
    ),
    [...players, { id: 'replacement', faction: 'emperor' as const }],
    [...players, { id: 'a', faction: 'guild' as const }],
  ])
    assert.throws(() => validate(state, seats, 2));
  assert.throws(() => validate(state, players, 1));
  for (const turn of [-1, 0, 1.5, Infinity])
    assert.throws(() => validate(state, players, turn));
  const duplicate = structuredClone(state);
  const extra = {
    ...duplicate.receipts[0],
    event: 'new-event',
    target: 'new-target',
  };
  extra.signature = tupileIntelligenceObservationSignature(extra);
  duplicate.receipts.push(extra);
  duplicate.signature = tupileIntelligenceStateSignature(duplicate);
  assert.throws(() => validate(duplicate, players, 2));
});

void test('malformed observations reject before append and never preserve a hidden hand or partial disclosure', () => {
  const state = create('c');
  const before = JSON.stringify(state);
  for (const patch of [
    { event: '' },
    { owner: 'other' },
    { target: 'c' },
    { faction: 'choam' },
    { faction: 'invented' },
    { category: 'both' },
    { spice: -1 },
    { spice: NaN },
    { spice: Number.MAX_SAFE_INTEGER + 1 },
    { count: -1 },
    { count: 0.5 },
    { turn: 0 },
    { phase: 9 },
    { phase: -1 },
    { signature: 'wrong' },
    { hand: ['private-card'] },
  ]) {
    assert.throws(() =>
      append(state, { ...observation(), ...patch } as Parameters<
        typeof append
      >[1]),
    );
    assert.equal(JSON.stringify(state), before);
  }
  const maximum = append(state, {
    ...observation(),
    spice: Number.MAX_SAFE_INTEGER,
    count: Number.MAX_SAFE_INTEGER,
  });
  validate(maximum, players, 2);
  assert.throws(() => create('   '));
  assert.throws(() =>
    validate(null as unknown as TupileIntelligenceState, players, 2),
  );
});

void test('public validation reads no private fields and immutable inputs or returned use lists cannot alter receipts', () => {
  const state = two();
  const seats: { id: string; faction: FactionId }[] = structuredClone(players);
  for (const seat of seats)
    for (const field of [
      'spice',
      'hand',
      'forces',
      'reserves',
      'traitors',
      'battlePlan',
    ])
      Object.defineProperty(seat, field, {
        get() {
          throw new Error(`Private ${field}`);
        },
      });
  for (const receipt of state.receipts) {
    Object.freeze(receipt.contact);
    Object.freeze(receipt);
  }
  Object.freeze(state.receipts);
  Object.freeze(state);
  validate(state, seats, 4);
  const factions = used(state);
  factions.pop();
  assert.deepEqual(used(state), ['emperor', 'atreides']);
  const next = append(state, {
    ...observation(),
    event: 'third',
    target: 'g',
    faction: 'guild',
    contact: ['homeworld:guild'],
  });
  assert.notEqual(next.receipts[0], state.receipts[0]);
  assert.notEqual(next.receipts[0].contact, state.receipts[0].contact);
  assert.equal(state.receipts.length, 2);
  validate(next, [...seats, { id: 'g', faction: 'guild' }], 4);
});
