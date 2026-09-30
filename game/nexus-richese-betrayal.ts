import type { Card } from './cards';
import { nexusCardMode, validateNexusCards, validateNexusPlayers, type NexusPlayer, type NexusState } from './nexus-cards';
import type { RicheseAuction } from './richese-auction';
import { richeseCardDefinition } from './richese-cards';
import type { RicheseSettlementQuote } from './richese-settlement';

export type RicheseBetrayalInvoice = {
  kind: 'purchase' | 'sale';
  target: string;
  buyer: string;
  source: 'cache' | 'blackMarket';
  price: number;
  ownPayment: number;
  allyPayment: number;
  donor: string | null;
  /** The original invoice recipient; null means the Spice Bank. */
  originalRecipient: string | null;
  /** Private physical evidence, never a public reaction field. */
  card: Card;
};
export type RicheseBetrayalContext = {
  turn: number;
  players: readonly NexusPlayer[];
};
export type RicheseBetrayalReceipt = {
  version: 1;
  event: string;
  turn: number;
  sequence: number;
  round: string;
  lot: string;
  invoice: RicheseBetrayalInvoice;
  required: string[];
  passed: string[];
  stage: 'pending' | 'passed' | 'used';
  actor: string | null;
  nexusDiscardIndex: number | null;
  signature: string;
};
export type RicheseBetrayalCursor = {
  sequence: number;
  current: string | null;
  completed: RicheseBetrayalReceipt[];
};
export class RicheseBetrayalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RicheseBetrayalError';
  }
}
function requireBetrayal(value: unknown, message: string): asserts value {
  if (!value) throw new RicheseBetrayalError(message);
}
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value: unknown, keys: readonly string[]): boolean =>
  plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const cardKinds: Record<Card['kind'], true> = {
  projectile: true, poison: true, lasgun: true, shield: true, snooper: true,
  poisonBlade: true, shieldSnooper: true, weirdingWay: true, chemistry: true,
  poisonTooth: true, artillery: true, worthless: true, hero: true, special: true,
};
function validCard(card: Card): boolean {
  return plain(card) && exact(card, card.effect === undefined ? ['id', 'name', 'kind'] : ['id', 'name', 'kind', 'effect']) &&
    text(card.id) && text(card.name) && Object.hasOwn(cardKinds, card.kind) &&
    (card.effect === undefined || text(card.effect));
}
function sameCard(a: Card, b: Card): boolean {
  return a.id === b.id && a.name === b.name && a.kind === b.kind && a.effect === b.effect;
}
function validatePlayers(players: readonly NexusPlayer[]): void {
  try { validateNexusPlayers(players); }
  catch (error) { throw new RicheseBetrayalError(error instanceof Error ? error.message : 'Invalid Richese Betrayal roster.'); }
  requireBetrayal(players.some(p => p.faction === 'richese'), 'Richese Betrayal requires the native Richese seat.');
}
function validateInvoice(players: readonly NexusPlayer[], invoice: RicheseBetrayalInvoice): void {
  requireBetrayal(exact(invoice, ['kind', 'target', 'buyer', 'source', 'price', 'ownPayment', 'allyPayment', 'donor', 'originalRecipient', 'card']),
    'Richese Betrayal has an invalid original invoice.');
  const target = players.find(p => p.id === invoice.target);
  const buyer = players.find(p => p.id === invoice.buyer);
  requireBetrayal(target?.faction === 'richese' && buyer &&
    ['cache', 'blackMarket'].includes(invoice.source) &&
    whole(invoice.price) && invoice.price > 0 && whole(invoice.ownPayment) && whole(invoice.allyPayment) &&
    invoice.allyPayment <= invoice.price && invoice.ownPayment === invoice.price - invoice.allyPayment &&
    (invoice.allyPayment === 0 ? invoice.donor === null :
      text(invoice.donor) && invoice.donor !== invoice.buyer && players.some(p => p.id === invoice.donor)) &&
    validCard(invoice.card), 'Richese Betrayal needs a positive original price, exact funding split and physical card.');
  if (invoice.kind === 'purchase') {
    requireBetrayal(invoice.source === 'cache' && buyer.id === target.id && richeseCardDefinition(invoice.card) &&
      invoice.originalRecipient === (players.find(p => p.faction === 'emperor')?.id ?? null),
      'Richese self-veto requires a real public cache purchase paid to Emperor or bank.');
  } else {
    requireBetrayal(invoice.kind === 'sale' && buyer.id !== target.id && invoice.originalRecipient === target.id &&
      (invoice.source !== 'cache' || richeseCardDefinition(invoice.card)),
      'Richese sale diversion requires another buyer and income originally owed to Richese.');
  }
}

