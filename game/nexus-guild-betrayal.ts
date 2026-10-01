import type { FactionId } from './catalog';
import {
  nexusCardMode, validateNexusCards, validateNexusPlayers,
  type NexusPlayer, type NexusState,
} from './nexus-cards';

export type GuildBetrayalSource = 'reserve' | 'guildTransport' | 'homeworld' | 'junction';
export type GuildBetrayalContext = { turn: number; players: readonly NexusPlayer[] };
export type GuildBetrayalFunding = {
  shipper: string;
  price: number;
  ownSpice: number;
  allyPayment: number;
  allyEscrow: number;
  donor: string | null;
  players: readonly NexusPlayer[];
};
/** Produced by the native adapter, never reconstructed from the saved invoice. */
export type GuildBetrayalAuthority = Omit<GuildBetrayalFunding, 'players'> & {
  source: GuildBetrayalSource;
  sourceSignature: string;
  originalReceiver: string | null;
};
export type GuildBetrayalInvoice = GuildBetrayalAuthority & {
  event: string;
  sequence: number;
  turn: number;
  phase: 5;
  ownPayment: number;
  signature: string;
};
export type GuildBetrayalCursor = {
  sequence: number;
  event: string | null;
  turn: number | null;
  sourceSignature: string | null;
  status: 'pending' | 'completed';
};
export type GuildBetrayalReceipt = {
  invoice: GuildBetrayalInvoice;
  recipient: string | null;
  holderFaction: FactionId | null;
  holderUnallied: boolean | null;
  card: 'guild' | null;
  mode: 'betrayal' | null;
  nexusDiscardIndex: number | null;
  sourceReceipt: string;
  signature: string;
};
export type GuildBetrayalOutcome = Pick<GuildBetrayalReceipt,
  'recipient' | 'holderFaction' | 'holderUnallied' | 'nexusDiscardIndex' | 'sourceReceipt'>;

export class GuildBetrayalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuildBetrayalError';
  }
}
function requireBetrayal(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GuildBetrayalError(message);
}
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => whole(value) && value > 0;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value: unknown, fields: string): boolean =>
  plain(value) && Object.keys(value).sort().join(',') === fields;
const sources: readonly GuildBetrayalSource[] = ['reserve', 'guildTransport', 'homeworld', 'junction'];

function validateContext(context: GuildBetrayalContext): void {
  requireBetrayal(plain(context) && positive(context.turn), 'Guild Betrayal needs a valid current turn.');
  validateNexusPlayers(context.players);
  requireBetrayal(context.players.some(player => player.faction === 'guild'),
    'Guild Betrayal needs the native Spacing Guild seated.');
}

/** Public waits depend only on held-card presence, not its hidden face. */
export function guildBetrayalResponders(cards: NexusState, players: readonly NexusPlayer[]): string[] {
  validateNexusCards(cards, players);
  if (!players.some(player => player.faction === 'guild')) return [];
  return players.filter(player => !player.ally && player.faction !== 'guild' &&
    cards.hands[player.id] !== null).map(player => player.id);
}

/** A saved faction, mode, or owner object is never its own identity authority. */
export function guildBetrayalEligible(
  cards: NexusState, players: readonly NexusPlayer[], holder: string,
): boolean {
  validateNexusCards(cards, players);
  const seat = players.find(player => player.id === holder);
  return !!seat && !seat.ally && seat.faction !== 'guild' && cards.hands[seat.id] === 'guild' &&
    nexusCardMode('guild', seat.faction, players.map(player => player.faction)) === 'betrayal';
}

function funding(input: GuildBetrayalFunding, liveAlliance: boolean): void {
  requireBetrayal(plain(input) && positive(input.price) && whole(input.ownSpice) &&
    whole(input.allyPayment) && input.allyPayment <= input.price && whole(input.allyEscrow) &&
    input.allyPayment <= input.allyEscrow && input.ownSpice >= input.price - input.allyPayment,
  'The original whole shipment payment must be fully funded before any Guild Betrayal receipt.');
  const shipper = input.players.find(player => player.id === input.shipper);
  const donor = input.players.find(player => player.id === input.donor);
  requireBetrayal(shipper && (input.allyPayment === 0
    ? input.donor === null
    : donor && donor.id !== shipper.id && (!liveAlliance ||
      (shipper.ally === donor.id && donor.ally === shipper.id))),
  'The original shipment contribution needs its authorized seated escrow donor.');
}

/** Escrow has already left the donor's spice. A refund is never upfront funding. */
export function quoteGuildBetrayalFunding(input: GuildBetrayalFunding): void {
  requireBetrayal(plain(input), 'Guild Betrayal needs an original funded invoice.');
  validateNexusPlayers(input.players);
  funding(input, true);
}

