import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  createHomeworldCustody as create,
  homeworldForceGroups as groups,
  homeworldLocations as locations,
  quoteHomeworldCustody as quote,
  HomeworldCustodyError,
  type HomeworldCustodyContext as Context,
  type HomeworldCustody as State,
  type HomeworldCustodyChange as Change,
} from '../game/homeworld-custody';

const caps = { emperor: 5, fremen: 3, ixians: 7 };
const cap = (f: FactionId) => caps[f as keyof typeof caps] ?? 0;
const home = (f: FactionId) => `homeworld:${f}`;
const salusa = 'homeworld:emperor:salusa';
const units = (normal = 0, elite = 0) => ({ normal, elite });
function context(
  advanced = true,
  factions: FactionId[] = ['emperor', 'atreides', 'fremen'],
): Context {
  return {
    advanced,
    players: factions.map((f) => ({
      id: f,
      faction: f,
      reserves: 20,
      eliteReserves: cap(f),
    })),
  };
}
function change(
  homeworld: string,
  player: string,
  withdraw = units(),
  deposit = units(),
): Change {
  return { homeworld, player, withdraw, deposit };
}
function native(g: Context, state: State, location: string, id: string) {
  return groups(g, state).find((h) => h.id === location)!.forces[id];
}
function apply(g: Context, state: State, changes: Change[]) {
  const before = structuredClone({ g, state, changes });
  const result = quote(g, state, changes);
  assert.deepEqual({ g, state, changes }, before);
  return {
    g: { advanced: g.advanced, players: result.players },
    state: result.state,
    receipts: result.receipts,
  };
}
function physical(g: Context, state: State, id: string) {
  return groups(g, state).reduce(
    (n, h) => n + (h.forces[id]?.normal ?? 0) + (h.forces[id]?.elite ?? 0),
    0,
  );
}
function reject(g: Context, state: State, changes: Change[] = []) {
  const before = structuredClone({ g, state, changes });
  assert.throws(() => quote(g, state, changes), HomeworldCustodyError);
  assert.deepEqual({ g, state, changes }, before);
}

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'}: all 57 base rosters create only seated Homeworlds with conserved native custody`, () => {
    const base = FACTIONS.filter((f) => f.expansion === 'base').map(
      (f) => f.id,
    );
    let checked = 0;
    for (let mask = 0; mask < 1 << base.length; mask++) {
      const roster = base.filter((_, i) => mask & (1 << i));
      if (roster.length < 2) continue;
      const g = context(advanced, roster),
        before = structuredClone(g);
      const state = create(g),
        list = locations(g),
        pools = groups(g, state);
      assert.equal(
        list.length,
        roster.length + Number(advanced && roster.includes('emperor')),
      );
      assert.equal(new Set(list.map((h) => h.id)).size, list.length);
      assert.deepEqual(
        pools.map(({ forces: _, ...h }) => h),
        list,
      );
      assert.deepEqual(state.visitors, {});
      for (const p of g.players) assert.equal(physical(g, state, p.id), 20);
      assert.deepEqual(g, before);
      checked++;
    }
    assert.equal(checked, 57);
  });

void test('every expansion faction receives its own home without adding unseated component locations', () => {
  for (const f of FACTIONS.filter((f) => f.expansion !== 'base')) {
    const g = context(true, ['atreides', f.id]);
    assert.deepEqual(
      locations(g).map((h) => h.id),
      [home('atreides'), home(f.id)],
    );
    assert.deepEqual(
      native(g, create(g), home(f.id), f.id),
      units(20 - cap(f.id), cap(f.id)),
    );
  }
});

void test('Advanced initial Sardaukar are in Salusa; Basic typed reserves remain at the single native home', () => {
  for (const advanced of [false, true]) {
    const g = context(advanced),
      state = create(g);
    assert.deepEqual(state.salusa, advanced ? units(0, 5) : null);
    assert.deepEqual(
      native(g, state, home('emperor'), 'emperor'),
      advanced ? units(15) : units(15, 5),
    );
    if (advanced)
      assert.deepEqual(native(g, state, salusa, 'emperor'), units(0, 5));
  }
});

