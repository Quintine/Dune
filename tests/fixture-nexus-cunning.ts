import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { nexusTraitorFixture } from './fixture-nexus-traitors';
import { validateNexusCards } from '../game/nexus-cards';
export function suboidFixture(advanced = true, atreides = false) {
  let g = nexusTraitorFixture({ ownerFaction: 'ixians', opponentFaction: atreides ? 'atreides' : 'guild', ix: true, advanced });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('ixians'); assert.ok(index >= 0);
  cards.deck[index] = cards.hands.p!; cards.hands.p = 'ixians';
  Object.assign(g, { phase: 6, active: 'p', order: ['p', 'q', 'r'], ready: [], response: null, decision: null, phaseOpening: null });
  for (const p of g.players) {
    p.forces = {}; p.reserves = 20; p.tanks = 0;
    if (p.elites) { p.elites.reserves = p.faction === 'ixians' ? 7 : 3; p.elites.tanks = 0; p.elites.forces = {}; }
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'pasty_mesa:5': 5, 'hagga_basin:12': 3 }; p.reserves = 12;
  }
  g.players[0].elites!.forces = { 'pasty_mesa:5': 2 }; g.players[0].elites!.reserves = 5;
  g = applyAction(g, 'p', { type: 'chooseBattle', territory: 'pasty_mesa', target: 'q' });
  for (const id of ['p', 'q']) if (g.battle!.preLeader && !g.battle!.preLeader.closed)
    g = applyAction(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
  validateNexusCards(g.nexusCards!.cards!, g.players);
  return g;
}
export function boostSuboids(g: Game) {
  const offer = viewGame(g, 'p').nexusSuboids!.offer!;
  assert.equal(offer.blocked, null);
  return applyAction(g, 'p', { type: 'nexusSuboids', event: offer.event });
}
