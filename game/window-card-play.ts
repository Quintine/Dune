import { harvesterAvailable } from './cards';

export type WindowCardEffect = 'weather' | 'atomics' | 'harvester';
export type WindowCardOpportunity = { effect: WindowCardEffect; source: string; turn: number };
export type WindowCardGame = {
  status: string;
  phase: number;
  turn: number;
  shieldWallDestroyed: boolean;
  stormCardWindowOpen?: boolean;
  stormResolution?: unknown;
  spiceWindow?: {
    event?: string;
    territory: string;
    sector: number;
    harvested: boolean;
    harvesters?: number;
    harvesterClosed?: boolean;
  } | null;
  response?: unknown;
  decision?: unknown;
  phaseOpening?: unknown;
  truthtrance?: unknown;
};

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Original global window only. Temporary modal priority, actual card custody,
 * force conditions and chosen effect parameters remain native engine rules. */
export function windowCardOpportunity(game: WindowCardGame, effect: WindowCardEffect): WindowCardOpportunity | null {
  if (game.status !== 'playing' || !whole(game.turn) || game.turn < 1) return null;
  if (effect === 'weather' || effect === 'atomics') {
    if (game.phase !== 0 || game.stormResolution || game.stormCardWindowOpen === false ||
      game.stormCardWindowOpen !== undefined && typeof game.stormCardWindowOpen !== 'boolean' ||
      effect === 'atomics' && game.shieldWallDestroyed !== false) return null;
    return { effect, source: `storm:${game.turn}`, turn: game.turn };
  }
  if (effect !== 'harvester' || game.phase !== 1) return null;
  const blow = game.spiceWindow;
  if (!blow || !identifier(blow.territory) || !whole(blow.sector) || typeof blow.harvested !== 'boolean' ||
    blow.harvesters !== undefined && !whole(blow.harvesters) ||
    blow.harvesterClosed !== undefined && typeof blow.harvesterClosed !== 'boolean' || !harvesterAvailable(blow)) return null;
  if (blow.event !== undefined && !identifier(blow.event)) return null;
  return { effect, source: blow.event ?? `legacy-spice-blow:${game.turn}:${blow.territory}:${blow.sector}`, turn: game.turn };
}
