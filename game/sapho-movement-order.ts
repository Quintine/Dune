import {
  protectOrderedOpportunityLast, reorderOrderedOpportunity, validateOrderedOpportunity,
  type OrderedOpportunity,
} from './ordered-opportunity';

export type SaphoMovementOrderContext = {
  queue: OrderedOpportunity;
  started: readonly string[];
  /** Present only for Advanced Guild timing. */
  guild: { player: string; granted: boolean; locked: boolean } | null;
};
export class SaphoMovementOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaphoMovementOrderError';
  }
}
function requireMovement(value: unknown, message: string): asserts value {
  if (!value) throw new SaphoMovementOrderError(message);
}
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function validate(context: SaphoMovementOrderContext): OrderedOpportunity {
  requireMovement(context && typeof context === 'object', 'Choose the current movement order.');
  const queue = context.queue;
  validateOrderedOpportunity(queue);
  requireMovement(queue.current !== null && queue.remaining.length > 0,
    'The combined movement turns have already finished.');
  requireMovement(!queue.protectedLast, 'Juice of Sapho already protects the last turn in this phase.');
  requireMovement(Array.isArray(context.started) && context.started.every(identifier) &&
    new Set(context.started).size === context.started.length &&
    context.started.every(player => queue.eligible.includes(player)),
    'Started movement turns must name unique participants in this phase.');
  const started = queue.remaining.filter(player => context.started.includes(player));
  requireMovement(queue.currentStarted
    ? started.length === 1 && started[0] === queue.current
    : started.length === 0,
  'Only the current combined turn may have started among the remaining participants.');
  requireMovement(context.guild === null || context.guild && typeof context.guild === 'object' &&
    identifier(context.guild.player) && queue.eligible.includes(context.guild.player) &&
    typeof context.guild.granted === 'boolean' && typeof context.guild.locked === 'boolean',
    'Guild timing must retain its original participant and public grant state.');
  return queue;
}
function eventFor(queue: OrderedOpportunity): string {
  return queue.currentStarted
    ? `sapho-after:${encodeURIComponent(JSON.stringify([queue.event, queue.current, queue.remaining]))}`
    : queue.event;
}
function wrap<T>(calculate: () => T): T {
  try {
    return calculate();
  } catch (error) {
    if (error instanceof SaphoMovementOrderError) throw error;
    throw new SaphoMovementOrderError(error instanceof Error ? error.message : 'Invalid Sapho movement order.');
  }
}

/** A started turn binds the whole public tail, rather than permitting a stale
 * declaration to displace a different actor or newly reordered participants. */
export function saphoMovementOrderEvent(context: SaphoMovementOrderContext): string {
  return wrap(() => eventFor(validate(context)));
}

export function reorderSaphoMovementOrder(context: SaphoMovementOrderContext, request: {
  event: string;
  player: string;
  mode: 'first' | 'last';
}): { event: string; afterCurrent: string | null; next: OrderedOpportunity } {
  return wrap(() => {
    const queue = validate(context), event = eventFor(queue);
    requireMovement(request && request.event === event, 'This Sapho movement opportunity has expired.');
    requireMovement(request.mode === 'first' || request.mode === 'last', 'Choose first or last.');
    requireMovement(identifier(request.player) && queue.remaining.includes(request.player),
      'Only a pending participant may change its movement position.');
    requireMovement(!context.started.includes(request.player),
      'Juice of Sapho cannot split a combined turn that has already started.');
    const grantedGuild = context.guild && context.guild.player === queue.current &&
      context.guild.granted && !context.guild.locked;
    requireMovement(queue.currentStarted || request.mode !== 'first' || !grantedGuild,
      'The Guild has already been granted the next combined turn.');
    const next = request.mode === 'last'
      ? protectOrderedOpportunityLast(queue, { event: queue.event, player: request.player })
      : reorderOrderedOpportunity(queue, { event: queue.event, player: request.player, position: 'first' });
    requireMovement(next.remaining.some((player, index) => player !== queue.remaining[index]),
      'This participant is already in that remaining movement position.');
    return { event, afterCurrent: queue.currentStarted ? queue.current : null, next };
  });
}
