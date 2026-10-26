export type PrintedCardEffect = 'hajr' | 'ghola';
export type PrintedCardPlayCounts = {
  turn: number;
  plays: { player: string; effect: PrintedCardEffect; count: number }[];
};

export class PrintedCardPlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrintedCardPlayError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new PrintedCardPlayError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const effect = (value: unknown): value is PrintedCardEffect => value === 'hajr' || value === 'ghola';

function validateCounts(counts: unknown): asserts counts is PrintedCardPlayCounts {
  check(object(counts) && keys(counts, 'plays,turn') && positive(counts.turn) && Array.isArray(counts.plays),
    'Retain the original turn and accepted printed-card play counts.');
  const seen = new Set<string>();
  for (const play of counts.plays) {
    check(object(play) && keys(play, 'count,effect,player') && identifier(play.player) &&
      effect(play.effect) && positive(play.count), 'Retain each player’s safe positive printed-role play count.');
    const key = JSON.stringify([play.player, play.effect]);
    check(!seen.has(key), 'Retain one printed-card count per player and effect.');
    seen.add(key);
  }
}

function validateRequest(player: unknown, turn: unknown, cardEffect: unknown): void {
  check(identifier(player) && positive(turn) && effect(cardEffect),
    'Choose the printed Hajr or Ghola play, current turn and exact player.');
}

/** Private native witness baseline only. Per-answer promises track their own
 * future interval, rather than treating these earlier accepted plays as new. */
export function printedCardPlayCount(counts: PrintedCardPlayCounts | undefined, player: string,
  turn: number, cardEffect: PrintedCardEffect): number {
  validateRequest(player, turn, cardEffect);
  if (counts === undefined) return 0;
  validateCounts(counts);
  return counts.turn === turn ? counts.plays.find(play => play.player === player && play.effect === cardEffect)?.count ?? 0 : 0;
}

/** Call once for each actually accepted printed-role play, never for an effect,
 * sale, discard, recovery or role conversion. Genuine reacquisition may replay. */
export function recordPrintedCardPlay(counts: PrintedCardPlayCounts | undefined, player: string,
  turn: number, cardEffect: PrintedCardEffect): PrintedCardPlayCounts {
  validateRequest(player, turn, cardEffect);
  if (counts !== undefined) {
    validateCounts(counts);
    check(turn >= counts.turn, 'An accepted printed-card play cannot be recorded in a past turn.');
  }
  const plays = counts?.turn === turn ? counts.plays.map(play => ({ ...play })) : [];
  const prior = plays.find(play => play.player === player && play.effect === cardEffect);
  if (prior) {
    check(Number.isSafeInteger(prior.count + 1), 'The printed-card play count exceeds the safe integer range.');
    prior.count++;
  } else plays.push({ player, effect: cardEffect, count: 1 });
  return { turn, plays };
}
