import { FACTIONS } from './catalog';
import { classicIndependentNexusProfile, mixedE3NexusRosterProfile } from './faction-module-profile';
import { classicDiscoveryLeaderSkillsProfile } from './discovery-module-profile';

/** Public configuration only; never gate a skill on a hidden card or random deal. */
export type LeaderSkillProfile = {
  expansions: readonly string[];
  advanced?: boolean;
  players?: readonly { faction: string }[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveries?: unknown;
  discoveryEnabled?: unknown;
  discoveryStash?: unknown;
  greatMaker?: unknown;
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
  spiceBankerIncomePreview?: unknown;
};

export function noOtherLeaderSkillModules(game: LeaderSkillProfile): boolean {
  return !game.homeworlds && !game.nexusCards && !game.discoveries &&
    !game.discoveryEnabled && !game.strongholdCards && !game.techTokens && !game.ecazTreachery;
}

function nexusLeaderSkillModulesSupported(game: LeaderSkillProfile, assassination = false, discovery = false, betrayal = false): boolean {
  return !!game.nexusCards && typeof game.advanced === 'boolean' &&
    !!game.players && game.players.length >= 2 && game.players.length <= 6 &&
    ((discovery && game.discoveryEnabled === true) ||
      (!game.discoveries && !game.discoveryEnabled && !game.discoveryStash && !game.greatMaker)) &&
    (!game.techTokens || game.players.length >= 3) &&
    (!game.strongholdCards || game.advanced === true) &&
    !game.ecazTreachery && (!game.semutaPreview ||
      (semutaLeaderSkillContext(game) && !game.homeworlds &&
        !game.discoveryEnabled && !game.discoveries)) &&
    (!game.moritaniAssassinatePreview || assassination) &&
    !game.advancedPreview && !game.kullPreview && !game.nexusKullPreview &&
    (!game.guildBetrayalPreview || betrayal) && !game.richeseBetrayalPreview &&
    !game.nexusIxianReplacementPreview && !game.nexusIxianBetrayalPreview &&
    !game.nexusHarkonnenBetrayalPreview;
}

/** Fresh classic Nexus/Skills, optionally Homeworlds/Discovery/Tech/Advanced Strongholds. */
export function classicNexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (classicIndependentNexusProfile(game)) return true;
  if (game.expansions.length || !nexusLeaderSkillModulesSupported(game, false, true, false)) return false;
  const players = game.players!;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return true;
}

/** Fresh classic Nexus/Skills composed only with the bounded Guild Betrayal preview. */
export function guildBetrayalNexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length || !game.guildBetrayalPreview || game.homeworlds ||
    game.techTokens || game.strongholdCards || game.semutaPreview ||
    !nexusLeaderSkillModulesSupported(game, false, false, true)) return false;
  const players = game.players!;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return players.some(player => player.faction === 'guild');
}

/** Both original natives in one E1/E2 family, optionally Homeworlds/Discovery/Tech/Strongholds. */
export function pairedNexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length !== 1 || !nexusLeaderSkillModulesSupported(game, false, true)) return false;
  const expansion = game.expansions[0];
  if (expansion !== 'ix' && expansion !== 'choam') return false;
  const primary = expansion === 'ix' ? 'ixians' : 'choam';
  const secondary = expansion === 'ix' ? 'tleilaxu' : 'richese';
  const players = game.players!;
  let hasPrimary = false, hasSecondary = false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== expansion) return false;
    if (players[i].faction === primary) hasPrimary = true;
    if (players[i].faction === secondary) hasSecondary = true;
  }
  return hasPrimary && hasSecondary;
}

/** Exactly one original E1/E2 native with classics; paired/mixed rosters stay separate. */
export function singleE1E2NexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length !== 1 || !nexusLeaderSkillModulesSupported(game, false, true)) return false;
  const expansion = game.expansions[0];
  if (expansion !== 'ix' && expansion !== 'choam') return false;
  const players = game.players!;
  let native = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== expansion) return false;
    if (family === expansion) native++;
  }
  return native === 1;
}

