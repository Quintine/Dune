import type { ChoamMarket } from './choam-market';
import type { Game, ResponseWindow } from './engine';

export class ChoamSaleCancellationError extends Error {}
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function requireSale(value: unknown, message: string): asserts value {
  if (!value) throw new ChoamSaleCancellationError(message);
}
type Context = Pick<Game, 'status' | 'phase' | 'turn' | 'choamMarket'> & {
  players: readonly Pick<Game['players'][number], 'id' | 'faction'>[];
};
/** Denying a declared sale does not sell a card or require its former witness
 * to remain available. The returned market stops at CHOAM's next real choice. */
export function quoteChoamSaleCancellation(
  g: Context,
  response: ResponseWindow,
) {
  if (response.kind !== 'choamSale') return null;
  const market = g.choamMarket;
  requireSale(
    g.status === 'playing' &&
      Number.isSafeInteger(g.phase) &&
      g.phase >= 0 &&
      g.phase <= 8 &&
      Number.isSafeInteger(g.turn) &&
      g.turn > 0 &&
      record(market) &&
      market.owner === response.owner &&
      g.players.some((p) => p.id === market.owner && p.faction === 'choam') &&
      (market.resume === 'phase' ||
        (market.resume === 'storm' && g.phase === 0)),
    'This canceled CHOAM sale needs its current owner and market.',
  );
  const sale = market.sale;
  requireSale(
    Array.isArray(market.blocked) &&
      market.blocked.every(id) &&
      new Set(market.blocked).size === market.blocked.length &&
      record(sale) &&
      id(sale.card) &&
      !market.blocked.includes(sale.card) &&
      (sale.witness === undefined
        ? sale.price === 2
        : id(sale.witness) && sale.witness !== sale.card && sale.price === 3) &&
      !market.trade,
    'This canceled CHOAM sale has no valid unblocked declaration.',
  );
  const next: ChoamMarket = {
    owner: market.owner,
    resume: market.resume,
    blocked: [...market.blocked, sale.card],
    ...(market.tradeAttempted === undefined
      ? {}
      : { tradeAttempted: market.tradeAttempted }),
  };
  return {
    market: next,
    decision: { kind: 'choamMarket' as const, player: market.owner },
  };
}
