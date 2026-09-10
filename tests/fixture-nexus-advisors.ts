import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  nexusTraitorFixture,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';
import { nexusAllow } from './fixture-nexus-cards';

/** Final identities and Advanced rules precede genuine Nexus setup. Only
 * conserved board positions and the held physical Nexus identity are staged. */
export function nexusAdvisorFixture(
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    opponentFaction?: 'guild' | 'harkonnen' | 'richese';
  } = {},
): Game {
  const g = nexusTraitorFixture({
    ownerFaction: 'beneGesserit',
    opponentFaction: options.opponentFaction,
    advanced: options.advanced ?? true,
    seatIds: options.seatIds,
    phase: 5,
  });
  const [owner, opponent] = g.players;
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('beneGesserit');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner.id]!;
  cards.hands[owner.id] = 'beneGesserit';
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.shipped = false;
    p.moved = 0;
    if (p.elites) {
      p.elites.forces = {};
      p.elites.reserves = 3;
      p.elites.tanks = 0;
    }
    delete p.advisors;
  }
  owner.forces = {
    'arrakeen:10': 2,
    'pasty_mesa:5': 1,
    'pasty_mesa:6': 2,
    'carthag:11': 1,
    'polar_sink:0': 1,
  };
  owner.reserves = 13;
  if (g.advanced)
    owner.advisors = { arrakeen: {}, pasty_mesa: {}, carthag: {} };
  opponent.forces = { 'arrakeen:10': 1, 'pasty_mesa:5': 1, 'carthag:11': 1 };
  opponent.reserves = 17;
  Object.assign(g, {
    active: owner.id,
    order: g.players.map((p) => p.id),
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    movementRemaining: null,
  });
  nexusAdvisorInventory(g);
  return g;
}

export const nexusAdvisorPlayer = (g: Game) =>
  g.players.find((p) => p.faction === 'beneGesserit')!;
export const nexusAdvisorInventory = nexusTraitorInventory;

export function holdAdvisorKarama(g: Game, seatId = g.players[1].id): string {
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === seatId)!.hand.push(card);
  return card.id;
}

export function beginNexusAdvisorFlip(g: Game, territories: string[]): Game {
  const owner = nexusAdvisorPlayer(g);
  const offer = viewGame(g, owner.id).nexusAdvisors!.offer!;
  assert.equal(offer.blocked, null);
  return applyAction(g, owner.id, {
    type: 'nexusAdvisors',
    event: offer.event,
    territories,
  });
}

export const allowNexusAdvisorFlip = nexusAllow;
