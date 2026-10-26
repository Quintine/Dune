import { FACTIONS } from './catalog';
import { independentDiscoveryProfile, nexusCoreProfile, type FactionModuleProfile } from './faction-module-profile';
import {
  classicNexusLeaderSkillsProfile,
  homeworldLeaderSkillsProfile,
  nativeDiscoveryLeaderSkillsProfile,
  pairedNexusLeaderSkillsProfile,
} from './leader-skill-profile';
import {
  classicDiscoveryLeaderSkillsProfile,
  classicDiscoveryNexusProfile,
  homeworldDiscoveryProfile,
  pairedDiscoveryNexusProfile,
} from './discovery-module-profile';
import {
  classicNexusModulesProfile,
  mixedE1E2NexusProfile,
  mixedE3NexusProfile,
  pairedE3NexusProfile,
  pairedNexusModulesProfile,
  singleE1E2NexusProfile,
  standaloneE3NexusProfile,
} from './nexus-module-profile';

export type HomeworldPhaseModulesProfile = FactionModuleProfile & {
  homeworldOccupationPreview?: unknown;
  homeworldTupilePreview?: unknown;
  homeworldEcazVictoryPreview?: unknown;
};

/** A real empty selection means classic decks. Do not emulate that case by
 * adding a selected family that is absent from the actual configuration. */
function registeredRoster(game: HomeworldPhaseModulesProfile): boolean {
  if (!Array.isArray(game.expansions) || game.expansions.length > 3 ||
    !game.expansions.every(family => family === 'ix' || family === 'choam' || family === 'ecaz') ||
    new Set(game.expansions).size !== game.expansions.length ||
    !Array.isArray(game.players) || game.players.length < 2 || game.players.length > 6) return false;
  const seated = new Set<string>();
  for (const player of game.players) {
    if (!player || typeof player !== 'object' || Array.isArray(player) ||
      typeof player.faction !== 'string' || seated.has(player.faction)) return false;
    const faction = FACTIONS.find(faction => faction.id === player.faction);
    if (!faction || faction.expansion !== 'base' && !game.expansions.includes(faction.expansion)) return false;
    seated.add(player.faction);
  }
  return true;
}
const optionalFlag = (value: unknown) => value === undefined || typeof value === 'boolean';

/** Configuration permission only: original setup validates freshness, and live
 * custody/history validators retain their own physical and occupation rules.
 * Optional independent cards do not require either phase module. */
