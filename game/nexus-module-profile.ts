import { FACTIONS } from './catalog';
import type { FactionModuleProfile } from './faction-module-profile';

/** Public classic configuration only; the initializer checks undealt physical components. */
export function classicNexusModulesProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || !game.nexusCards ||
    (!game.techTokens && !game.strongholdCards) || game.expansions.length !== 0 ||
    game.players.length < 2 || game.players.length > 6 ||
    (game.techTokens && game.players.length < 3) ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills || game.homeworlds ||
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
