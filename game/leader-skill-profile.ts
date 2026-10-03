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
  semutaPreview?: unknown;
  moritaniAssassinatePreview?: unknown;
  advancedPreview?: unknown;
  kullPreview?: unknown;
  nexusKullPreview?: unknown;
  guildBetrayalPreview?: unknown;
  richeseBetrayalPreview?: unknown;
  nexusIxianReplacementPreview?: unknown;
  nexusIxianBetrayalPreview?: unknown;
  nexusHarkonnenBetrayalPreview?: unknown;
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

/** Existing bounded Advanced assassination roster, composed with native skills. */
export function advancedMoritaniLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (game.advanced !== true || game.expansions.length !== 1 ||
    game.expansions[0] !== 'ecaz' || !players || players.length < 2 || players.length > 6 ||
    !noOtherLeaderSkillModules(game) || game.semutaPreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  let native = false;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    for (let j = 0; j < i; j++) if (players[j].faction === player.faction) return false;
    if (player.faction === 'moritani') native = true;
    else {
      if (player.faction === 'harkonnen') return false;
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction && faction.expansion === 'base') { classic = true; break; }
      if (!classic) return false;
    }
  }
  return native;
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

/** Basic CHOAM's ordinary leaders and economy; Auditor belongs to Advanced. */
export function basicChoamLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return game.advanced === false && game.expansions.length === 1 &&
    game.expansions[0] === 'choam' && noOtherLeaderSkillModules(game) &&
    !!game.players?.some(player => player.faction === 'choam') &&
    game.players.every(player => player.faction === 'choam' ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base'));
}

export function basicExpansionLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return basicMoritaniLeaderSkillsProfile(game) || basicTleilaxuLeaderSkillsProfile(game) ||
    basicIxLeaderSkillsProfile(game) || basicChoamLeaderSkillsProfile(game);
}

/** Source-clear Advanced native factions; optional decks never imply a seated faction. */
export function advancedNativeLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (game.advanced !== true || !players || players.length < 2 || players.length > 6 ||
    game.expansions.length < 1 || game.expansions.length > 2 ||
    (game.expansions.length === 2 && game.expansions[0] === game.expansions[1]) ||
    !noOtherLeaderSkillModules(game) ||
    game.semutaPreview || game.moritaniAssassinatePreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (const expansion of game.expansions)
    if (expansion !== 'ix' && expansion !== 'choam') return false;
  let native = false;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    // Six seats at most: check prior seats without allocating per-rule quote sets.
    for (let j = 0; j < i; j++) if (players[j].faction === player.faction) return false;
    if (player.faction === 'ixians' || player.faction === 'tleilaxu' || player.faction === 'choam') {
      if (!game.expansions.includes(player.faction === 'choam' ? 'choam' : 'ix')) return false;
      native = true;
    } else {
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction && faction.expansion === 'base') { classic = true; break; }
      if (!classic) return false;
    }
  }
  return native;
}

export function nativeExpansionLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return basicExpansionLeaderSkillsProfile(game) || advancedNativeLeaderSkillsProfile(game) ||
    advancedMoritaniLeaderSkillsProfile(game);
}

/** Shared by rule quotes, controls and minimal legal bot participation. */
export function ordinaryLeaderSkillModeSupported(game: LeaderSkillProfile): boolean {
  return noOtherLeaderSkillModules(game) &&
    (!game.expansions.length || nativeExpansionLeaderSkillsProfile(game));
}