/** Quote the original invoice only. Veto pays nobody; diversion changes the
 * recipient to the bank, never the buyer, price, source or contribution split. */
export function quoteRicheseBetrayalInvoice(input: {
  players: readonly NexusPlayer[];
  lot: Readonly<RicheseAuction>;
  quote: Extract<RicheseSettlementQuote, { kind: 'sold' }>;
  donor: string | null;
  originalRecipient: string | null;
  sourceCards: readonly Card[];
  physicalCards: readonly Card[];
}): RicheseBetrayalInvoice {
  requireBetrayal(plain(input), 'Richese Betrayal needs a source invoice.');
  validatePlayers(input.players);
  const { lot, quote } = input;
  requireBetrayal(plain(lot) && plain(quote) && quote.kind === 'sold' && text(lot.event) &&
    lot.outcome?.kind === 'sold' && lot.outcome.winner === quote.winner && lot.outcome.amount === quote.amount &&
    lot.cardId === quote.card?.id && ['normal', 'onceAround', 'silent'].includes(lot.method) &&
    !(lot.source === 'cache' && lot.method === 'normal'), 'Richese Betrayal needs the original ordinary sold lot.');
  const invoice: RicheseBetrayalInvoice = {
    kind: quote.winner === lot.owner ? 'purchase' : 'sale',
    target: lot.owner, buyer: quote.winner, source: lot.source,
    price: quote.amount, ownPayment: quote.ownPayment, allyPayment: quote.allyPayment,
    donor: input.donor, originalRecipient: input.originalRecipient,
    card: { ...quote.card },
  };
  validateInvoice(input.players, invoice);
  const buyer = input.players.find(p => p.id === invoice.buyer)!;
  requireBetrayal(!invoice.donor || (buyer.ally === invoice.donor &&
    input.players.find(p => p.id === invoice.donor)?.ally === buyer.id),
    'Richese Betrayal cannot substitute an unallied contributor.');
  for (const cards of [input.sourceCards, input.physicalCards]) {
    requireBetrayal(Array.isArray(cards) && cards.every(validCard), 'Richese Betrayal needs physical source custody.');
    const matches = cards.filter(card => card.id === invoice.card.id);
    requireBetrayal(matches.length === 1 && sameCard(matches[0], invoice.card),
      'Richese Betrayal has lost or duplicated its exact source card.');
  }
  return invoice;
}

/** Public held-presence only: private Nexus identities never affect timing. */
export function requiredRicheseBetrayalResponders(
  players: readonly (NexusPlayer & { nexusHeld: boolean })[],
): string[] {
  validatePlayers(players);
  requireBetrayal(players.every(p => typeof p.nexusHeld === 'boolean'), 'Richese Betrayal needs public Nexus held-presence.');
  return players.filter(p => p.faction !== 'richese' && !p.ally && p.nexusHeld).map(p => p.id);
}

/** No printed spice fee. The physical singleton Richese Nexus is the cost;
 * runtime separately preflights the unchanged purchase promises and budget. */
export function richeseBetrayalEligibility(
  input: { players: readonly NexusPlayer[]; cards: NexusState }, owner: string,
): string | null {
  validatePlayers(input.players);
  try { validateNexusCards(input.cards, input.players); }
  catch (error) { throw new RicheseBetrayalError(error instanceof Error ? error.message : 'Invalid physical Nexus custody.'); }
  const seat = input.players.find(p => p.id === owner);
  if (!seat) return 'Choose a seated Richese Nexus holder.';
  if (seat.ally) return 'An allied player cannot play a Nexus card.';
  if (input.cards.hands[owner] !== 'richese' ||
    nexusCardMode('richese', seat.faction, input.players.map(p => p.faction)) !== 'betrayal')
    return 'Hold the real Richese Nexus card as another faction to use Betrayal.';
  return null;
}

export function richeseBetrayalEvent(turn: number, sequence: number, round: string, lot: string): string {
  return JSON.stringify(['nexusRicheseBetrayal', turn, sequence, round, lot]);
}
function signature(receipt: RicheseBetrayalReceipt): string {
  const i = receipt.invoice;
  return JSON.stringify(['richeseBetrayalReceipt', receipt.version, receipt.event, receipt.turn,
    receipt.sequence, receipt.round, receipt.lot, i.kind, i.target, i.buyer, i.source,
    i.price, i.ownPayment, i.allyPayment, i.donor, i.originalRecipient,
    [i.card.id, i.card.name, i.card.kind, i.card.effect ?? null],
    receipt.required, receipt.passed, receipt.stage, receipt.actor, receipt.nexusDiscardIndex]);
}

