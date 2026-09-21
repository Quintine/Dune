import { FACTIONS } from './catalog';
import { basicExpansionLeaderSkillsProfile } from './leader-skill-profile';
import type { Game, GameView } from './engine';
import { splitLocation } from './board';

export type PlanetologistMoveMode = 'range' | 'gather';
export type PlanetologistMovement = {
  leader: string;
  mode: PlanetologistMoveMode;
};

/** Public component ownership suffices; a captive never grants the upper band. */
export function planetologistLeader(
  g: Game | GameView,
  player: string,
): string | null {
  const assignment = g.leaderSkills?.assignments.find(
    (a) => a.owner === player && a.skill === 'planetologist',
  );
  if (
    !assignment ||
    ('controller' in assignment && assignment.controller !== player) ||
    ('faceUp' in assignment && assignment.faceUp === false)
  )
    return null;
  const leader = g.players
    .find((p) => p.id === player)
    ?.leaders.find((l) => l.id === assignment.leader);
  if (!leader || leader.dead || leader.capturedBy || leader.gholaBy)
    return null;
  return leader.id;
}

/** The cap belongs to the extra-range alternative, not the two-origin one. */
export function planetologistRange(
  base: number,
  mode?: PlanetologistMoveMode,
): number {
  return mode === 'range' ? Math.min(3, base + 1) : base;
}

/** Cyborgs accompany selected sectors of their own origin, never another origin. */
export function selectedOriginElites(
  group: readonly [string, number][],
  elites: Readonly<Record<string, number>>,
  origin: string,
): number {
  return group.reduce((total, [key, count]) => total +
    (count > 0 && splitLocation(key).territory === origin ? (elites[key] ?? 0) : 0), 0);
}

/** Native movement and the independently retained Planetologist range share one calculation. */
export function groundMovementRange(
  options: {
    faction: string;
    cityOrnithopters: boolean;
    selectedElites: number;
    nativeBlocked: boolean;
    choamBonus?: number;
  },
  mode?: PlanetologistMoveMode,
): number {
  const base = options.cityOrnithopters ? 3 :
    !options.nativeBlocked && (options.faction === 'fremen' ||
      (options.faction === 'ixians' && options.selectedElites > 0)) ? 2 : 1;
  return planetologistRange(base + (options.choamBonus ?? 0), mode);
}

/** Keep the existing base-roster boundary and add the connected Basic Moritani profile. */
export function planetologistMovementModeSupported(game: Game | GameView): boolean {
  return game.players.every(player => FACTIONS.some(f => f.id === player.faction && f.expansion === 'base')) ||
    basicExpansionLeaderSkillsProfile(game);
}