/** Opaque public identifier: no route, source, cost, donor, or card face. */
export function nexusGuildBetrayalEvent(turn: number, sequence: number, shipper: string): string {
  requireBetrayal(positive(turn) && positive(sequence) && text(shipper),
    'Guild Betrayal needs a positive event sequence and seated shipper identity.');
  return JSON.stringify(['nexusGuildBetrayal', turn, sequence, shipper]);
}

/** Consistency signatures bind server facts; they are not cryptographic authentication. */
export function signGuildBetrayalInvoice(invoice: GuildBetrayalInvoice): string {
  return JSON.stringify(['guildBetrayalInvoice', invoice.event, invoice.sequence, invoice.turn,
    invoice.phase, invoice.shipper, invoice.source, invoice.sourceSignature, invoice.price,
    invoice.ownPayment, invoice.allyPayment, invoice.donor, invoice.ownSpice,
    invoice.allyEscrow, invoice.originalReceiver]);
}

function validateInvoiceFacts(context: GuildBetrayalContext, invoice: GuildBetrayalInvoice): void {
  requireBetrayal(exact(invoice,
    'allyEscrow,allyPayment,donor,event,originalReceiver,ownPayment,ownSpice,phase,price,sequence,shipper,signature,source,sourceSignature,turn') &&
    positive(invoice.turn) && invoice.turn <= context.turn && invoice.phase === 5 &&
    positive(invoice.sequence) && text(invoice.shipper) && sources.includes(invoice.source) &&
    text(invoice.sourceSignature) && whole(invoice.ownPayment) &&
    invoice.ownPayment === invoice.price - invoice.allyPayment &&
    (invoice.originalReceiver === null || context.players.some(player => player.id === invoice.originalReceiver)),
  'Guild Betrayal lost its original positive native shipment invoice.');
  funding({ ...invoice, players: context.players }, false);
  requireBetrayal(invoice.event === nexusGuildBetrayalEvent(invoice.turn, invoice.sequence, invoice.shipper) &&
    invoice.signature === signGuildBetrayalInvoice(invoice),
  'Guild Betrayal lost its event or original funded source signature.');
}

export function createGuildBetrayalInvoice(
  context: GuildBetrayalContext, authority: GuildBetrayalAuthority, sequence: number,
): GuildBetrayalInvoice {
  validateContext(context);
  quoteGuildBetrayalFunding({ ...authority, players: context.players });
  const invoice: GuildBetrayalInvoice = {
    shipper: authority.shipper, price: authority.price, ownSpice: authority.ownSpice,
    allyPayment: authority.allyPayment, allyEscrow: authority.allyEscrow, donor: authority.donor,
    source: authority.source, sourceSignature: authority.sourceSignature,
    originalReceiver: authority.originalReceiver,
    event: nexusGuildBetrayalEvent(context.turn, sequence, authority.shipper),
    sequence, turn: context.turn, phase: 5, ownPayment: authority.price - authority.allyPayment,
    signature: '',
  };
  invoice.signature = signGuildBetrayalInvoice(invoice);
  validateInvoiceFacts(context, invoice);
  return invoice;
}

/** Re-quote native custody/route/tariff separately before passing authority here. */
export function validateGuildBetrayalInvoice(
  context: GuildBetrayalContext, invoice: GuildBetrayalInvoice,
  authority: GuildBetrayalAuthority, sequence: number,
): void {
  validateContext(context);
  validateInvoiceFacts(context, invoice);
  quoteGuildBetrayalFunding({ ...authority, players: context.players });
  requireBetrayal(invoice.turn === context.turn && invoice.sequence === sequence &&
    (['shipper', 'price', 'ownSpice', 'allyPayment', 'allyEscrow', 'donor',
      'source', 'sourceSignature', 'originalReceiver'] as const)
      .every(key => invoice[key] === authority[key]),
  'Guild Betrayal no longer matches the independent native shipment and funding.');
}

/** Runtime emits this only after the original native fee and delivery suffix succeeds. */
export function nexusGuildBetrayalSourceReceipt(invoice: GuildBetrayalInvoice): string {
  return JSON.stringify(['guildBetrayalSourceCompleted', invoice.event, invoice.sequence,
    invoice.turn, invoice.shipper, invoice.source, invoice.sourceSignature,
    invoice.price, invoice.ownPayment, invoice.allyPayment, invoice.donor]);
}

export function signGuildBetrayalReceipt(receipt: GuildBetrayalReceipt): string {
  return JSON.stringify(['guildBetrayalReceipt', signGuildBetrayalInvoice(receipt.invoice),
    receipt.recipient, receipt.holderFaction, receipt.holderUnallied, receipt.card,
    receipt.mode, receipt.nexusDiscardIndex, receipt.sourceReceipt]);
}