/** Intrinsic historical evidence, independent of current card/discard custody
 * and later alliances. Signatures detect inconsistency, not arbitrary forgery. */
export function validateRicheseBetrayalReceipt(context: RicheseBetrayalContext, receipt: RicheseBetrayalReceipt): void {
  requireBetrayal(plain(context) && whole(context.turn) && context.turn > 0, 'Richese Betrayal needs a valid current turn.');
  validatePlayers(context.players);
  requireBetrayal(exact(receipt, ['version', 'event', 'turn', 'sequence', 'round', 'lot', 'invoice', 'required', 'passed', 'stage', 'actor', 'nexusDiscardIndex', 'signature']) &&
    receipt.version === 1 && whole(receipt.turn) && receipt.turn > 0 && receipt.turn <= context.turn &&
    whole(receipt.sequence) && receipt.sequence > 0 && text(receipt.round) && text(receipt.lot) &&
    receipt.event === richeseBetrayalEvent(receipt.turn, receipt.sequence, receipt.round, receipt.lot) &&
    ids(receipt.required) && receipt.required.length > 0 && ids(receipt.passed) &&
    receipt.required.every(id => context.players.some(p => p.id === id && p.faction !== 'richese')) &&
    receipt.passed.every(id => receipt.required.includes(id)), 'Richese Betrayal has lost its original event or acknowledgements.');
  validateInvoice(context.players, receipt.invoice);
  if (receipt.stage === 'used') {
    requireBetrayal(text(receipt.actor) && receipt.required.includes(receipt.actor) && !receipt.passed.includes(receipt.actor) &&
      whole(receipt.nexusDiscardIndex), 'Richese Betrayal has lost its one physical Nexus spend.');
  } else {
    requireBetrayal((receipt.stage === 'pending' || receipt.stage === 'passed') && receipt.actor === null && receipt.nexusDiscardIndex === null &&
      (receipt.stage === 'passed' ? receipt.passed.length === receipt.required.length :
        receipt.turn === context.turn && receipt.passed.length < receipt.required.length),
      'Richese Betrayal has an invalid pending or all-pass lifecycle.');
  }
  requireBetrayal(receipt.signature === signature(receipt), 'Richese Betrayal receipt has changed its original invoice.');
}
export function createRicheseBetrayalReceipt(
  context: RicheseBetrayalContext,
  input: Omit<RicheseBetrayalReceipt, 'version' | 'signature'>,
): RicheseBetrayalReceipt {
  const receipt: RicheseBetrayalReceipt = {
    ...input, version: 1, invoice: { ...input.invoice, card: { ...input.invoice.card } },
    required: [...input.required], passed: [...input.passed], signature: '',
  };
  receipt.signature = signature(receipt);
  validateRicheseBetrayalReceipt(context, receipt);
  return receipt;
}

/** The independent cursor makes missing/orphaned private frames fail closed. */
export function validateRicheseBetrayalCursor(
  context: RicheseBetrayalContext, cursor: RicheseBetrayalCursor, pending: RicheseBetrayalReceipt | null,
): void {
  requireBetrayal(exact(cursor, ['sequence', 'current', 'completed']) && whole(cursor.sequence) &&
    (cursor.current === null || text(cursor.current)) && Array.isArray(cursor.completed),
    'Richese Betrayal has an invalid continuation cursor.');
  requireBetrayal(cursor.completed.length === cursor.sequence - (pending ? 1 : 0),
    'Richese Betrayal has lost a completed or pending continuation.');
  for (const [index, receipt] of cursor.completed.entries()) {
    validateRicheseBetrayalReceipt(context, receipt);
    requireBetrayal(receipt.stage !== 'pending' && receipt.sequence === index + 1,
      'Richese Betrayal history must contain each completed opportunity once.');
  }
  requireBetrayal(new Set(cursor.completed.map(r => r.event)).size === cursor.completed.length,
    'Richese Betrayal has duplicate completed events.');
  if (pending) {
    validateRicheseBetrayalReceipt(context, pending);
    requireBetrayal(pending.stage === 'pending' && pending.sequence === cursor.sequence && cursor.current === pending.event,
      'Richese Betrayal has lost ownership of its original pending continuation.');
  } else requireBetrayal(cursor.current === null, 'Richese Betrayal has an orphaned continuation cursor.');
}
