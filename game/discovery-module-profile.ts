import { FACTIONS } from './catalog';
import { mixedE3NexusRosterProfile, type FactionModuleProfile } from './faction-module-profile';
import type { LeaderSkillProfile } from './leader-skill-profile';

/** Public unused-lobby admission only. The original initializer owns physical
 * decks, tokens, leader/force inventories and all mandatory setup choices. */
export function discoveryModuleProfile(game: FactionModuleProfile): boolean {
  return !game.discoveries && !game.discoveryStash && !game.greatMaker &&
    discoveryModeSupported(game);
}

/** Original Homeworld/Discovery under the same classic/native roster contract. */
export function homeworldDiscoveryProfile(game: FactionModuleProfile): boolean {
  return !!game.homeworlds && discoveryModeSupported(game);
}

/** The same roster/module contract during play; live Discovery frames are expected. */
export function discoveryModeSupported(game: FactionModuleProfile): boolean {
  if (game.nexusCards) return standaloneE3DiscoveryNexusProfile(game) || singleE1E2DiscoveryNexusProfile(game) ||
    mixedE3DiscoveryNexusProfile(game) || mixedE1E2DiscoveryNexusProfile(game) || pairedE3DiscoveryNexusProfile(game);
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) || game.expansions.length > 2 ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills || game.nexusCards ||
    game.ecazTreachery ||
    game.semutaPreview || game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview)
    return false;
  const e3 = game.expansions.length === 1 && game.expansions[0] === 'ecaz';
  for (let i = 0; i < game.expansions.length; i++) {
    const expansion = game.expansions[i];
    if (e3 ? expansion !== 'ecaz' : expansion !== 'ix' && expansion !== 'choam') return false;
    for (let j = 0; j < i; j++) if (game.expansions[j] === expansion) return false;
  }
  let native = 0, moritani = false, harkonnen = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (game.players[j].faction === player.faction) return false;
    let expansion: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { expansion = faction.expansion; break; }
    if (expansion === undefined) return false;
    if (expansion !== 'base') {
      if (e3 ? player.faction !== 'ecaz' && player.faction !== 'moritani'
        : !game.expansions.includes(expansion)) return false;
      native++;
    }
    if (player.faction === 'moritani') moritani = true;
    if (player.faction === 'harkonnen') harkonnen = true;
  }
  return (!e3 || native === 1) && !(game.advanced && moritani && harkonnen);
}

/** Fresh or live classic all-fourteen Skills/Discovery, optionally Homeworlds/Tech/Advanced Strongholds.
 * Physical undealt components and existing inventories belong to the initializer. */
export function classicDiscoveryLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.expansions.length || !players || players.length < 2 || players.length > 6 ||
    (game.techTokens && players.length < 3) || (game.strongholdCards && !game.advanced) ||
    game.nexusCards || game.ecazTreachery || game.semutaPreview ||
    game.moritaniAssassinatePreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview || game.mentatQuestionPreview ||
    game.spiceBankerIncomePreview) return false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return true;
}

/** Original classic Nexus/Discovery, optionally Homeworlds/Tech/Advanced Strongholds.
 * Setup verifies undealt inventories; live token/encounter frames are expected. */
export function classicDiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length || game.players.length < 2 ||
    game.players.length > 6 || (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (game.players[j].faction === player.faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return true;
}

/** Both original natives in one E1/E2 Nexus/Discovery family, optionally Homeworlds, without Skills.
 * Original setup owns undealt inventories; live Discovery frames are expected. */
export function pairedDiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 1 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  const expansion = game.expansions[0];
  if (expansion !== 'ix' && expansion !== 'choam') return false;
  const primary = expansion === 'ix' ? 'ixians' : 'choam';
  const secondary = expansion === 'ix' ? 'tleilaxu' : 'richese';
  let hasPrimary = false, hasSecondary = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (game.players[j].faction === player.faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== expansion) return false;
    if (player.faction === primary) hasPrimary = true;
    if (player.faction === secondary) hasSecondary = true;
  }
  return hasPrimary && hasSecondary;
}

/** One original E3 native/classics with Nexus/Discovery and no Skills.
 * Optional Homeworlds/Tech/Advanced Strongholds retain their original prerequisites. */
export function standaloneE3DiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 1 || game.expansions[0] !== 'ecaz' ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  let native: 'ecaz' | 'moritani' | null = null, harkonnen = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
    if (player.faction === 'ecaz' || player.faction === 'moritani') {
      if (native !== null) return false;
      native = player.faction;
    } else {
      let classic = false;
      for (const faction of FACTIONS)
        if (faction.id === player.faction) { classic = faction.expansion === 'base'; break; }
      if (!classic) return false;
    }
    if (player.faction === 'harkonnen') harkonnen = true;
  }
  return native !== null && !(game.advanced && native === 'moritani' && harkonnen);
}

/** Exactly one original E1/E2 native/classics with Nexus/Discovery and no Skills. */
export function singleE1E2DiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 1 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  const expansion = game.expansions[0];
  if (expansion !== 'ix' && expansion !== 'choam') return false;
  let native = 0;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== expansion) return false;
    if (family === expansion) native++;
  }
  return native === 1;
}

/** Original natives from both selected E1/E2 families with Nexus/Discovery and no Skills. */
export function mixedE1E2DiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 2 ||
    !game.expansions.includes('ix') || !game.expansions.includes('choam') ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  let ix = false, choam = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== 'ix' && family !== 'choam') return false;
    if (family === 'ix') ix = true;
    if (family === 'choam') choam = true;
  }
  return ix && choam;
}

/** Both original E3 natives with Nexus/Discovery and no Skills; Advanced capture exclusion remains. */
export function pairedE3DiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 1 || game.expansions[0] !== 'ecaz' ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview || game.kullPreview ||
    game.nexusKullPreview || game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  let ecaz = false, moritani = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
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

/** Original mixed E3 or all-three-family Nexus/Discovery without Skills. */
export function mixedE3DiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  return game.discoveryEnabled === true && !!game.nexusCards && !game.leaderSkills &&
    (!game.techTokens || game.players.length >= 3) &&
    (!game.strongholdCards || game.advanced) &&
    !game.ecazTreachery && !game.semutaPreview && !game.advancedPreview &&
    !game.kullPreview && !game.nexusKullPreview && !game.guildBetrayalPreview &&
    !game.richeseBetrayalPreview && !game.nexusIxianReplacementPreview &&
    !game.nexusIxianBetrayalPreview && !game.nexusHarkonnenBetrayalPreview &&
    mixedE3NexusRosterProfile(game);
}
