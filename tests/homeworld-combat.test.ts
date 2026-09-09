import test from 'node:test';
import assert from 'node:assert/strict';
import {
  homeworldCombatArmy,
  homeworldCombatLocation,
  quoteHomeworldBattles,
  type HomeworldCombatContext,
} from '../game/homeworld-combat';
import {
  createHomeworldCustody,
  type HomeworldCustody,
} from '../game/homeworld-custody';

function fixture(advanced = true) {
  const context: HomeworldCombatContext = {
    advanced,
    order: ['a', 'e', 'f'],
    players: [
      {
        id: 'e',
        faction: 'emperor',
        reserves: 8,
        eliteReserves: 2,
        ally: null,
      },
      { id: 'f', faction: 'fremen', reserves: 6, eliteReserves: 1, ally: null },
      {
        id: 'a',
        faction: 'atreides',
        reserves: 6,
        eliteReserves: 0,
        ally: null,
      },
    ],
  };
  const custody: HomeworldCustody = createHomeworldCustody(context);
  custody.visitors['homeworld:emperor'] = {
    f: { normal: 2, elite: 2 },
    a: { normal: 3, elite: 0 },
  };
  return { context, custody };
}

void test('Basic Emperor has one canonical native army and preserves both native and invading special counters', () => {
  const { context, custody } = fixture(false);
  assert.deepEqual(
    homeworldCombatLocation(context, custody, 'homeworld:emperor'),
    {
      id: 'homeworld:emperor',
      name: 'Kaitain',
      native: 'e',
      card: 'kaitain',
      population: 8,
      side: 'high',
      nativeBattleStrength: 2,
      forces: {
        e: { normal: 6, elite: 2 },
        f: { normal: 2, elite: 2 },
        a: { normal: 3, elite: 0 },
      },
    },
  );
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'e'),
    {
      player: 'e',
      normal: 6,
      elite: 2,
      native: true,
      nativeBattleStrength: 2,
    },
  );
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'f'),
    {
      player: 'f',
      normal: 2,
      elite: 2,
      native: false,
      nativeBattleStrength: 0,
    },
  );
  assert.throws(
    () => homeworldCombatLocation(context, custody, 'homeworld:emperor:salusa'),
    /canonical Homeworld/,
  );
});

void test('Advanced Emperor sources stay separate and each native battle bonus follows its own population measure', () => {
  const { context, custody } = fixture();
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'e'),
    {
      player: 'e',
      normal: 6,
      elite: 0,
      native: true,
      nativeBattleStrength: 2,
    },
  );
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor:salusa', 'e'),
    {
      player: 'e',
      normal: 0,
      elite: 2,
      native: true,
      nativeBattleStrength: 3,
    },
  );
  const atBoundary = homeworldCombatLocation(
    context,
    custody,
    'homeworld:emperor:salusa',
  );
  assert.equal(atBoundary.name, 'Salusa Secundus');
  assert.equal(atBoundary.card, 'salusa_secundus');
  assert.equal(atBoundary.population, 2);
  assert.equal(atBoundary.side, 'high');
  // A conserved public position after an authorized transfer elsewhere. These
  // quotes do not authorize that movement or reinterpret normal men as stars.
  custody.salusa = { normal: 3, elite: 1 };
  const kaitain = homeworldCombatLocation(
    context,
    custody,
    'homeworld:emperor',
  );
  const salusa = homeworldCombatLocation(
    context,
    custody,
    'homeworld:emperor:salusa',
  );
  assert.deepEqual(
    [kaitain.population, kaitain.side, kaitain.nativeBattleStrength],
    [4, 'low', 3],
  );
  assert.deepEqual(
    [salusa.population, salusa.side, salusa.nativeBattleStrength],
    [1, 'low', 2],
  );
  assert.deepEqual(kaitain.forces.e, { normal: 3, elite: 1 });
  assert.deepEqual(salusa.forces.e, { normal: 3, elite: 1 });
});

void test('three armies pair in current attacker order without a stronghold cap or native-defender preference', () => {
  const { context, custody } = fixture();
  assert.deepEqual(quoteHomeworldBattles(context, custody), [
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'f' },
    { territory: 'homeworld:emperor', attacker: 'e', defender: 'f' },
  ]);
  context.order = ['f', 'e', 'a'];
  assert.deepEqual(quoteHomeworldBattles(context, custody), [
    { territory: 'homeworld:emperor', attacker: 'f', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'f', defender: 'a' },
    { territory: 'homeworld:emperor', attacker: 'e', defender: 'a' },
  ]);
});

void test('allied foreign armies remain separate opponents of the native and never fight one another', () => {
  const { context, custody } = fixture();
  context.players[1].ally = 'a';
  context.players[2].ally = 'f';
  assert.deepEqual(quoteHomeworldBattles(context, custody), [
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'e', defender: 'f' },
  ]);
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'f'),
    {
      player: 'f',
      normal: 2,
      elite: 2,
      native: false,
      nativeBattleStrength: 0,
    },
  );
});

