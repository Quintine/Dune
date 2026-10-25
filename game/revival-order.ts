import { reorderOrderedOpportunity, OrderedOpportunityError } from './ordered-opportunity';

/** One native Revival opportunity per faction in public First Player order.
 * Leader decisions remain within that faction's opportunity; this grouping is
 * an implementation composition of the supplied Advanced physical9/printed7. */
type RevivalOrderFields = {
  turn: number;
  original: string[];
  remaining: string[];
  completed: string[];
  started: boolean;
};
export type SaphoRevivalOrderUse = {
  event: string;
  player: string;
  mode: 'first' | 'last';
  completed: string[];
  started: boolean;
};
export type RevivalOrder = RevivalOrderFields & (
  | { version: 1 }
  | { version: 2; uses: SaphoRevivalOrderUse[] }
);
export type RevivalOrderContext = {
  turn: number;
  order: readonly string[];
  ready: readonly string[];
};
export class RevivalOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevivalOrderError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id);
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
function requireOrder(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RevivalOrderError(message);
}
function validateContext(context: RevivalOrderContext): void {
  requireOrder(record(context) && Number.isSafeInteger(context.turn) && context.turn > 0 &&
    ids(context.order) && context.order.length >= 2 && context.order.length <= 6 &&
    new Set(context.order).size === context.order.length,
  'Revival needs a current turn and two through six distinct factions in public order.');
  requireOrder(ids(context.ready) && new Set(context.ready).size === context.ready.length &&
    context.ready.every(player => context.order.includes(player)),
  'Completed Revival factions must be distinct seated participants.');
}
function copy(frame: RevivalOrder): RevivalOrder {
  const fields = { turn: frame.turn, original: [...frame.original],
    remaining: [...frame.remaining], completed: [...frame.completed], started: frame.started };
  return frame.version === 1 ? { version: 1, ...fields }
    : { version: 2, ...fields, uses: frame.uses.map(use => ({ ...use, completed: [...use.completed] })) };
}

export function createRevivalOrder(context: RevivalOrderContext): RevivalOrder {
  validateContext(context);
  requireOrder(same(context.ready, context.order.slice(0, context.ready.length)),
    'Completed Revival factions must be the public-order prefix.');
  return { version: 1, turn: context.turn, original: [...context.order],
    remaining: context.order.slice(context.ready.length), completed: [...context.ready], started: false };
}

export function validateRevivalOrder(context: RevivalOrderContext, frame: RevivalOrder): void {
  validateContext(context);
  requireOrder(record(frame) && (frame.version === 1 || frame.version === 2) &&
    Object.keys(frame).sort().join(',') === (frame.version === 1
      ? 'completed,original,remaining,started,turn,version' : 'completed,original,remaining,started,turn,uses,version') &&
    Number.isSafeInteger(frame.turn) && frame.turn === context.turn &&
    ids(frame.original) && ids(frame.remaining) && ids(frame.completed) && typeof frame.started === 'boolean',
  'The current Revival order is malformed or belongs to another turn.');
  requireOrder(same(frame.original, context.order) && same(frame.completed, context.ready),
    'The Revival order must retain its original public order and completed factions.');
  if (frame.version === 1) requireOrder(same(frame.completed, frame.original.slice(0, frame.completed.length)) &&
    same(frame.remaining, frame.original.slice(frame.completed.length)),
  'The Revival order must retain the original public order and its completed prefix.');
  else validateSaphoHistory(frame);
  requireOrder(frame.remaining.length > 0 || !frame.started,
    'Completed Revival cannot retain a started opportunity.');
}

function eventFor(turn: number, original: readonly string[], remaining: readonly string[],
  completed: readonly string[], started: boolean, revision: number): string {
  return `saphoRevival:${JSON.stringify([turn, original, remaining, completed, started, revision])}`;
}
/** Consume only actual consecutive completions since the preceding public use.
 * A recorded started actor stays locked until its own opportunity completes. */
