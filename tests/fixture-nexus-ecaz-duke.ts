import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { acquireDuke } from '../game/duke-vidal';
import { drawNexusCard } from '../game/nexus-cards';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';

/** Genuine setup and spice play; stage the quiet Battle boundary and draw one
 * physical Ecaz card from its existing deck into the native Ecaz seat. */
export function nexusEcazDukePosition(advanced = false,
  ids: [string, string, string] = ['p', 'q', 'r']): { game: Game; action: { type: string; event: string } } {
  const [owner, moritani] = ids;
  const game = nexusTraitorFixture({ ownerFaction: 'ecaz', opponentFaction: 'moritani',
    advanced, phase: 6, seatIds: ids });
  const cards = game.nexusCards!.cards!;
  const oldCard = cards.hands[owner]!;
  cards.hands[owner] = null;
  cards.deck.push(oldCard);
  const index = cards.deck.indexOf('ecaz');
  assert.ok(index >= 0);
  cards.deck.unshift(...cards.deck.splice(index, 1));
  game.nexusCards!.cards = drawNexusCard(cards, owner, game.players, () => 0);
  game.dukeVidal = acquireDuke(game.dukeVidal!, moritani, game.turn, 'moritani');
  nexusTraitorInventory(game);
  const offer = viewGame(game, owner).nexusEcazDuke;
  assert.ok(offer);
  assert.equal(offer.blocked, null);
  assert.equal(offer.dukeController, moritani);
  return { game, action: { type: 'nexusEcazDuke', event: offer.event } };
}