function validateReceipt(context: GuildBetrayalContext, receipt: GuildBetrayalReceipt): void {
  requireBetrayal(exact(receipt,
    'card,holderFaction,holderUnallied,invoice,mode,nexusDiscardIndex,recipient,signature,sourceReceipt'),
  'Guild Betrayal has an incomplete or foreign completed receipt.');
  validateInvoiceFacts(context, receipt.invoice);
  const holder = context.players.find(player => player.id === receipt.recipient);
  requireBetrayal(receipt.recipient === null
    ? receipt.holderFaction === null && receipt.holderUnallied === null && receipt.card === null &&
      receipt.mode === null && receipt.nexusDiscardIndex === null
    : holder && holder.faction === receipt.holderFaction && holder.faction !== 'guild' &&
      receipt.holderUnallied === true && receipt.card === 'guild' && receipt.mode === 'betrayal' &&
      whole(receipt.nexusDiscardIndex) &&
      nexusCardMode('guild', holder.faction, context.players.map(player => player.faction)) === 'betrayal',
  'Guild Betrayal history lost the canonical native Guild or original unallied non-native holder.');
  requireBetrayal(receipt.sourceReceipt === nexusGuildBetrayalSourceReceipt(receipt.invoice) &&
    receipt.signature === signGuildBetrayalReceipt(receipt),
  'Guild Betrayal lost its completed original source receipt.');
}

export function createGuildBetrayalReceipt(
  context: GuildBetrayalContext, invoice: GuildBetrayalInvoice, outcome: GuildBetrayalOutcome,
): GuildBetrayalReceipt {
  validateContext(context);
  validateInvoiceFacts(context, invoice);
  requireBetrayal(invoice.turn === context.turn && plain(outcome),
    'Only the current original shipment may issue a new completed Guild receipt.');
  const holder = context.players.find(player => player.id === outcome.recipient);
  requireBetrayal(outcome.recipient === null || (holder && !holder.ally),
    'Guild Betrayal can only be used by the actual unallied holder.');
  const receipt: GuildBetrayalReceipt = {
    invoice: { ...invoice }, recipient: outcome.recipient, holderFaction: outcome.holderFaction,
    holderUnallied: outcome.holderUnallied, nexusDiscardIndex: outcome.nexusDiscardIndex,
    sourceReceipt: outcome.sourceReceipt,
    card: outcome.recipient === null ? null : 'guild', mode: outcome.recipient === null ? null : 'betrayal',
    signature: '',
  };
  receipt.signature = signGuildBetrayalReceipt(receipt);
  validateReceipt(context, receipt);
  return receipt;
}

/** Intrinsic historic facts, not today's forces/spice/alliances/discard or Nexus custody. */
export function validateGuildBetrayalHistory(
  context: GuildBetrayalContext, history: readonly GuildBetrayalReceipt[],
  cursor: GuildBetrayalCursor, pendingInvoice: GuildBetrayalInvoice | null,
): void {
  validateContext(context);
  requireBetrayal(Array.isArray(history) && exact(cursor,
    'event,sequence,sourceSignature,status,turn') && whole(cursor.sequence) &&
    (cursor.status === 'pending' || cursor.status === 'completed'),
  'Guild Betrayal lost its independent pending/completed cursor.');
  let previousTurn = 0;
  for (let index = 0; index < history.length; index++) {
    const receipt = history[index];
    validateReceipt(context, receipt);
    requireBetrayal(receipt.invoice.sequence === index + 1 && receipt.invoice.turn >= previousTurn,
      'Guild Betrayal has a duplicate, stale or out-of-order completed source.');
    previousTurn = receipt.invoice.turn;
  }
  if (cursor.sequence === 0) {
    requireBetrayal(cursor.status === 'completed' && cursor.event === null && cursor.turn === null &&
      cursor.sourceSignature === null && history.length === 0 && pendingInvoice === null,
    'Guild Betrayal has an orphan source at its initial cursor.');
    return;
  }
  requireBetrayal(history.length === cursor.sequence - (cursor.status === 'pending' ? 1 : 0) &&
    (cursor.status === 'pending' ? pendingInvoice !== null : pendingInvoice === null),
  'Guild Betrayal has an orphan, missing or double-settled original source.');
  const invoice = cursor.status === 'pending' ? pendingInvoice! : history[history.length - 1].invoice;
  validateInvoiceFacts(context, invoice);
  requireBetrayal(invoice.sequence === cursor.sequence && invoice.event === cursor.event &&
    invoice.turn === cursor.turn && invoice.sourceSignature === cursor.sourceSignature &&
    (cursor.status !== 'pending' || (invoice.turn === context.turn && invoice.turn >= previousTurn)),
  'Guild Betrayal cursor no longer identifies its original event, turn or native source.');
}