void test('both Emperor force types transfer between native homes without changing reserve totals', () => {
  const g = context(),
    state = create(g);
  const result = apply(g, state, [
    change(home('emperor'), 'emperor', units(4)),
    change(salusa, 'emperor', units(), units(4)),
    change(salusa, 'emperor', units(0, 2)),
    change(home('emperor'), 'emperor', units(), units(0, 2)),
  ]);
  assert.deepEqual(result.g.players, g.players);
  assert.deepEqual(
    native(result.g, result.state, home('emperor'), 'emperor'),
    units(11, 2),
  );
  assert.deepEqual(
    native(result.g, result.state, salusa, 'emperor'),
    units(4, 3),
  );
  assert.equal(result.receipts.length, 2);
  assert.deepEqual(result.receipts[0], {
    homeworld: home('emperor'),
    player: 'emperor',
    before: units(15),
    after: units(11, 2),
  });
});

void test('atomic mixed-home shipment withdraws the exact chosen types regardless of change order', () => {
  const g = context(),
    state = create(g);
  const moved = apply(g, state, [
    change(home('emperor'), 'emperor', units(4)),
    change(salusa, 'emperor', units(), units(4)),
  ]);
  const debits = [
    change(home('emperor'), 'emperor', units(3)),
    change(salusa, 'emperor', units(2, 4)),
  ];
  const a = apply(moved.g, moved.state, debits),
    b = apply(moved.g, moved.state, [...debits].reverse());
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.g, b.g);
  assert.equal(a.g.players[0].reserves, 11);
  assert.equal(a.g.players[0].eliteReserves, 1);
  assert.deepEqual(native(a.g, a.state, home('emperor'), 'emperor'), units(8));
  assert.deepEqual(a.state.salusa, units(2, 1));
});

void test('foreign movement keeps visitors out of host reserves and own-native return credits the traveler once', () => {
  let g = context(),
    state = create(g);
  let result = apply(g, state, [
    change(home('atreides'), 'atreides', units(6)),
    change(home('fremen'), 'atreides', units(), units(6)),
  ]);
  g = result.g;
  state = result.state;
  assert.equal(g.players.find((p) => p.id === 'fremen')!.reserves, 20);
  assert.equal(g.players.find((p) => p.id === 'atreides')!.reserves, 14);
  result = apply(g, state, [
    change(home('fremen'), 'atreides', units(6)),
    change(salusa, 'atreides', units(), units(6)),
  ]);
  assert.equal(physical(result.g, result.state, 'atreides'), 20);
  assert.deepEqual(result.state.visitors, { [salusa]: { atreides: units(6) } });
  result = apply(result.g, result.state, [
    change(salusa, 'atreides', units(6)),
    change(home('atreides'), 'atreides', units(), units(6)),
  ]);
  assert.deepEqual(result.state.visitors, {});
  assert.equal(result.g.players.find((p) => p.id === 'atreides')!.reserves, 20);
});

void test('revival deposits and native casualties use explicit home pools without authorizing the caller effect', () => {
  const g = context();
  g.players[0].reserves = 12;
  g.players[0].eliteReserves = 2;
  const state = create(g);
  const revived = apply(g, state, [
    change(home('emperor'), 'emperor', units(), units(3)),
    change(salusa, 'emperor', units(), units(0, 2)),
  ]);
  assert.equal(revived.g.players[0].reserves, 17);
  assert.deepEqual(revived.state.salusa, units(0, 4));
  const lost = apply(revived.g, revived.state, [
    change(salusa, 'emperor', units(0, 3)),
  ]);
  assert.equal(lost.g.players[0].reserves, 14);
  assert.deepEqual(
    native(lost.g, lost.state, home('emperor'), 'emperor'),
    units(13),
  );
  reject(revived.g, revived.state, [
    change(home('emperor'), 'emperor', units(0, 1)),
  ]);
});

