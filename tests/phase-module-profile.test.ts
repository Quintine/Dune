import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nativeFactionTechProfile as tech, selectedFactionStrongholdProfile as strongholds,
  selectedPhaseModuleRoster as roster, type FactionModuleProfile,
} from '../game/faction-module-profile';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createTechTokens } from '../game/tech-tokens';

function profile(factions: readonly string[] = ['ecaz', 'moritani', 'guild'],
  expansions: readonly string[] = ['ecaz'], extra: Partial<FactionModuleProfile> = {}): FactionModuleProfile {
  return { advanced: true, expansions, players: factions.map(faction => ({ faction })),
    techTokens: createTechTokens(), ...extra };
}

void test('selected phase rosters admit paired E3, mixed families and all six natives without changing selected-deck order', () => {
  for (const game of [
    profile(), profile(['ecaz', 'ixians', 'guild'], ['ecaz', 'ix']),
    profile(['moritani', 'choam', 'guild'], ['choam', 'ecaz']),
    profile(['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz']),
  ]) {
    const before = structuredClone(game);
    assert.equal(roster(game), true); assert.equal(tech(game), true); assert.equal(strongholds(game), true);
    assert.deepEqual(game, before);
  }
});

void test('classic-only selected-deck rosters and unused selected families are valid while no-expansion base admission stays separate', () => {
  for (const expansions of [['ix'], ['choam'], ['ecaz'], ['ix', 'choam', 'ecaz']]) {
    const classic = profile(['atreides', 'emperor', 'guild'], expansions);
    assert.equal(roster(classic), true); assert.equal(tech(classic), true); assert.equal(strongholds(classic), true);
  }
  const unused = profile(['ixians', 'guild', 'emperor'], ['ecaz', 'choam', 'ix']);
  assert.equal(roster(unused), true); assert.equal(tech(unused), true); assert.equal(strongholds(unused), true);
  const base = profile(['atreides', 'emperor', 'guild'], []);
  assert.equal(roster(base), false); assert.equal(tech(base), false); assert.equal(strongholds(base), false);
});

void test('unknown, missing and duplicate selected families or seated identities cannot grant phase modules', () => {
  for (const game of [
    profile(['ixians', 'guild', 'emperor'], ['choam']),
    profile(['ecaz', 'guild', 'emperor'], ['ix', 'choam']),
    profile(['ixians', 'guild', 'emperor'], ['ix', 'ix']),
    profile(['ecaz', 'guild', 'emperor'], ['ecaz', 'unknown']),
    profile(['ixians', 'guild', 'emperor'], ['ix', 'choam', 'ecaz', 'ix']),
    profile(['unknown', 'guild', 'emperor']), profile(['ecaz', 'ecaz', 'guild']),
  ]) {
    assert.equal(roster(game), false); assert.equal(tech(game), false); assert.equal(strongholds(game), false);
  }
  for (const value of [null, {}, { expansions: 'ix', players: [{ faction: 'ixians' }, { faction: 'guild' }] },
    { expansions: ['ix'], players: [{ faction: 'ixians' }, null] }])
    assert.equal(roster(value as unknown as Pick<FactionModuleProfile, 'expansions' | 'players'>), false);
});

void test('the roster admits two through six seats while Tech independently requires at least three', () => {
  const seats = ['ecaz', 'moritani', 'ixians', 'tleilaxu', 'choam', 'richese'];
  for (let count = 2; count <= 6; count++) {
    const game = profile(seats.slice(0, count), ['ix', 'choam', 'ecaz']);
    assert.equal(roster(game), true); assert.equal(tech(game), count >= 3);
    assert.equal(strongholds({ ...game, techTokens: null }), true);
    assert.equal(strongholds(game), count >= 3);
  }
  for (const game of [profile(['ecaz']), profile([...seats, 'guild'], ['ix', 'choam', 'ecaz'])]) {
    assert.equal(roster(game), false); assert.equal(tech(game), false); assert.equal(strongholds(game), false);
  }
  assert.equal(tech({ ...profile(), techTokens: null }), false);
});

