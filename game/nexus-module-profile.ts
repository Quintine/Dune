import { FACTIONS } from './catalog';
import type { FactionModuleProfile } from './faction-module-profile';
import { classicDiscoveryNexusProfile, pairedDiscoveryNexusProfile, standaloneE3DiscoveryNexusProfile } from './discovery-module-profile';

/** Original classic Nexus modules, optionally Homeworlds; initializer checks undealt components. */
export function classicNexusModulesProfile(game: FactionModuleProfile): boolean {
  if (game.discoveryEnabled || game.discoveries) return classicDiscoveryNexusProfile(game);
  if (typeof game.advanced !== 'boolean' || !game.nexusCards ||
    (!game.techTokens && !game.strongholdCards) || game.expansions.length !== 0 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
    let classic = false;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { classic = faction.expansion === 'base'; break; }
    if (!classic) return false;
  }
  return true;
}

/** Both original E1/E2 natives, optionally Homeworlds; mixed decks/families stay separate. */
export function pairedNexusModulesProfile(game: FactionModuleProfile): boolean {
  if (game.discoveryEnabled || game.discoveries) return pairedDiscoveryNexusProfile(game);
  if (typeof game.advanced !== 'boolean' || !game.nexusCards ||
    (!game.techTokens && !game.strongholdCards) || game.expansions.length !== 1 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
  const expansion = game.expansions[0];
  if (expansion !== 'ix' && expansion !== 'choam') return false;
  const primary = expansion === 'ix' ? 'ixians' : 'choam';
  const secondary = expansion === 'ix' ? 'tleilaxu' : 'richese';
  let hasPrimary = false, hasSecondary = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { family = faction.expansion; break; }
    if (family !== 'base' && family !== expansion) return false;
    if (player.faction === primary) hasPrimary = true;
    if (player.faction === secondary) hasSecondary = true;
  }
  return hasPrimary && hasSecondary;
}

/** One original E3 native/classics without Skills, optionally Homeworlds,
 * Discovery, Tech or Advanced Strongholds; setup owns undealt physical pieces. */
export function standaloneE3NexusProfile(game: FactionModuleProfile): boolean {
  if (game.discoveryEnabled || game.discoveries) return standaloneE3DiscoveryNexusProfile(game);
  if (typeof game.advanced !== 'boolean' || !game.nexusCards ||
    game.expansions.length !== 1 || game.expansions[0] !== 'ecaz' ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker ||
    game.ecazTreachery || game.semutaPreview || game.advancedPreview ||
    game.kullPreview || game.nexusKullPreview || game.guildBetrayalPreview ||
    game.richeseBetrayalPreview || game.nexusIxianReplacementPreview ||
    game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview) return false;
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
