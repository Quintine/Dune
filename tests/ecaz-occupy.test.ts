import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ecazOccupancyIdentity as identity,
  ecazOccupancyRelation as relation,
  EcazOccupancyError,
  type EcazOccupancyLocation as At,
  type EcazOccupancySeat as Seat,
} from '../game/ecaz-occupy';
import { MOBILE_STRONGHOLD } from '../game/board';
const at: At = { kind: 'territory', id: 'arrakeen', sector: 10 };
function roster(): Seat[] {
  return [
    { id: 'e', faction: 'ecaz', ally: 'a' },
    { id: 'a', faction: 'atreides', ally: 'e' },
    { id: 'g', faction: 'guild', ally: 'h' },
    { id: 'h', faction: 'harkonnen', ally: 'g' },
    { id: 'b', faction: 'beneGesserit' },
  ];
}
void test('same-seat identity differs from reciprocal Ecaz coalition membership', () => {
  const seats = roster();
  assert.equal(relation(seats, 'e', 'e', at), 'sameSeat');
  assert.equal(relation(seats, 'e', 'a', at), 'ecazAlliance');
  assert.equal(relation(seats, 'a', 'e', at), 'ecazAlliance');
  assert.deepEqual(identity(seats, 'e', at), {
    kind: 'ecazAlliance',
    members: ['a', 'e'],
    key: '["a","e"]',
  });
  assert.deepEqual(identity(seats, 'a', at), identity(seats, 'e', at));
  assert.equal(relation(seats, 'e', 'b', at), 'different');
});
void test('ordinary allies remain separate identities while Ecaz without an ally is one seat', () => {
  const seats = roster();
  assert.equal(relation(seats, 'g', 'h', at), 'different');
  assert.deepEqual(identity(seats, 'g', at), {
    kind: 'seat',
    members: ['g'],
    key: '["g"]',
  });
  seats[0] = { id: 'e', faction: 'ecaz', ally: null };
  seats[1] = { id: 'a', faction: 'atreides' };
  assert.equal(relation(seats, 'e', 'a', at), 'different');
  assert.equal(identity(seats, 'e', at).kind, 'seat');
});
void test('occupying-seat grouping merges exactly one Ecaz pair without deciding capacity or presence', () => {
  const seats = roster();
  const groups = (occupants: string[]) =>
    new Set(occupants.map((id) => identity(seats, id, at).key));
  assert.equal(groups(['e', 'a']).size, 1);
  assert.equal(groups(['e', 'a', 'b']).size, 2);
  assert.equal(groups(['e', 'a', 'b', 'g']).size, 3);
  assert.equal(groups(['g', 'h', 'b']).size, 3);
  assert.equal(groups(['a', 'b']).size, 2);
});
void test('board desert, Polar Sink and mobile identities use the same coalition without requiring live mobile placement', () => {
  for (const target of [
    { kind: 'territory', id: 'hagga_basin', sector: 12 },
    { kind: 'territory', id: 'polar_sink', sector: 0 },
    { kind: 'territory', id: MOBILE_STRONGHOLD, sector: 0 },
    { kind: 'territory', id: 'arrakeen' },
  ] as At[])
    assert.equal(relation(roster(), 'e', 'a', target), 'ecazAlliance');
});
void test('explicit homeworld scope never merges Ecaz with its ally and grants no entry permission', () => {
  const home: At = { kind: 'homeworld', id: 'ecaz-homeworld' };
  assert.equal(relation(roster(), 'e', 'a', home), 'different');
  assert.equal(relation(roster(), 'e', 'e', home), 'sameSeat');
  assert.deepEqual(identity(roster(), 'e', home), {
    kind: 'seat',
    members: ['e'],
    key: '["e"]',
  });
});
void test('malformed complete rosters reject even when the requested pair is elsewhere', () => {
  const mutations: ((s: Seat[]) => void)[] = [
    (s) => {
      s.push({ ...s[0] });
    },
    (s) => {
      s[4] = { id: 'b', faction: 'ecaz' };
    },
    (s) => {
      s[0] = { ...s[0], ally: 'missing' };
    },
    (s) => {
      s[1] = { ...s[1], ally: null };
    },
    (s) => {
      s[0] = { ...s[0], ally: 'e' };
    },
    (s) => {
      s[3] = { ...s[3], ally: 'missing' };
    },
    (s) => {
      s[4] = { ...s[4], ally: 'a' };
    },
    (s) => {
      s[4] = { ...s[4], ally: '' };
    },
    (s) => {
      s[4] = { ...s[4], id: ' ' };
    },
    (s) => {
      s[4] = { ...s[4], faction: 'unknown' } as unknown as Seat;
    },
    (s) => {
      s[4] = null as unknown as Seat;
    },
  ];
  for (const mutate of mutations) {
    const seats = roster();
    mutate(seats);
    const before = structuredClone(seats);
    assert.throws(() => identity(seats, 'g', at), EcazOccupancyError);
    assert.throws(() => relation(seats, 'g', 'g', at), EcazOccupancyError);
    assert.deepEqual(seats, before);
  }
  assert.throws(() => identity([], 'e', at), EcazOccupancyError);
});
void test('unknown seats and invalid board locations reject without defaulting to a coalition', () => {
  assert.throws(() => identity(roster(), 'missing', at), EcazOccupancyError);
  assert.throws(
    () => relation(roster(), 'e', 'missing', at),
    EcazOccupancyError,
  );
  for (const target of [
    { kind: 'territory', id: 'unknown' },
    { kind: 'territory', id: 'arrakeen', sector: 14 },
    { kind: 'territory', id: MOBILE_STRONGHOLD, sector: 1 },
    { kind: 'territory', id: 'arrakeen', sector: null },
    { kind: 'territory', id: 'arrakeen', sector: NaN },
    { kind: 'territory', id: 'arrakeen', sector: 10.5 },
    { kind: 'homeworld', id: '' },
    { kind: 'homeworld', id: ' ' },
    { kind: 'unknown', id: 'arrakeen' },
    null,
  ])
    assert.throws(
      () => identity(roster(), 'e', target as At),
      EcazOccupancyError,
    );
});
void test('keys are order-independent and collision-free for delimiter-bearing seat IDs', () => {
  const seats = roster();
  assert.deepEqual(
    identity(seats, 'a', at),
    identity([...seats].reverse(), 'a', at),
  );
  const custom: Seat[] = [
    { id: 'a', faction: 'ecaz', ally: 'b' },
    { id: 'b', faction: 'atreides', ally: 'a' },
    { id: 'a\u0000b', faction: 'guild' },
    { id: '["a","b"]', faction: 'harkonnen' },
  ];
  assert.notEqual(
    identity(custom, 'a', at).key,
    identity(custom, 'a\u0000b', at).key,
  );
  assert.notEqual(
    identity(custom, 'a', at).key,
    identity(custom, '["a","b"]', at).key,
  );
});
void test('returned member arrays are detached and only public identity fields are inspected', () => {
  const seats = roster();
  const before = structuredClone(seats);
  const guarded = seats.map(
    (seat) =>
      new Proxy(seat, {
        get(target, key, receiver) {
          assert.ok(
            ['id', 'faction', 'ally'].includes(String(key)),
            String(key),
          );
          return Reflect.get(target, key, receiver);
        },
      }),
  );
  const result = identity(guarded, 'e', at);
  result.members.splice(0, 2, 'other');
  assert.deepEqual(identity(guarded, 'e', at).members, ['a', 'e']);
  assert.equal(relation(guarded, 'e', 'a', at), 'ecazAlliance');
  assert.deepEqual(seats, before);
});