void test('visitor casualties debit only the visiting group and retain native reserve totals', () => {
  const g = context();
  g.players[0].reserves = 16;
  g.players[0].eliteReserves = 3;
  const state = create(g);
  state.visitors[home('atreides')] = { emperor: units(2, 2) };
  const result = apply(g, state, [
    change(home('atreides'), 'emperor', units(1, 2)),
  ]);
  assert.deepEqual(result.g.players, g.players);
  assert.deepEqual(result.state.visitors[home('atreides')].emperor, units(1));
  assert.deepEqual(result.receipts[0].before, units(2, 2));
  assert.deepEqual(result.receipts[0].after, units(1));
});

void test('typed Emperor visitors returning to Salusa credit that native pool and remain distinct from Kaitain', () => {
  const g = context();
  g.players[0].reserves = 16;
  g.players[0].eliteReserves = 3;
  const state = create(g);
  state.visitors[home('atreides')] = { emperor: units(2, 2) };
  const result = apply(g, state, [
    change(home('atreides'), 'emperor', units(2, 2)),
    change(salusa, 'emperor', units(), units(2, 2)),
  ]);
  assert.deepEqual(result.state.visitors, {});
  assert.deepEqual(result.state.salusa, units(2, 5));
  assert.deepEqual(
    native(result.g, result.state, home('emperor'), 'emperor'),
    units(13),
  );
  assert.equal(result.g.players[0].reserves, 20);
  assert.equal(physical(result.g, result.state, 'emperor'), 20);
});

void test('duplicate changes aggregate against the pretransaction pool and cannot spend an incoming deposit', () => {
  const g = context(),
    state = create(g);
  const result = apply(g, state, [
    change(home('atreides'), 'atreides', units(2)),
    change(home('atreides'), 'atreides', units(3)),
  ]);
  assert.equal(result.receipts.length, 1);
  assert.deepEqual(result.receipts[0].after, units(15));
  reject(g, state, [
    change(home('atreides'), 'atreides', units(11)),
    change(home('atreides'), 'atreides', units(10)),
  ]);
  reject(g, state, [
    change(home('fremen'), 'atreides', units(), units(1)),
    change(home('fremen'), 'atreides', units(1)),
  ]);
});

void test('native totals and Salusa typed bounds reject wrong-pool withdrawals instead of clamping', () => {
  const g = context(),
    state = create(g);
  reject(g, state, [change(home('emperor'), 'emperor', units(16))]);
  reject(g, state, [change(home('emperor'), 'emperor', units(0, 1))]);
  reject(g, state, [change(salusa, 'emperor', units(1))]);
  for (const allocation of [
    units(16),
    units(0, 6),
    units(-1),
    units(1.5),
    units(0, NaN),
  ]) {
    const malformed = structuredClone(state);
    malformed.salusa = allocation;
    reject(g, malformed);
  }
});

void test('printed special-counter caps include native and all foreign Homeworld pools', () => {
  for (const faction of ['emperor', 'fremen', 'ixians'] as const) {
    const g = context(true, [faction, 'atreides', 'ecaz']);
    g.players[0].reserves = 10;
    g.players[0].eliteReserves = cap(faction) - 1;
    const state = create(g);
    state.visitors[home('atreides')] = { [faction]: units(0, 1) };
    assert.doesNotThrow(() => groups(g, state));
    const duplicate = structuredClone(state);
    duplicate.visitors[home('ecaz')] = { [faction]: units(0, 1) };
    reject(g, duplicate);
    reject(g, state, [change(home('ecaz'), faction, units(), units(0, 1))]);
    const tooMany = structuredClone(g);
    tooMany.players[0].eliteReserves = cap(faction) + 1;
    assert.throws(() => create(tooMany), HomeworldCustodyError);
  }
  const g = context(),
    state = create(g);
  g.players[1].reserves = 19;
  state.visitors[home('emperor')] = { atreides: units(0, 1) };
  reject(g, state);
});

