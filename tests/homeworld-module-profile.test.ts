import assert from 'node:assert/strict';
import test from 'node:test';
import {
  homeworldPhaseModulesProfile as supported, type HomeworldPhaseModulesProfile,
} from '../game/homeworld-module-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';

function profile(factions: readonly string[] = ['atreides', 'emperor', 'guild'], expansions: readonly string[] = [],
  extra: Partial<HomeworldPhaseModulesProfile> = {}): HomeworldPhaseModulesProfile {
  return { advanced: false, expansions, players: factions.map(faction => ({ faction })),
    homeworlds: { custody: null }, ...extra };
}

void test('classic empty-deck Homeworld starts permit both modes and independent cards without requiring phase modules', () => {
  for (const advanced of [false, true]) for (const ecazTreachery of [undefined, false, true])
    assert.equal(supported(profile(undefined, undefined, { advanced, ecazTreachery })), true);
  assert.equal(supported(profile(undefined, undefined, { homeworldOccupationPreview: true })), true);
  assert.equal(supported(profile(undefined, undefined, { homeworlds: null })), false);
  assert.equal(supported(profile(undefined, undefined, { advanced: 'advanced' as unknown as boolean })), false);
});

void test('selected native, paired, mixed and unused family decks retain their actual Homeworld roster', () => {
  for (const game of [
    profile(['ecaz', 'moritani', 'guild'], ['ecaz']),
    profile(['ecaz', 'ixians', 'emperor'], ['ix', 'ecaz']),
    profile(['moritani', 'harkonnen', 'guild'], ['ecaz'], { advanced: true }),
    profile(['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz'], { advanced: true }),
    profile(['atreides', 'emperor', 'guild'], ['ix', 'choam', 'ecaz']),
    profile(['ixians', 'guild', 'emperor'], ['ix', 'choam', 'ecaz']),
  ]) assert.equal(supported(game), true);
});

void test('Homeworld Tech retains three-six seats and Strongholds retain Advanced two-six with both requiring three', () => {
  const two = profile(['atreides', 'emperor']);
  assert.equal(supported(two), true);
  assert.equal(supported({ ...two, techTokens: createTechTokens() }), false);
  assert.equal(supported({ ...two, strongholdCards: createStrongholdCards() }), false);
  assert.equal(supported({ ...two, advanced: true, strongholdCards: createStrongholdCards() }), true);
  assert.equal(supported({ ...two, advanced: true, strongholdCards: createStrongholdCards(), techTokens: createTechTokens() }), false);
  assert.equal(supported(profile(undefined, undefined, { ecazTreachery: true, techTokens: createTechTokens() })), true);
  assert.equal(supported(profile(undefined, undefined, { advanced: true, ecazTreachery: true,
    techTokens: createTechTokens(), strongholdCards: createStrongholdCards() })), true);
});

void test('unknown, duplicate, missing-family and out-of-bounds rosters do not create a fictitious selected deck', () => {
  for (const game of [
    profile(['ecaz', 'guild', 'emperor']), profile(['ixians', 'guild', 'emperor'], ['choam']),
    profile(undefined, ['ix', 'ix']), profile(undefined, ['unknown']),
    profile(undefined, ['ix', 'choam', 'ecaz', 'ix']), profile(['unknown', 'guild']),
    profile(['atreides', 'atreides']), profile(['atreides']),
    profile(['atreides', 'emperor', 'guild', 'fremen', 'beneGesserit', 'harkonnen', 'ecaz'], ['ecaz']),
  ]) assert.equal(supported(game), false);
  for (const value of [null, {}, { ...profile(), expansions: 'ix' },
    { ...profile(), players: 'atreides,emperor' }, { ...profile(), players: [{ faction: 'atreides' }, null] }])
    assert.equal(supported(value as unknown as HomeworldPhaseModulesProfile), false);
});

void test('independent-card selection is an exact optional boolean rather than a truthy capability', () => {
  for (const ecazTreachery of [undefined, false, true]) assert.equal(supported(profile(undefined, undefined, { ecazTreachery })), true);
  for (const ecazTreachery of [null, 0, 1, 'true', {}]) assert.equal(supported(profile(undefined, undefined, { ecazTreachery })), false);
});

void test('Skills, Nexus, Discovery, active Sandtrout and unrelated reaction selectors remain outside the clean World scope', () => {
  for (const field of [
    'leaderSkills', 'nexusCards', 'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'sandtrout',
    'spiceBankerIncomePreview', 'semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview',
    'guildBetrayalPreview', 'richeseBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview',
    'nexusHarkonnenBetrayalPreview',
  ] as const) assert.equal(supported({ ...profile(), [field]: true }), false, field);
});

void test('canonical occupation and native benefit stamps retain their actual seated source and required parent', () => {
  const native = profile(['ecaz', 'moritani', 'choam'], ['choam', 'ecaz'], { advanced: true,
    ecazOccupyPreview: true, moritaniAssassinatePreview: true, homeworldOccupationPreview: true,
    homeworldTupilePreview: true, homeworldEcazVictoryPreview: true });
  assert.equal(supported(native), true);
  assert.equal(supported(profile(['ecaz', 'guild'], ['ecaz'], { ecazOccupyPreview: true })), true);
  for (const game of [
    profile(undefined, undefined, { ecazOccupyPreview: true }),
    profile(undefined, undefined, { advanced: true, moritaniAssassinatePreview: true }),
    { ...native, advanced: false },
    profile(undefined, undefined, { homeworldOccupationPreview: true, homeworldTupilePreview: true }),
    profile(undefined, undefined, { homeworldOccupationPreview: true, homeworldEcazVictoryPreview: true }),
    { ...native, homeworldOccupationPreview: undefined },
  ]) assert.equal(supported(game), false);
  for (const field of ['ecazOccupyPreview', 'moritaniAssassinatePreview', 'homeworldOccupationPreview',
    'homeworldTupilePreview', 'homeworldEcazVictoryPreview'] as const)
    assert.equal(supported({ ...native, [field]: 'forged' }), false, field);
});

void test('live occupied custody is configuration-neutral and the predicate never clones, resets or repairs physical state', () => {
  const custody = { visitors: { 'homeworld:atreides': { emperor: { normal: 1, elite: 1 } } },
    salusa: { normal: 0, elite: 4 } };
  const game = profile(undefined, undefined, { advanced: true, homeworlds: { custody, historyVersion: 1 },
    homeworldOccupationPreview: true, ecazTreachery: true, techTokens: createTechTokens(), strongholdCards: createStrongholdCards() });
  const before = structuredClone(game);
  Object.freeze(custody); Object.freeze(game.homeworlds); Object.freeze(game.players); Object.freeze(game);
  assert.equal(supported(game), true); assert.deepEqual(game, before);
  assert.equal((game.homeworlds as { custody: unknown }).custody, custody);
});
