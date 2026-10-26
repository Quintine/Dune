import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nativeFactionTechProfile as tech, selectedFactionStrongholdProfile as strongholds,
  selectedIndependentCardsProfile as independent, type FactionModuleProfile,
} from '../game/faction-module-profile';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createTechTokens } from '../game/tech-tokens';

function profile(factions: readonly string[] = ['ecaz', 'moritani', 'guild'],
  expansions: readonly string[] = ['ecaz'], extra: Partial<FactionModuleProfile> = {}): FactionModuleProfile {
  return { advanced: true, expansions, players: factions.map(faction => ({ faction })),
    ecazTreachery: true, techTokens: createTechTokens(), ...extra };
}

void test('selected independent cards retain original Tech across paired, mixed and all-three-family rosters in both modes', () => {
  for (const advanced of [false, true]) for (const game of [
    profile(undefined, undefined, { advanced }),
    profile(['ecaz', 'ixians', 'emperor'], ['ecaz', 'ix'], { advanced }),
    profile(['moritani', 'choam', 'guild'], ['choam', 'ecaz'], { advanced }),
    profile(['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz'], { advanced }),
  ]) {
    const before = structuredClone(game);
    assert.equal(independent(game), true); assert.deepEqual(game, before);
    assert.equal(tech(game), false, 'The card-free Tech wrapper must keep its existing scope');
    assert.equal(strongholds(game), false, 'The card-free Stronghold wrapper must keep its existing scope');
  }
});

void test('classic-only and unused selected families remain independent from actual seated native factions', () => {
  for (const decks of [['ix'], ['choam'], ['ecaz'], ['ix', 'choam', 'ecaz']])
    assert.equal(independent(profile(['atreides', 'emperor', 'guild'], decks)), true);
  assert.equal(independent(profile(['ixians', 'guild', 'emperor'], ['ix', 'choam', 'ecaz'])), true);
  for (const game of [
    profile(['atreides', 'emperor', 'guild'], []),
    profile(['ecaz', 'guild', 'emperor'], ['ix']),
    profile(['ecaz', 'guild', 'emperor'], ['ecaz', 'ecaz']),
    profile(['ecaz', 'guild', 'emperor'], ['ecaz', 'unknown']),
    profile(['unknown', 'guild', 'emperor']),
  ]) assert.equal(independent(game), false);
});

void test('the exact independent card selection permits bare mixed Basic play and optional original phase modules', () => {
  assert.equal(independent(profile(undefined, undefined, { techTokens: null, strongholdCards: null })), true);
  assert.equal(independent(profile(['ecaz', 'ixians', 'guild'], ['ecaz', 'ix'], {
    advanced: false, techTokens: null, strongholdCards: null,
  })), true);
  for (const ecazTreachery of [undefined, false, 'true', 1])
    assert.equal(independent(profile(undefined, undefined, { ecazTreachery })), false);
  assert.equal(independent(profile(undefined, undefined, { techTokens: null, strongholdCards: createStrongholdCards() })), true);
  assert.equal(independent(profile(undefined, undefined, { strongholdCards: createStrongholdCards() })), true);
});

void test('Tech keeps three-six seats and Strongholds two-six Advanced without inventing a Basic card mode', () => {
  const two = profile(['ecaz', 'ixians'], ['ecaz', 'ix']);
  assert.equal(independent(two), false);
  assert.equal(independent({ ...two, techTokens: null, strongholdCards: createStrongholdCards() }), true);
  assert.equal(independent({ ...two, techTokens: null, strongholdCards: createStrongholdCards(), advanced: false }), false);
  assert.equal(independent(profile(undefined, undefined, { advanced: false })), true);
  assert.equal(independent(profile(undefined, undefined, { advanced: false, strongholdCards: createStrongholdCards() })), false);
  assert.equal(independent(profile(['ecaz'])), false);
  assert.equal(independent(profile(['ecaz', 'ecaz', 'guild'])), false);
  assert.equal(independent(profile(['ecaz', 'moritani', 'guild', 'atreides', 'emperor', 'ixians', 'choam'], ['ix', 'choam', 'ecaz'])), false);
});

void test('unrelated modules, active Sandtrout and reaction-preview selectors cannot enter the independent phase scope', () => {
  for (const field of [
    'homeworlds', 'leaderSkills', 'nexusCards', 'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker',
    'sandtrout', 'spiceBankerIncomePreview', 'semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview',
    'guildBetrayalPreview', 'richeseBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview',
    'nexusHarkonnenBetrayalPreview',
  ] as const) assert.equal(independent({ ...profile(), [field]: true }), false, field);
});

void test('canonical native runtime stamps require their actual faction and Advanced assassination while captured-target Harkonnen is permitted', () => {
  assert.equal(independent(profile(undefined, undefined, { ecazOccupyPreview: true, moritaniAssassinatePreview: true })), true);
  assert.equal(independent(profile(['ecaz', 'ixians', 'guild'], ['ecaz', 'ix'], { advanced: false, ecazOccupyPreview: true })), true);
  assert.equal(independent(profile(['moritani', 'harkonnen', 'guild'], ['ecaz'], { moritaniAssassinatePreview: true })), true);
  for (const game of [
    profile(['ixians', 'guild', 'emperor'], ['ix'], { ecazOccupyPreview: true }),
    profile(['ecaz', 'guild', 'emperor'], ['ecaz'], { moritaniAssassinatePreview: true }),
    profile(undefined, undefined, { advanced: false, moritaniAssassinatePreview: true }),
    profile(undefined, undefined, { ecazOccupyPreview: 'forged' }),
    profile(undefined, undefined, { moritaniAssassinatePreview: 'forged' }),
  ]) assert.equal(independent(game), false);
});

void test('default phase wrappers and explicit Semuta retain their previous admission rather than inherit independent cards', () => {
  const bare = { ...profile(), ecazTreachery: undefined };
  assert.equal(tech(bare), true); assert.equal(strongholds(bare), true); assert.equal(tech(bare, true), false);
  const semuta = profile(['richese', 'choam', 'guild'], ['choam'], { ecazTreachery: undefined, semutaPreview: true });
  assert.equal(tech(semuta), false); assert.equal(tech(semuta, true), true); assert.equal(strongholds(semuta), false);
  assert.equal(independent(semuta), false);
  const combined = { ...semuta, ecazTreachery: true };
  assert.equal(independent(combined), false); assert.equal(tech(combined, true), false);
});

void test('the predicate accepts frozen public configuration without copying or mutating it and rejects malformed roster shapes', () => {
  const game = profile(); Object.freeze(game.expansions); game.players.forEach(Object.freeze); Object.freeze(game.players); Object.freeze(game);
  assert.equal(independent(game), true);
  for (const value of [null, {}, { ...profile(), players: 'ecaz,moritani,guild' },
    { ...profile(), players: [{ faction: 'ecaz' }, null] }, { ...profile(), expansions: 'ecaz' }])
    assert.equal(independent(value as unknown as FactionModuleProfile), false);
});
