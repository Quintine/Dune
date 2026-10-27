import assert from 'node:assert/strict';
import test from 'node:test';
import {
  familyAtomicsBlock as blocked,
  type FamilyAtomicsPlayer,
  type FamilyAtomicsState,
} from '../game/family-atomics';

function state(extra: Partial<FamilyAtomicsState> = {}): FamilyAtomicsState {
  return { advanced: true, turn: 2, phase: 0, shieldWallDestroyed: false, storm: 18, stormPending: 3, ...extra };
}
function player(forces: Record<string, number> = { 'shield_wall:8': 1 },
  extra: Partial<FamilyAtomicsPlayer> = {}): FamilyAtomicsPlayer {
  return { id: 'p', faction: 'atreides', forces, ...extra };
}

void test('Basic keeps its original pre-movement territory gate without Advanced turn or calculation requirements', () => {
  const basic = { phase: 0, shieldWallDestroyed: false };
  assert.equal(blocked(basic, player()), null);
  assert.equal(blocked({ ...basic, advanced: false, turn: 1, storm: 6, stormPending: null },
    player({ 'pasty_mesa:5': 1 })), null);
  assert.match(blocked(basic, player({ 'arsunt:9': 1 }))!, /on or adjacent/);
});

void test('an intact Wall and the still-open original Storm card window are common requirements', () => {
  for (const extra of [{ shieldWallDestroyed: true }, { phase: 1 },
    { stormCardWindowOpen: false }, { stormResolution: { distance: 3 } }]) {
    assert.match(blocked(state(extra), player())!, /before storm movement/);
    assert.match(blocked(state({ ...extra, advanced: false }), player())!, /before storm movement/);
  }
  assert.equal(blocked(state({ stormCardWindowOpen: true, stormResolution: null }), player()), null);
});

void test('Advanced requires a later turn and calculated movement including zero before the storm moves', () => {
  assert.match(blocked(state({ turn: 1 }), player())!, /after the first/);
  assert.match(blocked(state({ turn: undefined }), player())!, /after the first/);
  for (const stormPending of [undefined, null, -1, 1.5, 41, Number.NaN])
    assert.match(blocked(state({ stormPending }), player())!, /movement is calculated/);
  assert.equal(blocked(state({ stormPending: 0 }), player()), null);
  assert.equal(blocked(state({ stormPending: 40 }), player()), null);
  for (const storm of [undefined, -1, 19, 1.5, Number.NaN])
    assert.match(blocked(state({ storm }), player())!, /storm position/);
  assert.equal(blocked(state({ storm: 0 }), player()), null, 'inactive/legacy position zero remains tolerated');
});

void test('physical fighters in every actual touching region qualify and storm at either endpoint is allowed', () => {
  for (const key of ['shield_wall:8', 'shield_wall:9', 'gara_kulon:8', 'hole_in_the_rock:9',
    'imperial_basin:9', 'pasty_mesa:8', 'the_minor_erg:8', 'sihaya_ridge:9'])
    assert.equal(blocked(state(), player({ [key]: 1 })), null, key);
  assert.equal(blocked(state({ storm: 5 }), player({ 'pasty_mesa:5': 1 })), null);
  assert.equal(blocked(state({ storm: 8 }), player({ 'pasty_mesa:5': 1 })), null);
  assert.equal(blocked(state({ storm: 11 }), player({ 'imperial_basin:11': 1 })), null);
  assert.equal(blocked(state({ storm: 9 }), player({ 'imperial_basin:11': 1 })), null);
});

void test('a strictly intervening storm blocks the direct sector route without a long circular detour', () => {
  assert.match(blocked(state({ storm: 6 }), player({ 'pasty_mesa:5': 1 }))!, /intervening storm/);
  assert.match(blocked(state({ storm: 7 }), player({ 'the_minor_erg:5': 1 }))!, /intervening storm/);
  assert.match(blocked(state({ storm: 10 }), player({ 'imperial_basin:11': 1 }))!, /intervening storm/);
  assert.equal(blocked(state({ storm: 12 }), player({ 'imperial_basin:11': 1 })), null);
  assert.equal(blocked(state({ storm: 4 }), player({ 'pasty_mesa:5': 1 })), null);
});

void test('BG advisors and a concealed No-Field marker do not supply Advanced physical fighters', () => {
  const advisors = player({ 'shield_wall:8': 2 }, { faction: 'beneGesserit', advisors: { shield_wall: {} } });
  assert.match(blocked(state(), advisors)!, /physical fighters/);
  assert.match(blocked(state({ advanced: false }), advisors)!, /need forces/);
  assert.equal(blocked(state(), player({ 'shield_wall:8': 2 }, { faction: 'beneGesserit' })), null);
  const concealed = { ...player({}, { faction: 'richese' }),
    noField: { deployed: { location: { territory: 'shield_wall', sector: 8 } } } };
  assert.match(blocked(state(), concealed)!, /physical fighters/);
});

void test('remote presence, invalid physical locations and nonpositive counters cannot establish the sector source', () => {
  const invalidForces: Record<string, number>[] = [{ 'arsunt:9': 1 }, { 'shield_wall:0': 1 }, { 'pasty_mesa:9': 1 },
    { 'shield_wall:8:extra': 1 }, { 'shield_wall:8': 0 }, { 'shield_wall:8': -1 },
    { 'shield_wall:8': Number.NaN }];
  for (const forces of invalidForces)
    assert.match(blocked(state(), player(forces))!, /physical fighters/);
});

void test('one unblocked owned fighter source is enough and quoting never changes state or forces', () => {
  const current = state({ storm: 6 });
  const own = player({ 'pasty_mesa:5': 2, 'imperial_basin:9': 1 });
  const before = structuredClone({ current, own });
  Object.freeze(current);
  Object.freeze(own.forces);
  Object.freeze(own);
  assert.equal(blocked(current, own), null);
  assert.deepEqual({ current, own }, before);
  assert.match(blocked(current, player({ 'pasty_mesa:5': 2 }))!, /intervening storm/);
});
