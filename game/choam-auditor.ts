import type { Card } from './cards';

export {
  CHOAM_AUDITOR_ID,
  isAuditorLeader,
  createAuditorLeader,
} from './cards';

function physicalId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * GF9 CHOAM & Richese p. 8: exclude cards actually used in this battle,
 * including any subsequently retained cards. The engine supplies those IDs
 * and the opponent's current hand; this helper does not discover hidden state.
 */
export function auditCandidates(
  hand: readonly Card[],
  usedIds: readonly string[],
): Card[] {
  if (
    !Array.isArray(hand) ||
    !Array.isArray(usedIds) ||
    usedIds.some((id) => !physicalId(id))
  )
    throw new Error('Auditor requires a hand and physical used-card IDs.');
  const used = new Set(usedIds);
  const seen = new Set<string>();
  const eligible: Card[] = [];
  for (const card of hand) {
    if (!card || !physicalId(card.id) || seen.has(card.id))
      throw new Error('Auditor requires unique physical cards in the hand.');
    seen.add(card.id);
    if (!used.has(card.id)) eligible.push(structuredClone(card));
  }
  return eligible;
}

function inspectionLimit(survived: boolean): number {
  if (typeof survived !== 'boolean')
    throw new Error('Auditor requires the actual leader survival outcome.');
  return survived ? 2 : 1;
}

/** Also the price to cancel the entire audit (printed p. 10 FAQ). */
export function auditCount(
  hand: readonly Card[],
  usedIds: readonly string[],
  survived: boolean,
): number {
  return Math.min(
    inspectionLimit(survived),
    auditCandidates(hand, usedIds).length,
  );
}

/**
 * Call once after the engine resolves cancellation/payment, and persist the
 * resulting private snapshot. A read or projection must never call this helper.
 * Partial Fisher-Yates samples physical cards uniformly without replacement.
 * Selecting the entire eligible pool consumes no randomness.
 */
export function sampleAuditCards(
  hand: readonly Card[],
  usedIds: readonly string[],
  survived: boolean,
  random: () => number,
): Card[] {
  const limit = inspectionLimit(survived);
  const eligible = auditCandidates(hand, usedIds);
  if (typeof random !== 'function')
    throw new Error('Auditor requires a server-supplied random source.');
  const count = Math.min(limit, eligible.length);
  if (count === eligible.length) return eligible;
  for (let i = 0; i < count; i++) {
    const draw = random();
    if (
      typeof draw !== 'number' ||
      !Number.isFinite(draw) ||
      draw < 0 ||
      draw >= 1
    )
      throw new Error('Auditor random draws must be finite numbers in [0, 1).');
    const j = i + Math.floor(draw * (eligible.length - i));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  return eligible.slice(0, count);
}