function advanceCompleted(remaining: readonly string[], completed: readonly string[], started: boolean,
  next: readonly string[]) {
  requireOrder(next.length >= completed.length && same(next.slice(0, completed.length), completed),
    'Sapho cannot reopen or replace completed Revival opportunities.');
  const count = next.length - completed.length;
  requireOrder(count <= remaining.length && same(next.slice(completed.length), remaining.slice(0, count)),
    'Revival completions must follow the current remaining opportunity order.');
  return { remaining: remaining.slice(count), completed: [...next], started: started && count === 0 };
}
function reordered(original: readonly string[], remaining: readonly string[],
  completed: readonly string[], started: boolean, use: Pick<SaphoRevivalOrderUse, 'event' | 'player' | 'mode'>) {
  requireOrder(remaining.includes(use.player), 'Only a pending faction may change its Revival position.');
  requireOrder(!started || use.player !== remaining[0],
    'Juice of Sapho cannot split a Revival opportunity that has already started.');
  try {
    const next = reorderOrderedOpportunity({ event: use.event, eligible: original, remaining, completed,
      current: remaining[0] ?? null, currentStarted: started },
    { event: use.event, player: use.player, position: use.mode });
    requireOrder(!same(next.remaining, remaining), 'This faction is already in that remaining Revival position.');
    return [...next.remaining];
  } catch (error) {
    if (error instanceof OrderedOpportunityError) throw new RevivalOrderError(error.message);
    throw error;
  }
}
function validateSaphoHistory(frame: Extract<RevivalOrder, { version: 2 }>): void {
  requireOrder(Array.isArray(frame.uses) && frame.uses.length > 0,
    'A reordered Revival needs its actual Juice of Sapho use history.');
  let remaining = [...frame.original], completed: string[] = [], started = false;
  for (const [index, use] of frame.uses.entries()) {
    requireOrder(record(use) && Object.keys(use).sort().join(',') === 'completed,event,mode,player,started' &&
      typeof use.event === 'string' && id(use.player) && (use.mode === 'first' || use.mode === 'last') &&
      ids(use.completed) && typeof use.started === 'boolean',
    'The saved Sapho Revival use is malformed.');
    const advanced = advanceCompleted(remaining, completed, started, use.completed);
    requireOrder(!advanced.started || use.started,
      'A later Sapho use cannot unlock the current started Revival opportunity.');
    requireOrder(!use.started || advanced.remaining.length > 0,
      'Only a current Revival opportunity can have started.');
    requireOrder(use.event === eventFor(frame.turn, frame.original, advanced.remaining,
      advanced.completed, use.started, index), 'The saved Sapho Revival use lost its original public boundary.');
    remaining = reordered(frame.original, advanced.remaining, advanced.completed, use.started, use);
    completed = advanced.completed; started = use.started;
  }
  const advanced = advanceCompleted(remaining, completed, started, frame.completed);
  requireOrder(same(frame.remaining, advanced.remaining) && (!advanced.started || frame.started),
    'The Revival frame contradicts its Sapho use history or unlocks a started opportunity.');
}

/** This boundary binds the actual public queue and every prior genuine use's
 * revision. It grants no card ownership, payment or additional opportunity. */
export function saphoRevivalOrderEvent(context: RevivalOrderContext, frame: RevivalOrder): string {
  validateRevivalOrder(context, frame);
  return eventFor(frame.turn, frame.original, frame.remaining, frame.completed,
    frame.started, frame.version === 2 ? frame.uses.length : 0);
}
export function reorderSaphoRevivalOrder(context: RevivalOrderContext, frame: RevivalOrder, request: {
  event: string; player: string; mode: 'first' | 'last';
}): { order: RevivalOrder; afterCurrent?: string } {
  validateRevivalOrder(context, frame);
  const event = saphoRevivalOrderEvent(context, frame);
  requireOrder(record(request) && Object.keys(request).sort().join(',') === 'event,mode,player' &&
    request.event === event && id(request.player) && (request.mode === 'first' || request.mode === 'last'),
  'Choose first or last at the current Sapho Revival opportunity.');
  const remaining = reordered(frame.original, frame.remaining, frame.completed, frame.started, request);
  const order: RevivalOrder = { version: 2, turn: frame.turn, original: [...frame.original], remaining,
    completed: [...frame.completed], started: frame.started,
    uses: [...(frame.version === 2 ? frame.uses.map(use => ({ ...use, completed: [...use.completed] })) : []),
      { event, player: request.player, mode: request.mode, completed: [...frame.completed], started: frame.started }] };
  validateRevivalOrder(context, order);
  return { order, ...(frame.started ? { afterCurrent: frame.remaining[0] } : {}) };
}

export function revivalOrderBlock(context: RevivalOrderContext, frame: RevivalOrder, player: string): string | null {
  validateRevivalOrder(context, frame);
  requireOrder(id(player), 'Choose a valid Revival faction.');
  if (!frame.original.includes(player)) return 'Only seated factions have a Revival opportunity.';
  if (!frame.remaining.length) return 'Revival opportunities are complete.';
  if (frame.completed.includes(player)) return 'Your Revival opportunity has finished.';
  return frame.remaining[0] === player ? null : 'Wait for your Revival opportunity.';
}

/** Mark an accepted self request without consuming or reopening the opportunity.
 * Further requests by the same current faction retain this idempotent stamp. */
export function startRevivalOrder(context: RevivalOrderContext, frame: RevivalOrder, player: string): RevivalOrder {
  const blocked = revivalOrderBlock(context, frame, player);
  requireOrder(!blocked, blocked ?? 'This Revival opportunity is unavailable.');
  return { ...copy(frame), started: true };
}

/** Receives the pre-completion ready prefix. The caller installs this frame and
 * appends the same current faction to ready in its one accepted transaction. */
export function finishRevivalOrder(context: RevivalOrderContext, frame: RevivalOrder, player: string): RevivalOrder {
  const blocked = revivalOrderBlock(context, frame, player);
  requireOrder(!blocked, blocked ?? 'This Revival opportunity is unavailable.');
  const next = { ...copy(frame), remaining: frame.remaining.slice(1),
    completed: [...frame.completed, player], started: false };
  validateRevivalOrder({ ...context, ready: [...context.ready, player] }, next);
  return next;
}
