import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { classicNexusModulesProfile } from '../game/nexus-module-profile';
import { nativeFactionTechProfile } from '../game/faction-module-profile';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type { FactionId } from '../game/catalog';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  initializeFactionExpansionsGameForAudit,
  initializeHomeworldGameForAudit,
  initializeStrongholdFactionsGameForAudit,
  initializeNexusGameForAudit,
  initializePairedNexusGameForAudit,
  initializeEcazTreacheryGameForAudit,
  initializeEcazOccupyGameForAudit,
  initializeMoritaniAssassinateGameForAudit,
  initializeCombinedNexusGameForAudit,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  RuleError,
  type Action,
  type Game,
} from '../game/engine';
import { sampleInventory, verifySampleCustody } from './sample-custody';
import { classicTechLeaderSkillsProfile, nativeExpansionLeaderSkillsProfile, nativeTechLeaderSkillsProfile, strongholdLeaderSkillsProfile } from '../game/leader-skill-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { privateOutputDirectory, sourceSnapshot } from './verification';

const DEFAULT_SEED = 20_260_926;
const DEFAULT_MAX_ACTIONS = 3_500;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
type Profile = 'base' | 'choam' | 'ecaz' | 'ecaz-treachery' | 'ecaz-occupy' | 'moritani-assassinate' | 'stronghold-factions' | 'combined' | 'combined-nexus' | 'combined-homeworld-nexus' | 'homeworld' | 'nexus' | 'homeworld-nexus' | 'choam-roster' | 'ecaz-roster' | 'ix-roster' | 'choam-nexus' | 'ecaz-nexus' | 'ix-nexus' | 'moritani-skills' | 'tleilaxu-skills' | 'ix-skills' | 'choam-skills' | 'richese-skills' | 'ecaz-skills' | 'skills-tech' | 'skills-stronghold' | 'skills-stronghold-tech'
  | 'factions-tech' | 'stronghold-factions-tech' | 'nexus-tech' | 'nexus-stronghold' | 'nexus-stronghold-tech';
type Rules = 'basic' | 'advanced';

type Scenario = {
  ordinal: number;
  profile: Profile;
  rules: Rules;
  expansions: string[];
  roster: FactionId[];
  ecazTreachery?: boolean;
};

const SCENARIOS: readonly Scenario[] = [
  {
    ordinal: 0,
    profile: 'choam',
    rules: 'basic',
    expansions: ['choam'],
    roster: ['richese', 'choam', 'emperor', 'guild'],
  },
  {
    ordinal: 1,
    profile: 'choam',
    rules: 'advanced',
    expansions: ['choam'],
    roster: ['richese', 'choam', 'emperor', 'guild'],
  },
  {
    ordinal: 2,
    profile: 'ecaz',
    rules: 'basic',
    expansions: ['ecaz'],
    roster: ['ecaz', 'moritani', 'atreides', 'beneGesserit'],
  },
  {
    ordinal: 3,
    profile: 'ecaz',
    rules: 'advanced',
    expansions: ['ecaz'],
    roster: ['ecaz', 'moritani', 'atreides', 'beneGesserit'],
  },
  {
    ordinal: 4,
    profile: 'combined',
    rules: 'basic',
    expansions: ['ix', 'choam', 'ecaz'],
    roster: ['ecaz', 'ixians', 'tleilaxu', 'choam', 'richese', 'moritani'],
  },
  {
    ordinal: 5,
    profile: 'combined',
    rules: 'advanced',
    expansions: ['ix', 'choam', 'ecaz'],
    roster: ['ecaz', 'ixians', 'tleilaxu', 'choam', 'richese', 'moritani'],
  },
];

// Keep the original six expansion ordinals and defaults stable.
const BASE_ROSTER: readonly FactionId[] = [
  'atreides',
  'harkonnen',
  'fremen',
  'emperor',
  'guild',
  'beneGesserit',
];
const BASE_SCENARIOS: readonly Scenario[] = [2, 3, 4, 5, 6].flatMap((players) =>
  (['basic', 'advanced'] as const).map((rules, index) => ({
    ordinal: 6 + (players - 2) * 2 + index,
    profile: 'base' as const,
    rules,
    expansions: [],
    roster: BASE_ROSTER.slice(0, players),
  })),
);
const MODULE_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].flatMap((players) =>
    (['basic', 'advanced'] as const).map((rules, index) => ({
      ordinal: players === 4 ? 36 + index : 48 + (players - 2) * 2 + index,
      profile: 'homeworld' as const,
      rules,
      expansions: [],
      roster: BASE_ROSTER.slice(0, players),
    })),
  ),
  ...[2, 3, 4, 5, 6].flatMap((players) =>
    (['basic', 'advanced'] as const).map((rules, index) => ({
      ordinal: players === 6 ? 38 + index : 40 + (players - 2) * 2 + index,
      profile: 'nexus' as const,
      rules,
      expansions: [],
      roster: BASE_ROSTER.slice(0, players),
    })),
  ),
  ...[2, 3, 4, 5, 6].flatMap((players) =>
    (['basic', 'advanced'] as const).map((rules, index) => ({
      ordinal: 58 + (players - 2) * 2 + index,
      profile: 'homeworld-nexus' as const,
      rules,
      expansions: [],
      roster: BASE_ROSTER.slice(0, players),
    })),
  ),
];
const CLASSIC_NEXUS_MODULE_SCENARIOS: readonly Scenario[] =
  (['nexus-tech', 'nexus-stronghold', 'nexus-stronghold-tech'] as const)
    .flatMap((profile, band) => MODULE_SCENARIOS
      .filter(scenario => scenario.profile === 'nexus' &&
        (profile === 'nexus-tech' || scenario.rules === 'advanced') &&
        (profile === 'nexus-stronghold' || scenario.roster.length >= 3))
      .map((scenario, index): Scenario => ({ ...scenario, profile, ordinal: 800 + band * 100 + index })));
const nexusModuleProfile = (profile: string) =>
  profile === 'nexus-tech' || profile === 'nexus-stronghold' || profile === 'nexus-stronghold-tech';
