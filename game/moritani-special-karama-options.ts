import {
  validateMoritaniSpecialKaramaChoice,
  type MoritaniSpecialKaramaAction,
  type MoritaniSpecialKaramaQuote,
} from './moritani-special-karama';

/**
 * Public-quote-only first version: deny useful played weapons/defenses. Null
 * means decline; the engine supplies its own opportunity-specific action.
 * No opposing hand, hidden plans or speculative future battle are consulted.
 */
export function moritaniSpecialKaramaBotAction(
  quote: MoritaniSpecialKaramaQuote,
): MoritaniSpecialKaramaAction | null {
  const karama = quote.karamas[0];
  if (!karama) return null;
  const discard = quote.playedCards.filter(card =>
    quote.keepableIds.includes(card.id) && [
      'projectile', 'poison', 'lasgun', 'shield', 'snooper', 'poisonBlade',
      'shieldSnooper', 'weirdingWay', 'chemistry', 'poisonTooth', 'artillery',
    ].includes(card.kind),
  ).map(card => card.id);
  // Cards already destined for compulsory disposal give no benefit for the cost.
  if (!discard.length) return null;
  const action: MoritaniSpecialKaramaAction = {
    type: 'card',
    mode: 'special',
    card: karama.id,
    event: quote.source.event,
    keep: [],
    discard,
  };
  validateMoritaniSpecialKaramaChoice(quote, quote.source, quote.source.owner, action);
  return action;
}
