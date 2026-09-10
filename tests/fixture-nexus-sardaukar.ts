import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  nexusTraitorFixture,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';
import { nexusAllow } from './fixture-nexus-cards';

export function nexusSardaukarFixture(
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    opponentFaction?: 'guild' | 'atreides' | 'fremen';
    normal?: number;
    starred?: number;
  } = {},
): Game {
  let g = nexusTraitorFixture({
    ownerFaction: 'emperor',
    opponentFaction:
      options.opponentFaction === 'fremen'
        ? undefined
        : options.opponentFaction,
    advanced: options.advanced ?? true,
    seatIds: options.seatIds,
    phase: 6,
  });
  const owner = g.players[0],
    opponent = g.players[options.opponentFaction === 'fremen' ? 2 : 1];
  const normal = options.normal ?? 7,
    starred = options.starred ?? 0;
  assert.ok(normal >= 0 && normal <= 12 && starred >= 0 && starred <= 5);
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('emperor');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner.id]!;
  cards.hands[owner.id] = 'emperor';
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    if (p.elites) {
      p.elites.forces = {};
      p.elites.tanks = 0;
      p.elites.reserves = p.faction === 'emperor' ? 5 : 3;
    }
  }
  owner.forces = { 'pasty_mesa:5': normal + starred, 'hagga_basin:12': 3 };
  owner.reserves = 17 - normal - starred;
  if (owner.elites) {
    owner.elites.reserves = 5 - starred;
    if (starred) owner.elites.forces = { 'pasty_mesa:5': starred };
  }
  opponent.forces = { 'pasty_mesa:5': 2, 'hagga_basin:12': 2 };
  opponent.reserves = 16;
  Object.assign(g, {
    active: owner.id,
    order: g.players.map((p) => p.id),
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  g = applyAction(g, owner.id, {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: opponent.id,
  });
  for (const id of [owner.id, opponent.id])
    if (g.battle!.preLeader && !g.battle!.preLeader.closed)
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.event,
      });
  nexusSardaukarInventory(g);
  return g;
}
export const nexusSardaukarPlayer = (g: Game) =>
  g.players.find((p) => p.faction === 'emperor')!;
export function nexusSardaukarInventory(g: Game): void {
  nexusTraitorInventory(g);
  const emperor = nexusSardaukarPlayer(g);
  if (!emperor.elites) {
    assert.equal(g.advanced, false);
    return;
  }
  assert.equal(
    emperor.elites!.reserves +
      emperor.elites!.tanks +
      Object.values(emperor.elites!.forces).reduce((sum, n) => sum + n, 0),
    5,
  );
}
export function prepareSardaukarBattle(g: Game): Game {
  while (g.battle!.preparation)
    g = applyAction(g, g.battle!.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
export function beginNexusSardaukar(g: Game): Game {
  const owner = nexusSardaukarPlayer(g);
  const offer = viewGame(g, owner.id).nexusSardaukar!.offer!;
  assert.equal(offer.blocked, null);
  return applyAction(g, owner.id, {
    type: 'nexusSardaukar',
    event: offer.event,
  });
}
export const allowNexusSardaukar = nexusAllow;
