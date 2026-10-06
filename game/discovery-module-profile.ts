import { FACTIONS } from './catalog';
import type { FactionModuleProfile } from './faction-module-profile';
import type { LeaderSkillProfile } from './leader-skill-profile';

/** Public unused-lobby admission only. The original initializer owns physical
 * decks, tokens, leader/force inventories and all mandatory setup choices. */
export function discoveryModuleProfile(game: FactionModuleProfile): boolean {
  return !game.discoveries && !game.discoveryStash && !game.greatMaker &&
    discoveryModeSupported(game);
}

/** Original classic Homeworld/Discovery; live Arrakis-only token frames are expected. */
export function classicHomeworldDiscoveryProfile(game: FactionModuleProfile): boolean {
  if (!game.homeworlds || typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.expansions.length || game.players.length < 2 || game.players.length > 6 ||
    game.leaderSkills || game.nexusCards || game.techTokens || game.strongholdCards ||
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

/** The same roster/module contract during play; live Discovery frames are expected. */
export function discoveryModeSupported(game: FactionModuleProfile): boolean {
  if (classicHomeworldDiscoveryProfile(game)) return true;
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) || game.expansions.length > 2 ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills || game.homeworlds || game.nexusCards ||
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

/** Fresh or live classic all-fourteen Skills/Discovery, optionally Tech/Advanced Strongholds.
 * Physical undealt components and existing inventories belong to the initializer. */
export function classicDiscoveryLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.expansions.length || !players || players.length < 2 || players.length > 6 ||
    (game.techTokens && players.length < 3) || (game.strongholdCards && !game.advanced) ||
    game.homeworlds || game.nexusCards || game.ecazTreachery || game.semutaPreview ||
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

/** Original classic Nexus/Discovery, optionally Tech and Advanced Strongholds.
 * Setup verifies undealt inventories; live token/encounter frames are expected. */
export function classicDiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length || game.players.length < 2 ||
    game.players.length > 6 || (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills || game.homeworlds ||
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

/** Both original natives in one E1/E2 Nexus/Discovery family, without Skills.
 * Original setup owns undealt inventories; live Discovery frames are expected. */
export function pairedDiscoveryNexusProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    !game.nexusCards || game.expansions.length !== 1 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills || game.homeworlds ||
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