/** One original E3 native with classics and optional Homeworlds/Discovery; no shared Duke or mixed family. */
export function standaloneE3NexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length !== 1 || game.expansions[0] !== 'ecaz' ||
    !nexusLeaderSkillModulesSupported(game, game.advanced === true, true)) return false;
  const players = game.players!;
  let native: 'ecaz' | 'moritani' | null = null, harkonnen = false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    const player = players[i];
    if (player.faction === 'ecaz' || player.faction === 'moritani') {
      if (native !== null) return false;
      native = player.faction;
    } else {
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction) { classic = faction.expansion === 'base'; break; }
      if (!classic) return false;
      if (player.faction === 'harkonnen') harkonnen = true;
    }
  }
  return native !== null && !(game.advanced && harkonnen) &&
    (native === 'moritani' || !game.moritaniAssassinatePreview);
}

/** Original E1/E2 natives from both selected families with classics and Nexus. */
export function mixedE1E2NexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length !== 2 || !game.expansions.includes('ix') ||
    !game.expansions.includes('choam') || !nexusLeaderSkillModulesSupported(game, false, true)) return false;
  const players = game.players!;
  let ix = false, choam = false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== 'ix' && family !== 'choam') return false;
    if (family === 'ix') ix = true;
    if (family === 'choam') choam = true;
  }
  return ix && choam;
}

/** Both original E3 natives and classic opponents; the shared Duke is never a training disc. */
export function pairedE3NexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.expansions.length !== 1 || game.expansions[0] !== 'ecaz' ||
    !nexusLeaderSkillModulesSupported(game, game.advanced === true, true)) return false;
  return pairedE3LeaderSkillRoster(game);
}

function pairedE3LeaderSkillRoster(game: LeaderSkillProfile): boolean {
  const players = game.players!;
  let ecaz = false, moritani = false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    const player = players[i];
    if (player.faction === 'ecaz') ecaz = true;
    else if (player.faction === 'moritani') moritani = true;
    else {
      if (game.advanced && player.faction === 'harkonnen') return false;
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction) { classic = faction.expansion === 'base'; break; }
      if (!classic) return false;
    }
  }
  return ecaz && moritani;
}

/** Both seated E3 natives share selected-deck Skills; original Nexus stays separate. */
export function pairedE3LeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return selectedDeckLeaderSkillsProfile(game) &&
    game.players!.some(player => player.faction === 'ecaz') &&
    game.players!.some(player => player.faction === 'moritani');
}

/** Original two/three selected families with native E3, Nexus and optional original modules. */
export function mixedE3NexusLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return nexusLeaderSkillModulesSupported(game, game.advanced === true, true) &&
    mixedE3NexusRosterProfile(game, true);
}

/** Discovery keeps original native roster predicates; only this module envelope
 * differs. Live token/entry/Great Maker frames are original consumers. */
function discoveryLeaderSkillModulesSupported(game: LeaderSkillProfile): boolean {
  if (game.homeworlds)
    return game.discoveryEnabled === true && homeworldLeaderSkillModulesSupported(game);
  const players = game.players;
  return typeof game.advanced === 'boolean' && game.discoveryEnabled === true &&
    !!players && players.length >= 2 && players.length <= 6 &&
    (!game.techTokens || players.length >= 3) &&
    (!game.strongholdCards || game.advanced) &&
    game.expansions.length >= 1 && game.expansions.length <= 2 &&
    !game.homeworlds && !game.nexusCards && !game.ecazTreachery && !game.semutaPreview &&
    !game.advancedPreview && !game.kullPreview && !game.nexusKullPreview &&
    !game.guildBetrayalPreview && !game.richeseBetrayalPreview &&
    !game.nexusIxianReplacementPreview && !game.nexusIxianBetrayalPreview &&
    !game.nexusHarkonnenBetrayalPreview;
}

/** Recognize only the explicit overlay; native predicates still own roster/module legality. */
function semutaLeaderSkillContext(game: LeaderSkillProfile): boolean {
  return game.semutaPreview === true &&
    game.expansions.includes('choam') && !!game.players?.some(p => p.faction === 'richese');
}

