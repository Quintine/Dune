import { HomeworldCustodyError } from './homeworld-custody';
import type { HomeworldId } from './homeworld-cards';
import { quoteGuildPaymentRounding, quoteHomeworldPaymentIncome } from './homeworld-payment-income';
import {
  quoteStableHomeworldOccupation,
  type StableHomeworldOccupationContext,
  type StableHomeworldOccupier,
} from './homeworld-stable-occupation';

export type OccupiedPercentageKind =
  | 'emperor-treachery' | 'guild-shipping' | 'richese-income' | 'fremen-collection';
export type OccupiedPercentageContribution = Readonly<{ payer: string; amount: number }>;
/** The original producer supplies an immutable receipt identifier and its full
 * payment proof, not a new debit instruction. Guild own contributions remain in
 * this proof but are excluded from the eligible amount. */
export type OccupiedPercentagePayment = Readonly<{
  id: string;
  binding: string;
  paid: number;
  contributions: readonly OccupiedPercentageContribution[];
  recipient: string;
}>;
export type OccupiedPercentageSource = Readonly<{
  event: string;
  native: string;
  amount: number;
}> & (
  | Readonly<{
    kind: 'emperor-treachery' | 'guild-shipping';
    payment: OccupiedPercentagePayment;
    nativeIncome: 'received' | 'karama-canceled';
  }>
  | Readonly<{
    kind: 'richese-income';
    payment: OccupiedPercentagePayment & Readonly<{ received: number }>;
  }>
  | Readonly<{
    kind: 'fremen-collection';
    collection: Readonly<{
      id: string;
      binding: string;
      complete: true;
      /** All actual native Collection credits, after original shared allocation.
       * These are settled credit legs, not pile capacities or forecast awards. */
      collected: readonly Readonly<{ id: string; amount: number }>[];
    }>;
  }>
);
export type OccupiedPercentageContext = StableHomeworldOccupationContext;
export type OccupiedPercentageCredit = Readonly<{ player: string; amount: number }>;
export type OccupiedPercentageReceipt = Readonly<{
  source: OccupiedPercentageSource;
  turn: number;
  entitlement: Readonly<StableHomeworldOccupier> | null;
  nativeLow: boolean;
  nativeRetained: number;
  occupiedAmount: number;
  bankRetained: number;
  status: 'pending' | 'settled' | 'blocked';
  blocked: string | null;
  ownAmount: number | null;
  credits: readonly OccupiedPercentageCredit[];
}>;
/** One persisted ledger owns source admission and allocation. Applying cash and
 * replacing this state must be a single engine transaction; a pure quote cannot
 * prevent a caller from applying the same returned credits twice. */
export type OccupiedPercentageState = Readonly<{
  version: 1;
  receipts: readonly OccupiedPercentageReceipt[];
  signature: string;
}>;
export type OccupiedPercentageQuote = {
  state: OccupiedPercentageState;
  receipt: OccupiedPercentageReceipt;
};
export type OccupiedPercentageAllocation = OccupiedPercentageQuote & {
  credits: readonly OccupiedPercentageCredit[];
};