void test('malformed ledgers reject foreign native aliases, inactive homes, extra custody and invalid typed values', () => {
  const g = context(),
    state = create(g);
  const malformed: State[] = [
    { ...state, visitors: { [home('atreides')]: { atreides: units(1) } } },
    { ...state, visitors: { [home('ixians')]: { atreides: units(1) } } },
    { ...state, visitors: { [home('atreides')]: { missing: units(1) } } },
    { ...state, visitors: { [home('atreides')]: { emperor: units(1) } } },
    { ...state, visitors: { [home('atreides')]: { emperor: units(-1) } } },
  ];
  for (const value of malformed) reject(g, value);
  for (const value of [NaN, Infinity, Number.MAX_SAFE_INTEGER, 0.5, -1])
    reject(g, state, [change(home('atreides'), 'atreides', units(value))]);
  reject(g, state, [change('arrakeen:10', 'atreides', units(1))]);
  reject(g, state, [change(home('atreides'), 'missing', units(1))]);
  const basic = context(false);
  reject(basic, { ...create(basic), salusa: units() });
});

void test('invalid rosters and reserve records are rejected before location creation', () => {
  const good = context();
  const invalid: Context[] = [
    { ...good, players: [] },
    { ...good, players: good.players.slice(0, 1) },
    { ...good, players: [...good.players, good.players[0]] },
    {
      ...good,
      players: [
        good.players[0],
        { ...good.players[1], id: good.players[0].id },
      ],
    },
    {
      ...good,
      players: [good.players[0], { ...good.players[1], faction: 'emperor' }],
    },
  ];
  for (const field of ['reserves', 'eliteReserves'] as const)
    for (const value of [-1, 0.5, NaN, 21]) {
      const copy = structuredClone(good);
      copy.players[0][field] = value;
      invalid.push(copy);
    }
  for (const g of invalid)
    assert.throws(() => locations(g), HomeworldCustodyError);
});

void test('create, read, receipts and quotes do not alias or inspect unrelated private information', () => {
  const g = context(),
    state = create(g);
  for (const target of [g, ...g.players])
    for (const key of [
      'hand',
      'traitors',
      'prediction',
      'spice',
      'bot',
      'ally',
    ])
      Object.defineProperty(target, key, {
        get() {
          throw new Error(`Private ${key} was inspected`);
        },
      });
  const read = groups(g, state);
  read[0].forces.emperor.normal = 0;
  assert.deepEqual(native(g, state, home('emperor'), 'emperor'), units(15));
  const result = quote(g, state, [
    change(home('emperor'), 'emperor', units(1)),
  ]);
  result.receipts[0].after.normal = 0;
  result.receipts[0].before.normal = 0;
  result.players[0].reserves = 0;
  result.state.salusa!.elite = 0;
  assert.equal(g.players[0].reserves, 20);
  assert.deepEqual(state.salusa, units(0, 5));
  assert.doesNotThrow(() => create(g));
});

void test('prototype-like valid seat identifiers retain exact foreign custody rather than silently losing counters', () => {
  const g = context(false, ['atreides', 'fremen']);
  g.players[0].id = '__proto__';
  const state = create(g);
  const result = quote(g, state, [
    change(home('atreides'), '__proto__', units(2)),
    change(home('fremen'), '__proto__', units(), units(2)),
  ]);
  assert.equal(
    Object.hasOwn(result.state.visitors[home('fremen')], '__proto__'),
    true,
  );
  assert.equal(
    physical(
      { advanced: false, players: result.players },
      result.state,
      '__proto__',
    ),
    20,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result.state)), result.state);
});
