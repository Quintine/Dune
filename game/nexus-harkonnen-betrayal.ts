import { baseDeck, leaders, type Card } from './cards';
import {
  nexusCardMode, validateNexusCards, validateNexusPlayers,
  type NexusPlayer, type NexusState,
} from './nexus-cards';
import { validateNexusTraitorSnapshot, type NexusTraitorSnapshot } from './nexus-traitor-exchange';
import {
  validateTraitorDeclaration, type TraitorDeclaration, type TraitorDeclarationContext,
} from './traitor-declarations';
import { traitorDeck } from './traitors';

export type HarkonnenBetrayalAuthority = {
  provider: string;
  declaration: TraitorDeclaration;
  nativeWindow: 'direct' | 'harkonnenTraitor';
  nativeContext: string;
  nativeRequired: readonly string[];
  nativePassed: readonly string[];
};
type Battle = Omit<TraitorDeclarationContext, 'players'>;
export type HarkonnenBetrayalContext = {
  status: string;
  phase: number;
  turn: number;
  advanced: boolean;
  sequence: number;
  players: readonly NexusPlayer[];
  cards: NexusState;
  physicalCards: readonly Card[];
  traitors: NexusTraitorSnapshot;
  universe: readonly string[];
  battle: Battle;
};
export type HarkonnenBetrayalSource = HarkonnenBetrayalAuthority & {
  version: 1;
  event: string;
  turn: number;
  phase: 6;
  advanced: boolean;
  sequence: number;
  required: readonly string[];
  eligible: string | null;
  players: readonly NexusPlayer[];
  battle: Battle;
  universe: readonly string[];
  /** Current committed census only, never a requirement on later custody. */
  inventory: string;
  parent: string;
  signature: string;
};
export type HarkonnenBetrayalCursor = { sequence: number; signature: string };
export type HarkonnenBetrayalReceipt = {
  source: HarkonnenBetrayalSource;
  outcome: 'pass' | 'use';
  holder: string | null;
  previous: string;
  signature: string;
};
export type HarkonnenBetrayalReplacement = {
  version: 1;
  event: string;
  sequence: number;
  provider: string;
  turn: number;
  identity: string;
  /** Bounded head of the exact successful Use, not the latest cursor. */
  receipt: string;
  status: 'due' | 'drawn';
  drawn: string | null;
  signature: string;
};
export class HarkonnenBetrayalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HarkonnenBetrayalError';
  }
}
const genesis = 'harkonnen-betrayal:0';
const classic: Readonly<Record<string, true>> = {
  atreides: true, harkonnen: true, emperor: true, fremen: true, guild: true, beneGesserit: true,
};
const canonicalCards = new Map(baseDeck().map(card => [card.id, card]));
const declarationKeys = ['event', 'voter', 'beneficiary', 'target', 'leader', 'identity', 'signature'] as const;
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown): value is string => typeof value === 'string' &&
  value.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const array = (value: unknown): boolean => Array.isArray(value);
