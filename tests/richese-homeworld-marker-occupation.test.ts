import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomeworldCustody, type HomeworldCustodyContext } from '../game/homeworld-custody';
import { createHomeworldOccupationHistory, observeHomeworldOccupation,
  validateHomeworldOccupationHistory, readHomeworldOccupationSnapshot,
  currentHomeworldOccupationSnapshot, homeworldOccupationSnapshotPresence,
  homeworldOccupationMarker } from '../game/homeworld-occupation-history';
import { validateHomeworldEcazDukeGrants, type HomeworldEcazDukeContext } from '../game/homeworld-ecaz-duke';

function fixture() {
  const context: HomeworldCustodyContext = { advanced: false, players: [
    { id: 'richese-seat-17', faction: 'richese', reserves: 10, eliteReserves: 0 },
    { id: 'choam-seat-42', faction: 'choam', reserves: 0, eliteReserves: 0 },
    { id: 'ecaz-seat-99', faction: 'ecaz', reserves: 0, eliteReserves: 0 },
  ] };
  const custody = createHomeworldCustody(context);
  const history = createHomeworldOccupationHistory(context, custody, 1, 'setup');
  const marker = { homeworld: 'homeworld:choam', controller: 'richese-seat-17' };
  return { context, custody, history, marker };
}

void test('marker-free history preserves the canonical original physical snapshot and source signature', () => {
  const { context, custody, history } = fixture();
  const groups = [
    ['homeworld:choam', [['choam-seat-42', 0, 0]]],
    ['homeworld:ecaz', [['ecaz-seat-99', 0, 0]]],
    ['homeworld:richese', [['richese-seat-17', 10, 0]]],
  ];
  const physical = JSON.stringify(groups);
  assert.equal(history.snapshots[0], physical);
  assert.equal(history.sources[0].signature,
    JSON.stringify(['homeworldOccupationSource', 'setup', 1, 'setup', physical]));
  assert.deepEqual(readHomeworldOccupationSnapshot(physical, context), { groups, marker: null });
  assert.deepEqual(currentHomeworldOccupationSnapshot(context, custody), { groups, marker: null });
  validateHomeworldOccupationHistory(JSON.parse(JSON.stringify(history)), context, 1);
});

void test('marker-only arrival and departure create distinct observed facts without physical counters', () => {
  const { context, custody, history, marker } = fixture();
  const beforeCustody = structuredClone(custody), beforeContext = structuredClone(context);
  const arrival = observeHomeworldOccupation(history, context, custody, 1, 'change', 'arrival', marker);
  assert.notEqual(arrival.snapshots[arrival.sources.at(-1)!.snapshot], history.snapshots[0]);
  const snapshot = readHomeworldOccupationSnapshot(arrival.snapshots[arrival.sources.at(-1)!.snapshot], context);
  assert.deepEqual(snapshot.marker, marker);
  assert.deepEqual(homeworldOccupationSnapshotPresence(snapshot, marker.homeworld), [marker.controller]);
  assert.deepEqual(arrival.qualifications, [{ event: 'arrival', world: marker.homeworld,
    player: marker.controller, faction: 'richese', turn: 1, cause: 'sole' }]);
  assert.deepEqual(observeHomeworldOccupation(arrival, context, custody, 1, 'change', 'arrival', marker), arrival);
  assert.throws(() => observeHomeworldOccupation(arrival, context, custody, 1, 'change', 'arrival'), /different physical facts/);
  const departure = observeHomeworldOccupation(arrival, context, custody, 1, 'change', 'departure');
  assert.equal(departure.sources.at(-1)!.event, 'departure');
  assert.equal(departure.sources.at(-1)!.snapshot, history.sources[0].snapshot);
  assert.deepEqual(departure.qualifications, arrival.qualifications);
  assert.deepEqual(custody, beforeCustody); assert.deepEqual(context, beforeContext);
  validateHomeworldOccupationHistory(JSON.parse(JSON.stringify(departure)), context, 1);
});

void test('marker and physical garrison of one controller qualify once; invalid World identities reject', () => {
  const { context, custody, history, marker } = fixture();
  custody.visitors[marker.homeworld] = { [marker.controller]: { normal: 1, elite: 0 } };
  const frame = currentHomeworldOccupationSnapshot(context, custody, marker);
  assert.deepEqual(homeworldOccupationSnapshotPresence(frame, marker.homeworld), [marker.controller]);
  const observed = observeHomeworldOccupation(history, context, custody, 1, 'change', 'mixed', marker);
  assert.equal(observed.qualifications.length, 1);
  assert.throws(() => currentHomeworldOccupationSnapshot(context, custody,
    { homeworld: 'homeworld:richese', controller: marker.controller }), /foreign world/);
  assert.throws(() => currentHomeworldOccupationSnapshot(context, custody,
    { homeworld: marker.homeworld, controller: 'choam-seat-42' }), /Richese controller/);
  assert.throws(() => currentHomeworldOccupationSnapshot(context, custody,
    { homeworld: 'homeworld:fremen', controller: marker.controller }), /active foreign world/);
});

void test('marker extraction is public only and ignores an Arrakis token', () => {
  const { marker } = fixture();
  const seats = [{ id: marker.controller, faction: 'richese' as const,
    noField: { deployed: { controller: marker.controller, location: { homeworld: marker.homeworld } } } }];
  assert.deepEqual(homeworldOccupationMarker(seats), marker);
  assert.equal(homeworldOccupationMarker([{ ...seats[0], noField: { deployed: {
    controller: marker.controller, location: { territory: 'arrakeen', sector: 10 },
  } } }]), null);
});

for (const source of ['physical', 'marker'] as const) void test(`Ecaz Duke grant validates its canonical faction world with opaque seat IDs and ${source} presence`, () => {
  const { context, custody, history } = fixture();
  const marker = { homeworld: 'homeworld:ecaz', controller: 'richese-seat-17' };
  if (source === 'physical') custody.visitors[marker.homeworld] = { [marker.controller]: { normal: 1, elite: 0 } };
  const occupied = observeHomeworldOccupation(history, context, custody, 1, 'change', 'ecaz-occupation',
    source === 'marker' ? marker : null);
  const game = {
    status: 'playing', advanced: false, turn: 1, homeworldOccupationPreview: true,
    players: context.players.map(player => ({ id: player.id, faction: player.faction,
      reserves: player.reserves, ally: null })),
    homeworlds: { custody, historyVersion: 1 }, homeworldOccupationHistory: occupied,
    homeworldEcazDukeGrants: [{ turn: 1, qualification: 'ecaz-occupation',
      occupier: marker.controller, recipient: marker.controller }],
  } as unknown as HomeworldEcazDukeContext;
  assert.doesNotThrow(() => validateHomeworldEcazDukeGrants(game));
});
