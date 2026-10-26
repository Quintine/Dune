/** Native Charity follows the actual First Player order, one opportunity per seat. */
export type CharityOrder = {
  version: 1;
  turn: number;
  order: string[];
  remaining: string[];
};
export type CharityOrderContext = {
  turn: number;
  order: readonly string[];
  players: readonly { id: string }[];
  ready: readonly string[];
};
export class CharityOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharityOrderError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const ids = (value: unknown): value is readonly string[] => Array.isArray(value) &&
  [...value].every(id) && new Set(value).size === value.length;
const same = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
function requireOrder(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CharityOrderError(message);
}
function validateContext(context: CharityOrderContext): void {
  requireOrder(record(context) && Number.isSafeInteger(context.turn) && context.turn > 0 &&
    Array.isArray(context.players) && context.players.length >= 2 && context.players.length <= 6 &&
    [...context.players].every(player => record(player) && id(player.id)) && ids(context.order),
  'Charity needs a current turn and two through six actual seats in public order.');
  const seats = context.players.map(player => player.id);
  requireOrder(new Set(seats).size === seats.length && context.order.length === seats.length &&
    context.order.every(player => seats.includes(player)),
  'Charity order must contain every actual seat exactly once.');
  requireOrder(ids(context.ready) && context.ready.length <= context.order.length &&
    same(context.ready, context.order.slice(0, context.ready.length)),
  'Completed Charity opportunities must be the exact public-order prefix.');
}

export function createCharityOrder(context: CharityOrderContext): CharityOrder {
  validateContext(context);
  return { version: 1, turn: context.turn, order: [...context.order],
    remaining: context.order.slice(context.ready.length) };
}

export function validateCharityOrder(context: CharityOrderContext, frame: CharityOrder): void {
  validateContext(context);
  requireOrder(record(frame) && Object.keys(frame).sort().join(',') === 'order,remaining,turn,version' &&
    frame.version === 1 && frame.turn === context.turn && ids(frame.order) && ids(frame.remaining),
  'The current Charity order is malformed or belongs to another turn.');
  requireOrder(same(frame.order, context.order) &&
    same(frame.remaining, context.order.slice(context.ready.length)),
  'Charity must retain its original public order and exact remaining suffix.');
}

export function charityOrderBlock(context: CharityOrderContext, frame: CharityOrder, player: string): string | null {
  validateCharityOrder(context, frame);
  requireOrder(id(player), 'Choose a valid Charity participant.');
  if (!frame.order.includes(player)) return 'Only seated factions have a Charity opportunity.';
  if (!frame.remaining.length) return 'Charity opportunities are complete.';
  if (context.ready.includes(player)) return 'Your Charity opportunity has finished.';
  return frame.remaining[0] === player ? null : 'Wait for your Charity opportunity.';
}

/** Consume the pre-finish ready prefix. The caller appends this actor to ready
 * with the native claim/pass in the same commit; no wallet or card changes occur here.
 */
export function finishCharityOrder(context: CharityOrderContext, frame: CharityOrder, player: string): CharityOrder {
  const blocked = charityOrderBlock(context, frame, player);
  requireOrder(blocked === null, blocked ?? 'This Charity opportunity is unavailable.');
  return { version: 1, turn: frame.turn, order: [...frame.order], remaining: frame.remaining.slice(1) };
}