const cards: Record<OccupiedPercentageKind, HomeworldId> = {
  'emperor-treachery': 'kaitain', 'guild-shipping': 'junction',
  'richese-income': 'richese', 'fremen-collection': 'southern_hemisphere',
};
const factions: Record<OccupiedPercentageKind, string> = {
  'emperor-treachery': 'emperor', 'guild-shipping': 'guild',
  'richese-income': 'richese', 'fremen-collection': 'fremen',
};
const whole = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function requireReceipt(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCustodyError(`Occupied percentage receipt: ${message}`);
}
function keys(value: unknown, expected: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function total(amounts: readonly number[]): number {
  let sum = 0;
  for (const amount of amounts) {
    requireReceipt(whole(amount) && Number.isSafeInteger(sum + amount), 'invalid or overflowing actual source amount.');
    sum += amount;
  }
  return sum;
}
/** Canonical copied provenance also gives property-order-independent JSON binding. */
function freezeSource(source: OccupiedPercentageSource, game: OccupiedPercentageContext): OccupiedPercentageSource {
  requireReceipt(source && Object.hasOwn(cards, source.kind) && text(source.event) && text(source.native) && whole(source.amount),
    'unknown source or invalid event, native or amount.');
  requireReceipt(game.players.some(player => player.id === source.native && player.faction === factions[source.kind]),
    'the original source native has the wrong faction.');
  const base = { kind: source.kind, event: source.event, native: source.native, amount: source.amount };
  if (source.kind === 'fremen-collection') {
    requireReceipt(keys(source, ['kind', 'event', 'native', 'amount', 'collection']) &&
      keys(source.collection, ['id', 'binding', 'complete', 'collected']) && text(source.collection.id) &&
      text(source.collection.binding) && source.collection.complete === true && Array.isArray(source.collection.collected),
    'Collection requires its completed original aggregate.');
    const seen: Record<string, true> = Object.create(null);
    const collected = source.collection.collected.map(leg => {
      requireReceipt(keys(leg, ['id', 'amount']) && text(leg.id) && whole(leg.amount) && !Object.hasOwn(seen, leg.id),
        'duplicate or invalid actual Collection leg.');
      seen[leg.id] = true;
      return Object.freeze({ id: leg.id, amount: leg.amount });
    });
    requireReceipt(total(collected.map(leg => leg.amount)) === source.amount, 'Collection total lost actual native credits.');
    return Object.freeze({ ...base, kind: source.kind, collection: Object.freeze({
      id: source.collection.id, binding: source.collection.binding, complete: true as const, collected: Object.freeze(collected),
    }) });
  }
  const richese = source.kind === 'richese-income';
  requireReceipt(keys(source, richese ? ['kind', 'event', 'native', 'amount', 'payment'] :
    ['kind', 'event', 'native', 'amount', 'payment', 'nativeIncome']) &&
    keys(source.payment, richese ? ['id', 'binding', 'paid', 'contributions', 'recipient', 'received'] :
      ['id', 'binding', 'paid', 'contributions', 'recipient']) && text(source.payment.id) && text(source.payment.binding) &&
    whole(source.payment.paid) && source.payment.recipient === source.native && Array.isArray(source.payment.contributions),
  'payment lost its original receipt, actual native recipient or paid provenance.');
  const seen: Record<string, true> = Object.create(null);
  const contributions = source.payment.contributions.map(leg => {
    requireReceipt(keys(leg, ['payer', 'amount']) && text(leg.payer) && whole(leg.amount) &&
      game.players.some(player => player.id === leg.payer) && !Object.hasOwn(seen, leg.payer),
    'duplicate or invalid original payer contribution.');
    seen[leg.payer] = true;
    return Object.freeze({ payer: leg.payer, amount: leg.amount });
  });
  requireReceipt(total(contributions.map(leg => leg.amount)) === source.payment.paid,
    'original payer contributions do not conserve the paid amount.');
  const payment = { id: source.payment.id, binding: source.payment.binding, paid: source.payment.paid,
    contributions: Object.freeze(contributions), recipient: source.payment.recipient };
  if (source.kind === 'richese-income') {
    requireReceipt(whole(source.payment.received) && source.payment.received <= source.payment.paid &&
      source.amount === source.payment.received, 'Richese percentage requires actual net received income, not the gross sale.');
    return Object.freeze({ ...base, kind: source.kind, payment: Object.freeze({ ...payment, received: source.payment.received }) });
  }
  requireReceipt(source.nativeIncome === 'received' || source.nativeIncome === 'karama-canceled', 'invalid native income outcome.');
  const eligible = contributions.filter(leg => source.kind !== 'guild-shipping' || leg.payer !== source.native);
  requireReceipt(total(eligible.map(leg => leg.amount)) === source.amount, 'eligible receipt includes excluded or unpaid spice.');
  return Object.freeze({ ...base, kind: source.kind, payment: Object.freeze(payment), nativeIncome: source.nativeIncome });
}
function amounts(source: OccupiedPercentageSource, nativeLow: boolean, occupied: boolean) {
  const occupiedAmount = occupied ? Math.floor(source.amount / 2) : 0;
  const payment = source.kind === 'emperor-treachery' || source.kind === 'guild-shipping';
  const nativeRetained = payment
    ? source.nativeIncome === 'karama-canceled' ? 0 : occupied || nativeLow ? Math.ceil(source.amount / 2) : source.amount
    : source.amount - occupiedAmount;
  return { nativeRetained, occupiedAmount, bankRetained: source.amount - nativeRetained - occupiedAmount };
}
function allocation(entitlement: Readonly<StableHomeworldOccupier> | null, amount: number, ownAmount: number): readonly OccupiedPercentageCredit[] {
  const credits: OccupiedPercentageCredit[] = [];
  if (entitlement && ownAmount > 0) credits.push(Object.freeze({ player: entitlement.occupier, amount: ownAmount }));
  if (entitlement?.ally && ownAmount < amount) credits.push(Object.freeze({ player: entitlement.ally, amount: amount - ownAmount }));
  return Object.freeze(credits);
}
function stateWith(receipts: readonly OccupiedPercentageReceipt[]): OccupiedPercentageState {
  return Object.freeze({ version: 1, receipts: Object.freeze(receipts), signature: JSON.stringify([1, receipts]) });
}
export function createOccupiedPercentageState(): OccupiedPercentageState { return stateWith([]); }

/** Validate historical receipts without replacing their frozen source or owner
 * with a current army. Static BANK icon amounts do not constrain these awards. */
export function validateOccupiedPercentageState(state: OccupiedPercentageState, game: OccupiedPercentageContext): void {
  requireReceipt(keys(state, ['version', 'receipts', 'signature']) && state.version === 1 && Array.isArray(state.receipts) &&
    typeof state.signature === 'string', 'invalid persisted ledger.');
  for (let i = 0; i < state.receipts.length; i++) {
    const row = state.receipts[i];
    requireReceipt(keys(row, ['source', 'turn', 'entitlement', 'nativeLow', 'nativeRetained', 'occupiedAmount', 'bankRetained',
      'status', 'blocked', 'ownAmount', 'credits']) && whole(row.turn) && row.turn > 0 && row.turn <= game.turn &&
      typeof row.nativeLow === 'boolean' && Array.isArray(row.credits), 'invalid saved receipt.');
    const source = freezeSource(row.source, game), entitlement = row.entitlement;
    if (entitlement !== null) {
      requireReceipt(keys(entitlement, ['world', 'card', 'native', 'occupier', 'ally', 'qualification', 'turn', 'spice']) &&
        entitlement.card === cards[source.kind] && entitlement.native === source.native && entitlement.turn === row.turn &&
        entitlement.world === `homeworld:${factions[source.kind]}` && text(entitlement.qualification) && whole(entitlement.spice) &&
        game.players.some(player => player.id === entitlement.occupier && player.id !== source.native) &&
        (entitlement.ally === null || game.players.some(player => player.id === entitlement.ally && player.id !== entitlement.occupier)),
      'invalid frozen original entitlement.');
    }
    requireReceipt(row.blocked === null || text(row.blocked), 'invalid source blocker.');
    const expected = amounts(source, row.nativeLow, entitlement !== null || row.blocked !== null);
    requireReceipt(row.nativeRetained === expected.nativeRetained && row.occupiedAmount === expected.occupiedAmount &&
      row.bankRetained === expected.bankRetained && row.bankRetained >= 0, 'saved cash legs changed the actual receipt.');
    if (row.status === 'settled') {
      requireReceipt(row.blocked === null && whole(row.ownAmount) && row.ownAmount <= row.occupiedAmount &&
        (entitlement?.ally || row.ownAmount === row.occupiedAmount) &&
        (row.occupiedAmount === 0 || entitlement !== null) &&
        JSON.stringify(row.credits) === JSON.stringify(allocation(entitlement, row.occupiedAmount, row.ownAmount)),
      'settled allocation does not conserve the occupied portion.');
    } else {
      requireReceipt(row.occupiedAmount > 0 && row.ownAmount === null && row.credits.length === 0 &&
        (row.status === 'pending' && entitlement !== null && row.blocked === null ||
          row.status === 'blocked' && entitlement === null && row.blocked !== null), 'invalid pending or blocked receipt.');
    }
    for (let j = 0; j < i; j++) requireReceipt(!sameSource(state.receipts[j], source, row.turn), 'duplicate original source/event.');
  }
  requireReceipt(state.signature === JSON.stringify([1, state.receipts]), 'saved receipt ledger changed.');
}
function sameSource(row: OccupiedPercentageReceipt, source: OccupiedPercentageSource, turn: number): boolean {
  const originalId = row.source.kind === 'fremen-collection' ? row.source.collection.id : row.source.payment.id;
  const candidateId = source.kind === 'fremen-collection' ? source.collection.id : source.payment.id;
  return row.source.event === source.event || row.source.kind === source.kind && row.source.native === source.native &&
    (originalId === candidateId || source.kind === 'fremen-collection' && row.turn === turn);
}

/** Quote already-paid/collected spice only. Native Karama removes native income,
 * not the printed occupied effect. Richese sale-origin classification and other
 * economic priorities stay in the original producer. Southern Hemisphere admits
 * one completed total per native/turn, never independently rounded piles.
 * Sources: original occupied card faces; HOMEWORLD_RULES48–62,98–100. */
export function quoteOccupiedPercentageSource(
  game: OccupiedPercentageContext, original: OccupiedPercentageSource, state: OccupiedPercentageState,
): OccupiedPercentageQuote {
  validateOccupiedPercentageState(state, game);
  requireReceipt(whole(game.turn) && game.turn > 0, 'invalid source turn.');
  const source = freezeSource(original, game);
  requireReceipt(!state.receipts.some(row => sameSource(row, source, game.turn)), 'source/event already admitted or settled.');
  const stable = quoteStableHomeworldOccupation(game, cards[source.kind]);
  const payment = source.kind === 'emperor-treachery' || source.kind === 'guild-shipping'
    ? quoteHomeworldPaymentIncome(game, source.native, source.kind === 'guild-shipping' ? 'shipment' : 'treachery', source.amount)
    : null;
  // Keep the existing two-odd-contributor ruling gate. Exclusion happens before
  // comparing rounding; no new transaction-versus-contribution policy is invented.
  if (source.kind === 'guild-shipping' && (payment?.low || stable.entitlement || stable.blocked)) {
    const eligible = source.payment.contributions.filter(leg => leg.payer !== source.native && leg.amount > 0).map(leg => leg.amount);
    requireReceipt(quoteGuildPaymentRounding(source.amount, eligible).unambiguous,
      'multiple-contributor shipping rounding awaits its original ruling.');
  }
  const candidate = Math.floor(source.amount / 2);
  const blocked = candidate > 0 ? stable.blocked : null;
  const entitlement = stable.entitlement ? Object.freeze({ ...stable.entitlement }) : null;
  const split = amounts(source, payment?.low ?? false, entitlement !== null || blocked !== null);
  const status = blocked ? 'blocked' : split.occupiedAmount > 0 ? 'pending' : 'settled';
  const receipt: OccupiedPercentageReceipt = Object.freeze({ source, turn: game.turn, entitlement,
    nativeLow: payment?.low ?? false, ...split, status, blocked,
    ownAmount: status === 'settled' ? 0 : null, credits: Object.freeze([]) });
  return { receipt, state: stateWith([...state.receipts, receipt]) };
}

/** Return occupied-only credits. Native/bank amounts are final SOURCE legs, not
 * additional wallet awards. The engine preserves the original payer debit once,
 * reconciles any already-credited native cash (Collection must not credit the
 * same total again), and commits actual credits plus the ledger atomically.
 * The live original producer proof must be supplied again; frozen amount,
 * recipient, source and ally cannot silently follow a changed lot. */
export function allocateOccupiedPercentageReceipt(
  state: OccupiedPercentageState, game: OccupiedPercentageContext, actor: string,
  event: string, ownAmount: number, originalSource: OccupiedPercentageSource,
): OccupiedPercentageAllocation {
  validateOccupiedPercentageState(state, game);
  const index = state.receipts.findIndex(row => row.source.event === event), row = state.receipts[index];
  requireReceipt(row && row.status === 'pending' && row.turn === game.turn && row.entitlement?.occupier === actor,
    'wrong owner, stale event/turn, blocked or replayed receipt.');
  requireReceipt(JSON.stringify(freezeSource(originalSource, game)) === JSON.stringify(row.source), 'original source changed before allocation.');
  const current = quoteStableHomeworldOccupation(game, row.entitlement.card);
  requireReceipt(!current.blocked && current.entitlement && JSON.stringify(current.entitlement) === JSON.stringify(row.entitlement),
    'original continuous entitlement or reciprocal ally changed.');
  requireReceipt(whole(ownAmount) && ownAmount <= row.occupiedAmount &&
    (row.entitlement.ally !== null || ownAmount === row.occupiedAmount), 'invalid occupied income split.');
  const credits = allocation(row.entitlement, row.occupiedAmount, ownAmount);
  const receipt: OccupiedPercentageReceipt = Object.freeze({ ...row, status: 'settled', ownAmount, credits });
  return { receipt, credits, state: stateWith(state.receipts.map((prior, i) => i === index ? receipt : prior)) };
}
