import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

export type EcazBattleLeadQuote = { player: string; lowEcaz?: true };

/** Quote the printed Low Ecaz chooser at battle opening. The engine keeps this
 * original owner on the decision; later population changes do not reopen it. */
export function quoteEcazBattleLead(
  context: Pick<Game, 'advanced' | 'players' | 'homeworlds'>,
  ecazId: string,
  opponentId: string,
): EcazBattleLeadQuote {
  if (!context.players.some(player => player.id === ecazId && player.faction === 'ecaz') ||
    ecazId === opponentId || !context.players.some(player => player.id === opponentId))
    throw new HomeworldCustodyError('The combined battle needs its actual native Ecaz and a distinct seated opponent.');
  if (!context.homeworlds?.custody) return { player: ecazId };
  const low = homeworldPopulations(homeworldContext(context), context.homeworlds.custody)
    .some(home => home.native === ecazId && home.card === 'ecaz' && home.side === 'low');
  return low ? { player: opponentId, lowEcaz: true } : { player: ecazId };
}
