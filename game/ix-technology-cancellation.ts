import type { Game, ResponseWindow } from './engine';

export class IxTechnologyCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IxTechnologyCancellationError';
  }
}
export type NormalAuctionPeekContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'order'
  | 'active'
  | 'auction'
  | 'richeseAuction'
> & {
  players: readonly Pick<Game['players'][number], 'id' | 'faction'>[];
};
export type IxTechnologyCancellationContext = NormalAuctionPeekContext &
  Pick<Game, 'advanced' | 'ixTechnologyTurn' | 'pendingIxTechnology'>;
export type NormalAuctionPeekQuote = {
  peekKnown: false;
  response: { kind: 'atreidesAuction'; owner: string; passed: [] } | null;
};
export type IxTechnologyCancellationQuote = {
  kind: 'ixTechnology';
  owner: string;
  pendingIxTechnology: null;
  peek: NormalAuctionPeekQuote;
};
function requireTechnology(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new IxTechnologyCancellationError(message);
}
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** The finite transition shared by normal lot opening, declined Technology,
 * and completed/canceled Technology. It offers knowledge only; automatic
 * response settlement and subsequent bidding remain the engine's work. */
export function quoteNormalAuctionPeek(
  g: NormalAuctionPeekContext,
): NormalAuctionPeekQuote {
  requireTechnology(
    g.status === 'playing' &&
      g.phase === 3 &&
      whole(g.turn) &&
      g.turn > 0 &&
      !g.richeseAuction &&
      Array.isArray(g.players) &&
      g.players.length > 0,
    'Normal auction inspection needs its current Bidding-phase lot.',
  );
  const seats = g.players.map((p) => p.id);
  requireTechnology(
    seats.every(id) &&
      new Set(seats).size === seats.length &&
      Array.isArray(g.order) &&
      g.order.length > 0 &&
      g.order.every((p) => seats.includes(p)) &&
      new Set(g.order).size === g.order.length,
    'Normal auction inspection needs a unique seated bidder order.',
  );
  const a = g.auction;
  requireTechnology(
    a &&
      Array.isArray(a.cards) &&
      whole(a.index) &&
      a.index < a.cards.length &&
      a.cards[a.index] &&
      id(a.cards[a.index].id) &&
      whole(a.opener) &&
      a.opener < g.order.length &&
      a.active === g.order[a.opener] &&
      g.active === a.active &&
      a.bid === 0 &&
      a.bidder === null &&
      (a.allyPayment ?? 0) === 0 &&
      Array.isArray(a.passed) &&
      a.passed.length === 0,
    'Normal auction inspection needs its unbid current card and opening bidder.',
  );
  const atreides = g.players.filter((p) => p.faction === 'atreides');
  requireTechnology(
    atreides.length <= 1,
    'Normal auction inspection has an ambiguous Atreides owner.',
  );
  return {
    peekKnown: false,
    response: atreides.length
      ? { kind: 'atreidesAuction', owner: atreides[0].id, passed: [] }
      : null,
  };
}

/** Denial consumes the existing once-per-turn attempt but no exchange. The
 * replacement ID is an original declaration, not a current custody demand.
 * No hands, capacities, random draws, UUIDs or hidden card faces are read. */
export function quoteIxTechnologyCancellation(
  g: IxTechnologyCancellationContext,
  response: ResponseWindow,
): IxTechnologyCancellationQuote | null {
  if (response.kind !== 'ixTechnology') return null;
  const peek = quoteNormalAuctionPeek(g);
  const ixians = g.players.filter((p) => p.faction === 'ixians');
  requireTechnology(
    g.advanced &&
      ixians.length === 1 &&
      ixians[0].id === response.owner &&
      g.ixTechnologyTurn === g.turn &&
      g.pendingIxTechnology &&
      id(g.pendingIxTechnology.card) &&
      g.auction?.peekKnown !== true,
    'Canceled Ixian Technology needs its current Advanced declaration and used attempt.',
  );
  return {
    kind: 'ixTechnology',
    owner: response.owner,
    pendingIxTechnology: null,
    peek,
  };
}
