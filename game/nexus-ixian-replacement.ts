import { baseDeck, choamDeck, ixDeck, type Card } from './cards';
import { ecazTreacheryCards } from './ecaz-cards';
import { richeseCards } from './richese-cards';
import type { RicheseAuction } from './richese-auction';

export class IxianReplacementError extends Error {}

export type RicheseSpecialPurchaseReceipt = {
  buyer: string;
  cardId: string;
  karama: string;
  amount: 3;
  turn: number;
  phase: 3;
};

export type IxianReplacementContext = {
  status: string;
  phase: number;
  turn: number;
  sequence: number;
  expansions: readonly string[];
  /** Original independent three-card selection, never inferred from a hand. */
  ecazTreachery?: boolean;
  richese: boolean;
  /** Native Black Market bidding and Richese special Karama require Advanced play. */
  advanced: boolean;
  auction: {
    cards: readonly Card[];
    index: number;
    bidder: string | null;
    bid: number;
  } | null;
  richeseAuction: Pick<RicheseAuction, 'event' | 'cardId' | 'source' | 'owner' | 'outcome'> | null;
  sale: {
    winner: string;
    amount: number;
    free: boolean;
    origin: 'normal' | 'cache' | 'blackMarket';
    seller: string | null;
  } | null;
  specialPurchase: RicheseSpecialPurchaseReceipt | null;
  players: readonly {
    id: string;
    hand: readonly Card[];
    handLimit: number;
  }[];
  /** Live ownership only: delivered auction descriptors are receipt aliases. */
  physicalCards: readonly Card[];
};

export type IxianReplacementSource = {
  version: 1;
  event: string;
  buyer: string;
  turn: number;
  sequence: number;
  auctionIndex: number;
  amount: number;
  free: boolean;
  card: Card;
  parent: string;
  signature: string;
};
export type IxianReplacementCursor = { sequence: number; signature: string };
export type IxianReplacementReceipt = {
  source: IxianReplacementSource;
  outcome: 'pass' | 'use';
  replacement: Card | null;
  previous: string;
  signature: string;
};

