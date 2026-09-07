import type { Card } from './cards';
import type { Game, ResponseWindow } from './engine';

export class IxAuctionDrawError extends Error {}
type Context = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'active'
  | 'order'
  | 'auction'
  | 'ixAuction'
  | 'richeseAuction'
  | 'richeseBidding'
  | 'currentAuctionSale'
  | 'pendingTreacheryDiscard'
  | 'pendingNullentropy'
  | 'deck'
  | 'discard'
> & {
  players: readonly { id: string; faction: string }[];
  physicalCards: readonly Card[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
function requirePool(value: unknown, message: string): asserts value {
  if (!value) throw new IxAuctionDrawError(message);
}
const kinds = new Set<Card['kind']>([
  'projectile',
  'poison',
  'lasgun',
  'shield',
  'snooper',
  'poisonBlade',
  'shieldSnooper',
  'weirdingWay',
  'chemistry',
  'poisonTooth',
  'artillery',
  'worthless',
  'hero',
  'special',
]);
function card(v: unknown): v is Card {
  return (
    record(v) &&
    id(v.id) &&
    id(v.name) &&
    kinds.has(v.kind as Card['kind']) &&
    (v.effect === undefined || id(v.effect))
  );
}
/** Validate the frozen Ixian inspection declaration and request the actual draw.
 * No minimum supply, shuffled result, current eligibility equality, or future
 * player's selection is assumed. A just-spent Karama may join the refill. */
export function quoteIxAuctionDraw(
  g: Context,
  response: ResponseWindow,
  canceled: boolean,
  spendingCard?: Card,
) {
  if (response.kind !== 'ixAuction') return null;
  requirePool(
    g.status === 'playing' &&
      g.phase === 3 &&
      count(g.turn) &&
      g.turn > 0 &&
      Array.isArray(g.players) &&
      g.players.length >= 2 &&
      g.players.length <= 6 &&
      g.players.every((p) => id(p.id)) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      g.players.find((p) => p.id === response.owner)?.faction === 'ixians',
    'The Ixian auction pool needs its current seated owner and Bidding phase.',
  );
  requirePool(
    Array.isArray(g.order) &&
      g.order.length === g.players.length &&
      new Set(g.order).size === g.order.length &&
      g.order.every((p) => g.players.some((s) => s.id === p)),
    'The Ixian auction pool needs its complete unique bidder order.',
  );
  const pool = g.ixAuction;
  requirePool(
    record(pool) &&
      count(pool.count) &&
      pool.count > 0 &&
      pool.count <= g.players.length &&
      Array.isArray(pool.cards) &&
      pool.cards.length === 0 &&
      !g.auction &&
      !g.richeseAuction &&
      !g.currentAuctionSale &&
      g.active === null,
    'The Ixian inspection response must precede its undrawn ordinary pool.',
  );
  const round = g.richeseBidding;
  if (round)
    requirePool(
      record(round) &&
        round.turn === g.turn &&
        round.stage === 'normal' &&
        g.players.find((p) => p.id === round.owner)?.faction === 'richese' &&
        round.normalCount === pool.count &&
        (round.position === 'first' || round.position === 'last') &&
        (round.opener === undefined ||
          (count(round.opener) && round.opener < g.order.length)),
      'The ordinary Ixian pool does not match the current Richese round.',
    );
  requirePool(
    !g.pendingTreacheryDiscard && !g.pendingNullentropy,
    'Finish the committed discard or paid Box before drawing the Ixian auction pool.',
  );
  requirePool(
    Array.isArray(g.deck) &&
      g.deck.every(card) &&
      Array.isArray(g.discard) &&
      g.discard.every(card) &&
      Array.isArray(g.physicalCards),
    'The Ixian auction draw needs readable physical card piles.',
  );
  requirePool(
    spendingCard === undefined || card(spendingCard),
    'The pending Karama cost must be a readable physical card.',
  );
  const supplied = [
    ...g.deck,
    ...g.discard,
    ...(spendingCard ? [spendingCard] : []),
  ];
  requirePool(
    new Set(supplied.map((c) => c.id)).size === supplied.length &&
      supplied.every(
        (c) => g.physicalCards.filter((p) => p?.id === c.id).length === 1,
      ),
    'The Ixian draw piles need unique physical card custody.',
  );
  return {
    owner: response.owner,
    ordinaryCount: pool.count,
    drawCount: pool.count + (canceled ? 0 : 1),
    inspection: !canceled,
  };
}