/** Selected decks retain original World/phase modules and explicitly supported overlays. */
function selectedDeckLeaderSkillModulesSupported(game: LeaderSkillProfile): boolean {
  if (game.homeworlds) return homeworldLeaderSkillModulesSupported(game);
  if (noOtherLeaderSkillModules(game) || independentTreacheryLeaderSkillsProfile(game) || pairedNexusLeaderSkillsProfile(game) ||
    singleE1E2NexusLeaderSkillsProfile(game) || mixedE1E2NexusLeaderSkillsProfile(game)) return true;
  if (game.discoveryEnabled || game.discoveries) return discoveryLeaderSkillModulesSupported(game);
  const players = game.players;
  if ((!game.techTokens && !game.strongholdCards) || !players ||
    players.length < (game.techTokens ? 3 : 2) || players.length > 6 ||
    (game.strongholdCards && game.advanced !== true) ||
    game.expansions.length < 1 || game.expansions.length > 3 ||
    game.homeworlds || game.nexusCards || game.discoveries || game.discoveryEnabled ||
    game.ecazTreachery || (game.semutaPreview && !semutaLeaderSkillContext(game)) ||
    game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (const expansion of game.expansions)
    if (expansion !== 'ix' && expansion !== 'choam' && expansion !== 'ecaz') return false;
  for (let i = 0; i < players.length; i++)
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
  return true;
}

/** Standalone E3 native predicates retain their own roster, Duke and assassination limits. */
function e3LeaderSkillModulesSupported(game: LeaderSkillProfile): boolean {
  if (game.homeworlds) return homeworldLeaderSkillModulesSupported(game);
  if (noOtherLeaderSkillModules(game) || independentTreacheryLeaderSkillsProfile(game) ||
    standaloneE3NexusLeaderSkillsProfile(game) || pairedE3NexusLeaderSkillsProfile(game)) return true;
  if (game.discoveryEnabled || game.discoveries) return discoveryLeaderSkillModulesSupported(game);
  const players = game.players;
  if ((!game.techTokens && !game.strongholdCards) || !players ||
    players.length < (game.techTokens ? 3 : 2) || players.length > 6 ||
    (game.strongholdCards && game.advanced !== true) ||
    game.homeworlds || game.nexusCards || game.discoveries || game.discoveryEnabled ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < players.length; i++)
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
  return true;
}

/** Classic three-to-six-seat Skills/Tech composition; native and other modules stay separate. */
export function classicTechLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.techTokens && !game.expansions.length && independentTreacheryLeaderSkillsProfile(game)) return true;
  const players = game.players;
  if (!game.techTokens || typeof game.advanced !== 'boolean' || game.expansions.length ||
    !players || players.length < 3 || players.length > 6 ||
    game.homeworlds || game.nexusCards || game.discoveries || game.discoveryEnabled ||
    game.strongholdCards || game.ecazTreachery || game.semutaPreview ||
    game.moritaniAssassinatePreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction && faction.expansion === 'base') { classic = true; break; }
    if (!classic) return false;
  }
  return true;
}

/** Original Advanced Strongholds, with optional Tech, for classic or supported native skills. */
export function strongholdLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (!game.strongholdCards || game.advanced !== true) return false;
  if (independentTreacheryLeaderSkillsProfile(game)) return true;
  if (game.expansions.length) return selectedDeckLeaderSkillsProfile(game) ||
    advancedMoritaniLeaderSkillsProfile(game) || nativeEcazLeaderSkillsProfile(game);
  const players = game.players;
  if (!players || players.length < (game.techTokens ? 3 : 2) || players.length > 6 ||
    game.homeworlds || game.nexusCards || game.discoveries || game.discoveryEnabled ||
    game.ecazTreachery || game.semutaPreview || game.moritaniAssassinatePreview ||
    game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction && faction.expansion === 'base') { classic = true; break; }
    if (!classic) return false;
  }
  return true;
}

/** Bounded integration of the ordinary Moritani roster, not Advanced assassination. */
export function basicMoritaniLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.advanced === false && game.players?.some(player => player.faction === 'moritani') &&
      selectedDeckLeaderSkillsProfile(game)) return true;
  return game.advanced === false && game.expansions.length === 1 &&
    game.expansions[0] === 'ecaz' && e3LeaderSkillModulesSupported(game) &&
    !!game.players?.some(player => player.faction === 'moritani') &&
    game.players.every(player => player.faction === 'moritani' ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base'));
}

