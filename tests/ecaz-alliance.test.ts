import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from '../game/catalog';
import {
  quoteEcazAlliance as quote,
  ecazAllianceBlock as block,
  EcazAllianceError,
  type EcazAllianceContext,
} from '../game/ecaz-alliance';

function context(): EcazAllianceContext {
  return {
    status: 'playing',
    turn: 4,
    players: [
      { id: 'e', faction: 'ecaz', ally: null, allySinceTurn: 2 },
      { id: 'a', faction: 'atreides', ally: null },
      { id: 'h', faction: 'harkonnen', ally: 'g', allySinceTurn: 1 },
      { id: 'g', faction: 'guild', ally: 'h', allySinceTurn: 1 },
      { id: 'f', faction: 'fremen', ally: null },
      { id: 'b', faction: 'beneGesserit', ally: null },
    ],
    allianceOffers: { e: 'f', a: 'b', h: 'e', g: 'a', f: 'b', b: 'f' },
  };
}
function reject(g: EcazAllianceContext, owner = 'e', entrant = 'a') {
  const before = structuredClone(g);
  assert.throws(() => quote(g, owner, entrant), EcazAllianceError);
  assert.equal(typeof block(g, owner, entrant), 'string');
  assert.deepEqual(g, before);
}

void test('forms the reciprocal pair with current tenure and clears all offers to or from either seat', () => {
  const g = context();
  const before = structuredClone(g);
  const result = quote(g, 'e', 'a');
  assert.deepEqual(result.players.slice(0, 2), [
    { id: 'e', faction: 'ecaz', ally: 'a', allySinceTurn: 4 },
    { id: 'a', faction: 'atreides', ally: 'e', allySinceTurn: 4 },
  ]);
  assert.deepEqual(result.players.slice(2), g.players.slice(2));
  assert.deepEqual(result.allianceOffers, { f: 'b', b: 'f' });
  assert.equal(block(g, 'e', 'a'), null);
  assert.deepEqual(g, before);
  for (let i = 0; i < g.players.length; i++)
    assert.notEqual(result.players[i], g.players[i]);
  result.players[2].ally = null;
  result.allianceOffers.f = 'e';
  assert.deepEqual(g, before);
});

void test('every other faction can be the consenting unallied entrant without a Duke prerequisite', () => {
  for (const faction of FACTIONS.filter((f) => f.id !== 'ecaz')) {
    const g: EcazAllianceContext = {
      status: 'playing',
      turn: 1,
      players: [
        { id: 'e', faction: 'ecaz', ally: null },
        { id: 'a', faction: faction.id, ally: null },
      ],
      allianceOffers: {},
    };
    assert.equal(quote(g, 'e', 'a').players[1].ally, 'e');
    assert.equal(block(g, 'e', 'a'), null);
  }
});

void test('rejects either already-allied participant and all dangling or asymmetric references', () => {
  for (const member of ['e', 'a']) {
    const g = context();
    const seats = g.players.map((p) => ({ ...p }));
    seats.find((p) => p.id === member)!.ally = 'f';
    seats.find((p) => p.id === 'f')!.ally = member;
    g.players = seats;
    reject(g);
  }
  for (const ally of ['e', 'a', 'missing', 'f']) {
    const g = context();
    g.players = g.players.map((p) => (p.id === 'f' ? { ...p, ally } : p));
    reject(g);
  }
  const g = context();
  g.players = g.players.map((p) => (p.id === 'h' ? { ...p, ally: null } : p));
  reject(g);
});