// CHOAM shares two physical Ix identities; family membership follows the actual
// catalogues rather than identity prefixes. Build these once, never per card.
function catalogue(cards: readonly Card[]): Readonly<Record<string, Card>> {
  return Object.fromEntries(cards.map(card => [card.id, card]));
}
const base = catalogue(baseDeck());
const ix = catalogue(ixDeck());
const choam = catalogue(choamDeck());
const cache = catalogue(richeseCards());
const independent = catalogue(ecazTreacheryCards());
const canonical: Readonly<Record<string, Card>> = { ...base, ...ix, ...choam, ...cache, ...independent };
const genesis = 'ixian-replacement:0';
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const array = (value: unknown): boolean => Array.isArray(value);
function requireReplacement(value: unknown, message: string): asserts value {
  if (!value) throw new IxianReplacementError(message);
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return plain(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function canonicalCard(value: unknown): value is Card {
  if (!plain(value) || !text(value.id)) return false;
  const expected = Object.hasOwn(canonical, value.id) ? canonical[value.id] : undefined;
  return !!expected &&
    exact(value, ['id', 'name', 'kind', ...(expected.effect === undefined ? [] : ['effect'])]) &&
    value.name === expected.name && value.kind === expected.kind &&
    value.effect === expected.effect;
}
function selectedCard(value: unknown, ctx: IxianReplacementContext): value is Card {
  return canonicalCard(value) && (
    Object.hasOwn(base, value.id) ||
    (ctx.ecazTreachery === true && Object.hasOwn(independent, value.id)) ||
    (Object.hasOwn(ix, value.id) && ctx.expansions.includes('ix')) ||
    (Object.hasOwn(choam, value.id) && ctx.expansions.includes('choam')) ||
    (Object.hasOwn(cache, value.id) && ctx.expansions.includes('choam') && ctx.richese)
  );
}
function sameCard(one: Card, two: Card): boolean {
  return one.id === two.id && one.name === two.name &&
    one.kind === two.kind && one.effect === two.effect;
}
function cardTuple(card: Card): unknown[] {
  return [card.id, card.name, card.kind, card.effect ?? null];
}

/** Public identity contains no hidden face, price, parent or deck order. */
export function ixianReplacementEvent(
  turn: number, buyer: string, sequence: number, auctionIndex: number,
): string {
  return JSON.stringify(['ixianReplacement', turn, buyer, sequence, auctionIndex]);
}
function sourceSignature(source: IxianReplacementSource): string {
  return JSON.stringify([
    'ixianReplacementSource', source.version, source.event, source.buyer,
    source.turn, source.sequence, source.auctionIndex, source.amount,
    source.free, cardTuple(source.card), source.parent,
  ]);
}
function savedSource(value: unknown): value is IxianReplacementSource {
  return exact(value, [
    'version', 'event', 'buyer', 'turn', 'sequence', 'auctionIndex',
    'amount', 'free', 'card', 'parent', 'signature',
  ]) && value.version === 1 && text(value.event) && text(value.buyer) &&
    whole(value.turn) && value.turn > 0 && whole(value.sequence) &&
    whole(value.auctionIndex) && whole(value.amount) &&
    typeof value.free === 'boolean' && (value.free || value.amount > 0) &&
    canonicalCard(value.card) &&
    text(value.parent) && text(value.signature);
}
function validateSavedSource(value: unknown): asserts value is IxianReplacementSource {
  requireReplacement(savedSource(value), 'The replacement lost its canonical purchase receipt.');
  requireReplacement(
    value.event === ixianReplacementEvent(value.turn, value.buyer, value.sequence, value.auctionIndex) &&
      value.signature === sourceSignature(value),
    'The replacement purchase receipt changed its original source.',
  );
}
function validatePhysical(physical: readonly Card[], ctx?: IxianReplacementContext): void {
  requireReplacement(
    Array.isArray(physical) && physical.every(card => ctx ? selectedCard(card, ctx) : canonicalCard(card)) &&
      new Set(physical.map(card => card.id)).size === physical.length,
    'Replacement requires canonical cards with single physical custody.',
  );
}

type PurchaseTerms = {
  card: Card;
  buyer: string;
  amount: number;
  free: boolean;
  auctionIndex: number;
};

/** The committed direct receipt takes authority without consulting older auctions. */
function specialPurchaseTerms(ctx: IxianReplacementContext): PurchaseTerms {
  const purchase = ctx.specialPurchase;
  requireReplacement(
    plain(purchase) && ctx.advanced && ctx.richese && ctx.expansions.includes('choam') &&
      ctx.phase === 3 && purchase.phase === 3 && purchase.turn === ctx.turn &&
      whole(purchase.turn) && purchase.turn > 0 && purchase.amount === 3 &&
      text(purchase.buyer) && text(purchase.cardId) && text(purchase.karama) &&
      purchase.cardId !== purchase.karama && Object.hasOwn(cache, purchase.cardId),
    'Replacement needs its committed Advanced Richese special Karama purchase.',
  );
  const buyer = Array.isArray(ctx.players) &&
    ctx.players.find(player => plain(player) && player.id === purchase.buyer);
  requireReplacement(buyer && Array.isArray(buyer.hand),
    'Replacement needs the special purchase in its original buyer hand.');
  const card = buyer.hand.find((held: Card) => held?.id === purchase.cardId);
  requireReplacement(selectedCard(card, ctx),
    'Replacement needs the exact canonical delivered Richese cache card.');
  const cost = Array.isArray(ctx.physicalCards) &&
    ctx.physicalCards.find(physical => physical?.id === purchase.karama);
  requireReplacement(
    selectedCard(cost, ctx) && cost.effect === 'karama' &&
      !buyer.hand.some((held: Card) => held?.id === purchase.karama),
    'The special purchase must retain its spent canonical printed Karama cost.',
  );
  return { card, buyer: purchase.buyer, amount: 3, free: false, auctionIndex: 0 };
}

function purchaseTerms(ctx: IxianReplacementContext): PurchaseTerms {
  if (ctx.specialPurchase !== null) return specialPurchaseTerms(ctx);
  const card = purchasedCard(ctx), sale = ctx.sale!;
  return {
    card, buyer: sale.winner, amount: sale.amount, free: sale.free,
    auctionIndex: ctx.auction?.index ?? 0,
  };
}

/** Select only a delivered card backed by the current native sale authority. */
function purchasedCard(ctx: IxianReplacementContext): Card {
  const sale = ctx.sale;
  requireReplacement(sale, 'Replacement needs its original auction sale.');
  if (sale.origin === 'normal') {
    const auction = ctx.auction;
    requireReplacement(
      auction && ctx.richeseAuction === null && sale.seller === null &&
        auction.bidder === sale.winner && auction.bid === sale.amount &&
        whole(auction.index) && Array.isArray(auction.cards) &&
        selectedCard(auction.cards[auction.index], ctx),
      'Replacement must retain its exact original normal auction purchase.',
    );
    return auction.cards[auction.index];
  }
  const lot = ctx.richeseAuction;
  requireReplacement(
    ctx.auction === null && ctx.richese && ctx.expansions.includes('choam') &&
      lot && text(lot.event) && text(lot.cardId) &&
      (lot.source === 'cache' || (lot.source === 'blackMarket' && ctx.advanced)) &&
      lot.source === sale.origin &&
      text(lot.owner) && lot.owner === sale.seller &&
      Array.isArray(ctx.players) && ctx.players.some(player => plain(player) && player.id === lot.owner),
    'Replacement needs its exact native Richese lot and seated owner.',
  );
  const outcome = lot.outcome;
  requireReplacement(
    outcome !== null && outcome.kind === 'sold' &&
      whole(outcome.amount) && outcome.amount > 0 && sale.free === false &&
      outcome.winner === sale.winner && outcome.amount === sale.amount,
    'The native Richese lot must have been sold to the buyer at the recorded price.',
  );
  const buyer = ctx.players.find(player => plain(player) && player.id === sale.winner);
  requireReplacement(buyer && Array.isArray(buyer.hand),
    'Replacement needs the native lot in its original buyer hand.');
  const card = buyer.hand.find((card: Card) => card?.id === lot.cardId);
  requireReplacement(selectedCard(card, ctx),
    'Replacement needs the exact canonical delivered native Richese card.');
  return card;
}

/** Authorize the original normal, native lot or direct Richese purchase.
 * The engine supplies its current source-specific parent and live custody census.
 * Neither payment nor draw allocation is reconstructed here. */
export function validateIxianReplacementSource(
  ctx: IxianReplacementContext, source: IxianReplacementSource, parent: string,
): void {
  validateSavedSource(source);
  requireReplacement(
    ctx.status === 'playing' && ctx.phase === 3 && whole(ctx.turn) &&
      source.turn === ctx.turn && whole(ctx.sequence) && source.sequence === ctx.sequence &&
      text(parent) && source.parent === parent,
    'The purchased card choice has lost its current parent or cursor.',
  );
  const terms = purchaseTerms(ctx);
  requireReplacement(
    terms.buyer === source.buyer && terms.amount === source.amount && terms.free === source.free &&
      source.auctionIndex === terms.auctionIndex && sameCard(terms.card, source.card),
    'Replacement must retain its exact original purchase.',
  );
  validatePhysical(ctx.physicalCards, ctx);
  requireReplacement(
    array(ctx.players) && ctx.players.every(player =>
      plain(player) && text(player.id) && whole(player.handLimit) && player.handLimit > 0 &&
      Array.isArray(player.hand) && player.hand.every(card => selectedCard(card, ctx))) &&
      new Set(ctx.players.map(player => player.id)).size === ctx.players.length,
    'Replacement needs its original buyer and canonical hand custody.',
  );
  const buyer = ctx.players.find(player => player.id === source.buyer);
  requireReplacement(
    buyer && buyer.hand.length <= buyer.handLimit &&
      buyer.hand.filter(card => card.id === source.card.id).length === 1 &&
      buyer.hand.some(card => sameCard(card, source.card)),
    'The exact purchased card must remain owned in a legal hand.',
  );
  const held = ctx.players.flatMap(player => player.hand);
  requireReplacement(
    new Set(held.map(card => card.id)).size === held.length &&
      held.every(card => ctx.physicalCards.some(physical => sameCard(card, physical))),
    'The purchased card and hands must retain unique physical custody.',
  );
}

export function createIxianReplacementSource(
  ctx: IxianReplacementContext, event: string, parent: string,
): IxianReplacementSource {
  const terms = purchaseTerms(ctx);
  const source: IxianReplacementSource = {
    version: 1, event, buyer: terms.buyer, turn: ctx.turn, sequence: ctx.sequence,
    auctionIndex: terms.auctionIndex, amount: terms.amount, free: terms.free,
    card: { ...terms.card }, parent, signature: '',
  };
  source.signature = sourceSignature(source);
  validateIxianReplacementSource(ctx, source, parent);
  return source;
}

export function initialIxianReplacementCursor(): IxianReplacementCursor {
  return { sequence: 0, signature: genesis };
}
function validateCursor(value: unknown): asserts value is IxianReplacementCursor {
  requireReplacement(
    exact(value, ['sequence', 'signature']) && whole(value.sequence) && text(value.signature) &&
      (value.sequence !== 0 || value.signature === genesis),
    'The replacement history lost its independent cursor.',
  );
}
function receiptSignature(receipt: IxianReplacementReceipt): string {
  return JSON.stringify([
    'ixianReplacementReceipt', receipt.source.signature, receipt.outcome,
    receipt.replacement === null ? null : cardTuple(receipt.replacement), receipt.previous,
  ]);
}

/** Link to one completed event, not a recursively serialized prior receipt. */
function receiptHead(receipt: IxianReplacementReceipt): string {
  return JSON.stringify(['ixianReplacementHead', receipt.source.event,
    receipt.outcome, receipt.replacement?.id ?? null]);
}

/** Close AFTER native discard/draw. Same-card redraw is legal after replenishment.
 * No source/history object aliases are returned and no input is mutated. */
export function closeIxianReplacementSource(
  source: IxianReplacementSource,
  outcome: 'pass' | 'use',
  replacement: Card | null,
  previous: IxianReplacementCursor,
): { receipt: IxianReplacementReceipt; cursor: IxianReplacementCursor } {
  validateSavedSource(source);
  validateCursor(previous);
  requireReplacement(
    source.sequence === previous.sequence && previous.sequence < Number.MAX_SAFE_INTEGER &&
      (outcome === 'pass' ? replacement === null : outcome === 'use' && canonicalCard(replacement)),
    'The replacement cannot close twice or lose its actual draw outcome.',
  );
  const receipt: IxianReplacementReceipt = {
    source: { ...source, card: { ...source.card } }, outcome,
    replacement: replacement === null ? null : { ...replacement },
    previous: previous.signature, signature: '',
  };
  receipt.signature = receiptSignature(receipt);
  return { receipt, cursor: { sequence: previous.sequence + 1, signature: receiptHead(receipt) } };
}

/** Historical evidence is independent of present-day card locations: cards may
 * be transferred, discarded, recycled and purchased again in a later event.
 * Signatures prove consistency, not authentication of arbitrarily rewritten saves. */
export function validateIxianReplacementHistory(
  history: readonly IxianReplacementReceipt[],
  cursor: IxianReplacementCursor,
  physical?: readonly Card[],
): void {
  validateCursor(cursor);
  requireReplacement(array(history) && history.length === cursor.sequence,
    'The replacement history has missing or duplicate closed choices.');
  if (physical !== undefined) validatePhysical(physical);
  let previous = genesis, turn = 0;
  const events = new Set<string>();
  for (const [index, receipt] of history.entries()) {
    requireReplacement(
      exact(receipt, ['source', 'outcome', 'replacement', 'previous', 'signature']),
      'The replacement history has a malformed outcome.',
    );
    validateSavedSource(receipt.source);
    requireReplacement(
      receipt.source.sequence === index && receipt.source.turn >= turn &&
        !events.has(receipt.source.event) && receipt.previous === previous &&
        (receipt.outcome === 'pass' ? receipt.replacement === null :
          receipt.outcome === 'use' && canonicalCard(receipt.replacement)) &&
        receipt.signature === receiptSignature(receipt),
      'The replacement history changed its purchase, outcome or continuation chain.',
    );
    events.add(receipt.source.event);
    previous = receiptHead(receipt);
    turn = receipt.source.turn;
  }
  requireReplacement(cursor.signature === previous,
    'The replacement history no longer matches its closed-choice cursor.');
}
