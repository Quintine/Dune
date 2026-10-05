import { FACTIONS } from './catalog';
import type { FactionModuleProfile } from './faction-module-profile';
import type { LeaderSkillProfile } from './leader-skill-profile';

/** Public unused-lobby admission only. The original initializer owns physical
 * decks, tokens, leader/force inventories and all mandatory setup choices. */
export function discoveryModuleProfile(game: FactionModuleProfile): boolean {
  return !game.discoveries && !game.discoveryStash && !game.greatMaker &&
    discoveryModeSupported(game);
}

/** The same roster/module contract during play; live Discovery frames are expected. */
export function discoveryModeSupported(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) || game.expansions.length > 2 ||
    game.strongholdCards || game.leaderSkills || game.homeworlds || game.nexusCards ||
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

/** Fresh or live classic all-fourteen Skills/Discovery, optionally original Tech.
 * Physical undealt components and existing inventories belong to the initializer. */
export function classicDiscoveryLeaderSkillsProfile(game: LeaderSkillProfile): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || game.discoveryEnabled !== true ||
    game.expansions.length || !players || players.length < 2 || players.length > 6 ||
    (game.techTokens && players.length < 3) || game.strongholdCards ||
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
