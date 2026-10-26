import assert from 'node:assert/strict';
import test from 'node:test';
import {
  homeworldOccupationModulesProfile as supported,
  homeworldOccupationLeaderSkillsProfile as cleanSkills,
  homeworldPhaseModulesProfile as clean,
  type HomeworldPhaseModulesProfile,
} from '../game/homeworld-module-profile';
import { independentDiscoveryProfile, nexusCoreProfile } from '../game/faction-module-profile';
import {
  classicNexusLeaderSkillsProfile,
  homeworldLeaderSkillsProfile,
  pairedNexusLeaderSkillsProfile,
} from '../game/leader-skill-profile';
import {
  classicDiscoveryLeaderSkillsProfile,
  classicDiscoveryNexusProfile,
  homeworldDiscoveryProfile,
  pairedDiscoveryNexusProfile,
} from '../game/discovery-module-profile';
import { mixedE3NexusProfile, standaloneE3NexusProfile } from '../game/nexus-module-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';

function profile(factions: readonly string[] = ['atreides', 'emperor', 'guild'], expansions: readonly string[] = [],
  extra: Partial<HomeworldPhaseModulesProfile> = {}): HomeworldPhaseModulesProfile {
  return { advanced: false, expansions, players: factions.map(faction => ({ faction })),
    homeworlds: { custody: null }, ...extra };
}
const nexus = () => ({ cards: null, phase: null });

void test('original classic World Nexus accepts its initialized core reactions with and without Skills', () => {
  const game = profile(['atreides', 'harkonnen', 'guild'], [], { advanced: true, nexusCards: nexus(),
    techTokens: createTechTokens(), strongholdCards: createStrongholdCards(),
    homeworldOccupationPreview: true, nexusIxianReplacementPreview: true,
    nexusHarkonnenBetrayalPreview: true, guildBetrayalPreview: true });
  assert.equal(nexusCoreProfile(game), true); assert.equal(supported(game), true);
  const trained = { ...game, leaderSkills: { deck: [], assignments: [] }, spiceBankerIncomePreview: true };
  assert.equal(homeworldLeaderSkillsProfile(trained), true); assert.equal(supported(trained), true);
  assert.equal(clean(game), false); assert.equal(cleanSkills(trained), false);
});

void test('original classic Discovery retains separate untrained and all14 World admission', () => {
  const game = profile(undefined, undefined, { discoveryEnabled: true, techTokens: createTechTokens() });
  assert.equal(homeworldDiscoveryProfile(game), true); assert.equal(supported(game), true);
  const trained = { ...game, leaderSkills: { deck: [], offers: {} }, spiceBankerIncomePreview: true };
  assert.equal(classicDiscoveryLeaderSkillsProfile(trained), true);
  assert.equal(homeworldLeaderSkillsProfile(trained), true); assert.equal(supported(trained), true);
  assert.equal(supported({ ...game, discoveryEnabled: false, discoveries: {} }), false);
  assert.equal(supported({ ...game, discoveryEnabled: 'true' }), false);
});

void test('classic World Nexus and Discovery use their original joint profiles rather than hiding either module', () => {
  const game = profile(undefined, undefined, { advanced: true, nexusCards: nexus(), discoveryEnabled: true,
    techTokens: createTechTokens(), strongholdCards: createStrongholdCards() });
  assert.equal(classicDiscoveryNexusProfile(game), true); assert.equal(supported(game), true);
  const trained = { ...game, leaderSkills: true, spiceBankerIncomePreview: true };
  assert.equal(classicNexusLeaderSkillsProfile(trained), true);
  assert.equal(homeworldLeaderSkillsProfile(trained), true); assert.equal(supported(trained), true);
  assert.equal(nexusCoreProfile(game), false, 'The non-Discovery core does not manufacture this separate admission');
});

