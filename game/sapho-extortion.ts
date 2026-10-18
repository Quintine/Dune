import { reorderOrderedOpportunity } from './ordered-opportunity';

export type SaphoExtortionUse = {
  event: string;
  player: string;
  mode: 'first' | 'last';
  cursor: number;
};
export type SaphoExtortionOrder = {
  version: 1;
  original: string[];
  uses: SaphoExtortionUse[];
};
export type SaphoExtortionContext = {
  owner: string;
  token: string;
  turn: number;
  stormOrder: readonly string[];
  queue: readonly string[];
  cursor: number;
  order?: SaphoExtortionOrder;
};
export type SaphoExtortionRequest = {
  event: string;
  player: string;
  mode: 'first' | 'last';
};
export class SaphoExtortionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaphoExtortionError';
  }
}
function requireExtortion(value: unknown, message: string): asserts value {
  if (!value) throw new SaphoExtortionError(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const ids = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && [...value].every(identifier) && new Set(value).size === value.length;
const exact = (value: unknown, keys: string): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).sort().join(',') === keys;
const eventFor = (token: string, turn: number, cursor: number, revision: number): string =>
  `saphoExtortion:${JSON.stringify([token, turn, cursor, revision])}`;

/** Reorder one still-unstarted payer opportunity, never a payment or grant. */
function applyUse(
  original: readonly string[],
  queue: readonly string[],
  use: SaphoExtortionUse,
): string[] {
  const remaining = queue.slice(use.cursor);
  requireExtortion(use.mode === 'first' || use.mode === 'last', 'Choose first or last.');
  requireExtortion(
    identifier(use.player) && remaining.includes(use.player),
    'Only a pending non-owner Extortion payer can change position.',
  );
  requireExtortion(
    use.mode === 'first' ? remaining[0] !== use.player : remaining[remaining.length - 1] !== use.player,
    'This payer is already in that Extortion position.',
  );
  try {
    const next = reorderOrderedOpportunity({
      event: use.event, eligible: original, completed: queue.slice(0, use.cursor),
      remaining, current: remaining[0] ?? null, currentStarted: false,
    }, { event: use.event, player: use.player, position: use.mode });
    return [...next.completed, ...next.remaining];
  } catch (error) {
    throw new SaphoExtortionError(error instanceof Error ? error.message : 'Invalid Extortion payer order.');
  }
}

function validate(context: SaphoExtortionContext): string[] {
  requireExtortion(
    context && typeof context === 'object' && identifier(context.owner) && identifier(context.token) &&
      count(context.turn) && context.turn > 0 && ids(context.stormOrder) &&
      context.stormOrder.includes(context.owner),
    'Extortion needs its original owner, revealed token, turn and unique storm order.',
  );
  const original = context.stormOrder.filter(player => player !== context.owner);
  requireExtortion(
    ids(context.queue) && context.queue.length === original.length &&
      context.queue.every(player => original.includes(player)) &&
      count(context.cursor) && context.cursor <= context.queue.length,
    'Extortion needs its complete public payer queue and a safe current cursor.',
  );
  if (context.order === undefined) {
    requireExtortion(
      JSON.stringify(context.queue) === JSON.stringify(original),
      'An Extortion queue without a Sapho record must retain its original storm order.',
    );
    return original;
  }
  const order = context.order;
  requireExtortion(
    exact(order, 'original,uses,version') && order.version === 1 && ids(order.original) &&
      JSON.stringify(order.original) === JSON.stringify(original) && Array.isArray(order.uses),
    'The Sapho Extortion record must retain its exact original payer order.',
  );
  let queue = [...original], previousCursor = 0;
  for (const [revision, use] of order.uses.entries()) {
    requireExtortion(
      exact(use, 'cursor,event,mode,player') && count(use.cursor) &&
        use.cursor >= previousCursor && use.cursor <= context.cursor &&
        use.event === eventFor(context.token, context.turn, use.cursor, revision),
      'Sapho Extortion history has a stale event, revision or completed payer cursor.',
    );
    queue = applyUse(original, queue, use);
    previousCursor = use.cursor;
  }
  requireExtortion(
    JSON.stringify(context.queue) === JSON.stringify(queue),
    'The Extortion payer queue does not match its original Sapho history.',
  );
  return original;
}

/** Public order only: no spice, card custody, insolvency or payment inspection. */
export function validateSaphoExtortion(context: SaphoExtortionContext): void {
  validate(context);
}
export function saphoExtortionEvent(context: SaphoExtortionContext): string {
  validate(context);
  return eventFor(context.token, context.turn, context.cursor, context.order?.uses.length ?? 0);
}
export function reorderSaphoExtortion(
  context: SaphoExtortionContext,
  request: SaphoExtortionRequest,
): { queue: string[]; order: SaphoExtortionOrder } {
  const original = validate(context);
  const event = eventFor(context.token, context.turn, context.cursor, context.order?.uses.length ?? 0);
  requireExtortion(request && typeof request === 'object' && request.event === event,
    'This Sapho Extortion event has expired.');
  const use: SaphoExtortionUse = { event, player: request.player, mode: request.mode, cursor: context.cursor };
  const queue = applyUse(original, context.queue, use);
  return {
    queue,
    order: { version: 1, original: [...original],
      uses: [...(context.order?.uses ?? []).map(previous => ({ ...previous })), use] },
  };
}
