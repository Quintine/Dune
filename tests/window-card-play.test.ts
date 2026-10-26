import assert from 'node:assert/strict';
import test from 'node:test';
import { WINDOW_CARD_EFFECTS, windowCardNativeEffect, windowCardOpportunity, type WindowCardGame } from '../game/window-card-play';

function storm(): WindowCardGame {
  return { status: 'playing', phase: 0, turn: 3, shieldWallDestroyed: false };
}
function blow(): WindowCardGame {
  return { ...storm(), phase: 1, spiceWindow: { event: 'spice-blow:1', territory: 'hagga_basin', sector: 5, harvested: false } };
}
function auction(): WindowCardGame {
  return { ...storm(), phase: 3, auction: { cards: [{ id: 'private-card:1' }, { id: 'private-card:2' }], index: 0 } };
}
function publicAuction(): WindowCardGame {
  return { ...storm(), phase: 3, auction: { bid: 4, bidder: 'respondent', remaining: 2 }, bidPromiseLot: { turn: 3, lot: 1 } };
}

void test('window roles expose a shared exhaustive tuple and exact native printed-card mapping', () => {
  assert.deepEqual(WINDOW_CARD_EFFECTS, ['weather', 'atomics', 'harvester', 'karamaAuction']);
  assert.deepEqual(WINDOW_CARD_EFFECTS.map(windowCardNativeEffect), ['weather', 'atomics', 'harvester', 'karama']);
});

void test('ordinary Karama binds the same public current-lot source from native and projected auction shapes', () => {
  const expected = { effect: 'karamaAuction', source: 'ordinary-auction:3:1', turn: 3 };
  assert.deepEqual(windowCardOpportunity(auction(), 'karamaAuction'), expected);
  assert.deepEqual(windowCardOpportunity(publicAuction(), 'karamaAuction'), expected);
  assert.deepEqual(windowCardOpportunity({ ...auction(), bidPromiseLot: { turn: 3, lot: 1 } }, 'karamaAuction'), expected);
  const otherFace = { ...auction(), auction: { cards: [{ id: 'different-hidden-card' }], index: 0 } };
  assert.deepEqual(windowCardOpportunity(otherFace, 'karamaAuction'), expected);
});

void test('ordinary lot responses and a winning unpaid invoice retain Karama source until actual lot close', () => {
  for (const source of [auction(), publicAuction()]) {
    for (const modal of [{ response: { kind: 'karama' } }, { decision: { kind: 'auctionPayment', player: 'respondent' } },
      { truthtrance: {} }, { phaseOpening: {} }])
      assert.equal(windowCardOpportunity({ ...source, ...modal }, 'karamaAuction')!.source, 'ordinary-auction:3:1');
    for (const exclusion of [{ richeseAuction: {} }, { currentAuctionSale: {} }, { ixAuction: {} },
      { phase: 4 }, { status: 'setup' }, { auction: null }])
      assert.equal(windowCardOpportunity({ ...source, ...exclusion }, 'karamaAuction'), null);
  }
});

void test('Karama lot progression changes only the public source and never mutates physical auction metadata', () => {
  const source = auction(), before = structuredClone(source);
  assert.equal(windowCardOpportunity(source, 'karamaAuction')!.source, 'ordinary-auction:3:1');
  assert.equal(windowCardOpportunity({ ...source, auction: { cards: [{}, {}], index: 1 } }, 'karamaAuction')!.source,
    'ordinary-auction:3:2');
  assert.equal(windowCardOpportunity({ ...publicAuction(), bidPromiseLot: { turn: 3, lot: 2 } }, 'karamaAuction')!.source,
    'ordinary-auction:3:2');
  assert.equal(windowCardOpportunity({ ...source, turn: 4 }, 'karamaAuction')!.source, 'ordinary-auction:4:1');
  assert.deepEqual(source, before);
});

void test('malformed or exhausted native auction arrays and indices cannot fall back to a public lot', () => {
  for (const native of [{ cards: [], index: 0 }, { cards: [{}], index: 1 }, { cards: [{}], index: -1 },
    { cards: [{}], index: 0.5 }, { cards: [{}], index: Number.MAX_SAFE_INTEGER + 1 },
    { cards: [null], index: 0 }, { cards: [undefined], index: 0 }, { cards: ['private-card'], index: 0 },
    { cards: {}, index: 0 }, { cards: [{}] }, { index: 0 }, { cards: [{}], index: undefined }]) {
    assert.equal(windowCardOpportunity({ ...auction(), auction: native }, 'karamaAuction'), null);
    assert.equal(windowCardOpportunity({ ...publicAuction(), auction: native }, 'karamaAuction'), null);
  }
});

