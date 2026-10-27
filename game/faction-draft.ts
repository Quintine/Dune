import { FACTIONS, type FactionId } from './catalog';

/** Public prediction-card order and completed faction choices. No hidden deck
 * or session credential is stored here; the host deals once before selection. */
export type FactionDraft = {
  event: string;
  order: { player: string; card: number }[];
  picks: { player: string; faction: FactionId }[];
};

export class FactionDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactionDraftError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;
const factionId = (value: unknown): value is FactionId =>
  typeof value === 'string' && FACTIONS.some(faction => faction.id === value);
function requireDraft(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FactionDraftError(message);
}
function validateSeats(seats: readonly string[]): void {
  requireDraft(Array.isArray(seats) && seats.length >= 2 && seats.length <= 6 &&
    seats.every(identifier) && new Set(seats).size === seats.length,
  'A faction draft needs two through six distinct seated players.');
}
function validateEligible(factions: readonly FactionId[], seats: readonly string[]): void {
  requireDraft(Array.isArray(factions) && factions.length >= seats.length &&
    factions.length <= FACTIONS.length && factions.every(factionId) &&
    new Set(factions).size === factions.length,
  'The draft needs enough distinct enabled factions for every seat.');
}

/** numberCards are the unique prediction numbers dealt in seat order. */
export function createFactionDraft(
  seatIds: readonly string[], numberCards: readonly number[], event: string,
): FactionDraft {
  validateSeats(seatIds);
  requireDraft(identifier(event), 'The faction draft needs a distinct event.');
  requireDraft(Array.isArray(numberCards) && numberCards.length === seatIds.length &&
    numberCards.every(card => Number.isSafeInteger(card) && card >= 1 && card <= 10) &&
    new Set(numberCards).size === numberCards.length,
  'Deal one distinct prediction number from 1 through 10 to each seat.');
  return {
    event,
    order: seatIds.map((player, index) => ({ player, card: numberCards[index] }))
      .sort((left, right) => right.card - left.card),
    picks: [],
  };
}

/** Validate a saved public draft against its actual seats and allowed faction
 * pool. Picks are a prefix of the immutable descending-number order. */
export function validateFactionDraft(
  value: unknown, seatIds: readonly string[], eligibleFactions: readonly FactionId[],
): asserts value is FactionDraft {
  validateSeats(seatIds);
  validateEligible(eligibleFactions, seatIds);
  requireDraft(record(value) && keys(value, 'event,order,picks') && identifier(value.event) &&
    Array.isArray(value.order) && value.order.length === seatIds.length && Array.isArray(value.picks) &&
    value.picks.length <= seatIds.length,
  'The saved faction draft is malformed.');
  const order = value.order;
  const selected = new Set<string>();
  const dealt = new Set<number>();
  for (const [index, entry] of order.entries()) {
    requireDraft(record(entry) && keys(entry, 'card,player') && identifier(entry.player) &&
      seatIds.includes(entry.player) && !selected.has(entry.player) &&
      Number.isSafeInteger(entry.card) && (entry.card as number) >= 1 && (entry.card as number) <= 10 &&
      !dealt.has(entry.card as number) &&
      (index === 0 || (order[index - 1] as { card: number }).card > (entry.card as number)),
    'The faction draft must preserve distinct seated players and descending dealt numbers.');
    selected.add(entry.player);
    dealt.add(entry.card as number);
  }
  const factions = new Set<string>();
  for (const [index, pick] of value.picks.entries()) {
    requireDraft(record(pick) && keys(pick, 'faction,player') &&
      pick.player === (order[index] as { player: string }).player && factionId(pick.faction) &&
      eligibleFactions.includes(pick.faction) && !factions.has(pick.faction),
    'Faction choices must follow draft order and use distinct enabled factions.');
    factions.add(pick.faction);
  }
}

/** A validated completed draft has no current picker. */
export function currentFactionDrafter(draft: FactionDraft): string | null {
  requireDraft(record(draft) && Array.isArray(draft.order) && Array.isArray(draft.picks),
    'The saved faction draft is malformed.');
  const seats = draft.order.map(entry => record(entry) ? entry.player : undefined);
  requireDraft(seats.every(identifier), 'The saved faction draft has invalid seats.');
  validateFactionDraft(draft, seats, FACTIONS.map(faction => faction.id));
  return draft.order[draft.picks.length]?.player ?? null;
}

/** An accepted choice appends exactly once; the caller commits the returned
 * snapshot through the same authoritative version fence as other actions. */
export function chooseFaction(
  draft: FactionDraft, seatIds: readonly string[], eligibleFactions: readonly FactionId[],
  actor: string, faction: FactionId,
): FactionDraft {
  validateFactionDraft(draft, seatIds, eligibleFactions);
  requireDraft(identifier(actor) && currentFactionDrafter(draft) === actor,
    'Only the current faction drafter may choose.');
  requireDraft(factionId(faction) && eligibleFactions.includes(faction) &&
    !draft.picks.some(pick => pick.faction === faction),
  'Choose an enabled faction that has not already been selected.');
  return {
    event: draft.event,
    order: draft.order.map(entry => ({ ...entry })),
    picks: [...draft.picks.map(pick => ({ ...pick })), { player: actor, faction }],
  };
}
