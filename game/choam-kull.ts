import type { Card } from './cards';

export type KullPhaseRestriction = Readonly<{
  player: string;
  turn: number;
  phase: number;
}>;

export type KullContext = Readonly<{
  turn: number;
  phase: number;
  players: readonly Readonly<{ id: string; faction: string }>[];
}>;

/** Only intrinsic attempt data; the engine owns the typed intent and continuation. */
export type KullAttemptStamp = Readonly<{
  event: string;
  player: string;
  owner: string;
  card: string;
  turn: number;
  phase: number;
  form: 'printed' | 'substitution';
  stage: 'offer' | 'counter';
}>;

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value);
}

function stamp(turn: unknown, phase: unknown): boolean {
  return Number.isSafeInteger(turn) && (turn as number) > 0 &&
    Number.isSafeInteger(phase) && (phase as number) >= 0 && (phase as number) <= 8;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function validRestriction(value: unknown): value is KullPhaseRestriction {
  return plainRecord(value) &&
    Object.keys(value).sort().join(',') === 'phase,player,turn' &&
    identifier(value.player) && stamp(value.turn, value.phase);
}

function validContext(context: KullContext): boolean {
  return !!context && stamp(context.turn, context.phase) &&
    Array.isArray(context.players) && context.players.length > 0 &&
    context.players.every(player => player && identifier(player.id) && identifier(player.faction)) &&
    new Set(context.players.map(player => player.id)).size === context.players.length;
}

/** Expiry is a turn AND phase comparison, not a ban on physical ownership. */
export function activeKullRestrictions(
  restrictions: readonly KullPhaseRestriction[] | undefined,
  turn: number,
  phase: number,
): KullPhaseRestriction[] {
  if (!stamp(turn, phase)) return [];
  return (restrictions ?? [])
    .filter(restriction => validRestriction(restriction) &&
      restriction.turn === turn && restriction.phase === phase)
    .map(({ player, turn: savedTurn, phase: savedPhase }) =>
      ({ player, turn: savedTurn, phase: savedPhase }));
}

export function kullBlocksKarama(
  restrictions: readonly KullPhaseRestriction[] | undefined,
  turn: number,
  phase: number,
  player: string,
): boolean {
  return identifier(player) && stamp(turn, phase) &&
    !!restrictions?.some(restriction => validRestriction(restriction) &&
      restriction.player === player && restriction.turn === turn && restriction.phase === phase);
}

/** Saved history may expire, but malformed, duplicate or future bans are not history. */
export function validateKullPhaseRestrictions(
  context: KullContext,
  restrictions: unknown,
): asserts restrictions is readonly KullPhaseRestriction[] {
  if (!validContext(context) || !Array.isArray(restrictions))
    throw new Error('Kull Wahad has lost its phase restriction history.');
  const seen = new Set<string>();
  for (const restriction of restrictions) {
    if (!validRestriction(restriction) ||
      !context.players.some(player => player.id === restriction.player) ||
      restriction.turn > context.turn ||
      (restriction.turn === context.turn && restriction.phase > context.phase))
      throw new Error('Kull Wahad has lost its phase restriction history.');
    const key = JSON.stringify([restriction.player, restriction.turn, restriction.phase]);
    if (seen.has(key)) throw new Error('Kull Wahad has duplicate phase restrictions.');
    seen.add(key);
  }
}

/** Extra frame fields belong to the engine's intent/signature validator, not this stamp. */
export function validateKullAttemptStamp(
  context: KullContext,
  attempt: KullAttemptStamp,
  physicalCards: readonly Card[],
): void {
  if (!validContext(context) || !plainRecord(attempt) ||
    !identifier(attempt.event) || !identifier(attempt.player) ||
    !identifier(attempt.owner) || !identifier(attempt.card) ||
    attempt.player === attempt.owner ||
    !context.players.some(player => player.id === attempt.player && player.faction === 'choam') ||
    !context.players.some(player => player.id === attempt.owner) ||
    !stamp(attempt.turn, attempt.phase) ||
    attempt.turn !== context.turn || attempt.phase !== context.phase ||
    (attempt.stage !== 'offer' && attempt.stage !== 'counter') ||
    (attempt.form !== 'printed' && attempt.form !== 'substitution') ||
    !Array.isArray(physicalCards) ||
    !uniquePhysicalCard(physicalCards, attempt.card))
    throw new Error('Kull Wahad has lost its original attempt, phase or physical card.');
}

/** The reserved original cannot pay for a second activation, even after JSON reload. */
export function distinctKullCounter(cardId: string, reservedCardId: string): boolean {
  return identifier(cardId) && identifier(reservedCardId) && cardId !== reservedCardId;
}

/** Missing or duplicated custody is not a usable physical identity. */
function uniquePhysicalCard(cards: readonly Card[], id: string): Card | undefined {
  let found: Card | undefined;
  for (const candidate of cards) {
    if (candidate?.id !== id) continue;
    if (found) return undefined;
    found = candidate;
  }
  return found;
}
/** Both the hand and the supplied conserved physical inventory must contain one identity. */
function uniquelyHeld(card: Card, held: readonly Card[], physicalCards: readonly Card[]): boolean {
  if (!identifier(card.id) || !uniquePhysicalCard(held, card.id)) return false;
  const canonical = uniquePhysicalCard(physicalCards, card.id);
  return !!canonical && card.name === canonical.name &&
    card.kind === canonical.kind && card.effect === canonical.effect;
}

/** Native printed Kull only. Nexus fuel is a separate, engine-authorized cost path. */
export function kullNativeCostCards(
  held: readonly Card[],
  physicalCards: readonly Card[],
  reservedIds: readonly string[] = [],
): Card[] {
  return held.filter(card => card?.id === 'ix-kull-wahad' &&
    card.name === 'Kull Wahad' && card.kind === 'worthless' && card.effect === undefined &&
    !reservedIds.includes(card.id) && uniquelyHeld(card, held, physicalCards));
}

/** The caller supplies effective eligibility (BG, Shrine, phase bans and live reservations).
 * This helper never reads a Game or infers activatability from a printed card alone. */
export function kullCounterCards(
  held: readonly Card[],
  physicalCards: readonly Card[],
  reservedCardId: string,
  isEffectivelyEligible: (card: Card) => boolean,
  reservedIds: readonly string[] = [],
): Card[] {
  return held.filter(card => card && distinctKullCounter(card.id, reservedCardId) &&
    !reservedIds.includes(card.id) && uniquelyHeld(card, held, physicalCards) &&
    isEffectivelyEligible(card));
}
