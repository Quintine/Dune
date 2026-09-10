import assert from 'node:assert/strict';
import {
  nexusTraitorFixture,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';

/** The final Tleilaxu roster and physical components come from genuine setup.
 * Only the conserved held Nexus card and revealed-card checkpoint are staged. */
export function nexusFaceDancerFixture(revealed = 2) {
  const g = nexusTraitorFixture({ ownerFaction: 'tleilaxu' });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('tleilaxu');
  assert.ok(index >= 0);
  assert.equal(cards.hands.p, 'harkonnen');
  cards.deck[index] = 'harkonnen';
  cards.hands.p = 'tleilaxu';
  g.players[0].faceDancers!.forEach((card, i) => {
    card.revealed = i < revealed;
  });
  nexusTraitorInventory(g);
  return g;
}
