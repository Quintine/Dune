import { FACTIONS } from './catalog';
import type { FactionModuleProfile } from './faction-module-profile';

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