void test('original native Nexus includes bare paired E1 and existing standalone and mixed E3 World rosters', () => {
  const paired = profile(['ixians', 'tleilaxu', 'emperor'], ['ix'], { nexusCards: nexus() });
  assert.equal(pairedNexusLeaderSkillsProfile(paired), true, 'The original paired configuration needs no phase module');
  assert.equal(supported(paired), true);
  const discovery = { ...paired, discoveryEnabled: true };
  assert.equal(pairedDiscoveryNexusProfile(discovery), true); assert.equal(supported(discovery), true);
  const standalone = profile(['moritani', 'emperor', 'guild'], ['ecaz'], { advanced: true,
    nexusCards: nexus(), moritaniAssassinatePreview: true });
  assert.equal(standaloneE3NexusProfile(standalone), true); assert.equal(supported(standalone), true);
  const mixed = profile(['ixians', 'choam', 'ecaz', 'moritani'], ['ix', 'choam', 'ecaz'], {
    advanced: true, nexusCards: nexus(), techTokens: createTechTokens(), strongholdCards: createStrongholdCards(),
    ecazOccupyPreview: true, moritaniAssassinatePreview: true, homeworldOccupationPreview: true,
    homeworldTupilePreview: true, homeworldEcazVictoryPreview: true });
  assert.equal(mixedE3NexusProfile(mixed), true); assert.equal(supported(mixed), true);
  const trained = { ...mixed, leaderSkills: true, discoveryEnabled: true, spiceBankerIncomePreview: true };
  assert.equal(homeworldLeaderSkillsProfile(trained), true); assert.equal(supported(trained), true);
});

void test('independent cards retain already-admitted selected and unused families beside Nexus or Discovery', () => {
  const selected = profile(['ecaz', 'ixians', 'emperor'], ['ix', 'choam', 'ecaz'], {
    nexusCards: nexus(), ecazTreachery: true, nexusIxianBetrayalPreview: true,
    ecazOccupyPreview: true, homeworldOccupationPreview: true, homeworldEcazVictoryPreview: true });
  assert.equal(nexusCoreProfile(selected), true); assert.equal(supported(selected), true);
  const unused = profile(undefined, ['ix', 'choam', 'ecaz'], {
    discoveryEnabled: true, ecazTreachery: true, techTokens: createTechTokens() });
  assert.equal(independentDiscoveryProfile(unused), true); assert.equal(supported(unused), true);
  const both = profile(['ecaz', 'moritani', 'choam'], ['ix', 'choam', 'ecaz'], {
    advanced: true, ecazTreachery: true, nexusCards: nexus(), discoveryEnabled: true, leaderSkills: true,
    techTokens: createTechTokens(), strongholdCards: createStrongholdCards(), spiceBankerIncomePreview: true,
    nexusIxianReplacementPreview: true, moritaniAssassinatePreview: true, ecazOccupyPreview: true,
    homeworldOccupationPreview: true, homeworldTupilePreview: true, homeworldEcazVictoryPreview: true });
  assert.equal(independentDiscoveryProfile(both), true); assert.equal(homeworldLeaderSkillsProfile(both), true);
  assert.equal(supported(both), true);
});

void test('occupation selection preserves original Advanced roles, family requirements and phase limits', () => {
  const guarded = profile(['ecaz', 'harkonnen', 'guild'], ['ecaz'], {
    advanced: true, nexusCards: nexus(), leaderSkills: true });
  assert.equal(homeworldLeaderSkillsProfile(guarded), false); assert.equal(supported(guarded), false);
  const discoveryGuard = profile(['moritani', 'harkonnen', 'guild'], ['ecaz'], {
    advanced: true, discoveryEnabled: true });
  assert.equal(homeworldDiscoveryProfile(discoveryGuard), false); assert.equal(supported(discoveryGuard), false);
  for (const game of [
    profile(['ixians', 'emperor'], [], { nexusCards: nexus() }),
    profile(['ixians', 'emperor', 'guild'], ['ix', 'choam'], { nexusCards: nexus() }),
    profile(['atreides', 'emperor'], [], { nexusCards: nexus(), techTokens: createTechTokens() }),
    profile(undefined, undefined, { nexusCards: nexus(), strongholdCards: createStrongholdCards() }),
    profile(['atreides', 'atreides'], [], { nexusCards: nexus() }),
    profile(undefined, ['ix', 'ix'], { discoveryEnabled: true }),
  ]) assert.equal(supported(game), false);
  assert.equal(supported(profile(['atreides', 'emperor'], [], {
    advanced: true, nexusCards: nexus(), strongholdCards: createStrongholdCards() })), true);
});

