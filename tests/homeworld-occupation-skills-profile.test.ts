import assert from 'node:assert/strict';
import test from 'node:test';
import {
  homeworldOccupationLeaderSkillsProfile as supported,
  homeworldPhaseModulesProfile as untrained,
  type HomeworldPhaseModulesProfile,
} from '../game/homeworld-module-profile';
import { homeworldLeaderSkillsProfile as admitted } from '../game/leader-skill-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';

function profile(factions: readonly string[] = ['atreides', 'emperor', 'guild'], expansions: readonly string[] = [],
  extra: Partial<HomeworldPhaseModulesProfile> = {}): HomeworldPhaseModulesProfile {
  return { advanced: false, expansions, players: factions.map(faction => ({ faction })),
    homeworlds: { custody: null }, leaderSkills: true, ...extra };
}

void test('original classic World/all14 admission gains clean occupation benefits with its optional phase modules', () => {
  for (const game of [profile(), profile(undefined, undefined, { advanced: true }),
    profile(undefined, undefined, { techTokens: createTechTokens(), ecazTreachery: true }),
    profile(undefined, undefined, { advanced: true, techTokens: createTechTokens(), strongholdCards: createStrongholdCards() }),
  ]) {
    assert.equal(admitted(game), true); assert.equal(supported(game), true);
    assert.equal(untrained(game), false, 'The original untrained World predicate still rejects Skills');
  }
});

void test('the unchanged selected-family all14 predicate remains the source of native roster and role admission', () => {
  for (const game of [
    profile(['ecaz', 'ixians', 'emperor'], ['ecaz', 'ix']),
    profile(['ecaz', 'moritani', 'choam'], ['ecaz', 'choam'], { advanced: true }),
    profile(['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz'],
      { advanced: true, ecazTreachery: true, techTokens: createTechTokens(), strongholdCards: createStrongholdCards() }),
    profile(['atreides', 'emperor', 'guild'], ['ix', 'choam', 'ecaz']),
  ]) {
    assert.equal(admitted(game), true); assert.equal(supported(game), true);
  }
  for (const game of [
    profile(['ecaz', 'harkonnen', 'guild'], ['ecaz'], { advanced: true }),
    profile(['moritani', 'harkonnen', 'guild'], ['ecaz'], { advanced: true }),
  ]) {
    assert.equal(admitted(game), false); assert.equal(supported(game), false);
  }
});

void test('required modules, physical seat bounds and existing phase limits do not change with benefit initialization', () => {
  assert.equal(supported(profile(undefined, undefined, { homeworlds: null })), false);
  assert.equal(supported(profile(undefined, undefined, { leaderSkills: null })), false);
  const two = profile(['atreides', 'emperor']);
  assert.equal(supported(two), true);
  assert.equal(supported({ ...two, techTokens: createTechTokens() }), false);
  assert.equal(supported({ ...two, strongholdCards: createStrongholdCards() }), false);
  assert.equal(supported({ ...two, advanced: true, strongholdCards: createStrongholdCards() }), true);
  for (const game of [profile(['atreides']), profile(['atreides', 'atreides']),
    profile(['ecaz', 'guild', 'emperor']), profile(undefined, ['ix', 'ix']),
    profile(['atreides', 'emperor', 'guild', 'fremen', 'beneGesserit', 'harkonnen', 'ecaz'], ['ecaz']),
  ]) assert.equal(supported(game), false);
});

void test('occupation benefit context excludes Nexus, Discovery and unrelated reaction selectors without changing library admission', () => {
  for (const field of ['nexusCards', 'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker',
    'semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview', 'guildBetrayalPreview',
    'richeseBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview', 'nexusHarkonnenBetrayalPreview',
  ] as const) assert.equal(supported({ ...profile(), [field]: true }), false, field);
  const nexus = profile(undefined, undefined, { nexusCards: { cards: null, phase: null } });
  assert.equal(admitted(nexus), true, 'Existing Nexus/World/all14 library entry stays independently admitted');
  assert.equal(supported(nexus), false, 'This clean benefit slice does not claim that separate combination');
});

