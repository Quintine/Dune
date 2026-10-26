import assert from 'node:assert/strict';
import test from 'node:test';
import { windowCardOpportunity, type WindowCardGame } from '../game/window-card-play';

function storm(): WindowCardGame {
  return { status: 'playing', phase: 0, turn: 3, shieldWallDestroyed: false };
}
function blow(): WindowCardGame {
  return { ...storm(), phase: 1, spiceWindow: { event: 'spice-blow:1', territory: 'hagga_basin', sector: 5, harvested: false } };
}

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
