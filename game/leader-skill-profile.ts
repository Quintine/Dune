import { FACTIONS } from './catalog';

/** Public configuration only; never gate a skill on a hidden card or random deal. */
export type LeaderSkillProfile = {
  expansions: readonly string[];
  advanced?: boolean;
  players?: readonly { faction: string }[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveries?: unknown;
  discoveryEnabled?: unknown;
  strongholdCards?: unknown;
  techTokens?: unknown;
  ecazTreachery?: unknown;
};

export function noOtherLeaderSkillModules(game: LeaderSkillProfile): boolean {
  return !game.homeworlds && !game.nexusCards && !game.discoveries &&
    !game.discoveryEnabled && !game.strongholdCards && !game.techTokens && !game.ecazTreachery;
}

/** Bounded integration of the ordinary Moritani roster, not Advanced assassination. */
export function basicMoritaniLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return game.advanced === false && game.expansions.length === 1 &&
    game.expansions[0] === 'ecaz' && noOtherLeaderSkillModules(game) &&
    !!game.players?.some(player => player.faction === 'moritani') &&
    game.players.every(player => player.faction === 'moritani' ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base'));
}

/** Native Basic Tleilaxu, including Face Dancers; foreign gholas are Advanced. */
export function basicTleilaxuLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return game.advanced === false && game.expansions.length === 1 &&
    game.expansions[0] === 'ix' && noOtherLeaderSkillModules(game) &&
    !!game.players?.some(player => player.faction === 'tleilaxu') &&
    game.players.every(player => player.faction === 'tleilaxu' ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base'));
}

/** Basic Ixians, optionally with native Tleilaxu, keep the ordinary Ix inventories. */
export function basicIxLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return game.advanced === false && game.expansions.length === 1 &&
    game.expansions[0] === 'ix' && noOtherLeaderSkillModules(game) &&
    !!game.players?.some(player => player.faction === 'ixians') &&
    game.players.every(player => ['ixians', 'tleilaxu'].includes(player.faction) ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base'));
}

export function basicExpansionLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return basicMoritaniLeaderSkillsProfile(game) || basicTleilaxuLeaderSkillsProfile(game) ||
    basicIxLeaderSkillsProfile(game);
}

/** Shared by rule quotes, controls and minimal legal bot participation. */
export function ordinaryLeaderSkillModeSupported(game: LeaderSkillProfile): boolean {
  return noOtherLeaderSkillModules(game) &&
    (!game.expansions.length || basicExpansionLeaderSkillsProfile(game));
}
