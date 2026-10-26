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
  sandtrout?: unknown;
  spiceBankerIncomePreview?: unknown;
  semutaPreview?: unknown;
  advancedPreview?: unknown;
  kullPreview?: unknown;
  nexusKullPreview?: unknown;
  guildBetrayalPreview?: unknown;
  richeseBetrayalPreview?: unknown;
  nexusIxianReplacementPreview?: unknown;
  nexusIxianBetrayalPreview?: unknown;
  nexusHarkonnenBetrayalPreview?: unknown;
  /** Native runtime stamps, not independent optional-module selections. */
  ecazOccupyPreview?: unknown;
  moritaniAssassinatePreview?: unknown;
};

type NexusCoreConfiguration = Partial<FactionModuleProfile> & Pick<FactionModuleProfile, 'expansions'> & {
  sandtrout?: unknown; moritaniAssassinatePreview?: unknown;
};

/** Classic Nexus12 with selected base33/independent36, optional all14, original
 * Homeworlds and phase modules. Native effect stamps are not selected overlays. */
export function classicNexusCoreProfile(game: NexusCoreConfiguration): boolean {
  return nexusCoreRosterProfile(game, false);
}

/** Selected expansion decks with the independent three-card variant. A deck selection
 * does not require seating its native faction. Original optional modules compose. */
export function selectedIndependentNexusProfile(game: NexusCoreConfiguration): boolean {
  return game.ecazTreachery === true && game.expansions.length > 0 && nexusCoreRosterProfile(game, true);
}

/** Independent Discovery composes selected decks and original optional modules.
 * Nexus remains optional; live tokens and encounters are runtime state, not selections. */
export function independentDiscoveryProfile(game: NexusCoreConfiguration): boolean {
  return game.ecazTreachery === true && game.discoveryEnabled === true &&
    nexusCoreRosterProfile(game, true, true);
}

export function independentDiscoveryNexusProfile(game: NexusCoreConfiguration): boolean {
  return !!game.nexusCards && independentDiscoveryProfile(game);
}

/** Common consumers of the classic and selected-independent fresh Nexus core. */
export function nexusCoreProfile(game: NexusCoreConfiguration): boolean {
  return classicNexusCoreProfile(game) || selectedIndependentNexusProfile(game) ||
    independentDiscoveryNexusProfile(game);
}

function nexusCoreRosterProfile(game: NexusCoreConfiguration, selectedDecks: boolean, discovery = false): boolean {
  const players = game.players;
  if (typeof game.advanced !== 'boolean' || (!discovery && !game.nexusCards) ||
    !players || players.length < (game.techTokens ? 3 : 2) || players.length > 6 ||
    (game.strongholdCards && !game.advanced) ||
    (!discovery && (game.discoveryEnabled || game.discoveries || game.discoveryStash || game.greatMaker)) ||
    game.semutaPreview || game.advancedPreview || game.kullPreview || game.nexusKullPreview ||
    game.richeseBetrayalPreview ||
    (!game.nexusCards && (game.guildBetrayalPreview || game.nexusIxianReplacementPreview ||
      game.nexusIxianBetrayalPreview || game.nexusHarkonnenBetrayalPreview)) ||
    (game.moritaniAssassinatePreview && (!selectedDecks || !game.advanced ||
      !players.some(player => player.faction === 'moritani'))) ||
    (game.nexusIxianBetrayalPreview && (!selectedDecks || !players.some(player => player.faction === 'ixians')))) return false;
  if (selectedDecks) {
    if (game.expansions.length > 3) return false;
    for (let i = 0; i < game.expansions.length; i++) {
      if (game.expansions[i] !== 'ix' && game.expansions[i] !== 'choam' && game.expansions[i] !== 'ecaz') return false;
      for (let j = 0; j < i; j++) if (game.expansions[j] === game.expansions[i]) return false;
    }
    // Public training and hidden Harkonnen capture still need their own native
    // E3 custody composition. Selecting unused E3 cards does not add that case.
    if (game.advanced && game.leaderSkills && players.some(player => player.faction === 'harkonnen') &&
      players.some(player => player.faction === 'ecaz' || player.faction === 'moritani')) return false;
  } else if (game.expansions.length !== 0) return false;
  for (let i = 0; i < players.length; i++) {
    for (let j = 0; j < i; j++) if (players[j].faction === players[i].faction) return false;
    let permitted = false;
    for (const faction of FACTIONS)
      if (faction.id === players[i].faction) {
        permitted = faction.expansion === 'base' || (selectedDecks && game.expansions.includes(faction.expansion));
        break;
      }
    if (!permitted) return false;
  }
  return true;
}

/** Card consumers require the actual independent-variant selection. */
export function classicIndependentNexusProfile(game: NexusCoreConfiguration): boolean {
  return game.ecazTreachery === true && classicNexusCoreProfile(game);
}