/** Existing bounded Advanced assassination roster, composed with native skills. */
export function advancedMoritaniLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.advanced === true && game.players?.some(player => player.faction === 'moritani') &&
      selectedDeckLeaderSkillsProfile(game)) return true;
  const players = game.players;
  if (game.advanced !== true || game.expansions.length !== 1 ||
    game.expansions[0] !== 'ecaz' || !players || players.length < 2 || players.length > 6 ||
    !e3LeaderSkillModulesSupported(game) || game.semutaPreview || game.advancedPreview ||
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

/** Ecaz's five native discs; the separate temporarily controlled Duke is not an assignment disc. */
export function nativeEcazLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (game.players?.some(player => player.faction === 'ecaz') && selectedDeckLeaderSkillsProfile(game)) return true;
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || game.expansions.length !== 1 ||
    game.expansions[0] !== 'ecaz' || !players || players.length < 2 || players.length > 6 ||
    !e3LeaderSkillModulesSupported(game) || game.semutaPreview || game.moritaniAssassinatePreview ||
    game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  let native = false;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    for (let j = 0; j < i; j++) if (players[j].faction === player.faction) return false;
    if (player.faction === 'ecaz') native = true;
    else {
      if (game.advanced && player.faction === 'harkonnen') return false;
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction && faction.expansion === 'base') { classic = true; break; }
      if (!classic) return false;
    }
  }
  return native;
}


/** Every registered seat uses its selected ordinary family; no faction or Nexus prerequisite. */
export function selectedDeckLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || !players || players.length < 2 || players.length > 6 ||
    game.expansions.length < 1 || game.expansions.length > 3 ||
    !selectedDeckLeaderSkillModulesSupported(game) ||
    (game.semutaPreview && !semutaLeaderSkillContext(game)) ||
    game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < game.expansions.length; i++) {
    const expansion = game.expansions[i];
    if (expansion !== 'ix' && expansion !== 'choam' && expansion !== 'ecaz') return false;
    for (let j = 0; j < i; j++) if (game.expansions[j] === expansion) return false;
  }
  let nativeE3 = false, moritani = false, harkonnen = false;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    for (let j = 0; j < i; j++) if (players[j].faction === player.faction) return false;
    let selected = false;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) {
        selected = faction.expansion === 'base' || game.expansions.includes(faction.expansion);
        if (faction.expansion === 'ecaz') nativeE3 = true;
        break;
      }
    if (!selected) return false;
    if (player.faction === 'moritani') moritani = true;
    if (player.faction === 'harkonnen') harkonnen = true;
  }
  // E3's existing Nexus/Discovery/preview envelopes retain their original predicates.
  if (nativeE3 && ((game.advanced && harkonnen) || game.nexusCards ||
      game.discoveries || game.discoveryEnabled || game.discoveryStash ||
      game.greatMaker || game.semutaPreview)) return false;
  return !game.moritaniAssassinatePreview || (game.advanced && moritani);
}

export function nativeExpansionLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return (game.expansions.length > 0 && independentTreacheryLeaderSkillsProfile(game)) ||
    mixedE3NexusLeaderSkillsProfile(game) || mixedE1E2NexusLeaderSkillsProfile(game) || pairedE3NexusLeaderSkillsProfile(game) ||
    basicMoritaniLeaderSkillsProfile(game) || selectedDeckLeaderSkillsProfile(game) ||
    advancedMoritaniLeaderSkillsProfile(game) || nativeEcazLeaderSkillsProfile(game);
}

/** Fresh/live original native all14/Discovery; existing family limits stay authoritative. */
export function nativeDiscoveryLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return game.discoveryEnabled === true && nativeExpansionLeaderSkillsProfile(game);
}

/** Only the original eligible native skill families gain the Tech combination. */
export function nativeTechLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  return !!game.techTokens && nativeExpansionLeaderSkillsProfile(game);
}