void test('Basic Tech remains available but Strongholds require Advanced and may start with absent or unused card state', () => {
  const basic = profile(undefined, undefined, { advanced: false });
  assert.equal(tech(basic), true); assert.equal(strongholds(basic), false);
  assert.equal(tech({ ...basic, strongholdCards: createStrongholdCards() }), false);
  const advanced = profile();
  assert.equal(strongholds(advanced), true);
  assert.equal(strongholds({ ...advanced, strongholdCards: createStrongholdCards() }), true);
  assert.equal(tech({ ...advanced, strongholdCards: createStrongholdCards() }), true);
  assert.equal(tech({ ...advanced, advanced: 'advanced' as unknown as boolean }), false);
  assert.equal(strongholds({ ...advanced, advanced: 'advanced' as unknown as boolean }), false);
});

void test('phase permission wrappers reject unrelated modules and preview selectors while roster validity stays independent', () => {
  for (const field of [
    'leaderSkills', 'homeworlds', 'nexusCards', 'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker',
    'ecazTreachery', 'semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview', 'guildBetrayalPreview',
    'richeseBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview', 'nexusHarkonnenBetrayalPreview',
  ] as const) {
    const game = { ...profile(), [field]: true };
    assert.equal(roster(game), true); assert.equal(tech(game), false, field); assert.equal(strongholds(game), false, field);
  }
});

void test('canonical Ecaz and Moritani runtime stamps and the supported Advanced Harkonnen roster do not block new phase admission', () => {
  const game = profile(['ecaz', 'moritani', 'harkonnen'], ['ecaz'], {
    ecazOccupyPreview: true, moritaniAssassinatePreview: true, strongholdCards: createStrongholdCards(),
  });
  assert.equal(roster(game), true); assert.equal(tech(game), true); assert.equal(strongholds(game), true);
  assert.equal(tech(game, true), false, 'Explicit Semuta keeps its earlier Advanced Moritani/Harkonnen boundary');
});

void test('explicit Semuta preserves its original E1/E2 and exactly-one-E3-native positive envelope', () => {
  for (const game of [
    profile(['ixians', 'guild', 'emperor'], ['ix']),
    profile(['richese', 'choam', 'guild'], ['choam']),
    profile(['ixians', 'guild', 'emperor'], ['ix', 'choam']),
    profile(['ecaz', 'guild', 'emperor'], ['ecaz']),
    profile(['moritani', 'guild', 'emperor'], ['ecaz']),
    profile(['moritani', 'harkonnen', 'guild'], ['ecaz'], { advanced: false }),
  ]) {
    assert.equal(tech(game, true), true);
    const stamped = { ...game, semutaPreview: true };
    assert.equal(tech(stamped), false); assert.equal(tech(stamped, true), true);
    assert.equal(strongholds(stamped), false);
    assert.equal(tech({ ...stamped, semutaPreview: 'foreign-stamp' }, true), false);
  }
});

void test('explicit Semuta cannot inherit paired, mixed, all-three-family, classic-only or Advanced Moritani/Harkonnen admission', () => {
  for (const game of [
    profile(), profile(['ecaz', 'ixians', 'guild'], ['ecaz', 'ix']),
    profile(['moritani', 'choam', 'guild'], ['ecaz', 'choam']),
    profile(['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz']),
    profile(['ixians', 'guild', 'emperor'], ['ix', 'choam', 'ecaz']),
    profile(['atreides', 'emperor', 'guild'], ['choam']),
    profile(['moritani', 'harkonnen', 'guild'], ['ecaz']),
  ]) {
    const before = structuredClone(game);
    assert.equal(tech(game), true); assert.equal(tech(game, true), false);
    assert.equal(tech({ ...game, semutaPreview: true }, true), false); assert.deepEqual(game, before);
  }
});
