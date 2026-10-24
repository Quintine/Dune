import type { Card } from './cards';
import type { FreshDiscardBatch } from './semuta-drug';

/** Remembered movement-relevant discard identities, never a public pile view. */
export type MovementDiscardKnowledge = Record<string, string[]>;
type Entries = FreshDiscardBatch['entries'];
type Knowledge = MovementDiscardKnowledge | undefined;

const relevant = (card: Card): boolean =>
  (card.kind === 'special' && (card.effect === 'hajr' || card.effect === 'ghola')) ||
  (card.kind === 'special' && card.id === 'richese-ornithopter' && card.effect === 'ornithopter') ||
  (card.kind === 'worthless' && card.name === 'Kulon');

function viewers(seats: readonly string[]): string[] {
  return [...new Set(seats)].sort();
}
function remembered(state: Knowledge, seats: readonly string[]) {
  return new Map(viewers(seats).map(player => [player, new Set(state?.[player] ?? [])]));
}
function finish(knowledge: Map<string, Set<string>>): Knowledge {
  const entries = [...knowledge].filter(([, ids]) => ids.size)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([player, ids]) => [player, [...ids].sort()] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Public disposal teaches every seat; private disposal teaches its actual
 * former holder only. Unrelated cards create no new preparation knowledge. */
export function recordMovementDiscardKnowledge(
  state: Knowledge, seats: readonly string[], entries: Entries,
): Knowledge {
  const knowledge = remembered(state, seats);
  for (const entry of entries) {
    if (!relevant(entry.card)) continue;
    for (const [player, known] of knowledge)
      if (entry.publicFace || entry.discardedBy === player) known.add(entry.card.id);
  }
  return finish(knowledge);
}

/** Current remembered faces only. An unknown face cannot become a preparation
 * witness merely because the authoritative pile happens to contain it. */
export function knownMovementDiscards(
  state: Knowledge, player: string, discard: readonly Card[],
): Card[] {
  const known = new Set(state?.[player] ?? []), selected = new Set<string>();
  return structuredClone(discard.filter(card => {
    if (!known.has(card.id) || !relevant(card) || selected.has(card.id)) return false;
    selected.add(card.id); return true;
  }));
}

/** A private Box choice may remove any remembered card. The paid search owner
 * alone knows the remaining eligible faces after the search has settled. */
export function recordMovementBoxKnowledge(
  _state: Knowledge, seats: readonly string[], owner: string, remainingDiscard: readonly Card[],
): Knowledge {
  const knowledge = remembered(undefined, seats);
  const own = knowledge.get(owner);
  if (own) for (const card of remainingDiscard) if (relevant(card)) own.add(card.id);
  return finish(knowledge);
}

/** Others cannot infer the privately selected member of a fresh mixed batch.
 * The committed claimant has inspected that batch and knows its remainder. */
export function recordMovementClaimKnowledge(
  state: Knowledge, seats: readonly string[], owner: string,
  batchEntries: Entries, claimedId: string,
): Knowledge {
  const knowledge = remembered(state, seats);
  const possible = new Set(batchEntries.map(entry => entry.card.id));
  for (const known of knowledge.values()) for (const id of possible) known.delete(id);
  const own = knowledge.get(owner);
  if (own) for (const { card } of batchEntries)
    if (card.id !== claimedId && relevant(card)) own.add(card.id);
  return finish(knowledge);
}

/** Rebuilding the draw deck removes all remembered discard preparation faces. */
export function clearMovementDiscardKnowledge(_state: Knowledge): Knowledge {
  return undefined;
}
