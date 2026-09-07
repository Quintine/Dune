import type { Game } from '../game/engine';
import type { Card } from '../game/cards';

/** Stage a selected hand in legacy component fixtures. Relocate the selected
 * physical IDs from prior deck/hand/discard custody instead of duplicating them.
 * This is scenario setup, not an engine action or a full-game initializer. */
export function placeFixtureHand(g: Game, index: number, cards: Card[]) {
  const ids = new Set(cards.map((c) => c.id));
  g.deck = g.deck.filter((c) => !ids.has(c.id));
  g.discard = g.discard.filter((c) => !ids.has(c.id));
  for (const p of g.players) p.hand = p.hand.filter((c) => !ids.has(c.id));
  g.players[index].hand = cards;
}