void test('projected lot metadata is positive safe coherent and cannot invent an absent ordinary auction', () => {
  for (const bidPromiseLot of [null, undefined, { turn: 3, lot: 0 }, { turn: 3, lot: -1 }, { turn: 3, lot: 1.5 },
    { turn: 3, lot: Number.MAX_SAFE_INTEGER + 1 }, { turn: 4, lot: 1 }, { turn: 3, lot: '1' },
    { turn: 3, lot: 1, card: 'private-card' }, { lot: 1 }])
    assert.equal(windowCardOpportunity({ ...publicAuction(), bidPromiseLot } as WindowCardGame, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...auction(), bidPromiseLot: { turn: 3, lot: 2 } }, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...publicAuction(), auction: [] }, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...storm(), phase: 3, auction: {} }, 'karamaAuction'), null);
});

void test('Weather and Family Atomics share the exact original current Storm source before movement', () => {
  assert.deepEqual(windowCardOpportunity(storm(), 'weather'), { effect: 'weather', source: 'storm:3', turn: 3 });
  assert.deepEqual(windowCardOpportunity(storm(), 'atomics'), { effect: 'atomics', source: 'storm:3', turn: 3 });
  assert.equal(windowCardOpportunity({ ...storm(), turn: 4 }, 'weather')!.source, 'storm:4');
});

void test('actual Storm close and movement resolution end the window while legacy absent open flag remains valid', () => {
  for (const effect of ['weather', 'atomics'] as const) {
    assert.equal(windowCardOpportunity({ ...storm(), stormCardWindowOpen: false }, effect), null);
    assert.equal(windowCardOpportunity({ ...storm(), stormResolution: { event: 'storm-movement:1' } }, effect), null);
    assert.equal(windowCardOpportunity({ ...storm(), phase: 1 }, effect), null);
    assert.ok(windowCardOpportunity({ ...storm(), stormCardWindowOpen: true }, effect));
  }
});

void test('a destroyed Shield Wall closes only Family Atomics rather than the remaining Weather window', () => {
  const source = { ...storm(), shieldWallDestroyed: true };
  assert.equal(windowCardOpportunity(source, 'atomics'), null);
  assert.equal(windowCardOpportunity(source, 'weather')!.source, 'storm:3');
});

void test('temporary responses, decisions, phase openings and Truth preserve the native global source', () => {
  for (const blocker of ['response', 'decision', 'phaseOpening', 'truthtrance'] as const) {
    assert.equal(windowCardOpportunity({ ...storm(), [blocker]: {} }, 'weather')!.source, 'storm:3');
    assert.equal(windowCardOpportunity({ ...blow(), [blocker]: {} }, 'harvester')!.source, 'spice-blow:1');
  }
});

void test('a current Harvester window binds its actual blow event and preserves later distinct blow identity', () => {
  const source = blow();
  assert.deepEqual(windowCardOpportunity(source, 'harvester'), { effect: 'harvester', source: 'spice-blow:1', turn: 3 });
  source.spiceWindow!.event = 'spice-blow:2';
  assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'spice-blow:2');
  assert.equal(windowCardOpportunity({ ...source, phase: 2 }, 'harvester'), null);
});

void test('Harvester uses existing unlimited physical stacking and replay availability without a per-window count cap', () => {
  const source = blow();
  source.spiceWindow!.harvested = true;
  assert.equal(windowCardOpportunity(source, 'harvester'), null, 'Legacy harvested-only windows are closed');
  for (const harvesters of [1, 2, 20, 100, Number.MAX_SAFE_INTEGER]) {
    source.spiceWindow!.harvesters = harvesters;
    assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'spice-blow:1');
  }
  source.spiceWindow!.harvesterClosed = true;
  assert.equal(windowCardOpportunity(source, 'harvester'), null);
});

void test('legacy fresh blows get the specified deterministic source without mutating their original state', () => {
  const source = blow(); delete source.spiceWindow!.event;
  const before = structuredClone(source);
  assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'legacy-spice-blow:3:hagga_basin:5');
  assert.deepEqual(source, before);
  const otherSector = { ...source, spiceWindow: { ...source.spiceWindow!, sector: 6 } };
  assert.notEqual(windowCardOpportunity(otherSector, 'harvester')!.source, windowCardOpportunity(source, 'harvester')!.source);
});

void test('invalid public source metadata and unavailable game windows do not create a native opportunity', () => {
  for (const source of [{ ...storm(), status: 'setup' }, { ...storm(), turn: 0 }, { ...storm(), turn: 1.5 },
    { ...storm(), turn: Number.MAX_SAFE_INTEGER + 1 }])
    assert.equal(windowCardOpportunity(source, 'weather'), null);
  for (const source of [{ ...blow(), spiceWindow: null }, { ...blow(), spiceWindow: { ...blow().spiceWindow!, event: '' } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, territory: ' hagga_basin' } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, sector: -1 } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, harvesters: NaN } }])
    assert.equal(windowCardOpportunity(source, 'harvester'), null);
  assert.equal(windowCardOpportunity(storm(), 'unknown' as never), null);
});
