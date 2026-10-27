import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDiscoveryEntry, beginDiscoveryEntryArrival, createDiscoveryEntryRound,
  discoveryEntryArrivalSignature, discoveryEntrySignature, finishDiscoveryEntryArrival,
  quoteDiscoveryEntry, validateDiscoveryEntryArrivalChild, validateDiscoveryEntryRound,
  type DiscoveryEntryContext, type DiscoveryEntrySelection,
} from '../game/discovery-entry';
import { createDiscoveryState } from '../game/discoveries';
import { createRicheseNoField, deployRicheseNoField, type NoFieldValue } from '../game/richese-no-field';

/** Controlled pure-helper fixture: the last-turn reveal, current storm order,
 * marker deployment and physical forces are assigned, not earned by gameplay. */
function source(value: NoFieldValue = 0, physical = 0) {
  const discoveries = createDiscoveryState(() => 0);
  const site = discoveries.tokens.find(token => token.face === 'jacurutu-sietch')!;
  Object.assign(site, { status: 'placed', territory: 'meridian', sector: 1,
    revealedTurn: 2, known: [], owner: null, acquiredTurn: null });
  discoveries.newlyRevealed = [site.id];
  const stock = createRicheseNoField(['private-zero-token', 'private-three-token', 'private-five-token']);
  const token = stock.tokens.find(candidate => candidate.value === value)!;
  const g: DiscoveryEntryContext = { turn: 3, storm: 1, order: ['r', 'a'], discoveries,
    players: [
      { id: 'r', faction: 'richese', ally: null, forces: physical ? { 'meridian:2': physical } : {},
        noField: deployRicheseNoField(stock, { tokenId: token.id, controller: 'r',
          location: { territory: 'meridian', sector: 2 } }), noFieldEvent: 'private-marker-event' },
      { id: 'a', faction: 'atreides', ally: null, forces: {} },
    ] };
  const frame = createDiscoveryEntryRound(g, 'public-entry-round');
  const offer = quoteDiscoveryEntry(g, frame, 'r');
  assert.ok(offer.noField);
  return { g, frame, offer, marker: { ...offer.noField }, token: site.id };
}

void test('zero three and five markers can enter without physical sources or any reserve-based permission', () => {
  for (const value of [0, 3, 5] as const) {
    const f = source(value);
    Object.assign(f.g.players[0], { reserves: 0 });
    const before = structuredClone(f.g);
    assert.deepEqual(f.offer.sources, []);
    assert.equal(f.offer.blocked, null);
    const selected = quoteDiscoveryEntry(f.g, f.frame, 'r', { groups: [], noField: f.marker });
    assert.deepEqual(selected.arrival?.groups, []);
    assert.equal(selected.arrival?.amount, 1);
    assert.equal(selected.arrival?.elite, 0);
    assert.deepEqual(selected.arrival?.noField, f.marker);
    assert.throws(() => quoteDiscoveryEntry(f.g, f.frame, 'r', { groups: [] }), /positive/);
    assert.deepEqual(f.g, before);
  }
});

void test('mixed entry keeps physical groups separate and omitting the marker preserves the old physical signature bytes', () => {
  const f = source(5, 3), groups = [{ source: 'meridian:2', normal: 2, elite: 0 }];
  const physical = quoteDiscoveryEntry(f.g, f.frame, 'r', { groups }).arrival; assert.ok(physical);
  assert.equal(physical.noField, undefined);
  assert.equal(physical.signature, JSON.stringify([
    'public-entry-round:0', f.token, 'r', 'meridian', 'jacurutu-sietch', 0, 0, 0,
    [['meridian:2', 2, 0]], 2, 0,
  ]));
  const mixed = quoteDiscoveryEntry(f.g, f.frame, 'r', { groups, noField: f.marker }).arrival; assert.ok(mixed);
  assert.deepEqual(mixed.groups, groups);
  assert.equal(mixed.amount, 3);
  assert.equal(mixed.elite, 0);
  assert.equal(mixed.signature, JSON.stringify([
    'public-entry-round:0', f.token, 'r', 'meridian', 'jacurutu-sietch', 0, 0, 0,
    [['meridian:2', 2, 0]], 3, 0, [true, 'meridian:2'],
  ]));
  assert.ok(!mixed.signature.includes(f.marker.tokenId));
  assert.ok(!mixed.signature.includes(f.marker.event));
  const legacy = structuredClone(f.g); delete legacy.players[0].noField; delete legacy.players[0].noFieldEvent;
  assert.deepEqual(quoteDiscoveryEntry(legacy, f.frame, 'r', { groups }).arrival, physical);
});