export function independentNexusProfile(game: NexusCoreConfiguration): boolean {
  return game.ecazTreachery === true && nexusCoreProfile(game);
}

/** Selected decks do not require their native factions to be seated. This is
 * roster validity only; each phase module retains its own mode and seat limits. */
export function selectedPhaseModuleRoster(
  game: Pick<FactionModuleProfile, 'expansions' | 'players'>,
): boolean {
  if (!game || typeof game !== 'object' || !Array.isArray(game.expansions) ||
    game.expansions.length < 1 || game.expansions.length > 3 ||
    !game.expansions.every(id => id === 'ix' || id === 'choam' || id === 'ecaz') ||
    new Set(game.expansions).size !== game.expansions.length ||
    !Array.isArray(game.players) || game.players.length < 2 || game.players.length > 6) return false;
  const seated = new Set<string>();
  for (const player of game.players) {
    if (!player || typeof player !== 'object' || Array.isArray(player) ||
      typeof player.faction !== 'string' || seated.has(player.faction)) return false;
    const faction = FACTIONS.find(faction => faction.id === player.faction);
    if (!faction || (faction.expansion !== 'base' && !game.expansions.includes(faction.expansion))) return false;
    seated.add(player.faction);
  }
  return true;
}

/** Keep unrelated overlays outside this phase-only permission. Semuta's caller
 * additionally retains its old roster envelope below, rather than inheriting
 * new selected-family admission through its explicit context flag. */
function phaseModuleContext(game: FactionModuleProfile, semuta = false, independent = false): boolean {
  return typeof game.advanced === 'boolean' &&
    !(game.strongholdCards && !game.advanced) && !game.leaderSkills &&
    !game.homeworlds && !game.nexusCards && !game.discoveryEnabled && !game.discoveries &&
    !game.discoveryStash && !game.greatMaker && (independent ? game.ecazTreachery === true : !game.ecazTreachery) &&
    (!game.semutaPreview || (semuta && game.semutaPreview === true)) &&
    !game.advancedPreview && !game.kullPreview && !game.nexusKullPreview &&
    !game.guildBetrayalPreview && !game.richeseBetrayalPreview &&
    !game.nexusIxianReplacementPreview && !game.nexusIxianBetrayalPreview &&
    !game.nexusHarkonnenBetrayalPreview;
}

/** Exact earlier E1/E2 or one-E3-native scope for existing Semuta consumers. */
function legacySemutaTechRoster(game: FactionModuleProfile): boolean {
  if (!Array.isArray(game.players) || game.players.length < 3 || game.players.length > 6 ||
    !Array.isArray(game.expansions) || game.expansions.length < 1 || game.expansions.length > 2) return false;
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
    if (!player || typeof player !== 'object') return false;
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

/** Tech-only Basic/Advanced or original Advanced Strongholds at three-six seats.
 * Explicit Semuta validation keeps its earlier family/native/Harkonnen scope. */
export function nativeFactionTechProfile(game: FactionModuleProfile, semuta = false): boolean {
  return !!game && phaseModuleContext(game, semuta) && !!game.techTokens &&
    (semuta ? legacySemutaTechRoster(game) :
      selectedPhaseModuleRoster(game) && game.players.length >= 3);
}

/** Clean selected-deck Strongholds. The original initializer may create their
 * unused state when absent; physical freshness and native stamps stay external. */
export function selectedFactionStrongholdProfile(game: FactionModuleProfile): boolean {
  return !!game && game.advanced === true && phaseModuleContext(game) &&
    selectedPhaseModuleRoster(game) && (!game.techTokens || game.players.length >= 3);
}

/** Independent physical cards with optional original phase modules. This is a
 * selected-deck permission; base-only, World and trained compositions retain
 * their separate original profiles and physical freshness stays external. */
export function selectedIndependentCardsProfile(game: FactionModuleProfile): boolean {
  if (!game || game.ecazTreachery !== true ||
    !selectedPhaseModuleRoster(game) || !phaseModuleContext(game, false, true) ||
    (game.techTokens && game.players.length < 3) || game.sandtrout || game.spiceBankerIncomePreview) return false;
  return (!game.ecazOccupyPreview || game.ecazOccupyPreview === true &&
      game.players.some(player => player.faction === 'ecaz')) &&
    (!game.moritaniAssassinatePreview || game.moritaniAssassinatePreview === true && game.advanced &&
      game.players.some(player => player.faction === 'moritani'));
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
  let ix = false, choam = false, e3 = false, harkonnen = false;
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
    if (player.faction === 'harkonnen') harkonnen = true;
  }
  return e3 && ix === game.expansions.includes('ix') && choam === game.expansions.includes('choam') &&
    !(game.advanced && harkonnen && skills);
}
