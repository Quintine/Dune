/** One finite, publicly ordered scope. Remaining includes the current actor first. */
export type OrderedOpportunity = {
  readonly event: string;
  readonly eligible: readonly string[];
  readonly remaining: readonly string[];
  readonly completed: readonly string[];
  readonly current: string | null;
  readonly currentStarted: boolean;
  readonly protectedLast?: string | null;
};
export type OrderedOpportunityRequest = {
  event: string;
  player: string;
  position: 'first' | 'last';
};
export class OrderedOpportunityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderedOpportunityError';
  }
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new OrderedOpportunityError(message);
}
function ids(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string' && id.trim().length > 0) &&
    new Set(value).size === value.length
  );
}
/** Reject corrupt snapshots; never repair them by dropping or restoring a player. */
export function validateOrderedOpportunity(state: OrderedOpportunity): void {
  check(
    state && typeof state === 'object',
    'Choose a valid ordered opportunity.',
  );
  check(
    typeof state.event === 'string' && state.event.trim().length > 0,
    'The ordered opportunity requires a stable event.',
  );
  check(
    ids(state.eligible) && ids(state.remaining) && ids(state.completed),
    'Opportunity participants must be unique, nonempty player IDs.',
  );
  const pending = new Set(state.remaining),
    completed = new Set(state.completed);
  check(
    state.remaining.length + state.completed.length === state.eligible.length &&
      state.eligible.every((id) => pending.has(id) !== completed.has(id)),
    'Remaining and completed players must partition the eligible players exactly.',
  );
  check(
    state.current === (state.remaining[0] ?? null),
    'The current actor must be first in the remaining opportunities.',
  );
  check(
    typeof state.currentStarted === 'boolean' &&
      (!state.currentStarted || state.current !== null),
    'Only an existing current opportunity can have started.',
  );
  check(
    state.protectedLast === undefined ||
      state.protectedLast === null ||
      (typeof state.protectedLast === 'string' &&
        pending.has(state.protectedLast) &&
        state.remaining[state.remaining.length - 1] === state.protectedLast),
    'The protected last player must remain last in this scope.',
  );
}
function snapshot(
  state: OrderedOpportunity,
  remaining = state.remaining,
): OrderedOpportunity {
  return {
    ...state,
    eligible: [...state.eligible],
    completed: [...state.completed],
    remaining: [...remaining],
    current: remaining[0] ?? null,
  };
}
function participant(
  state: OrderedOpportunity,
  request: { event: string; player: string },
) {
  validateOrderedOpportunity(state);
  check(
    request && request.event === state.event,
    'This ordered opportunity has expired.',
  );
  check(
    state.eligible.includes(request.player),
    'The player is not eligible for this opportunity.',
  );
  check(
    !state.completed.includes(request.player),
    'The player already completed this opportunity.',
  );
}
/**
 * Reorder only unstarted units. First means the front of the unstarted remainder,
 * after a locked current unit; last respects existing last-position protection.
 * A card adapter must separately decide whether that boundary fits its rules.
 * This helper grants no additional turn and defines no cyclic/phase duration.
 */
export function reorderOrderedOpportunity(
  state: OrderedOpportunity,
  request: OrderedOpportunityRequest,
): OrderedOpportunity {
  participant(state, request);
  check(
    request.position === 'first' || request.position === 'last',
    'Choose first or last.',
  );
  const { player, position } = request;
  if (state.currentStarted && player === state.current) {
    check(
      position === 'first' || state.remaining.length === 1,
      'Moving this actor would split a started opportunity; that scope is unsupported.',
    );
    return snapshot(state);
  }
  const locked = state.currentStarted ? [state.current!] : [];
  const available = state.remaining.slice(locked.length);
  if (player === state.protectedLast) {
    check(
      position === 'last' || available.length === 1,
      'The protected last player cannot move ahead of other remaining players.',
    );
    return snapshot(state);
  }
  const rest = available.filter((id) => id !== player);
  const at =
    position === 'first'
      ? 0
      : state.protectedLast
        ? rest.indexOf(state.protectedLast)
        : rest.length;
  rest.splice(at, 0, player);
  const result = snapshot(state, [...locked, ...rest]);
  validateOrderedOpportunity(result);
  return result;
}
/** Establish explicit scoped last protection; another priority rule must resolve conflicts. */
export function protectOrderedOpportunityLast(
  state: OrderedOpportunity,
  request: { event: string; player: string },
): OrderedOpportunity {
  participant(state, request);
  check(
    !state.protectedLast || state.protectedLast === request.player,
    'Competing last-position protection requires an explicit scope rule.',
  );
  const result = {
    ...reorderOrderedOpportunity(state, { ...request, position: 'last' }),
    protectedLast: request.player,
  };
  validateOrderedOpportunity(result);
  return result;
}