export function homeworldPhaseModulesProfile(game: HomeworldPhaseModulesProfile): boolean {
  if (!game || typeof game !== 'object' || !game.homeworlds || typeof game.advanced !== 'boolean' ||
    !registeredRoster(game) || !optionalFlag(game.ecazTreachery) ||
    (game.techTokens && game.players.length < 3) || (game.strongholdCards && !game.advanced) ||
    game.leaderSkills || game.nexusCards || game.discoveryEnabled || game.discoveries ||
    game.discoveryStash || game.greatMaker || game.sandtrout || game.spiceBankerIncomePreview ||
    game.semutaPreview || game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  if (![game.ecazOccupyPreview, game.moritaniAssassinatePreview, game.homeworldOccupationPreview,
    game.homeworldTupilePreview, game.homeworldEcazVictoryPreview].every(optionalFlag)) return false;
  const ecaz = game.players.some(player => player.faction === 'ecaz');
  const moritani = game.players.some(player => player.faction === 'moritani');
  const choam = game.players.some(player => player.faction === 'choam');
  return (!game.ecazOccupyPreview || ecaz) &&
    (!game.moritaniAssassinatePreview || game.advanced && moritani) &&
    (!game.homeworldTupilePreview || game.homeworldOccupationPreview === true && choam) &&
    (!game.homeworldEcazVictoryPreview || game.homeworldOccupationPreview === true && ecaz);
}

/** Occupation benefits for an already-admitted original World/all14 setup.
 * The same unchanged library admission predicate remains authoritative; this
 * only selects the clean occupation context and accepts its native stamps. */
export function homeworldOccupationLeaderSkillsProfile(game: HomeworldPhaseModulesProfile): boolean {
  if (!game || typeof game !== 'object' || !game.homeworlds || !game.leaderSkills ||
    typeof game.advanced !== 'boolean' || !registeredRoster(game) || !optionalFlag(game.ecazTreachery) ||
    (game.techTokens && game.players.length < 3) || (game.strongholdCards && !game.advanced) ||
    game.nexusCards || game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.sandtrout || game.semutaPreview || game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  if (![game.ecazOccupyPreview, game.moritaniAssassinatePreview, game.homeworldOccupationPreview,
    game.homeworldTupilePreview, game.homeworldEcazVictoryPreview, game.spiceBankerIncomePreview].every(optionalFlag)) return false;
  const ecaz = game.players.some(player => player.faction === 'ecaz');
  const moritani = game.players.some(player => player.faction === 'moritani');
  const choam = game.players.some(player => player.faction === 'choam');
  return (!game.ecazOccupyPreview || ecaz) &&
    (!game.moritaniAssassinatePreview || game.advanced && moritani) &&
    (!game.homeworldTupilePreview || game.homeworldOccupationPreview === true && choam) &&
    (!game.homeworldEcazVictoryPreview || game.homeworldOccupationPreview === true && ecaz) &&
    homeworldLeaderSkillsProfile(game);
}

/** Occupation benefits for already-admitted original World/Nexus or Discovery
 * setups. Pass the actual configuration to its unchanged admission predicates:
 * live effect stamps and Discovery frames are not replacement module choices. */
export function homeworldOccupationModulesProfile(game: HomeworldPhaseModulesProfile): boolean {
  if (!game || typeof game !== 'object' || !game.homeworlds || typeof game.advanced !== 'boolean' ||
    !registeredRoster(game) || !optionalFlag(game.ecazTreachery) ||
    (game.techTokens && game.players.length < 3) || (game.strongholdCards && !game.advanced) ||
    (!game.nexusCards && game.discoveryEnabled !== true) ||
    (game.discoveryEnabled !== true && (game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker)) ||
    game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.richeseBetrayalPreview) return false;
  if (![game.ecazOccupyPreview, game.moritaniAssassinatePreview, game.homeworldOccupationPreview,
    game.homeworldTupilePreview, game.homeworldEcazVictoryPreview, game.spiceBankerIncomePreview,
    game.guildBetrayalPreview, game.nexusIxianReplacementPreview, game.nexusIxianBetrayalPreview,
    game.nexusHarkonnenBetrayalPreview].every(optionalFlag)) return false;
  const seated = (faction: string) => game.players.some(player => player.faction === faction);
  if ((game.ecazOccupyPreview && !seated('ecaz')) ||
    (game.moritaniAssassinatePreview && (!game.advanced || !seated('moritani'))) ||
    (game.homeworldTupilePreview && (game.homeworldOccupationPreview !== true || !seated('choam'))) ||
    (game.homeworldEcazVictoryPreview && (game.homeworldOccupationPreview !== true || !seated('ecaz'))) ||
    (game.spiceBankerIncomePreview && !game.leaderSkills) ||
    (game.guildBetrayalPreview && (!game.nexusCards || !seated('guild'))) ||
    (game.nexusIxianReplacementPreview && (!game.nexusCards || seated('ixians'))) ||
    (game.nexusIxianBetrayalPreview && (!game.nexusCards || !seated('ixians'))) ||
    (game.nexusHarkonnenBetrayalPreview && (!game.nexusCards || !seated('harkonnen')))) return false;

  if (game.leaderSkills) return homeworldLeaderSkillsProfile(game) &&
    (game.discoveryEnabled !== true || independentDiscoveryProfile(game) ||
      classicDiscoveryLeaderSkillsProfile(game) || nativeDiscoveryLeaderSkillsProfile(game) ||
      classicNexusLeaderSkillsProfile(game));
  if (game.discoveryEnabled === true) return homeworldDiscoveryProfile(game) ||
    classicDiscoveryNexusProfile(game) || pairedDiscoveryNexusProfile(game);
  return nexusCoreProfile(game) || classicNexusModulesProfile(game) || pairedNexusModulesProfile(game) ||
    singleE1E2NexusProfile(game) || mixedE1E2NexusProfile(game) || standaloneE3NexusProfile(game) ||
    pairedE3NexusProfile(game) || mixedE3NexusProfile(game) ||
    // The original paired initializer also admits bare E1/E2 World/Nexus.
    // This public configuration predicate describes that same undealt roster.
    pairedNexusLeaderSkillsProfile(game);
}
