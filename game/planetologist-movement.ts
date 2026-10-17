import { FACTIONS } from './catalog';
import { nativeExpansionLeaderSkillsProfile } from './leader-skill-profile';
import type { Game, GameView, Player } from './engine';
import { splitLocation } from './board';
import { isAdvisor } from './advisors';
import { presenceAt, type ForcePresence } from './force-presence';

type MovementPlayer = Pick<Player, 'id' | 'faction' | 'advisors'> & ForcePresence & {
  moved?: number;
  advisorFlipMovementBlocked?: boolean | { turn: number; move: number };
};
type MovementGame = Pick<Game, 'advanced' | 'turn'> & {
  players: readonly (Pick<Player, 'id'> & ForcePresence)[];
};
type AdvisorGatherEntry = Readonly<{ requiresFlip: boolean; blocked: string | null }>;
const noAdvisorGather: AdvisorGatherEntry = { requiresFlip: false, blocked: null };
const fighterAdvisorGather: AdvisorGatherEntry = { requiresFlip: true, blocked: null };
const freshAdvisorGather: AdvisorGatherEntry = {
  requiresFlip: true, blocked: 'Fresh spiritual advisors cannot become fighters during this turn.',
};
const canceledAdvisorGather: AdvisorGatherEntry = {
  requiresFlip: true, blocked: 'Advisor flipping was canceled for this movement. Choose a legal replacement without flipping advisors.',
};

/** The canceled native flip stays unavailable for this movement opportunity. */
export function advisorFlipMovementBlocked(game: Pick<Game, 'turn'>, player: MovementPlayer): boolean {
  const blocked = player.advisorFlipMovementBlocked;
  return typeof blocked === 'boolean' ? blocked :
    blocked?.turn === game.turn && blocked.move === player.moved;
}

/** Provisional simultaneous gather: declare one common fighter arrival before
 * either source moves; native cancellation keeps both original groups in place. */
export function planetologistGatherAdvisorEntry(game: MovementGame, player: MovementPlayer,
  origins: readonly string[], destination: string): AdvisorGatherEntry {
  if (!game.advanced || player.faction !== 'beneGesserit' || origins.length !== 2 ||
      isAdvisor(player, origins[0]) === isAdvisor(player, origins[1]) ||
      presenceAt(player, destination) ||
      !game.players.some(other => other.id !== player.id && presenceAt(other, destination)))
    return noAdvisorGather;
  if (origins.some(origin => player.advisors?.[origin]?.lockedTurn === game.turn))
    return freshAdvisorGather;
  return advisorFlipMovementBlocked(game, player) ? canceledAdvisorGather : fighterAdvisorGather;
}
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
  group: readonly (readonly [string, number])[],
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

/** Keep the existing classic-roster boundary and add supported native factions. */
export function planetologistMovementModeSupported(game: Game | GameView): boolean {
  return game.players.every(player => FACTIONS.some(f => f.id === player.faction && f.expansion === 'base')) ||
    nativeExpansionLeaderSkillsProfile(game);
}