void test('rejects malformed roster, lifecycle, identity and tenure without mutation', () => {
  for (const mutate of [
    (g: EcazAllianceContext) => {
      g.status = 'setup';
    },
    (g: EcazAllianceContext) => {
      g.status = 'finished';
    },
    (g: EcazAllianceContext) => {
      g.status = 'lobby';
    },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(
      (turn) => (g: EcazAllianceContext) => {
        g.turn = turn;
      },
    ),
    (g: EcazAllianceContext) => {
      g.players = [];
    },
    (g: EcazAllianceContext) => {
      g.players = [...g.players, { ...g.players[0] }];
    },
    (g: EcazAllianceContext) => {
      g.players = [...g.players, { ...g.players[0], id: 'other' }];
    },
    ...['', ' ', null, 'unknown'].map((faction) => (g: EcazAllianceContext) => {
      g.players = g.players.map((p, i) =>
        i === 0 ? ({ ...p, faction } as typeof p) : p,
      );
    }),
    ...[-1, 5, 0.5, NaN, null].map((stamp) => (g: EcazAllianceContext) => {
      g.players = g.players.map((p, i) =>
        i === 0 ? ({ ...p, allySinceTurn: stamp } as typeof p) : p,
      );
    }),
    (g: EcazAllianceContext) => {
      g.players = g.players.map((p, i) => (i === 0 ? { ...p, id: '' } : p));
    },
    (g: EcazAllianceContext) => {
      g.players = g.players.map((p, i) =>
        i === 0 ? ({ ...p, ally: undefined } as unknown as typeof p) : p,
      );
    },
  ]) {
    const g = context();
    mutate(g);
    reject(g);
  }
  for (const [owner, entrant] of [
    ['a', 'e'],
    ['e', 'e'],
    ['absent', 'a'],
    ['e', 'absent'],
    ['', 'a'],
  ])
    reject(context(), owner, entrant);
});

void test('rejects malformed offer records instead of preserving invalid endpoints', () => {
  for (const offers of [
    null,
    [],
    { absent: 'e' },
    { e: 'absent' },
    { e: 'e' },
    { e: 4 },
    { e: '' },
  ]) {
    const g = context();
    g.allianceOffers = offers as unknown as Record<string, string>;
    reject(g);
  }
});

void test('JSON roundtrip preserves the quote and an already-formed result cannot be applied twice', () => {
  const g = context();
  const result = quote(g, 'e', 'a');
  assert.deepEqual(quote(JSON.parse(JSON.stringify(g)), 'e', 'a'), result);
  reject({ ...g, ...result });
});

void test('private getters and random state are not read or copied into the public result', () => {
  const g = context();
  const forbidden = {
    get() {
      throw new Error('private state read');
    },
    enumerable: true,
  };
  for (const key of ['duke', 'deck', 'rng', 'prediction', 'spice'])
    Object.defineProperty(g, key, forbidden);
  for (const seat of g.players)
    for (const key of ['hand', 'spice', 'leaders', 'prediction'])
      Object.defineProperty(seat, key, forbidden);
  Object.freeze(g.allianceOffers);
  g.players.forEach(Object.freeze);
  Object.freeze(g.players);
  Object.freeze(g);
  const original = Math.random;
  Math.random = () => {
    throw new Error('RNG read');
  };
  try {
    const result = quote(g, 'e', 'a');
    assert.equal(block(g, 'e', 'a'), null);
    assert.deepEqual(Object.keys(result).sort(), ['allianceOffers', 'players']);
    assert.deepEqual(Object.keys(result.players[1]).sort(), [
      'ally',
      'allySinceTurn',
      'faction',
      'id',
    ]);
  } finally {
    Math.random = original;
  }
});

void test('seated prototype-like IDs remain plain own offer keys without prototype mutation', () => {
  const g: EcazAllianceContext = {
    status: 'playing',
    turn: 2,
    players: [
      { id: 'e', faction: 'ecaz', ally: null },
      { id: 'a', faction: 'atreides', ally: null },
      { id: '__proto__', faction: 'fremen', ally: null },
      { id: 'constructor', faction: 'guild', ally: null },
    ],
    allianceOffers: JSON.parse(
      '{"__proto__":"constructor","constructor":"__proto__"}',
    ),
  };
  const result = quote(g, 'e', 'a');
  assert.equal(Object.getPrototypeOf(result.allianceOffers), Object.prototype);
  assert.deepEqual(Object.entries(result.allianceOffers), [
    ['__proto__', 'constructor'],
    ['constructor', '__proto__'],
  ]);
});
