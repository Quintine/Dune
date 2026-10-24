import { TERRITORIES, territory } from './board';
import { FACTIONS } from './catalog';
import type { Game } from './engine';

/** One qualifying ground movement, never the sum of several smaller groups. */
export type MovementClaim = { territory: string; minimum: number };
export type MovementEvent = { territory: string; amount: number };
export type MovementPromise = MovementClaim & {
  turn: number;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
export class MovementClaimError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new MovementClaimError(message);
}

/** Extract claim fields; the caller validates surrounding question/ledger keys. */
export function parseMovementClaim(value: unknown): MovementClaim {
  check(value && typeof value === 'object' && !Array.isArray(value),
    'Choose a valid ground-movement statement.');
  const claim = value as Record<string, unknown>;
  check(typeof claim.territory === 'string' &&
    TERRITORIES.some(destination => destination.id === claim.territory),
  'Choose a printed ground-movement destination.');
  check(typeof claim.minimum === 'number' && Number.isSafeInteger(claim.minimum) &&
    claim.minimum >= 1 && claim.minimum <= 20,
  'Choose a minimum of one to twenty physical forces.');
  return { territory: claim.territory, minimum: claim.minimum };
}
export function validMovementClaim(value: unknown): value is MovementClaim {
  try { parseMovementClaim(value); return true; }
  catch (error) {
    if (error instanceof MovementClaimError) return false;
    throw error;
  }
}
export function movementClaimText(claim: MovementClaim): string {
  return `make a ground movement of at least ${claim.minimum} physical forces to ${territory(claim.territory).name}`;
}
export function movementMatches(claim: MovementClaim, event: MovementEvent | null): boolean {
  return event !== null && event.territory === claim.territory &&
    Number.isSafeInteger(event.amount) && event.amount >= claim.minimum && event.amount <= 20;
}
export function liveMovementPromises<T extends MovementPromise>(
  promises: readonly T[], player: string, turn: number,
): T[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

/** The caller supplies the relevant current promises. Yes is existential: a
 * nonmatching event may be followed by another ordinary movement opportunity. */
export function movementEventAllowed(
  promises: readonly MovementPromise[], event: MovementEvent | null,
): boolean {
  return promises.every(promise => promise.fulfilled || promise.released ||
    promise.answer || !movementMatches(promise, event));
}
export function settleMovementEvent<T extends MovementPromise>(
  promises: readonly T[], player: string, turn: number, event: MovementEvent | null,
): T[] {
  const live = liveMovementPromises(promises, player, turn);
  check(movementEventAllowed(live, event),
    'This ground movement would break an accepted No answer.');
  return promises.map(promise => live.includes(promise) && promise.answer && movementMatches(promise, event)
    ? { ...promise, fulfilled: true } : promise);
}

/** Close only the actual player's movement turn. No stays binding until here;
 * ending early cannot evade an unfulfilled Yes, even if this event was skipped. */
export function finishMovementPromises<T extends MovementPromise>(
  promises: readonly T[], player: string, turn: number,
): T[] {
  const live = liveMovementPromises(promises, player, turn);
  check(live.every(promise => !promise.answer),
    'Complete your accepted ground-movement promise before ending movement.');
  return promises.map(promise => live.includes(promise) ? { ...promise, fulfilled: true } : promise);
}

/** Prototype profile/timing only. Actual route feasibility stays authoritative
 * in the engine. Truthtrance and an ordinary active Ornithopter may remain. */
export function movementPromiseModeSupported(g: Game): boolean {
  return g.advanced === false &&
    // Early owned-stage forecasts currently price ordinary classic invoices.
    // Native phase5 coverage does not establish Richese/CHOAM bidding prices.
    (g.phase >= 5 || (!g.expansions.length && g.players.every(player =>
      FACTIONS.find(entry => entry.id === player.faction)?.expansion === 'base'))) &&
    g.players.length >= 2 && g.players.length <= 6 &&
    g.expansions.every(id => ['ix', 'choam', 'ecaz'].includes(id)) &&
    new Set(g.expansions).size === g.expansions.length &&
    g.players.every(candidate => {
      const family = FACTIONS.find(entry => entry.id === candidate.faction)?.expansion;
      return family === 'base' || (!!family && g.expansions.includes(family));
    }) &&
    !g.homeworlds && !g.nexusCards && !g.leaderSkills && !g.techTokens &&
    !g.strongholdCards && !g.discoveryEnabled && !g.discoveries &&
    !g.discoveryStash && !g.greatMaker && !g.ecazTreachery;
}
export function movementPromiseTargetAvailable(g: Game, player: string): boolean {
  const target = g.players.find(candidate => candidate.id === player);
  return movementPromiseModeSupported(g) && g.status === 'playing' &&
    Number.isInteger(g.phase) && g.phase >= 0 && g.phase <= 5 && !!target &&
    (g.phase < 5 || ((g.active === player || (!target.shipped && target.moved === 0)) &&
      !!g.movementRemaining?.includes(player))) &&
    !g.response && !g.decision && !g.phaseOpening &&
    !g.pendingShipment && !g.pendingHomeworldShipment && !g.pendingGuildTransport &&
    !g.pendingAmbassador && !g.pendingTerrorEntry && !g.pendingArrivalOverlap &&
    !g.pendingArrivalReaction?.length && !g.pendingFremenMove && !g.pendingIxMove &&
    !g.pendingChoamMove && !g.pendingTreacheryDiscard;
}