void test('a selected marker must keep its current owner event and canonical eligible parent source', () => {
  const f = source();
  for (const noField of [
    { ...f.marker, tokenId: 'old-token' },
    { ...f.marker, event: 'old-marker-event' },
    { ...f.marker, source: 'meridian:3' },
    { ...f.marker, source: 'meridian:02' },
  ]) assert.throws(() => quoteDiscoveryEntry(f.g, f.frame, 'r', { groups: [], noField }), /current owned No-Field/);
  const extra = { ...f.marker, amount: 5 };
  assert.throws(() => quoteDiscoveryEntry(f.g, f.frame, 'r', { groups: [], noField: extra }), /positive/);
  assert.throws(() => quoteDiscoveryEntry(f.g, f.frame, 'a', { groups: [], noField: f.marker }), /another player/);
  for (const change of ['controller', 'event', 'storm', 'parent'] as const) {
    const g = structuredClone(f.g), owner = g.players[0];
    if (change === 'controller') owner.noField!.deployed!.controller = 'a';
    if (change === 'event') owner.noFieldEvent = '';
    if (change === 'storm') g.storm = 2;
    if (change === 'parent') owner.noField!.deployed!.location = { territory: 'imperial_basin', sector: 10 };
    const offer = quoteDiscoveryEntry(g, f.frame, 'r');
    assert.equal(offer.noField, undefined);
    assert.ok(offer.blocked);
  }
});

void test('a signed marker arrival is copied and remains valid after native relocation and event rotation', () => {
  const f = source(3), selection: DiscoveryEntrySelection = { groups: [], noField: { ...f.marker } };
  const next = beginDiscoveryEntryArrival(f.g, f.frame, 'r', selection);
  assert.ok(next.arrival?.noField);
  selection.noField!.event = 'changed-selection';
  assert.equal(next.arrival.noField.event, f.marker.event);
  assert.ok(next.signature.includes(f.marker.tokenId));
  assert.ok(next.signature.includes(f.marker.event));
  f.g.players[0].noField!.deployed!.location = { territory: next.arrival.destination, sector: 0 };
  f.g.players[0].noFieldEvent = 'rotated-after-native-relocation';
  assert.doesNotThrow(() => validateDiscoveryEntryRound(f.g, next));
  assert.doesNotThrow(() => validateDiscoveryEntryArrivalChild(next, { owner: 'r', territory: next.arrival!.destination,
    sector: 0, amount: 1, elite: 0, discoveryEntry: next.arrival!.signature }));
  assert.equal(finishDiscoveryEntryArrival(f.g, next).cursor, 1);

  const wrongSource = structuredClone(next);
  wrongSource.arrival!.noField!.source = 'imperial_basin:10';
  wrongSource.arrival!.signature = discoveryEntryArrivalSignature(wrongSource.arrival!);
  wrongSource.signature = discoveryEntrySignature(wrongSource);
  assert.throws(() => validateDiscoveryEntryRound(f.g, wrongSource), /revealed destination/);
  const fakeElite = structuredClone(next);
  fakeElite.arrival!.elite = 1;
  fakeElite.arrival!.signature = discoveryEntryArrivalSignature(fakeElite.arrival!);
  fakeElite.signature = discoveryEntrySignature(fakeElite);
  assert.throws(() => validateDiscoveryEntryRound(f.g, fakeElite), /exact signed arrival/);
});

void test('declining an offered marker advances only the optional entry cursor', () => {
  const f = source(), before = structuredClone(f.g);
  const next = advanceDiscoveryEntry(f.g, f.frame, 'r');
  assert.equal(next.cursor, 1);
  assert.equal(next.arrival, null);
  assert.equal(next.stage, 'choose');
  assert.deepEqual(f.g, before);
});