void test('an empty native reserve never becomes a phantom defender and missing or zero visitors never become armies', () => {
  const { context, custody } = fixture(false);
  context.players[0].reserves = 0;
  context.players[0].eliteReserves = 0;
  assert.deepEqual(quoteHomeworldBattles(context, custody), [
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'f' },
  ]);
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'e'),
    {
      player: 'e',
      normal: 0,
      elite: 0,
      native: true,
      nativeBattleStrength: 3,
    },
  );
  custody.visitors['homeworld:emperor'].a = { normal: 0, elite: 0 };
  assert.deepEqual(quoteHomeworldBattles(context, custody), []);
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:fremen', 'e'),
    {
      player: 'e',
      normal: 0,
      elite: 0,
      native: false,
      nativeBattleStrength: 0,
    },
  );
  assert.throws(
    () => homeworldCombatArmy(context, custody, 'homeworld:fremen', 'unseated'),
    /seated Homeworld combatant/,
  );
});

void test('global attacker order covers both Emperor homes without merging native reserves or changing defender-seat order', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:emperor:salusa'] = { a: { normal: 1, elite: 0 } };
  assert.deepEqual(quoteHomeworldBattles(context, custody), [
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'a', defender: 'f' },
    { territory: 'homeworld:emperor:salusa', attacker: 'a', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'e', defender: 'f' },
  ]);
});

void test('noncanonical aliases, inactive factions, invalid order and malformed alliances reject instead of guessing a battle context', () => {
  const { context, custody } = fixture();
  for (const location of [
    'kaitain',
    'homeworld:emperor:0',
    'homeworld:emperor ',
    'homeworld:Emperor',
    'homeworld:choam',
    'arrakeen',
    '__proto__',
  ])
    assert.throws(
      () => homeworldCombatLocation(context, custody, location),
      /canonical Homeworld/,
    );
  for (const order of [
    [],
    ['a', 'e'],
    ['a', 'e', 'e'],
    ['a', 'e', 'unknown'],
    ['a', 'e', 'f', 'unknown'],
  ])
    assert.throws(
      () => quoteHomeworldBattles({ ...context, order }, custody),
      /complete distinct player order/,
    );
  for (const ally of ['e', 'unknown', 'a']) {
    const malformed = structuredClone(context);
    malformed.players[0].ally = ally;
    assert.throws(
      () => quoteHomeworldBattles(malformed, custody),
      /reciprocal alliances/,
    );
  }
  assert.throws(
    () =>
      quoteHomeworldBattles(context, {
        ...custody,
        salusa: { normal: 7, elite: 2 },
      }),
    /within Emperor/,
  );
  assert.throws(
    () =>
      quoteHomeworldBattles(context, {
        ...custody,
        visitors: { 'homeworld:unseated': {} },
      }),
    /active Homeworld/,
  );
});

void test('public-only projection ignores poisoned cards, resources, Arrakis geometry, advisors and occupation metadata', () => {
  const { context, custody } = fixture();
  const expected = quoteHomeworldBattles(context, custody);
  const home = homeworldCombatLocation(context, custody, 'homeworld:emperor');
  const army = homeworldCombatArmy(context, custody, 'homeworld:emperor', 'f');
  const poison = (target: object, keys: string[]) => {
    for (const key of keys)
      Object.defineProperty(target, key, {
        enumerable: true,
        get() {
          throw new Error(`Unexpected field read: ${key}`);
        },
      });
  };
  poison(context, [
    'storm',
    'deck',
    'discard',
    'spice',
    'rng',
    'battle',
    'mobileStronghold',
    'homeworldOccupation',
  ]);
  for (const player of context.players)
    poison(player, [
      'hand',
      'traitors',
      'leaders',
      'spice',
      'forces',
      'advisors',
      'noField',
      'prediction',
      'faceDancers',
    ]);
  assert.deepEqual(quoteHomeworldBattles(context, custody), expected);
  assert.deepEqual(
    homeworldCombatLocation(context, custody, 'homeworld:emperor'),
    home,
  );
  assert.deepEqual(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'f'),
    army,
  );
});

void test('snapshots survive JSON restoration and returned pool edits never mutate input or future quotes, including special object-key seat IDs', () => {
  const { context, custody } = fixture();
  context.players[2].id = '__proto__';
  context.order = ['__proto__', 'e', 'f'];
  custody.visitors['homeworld:emperor'] = Object.fromEntries([
    ['f', { normal: 2, elite: 2 }],
    ['__proto__', { normal: 3, elite: 0 }],
  ]);
  const before = structuredClone({ context, custody });
  const home = homeworldCombatLocation(context, custody, 'homeworld:emperor');
  const army = homeworldCombatArmy(
    context,
    custody,
    'homeworld:emperor',
    '__proto__',
  );
  assert.equal(army.normal, 3);
  const expected = quoteHomeworldBattles(context, custody);
  const restored = JSON.parse(
    JSON.stringify({ context, custody }),
  ) as typeof before;
  assert.deepEqual(
    quoteHomeworldBattles(restored.context, restored.custody),
    expected,
  );
  home.forces.f.normal = 19;
  home.forces.e.elite = 5;
  army.normal = 19;
  assert.deepEqual({ context, custody }, before);
  assert.equal(
    homeworldCombatArmy(context, custody, 'homeworld:emperor', 'f').normal,
    2,
  );
  assert.deepEqual(quoteHomeworldBattles(context, custody), expected);
});
