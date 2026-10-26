import { nativePromiseScopeSupported, type NativePromiseScope } from './native-promise-scope';

export type RevivalClaim = { turn: number; counter: 'total' | 'normal' | 'elite'; minimum: number };
export type RevivalPromise = RevivalClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  /** Physical ordinary force returns after this answer, excluding prior returns. */
  progress: number;
  fulfilled?: boolean;
  released?: boolean;
};
type RevivalGroup = { amount: number; elite: number };

export class RevivalPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevivalPromiseError';
  }
}

export function parseRevivalClaim(value: unknown): RevivalClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RevivalPromiseError('Choose a current-turn ordinary force-revival question.');
  const input = value as Record<string, unknown>;
  if (typeof input.turn !== 'number' || !Number.isSafeInteger(input.turn) || input.turn < 1 ||
    (input.counter !== 'total' && input.counter !== 'normal' && input.counter !== 'elite') ||
    typeof input.minimum !== 'number' || !Number.isSafeInteger(input.minimum) ||
    input.minimum < 1 || input.minimum > 20)
    throw new RevivalPromiseError('Choose the current turn, physical counter type and a whole revival minimum from 1 to 20.');
  return { turn: input.turn, counter: input.counter, minimum: input.minimum };
}

/** The original bare native scope is unchanged. Timing, allowance, payment,
 * typed Tanks and actual ordinary-return sources remain the engine's rules. */
export function revivalPromiseModeSupported(game: NativePromiseScope & {
  semutaPreview?: unknown; kullPreview?: unknown; nexusKullPreview?: unknown;
  richeseBetrayalPreview?: unknown;
}): boolean {
  return nativePromiseScopeSupported(game) && !game.semutaPreview && !game.kullPreview &&
    !game.nexusKullPreview && !game.richeseBetrayalPreview;
}

export function revivalClaimText(claim: RevivalClaim): string {
  const counters = claim.counter === 'total' ? 'physical forces' :
    claim.counter === 'normal' ? 'normal forces' : 'elite forces';
  return `revive at least ${claim.minimum} ${counters} through ordinary force revival from now until your Revival opportunity ends this turn`;
}

export function liveRevivalPromises(promises: readonly RevivalPromise[], player: string, turn: number): RevivalPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function validateGroup(group: RevivalGroup): void {
  if (!group || typeof group !== 'object' || Array.isArray(group) ||
    !Number.isSafeInteger(group.amount) || group.amount < 0 || group.amount > 20 ||
    !Number.isSafeInteger(group.elite) || group.elite < 0 || group.elite > group.amount)
    throw new RevivalPromiseError('Retain a physical revival group of up to 20 forces with its actual elite count.');
}

/** Each elite is one physical counter. Its battle strength is irrelevant. */
export function revivalPromiseCount(claim: RevivalClaim, group: RevivalGroup): number {
  const parsed = parseRevivalClaim(claim);
  validateGroup(group);
  return parsed.counter === 'total' ? group.amount : parsed.counter === 'normal' ? group.amount - group.elite : group.elite;
}

/** Provisional cumulative composition: only the caller's actual ordinary force
 * return commits progress. Special revivals, leaders and previous returns do
 * not call this function. A No cap applies across split requests as well. */
export function recordPromisedRevival(promises: readonly RevivalPromise[], player: string, turn: number,
  group: RevivalGroup): RevivalPromise[] {
  validateGroup(group);
  const live = liveRevivalPromises(promises, player, turn);
  const progress = new Map<RevivalPromise, number>();
  for (const promise of live) {
    const next = promise.progress + revivalPromiseCount(promise, group);
    if (!Number.isSafeInteger(next) || next > 20)
      throw new RevivalPromiseError('The revival commitment exceeds its physical progress limit.');
    if (!promise.answer && next >= promise.minimum)
      throw new RevivalPromiseError('This ordinary revival conflicts with your cumulative Truthtrance No answer.');
    progress.set(promise, next);
  }
  return promises.map(promise => {
    const next = progress.get(promise);
    return next === undefined || next === promise.progress ? promise : {
      ...promise, progress: next,
      ...(promise.answer && next >= promise.minimum ? { fulfilled: true } : {}),
    };
  });
}

/** Test final additional ordinary returns, including none, against every live
 * answer together. This does not grant the quoted returns or mutate progress. */
export function revivalPromisesSatisfied(promises: readonly RevivalPromise[], player: string, turn: number,
  group: RevivalGroup): boolean {
  validateGroup(group);
  return liveRevivalPromises(promises, player, turn).every(promise => {
    const next = promise.progress + revivalPromiseCount(promise, group);
    return Number.isSafeInteger(next) && next <= 20 && (next >= promise.minimum) === promise.answer;
  });
}

const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

export function validateRevivalPromises(promises: readonly RevivalPromise[], players: readonly string[]): void {
  if (!Array.isArray(promises)) throw new RevivalPromiseError('The revival commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parseRevivalClaim(promise);
    if (!identifier(promise.event) || events.has(promise.event) ||
      !identifier(promise.player) || !identifier(promise.asker) ||
      !players.includes(promise.player) || !players.includes(promise.asker) || promise.player === promise.asker ||
      typeof promise.answer !== 'boolean' || !Number.isSafeInteger(promise.progress) ||
      promise.progress < 0 || promise.progress > 20 ||
      !optionalBoolean(promise.fulfilled) || !optionalBoolean(promise.released) ||
      (promise.fulfilled && promise.released) ||
      (!promise.answer && promise.progress >= promise.minimum) ||
      (promise.answer && !promise.released && !!promise.fulfilled !== (promise.progress >= promise.minimum)))
      throw new RevivalPromiseError('The revival commitment lost its event, participants or cumulative answer progress.');
    events.add(promise.event);
  }
}
