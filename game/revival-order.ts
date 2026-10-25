/** One native Revival opportunity per faction in public First Player order.
 * Leader decisions remain within that faction's opportunity; this grouping is
 * an implementation composition of the supplied Advanced physical9/printed7. */
export type RevivalOrder = {
  version: 1;
  turn: number;
  original: string[];
  remaining: string[];
  completed: string[];
  started: boolean;
};
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
  requireOrder(ids(context.ready) && same(context.ready, context.order.slice(0, context.ready.length)),
    'Completed Revival factions must be the public-order prefix.');
}
function copy(frame: RevivalOrder): RevivalOrder {
  return { version: 1, turn: frame.turn, original: [...frame.original],
    remaining: [...frame.remaining], completed: [...frame.completed], started: frame.started };
}

export function createRevivalOrder(context: RevivalOrderContext): RevivalOrder {
  validateContext(context);
  return { version: 1, turn: context.turn, original: [...context.order],
    remaining: context.order.slice(context.ready.length), completed: [...context.ready], started: false };
}

export function validateRevivalOrder(context: RevivalOrderContext, frame: RevivalOrder): void {
  validateContext(context);
  requireOrder(record(frame) && Object.keys(frame).sort().join(',') ===
    'completed,original,remaining,started,turn,version' && frame.version === 1 &&
    Number.isSafeInteger(frame.turn) && frame.turn === context.turn &&
    ids(frame.original) && ids(frame.remaining) && ids(frame.completed) && typeof frame.started === 'boolean',
  'The current Revival order is malformed or belongs to another turn.');
  requireOrder(same(frame.original, context.order) && same(frame.completed, context.ready) &&
    same(frame.remaining, frame.original.slice(frame.completed.length)),
  'The Revival order must retain the original public order and its completed prefix.');
  requireOrder(frame.remaining.length > 0 || !frame.started,
    'Completed Revival cannot retain a started opportunity.');
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
