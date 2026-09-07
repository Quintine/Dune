import type { Card } from './cards';
import { richeseCardDefinition } from './richese-cards';

export const SEMUTA_DRUG_ID = 'richese-semuta-drug';
export type FreshDiscardBatch = {
  event: string;
  turn: number;
  phase: number;
  cause: string;
  entries: readonly {
    card: Card;
    discardedBy: string;
    publicFace: boolean;
  }[];
};
export type SemutaContext = {
  batch: FreshDiscardBatch;
  /** Current authoritative opportunity, not values accepted from a client. */
  event: string;
  turn: number;
  phase: number;
  owner: string;
  ownerHand: readonly Card[];
  discard: readonly Card[];
  semutaId: string;
  handLimit: number;
  incomingReservedSlots: number;
  /** Mandatory caller policy; neither full-hand ruling is inferred here. */
  capacityPolicy: 'exchange' | 'freeSlot';
  reservedTargetIds: readonly string[];
};
export type SemutaCommitment = {
  event: string;
  player: string;
  semutaId: typeof SEMUTA_DRUG_ID;
};
export type SemutaResult = {
  ownerHand: Card[];
  discard: Card[];
  /** Detached receipts, not extra physical cards or permission to publish faces. */
  usedCard: Card;
  claimedCard: Card;
};

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
const identity = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function cardShape(card: Card) {
  return (
    !!card &&
    identity(card.id) &&
    identity(card.name) &&
    kinds.has(card.kind) &&
    (card.effect === undefined || identity(card.effect))
  );
}
function sameCard(a: Card, b: Card) {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.kind === b.kind &&
    a.effect === b.effect
  );
}
function validate(context: SemutaContext) {
  if (
    !context ||
    !identity(context.owner) ||
    !identity(context.event) ||
    !count(context.turn) ||
    !count(context.phase) ||
    context.phase > 8 ||
    !Array.isArray(context.ownerHand) ||
    !Array.isArray(context.discard) ||
    !Array.isArray(context.reservedTargetIds) ||
    context.reservedTargetIds.some((id) => !identity(id)) ||
    new Set(context.reservedTargetIds).size !== context.reservedTargetIds.length
  )
    throw new Error(
      'Semuta requires a current owner, event and physical card custody.',
    );
  if (
    !count(context.handLimit) ||
    !count(context.incomingReservedSlots) ||
    !['exchange', 'freeSlot'].includes(context.capacityPolicy)
  )
    throw new Error(
      'Semuta requires an explicit capacity policy and nonnegative safe hand limits and reservations.',
    );
  const occupied = context.ownerHand.length;
  const room = context.handLimit - context.incomingReservedSlots;
  if (
    occupied > room ||
    (context.capacityPolicy === 'freeSlot' && occupied >= room)
  )
    throw new Error(
      'The selected Semuta capacity policy leaves no available hand capacity.',
    );
  const seen = new Set<string>();
  for (const card of [
    ...Array.from(context.ownerHand),
    ...Array.from(context.discard),
  ]) {
    if (!cardShape(card) || seen.has(card.id))
      throw new Error(
        'Semuta requires unique physical Treachery cards across hand and discard.',
      );
    seen.add(card.id);
  }
  const activation = context.ownerHand.find(
    (card) => card.id === context.semutaId,
  );
  if (
    context.semutaId !== SEMUTA_DRUG_ID ||
    !activation ||
    richeseCardDefinition(activation)?.card.effect !== 'semutaDrug'
  )
    throw new Error('Play the canonical Semuta Drug physically in your hand.');
  const batch = context.batch;
  if (
    !batch ||
    !identity(batch.event) ||
    !identity(batch.cause) ||
    batch.event !== context.event ||
    batch.turn !== context.turn ||
    batch.phase !== context.phase ||
    !Array.isArray(batch.entries) ||
    !batch.entries.length
  )
    throw new Error(
      'This fresh discard opportunity is invalid or has expired.',
    );
  const batchIds = new Set<string>();
  for (const entry of Array.from(batch.entries)) {
    if (
      !entry ||
      !cardShape(entry.card) ||
      !identity(entry.discardedBy) ||
      typeof entry.publicFace !== 'boolean' ||
      batchIds.has(entry.card.id)
    )
      throw new Error(
        'The fresh discard batch must contain unique owned Treachery cards.',
      );
    batchIds.add(entry.card.id);
    const actual = context.discard.find((card) => card.id === entry.card.id);
    if (!actual || !sameCard(actual, entry.card))
      throw new Error(
        'The fresh discard batch no longer matches physical discard custody.',
      );
  }
  const reserved = new Set(context.reservedTargetIds);
  const candidates = batch.entries
    .filter(
      (entry) =>
        entry.discardedBy !== context.owner && !reserved.has(entry.card.id),
    )
    .map((entry) => entry.card);
  if (!candidates.length)
    throw new Error(
      'No available other-player card belongs to this fresh discard opportunity.',
    );
  return { activation, candidates };
}

/**
 * Caller must persist an irrevocable, authenticated commitment before exposing
 * this result. This pure function checks its binding, not server authorization.
 * No optional or free-preview variant exists. publicFace does not expand access.
 */
export function committedSemutaCandidates(
  context: SemutaContext,
  commitment: SemutaCommitment,
): Card[] {
  if (
    !commitment ||
    commitment.event !== context?.event ||
    commitment.player !== context?.owner ||
    commitment.semutaId !== SEMUTA_DRUG_ID ||
    commitment.semutaId !== context?.semutaId
  )
    throw new Error(
      'Commit Semuta to this exact owner and event before inspecting candidates.',
    );
  return structuredClone(validate(context).candidates);
}

/**
 * Fresh-event transfer only. Engine owns timing, globally unique custody outside
 * these supplied zones, activation reservations and persisted commitment. A
 * direct selection is also usable when the target face is already authorized.
 * Capacity is evaluated under the caller's explicit ruling; no spice is paid.
 */
export function resolveSemutaDrug(
  context: SemutaContext,
  selectedId: string,
): SemutaResult {
  const { activation, candidates } = validate(context);
  const selected = candidates.find((card) => card.id === selectedId);
  if (!selected)
    throw new Error(
      'Choose one available other-player card from this fresh discard event.',
    );
  // The logical acquisition precedes discarding Semuta. Neither intermediate
  // hand nor the caller's inputs escape this pure atomic operation.
  const acquired = [...context.ownerHand, selected];
  return {
    ownerHand: structuredClone(
      acquired.filter((card) => card.id !== activation.id),
    ),
    discard: structuredClone([
      ...context.discard.filter((card) => card.id !== selected.id),
      activation,
    ]),
    usedCard: structuredClone(activation),
    claimedCard: structuredClone(selected),
  };
}
