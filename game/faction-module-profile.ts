import { FACTIONS } from './catalog';

/** Public lobby configuration only; physical freshness is checked by the initializer. */
export type FactionModuleProfile = {
  advanced: boolean;
  expansions: readonly string[];
  players: readonly { faction: string }[];
  techTokens?: unknown;
  strongholdCards?: unknown;
  leaderSkills?: unknown;
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveryEnabled?: unknown;
  discoveries?: unknown;
  discoveryStash?: unknown;
  greatMaker?: unknown;
  ecazTreachery?: unknown;
  semutaPreview?: unknown;
  advancedPreview?: unknown;
  kullPreview?: unknown;
  nexusKullPreview?: unknown;
  guildBetrayalPreview?: unknown;
  richeseBetrayalPreview?: unknown;
  nexusIxianReplacementPreview?: unknown;
  nexusIxianBetrayalPreview?: unknown;
  nexusHarkonnenBetrayalPreview?: unknown;
};

/** Original E1/E2 families or standalone Ecaz/Moritani; no unrelated overlays. */
export function nativeFactionTechProfile(game: FactionModuleProfile): boolean {
  if (typeof game.advanced !== 'boolean' || !game.techTokens ||
    game.players.length < 3 || game.players.length > 6 ||
    game.expansions.length < 1 || game.expansions.length > 2 ||
    (game.strongholdCards && !game.advanced) || game.leaderSkills ||
    game.homeworlds || game.nexusCards || game.discoveryEnabled || game.discoveries ||
    game.discoveryStash || game.greatMaker || game.ecazTreachery ||
    game.semutaPreview || game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.guildBetrayalPreview || game.richeseBetrayalPreview ||
    game.nexusIxianReplacementPreview || game.nexusIxianBetrayalPreview ||
    game.nexusHarkonnenBetrayalPreview) return false;
  const e3 = game.expansions.length === 1 && game.expansions[0] === 'ecaz';
  if (!e3) {
    for (let i = 0; i < game.expansions.length; i++) {
      if (game.expansions[i] !== 'ix' && game.expansions[i] !== 'choam') return false;
      for (let j = 0; j < i; j++) if (game.expansions[i] === game.expansions[j]) return false;
    }
  }
  let native = 0;
  let moritani = false;
  let harkonnen = false;
  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    for (let j = 0; j < i; j++) if (player.faction === game.players[j].faction) return false;
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
  return native > 0 && (!e3 || native === 1) &&
    !(game.advanced && moritani && harkonnen);
}

export type MixedE3NativeRoster = {
  advanced?: boolean;
  expansions: readonly string[];
  players?: readonly { faction: string }[];
};

/** Selected E3 plus E1 and/or E2, with an actual native from every selected family. */
export function mixedE3NexusRosterProfile(game: MixedE3NativeRoster, skills = false): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || !players || players.length < 2 || players.length > 6 ||
    game.expansions.length < 2 || game.expansions.length > 3 || !game.expansions.includes('ecaz'))
    return false;
  for (let i = 0; i < game.expansions.length; i++) {
    const expansion = game.expansions[i];
    if (expansion !== 'ecaz' && expansion !== 'ix' && expansion !== 'choam') return false;
    for (let j = 0; j < i; j++) if (expansion === game.expansions[j]) return false;
  }
  let ix = false, choam = false, e3 = false, moritani = false, harkonnen = false;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    for (let j = 0; j < i; j++) if (player.faction === players[j].faction) return false;
    let family: string | undefined;
    for (const faction of FACTIONS)
      if (faction.id === player.faction) { family = faction.expansion; break; }
    if (family === undefined || (family !== 'base' && !game.expansions.includes(family))) return false;
    if (family === 'ix') ix = true;
    if (family === 'choam') choam = true;
    if (family === 'ecaz') e3 = true;
    if (player.faction === 'moritani') moritani = true;
    if (player.faction === 'harkonnen') harkonnen = true;
  }
  return e3 && ix === game.expansions.includes('ix') && choam === game.expansions.includes('choam') &&
    !(game.advanced && harkonnen && (skills || moritani));
}