/** Original Homeworld module envelope; native roster/deck predicates stay authoritative. */
function homeworldLeaderSkillModulesSupported(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (!game.homeworlds || typeof game.advanced !== 'boolean' ||
    !players || players.length < 2 || players.length > 6 ||
    (game.nexusCards && !classicNexusLeaderSkillsProfile(game) &&
      !pairedNexusLeaderSkillsProfile(game) && !singleE1E2NexusLeaderSkillsProfile(game) &&
      !mixedE1E2NexusLeaderSkillsProfile(game) && !pairedE3NexusLeaderSkillsProfile(game) &&
      !standaloneE3NexusLeaderSkillsProfile(game)) ||
    (game.discoveryEnabled !== true && (game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker)) ||
    (game.techTokens && players.length < 3) || (game.strongholdCards && !game.advanced) ||
    (game.ecazTreachery && !independentTreacheryLeaderSkillsProfile(game)) ||
    game.semutaPreview || game.advancedPreview ||
    (game.moritaniAssassinatePreview && (!game.advanced || !game.expansions.includes('ecaz') ||
      !players.some(player => player.faction === 'moritani'))) ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  return true;
}

/** Original Homeworld/Skills under the existing classic or native Nexus roster contracts. */
export function homeworldLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (!game.homeworlds) return false;
  if (game.expansions.length) return nativeExpansionLeaderSkillsProfile(game);
  if (!homeworldLeaderSkillModulesSupported(game)) return false;
  const players = game.players!;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return true;
}

/** Independent cards with registered selected-family all14 setup and original module/role guards. */
export function independentTreacheryLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  if (classicIndependentNexusProfile(game)) return true;
  if (game.ecazTreachery !== true || game.expansions.length > 3 ||
      typeof game.advanced !== 'boolean' || !game.players ||
      game.players.length < (game.techTokens ? 3 : 2) || game.players.length > 6 ||
      (game.strongholdCards && game.advanced !== true) ||
      game.nexusCards || game.discoveries || game.discoveryEnabled ||
      game.discoveryStash || game.greatMaker ||
      game.semutaPreview || game.advancedPreview ||
      game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
      game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
      game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < game.expansions.length; i++) {
    if (game.expansions[i] !== 'ix' && game.expansions[i] !== 'choam' && game.expansions[i] !== 'ecaz') return false;
    for (let j = 0; j < i; j++) if (game.expansions[j] === game.expansions[i]) return false;
  }
  const players = game.players;
  let nativeE3 = false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let selected = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) {
        selected = faction.expansion === 'base' || game.expansions.includes(faction.expansion);
        if (faction.expansion === 'ecaz') nativeE3 = true;
        break;
      }
    if (!selected) return false;
  }
  if (nativeE3 && game.advanced && players.some(player => player.faction === 'harkonnen')) return false;
  if (game.moritaniAssassinatePreview && (!game.advanced ||
      !players.some(player => player.faction === 'moritani'))) return false;
  return true;
}

/** Shared by rule quotes, controls and minimal legal bot participation. */
export function ordinaryLeaderSkillModeSupported(game: LeaderSkillProfile): boolean {
  return independentTreacheryLeaderSkillsProfile(game) || (noOtherLeaderSkillModules(game) &&
    (!game.expansions.length || nativeExpansionLeaderSkillsProfile(game) ||
      (game.expansions.length === 1 && game.expansions[0] === 'choam'))) ||
    classicTechLeaderSkillsProfile(game) || nativeTechLeaderSkillsProfile(game) ||
    strongholdLeaderSkillsProfile(game) || classicNexusLeaderSkillsProfile(game) ||
    guildBetrayalNexusLeaderSkillsProfile(game) ||
    singleE1E2NexusLeaderSkillsProfile(game) ||
    mixedE3NexusLeaderSkillsProfile(game) || mixedE1E2NexusLeaderSkillsProfile(game) || pairedE3NexusLeaderSkillsProfile(game) ||
    pairedNexusLeaderSkillsProfile(game) || standaloneE3NexusLeaderSkillsProfile(game) ||
    classicDiscoveryLeaderSkillsProfile(game) || nativeDiscoveryLeaderSkillsProfile(game) ||
    homeworldLeaderSkillsProfile(game);
}
