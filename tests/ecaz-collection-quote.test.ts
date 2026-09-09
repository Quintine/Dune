import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteSpiceCollection,
  quoteBattlePhaseAdvance,
  BoardResolutionError,
} from '../game/board-resolution-quote';
import { createGame, newPlayer, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

function fixture(ally: FactionId = 'emperor', advanced = false) {
  const g = createGame(
    'ECAZCOLLECT',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    advanced,
    ['ecaz'],
  );
  g.players.push(
    newPlayer('al', 'Ally', ally),
    newPlayer('en', 'Enemy', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 7,
    turn: 2,
    storm: 18,
    order: ['ec', 'al', 'en'],
    spice: {},
  });
  for (const p of g.players) p.spice = 10;
  g.players[0].ally = 'al';
  g.players[1].ally = 'ec';
  return g;
}
function army(g: Game, id: string, forces: Record<string, number>) {
  const p = g.players.find((p) => p.id === id)!;
  p.forces = forces;
  p.reserves = 20 - Object.values(forces).reduce((a, n) => a + n, 0);
}
const receipt = (q: ReturnType<typeof quoteSpiceCollection>, id: string) =>
  q.receipts.find((r) => r.player === id)!;
function conserved(g: Game, q: ReturnType<typeof quoteSpiceCollection>) {
  const sum = (values: number[]) => values.reduce((a, n) => a + n, 0);
  assert.equal(
    sum(Object.values(g.spice)) - sum(Object.values(q.spice)),
    sum(q.receipts.map((r) => r.collected)) +
      sum(q.shared.map((s) => s.amount)),
  );
}
function shared(g = fixture()) {
  army(g, 'ec', { 'wind_pass:14': 2 });
  army(g, 'al', { 'wind_pass:14': 2 });
  g.spice = { 'wind_pass:14': 5 };
  return g;
}

for (const advanced of [false, true])
  for (const reversed of [false, true])
    void test(`${advanced ? 'Advanced' : 'Basic'} shared odd pile enters one escrow lot in ${reversed ? 'ally-first' : 'Ecaz-first'} order`, () => {
      const g = shared(fixture('emperor', advanced));
      if (reversed) g.order = ['al', 'ec', 'en'];
      const before = structuredClone(g);
      const q = quoteSpiceCollection(g);
      assert.deepEqual(q.shared, [
        { territory: 'wind_pass', ecaz: 'ec', ally: 'al', amount: 5 },
      ]);
      assert.equal(q.spice['wind_pass:14'], 0);
      for (const id of ['ec', 'al'])
        assert.deepEqual(receipt(q, id), {
          player: id,
          strongholds: 0,
          collected: 0,
          desert: 0,
          balance: 10,
        });
      assert.deepEqual(g, before);
      conserved(g, q);
    });

void test('separate eligible sectors pool once per territory without moving collection capacity between deposits', () => {
  const g = fixture();
  army(g, 'ec', { 'wind_pass:14': 1, 'red_chasm:7': 2 });
  army(g, 'al', { 'wind_pass:15': 1 });
  g.spice = { 'wind_pass:14': 1, 'wind_pass:15': 8, 'red_chasm:7': 4 };
  const q = quoteSpiceCollection(g);
  assert.deepEqual(q.shared, [
    { territory: 'wind_pass', ecaz: 'ec', ally: 'al', amount: 3 },
  ]);
  assert.equal(q.spice['wind_pass:15'], 6);
  assert.equal(receipt(q, 'ec').collected, 4);
  assert.equal(receipt(q, 'al').collected, 0);
  conserved(g, q);
});

void test('each shared desert has its own amount and no automatic default is credited', () => {
  const g = fixture();
  for (const id of ['ec', 'al'])
    army(g, id, { 'wind_pass:14': 1, 'red_chasm:7': 1 });
  g.spice = { 'wind_pass:14': 1, 'red_chasm:7': 4 };
  const q = quoteSpiceCollection(g);
  assert.deepEqual(
    new Map(q.shared.map((s) => [s.territory, s.amount])),
    new Map([
      ['wind_pass', 1],
      ['red_chasm', 4],
    ]),
  );
  assert.equal(receipt(q, 'ec').balance, 10);
  assert.equal(receipt(q, 'al').balance, 10);
  conserved(g, q);
});

for (const unavailable of ['storm', 'noDeposit', 'zeroForces'] as const)
  void test(`a partner with ${unavailable} capacity gets no shared entitlement`, () => {
    const g = fixture();
    army(g, 'ec', { 'wind_pass:14': 2 });
    army(g, 'al', { 'wind_pass:15': unavailable === 'zeroForces' ? 0 : 2 });
    g.spice = {
      'wind_pass:14': 5,
      'wind_pass:15': unavailable === 'noDeposit' ? 0 : 5,
    };
    if (unavailable === 'storm') g.storm = 15;
    const q = quoteSpiceCollection(g);
    assert.deepEqual(q.shared, []);
    assert.equal(receipt(q, 'ec').collected, 4);
    assert.equal(receipt(q, 'al').collected, 0);
    conserved(g, q);
  });

void test('each participant retains its own normal city rate, and co-occupied Arrakeen gives both rate three', () => {
  const g = fixture();
  army(g, 'ec', { 'wind_pass:14': 1, 'arrakeen:10': 1 });
  army(g, 'al', { 'wind_pass:14': 1 });
  g.spice = { 'wind_pass:14': 10 };
  assert.equal(quoteSpiceCollection(g).shared[0].amount, 5);
  army(g, 'al', { 'wind_pass:14': 1, 'arrakeen:10': 1 });
  assert.equal(quoteSpiceCollection(g).shared[0].amount, 6);
});

void test('Ix cyborgs use three each while accompanying suboids retain their normal rate', () => {
  const g = fixture('ixians');
  army(g, 'ec', { 'wind_pass:14': 1 });
  army(g, 'al', { 'wind_pass:14': 2 });
  g.players[1].elites!.forces = { 'wind_pass:14': 1 };
  g.players[1].elites!.reserves = 6;
  g.spice = { 'wind_pass:14': 20 };
  assert.equal(quoteSpiceCollection(g).shared[0].amount, 7);
  army(g, 'al', { 'wind_pass:14': 2, 'arrakeen:10': 1 });
  assert.equal(quoteSpiceCollection(g).shared[0].amount, 8);
});

void test('allied advisors do not pool; lone advisors release before normal collection', () => {
  const g = shared(fixture('beneGesserit', true));
  g.players[1].advisors = { wind_pass: {}, red_chasm: {} };
  army(g, 'al', { 'wind_pass:14': 2, 'red_chasm:7': 1 });
  g.spice['red_chasm:7'] = 3;
  const q = quoteSpiceCollection(g);
  assert.deepEqual(q.shared, []);
  assert.deepEqual(q.released, [{ player: 'al', territory: 'red_chasm' }]);
  assert.equal(receipt(q, 'ec').collected, 4);
  assert.equal(receipt(q, 'al').collected, 2);
  conserved(g, q);
});

void test('No-Field values zero, three and five have the same one-force collection capacity and remain concealed', () => {
  let previous: ReturnType<typeof quoteSpiceCollection> | undefined;
  for (const index of [0, 1, 2]) {
    const g = fixture('richese');
    army(g, 'ec', { 'wind_pass:14': 1 });
    const ids = ['n0', 'n3', 'n5'];
    g.players[1].noField = deployRicheseNoField(createRicheseNoField(ids), {
      tokenId: ids[index],
      controller: 'al',
      location: { territory: 'wind_pass', sector: 14 },
    });
    g.spice = { 'wind_pass:14': 8 };
    const before = structuredClone(g);
    const q = quoteSpiceCollection(g);
    assert.equal(q.shared[0].amount, 4);
    if (previous) assert.deepEqual(q, previous);
    previous = q;
    assert.deepEqual(g, before);
    Object.defineProperty(g.players[1].noField, 'tokens', {
      get() {
        throw Error('Private token inventory read');
      },
    });
    assert.deepEqual(quoteSpiceCollection(g), q);
    conserved(g, q);
  }
});

void test('Advanced cancellation removes only Ecaz shared-city income, preserving solo income, ally income and all desert lots', () => {
  const g = shared(fixture('emperor', true));
  army(g, 'ec', {
    'wind_pass:14': 2,
    'arrakeen:10': 1,
    'carthag:11': 1,
    'tueks_sietch:5': 1,
  });
  army(g, 'al', { 'wind_pass:14': 2, 'arrakeen:10': 1, 'tueks_sietch:5': 1 });
  const allowed = quoteSpiceCollection(g);
  const canceled = quoteSpiceCollection(g, true);
  assert.deepEqual(allowed.collectionBonus, {
    owner: 'ec',
    ally: 'al',
    strongholds: ['arrakeen', 'tueks_sietch'],
    amount: 3,
  });
  assert.deepEqual(canceled.collectionBonus, allowed.collectionBonus);
  assert.equal(receipt(allowed, 'ec').strongholds, 5);
  assert.equal(receipt(canceled, 'ec').strongholds, 2);
  assert.equal(receipt(canceled, 'ec').balance, 12);
  assert.equal(receipt(canceled, 'al').strongholds, 3);
  assert.deepEqual(canceled.shared, allowed.shared);
  assert.deepEqual(canceled.spice, allowed.spice);
  conserved(g, canceled);
  g.advanced = false;
  assert.equal(quoteSpiceCollection(g, true).collectionBonus, null);
  assert.equal(receipt(quoteSpiceCollection(g, true), 'ec').strongholds, 0);
});

void test('a shared stronghold with advisors grants no cancelable Ecaz bonus', () => {
  const g = fixture('beneGesserit', true);
  for (const id of ['ec', 'al']) army(g, id, { 'arrakeen:10': 1 });
  g.players[1].advisors = { arrakeen: {} };
  const q = quoteSpiceCollection(g, true);
  assert.equal(q.collectionBonus, null);
  assert.equal(receipt(q, 'ec').strongholds, 2);
  assert.equal(receipt(q, 'al').strongholds, 0);
});

void test('ordinary non-allied collection retains its storm-order capped receipts', () => {
  const g = fixture();
  g.players[0].ally = null;
  g.players[1].ally = null;
  for (const id of ['ec', 'al']) army(g, id, { 'wind_pass:14': 2 });
  g.spice = { 'wind_pass:14': 5 };
  assert.deepEqual(
    quoteSpiceCollection(g).receipts.map((r) => r.collected),
    [4, 1, 0],
  );
  g.order = ['al', 'ec', 'en'];
  assert.deepEqual(
    quoteSpiceCollection(g).receipts.map((r) => r.collected),
    [4, 1, 0],
  );
  assert.deepEqual(quoteSpiceCollection(g).shared, []);
});

void test('non-desert physical spice keys retain ordinary behavior rather than acquiring a new sharing rule', () => {
  const g = fixture();
  for (const id of ['ec', 'al']) army(g, id, { 'shield_wall:8': 2 });
  g.spice = { 'shield_wall:8': 5 };
  const q = quoteSpiceCollection(g);
  assert.deepEqual(q.shared, []);
  assert.deepEqual(
    q.receipts.map((r) => r.collected),
    [4, 1, 0],
  );
});

void test('phase-six aid refund prequote preserves shared lots as unresolved allocation and Ix opening still defers collection', () => {
  const g = shared();
  g.phase = 6;
  g.aid = { ec: { recipient: 'al', amount: 3 } };
  const q = quoteBattlePhaseAdvance(g);
  assert.equal(q.collection!.shared[0].amount, 5);
  assert.equal(receipt(q.collection!, 'ec').balance, 13);
  assert.equal(receipt(q.collection!, 'al').balance, 10);
  g.expansions.push('ix');
  assert.equal(quoteBattlePhaseAdvance(g).collection, null);
});

void test('invalid roster, stance, typed custody and arithmetic reject purely before any receipt exists', () => {
  const corruptions: ((g: Game) => void)[] = [
    (g) => {
      g.players[1].ally = null;
    },
    (g) => {
      g.players[2].faction = 'emperor';
    },
    (g) => {
      g.players[0].advisors = { missing: {} };
    },
    (g) => {
      g.players[0].advisors = { wind_pass: { lockedTurn: -1 } };
    },
    (g) => {
      g.players[1].elites = {
        forces: { 'wind_pass:14': 3 },
        reserves: 0,
        tanks: 0,
        revived: 0,
      };
    },
    (g) => {
      g.players[0].forces['wind_pass:14'] = Number.MAX_SAFE_INTEGER;
    },
    (g) => {
      g.players[0].spice = -1;
    },
    (g) => {
      g.spice['wind_pass:14'] = Number.MAX_SAFE_INTEGER + 1;
    },
    (g) => {
      g.players[0].forces['wind_pass:14'] = 3_000_000_000_000_000;
      g.players[1].forces['wind_pass:14'] = 3_000_000_000_000_000;
    },
  ];
  for (const corrupt of corruptions) {
    const g = shared();
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => quoteSpiceCollection(g), BoardResolutionError);
    assert.deepEqual(g, before);
  }
});

void test('repeated quoting is deterministic and never reads hands, leaders, predictions or reserve inventories', () => {
  const g = shared();
  const expected = quoteSpiceCollection(g);
  for (const p of g.players)
    for (const key of ['hand', 'leaders', 'prediction', 'reserves'])
      Object.defineProperty(p, key, {
        get() {
          throw Error(`Private ${key} read`);
        },
      });
  assert.deepEqual(quoteSpiceCollection(g), expected);
  assert.deepEqual(quoteSpiceCollection(g), expected);
});