void test('unrelated previews and mismatched native, parent, reaction or Banker stamps remain outside occupation permission', () => {
  const game = profile(undefined, undefined, { nexusCards: nexus() });
  for (const field of ['semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview',
    'richeseBetrayalPreview'] as const) assert.equal(supported({ ...game, [field]: true }), false, field);
  for (const extra of [
    { ecazOccupyPreview: true }, { moritaniAssassinatePreview: true },
    { homeworldOccupationPreview: true, homeworldTupilePreview: true },
    { homeworldOccupationPreview: true, homeworldEcazVictoryPreview: true },
    { nexusIxianBetrayalPreview: true }, { nexusHarkonnenBetrayalPreview: true },
    { spiceBankerIncomePreview: true }, { ecazTreachery: 'true' },
  ]) assert.equal(supported({ ...game, ...extra }), false);
  assert.equal(supported(profile(['atreides', 'emperor', 'harkonnen'], [], {
    nexusCards: nexus(), guildBetrayalPreview: true })), false);
  assert.equal(supported(profile(['ixians', 'emperor', 'guild'], ['ix'], {
    nexusCards: nexus(), ecazTreachery: true, nexusIxianReplacementPreview: true })), false);
  for (const field of ['homeworldOccupationPreview', 'homeworldTupilePreview', 'homeworldEcazVictoryPreview',
    'ecazOccupyPreview', 'moritaniAssassinatePreview', 'spiceBankerIncomePreview', 'guildBetrayalPreview',
    'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview', 'nexusHarkonnenBetrayalPreview'] as const)
    assert.equal(supported({ ...game, [field]: 'forged' }), false, field);
});

void test('live native Discovery, active printed Sandtrout and occupied custody stay configuration-neutral without changing clean helpers', () => {
  const custody = { visitors: { 'homeworld:ixians': { emperor: { normal: 1, elite: 1 } } } };
  const discoveries = { turn: 2, tokens: [], encounters: [] };
  const game = profile(['ixians', 'tleilaxu', 'emperor'], ['ix'], { nexusCards: nexus(), discoveryEnabled: true,
    homeworlds: { custody, historyVersion: 1 }, homeworldOccupationPreview: true, sandtrout: true,
    discoveries, discoveryStash: {}, greatMaker: { turn: 2 } });
  assert.equal(pairedDiscoveryNexusProfile(game), true);
  const before = structuredClone(game); Object.freeze(custody); Object.freeze(game.players); Object.freeze(game);
  assert.equal(supported(game), true); assert.deepEqual(game, before);
  assert.equal((game.homeworlds as { custody: unknown }).custody, custody); assert.equal(game.discoveries, discoveries);
  const plain = profile(); const trained = { ...plain, leaderSkills: true };
  assert.equal(clean(plain), true); assert.equal(cleanSkills(trained), true);
  assert.equal(supported(plain), false); assert.equal(supported(trained), false);
  assert.equal(clean({ ...plain, sandtrout: true }), false); assert.equal(cleanSkills({ ...trained, sandtrout: true }), false);
  for (const value of [null, {}, { ...game, expansions: 'ix' }, { ...game, players: [{ faction: 'ixians' }, null] }])
    assert.equal(supported(value as unknown as HomeworldPhaseModulesProfile), false);
});
