import type { Game } from './engine';

type OrdinaryDiscard = Extract<
  NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
  { kind: 'ordinaryCardDiscard' }
>;

/** Only Ghola creates this conditional income after its physical effect. The
 * same source qualification governs the fresh offer and its saved parent. */
export function ordinaryDiscardIncomeMatches(
  game: Pick<Game, 'players'>,
  continuation: Pick<OrdinaryDiscard, 'effect' | 'player' | 'resume'>,
): boolean {
  const income = continuation.resume.response;
  const tleilaxu = game.players.find(player => player.faction === 'tleilaxu');
  return continuation.effect === 'ghola' && tleilaxu
    ? income?.kind === 'revivalIncome' && income.owner === tleilaxu.id &&
      income.recipient === continuation.player && income.amount === 1 &&
      income.passed.length === 0
    : !income;
}