const nexusTechProfile = (profile: string) => profile === 'nexus-tech' || profile === 'nexus-stronghold-tech';
const nexusStrongholdProfile = (profile: string) => profile === 'nexus-stronghold' || profile === 'nexus-stronghold-tech';
const EXPANSION_ROSTER_SCENARIOS: readonly Scenario[] = [
  { profile: 'choam-roster' as const, expansions: ['choam'], roster: ['choam', 'richese', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[] },
  { profile: 'ecaz-roster' as const, expansions: ['ecaz'], roster: ['moritani', 'ecaz', 'atreides', 'beneGesserit', 'harkonnen', 'guild'] as FactionId[] },
  { profile: 'ix-roster' as const, expansions: ['ix'], roster: ['ixians', 'tleilaxu', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[] },
].flatMap(({ profile, expansions, roster }, family) =>
  [2, 3, 4, 5, 6].flatMap(players =>
    (['basic', 'advanced'] as const).map((rules, index) => ({
      ordinal: 68 + family * 10 + (players - 2) * 2 + index,
      profile, rules, expansions, roster: roster.slice(0, players),
    })),
  ),
);
/** Same genuine paired roster, with the independent three-card variant enabled. */
const ECAZ_TREACHERY_SCENARIOS: readonly Scenario[] = EXPANSION_ROSTER_SCENARIOS
  .filter(scenario => scenario.profile === 'ecaz-roster')
  .map(scenario => ({
    ...scenario, profile: 'ecaz-treachery', ordinal: scenario.ordinal + 58,
  }));
/** Advanced Occupy samples retain explicit independent card-variant selection. */
const ECAZ_OCCUPY_BASE_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 169 + players - 2, profile: 'ecaz-occupy', rules: 'advanced',
    expansions: ['ecaz'],
    roster: (['ecaz', 'fremen', 'emperor', 'beneGesserit', 'harkonnen', 'guild'] as FactionId[]).slice(0, players),
  })),
  ...(['ixians', 'tleilaxu', 'choam'] as const).flatMap((native, family) =>
    [2, 3, 4, 5, 6].map((players): Scenario => ({
      ordinal: 174 + family * 5 + players - 2, profile: 'ecaz-occupy', rules: 'advanced',
      expansions: ['ecaz', native === 'choam' ? 'choam' : 'ix'],
      roster: (['ecaz', native, 'guild', 'fremen', 'emperor', 'beneGesserit'] as FactionId[]).slice(0, players),
    }))),
  ...[4, 5, 6].map((players): Scenario => ({
    ordinal: 189 + players - 4, profile: 'ecaz-occupy', rules: 'advanced',
    expansions: ['ecaz', 'ix', 'choam'],
    roster: (['ecaz', 'ixians', 'tleilaxu', 'choam', 'guild', 'fremen'] as FactionId[]).slice(0, players),
  })),
];
const ECAZ_OCCUPY_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 293 + players - 2, profile: 'ecaz-occupy', rules: 'basic',
    expansions: ['ecaz'],
    roster: (['ecaz', 'fremen', 'emperor', 'beneGesserit', 'harkonnen', 'guild'] as FactionId[]).slice(0, players),
  })),
  ...ECAZ_OCCUPY_BASE_SCENARIOS,
  ...ECAZ_OCCUPY_BASE_SCENARIOS.map((scenario, index): Scenario => ({
    ...scenario, ordinal: 192 + index, ecazTreachery: true,
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 215 + players - 2, profile: 'ecaz-occupy', rules: 'advanced',
    expansions: ['ecaz', 'choam'],
    roster: (['ecaz', 'richese', 'guild', 'fremen', 'emperor', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
];
const PAIRED_NEXUS_SCENARIOS: readonly Scenario[] = EXPANSION_ROSTER_SCENARIOS
  .map(scenario => ({
    ...scenario,
    profile: scenario.profile.replace('-roster', '-nexus') as Profile,
    ordinal: scenario.ordinal + 30,
  }));
const COMBINED_NEXUS_SCENARIOS: readonly Scenario[] = [
  ...SCENARIOS.filter(scenario => scenario.profile === 'combined')
    .map(scenario => ({ ...scenario, profile: 'combined-nexus' as const, ordinal: scenario.ordinal + 124 })),
  ...(['basic', 'advanced'] as const).map((rules, index) => ({
    ordinal: 130 + index, profile: 'combined-nexus' as const, rules,
    expansions: ['ix', 'choam', 'ecaz'],
    roster: ['ecaz', 'ixians', 'tleilaxu', 'choam', 'moritani'] as FactionId[],
  })),
];

const COMBINED_HOMEWORLD_NEXUS_SCENARIOS: readonly Scenario[] =
  COMBINED_NEXUS_SCENARIOS.map(scenario => ({
    ...scenario, profile: 'combined-homeworld-nexus', ordinal: scenario.ordinal + 4,
  }));

const MORITANI_SKILLS_ROSTER: readonly FactionId[] = [
  'moritani', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit',
];
const MORITANI_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 16 + players - 2, profile: 'moritani-skills', rules: 'basic',
    expansions: ['ecaz'], roster: MORITANI_SKILLS_ROSTER.slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 249 + players - 2, profile: 'moritani-skills', rules: 'advanced', expansions: ['ecaz'],
    roster: (['moritani', 'atreides', 'emperor', 'guild', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
];
const MORITANI_ASSASSINATE_ROSTER: readonly FactionId[] = [
  'moritani', 'atreides', 'emperor', 'fremen', 'guild', 'beneGesserit',
];
const MORITANI_ASSASSINATE_SCENARIOS: readonly Scenario[] = [2, 3, 4, 5, 6].map(players => ({
  ordinal: 146 + players - 2,
  profile: 'moritani-assassinate',
  rules: 'advanced',
  expansions: ['ecaz'],
  roster: MORITANI_ASSASSINATE_ROSTER.slice(0, players),
}));

const TLEILAXU_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 21 + players - 2, profile: 'tleilaxu-skills', rules: 'basic', expansions: ['ix'],
    roster: (['tleilaxu', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 235 + players - 2, profile: 'tleilaxu-skills', rules: 'advanced', expansions: ['ix'],
    roster: (['tleilaxu', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 240 + players - 2, profile: 'tleilaxu-skills', rules: 'advanced', expansions: ['ix'],
    roster: (['tleilaxu', 'ixians', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[]).slice(0, players),
  })),
  ...[3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 245 + players - 3, profile: 'tleilaxu-skills', rules: 'advanced', expansions: ['ix', 'choam'],
    roster: (['tleilaxu', 'ixians', 'choam', 'emperor', 'guild', 'harkonnen'] as FactionId[]).slice(0, players),
  })),
];
const IX_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 26 + players - 2, profile: 'ix-skills', rules: 'basic', expansions: ['ix'],
    roster: (['ixians', 'tleilaxu', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 220 + players - 2, profile: 'ix-skills', rules: 'advanced', expansions: ['ix'],
    roster: (['ixians', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 230 + players - 2, profile: 'ix-skills', rules: 'advanced', expansions: ['ix', 'choam'],
    roster: (['ixians', 'choam', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[]).slice(0, players),
  })),
];
const CHOAM_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 31 + players - 2, profile: 'choam-skills', rules: 'basic', expansions: ['choam'],
    roster: (['choam', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 225 + players - 2, profile: 'choam-skills', rules: 'advanced', expansions: ['choam'],
    roster: (['choam', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
];
const RICHESE_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...(['basic', 'advanced'] as const).flatMap((rules, band) => [2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 254 + band * 5 + players - 2, profile: 'richese-skills', rules, expansions: ['choam'],
    roster: (['richese', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  }))),
  ...(['basic', 'advanced'] as const).flatMap((rules, band) => [2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 264 + band * 5 + players - 2, profile: 'richese-skills', rules, expansions: ['choam'],
    roster: (['richese', 'choam', 'emperor', 'guild', 'harkonnen', 'fremen'] as FactionId[]).slice(0, players),
  }))),
  ...[3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 274 + players - 3, profile: 'richese-skills', rules: 'advanced', expansions: ['ix', 'choam'],
    roster: (['richese', 'tleilaxu', 'choam', 'emperor', 'guild', 'harkonnen'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 278 + players - 2, profile: 'richese-skills', rules: 'advanced', expansions: ['ix', 'choam'],
    roster: (['richese', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
];
const ECAZ_SKILLS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 283 + players - 2, profile: 'ecaz-skills', rules: 'basic', expansions: ['ecaz'],
    roster: (['ecaz', 'emperor', 'guild', 'harkonnen', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 288 + players - 2, profile: 'ecaz-skills', rules: 'advanced', expansions: ['ecaz'],
    roster: (['ecaz', 'emperor', 'guild', 'atreides', 'fremen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
];
const STRONGHOLD_FACTIONS_ROSTER: readonly FactionId[] = [
  'ixians', 'choam', 'emperor', 'fremen', 'harkonnen', 'beneGesserit',
];
const STRONGHOLD_FACTIONS_SCENARIOS: readonly Scenario[] = [
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 298 + players - 2, profile: 'stronghold-factions', rules: 'advanced',
    expansions: ['ecaz'],
    roster: (['ecaz', 'guild', 'emperor', 'fremen', 'beneGesserit', 'harkonnen'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map((players): Scenario => ({
    ordinal: 303 + players - 2, profile: 'stronghold-factions', rules: 'advanced',
    expansions: ['ecaz'],
    roster: (['moritani', 'guild', 'emperor', 'fremen', 'beneGesserit', 'atreides'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map(players => ({
    ordinal: 151 + players - 2,
    profile: 'stronghold-factions' as const,
    rules: 'advanced' as const,
    expansions: ['ix', 'choam'],
    roster: STRONGHOLD_FACTIONS_ROSTER.slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map(players => ({
    ordinal: 156 + players - 2,
    profile: 'stronghold-factions' as const,
    rules: 'advanced' as const,
    expansions: ['ix'],
    roster: (['ixians', 'tleilaxu', 'emperor', 'fremen', 'harkonnen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[2, 3, 4, 5, 6].map(players => ({
    ordinal: 161 + players - 2,
    profile: 'stronghold-factions' as const,
    rules: 'advanced' as const,
    expansions: ['choam'],
    roster: (['choam', 'richese', 'emperor', 'fremen', 'harkonnen', 'beneGesserit'] as FactionId[]).slice(0, players),
  })),
  ...[4, 5, 6].map(players => ({
    ordinal: 166 + players - 4,
    profile: 'stronghold-factions' as const,
    rules: 'advanced' as const,
    expansions: ['ix', 'choam'],
    roster: (['ixians', 'tleilaxu', 'choam', 'richese', 'emperor', 'fremen'] as FactionId[]).slice(0, players),
  })),
];
const NATIVE_TECH_SCENARIOS: readonly Scenario[] = STRONGHOLD_FACTIONS_SCENARIOS
  .filter(scenario => scenario.roster.length >= 3)
  .flatMap((scenario, index): Scenario[] => [
    { ...scenario, ordinal: 700 + index * 3, profile: 'factions-tech', rules: 'basic' },
    { ...scenario, ordinal: 701 + index * 3, profile: 'factions-tech' },
    { ...scenario, ordinal: 702 + index * 3, profile: 'stronghold-factions-tech' },
  ]);
const nativeTechProfile = (profile: string) => profile === 'factions-tech' || profile === 'stronghold-factions-tech';
const nativeStrongholdProfile = (profile: string) => profile === 'stronghold-factions' || profile === 'stronghold-factions-tech';
const SKILLS_TECH_SCENARIOS: readonly Scenario[] = [
  ...[3, 4, 5, 6].flatMap(players => (['basic', 'advanced'] as const).map((rules, band) => ({
    ordinal: 308 + (players - 3) * 2 + band, profile: 'skills-tech' as const,
    rules, expansions: [], roster: BASE_ROSTER.slice(0, players),
  }))),
  ...[...IX_SKILLS_SCENARIOS, ...TLEILAXU_SKILLS_SCENARIOS, ...CHOAM_SKILLS_SCENARIOS, ...RICHESE_SKILLS_SCENARIOS]
    .filter(scenario => scenario.roster.length >= 3)
    .map((scenario, index): Scenario => ({ ...scenario, ordinal: 316 + index, profile: 'skills-tech' })),
  ...[...MORITANI_SKILLS_SCENARIOS, ...ECAZ_SKILLS_SCENARIOS]
    .filter(scenario => scenario.roster.length >= 3)
    .map((scenario, index): Scenario => ({ ...scenario, ordinal: 600 + index, profile: 'skills-tech' })),
];
const SKILLS_STRONGHOLD_SCENARIOS: readonly Scenario[] =
  (['skills-stronghold', 'skills-stronghold-tech'] as const).flatMap((profile, band) => [
    ...[2, 3, 4, 5, 6].map(players => ({
      rules: 'advanced' as const, expansions: [], roster: BASE_ROSTER.slice(0, players),
    })),
    ...[...IX_SKILLS_SCENARIOS, ...TLEILAXU_SKILLS_SCENARIOS, ...CHOAM_SKILLS_SCENARIOS, ...RICHESE_SKILLS_SCENARIOS]
      .filter(scenario => scenario.rules === 'advanced'),
    ...[...MORITANI_SKILLS_SCENARIOS, ...ECAZ_SKILLS_SCENARIOS]
      .filter(scenario => scenario.rules === 'advanced'),
  ].filter(scenario => profile !== 'skills-stronghold-tech' || scenario.roster.length >= 3)
    .map((scenario, index): Scenario => ({ ...scenario, ordinal: 376 + band * 100 + index, profile })));
const strongholdSkillProfile = (profile: string) => profile === 'skills-stronghold' || profile === 'skills-stronghold-tech';
const skillProfile = (profile: string) => profile === 'moritani-skills' || profile === 'tleilaxu-skills' || profile === 'ix-skills' || profile === 'choam-skills' || profile === 'richese-skills' || profile === 'ecaz-skills' || profile === 'skills-tech' || strongholdSkillProfile(profile);
const assassinationScenario = (scenario: Scenario) => scenario.rules === 'advanced' &&
  scenario.roster.includes('moritani') &&
  (scenario.profile === 'moritani-assassinate' || nativeStrongholdProfile(scenario.profile) || nativeTechProfile(scenario.profile) || skillProfile(scenario.profile));

type TraceEntry = {
  attempt: number;
  accepted: number;
  player: string;
  turn: number;
  phase: number;
  setup: string | null;
  decision: string | null;
  response: string | null;
  action: Action;
  outcome: 'accepted' | 'rejected';
  error?: string;
};

type Result = {
  name: string;
  profile: Profile;
  rules: Rules;
  advanced: boolean;
  seed: number;
  resumed: boolean;
  actions: number;
  attempts: number;
  restores: number;
  turn: number;
  phase: number;
  winner: string[];
  used: Record<string, number>;
  rejected: Record<string, number>;
  outcome: 'complete' | 'failure';
  error?: string;
};

function usage() {
  return (
    'Usage: node --import tsx tools/faction-games.ts --out NEW_PRIVATE_DIR ' +
    '[--seed UINT32] [--profile all|base|choam|ecaz|ecaz-treachery|ecaz-occupy|moritani-assassinate|stronghold-factions|factions-tech|stronghold-factions-tech|combined|combined-nexus|combined-homeworld-nexus|homeworld|nexus|nexus-tech|nexus-stronghold|nexus-stronghold-tech|homeworld-nexus|choam-roster|ecaz-roster|ix-roster|choam-nexus|ecaz-nexus|ix-nexus|moritani-skills|tleilaxu-skills|ix-skills|choam-skills|richese-skills|ecaz-skills|skills-tech|skills-stronghold|skills-stronghold-tech] ' +
    '[--rules both|basic|advanced] [--players all|2|3|4|5|6] [--max-actions POSITIVE] ' +
    '[--resume FAILED_GAME.json]\n' +
    'Runs genuine setup and gameplay offline. Default/all keeps the six expansion samples; combined-nexus and combined-homeworld-nexus add five/six-seat Basic/Advanced all-expansion samples. Base, Homeworld, Nexus, Homeworld-Nexus, expansion roster, paired expansion Nexus, Ecaz card variant, Advanced Moritani assassination and skill profiles select their documented rosters. Stronghold-factions is Advanced only: Ixians + CHOAM, native Ixians + Tleilaxu, or native CHOAM + Richese with classic opponents, two through six seats; mixed four-native rosters also run at four through six seats. Selected Ix/CHOAM decks determine the canonical 47/35 Treachery Cards; Richese has a separate ten-card cache and all samples have six separate Stronghold Cards without other modules. Scenario names identify their native roster. --players requires a supported profile. Output must be a new private directory outside the checkout.' +
    '\nEcaz-occupy supports Basic even-force and Advanced: native Ecaz plus classic/Ixian/Tleilaxu/CHOAM/Richese paired or mixed rosters, two through six seats; selected E3/E1/E2 sources determine ordinary33/47/35 cards. Basic uses Ecaz/classic/optional Moritani and the exact ecaz deck, with E/2 mandatory contribution and losses. An uncanceled odd Basic count remains blocked by the preserved publisher casualty-rounding conflict. Explicit independent three-card samples additionally use36/50/38. Richese marker-only or ordinary pools retain original reveal timing; own mixed No-Field dialing, whole-plan inspection and optional overlays remain guarded.' +
    '\nThe four earlier native skill profiles retain their Basic samples. Advanced Ix-skills/choam-skills/tleilaxu-skills use documented native plus classic families; Advanced moritani-skills composes its original non-Harkonnen classic assassination roster. Richese-skills adds Basic/Advanced Richese or paired CHOAM tables, Advanced Richese/Tleilaxu/CHOAM and optional Ix-deck tables without native Ixians. All retain fourteen skills and original cache/native inventories. Native Ixian Technology on Richese lots, own mixed No-Field, other roster/modules and public starts retain their separate guards.'
    + '\nEcaz-skills uses native five-disc Ecaz with classic opponents, the ecaz deck and all fourteen skills in Basic/Advanced; Advanced Harkonnen is excluded by the existing shared-Duke capture boundary. Ambassador and ordinary skill paths retain native custody. Shared-Duke assignment and combined Occupy skills remain separate boundaries; no public starts or save retrofit.'
    + '\nStandalone E3 Stronghold samples additionally use native Ecaz OR Moritani with classic opponents and the exact ecaz deck, six Stronghold Cards only. Ecaz holder-only coalition effects and original Moritani assassination remain; Moritani excludes Harkonnen. E3 pairs, E1/E2 mixtures and other overlays remain guarded.'
    + '\nSkills-tech uses three-through-six unique seats in Basic/Advanced: classic/base33, supported E1/E2 native skill rosters with original ix/choam decks/cache, or standalone Ecaz/Moritani ecaz33 rosters. All fourteen Skills and three original Tech Tokens retain original setup/native owners, phase-end income, aftermath and mandatory original-winner token transfer before Face Dance. Other modules, mixed E3 families, public starts and played-game conversion stay separate.'
    + '\nSkills-stronghold uses fresh Advanced classic or supported native two-through-six-seat skill rosters with all14 skills and six original Stronghold Cards. Skills-stronghold-tech adds three original Tech Tokens and requires three-through-six seats. Original native decks/cache, real end-Mentat Stronghold ownership and printed/first-Storm Tech assignment remain; other modules, mixed E3 families, public starts and played-game conversion stay separate.'
    + '\nAll three combined skill/module profiles additionally admit standalone native Ecaz OR Moritani with classic opponents and the exact ecaz33 deck. Original five-disc Ecaz/Duke assignment and Advanced Harkonnen exclusion remain; Advanced Moritani retains its original non-Harkonnen skill-first assassination and normal-traitor forfeiture. E3 pairs, mixed-family rosters, allied Occupy skills and other overlays stay guarded.'
    + '\nFactions-tech uses native E1/E2 families or standalone Ecaz OR Moritani plus classics, three-through-six seats, Basic/Advanced, original selected decks and three Tech Tokens without Skills. Stronghold-factions-tech is its Advanced six-card Stronghold composition. Native Tech setup, real payments, typed battle rewards and selected Ecaz lead attribution remain; Basic odd Occupy, Richese cache/No-Field rulings, other modules and public starts stay guarded.'
    + '\nNexus-tech preserves classic/base33/all12 Nexus and original Tech3..6 in Basic/Advanced. Nexus-stronghold adds six original Stronghold Cards in Advanced2..6; nexus-stronghold-tech requires3..6. Original closing Nexus deals, actual free/paid source identity, phase-end Tech, held support and postbattle card/reward windows remain. Skills, Homeworlds, expansions, other overlays, unresolved effects, public starts and played-game conversion stay separate.'
  );
}

function supplied(name: string) {
  return process.argv
    .slice(2)
    .some((value) => value === `--${name}` || value.startsWith(`--${name}=`));
}

function unsigned32(value: string | undefined) {
  if (value === undefined) return DEFAULT_SEED;
  if (!/^\d+$/.test(value))
    throw new Error('--seed must be an unsigned 32-bit integer.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffff_ffff)
    throw new Error('--seed must be an unsigned 32-bit integer.');
  return parsed;
}

function positive(value: string | undefined) {
  if (value === undefined) return DEFAULT_MAX_ACTIONS;
  if (!/^\d+$/.test(value))
    throw new Error('--max-actions must be a positive integer.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error('--max-actions must be a positive integer.');
  return parsed;
}

function scenarioName(scenario: Scenario) {
  if ((scenario.profile === 'skills-tech' || strongholdSkillProfile(scenario.profile)) && scenario.expansions.length) {
    const native = scenario.roster.filter(faction => ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].includes(faction));
    const extraIx = scenario.expansions.includes('ix') && !native.some(faction => faction === 'ixians' || faction === 'tleilaxu');
    return `${scenario.profile}-${native.join('-')}${extraIx ? '-ix-deck' : ''}-${scenario.roster.length}-${scenario.rules}`;
  }
  if (nativeStrongholdProfile(scenario.profile) || nativeTechProfile(scenario.profile)) {
    const native = scenario.roster.filter(faction =>
      ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].includes(faction));
    return `${scenario.profile}-${native.join('-')}-${scenario.roster.length}-${scenario.rules}`;
  }
  if (scenario.profile === 'ecaz-occupy') {
    const native = scenario.roster.filter(faction => ['ixians', 'tleilaxu', 'choam', 'richese'].includes(faction));
    if (native.length || scenario.ecazTreachery)
      return `${scenario.profile}${scenario.ecazTreachery ? '-treachery' : ''}${native.length ? '-' + native.join('-') : ''}-${scenario.roster.length}-${scenario.rules}`;
  }
  if (scenario.profile === 'ix-skills' && scenario.rules === 'advanced' && scenario.roster.includes('choam'))
    return `${scenario.profile}-ixians-choam-${scenario.roster.length}-${scenario.rules}`;
  if (scenario.profile === 'tleilaxu-skills' && scenario.rules === 'advanced' && scenario.roster.includes('ixians'))
    return `${scenario.profile}-${scenario.roster.filter(faction => ['tleilaxu', 'ixians', 'choam'].includes(faction)).join('-')}-${scenario.roster.length}-${scenario.rules}`;
  if (scenario.profile === 'richese-skills') {
    const native = scenario.roster.filter(faction => ['richese', 'tleilaxu', 'choam'].includes(faction));
    const suffix = native.length > 1 ? '-' + native.join('-') : scenario.expansions.includes('ix') ? '-ix-deck' : '';
    return `${scenario.profile}${suffix}-${scenario.roster.length}-${scenario.rules}`;
  }
  return scenario.profile === 'base' || scenario.profile === 'homeworld' || scenario.profile === 'nexus' || scenario.profile === 'homeworld-nexus' || scenario.profile === 'combined-nexus' || scenario.profile === 'combined-homeworld-nexus' ||
    scenario.profile === 'choam-roster' || scenario.profile === 'ecaz-roster' || scenario.profile === 'ecaz-treachery' || scenario.profile === 'ecaz-occupy' || scenario.profile === 'moritani-assassinate' || scenario.profile === 'ix-roster' || scenario.profile === 'choam-nexus' || scenario.profile === 'ecaz-nexus' || scenario.profile === 'ix-nexus' || skillProfile(scenario.profile) || nexusModuleProfile(scenario.profile)
    ? `${scenario.profile}-${scenario.roster.length}-${scenario.rules}`
    : `${scenario.profile}-${scenario.rules}`;
}

function parseProfile(value: string | undefined) {
  const profile = value ?? 'all';
  if (!nativeTechProfile(profile) && !nexusModuleProfile(profile) && !['all', 'base', 'choam', 'ecaz', 'ecaz-treachery', 'ecaz-occupy', 'moritani-assassinate', 'stronghold-factions', 'combined', 'combined-nexus', 'combined-homeworld-nexus', 'homeworld', 'nexus', 'homeworld-nexus', 'choam-roster', 'ecaz-roster', 'ix-roster', 'choam-nexus', 'ecaz-nexus', 'ix-nexus', 'moritani-skills', 'tleilaxu-skills', 'ix-skills', 'choam-skills', 'richese-skills', 'ecaz-skills', 'skills-tech', 'skills-stronghold', 'skills-stronghold-tech'].includes(profile))
    throw new Error('--profile must name a documented base, module, expansion or native skill sample profile.');
  return profile as Profile | 'all';
}

function parseRules(value: string | undefined) {
  const rules = value ?? 'both';
  if (!['both', 'basic', 'advanced'].includes(rules))
    throw new Error('--rules must be both, basic or advanced.');
  return rules as Rules | 'both';
}

function parsePlayers(value: string | undefined) {
  if (value === undefined || value === 'all') return 'all';
  if (!/^[2-6]$/.test(value))
    throw new Error('--players must be all or 2 through 6.');
  return Number(value);
}

function privateWrite(directory: string, name: string, value: unknown) {
  writeFileSync(
    resolve(directory, name),
    JSON.stringify(value, null, 2) + '\n',
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    },
  );
}

function freshGame(scenario: Scenario) {
  const [first, ...rest] = scenario.roster;
  const game = createGame(
    'FACTIONR',
    newPlayer(first, first, first),
    scenario.rules === 'advanced',
    scenario.expansions,
  );
  for (const faction of rest)
    joinGame(game, newPlayer(faction, faction, faction));
  for (const [index, player] of game.players.entries()) {
    player.bot = DIFFICULTIES[index % DIFFICULTIES.length];
    player.ready = true;
  }
  if (scenario.ecazTreachery) game.ecazTreachery = true;
  if (scenario.profile === 'skills-tech' || scenario.profile === 'skills-stronghold-tech' || nativeTechProfile(scenario.profile) || nexusTechProfile(scenario.profile)) game.techTokens = createTechTokens();
  if (strongholdSkillProfile(scenario.profile) || nexusStrongholdProfile(scenario.profile)) game.strongholdCards = createStrongholdCards();
  if (scenario.profile === 'homeworld' || scenario.profile === 'homeworld-nexus' || scenario.profile === 'combined-homeworld-nexus')
    game.homeworlds = { custody: null };
  if (scenario.profile === 'nexus' || nexusModuleProfile(scenario.profile) || scenario.profile === 'homeworld-nexus' || scenario.profile === 'choam-nexus' || scenario.profile === 'ecaz-nexus' || scenario.profile === 'ix-nexus' || scenario.profile === 'combined-nexus' || scenario.profile === 'combined-homeworld-nexus')
    game.nexusCards = { cards: null, phase: null };
  if (scenario.profile === 'combined-nexus' || scenario.profile === 'combined-homeworld-nexus')
    return initializeCombinedNexusGameForAudit(game, scenario.profile === 'combined-homeworld-nexus');
  if (scenario.profile === 'choam-nexus' || scenario.profile === 'ecaz-nexus' || scenario.profile === 'ix-nexus')
    return initializePairedNexusGameForAudit(game);
  if (scenario.profile === 'ecaz-treachery')
    return initializeEcazTreacheryGameForAudit(game);
  if (scenario.profile === 'ecaz-occupy')
    return initializeEcazOccupyGameForAudit(game);
  if (scenario.profile === 'moritani-assassinate')
    return initializeMoritaniAssassinateGameForAudit(game);
  if (nativeStrongholdProfile(scenario.profile))
    return initializeStrongholdFactionsGameForAudit(game);
  return skillProfile(scenario.profile)
    ? initializeLeaderSkillsGameForAudit(game)
    : scenario.profile === 'homeworld'
      ? initializeHomeworldGameForAudit(game)
      : scenario.profile === 'nexus' || nexusModuleProfile(scenario.profile) || scenario.profile === 'homeworld-nexus'
        ? initializeNexusGameForAudit(game)
        : scenario.profile === 'base'
          ? initializeBaseGameForAudit(game)
          : initializeFactionExpansionsGameForAudit(game);
}

function resumedGame(path: string) {
  if (!statSync(path).isFile())
    throw new Error('--resume must name one regular JSON Game snapshot.');
  const input = readFileSync(path);
  const hash = createHash('sha256').update(input).digest('hex');
  let value: unknown;
  try {
    value = JSON.parse(input.toString('utf8'));
  } catch {
    throw new Error('--resume must contain one JSON Game snapshot.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('--resume must contain one JSON Game snapshot.');
  const game = value as Game;
  if (
    !['setup', 'playing'].includes(game.status) ||
    typeof game.advanced !== 'boolean' ||
    !Array.isArray(game.expansions) ||
    !Array.isArray(game.players) ||
    !game.players.length ||
    game.players.some(
      (player) =>
        !player ||
        typeof player.id !== 'string' ||
        typeof player.faction !== 'string' ||
        !DIFFICULTIES.includes(player.bot as (typeof DIFFICULTIES)[number]),
    )
  )
    throw new Error(
      '--resume is not an incomplete faction-games snapshot with saved AI profiles.',
    );
  const composedSkills = (classicTechLeaderSkillsProfile(game) || nativeTechLeaderSkillsProfile(game) || strongholdLeaderSkillsProfile(game)) && !game.spiceBankerIncomePreview;
  if (
    (game.leaderSkills && !nativeExpansionLeaderSkillsProfile(game) && !composedSkills) ||
    game.discoveryEnabled ||
    game.discoveries ||
    game.discoveryStash ||
    game.greatMaker ||
    (game.techTokens && !composedSkills && !nativeFactionTechProfile(game) && !classicNexusModulesProfile(game)) ||
    game.mentatQuestionPreview
  )
    throw new Error('--resume sample scenarios exclude unsupported optional modules.');
  const scenario = [...SCENARIOS, ...COMBINED_NEXUS_SCENARIOS, ...COMBINED_HOMEWORLD_NEXUS_SCENARIOS, ...BASE_SCENARIOS, ...MODULE_SCENARIOS, ...EXPANSION_ROSTER_SCENARIOS, ...ECAZ_TREACHERY_SCENARIOS, ...ECAZ_OCCUPY_SCENARIOS, ...PAIRED_NEXUS_SCENARIOS, ...MORITANI_ASSASSINATE_SCENARIOS, ...STRONGHOLD_FACTIONS_SCENARIOS, ...MORITANI_SKILLS_SCENARIOS, ...TLEILAXU_SKILLS_SCENARIOS, ...IX_SKILLS_SCENARIOS, ...CHOAM_SKILLS_SCENARIOS, ...RICHESE_SKILLS_SCENARIOS, ...ECAZ_SKILLS_SCENARIOS, ...SKILLS_TECH_SCENARIOS, ...SKILLS_STRONGHOLD_SCENARIOS, ...NATIVE_TECH_SCENARIOS, ...CLASSIC_NEXUS_MODULE_SCENARIOS].find(
    (candidate) =>
      (candidate.profile === 'homeworld' || candidate.profile === 'homeworld-nexus' || candidate.profile === 'combined-homeworld-nexus') === !!game.homeworlds &&
      (candidate.profile === 'nexus' || nexusModuleProfile(candidate.profile) || candidate.profile === 'homeworld-nexus' || candidate.profile === 'choam-nexus' || candidate.profile === 'ecaz-nexus' || candidate.profile === 'ix-nexus' || candidate.profile === 'combined-nexus' || candidate.profile === 'combined-homeworld-nexus') === !!game.nexusCards &&
      skillProfile(candidate.profile) === !!game.leaderSkills &&
      (candidate.profile === 'skills-tech' || candidate.profile === 'skills-stronghold-tech' || nativeTechProfile(candidate.profile) || nexusTechProfile(candidate.profile)) === !!game.techTokens &&
      (nativeStrongholdProfile(candidate.profile) || strongholdSkillProfile(candidate.profile) || nexusStrongholdProfile(candidate.profile)) === !!game.strongholdCards &&
      (candidate.profile === 'ecaz-treachery' || candidate.ecazTreachery === true) === !!game.ecazTreachery &&
      assassinationScenario(candidate) === !!game.moritaniAssassinatePreview &&
      (candidate.profile === 'ecaz-occupy' || (nativeTechProfile(candidate.profile) && candidate.roster.includes('ecaz'))) === !!game.ecazOccupyPreview &&
      assassinationScenario(candidate) === !!game.moritaniAssassinate &&
      candidate.rules === (game.advanced ? 'advanced' : 'basic') &&
      JSON.stringify(candidate.expansions) ===
        JSON.stringify(game.expansions) &&
      JSON.stringify(candidate.roster) ===
        JSON.stringify(game.players.map((player) => player.faction)),
  );
  if (!scenario)
    throw new Error(
      '--resume does not match a fixed base, module or expansion sample scenario.',
    );
  // Projection validates the engine-facing shape and every private seat boundary.
  for (const player of game.players) viewGame(game, player.id);
  if (nativeStrongholdProfile(scenario.profile))
    verifySampleCustody(game, sampleInventory(game));
  return { game, scenario, hash, path: resolve(path) };
}

function simulate(
  initial: Game,
  scenario: Scenario,
  seed: number,
  maxActions: number,
  resumed: boolean,
) {
  let game = initial;
  const expected = sampleInventory(game);
  if (scenario.profile === 'stronghold-factions') {
    const canonical = [
      ...treacheryDeck(scenario.expansions),
      ...(scenario.roster.includes('richese') ? richeseCards() : []),
    ].map(card => card.id).sort();
    assert.deepEqual(expected.cards, canonical, 'selected native Treachery deck and separate Richese cache census');
    assert.equal(new Set(expected.cards).size, canonical.length, 'unique native Treachery identities');
    assert.equal(expected.strongholds?.length, 6, 'six physical Stronghold Cards');
  }
  const trace: TraceEntry[] = [];
  const used: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  let actions = 0;
  let restores = 0;
  try {
    verifySampleCustody(game, expected);
    while (actions < maxActions && game.status !== 'finished') {
      let next: Game | undefined;
      for (const player of game.players) {
        for (const action of botActions(viewGame(game, player.id))) {
          const context = {
            attempt: trace.length,
            accepted: actions,
            player: player.id,
            turn: game.turn,
            phase: game.phase,
            setup: game.setupStage ?? null,
            decision: game.decision?.kind ?? null,
            response: game.response?.kind ?? null,
            action,
          };
          const unchanged = JSON.stringify(game);
          try {
            next = applyAction(game, player.id, action);
            const label =
              action.type +
              (action.type === 'decision'
                ? `:${game.decision?.kind ?? 'none'}`
                : '');
            used[label] = (used[label] ?? 0) + 1;
            trace.push({ ...context, outcome: 'accepted' });
            actions++;
            break;
          } catch (error) {
            assert.equal(
              JSON.stringify(game),
              unchanged,
              'rejected-action immutability',
            );
            if (!(error instanceof RuleError)) throw error;
            const message = error.message;
            const label = `${action.type}: ${message}`;
            rejected[label] = (rejected[label] ?? 0) + 1;
            trace.push({ ...context, outcome: 'rejected', error: message });
          }
        }
        if (next) break;
      }
      if (!next)
        throw new Error(
          `No legal candidate: ${JSON.stringify({
            status: game.status,
            setup: game.setupStage,
            phase: game.phase,
            decision: game.decision?.kind,
            response: game.response?.kind,
            preparation: game.battle?.preparation,
          })}`,
        );
      const previous = game;
      game = next;
      verifySampleCustody(game, expected, previous);
      if (actions % 37 === 0) {
        const restored = JSON.parse(JSON.stringify(game)) as Game;
        for (const player of game.players)
          assert.deepEqual(
            viewGame(restored, player.id),
            viewGame(game, player.id),
            'restored view',
          );
        for (const player of game.players) {
          const view = viewGame(restored, player.id);
          for (const other of view.players.filter(
            (seat) => seat.id !== player.id,
          ))
            for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
              assert.equal(
                field in other,
                false,
                `private rival field ${field}`,
              );
        }
        verifySampleCustody(restored, expected, game);
        game = restored;
        restores++;
      }
    }
    if (game.status !== 'finished') throw new Error('Action limit');
    return {
      game,
      trace,
      result: {
        name: scenarioName(scenario),
        profile: scenario.profile,
        rules: scenario.rules,
        advanced: scenario.rules === 'advanced',
        seed,
        resumed,
        actions,
        attempts: trace.length,
        restores,
        turn: game.turn,
        phase: game.phase,
        winner: game.winner,
        used,
        rejected,
        outcome: 'complete',
      } satisfies Result,
    };
  } catch (error) {
    return {
      game,
      trace,
      result: {
        name: scenarioName(scenario),
        profile: scenario.profile,
        rules: scenario.rules,
        advanced: scenario.rules === 'advanced',
        seed,
        resumed,
        actions,
        attempts: trace.length,
        restores,
        turn: game.turn,
        phase: game.phase,
        winner: game.winner,
        used,
        rejected,
        outcome: 'failure',
        error: String(error),
      } satisfies Result,
    };
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      out: { type: 'string' },
      seed: { type: 'string' },
      profile: { type: 'string' },
      rules: { type: 'string' },
      players: { type: 'string' },
      'max-actions': { type: 'string' },
      resume: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: true,
  });
  if (values.help) {
    console.log(usage());
    return;
  }
  if (positionals.length)
    throw new Error(`Unexpected argument: ${positionals[0]}`);
  if (!values.out) throw new Error('--out is required.\n' + usage());
  if (
    values.resume &&
    (supplied('profile') || supplied('rules') || supplied('players'))
  )
    throw new Error(
      '--resume cannot be combined with --profile, --rules or --players.',
    );
  const seed = unsigned32(values.seed);
  const maxActions = positive(values['max-actions']);
  const profile = parseProfile(values.profile);
  const rules = parseRules(values.rules);
  const players = parsePlayers(values.players);
  if (supplied('players') && !nexusModuleProfile(profile) && !nativeTechProfile(profile) && !['base', 'homeworld', 'nexus', 'homeworld-nexus', 'combined-nexus', 'combined-homeworld-nexus', 'choam-roster', 'ecaz-roster', 'ecaz-treachery', 'ecaz-occupy', 'moritani-assassinate', 'stronghold-factions', 'ix-roster', 'choam-nexus', 'ecaz-nexus', 'ix-nexus'].includes(profile) && !skillProfile(profile))
    throw new Error('--players requires a roster or optional-module profile.');
  if ((profile === 'combined-nexus' || profile === 'combined-homeworld-nexus') && players !== 'all' && ![5, 6].includes(players))
    throw new Error(`--profile ${profile} supports only five or six players.`);
  if (profile === 'moritani-assassinate' && rules === 'basic')
    throw new Error('Moritani assassination samples require Advanced rules.');
  if ((profile === 'stronghold-factions' || strongholdSkillProfile(profile) || nexusStrongholdProfile(profile)) && rules === 'basic')
    throw new Error('Stronghold samples require Advanced rules.');
  if ((profile === 'skills-tech' || profile === 'skills-stronghold-tech') && players === 2)
    throw new Error('Leader Skills with Tech Tokens samples require three through six players.');
  const resume = values.resume ? resumedGame(values.resume) : null;
  const requestedSamples = profile === 'homeworld' || profile === 'nexus' || profile === 'homeworld-nexus'
    ? MODULE_SCENARIOS
    : nexusModuleProfile(profile) ? CLASSIC_NEXUS_MODULE_SCENARIOS
    : profile === 'choam-roster' || profile === 'ecaz-roster' || profile === 'ix-roster' ? EXPANSION_ROSTER_SCENARIOS
    : profile === 'ecaz-treachery' ? ECAZ_TREACHERY_SCENARIOS
    : profile === 'ecaz-occupy' ? ECAZ_OCCUPY_SCENARIOS
    : profile === 'moritani-assassinate' ? MORITANI_ASSASSINATE_SCENARIOS
    : profile === 'stronghold-factions' ? STRONGHOLD_FACTIONS_SCENARIOS
    : nativeTechProfile(profile) ? NATIVE_TECH_SCENARIOS
    : profile === 'skills-tech' ? SKILLS_TECH_SCENARIOS
    : strongholdSkillProfile(profile) ? SKILLS_STRONGHOLD_SCENARIOS
    : profile === 'choam-nexus' || profile === 'ecaz-nexus' || profile === 'ix-nexus' ? PAIRED_NEXUS_SCENARIOS
    : profile === 'combined-nexus' ? COMBINED_NEXUS_SCENARIOS
    : profile === 'combined-homeworld-nexus' ? COMBINED_HOMEWORLD_NEXUS_SCENARIOS
    : profile === 'base' ? BASE_SCENARIOS
    : profile === 'moritani-skills' ? MORITANI_SKILLS_SCENARIOS
    : profile === 'tleilaxu-skills' ? TLEILAXU_SKILLS_SCENARIOS
    : profile === 'ix-skills' ? IX_SKILLS_SCENARIOS
    : profile === 'choam-skills' ? CHOAM_SKILLS_SCENARIOS
    : profile === 'richese-skills' ? RICHESE_SKILLS_SCENARIOS
    : profile === 'ecaz-skills' ? ECAZ_SKILLS_SCENARIOS : SCENARIOS;
  const selected = resume
    ? [resume.scenario]
    : requestedSamples.filter(
        (scenario) =>
          (profile === 'all' || scenario.profile === profile) &&
          (rules === 'both' || scenario.rules === rules) &&
          (players === 'all' || scenario.roster.length === players),
      );
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const directory = privateOutputDirectory(root, values.out);
  const before = sourceSnapshot(root);
  const originalRandom = Object.getOwnPropertyDescriptor(
    globalThis.crypto,
    'getRandomValues',
  );
  let randomState = seed;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (!(array instanceof Uint32Array))
        throw new Error(
          'Faction game simulation expects Uint32Array randomness.',
        );
      for (let index = 0; index < array.length; index++) {
        randomState = (randomState + 0x6d2b79f5) >>> 0;
        let word = Math.imul(
          randomState ^ (randomState >>> 15),
          randomState | 1,
        );
        word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
        array[index] = (word ^ (word >>> 14)) >>> 0;
      }
      return array;
    },
  });

  const results: Result[] = [];
  try {
    for (const scenario of selected) {
      const scenarioSeed = (seed + scenario.ordinal) >>> 0;
      randomState = scenarioSeed;
      const outcome = simulate(
        resume ? structuredClone(resume.game) : freshGame(scenario),
        scenario,
        scenarioSeed,
        maxActions,
        !!resume,
      );
      privateWrite(
        directory,
        `trace-${outcome.result.name}.json`,
        outcome.trace,
      );
      if (outcome.result.outcome === 'failure')
        privateWrite(
          directory,
          `failed-${outcome.result.name}.json`,
          outcome.game,
        );
      results.push(outcome.result);
      console.log(JSON.stringify(outcome.result));
    }
  } finally {
    if (originalRandom)
      Object.defineProperty(
        globalThis.crypto,
        'getRandomValues',
        originalRandom,
      );
    else Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  }

  const after = sourceSnapshot(root);
  const sourceUnchanged =
    before.commit === after.commit && before.tree === after.tree;
  const status = !sourceUnchanged
    ? 'source-changed'
    : results.every((result) => result.outcome === 'complete')
      ? 'passed'
      : 'failed';
  privateWrite(directory, 'results.json', { format: 1, results });
  privateWrite(directory, 'report.json', {
    format: 1,
    before,
    after,
    sourceUnchanged,
    status,
    setup: resume
      ? 'Resume supplied private snapshot; its setup provenance must be checked against the original report. Saved AI profiles choose every continuation action.'
      : 'Genuine base, optional-module or faction-expansion setup; no cards, forces, factions, phases or statistics staged. Real saved AI profiles choose every setup and gameplay action.',
    randomness: resume
      ? 'Continuation restarts the random stream at seed plus scenario ordinal; it does not reconstruct the pre-snapshot random stream.'
      : 'Each scenario starts its random stream at seed plus scenario ordinal.',
    ...(selected.some(scenario => scenario.profile === 'stronghold-factions') ? {
      strongholdFactions: {
        families: selected.filter(scenario => scenario.profile === 'stronghold-factions').map(scenario => ({
          roster: scenario.roster,
          expansions: scenario.expansions,
          treacheryCards: scenario.expansions.includes('ix') ? 47 : 35,
          richeseCache: scenario.roster.includes('richese') ? 10 : 0,
        })),
        strongholdCards: 6,
        custody: 'Six separate physical cards checked after every accepted action and JSON restore; end-Mentat holders persist during the next turn, independently of current board control.',
        scope: 'Advanced selected Ixian/Tleilaxu and CHOAM/Richese native families with classic opponents; Stronghold Cards alone. Per-family ordinary decks and separate Richese caches remain explicit. This sample does not certify every Treachery effect, optional-module combination or deployed readiness.',
      },
    } : {}),
    ...(selected.some(scenario => scenario.profile === 'ecaz-occupy') ? {
      ecazOccupy: {
        families: selected.filter(scenario => scenario.profile === 'ecaz-occupy').map(scenario => ({
          roster: scenario.roster,
          expansions: scenario.expansions,
          treacheryCards: (scenario.expansions.includes('ix') ? 47 : scenario.expansions.includes('choam') ? 35 : 33) +
            (scenario.ecazTreachery ? 3 : 0),
          ecazTreachery: !!scenario.ecazTreachery,
        })),
        scope: 'Advanced native Ecaz/classic/Ixian/Tleilaxu/CHOAM paired or mixed families, two through six seats. Selected E3/E1/E2 decks and explicit independent three-card variant samples; no Richese mixed planning or other optional overlays. Authorized revised Advanced ceil contribution/floor survivors; not a designer erratum or Basic ruling.',
      },
    } : {}),
    options: {
      seed,
      profile: resume ? resume.scenario.profile : profile,
      rules: resume ? resume.scenario.rules : rules,
      maxActions,
      players: resume ? resume.scenario.roster.length : players,
      ...(resume ? { resume: { path: resume.path, sha256: resume.hash } } : {}),
    },
    results: results.map(
      ({ used: _used, rejected: _rejected, ...result }) => result,
    ),
  });
  console.log(
    JSON.stringify({ status, report: resolve(directory, 'report.json') }),
  );
  if (status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
