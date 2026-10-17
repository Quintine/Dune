import { pairedE3NexusProfile, pairedNexusModulesProfile } from '../game/nexus-module-profile';
import type { DatabaseSync } from 'node:sqlite';
import {
  initializeIxGameForAudit,
  initializeDiscoveryGameForAudit,
  initializeHomeworldOccupationGameForAudit,
  initializeLeaderSkillsGameForAudit,
  initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit,
  initializeNexusGameForAudit,
  initializePairedNexusGameForAudit,
  initializeMoritaniAssassinateGameForAudit,
  initializeEcazTreacheryGameForAudit,
  initializeEcazOccupyGameForAudit,
  initializeSemutaGameForAudit,
  initializeKullGameForAudit,
  initializeRicheseBetrayalGameForAudit,
  initializeNexusKullGameForAudit,
  initializeGuildBetrayalGameForAudit,
  initializeGuildBetrayalLeaderSkillsGameForAudit,
  initializeIxianNexusReplacementGameForAudit,
  initializeIxianNexusBetrayalGameForAudit,
  initializeHarkonnenNexusBetrayalGameForAudit,
  viewGame,
  type Game,
} from '../game/engine';

export const PROTOTYPE_PROFILES = [
  'ix',
  'discovery',
  'homeworld-occupation',
  'leader-skills',
  'factions',
  // Advanced selected native families or standalone E3; optional Tech requires 3+ seats.
  'stronghold-factions',
  'nexus',
  'moritani-assassinate',
  'ecaz-treachery',
  'ecaz-occupy',
  'semuta',
  'kull',
  'richese-betrayal',
  'nexus-kull',
  'guild-betrayal',
  'ixian-replacement',
  'ixian-betrayal',
  'harkonnen-betrayal',
] as const;
export type PrototypeProfile = (typeof PROTOTYPE_PROFILES)[number];
export type PrototypeOptions = {
  /** Explicit independent card variant for the fresh combined-army profile. */
  ecazTreachery?: boolean;
  /** Independent original Nexus composition with Skills or Semuta, not public activation. */
  nexusCards?: boolean;
  /** Explicit original Discovery composition with Skills, Nexus or Semuta; no public activation. */
  discoveries?: boolean;
  /** Explicit original skills with Semuta, classic occupation or Guild Betrayal. */
  leaderSkills?: boolean;
  /** Original Skills/Semuta composition or classic independent-card Homeworlds. */
  homeworlds?: boolean;
};
export function isPrototypeProfile(value: string): value is PrototypeProfile {
  return PROTOTYPE_PROFILES.some((profile) => profile === value);
}

/** Local development only. This cannot create a seat, change its owner, or
 * redeal a started game. The caller backs up the database before invoking it. */
