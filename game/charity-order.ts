import { reorderOrderedOpportunity, OrderedOpportunityError } from './ordered-opportunity';

/** Native Charity follows the actual First Player order, one opportunity per seat. */
type CharityOrderFields = {
  turn: number;
  order: string[];
  remaining: string[];
};
export type SaphoCharityOrderUse = {
  event: string;
  player: string;
  mode: 'first' | 'last';
  completed: string[];
  started: boolean;
};
export type CharityOrder = CharityOrderFields & (
  | { version: 1 }
  | { version: 2; completed: string[]; started: boolean; uses: SaphoCharityOrderUse[] }
);
export type CharityOrderContext = {
  turn: number;
  order: readonly string[];
  players: readonly { id: string }[];
  ready: readonly string[];
  claimed?: readonly string[];
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
  requireOrder(ids(context.ready) && context.ready.every(player => seats.includes(player)),
    'Completed Charity opportunities must be distinct actual seats.');
  requireOrder(context.claimed === undefined ||
    (ids(context.claimed) && context.claimed.every(player => seats.includes(player))),
  'Charity claim receipts must name distinct actual seats.');
}

export function createCharityOrder(context: CharityOrderContext): CharityOrder {
  validateContext(context);
  requireOrder(same(context.ready, context.order.slice(0, context.ready.length)),
    'Completed Charity opportunities must be the exact public-order prefix.');
  return { version: 1, turn: context.turn, order: [...context.order],
    remaining: context.order.slice(context.ready.length) };
}

function currentStarted(context: CharityOrderContext, frame: CharityOrder): boolean {
  return frame.version === 2 ? frame.started : !!context.claimed?.includes(frame.remaining[0]);
}
function copy(frame: CharityOrder): CharityOrder {
  const fields = { turn: frame.turn, order: [...frame.order], remaining: [...frame.remaining] };
  return frame.version === 1 ? { version: 1, ...fields } : {
    version: 2, ...fields, completed: [...frame.completed], started: frame.started,
    uses: frame.uses.map(use => ({ ...use, completed: [...use.completed] })),
  };
}

export function validateCharityOrder(context: CharityOrderContext, frame: CharityOrder): void {
  validateContext(context);
  requireOrder(record(frame) && (frame.version === 1 || frame.version === 2) &&
    Object.keys(frame).sort().join(',') === (frame.version === 1
      ? 'order,remaining,turn,version' : 'completed,order,remaining,started,turn,uses,version') &&
    frame.turn === context.turn && ids(frame.order) && ids(frame.remaining),
  'The current Charity order is malformed or belongs to another turn.');
  requireOrder(same(frame.order, context.order), 'Charity must retain its original physical order.');
  if (frame.version === 1) requireOrder(same(context.ready, frame.order.slice(0, context.ready.length)) &&
    same(frame.remaining, frame.order.slice(context.ready.length)),
  'Charity must retain its original public order and exact remaining suffix.');
  else {
    requireOrder(ids(frame.completed) && same(frame.completed, context.ready) && typeof frame.started === 'boolean',
      'Reordered Charity must retain its actual completions and current start.');
    validateSaphoHistory(frame);
    requireOrder(frame.remaining.length > 0 || !frame.started,
      'Completed Charity cannot retain a started opportunity.');
    if (context.claimed !== undefined) requireOrder(frame.started ===
      !!context.claimed.includes(frame.remaining[0]),
    'The Charity start must match the current native claim receipt.');
  }
}

