import type { Action, GameView } from './engine';
import { SEMUTA_DRUG_ID } from './semuta-drug';

/** The offer is public, but only this seat's hand can justify committing. The
 * fresh discard faces are never inspected until the private select stage. */
export function botSemutaActions(g: GameView): Action[] {
  const reaction = g.semutaReaction;
  if (g.status !== 'playing' || !reaction?.event) return [];

  if (reaction.stage === 'select') {
    // Only the committed claimant receives candidates. A mandatory selection
    // must still complete when no strategic preference is available.
    const choice = reaction.candidates.find((card) => card.id);
    return choice
      ? [{ type: 'semutaSelect', event: reaction.event, card: choice.id }]
      : [];
  }

  if (reaction.stage !== 'offer' || reaction.passed) return [];
  const own = g.players.find((player) => player.id === g.me);
  const hasSemuta = own?.hand?.some(
    (card) => card.id === SEMUTA_DRUG_ID &&
      card.kind === 'special' && card.effect === 'semutaDrug',
  );
  if (reaction.canCommit && !reaction.blocked && hasSemuta)
    return [{ type: 'semutaCommit', event: reaction.event }];
  return [{ type: 'semutaPass', event: reaction.event }];
}
