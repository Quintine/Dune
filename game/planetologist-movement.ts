import { FACTIONS } from './catalog';
import { basicMoritaniLeaderSkillsProfile } from './leader-skill-profile';
import type { Game, GameView } from './engine';

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

/** Keep the existing base-roster boundary and add the connected Basic Moritani profile. */
export function planetologistMovementModeSupported(game: Game | GameView): boolean {
  return game.players.every(player => FACTIONS.some(f => f.id === player.faction && f.expansion === 'base')) ||
    basicMoritaniLeaderSkillsProfile(game);
}