function eventFor(turn: number, order: readonly string[], remaining: readonly string[],
  completed: readonly string[], started: boolean, revision: number): string {
  return `saphoCharity:${JSON.stringify([turn, order, remaining, completed, started, revision])}`;
}
function advanceCompleted(remaining: readonly string[], completed: readonly string[], started: boolean,
  next: readonly string[]) {
  requireOrder(next.length >= completed.length && same(next.slice(0, completed.length), completed),
    'Sapho cannot reopen or replace completed Charity opportunities.');
  const count = next.length - completed.length;
  requireOrder(count <= remaining.length && same(next.slice(completed.length), remaining.slice(0, count)),
    'Charity completions must follow the current remaining opportunity order.');
  return { remaining: remaining.slice(count), completed: [...next], started: started && count === 0 };
}
function reordered(order: readonly string[], remaining: readonly string[], completed: readonly string[],
  started: boolean, use: Pick<SaphoCharityOrderUse, 'event' | 'player' | 'mode'>) {
  requireOrder(remaining.includes(use.player), 'Only a pending faction may change its Charity position.');
  requireOrder(!started || use.player !== remaining[0],
    'Juice of Sapho cannot split a Charity opportunity that has already started.');
  try {
    const next = reorderOrderedOpportunity({ event: use.event, eligible: order, remaining, completed,
      current: remaining[0] ?? null, currentStarted: started },
    { event: use.event, player: use.player, position: use.mode });
    requireOrder(!same(next.remaining, remaining), 'This faction is already in that remaining Charity position.');
    return [...next.remaining];
  } catch (error) {
    if (error instanceof OrderedOpportunityError) throw new CharityOrderError(error.message);
    throw error;
  }
}
function validateSaphoHistory(frame: Extract<CharityOrder, { version: 2 }>): void {
  requireOrder(Array.isArray(frame.uses) && frame.uses.length > 0,
    'Reordered Charity needs its actual Juice of Sapho use history.');
  let remaining = [...frame.order], completed: string[] = [], started = false;
  for (const [index, use] of frame.uses.entries()) {
    requireOrder(record(use) && Object.keys(use).sort().join(',') === 'completed,event,mode,player,started' &&
      typeof use.event === 'string' && id(use.player) && (use.mode === 'first' || use.mode === 'last') &&
      ids(use.completed) && typeof use.started === 'boolean',
    'The saved Sapho Charity use is malformed.');
    const advanced = advanceCompleted(remaining, completed, started, use.completed);
    requireOrder(!advanced.started || use.started,
      'A later Sapho use cannot unlock the current started Charity opportunity.');
    requireOrder(!use.started || advanced.remaining.length > 0,
      'Only a current Charity opportunity can have started.');
    requireOrder(use.event === eventFor(frame.turn, frame.order, advanced.remaining,
      advanced.completed, use.started, index), 'The saved Sapho Charity use lost its original public boundary.');
    remaining = reordered(frame.order, advanced.remaining, advanced.completed, use.started, use);
    completed = advanced.completed;
    started = use.started;
  }
  const advanced = advanceCompleted(remaining, completed, started, frame.completed);
  requireOrder(same(frame.remaining, advanced.remaining) && (!advanced.started || frame.started),
    'The Charity frame contradicts its Sapho history or unlocks a started opportunity.');
}

export function saphoCharityOrderEvent(context: CharityOrderContext, frame: CharityOrder): string {
  validateCharityOrder(context, frame);
  return eventFor(frame.turn, frame.order, frame.remaining, context.ready,
    currentStarted(context, frame), frame.version === 2 ? frame.uses.length : 0);
}

export function reorderSaphoCharityOrder(context: CharityOrderContext, frame: CharityOrder, request: {
  event: string; player: string; mode: 'first' | 'last';
}): { order: CharityOrder; afterCurrent?: string } {
  validateCharityOrder(context, frame);
  const event = saphoCharityOrderEvent(context, frame), started = currentStarted(context, frame);
  requireOrder(record(request) && Object.keys(request).sort().join(',') === 'event,mode,player' &&
    request.event === event && id(request.player) && (request.mode === 'first' || request.mode === 'last'),
  'Choose first or last at the current Sapho Charity opportunity.');
  const remaining = reordered(frame.order, frame.remaining, context.ready, started, request);
  const order: CharityOrder = { version: 2, turn: frame.turn, order: [...frame.order], remaining,
    completed: [...context.ready], started,
    uses: [...(frame.version === 2 ? frame.uses.map(use => ({ ...use, completed: [...use.completed] })) : []),
      { event, player: request.player, mode: request.mode, completed: [...context.ready], started }] };
  validateCharityOrder(context, order);
  return { order, ...(started ? { afterCurrent: frame.remaining[0] } : {}) };
}

export function charityOrderBlock(context: CharityOrderContext, frame: CharityOrder, player: string): string | null {
  validateCharityOrder(context, frame);
  requireOrder(id(player), 'Choose a valid Charity participant.');
  if (!frame.order.includes(player)) return 'Only seated factions have a Charity opportunity.';
  if (!frame.remaining.length) return 'Charity opportunities are complete.';
  if (context.ready.includes(player)) return 'Your Charity opportunity has finished.';
  return frame.remaining[0] === player ? null : 'Wait for your Charity opportunity.';
}

/** Pre-claim quote: the caller records the accepted native claim in the same
 * transaction. Version one derives that start from context, retaining its bytes.
 */
export function startCharityOrder(context: CharityOrderContext, frame: CharityOrder, player: string): CharityOrder {
  const blocked = charityOrderBlock(context, frame, player);
  requireOrder(blocked === null, blocked ?? 'This Charity opportunity is unavailable.');
  const next = copy(frame);
  return next.version === 1 ? next : { ...next, started: true };
}

/** Consume the pre-finish ready prefix. The caller appends this actor to ready
 * with the native claim/pass in the same commit; no wallet or card changes occur here.
 */
export function finishCharityOrder(context: CharityOrderContext, frame: CharityOrder, player: string): CharityOrder {
  const blocked = charityOrderBlock(context, frame, player);
  requireOrder(blocked === null, blocked ?? 'This Charity opportunity is unavailable.');
  if (frame.version === 1)
    return { version: 1, turn: frame.turn, order: [...frame.order], remaining: frame.remaining.slice(1) };
  const next = { ...copy(frame), remaining: frame.remaining.slice(1), completed: [...frame.completed, player], started: false };
  validateCharityOrder({ ...context, ready: [...context.ready, player] }, next);
  return next;
}
