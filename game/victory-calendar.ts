/** Provisional calendar for an agreement to play another full turn.
 * Older games omit the marker and retain the printed ten-turn calendar. */
export type VictoryCalendar = {
  turn: number;
  victoryFinalTurn?: number;
};

export class VictoryCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VictoryCalendarError';
  }
}

/** Return the agreed final turn while rejecting a game that has already
 * advanced beyond its calendar. Does not mutate or migrate old games. */
export function victoryFinalTurn(calendar: VictoryCalendar): number {
  const turn = calendar?.turn;
  const finalTurn = calendar?.victoryFinalTurn === undefined ? 10 : calendar.victoryFinalTurn;
  if (!Number.isSafeInteger(turn) || turn < 1 ||
      !Number.isSafeInteger(finalTurn) || finalTurn < 10 || turn > finalTurn)
    throw new VictoryCalendarError('The current turn must belong to the agreed victory calendar.');
  return finalTurn;
}

/** Call after unanimous acceptance, before the turn advances. An agreement
 * earlier than the current final turn keeps that final turn unchanged. At the
 * final turn it moves the fallback exactly once to the next full turn. */
export function continueVictoryCalendar(calendar: VictoryCalendar): number {
  const finalTurn = victoryFinalTurn(calendar);
  if (calendar.turn !== finalTurn) return finalTurn;
  if (!Number.isSafeInteger(finalTurn + 1))
    throw new VictoryCalendarError('The agreed final turn cannot be extended safely.');
  return finalTurn + 1;
}
