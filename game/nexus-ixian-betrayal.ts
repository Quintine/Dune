import { treacheryDeck, type Card } from './cards';
import {
  nexusCardMode, validateNexusCards, validateNexusPlayers,
  type NexusPlayer, type NexusState,
} from './nexus-cards';

export type IxianBetrayalKind = 'bidding' | 'technology';
/** Independently produced by the native adapter after its original counters.
 * Native quotes, not the saved source, authorize draw/exchange continuations. */
export type IxianBetrayalAuthority = {
  kind: IxianBetrayalKind;
  provider: string;
  nativeWindow: 'ixAuction' | 'ixTechnology';
  nativeContext: string;
  nativeRequired: readonly string[];
  nativePassed: readonly string[];
};
export type IxianBetrayalContext = {
  status: string;
  phase: number;
  turn: number;
  advanced: boolean;
  sequence: number;
  players: readonly NexusPlayer[];
  cards: NexusState;
  /** Every live physical Treachery location once; no auction receipt aliases. */
  physicalCards: readonly Card[];
};
export type IxianBetrayalSource = IxianBetrayalAuthority & {
  version: 1;
  event: string;
  turn: number;
  phase: 3;
  advanced: boolean;
  sequence: number;
  required: readonly string[];
  eligible: string | null;
  parent: string;
  signature: string;
};
export type IxianBetrayalCursor = { sequence: number; signature: string };
export type IxianBetrayalReceipt = {
  source: IxianBetrayalSource;
  outcome: 'pass' | 'use';
  holder: string | null;
  previous: string;
  signature: string;
};
export class IxianBetrayalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IxianBetrayalError';
  }
}
const canonical = new Map(treacheryDeck(['ix']).map(card => [card.id, card]));
const genesis = 'ixian-betrayal:0';
const permitted: Readonly<Record<string, true>> = {
  atreides: true, harkonnen: true, emperor: true, fremen: true, guild: true,
  beneGesserit: true, ixians: true, tleilaxu: true,
};
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const array = (value: unknown): boolean => Array.isArray(value);
function requireBetrayal(value: unknown, message: string): asserts value {
  if (!value) throw new IxianBetrayalError(message);
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return plain(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function members(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}
function sameMembers(one: readonly string[], two: readonly string[]): boolean {
  return one.length === two.length && one.every((id, index) => id === two[index]);
}
function canonicalCard(value: unknown): value is Card {
  if (!plain(value) || !text(value.id)) return false;
  const expected = canonical.get(value.id);
  return !!expected && exact(value, ['id', 'name', 'kind',
    ...(expected.effect === undefined ? [] : ['effect'])]) &&
    value.name === expected.name && value.kind === expected.kind && value.effect === expected.effect;
}
function validatePhysical(cards: readonly Card[]): void {
  requireBetrayal(Array.isArray(cards) && cards.length === canonical.size &&
    cards.every(canonicalCard) && new Set(cards.map(card => card.id)).size === canonical.size,
  'Ixian Betrayal requires the complete canonical Ixian deck in unique physical custody.');
}
function validateRoster(players: readonly NexusPlayer[]): void {
  validateNexusPlayers(players);
  requireBetrayal(players.every(player => Object.hasOwn(permitted, player.faction)) &&
    players.filter(player => player.faction === 'ixians').length === 1,
  'Ixian Betrayal needs its native Ixian and permitted classic or Tleilaxu seats.');
}

/** A neutral acknowledgment depends on public held-card presence, never its face. */
export function ixianBetrayalResponders(cards: NexusState, players: readonly NexusPlayer[]): string[] {
  validateRoster(players);
  validateNexusCards(cards, players);
  return players.filter(player => !player.ally && player.faction !== 'ixians' &&
    cards.hands[player.id] !== null).map(player => player.id);
}
export function ixianBetrayalEligible(
  cards: NexusState, players: readonly NexusPlayer[], holder: string,
): boolean {
  validateRoster(players);
  validateNexusCards(cards, players);
  const seat = players.find(player => player.id === holder);
  return !!seat && !seat.ally && seat.faction !== 'ixians' && cards.hands[holder] === 'ixians' &&
    nexusCardMode('ixians', seat.faction, players.map(player => player.faction)) === 'betrayal';
}
/** Only public original native attempt facts appear in the event. */
export function ixianBetrayalEvent(
  turn: number, sequence: number, kind: IxianBetrayalKind, provider: string,
): string {
  requireBetrayal(whole(turn) && turn > 0 && whole(sequence) && text(provider) &&
    (kind === 'bidding' || kind === 'technology'), 'Ixian Betrayal needs its original public event.');
  return JSON.stringify(['nexusIxianBetrayal', turn, sequence, kind, provider]);
}
function validateAuthority(authority: IxianBetrayalAuthority): void {
  requireBetrayal(exact(authority, ['kind', 'provider', 'nativeWindow', 'nativeContext',
    'nativeRequired', 'nativePassed']) && text(authority.provider) && text(authority.nativeContext) &&
    members(authority.nativeRequired) && members(authority.nativePassed) &&
    authority.nativeRequired.every(id => authority.nativePassed.includes(id)) &&
    ((authority.kind === 'bidding' && authority.nativeWindow === 'ixAuction') ||
      (authority.kind === 'technology' && authority.nativeWindow === 'ixTechnology')),
  'Ixian Betrayal must follow the settled original native counter window.');
}
function sourceAuthority(source: IxianBetrayalSource): IxianBetrayalAuthority {
  return { kind: source.kind, provider: source.provider, nativeWindow: source.nativeWindow,
    nativeContext: source.nativeContext, nativeRequired: source.nativeRequired, nativePassed: source.nativePassed };
}
function sourceSignature(source: IxianBetrayalSource): string {
  return JSON.stringify(['ixianBetrayalSource', source.version, source.event, source.turn,
    source.phase, source.advanced, source.sequence, source.kind, source.provider,
    source.nativeWindow, source.nativeContext, source.nativeRequired, source.nativePassed,
    source.required, source.eligible, source.parent]);
}
function savedSource(value: unknown): value is IxianBetrayalSource {
  return exact(value, ['version', 'event', 'turn', 'phase', 'advanced', 'sequence',
    'kind', 'provider', 'nativeWindow', 'nativeContext', 'nativeRequired', 'nativePassed',
    'required', 'eligible', 'parent', 'signature']) && value.version === 1 && whole(value.turn) &&
    value.turn > 0 && value.phase === 3 && whole(value.sequence) && typeof value.advanced === 'boolean' &&
    text(value.event) && text(value.parent) && text(value.signature) && members(value.required) &&
    (value.eligible === null || text(value.eligible)) && text(value.provider) && text(value.nativeContext) &&
    members(value.nativeRequired) && members(value.nativePassed) &&
    (value.kind === 'bidding' || value.kind === 'technology') &&
    (value.nativeWindow === 'ixAuction' || value.nativeWindow === 'ixTechnology');
}
function validateSavedSource(value: unknown): asserts value is IxianBetrayalSource {
  requireBetrayal(savedSource(value), 'Ixian Betrayal lost its original canonical source.');
  const source = value;
  validateAuthority(sourceAuthority(source));
  requireBetrayal((source.kind !== 'technology' || source.advanced) &&
    !source.required.includes(source.provider) &&
    (source.eligible === null || source.required.includes(source.eligible)) &&
    source.event === ixianBetrayalEvent(source.turn, source.sequence, source.kind, source.provider) &&
    source.signature === sourceSignature(source),
  'Ixian Betrayal changed its original event or native source.');
}
function validateContext(ctx: IxianBetrayalContext): void {
  requireBetrayal(plain(ctx) && ctx.status === 'playing' && ctx.phase === 3 && whole(ctx.turn) &&
    ctx.turn > 0 && whole(ctx.sequence) && typeof ctx.advanced === 'boolean',
  'Ixian Betrayal needs its current Bidding phase and independent cursor.');
  validateRoster(ctx.players);
  validateNexusCards(ctx.cards, ctx.players);
  validatePhysical(ctx.physicalCards);
}
export function validateIxianBetrayalSource(
  ctx: IxianBetrayalContext, source: IxianBetrayalSource,
  authority: IxianBetrayalAuthority, parent: string,
): void {
  validateSavedSource(source);
  validateContext(ctx);
  validateAuthority(authority);
  requireBetrayal(source.turn === ctx.turn && source.sequence === ctx.sequence &&
    source.advanced === ctx.advanced && source.parent === parent && text(parent) &&
    ctx.players.find(player => player.id === source.provider)?.faction === 'ixians' &&
    source.nativeRequired.every(id => ctx.players.some(player => player.id === id)) &&
    source.nativePassed.every(id => ctx.players.some(player => player.id === id)) &&
    source.kind === authority.kind && source.provider === authority.provider &&
    source.nativeWindow === authority.nativeWindow && source.nativeContext === authority.nativeContext &&
    sameMembers(source.nativeRequired, authority.nativeRequired) &&
    sameMembers(source.nativePassed, authority.nativePassed) &&
    sameMembers(source.required, ixianBetrayalResponders(ctx.cards, ctx.players)) &&
    source.eligible === (ctx.players.find(player => !player.ally && player.faction !== 'ixians' &&
      ctx.cards.hands[player.id] === 'ixians')?.id ?? null),
  'Ixian Betrayal no longer matches its current native attempt, parent or public responders.');
}
export function createIxianBetrayalSource(
  ctx: IxianBetrayalContext, authority: IxianBetrayalAuthority, parent: string,
): IxianBetrayalSource {
  validateContext(ctx);
  validateAuthority(authority);
  const source: IxianBetrayalSource = {
    ...authority, nativeRequired: [...authority.nativeRequired], nativePassed: [...authority.nativePassed],
    version: 1, event: ixianBetrayalEvent(ctx.turn, ctx.sequence, authority.kind, authority.provider),
    turn: ctx.turn, phase: 3, advanced: ctx.advanced, sequence: ctx.sequence,
    required: ixianBetrayalResponders(ctx.cards, ctx.players),
    eligible: ctx.players.find(player => !player.ally && player.faction !== 'ixians' &&
      ctx.cards.hands[player.id] === 'ixians')?.id ?? null,
    parent, signature: '',
  };
  source.signature = sourceSignature(source);
  validateIxianBetrayalSource(ctx, source, authority, parent);
  return source;
}
/** Validate before any Nexus cost or native continuation, including Pass. */
export function validateIxianBetrayalFrame(
  ctx: IxianBetrayalContext, source: IxianBetrayalSource,
  authority: IxianBetrayalAuthority, parent: string,
  required: readonly string[], passed: readonly string[],
): void {
  validateIxianBetrayalSource(ctx, source, authority, parent);
  requireBetrayal(members(required) && members(passed) && sameMembers(required, source.required) &&
    passed.every(id => required.includes(id)),
  'Ixian Betrayal lost its exact public required or passed membership.');
}
export function initialIxianBetrayalCursor(): IxianBetrayalCursor {
  return { sequence: 0, signature: genesis };
}
function validateCursor(value: unknown): asserts value is IxianBetrayalCursor {
  requireBetrayal(exact(value, ['sequence', 'signature']) && whole(value.sequence) && text(value.signature) &&
    (value.sequence !== 0 || value.signature === genesis),
  'Ixian Betrayal lost its independent closed-event cursor.');
}
function copySource(source: IxianBetrayalSource): IxianBetrayalSource {
  return { ...source, nativeRequired: [...source.nativeRequired], nativePassed: [...source.nativePassed],
    required: [...source.required] };
}
function receiptSignature(receipt: IxianBetrayalReceipt): string {
  return JSON.stringify(['ixianBetrayalReceipt', receipt.source.signature, receipt.outcome,
    receipt.holder, receipt.previous]);
}
/** A bounded previous-event link, not the previous receipt's full signature. */
function receiptHead(receipt: IxianBetrayalReceipt): string {
  return JSON.stringify(['ixianBetrayalHead', receipt.source.event, receipt.outcome, receipt.holder]);
}
export function closeIxianBetrayalSource(
  source: IxianBetrayalSource, outcome: 'pass' | 'use', holder: string | null,
  previous: IxianBetrayalCursor,
): { receipt: IxianBetrayalReceipt; cursor: IxianBetrayalCursor } {
  validateSavedSource(source);
  validateCursor(previous);
  requireBetrayal(source.sequence === previous.sequence && previous.sequence < Number.MAX_SAFE_INTEGER &&
    (outcome === 'pass' ? holder === null : outcome === 'use' && text(holder) && holder === source.eligible),
  'Ixian Betrayal cannot close twice or lose its actual response outcome.');
  const receipt: IxianBetrayalReceipt = {
    source: copySource(source), outcome, holder, previous: previous.signature, signature: '',
  };
  receipt.signature = receiptSignature(receipt);
  return { receipt, cursor: { sequence: previous.sequence + 1, signature: receiptHead(receipt) } };
}
/** Historical custody is not current ownership: the physical Nexus or Treachery
 * cards may since have been discarded, transferred and recycled. These links
 * check consistency, not authentication of arbitrary rewritten saved games. */
export function validateIxianBetrayalHistory(
  history: readonly IxianBetrayalReceipt[], cursor: IxianBetrayalCursor,
  physical?: readonly Card[],
): void {
  validateCursor(cursor);
  requireBetrayal(array(history) && history.length === cursor.sequence,
    'Ixian Betrayal history has missing or duplicate closed attempts.');
  if (physical !== undefined) validatePhysical(physical);
  let previous = genesis, turn = 0;
  const events = new Set<string>();
  for (const [index, receipt] of history.entries()) {
    requireBetrayal(exact(receipt, ['source', 'outcome', 'holder', 'previous', 'signature']),
      'Ixian Betrayal history has a malformed receipt.');
    validateSavedSource(receipt.source);
    requireBetrayal(receipt.source.sequence === index && receipt.source.turn >= turn &&
      !events.has(receipt.source.event) && receipt.previous === previous &&
      (receipt.outcome === 'pass' ? receipt.holder === null : receipt.outcome === 'use' &&
        text(receipt.holder) && receipt.holder === receipt.source.eligible) &&
      receipt.signature === receiptSignature(receipt),
    'Ixian Betrayal history changed its native attempt, outcome or continuation chain.');
    events.add(receipt.source.event);
    previous = receiptHead(receipt);
    turn = receipt.source.turn;
  }
  requireBetrayal(cursor.signature === previous,
    'Ixian Betrayal history no longer matches its independent cursor.');
}