void test('pending printed Sandtrout retains occupation and all14 roles under the same original World admission', () => {
  const game = profile(['ixians', 'emperor', 'atreides'], ['ix'], { advanced: true,
    homeworldOccupationPreview: true, spiceBankerIncomePreview: true,
    techTokens: createTechTokens(), strongholdCards: createStrongholdCards(),
  });
  for (const sandtrout of [undefined, false, true]) {
    const active = { ...game, sandtrout };
    assert.equal(admitted(active), true);
    assert.equal(supported(active), true);
  }
  for (const sandtrout of [null, 0, 1, 'true', {}]) assert.equal(supported({ ...game, sandtrout }), false);
});

void test('canonical Banker and native occupation stamps require their actual parent factions and retain the Advanced assassination band', () => {
  const native = profile(['ecaz', 'moritani', 'choam'], ['ecaz', 'choam'], { advanced: true,
    homeworldOccupationPreview: true, homeworldTupilePreview: true, homeworldEcazVictoryPreview: true,
    ecazOccupyPreview: true, moritaniAssassinatePreview: true, spiceBankerIncomePreview: true });
  assert.equal(admitted(native), true); assert.equal(supported(native), true);
  assert.equal(supported(profile(undefined, undefined, { spiceBankerIncomePreview: true })), true);
  for (const game of [
    { ...native, homeworldOccupationPreview: undefined }, { ...native, advanced: false },
    profile(undefined, undefined, { ecazOccupyPreview: true }),
    profile(undefined, undefined, { advanced: true, moritaniAssassinatePreview: true }),
    profile(undefined, undefined, { homeworldOccupationPreview: true, homeworldTupilePreview: true }),
    profile(undefined, undefined, { homeworldOccupationPreview: true, homeworldEcazVictoryPreview: true }),
  ]) assert.equal(supported(game), false);
  for (const field of ['spiceBankerIncomePreview', 'ecazOccupyPreview', 'moritaniAssassinatePreview',
    'homeworldOccupationPreview', 'homeworldTupilePreview', 'homeworldEcazVictoryPreview'] as const)
    assert.equal(supported({ ...native, [field]: 'forged' }), false, field);
});

void test('fresh offers and live occupied posture remain configuration-neutral rather than a new deal or ownership predicate', () => {
  const skills = { deck: ['sandmaster'], offers: {}, assignments: [
    { owner: 'seat-a', leader: 'disc-a', skill: 'spice-banker', faceUp: false },
  ] };
  const custody = { visitors: { 'homeworld:atreides': { 'seat-e': { normal: 1, elite: 1 } } },
    salusa: { normal: 0, elite: 4 } };
  const game = profile(undefined, undefined, { advanced: true, leaderSkills: skills,
    homeworlds: { custody, historyVersion: 1 }, homeworldOccupationPreview: true,
    spiceBankerIncomePreview: true, techTokens: createTechTokens(), strongholdCards: createStrongholdCards() });
  const before = structuredClone(game); Object.freeze(game.players); Object.freeze(game);
  assert.equal(admitted(game), true); assert.equal(supported(game), true); assert.deepEqual(game, before);
  assert.equal(game.leaderSkills, skills); assert.equal((game.homeworlds as { custody: unknown }).custody, custody);
});

void test('the previous untrained helper retains its behavior and malformed configuration never widens the all14 route', () => {
  const plain = profile(undefined, undefined, { leaderSkills: undefined });
  assert.equal(untrained(plain), true); assert.equal(supported(plain), false);
  assert.equal(untrained(profile()), false); assert.equal(supported(profile()), true);
  assert.equal(untrained(profile(undefined, undefined, { leaderSkills: undefined, spiceBankerIncomePreview: true })), false);
  for (const game of [profile(undefined, undefined, { ecazTreachery: 'true' }),
    profile(undefined, undefined, { advanced: 'advanced' as unknown as boolean })]) assert.equal(supported(game), false);
  for (const value of [null, {}, { ...profile(), expansions: 'ix' }, { ...profile(), players: [{ faction: 'atreides' }, null] }])
    assert.equal(supported(value as unknown as HomeworldPhaseModulesProfile), false);
});
