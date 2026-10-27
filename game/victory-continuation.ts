/** Provisional online agreement for the supplied Advanced rule allowing
 * qualifying players and alliances to continue rather than share victory.
 * Only public qualifiers belong here; a Bene Gesserit prediction is private. */
export const MAX_VICTORY_EXTRA_STRONGHOLDS = 20;

export type VictoryContinuationResume = 'mentat' | 'advance';
export type VictoryContinuation = {
  version: 1;
  event: string;
  turn: number;
  resume: VictoryContinuationResume;
  order: string[];
  sides: string[][];
  voters: string[];
  accepted: string[];
  extraStrongholds: number | null;
};
export type VictoryContinuationChoice = {
  event: string;
  player: string;
  choice: 'continue' | 'finish';
  /** Only the first voter chooses the shared increment. */
  extraStrongholds?: number;
};
export type VictoryContinuationVote =
  | { outcome: 'pending'; frame: VictoryContinuation }
  | { outcome: 'finish' }
  | { outcome: 'continue'; extraStrongholds: number };

export class VictoryContinuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VictoryContinuationError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id);
const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
function requireContinuation(condition: unknown, message: string): asserts condition {
  if (!condition) throw new VictoryContinuationError(message);
}
function validExtra(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_VICTORY_EXTRA_STRONGHOLDS;
}

/** Normalize duplicates from the two rows representing one reciprocal alliance.
 * Distinct sides must be disjoint and contain only actual seated players. */
function canonicalSides(order: readonly string[], sides: readonly (readonly string[])[]): string[][] {
  requireContinuation(Array.isArray(sides), 'Retain the qualifying victory sides.');
  const unique: string[][] = [];
  for (const side of sides) {
    requireContinuation(ids(side) && side.length >= 1 && side.length <= 2 &&
      new Set(side).size === side.length && side.every(player => order.includes(player)),
    'Every qualifying side must contain one or two distinct seated players.');
    const members = order.filter(player => side.includes(player));
    if (!unique.some(existing => same(existing, members))) unique.push(members);
  }
  unique.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  requireContinuation(unique.length >= 2 && unique.some(side => side.length === 2),
    'The provisional continuation needs multiple qualifying sides including an alliance.');
  const members = unique.flat();
  requireContinuation(new Set(members).size === members.length,
    'Qualifying victory sides cannot overlap.');
  return unique;
}

export function createVictoryContinuation(input: {
  event: string;
  turn: number;
  resume: VictoryContinuationResume;
  order: readonly string[];
  sides: readonly (readonly string[])[];
}): VictoryContinuation {
  requireContinuation(record(input) && id(input.event) && Number.isSafeInteger(input.turn) &&
    input.turn >= 1 && input.turn <= 9 && (input.resume === 'mentat' || input.resume === 'advance') &&
    ids(input.order) && input.order.length >= 2 && input.order.length <= 6 &&
    new Set(input.order).size === input.order.length,
  'The shared victory agreement needs a current turn before turn ten and distinct seated players.');
  const order = [...input.order], sides = canonicalSides(order, input.sides);
  const voters = order.filter(player => sides.some(side => side.includes(player)));
  return { version: 1, event: input.event, turn: input.turn, resume: input.resume,
    order, sides, voters, accepted: [], extraStrongholds: null };
}

/** Check the full public receipt before projecting or accepting each vote. */
export function validateVictoryContinuation(frame: VictoryContinuation): void {
  requireContinuation(record(frame) &&
    Object.keys(frame).sort().join(',') === 'accepted,event,extraStrongholds,order,resume,sides,turn,version,voters' &&
    frame.version === 1 && id(frame.event) && Number.isSafeInteger(frame.turn) && frame.turn >= 1 && frame.turn <= 9 &&
    (frame.resume === 'mentat' || frame.resume === 'advance') &&
    ids(frame.order) && frame.order.length >= 2 && frame.order.length <= 6 &&
    new Set(frame.order).size === frame.order.length && ids(frame.voters) && ids(frame.accepted),
  'The saved shared victory agreement is malformed.');
  const canonical = canonicalSides(frame.order, frame.sides);
  requireContinuation(frame.sides.length === canonical.length &&
    frame.sides.every((side, index) => same(side, canonical[index])),
  'The saved qualifying sides no longer match their public order.');
  const voters = frame.order.filter(player => canonical.some(side => side.includes(player)));
  requireContinuation(same(frame.voters, voters) && frame.accepted.length < voters.length &&
    same(frame.accepted, voters.slice(0, frame.accepted.length)) &&
    (frame.accepted.length === 0 ? frame.extraStrongholds === null : validExtra(frame.extraStrongholds)),
  'The saved shared victory agreement lost its original ordered votes or proposal.');
}

/** Continue only on unanimous acceptance of one exact public proposal. A vote
 * to finish awards the original result through the caller's native settlement. */
export function voteVictoryContinuation(frame: VictoryContinuation,
  choice: VictoryContinuationChoice): VictoryContinuationVote {
  validateVictoryContinuation(frame);
  requireContinuation(record(choice) &&
    Object.keys(choice).every(key => ['event', 'player', 'choice', 'extraStrongholds'].includes(key)) &&
    choice.event === frame.event && choice.player === frame.voters[frame.accepted.length] &&
    (choice.choice === 'continue' || choice.choice === 'finish'),
  'Choose at your current shared victory agreement opportunity.');
  if (choice.choice === 'finish') {
    requireContinuation(choice.extraStrongholds === undefined, 'Finishing cannot alter the victory target.');
    return { outcome: 'finish' };
  }
  const first = frame.accepted.length === 0;
  requireContinuation(first ? validExtra(choice.extraStrongholds) : choice.extraStrongholds === undefined,
    first ? `Choose an extra stronghold count from 0 to ${MAX_VICTORY_EXTRA_STRONGHOLDS}.`
      : 'Accept the original proposal without changing its target.');
  const extra = first ? choice.extraStrongholds! : frame.extraStrongholds!;
  const accepted = [...frame.accepted, choice.player];
  if (accepted.length === frame.voters.length) return { outcome: 'continue', extraStrongholds: extra };
  const next: VictoryContinuation = { ...frame, order: [...frame.order], sides: frame.sides.map(side => [...side]),
    voters: [...frame.voters], accepted, extraStrongholds: extra };
  validateVictoryContinuation(next);
  return { outcome: 'pending', frame: next };
}
