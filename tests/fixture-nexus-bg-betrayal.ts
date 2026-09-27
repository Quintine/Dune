import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';

export function nexusBgBetrayalFixture(
  holder: 'r' | null = 'r', advanced = false, opponentFaction: 'guild' | 'atreides' | 'harkonnen' = 'guild',
): Game {
  let g = nexusTraitorFixture({ ownerFaction: 'beneGesserit', opponentFaction, phase: 6, advanced });
  const cards = g.nexusCards!.cards!;
  if (opponentFaction === 'harkonnen') {
    assert.equal(cards.hands.p, 'harkonnen');
    assert.equal(cards.hands.q, null);
    cards.hands.q = cards.hands.p;
    cards.hands.p = null;
  }
  if (holder) {
    const index = cards.deck.indexOf('beneGesserit');
    assert.ok(index >= 0);
    if (cards.hands[holder]) cards.deck.push(cards.hands[holder]!);
    cards.hands[holder] = cards.deck.splice(index, 1)[0];
  }
  for (const player of g.players) {
    player.forces = player.id === 'r' ? {} : { 'pasty_mesa:5': 4 };
    player.reserves = player.id === 'r' ? 20 : 16;
    player.tanks = 0;
    if (player.advisors) player.advisors = {};
    if (player.elites) {
      player.elites.forces = {};
      player.elites.reserves = 3;
      player.elites.tanks = 0;
    }
  }
  g = applyAction(g, 'p', {
    type: 'chooseBattle', territory: 'pasty_mesa', target: 'q',
  });
  assert.equal(g.battle?.preparation?.kind, 'voice');
  nexusTraitorInventory(g);
  return g;
}
