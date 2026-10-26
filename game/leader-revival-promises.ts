export { revivalPromiseModeSupported as leaderRevivalPromiseModeSupported } from './revival-promises';

export type LeaderRevivalClaim = { turn: number; leader: string };
export type LeaderRevivalPromise = LeaderRevivalClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};

export class LeaderRevivalPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaderRevivalPromiseError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

export function parseLeaderRevivalClaim(value: unknown): LeaderRevivalClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new LeaderRevivalPromiseError('Choose a current-turn named leader-revival question.');
  const input = value as Record<string, unknown>;
  if (typeof input.turn !== 'number' || !Number.isSafeInteger(input.turn) || input.turn < 1 || !identifier(input.leader))
    throw new LeaderRevivalPromiseError('Choose the current turn and exact leader identity.');
  return { turn: input.turn, leader: input.leader };
}

export function leaderRevivalClaimText(claim: LeaderRevivalClaim,
  leaderName: (id: string) => string = id => id === 'kwisatz' ? 'Kwisatz Haderach' : id): string {
  return `revive ${leaderName(claim.leader)} through ordinary leader revival from now until your Revival opportunity ends this turn`;
}

export function liveLeaderRevivalPromises(promises: readonly LeaderRevivalPromise[], player: string,
  turn: number): LeaderRevivalPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

/** Distinct required identities are not a grant of additional native slots.
 * The engine's joint Revival quote owns allowance, custody, price and order. */
export function leaderRevivalRequirements(promises: readonly LeaderRevivalPromise[], player: string,
  turn: number): { required: string[]; forbidden: string[] } | null {
  const required = new Set<string>(), forbidden = new Set<string>();
  for (const promise of liveLeaderRevivalPromises(promises, player, turn))
    (promise.answer ? required : forbidden).add(promise.leader);
  if ([...required].some(leader => forbidden.has(leader))) return null;
  return { required: [...required], forbidden: [...forbidden] };
}

/** Proposed final future ordinary returns, not currently living leaders or
 * historical deaths. No remains binding across other nonmatching returns. */
export function leaderRevivalPromisesSatisfied(promises: readonly LeaderRevivalPromise[], player: string,
  turn: number, returned: readonly string[]): boolean {
  return liveLeaderRevivalPromises(promises, player, turn)
    .every(promise => returned.includes(promise.leader) === promise.answer);
}

/** Provisional named future-return composition. The actual ordinary-return
 * caller owns source semantics, including the native KH token. Declaration,
 * prevention, special/card returns and income do not count as this event. */
export function recordPromisedLeaderRevival(promises: readonly LeaderRevivalPromise[], player: string,
  turn: number, leader: string): LeaderRevivalPromise[] {
  if (!identifier(leader)) throw new LeaderRevivalPromiseError('Retain the exact returned leader identity.');
  const matching = liveLeaderRevivalPromises(promises, player, turn).filter(promise => promise.leader === leader);
  if (matching.some(promise => !promise.answer))
    throw new LeaderRevivalPromiseError('This ordinary leader revival conflicts with your Truthtrance No answer.');
  return promises.map(promise => matching.includes(promise) ? { ...promise, fulfilled: true } : promise);
}

/** Identity eligibility and historical physical membership remain native
 * rules. This validates the ledger's public event and actual participants. */
export function validateLeaderRevivalPromises(promises: readonly LeaderRevivalPromise[], players: readonly string[]): void {
  if (!Array.isArray(promises)) throw new LeaderRevivalPromiseError('The named leader-revival commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parseLeaderRevivalClaim(promise);
    if (!identifier(promise.event) || events.has(promise.event) ||
      !identifier(promise.player) || !identifier(promise.asker) ||
      !players.includes(promise.player) || !players.includes(promise.asker) || promise.player === promise.asker ||
      typeof promise.answer !== 'boolean' || !optionalBoolean(promise.fulfilled) || !optionalBoolean(promise.released) ||
      promise.fulfilled && promise.released)
      throw new LeaderRevivalPromiseError('The named leader-revival commitment lost its event or participants.');
    events.add(promise.event);
  }
}