function requireBetrayal(value: unknown, message: string): asserts value {
  if (!value) throw new HarkonnenBetrayalError(message);
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return plain(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function members(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}
const equal = (one: unknown, two: unknown): boolean => JSON.stringify(one) === JSON.stringify(two);
function validateRoster(players: readonly NexusPlayer[]): void {
  validateNexusPlayers(players);
  requireBetrayal(players.every(player => Object.hasOwn(classic, player.faction)) &&
    players.filter(player => player.faction === 'harkonnen').length === 1,
  'Harkonnen Betrayal requires native Harkonnen and two through six classic seats.');
}
function roster(players: readonly NexusPlayer[]): NexusPlayer[] {
  return players.map(({ id, faction, ally }) => ({ id, faction, ally: ally ?? null }));
}
function canonicalUniverse(players: readonly NexusPlayer[]): string[] {
  return traitorDeck(players.map(player => ({ leaders: leaders(player.faction) })));
}
function validateUniverse(universe: readonly string[], players: readonly NexusPlayer[]): void {
  const expected = canonicalUniverse(players);
  requireBetrayal(members(universe) && universe.length === expected.length &&
    universe.every(identity => expected.includes(identity)),
  'Harkonnen Betrayal needs the original complete canonical classic Traitor universe.');
}
function validatePhysical(cards: readonly Card[]): void {
  requireBetrayal(Array.isArray(cards) && cards.length === canonicalCards.size &&
    new Set(cards.map(card => card?.id)).size === canonicalCards.size && cards.every(card => {
      if (!plain(card) || !text(card.id)) return false;
      const expected = canonicalCards.get(card.id);
      return !!expected && exact(card, ['id', 'name', 'kind',
        ...(expected.effect === undefined ? [] : ['effect'])]) && card.name === expected.name &&
        card.kind === expected.kind && card.effect === expected.effect;
    }), 'Harkonnen Betrayal requires complete unique canonical base33 Treachery custody.');
}
function validateBattle(battle: Battle): void {
  requireBetrayal(exact(battle, ['event', 'attacker', 'defender', 'plans', 'heroLeaderIds']) &&
    text(battle.event) && text(battle.attacker) && text(battle.defender) &&
    battle.attacker !== battle.defender && exact(battle.plans, [battle.attacker, battle.defender]) &&
    Array.isArray(battle.heroLeaderIds) && battle.heroLeaderIds.length === 0 &&
    Object.values(battle.plans).every(plan => plain(plan) &&
      exact(plan, ['leader', ...(Object.hasOwn(plan, 'kwisatz') ? ['kwisatz'] : [])]) &&
      (plan.leader === null || text(plan.leader)) &&
      (plan.kwisatz === undefined || typeof plan.kwisatz === 'boolean')),
  'Harkonnen Betrayal requires original sealed classic battle plans, without Ix heroes.');
}
function declarationContext(
  battle: Battle, players: readonly NexusPlayer[], traitors?: NexusTraitorSnapshot,
): TraitorDeclarationContext {
  return { ...battle, players: players.map(player => ({ ...player,
    traitors: traitors?.players.find(seat => seat.id === player.id)?.traitors ?? [],
  })) };
}
function validateAuthority(
  authority: HarkonnenBetrayalAuthority, players: readonly NexusPlayer[], battle: Battle,
): void {
  requireBetrayal(exact(authority, ['provider', 'declaration', 'nativeWindow', 'nativeContext',
    'nativeRequired', 'nativePassed']) && text(authority.provider) && text(authority.nativeContext) &&
    members(authority.nativeRequired) && members(authority.nativePassed) &&
    authority.nativeRequired.every(id => authority.nativePassed.includes(id)) &&
    [...authority.nativeRequired, ...authority.nativePassed].every(id => players.some(p => p.id === id)) &&
    players.find(player => player.id === authority.provider)?.faction === 'harkonnen' &&
    authority.declaration?.voter === authority.provider,
  'Harkonnen Betrayal must follow its original allowed native Harkonnen declaration.');
  try {
    validateTraitorDeclaration(declarationContext(battle, players), authority.declaration);
  } catch {
    throw new HarkonnenBetrayalError('Harkonnen Betrayal lost its canonical native declaration or roles.');
  }
  const direct = authority.declaration.beneficiary === authority.provider;
  requireBetrayal(direct ? authority.nativeWindow === 'direct' &&
    authority.nativeRequired.length === 0 && authority.nativePassed.length === 0 :
    authority.nativeWindow === 'harkonnenTraitor',
  'Harkonnen Betrayal cannot confuse personal calls with native allowed allied calls.');
  requireBetrayal(players.some(player => leaders(player.faction).some(leader =>
    leader.id === authority.declaration.leader)) && authority.declaration.identity === authority.declaration.leader,
  'Harkonnen Betrayal requires the opposing canonical classic leader identity.');
}
export function harkonnenBetrayalResponders(cards: NexusState, players: readonly NexusPlayer[]): string[] {
  validateRoster(players);
  validateNexusCards(cards, players);
  return players.filter(player => !player.ally && player.faction !== 'harkonnen' &&
    cards.hands[player.id] !== null).map(player => player.id);
}
export function harkonnenBetrayalEligible(
  cards: NexusState, players: readonly NexusPlayer[], holder: string,
): boolean {
  validateRoster(players);
  validateNexusCards(cards, players);
  const player = players.find(seat => seat.id === holder);
  return !!player && !player.ally && player.faction !== 'harkonnen' && cards.hands[holder] === 'harkonnen' &&
    nexusCardMode('harkonnen', player.faction, players.map(seat => seat.faction)) === 'betrayal';
}
export function harkonnenBetrayalEvent(
  turn: number, sequence: number, declaration: TraitorDeclaration, provider: string,
): string {
  requireBetrayal(whole(turn) && turn > 0 && whole(sequence) && text(provider) &&
    plain(declaration) && declarationKeys.every(key => text(declaration[key])) && declaration.voter === provider,
  'Harkonnen Betrayal requires its original public declared-card event.');
  return JSON.stringify(['nexusHarkonnenBetrayal', turn, sequence, declaration.event, provider,
    declaration.beneficiary, declaration.target, declaration.leader, declaration.identity]);
}
function validateContext(ctx: HarkonnenBetrayalContext): void {
  requireBetrayal(plain(ctx) && ctx.status === 'playing' && ctx.phase === 6 &&
    whole(ctx.turn) && ctx.turn > 0 && whole(ctx.sequence) && typeof ctx.advanced === 'boolean',
  'Harkonnen Betrayal requires its current Battle phase and independent cursor.');
  validateRoster(ctx.players);
  validateNexusCards(ctx.cards, ctx.players);
  validatePhysical(ctx.physicalCards);
  validateUniverse(ctx.universe, ctx.players);
  validateNexusTraitorSnapshot(ctx.traitors, ctx.universe);
  requireBetrayal(ctx.traitors.players.length === ctx.players.length &&
    ctx.players.every(player => ctx.traitors.players.some(seat =>
      seat.id === player.id && seat.faction === player.faction)),
  'Harkonnen Betrayal physical Traitor custody must match its original roster.');
  validateBattle(ctx.battle);
}
function sourceAuthority(source: HarkonnenBetrayalSource): HarkonnenBetrayalAuthority {
  return { provider: source.provider, declaration: source.declaration, nativeWindow: source.nativeWindow,
    nativeContext: source.nativeContext, nativeRequired: source.nativeRequired, nativePassed: source.nativePassed };
}
function inventory(ctx: HarkonnenBetrayalContext): string {
  return JSON.stringify([ctx.cards, ctx.traitors, ctx.physicalCards]);
}
function sourceSignature(source: HarkonnenBetrayalSource): string {
  return JSON.stringify(['harkonnenBetrayalSource', source.version, source.event, source.turn,
    source.phase, source.advanced, source.sequence, sourceAuthority(source), source.required,
    source.eligible, source.players, source.battle, source.universe, source.inventory, source.parent]);
}
function validateSavedSource(value: unknown): asserts value is HarkonnenBetrayalSource {
  requireBetrayal(exact(value, ['provider', 'declaration', 'nativeWindow', 'nativeContext',
    'nativeRequired', 'nativePassed', 'version', 'event', 'turn', 'phase', 'advanced', 'sequence',
    'required', 'eligible', 'players', 'battle', 'universe', 'inventory', 'parent', 'signature']) &&
    value.version === 1 && whole(value.turn) && value.turn > 0 && value.phase === 6 &&
    typeof value.advanced === 'boolean' && whole(value.sequence) && members(value.required) &&
    (value.eligible === null || text(value.eligible)) && text(value.event) && text(value.parent) &&
    text(value.signature) && text(value.inventory) && Array.isArray(value.players) &&
    plain(value.battle) && members(value.universe),
  'Harkonnen Betrayal lost its original canonical source.');
  // Shape checked above; nested values are validated by their native protocols.
  const source = value as HarkonnenBetrayalSource;
  validateRoster(source.players);
  requireBetrayal(source.players.every(player => exact(player, ['id', 'faction', 'ally'])),
    'Harkonnen Betrayal history must retain only the original public seat roles.');
  validateUniverse(source.universe, source.players);
  validateBattle(source.battle);
  validateAuthority(sourceAuthority(source), source.players, source.battle);
  // This is the original census, not today's holdings. Returning or redrawing
  // the declared card later cannot invalidate this historical declaration.
  let stored: unknown;
  try {
    stored = JSON.parse(source.inventory);
  } catch {
    throw new HarkonnenBetrayalError('Harkonnen Betrayal lost its original physical census.');
  }
  requireBetrayal(Array.isArray(stored) && stored.length === 3,
    'Harkonnen Betrayal lost its original physical census.');
  type SavedInventory = [NexusState, NexusTraitorSnapshot, readonly Card[]];
  const [cards, traitors, physicalCards] = stored as SavedInventory;
  validateNexusCards(cards, source.players);
  validateNexusTraitorSnapshot(traitors, source.universe);
  validatePhysical(physicalCards);
  requireBetrayal(traitors.players.length === source.players.length &&
    source.players.every(player => traitors.players.some(seat =>
      seat.id === player.id && seat.faction === player.faction)) &&
    traitors.players.find(player => player.id === source.provider)?.traitors.includes(source.declaration.identity) &&
    equal(source.required, harkonnenBetrayalResponders(cards, source.players)) &&
    source.eligible === (source.players.find(player =>
      harkonnenBetrayalEligible(cards, source.players, player.id))?.id ?? null),
  'Harkonnen Betrayal changed its original canonical custody or response eligibility.');
  requireBetrayal(source.required.every(id => source.players.some(player => player.id === id &&
    !player.ally && player.faction !== 'harkonnen')) &&
    (source.eligible === null || source.required.includes(source.eligible)) &&
    source.universe.includes(source.declaration.identity) &&
    source.event === harkonnenBetrayalEvent(source.turn, source.sequence, source.declaration, source.provider) &&
    source.signature === sourceSignature(source),
  'Harkonnen Betrayal changed its original event, roles or native source.');
}
export function validateHarkonnenBetrayalSource(
  ctx: HarkonnenBetrayalContext, source: HarkonnenBetrayalSource,
  authority: HarkonnenBetrayalAuthority, parent: string,
): void {
  validateSavedSource(source);
  validateContext(ctx);
  validateAuthority(authority, ctx.players, ctx.battle);
  requireBetrayal(source.turn === ctx.turn && source.sequence === ctx.sequence &&
    source.advanced === ctx.advanced && source.parent === parent && text(parent) &&
    source.provider === authority.provider && source.nativeWindow === authority.nativeWindow &&
    source.nativeContext === authority.nativeContext && equal(source.declaration, authority.declaration) &&
    equal(source.nativeRequired, authority.nativeRequired) && equal(source.nativePassed, authority.nativePassed) &&
    equal(source.players, roster(ctx.players)) &&
    equal(source.battle, ctx.battle) && equal(source.universe, ctx.universe) &&
    source.inventory === inventory(ctx) &&
    ctx.traitors.players.find(player => player.id === source.provider)?.traitors.includes(source.declaration.identity) &&
    equal(source.required, harkonnenBetrayalResponders(ctx.cards, ctx.players)) &&
    source.eligible === (ctx.players.find(player => harkonnenBetrayalEligible(ctx.cards, ctx.players, player.id))?.id ?? null),
  'Harkonnen Betrayal no longer matches its current native attempt, custody or public responders.');
}
export function createHarkonnenBetrayalSource(
  ctx: HarkonnenBetrayalContext, authority: HarkonnenBetrayalAuthority, parent: string,
): HarkonnenBetrayalSource {
  validateContext(ctx);
  validateAuthority(authority, ctx.players, ctx.battle);
  const source: HarkonnenBetrayalSource = {
    ...structuredClone(authority), version: 1,
    event: harkonnenBetrayalEvent(ctx.turn, ctx.sequence, authority.declaration, authority.provider),
    turn: ctx.turn, phase: 6, advanced: ctx.advanced, sequence: ctx.sequence,
    required: harkonnenBetrayalResponders(ctx.cards, ctx.players),
    eligible: ctx.players.find(player => harkonnenBetrayalEligible(ctx.cards, ctx.players, player.id))?.id ?? null,
    players: roster(ctx.players), battle: structuredClone(ctx.battle), universe: [...ctx.universe],
    inventory: inventory(ctx), parent, signature: '',
  };
  source.signature = sourceSignature(source);
  validateHarkonnenBetrayalSource(ctx, source, authority, parent);
  return source;
}
export function validateHarkonnenBetrayalFrame(
  ctx: HarkonnenBetrayalContext, source: HarkonnenBetrayalSource,
  authority: HarkonnenBetrayalAuthority, parent: string,
  required: readonly string[], passed: readonly string[],
): void {
  validateHarkonnenBetrayalSource(ctx, source, authority, parent);
  requireBetrayal(members(required) && members(passed) && equal(required, source.required) &&
    passed.every(id => required.includes(id)),
  'Harkonnen Betrayal lost its exact public required or passed membership.');
}
export function initialHarkonnenBetrayalCursor(): HarkonnenBetrayalCursor {
  return { sequence: 0, signature: genesis };
}
function validateCursor(value: unknown): asserts value is HarkonnenBetrayalCursor {
  requireBetrayal(exact(value, ['sequence', 'signature']) && whole(value.sequence) && text(value.signature) &&
    (value.sequence !== 0 || value.signature === genesis),
  'Harkonnen Betrayal lost its independent closed-event cursor.');
  if (value.sequence === 0) return;
  let head: unknown, event: unknown;
  try {
    head = JSON.parse(value.signature);
    if (Array.isArray(head) && typeof head[1] === 'string') event = JSON.parse(head[1]);
  } catch {
    throw new HarkonnenBetrayalError('Harkonnen Betrayal has a forged or recursive cursor head.');
  }
  requireBetrayal(Array.isArray(head) && head.length === 4 && head[0] === 'harkonnenBetrayalHead' &&
    (head[2] === 'pass' ? head[3] === null : head[2] === 'use' && text(head[3])) &&
    Array.isArray(event) && event.length === 9 && event[0] === 'nexusHarkonnenBetrayal' &&
    whole(event[1]) && event[1] > 0 && event[2] === value.sequence - 1 && event.slice(3).every(text) &&
    event[4] !== event[6] && event[5] !== event[6] && event[7] === event[8] &&
    value.signature === JSON.stringify(head) && head[1] === JSON.stringify(event),
  'Harkonnen Betrayal has a forged or recursive cursor head.');
}
function receiptSignature(receipt: HarkonnenBetrayalReceipt): string {
  return JSON.stringify(['harkonnenBetrayalReceipt', receipt.source.signature,
    receipt.outcome, receipt.holder, receipt.previous]);
}
function receiptHead(receipt: HarkonnenBetrayalReceipt): string {
  return JSON.stringify(['harkonnenBetrayalHead', receipt.source.event, receipt.outcome, receipt.holder]);
}
export function closeHarkonnenBetrayalSource(
  source: HarkonnenBetrayalSource, outcome: 'pass' | 'use', holder: string | null,
  cursor: HarkonnenBetrayalCursor,
): { receipt: HarkonnenBetrayalReceipt; cursor: HarkonnenBetrayalCursor } {
  validateSavedSource(source);
  validateCursor(cursor);
  requireBetrayal(source.sequence === cursor.sequence &&
    cursor.sequence < Number.MAX_SAFE_INTEGER && (outcome === 'pass' ? holder === null :
      outcome === 'use' && text(holder) && holder === source.eligible),
  'Harkonnen Betrayal cannot close twice or lose its actual response outcome.');
  const receipt: HarkonnenBetrayalReceipt = {
    source: structuredClone(source), outcome, holder, previous: cursor.signature, signature: '',
  };
  receipt.signature = receiptSignature(receipt);
  return { receipt, cursor: { sequence: cursor.sequence + 1, signature: receiptHead(receipt) } };
}
/** Historical declarations do not claim continued possession of recycled cards.
 * Signatures establish consistency, not authentication of rewritten saves. */
export function validateHarkonnenBetrayalHistory(
  history: readonly HarkonnenBetrayalReceipt[], cursor: HarkonnenBetrayalCursor,
  universe?: readonly string[],
): void {
  validateCursor(cursor);
  requireBetrayal(array(history) && history.length === cursor.sequence,
    'Harkonnen Betrayal history has missing or duplicated closed attempts.');
  let previous = genesis, turn = 0;
  let originalRoster: readonly NexusPlayer[] | undefined;
  let originalUniverse: readonly string[] | undefined;
  for (const [index, receipt] of history.entries()) {
    requireBetrayal(exact(receipt, ['source', 'outcome', 'holder', 'previous', 'signature']),
      'Harkonnen Betrayal history has a malformed receipt.');
    validateSavedSource(receipt.source);
    if (universe !== undefined) {
      validateUniverse(universe, receipt.source.players);
      requireBetrayal(equal(universe, receipt.source.universe), 'Harkonnen Betrayal changed its original universe.');
    }
    const identities = receipt.source.players.map(({ id, faction }) => ({ id, faction }));
    requireBetrayal(receipt.source.sequence === index && receipt.source.turn >= turn &&
      receipt.previous === previous &&
      (originalRoster === undefined || equal(originalRoster, identities)) &&
      (originalUniverse === undefined || equal(originalUniverse, receipt.source.universe)) &&
      (receipt.outcome === 'pass' ? receipt.holder === null : receipt.outcome === 'use' &&
        text(receipt.holder) && receipt.holder === receipt.source.eligible) &&
      receipt.signature === receiptSignature(receipt),
    'Harkonnen Betrayal history changed its native attempt, outcome or continuation chain.');
    originalRoster = identities;
    originalUniverse = receipt.source.universe;
    previous = receiptHead(receipt);
    turn = receipt.source.turn;
  }
  requireBetrayal(cursor.signature === previous,
    'Harkonnen Betrayal history no longer matches its independent cursor.');
}
function replacementSignature(replacement: HarkonnenBetrayalReplacement): string {
  return JSON.stringify(['harkonnenBetrayalReplacement', replacement.version, replacement.event,
    replacement.sequence, replacement.provider, replacement.turn, replacement.identity,
    replacement.receipt, replacement.status, replacement.drawn]);
}
export function createHarkonnenBetrayalReplacement(receipt: HarkonnenBetrayalReceipt): HarkonnenBetrayalReplacement {
  requireBetrayal(exact(receipt, ['source', 'outcome', 'holder', 'previous', 'signature']),
    'Harkonnen Betrayal replacement requires its exact closed native receipt.');
  validateSavedSource(receipt.source);
  validateCursor({ sequence: receipt.source.sequence, signature: receipt.previous });
  requireBetrayal(receipt.outcome === 'use' && text(receipt.holder) && receipt.holder === receipt.source.eligible &&
    text(receipt.previous) && receipt.signature === receiptSignature(receipt),
  'Only a successful Harkonnen Betrayal Use creates a Mentat replacement obligation.');
  const replacement: HarkonnenBetrayalReplacement = {
    version: 1, event: receipt.source.event, sequence: receipt.source.sequence,
    provider: receipt.source.provider, turn: receipt.source.turn, identity: receipt.source.declaration.identity,
    receipt: receiptHead(receipt), status: 'due', drawn: null, signature: '',
  };
  replacement.signature = replacementSignature(replacement);
  return replacement;
}
function validateReplacement(
  replacement: HarkonnenBetrayalReplacement, history: readonly HarkonnenBetrayalReceipt[],
): void {
  requireBetrayal(exact(replacement, ['version', 'event', 'sequence', 'provider', 'turn', 'identity',
    'receipt', 'status', 'drawn', 'signature']) && replacement.version === 1 &&
    whole(replacement.sequence) && whole(replacement.turn) && replacement.turn > 0 &&
    text(replacement.event) && text(replacement.provider) && text(replacement.identity) &&
    text(replacement.receipt) && text(replacement.signature) &&
    (replacement.status === 'due' ? replacement.drawn === null :
      replacement.status === 'drawn' && text(replacement.drawn)),
  'Harkonnen Betrayal has a malformed or repeated Mentat replacement.');
  const receipt = history[replacement.sequence];
  requireBetrayal(receipt?.outcome === 'use' && replacement.receipt === receiptHead(receipt) &&
    replacement.event === receipt.source.event && replacement.provider === receipt.source.provider &&
    replacement.turn === receipt.source.turn && replacement.identity === receipt.source.declaration.identity &&
    (replacement.drawn === null || receipt.source.universe.includes(replacement.drawn)) &&
    replacement.signature === replacementSignature(replacement),
  'Harkonnen Betrayal replacement lost its exact successful Use obligation or actual drawn identity.');
}
export function validateHarkonnenBetrayalReplacement(
  replacement: HarkonnenBetrayalReplacement, history: readonly HarkonnenBetrayalReceipt[],
  cursor: HarkonnenBetrayalCursor, universe?: readonly string[],
): void {
  validateHarkonnenBetrayalHistory(history, cursor, universe);
  validateReplacement(replacement, history);
}
export function drawHarkonnenBetrayalReplacement(
  replacement: HarkonnenBetrayalReplacement, history: readonly HarkonnenBetrayalReceipt[],
  cursor: HarkonnenBetrayalCursor, drawn: string, universe?: readonly string[],
): HarkonnenBetrayalReplacement {
  validateHarkonnenBetrayalReplacement(replacement, history, cursor, universe);
  requireBetrayal(replacement.status === 'due' && text(drawn) &&
    history[replacement.sequence].source.universe.includes(drawn),
  'Harkonnen Betrayal replacement draws exactly once from its actual canonical Traitor Deck.');
  const result: HarkonnenBetrayalReplacement = { ...replacement, status: 'drawn', drawn, signature: '' };
  result.signature = replacementSignature(result);
  return result;
}
export function validateHarkonnenBetrayalReplacements(
  history: readonly HarkonnenBetrayalReceipt[], cursor: HarkonnenBetrayalCursor,
  replacements: readonly HarkonnenBetrayalReplacement[], universe?: readonly string[],
): void {
  validateHarkonnenBetrayalHistory(history, cursor, universe);
  requireBetrayal(Array.isArray(replacements), 'Harkonnen Betrayal lost its replacement provenance.');
  for (const replacement of replacements) validateReplacement(replacement, history);
  const used = history.filter(receipt => receipt.outcome === 'use');
  requireBetrayal(replacements.length === used.length &&
    new Set(replacements.map(replacement => replacement.sequence)).size === replacements.length &&
    replacements.filter(replacement => replacement.status === 'due').length <= 1,
  'Every successful Harkonnen Betrayal Use requires exactly one due or completed private draw.');
}