export function startIxPrototypeRoom(
  db: DatabaseSync,
  code: string,
  expectedVersion: number,
) {
  return startPrototypeRoom(db, code, expectedVersion, 'ix');
}
export function startPrototypeRoom(
  db: DatabaseSync,
  code: string,
  expectedVersion: number,
  profile: PrototypeProfile,
  options: PrototypeOptions = {},
) {
  if (
    !/^[A-Z0-9]{8}$/.test(code) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  )
    throw new Error('Provide an eight-character room and its current version.');
  const row = db
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(code);
  if (!row || typeof row.state !== 'string' || row.version !== expectedVersion)
    throw new Error(
      'The room is missing or changed. Refresh before starting the prototype.',
    );
  const initial = JSON.parse(row.state) as Game;
  if (initial.code !== code)
    throw new Error('The room identity is inconsistent.');
  if (!isPrototypeProfile(profile))
    throw new Error('Unknown prototype profile.');
  if (options.ecazTreachery && profile !== 'ecaz-occupy' && profile !== 'leader-skills')
    throw new Error('--ecaz-treachery requires the ecaz-occupy or leader-skills profile.');
  if (options.nexusCards && profile !== 'leader-skills' && profile !== 'semuta')
    throw new Error('--nexus-cards requires the leader-skills or semuta profile.');
  if (options.discoveries && profile !== 'leader-skills' && profile !== 'nexus' && profile !== 'semuta')
    throw new Error('--discoveries requires the leader-skills, nexus or semuta profile.');
  if (options.leaderSkills && profile !== 'semuta' && profile !== 'homeworld-occupation' && profile !== 'guild-betrayal')
    throw new Error('--leader-skills requires the semuta, homeworld-occupation or guild-betrayal profile.');
  if (options.homeworlds && profile !== 'semuta' && profile !== 'leader-skills' && profile !== 'ecaz-treachery')
    throw new Error('--homeworlds requires the semuta, leader-skills or ecaz-treachery profile.');
  if (options.ecazTreachery) initial.ecazTreachery = true;
  if ((profile === 'nexus' || options.nexusCards) && !initial.nexusCards)
    initial.nexusCards = { cards: null, phase: null };
  if (options.discoveries) initial.discoveryEnabled = true;
  if (options.homeworlds) initial.homeworlds ??= { custody: null };
  const game =
    profile === 'ix'
      ? initializeIxGameForAudit(initial)
      : profile === 'homeworld-occupation'
        ? initializeHomeworldOccupationGameForAudit({
            ...initial,
            homeworlds: initial.homeworlds ?? { custody: null },
          }, options.leaderSkills)
      : profile === 'stronghold-factions'
        ? initializeStrongholdFactionsGameForAudit(initial)
      : profile === 'ecaz-treachery'
        ? initializeEcazTreacheryGameForAudit(initial)
      : profile === 'ecaz-occupy'
        ? initializeEcazOccupyGameForAudit(initial)
      : profile === 'moritani-assassinate'
        ? initializeMoritaniAssassinateGameForAudit(initial)
      : profile === 'semuta'
        ? initializeSemutaGameForAudit(initial, options.leaderSkills)
      : profile === 'kull'
        ? initializeKullGameForAudit(initial)
      : profile === 'richese-betrayal'
        ? initializeRicheseBetrayalGameForAudit({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'nexus-kull'
        ? initializeNexusKullGameForAudit({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'guild-betrayal'
        ? (options.leaderSkills ? initializeGuildBetrayalLeaderSkillsGameForAudit : initializeGuildBetrayalGameForAudit)({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'ixian-replacement'
        ? initializeIxianNexusReplacementGameForAudit({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'ixian-betrayal'
        ? initializeIxianNexusBetrayalGameForAudit({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'harkonnen-betrayal'
        ? initializeHarkonnenNexusBetrayalGameForAudit({
            ...initial,
            nexusCards: initial.nexusCards ?? { cards: null, phase: null },
          })
      : profile === 'factions'
        ? initializeFactionExpansionsGameForAudit(initial)
        : profile === 'nexus'
          ? pairedNexusModulesProfile(initial) || pairedE3NexusProfile(initial)
            ? initializePairedNexusGameForAudit(initial)
            : initializeNexusGameForAudit(initial)
          : profile === 'leader-skills'
            ? initializeLeaderSkillsGameForAudit(initial)
            : initializeDiscoveryGameForAudit({
                ...initial,
                discoveryEnabled: true,
              });
  // Exercise the same player projection before accepting the new saved state.
  for (const player of game.players) viewGame(game, player.id);
  const version = expectedVersion + 1;
  game.version = version;
  const result = db
    .prepare(
      'UPDATE rooms SET state = ?, version = ?, updated_at = ? WHERE code = ? AND version = ? AND state = ?',
    )
    .run(
      JSON.stringify(game),
      version,
      Date.now(),
      code,
      expectedVersion,
      row.state,
    );
  if (result.changes !== 1)
    throw new Error('The lobby changed during setup. No prototype was saved.');
  return {
    code,
    version,
    status: game.status,
    advanced: game.advanced,
    players: game.players.length,
  };
}
