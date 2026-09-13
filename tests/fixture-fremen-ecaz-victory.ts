import assert from 'node:assert/strict';
import { applyAction, createGame, initializeFactionExpansionsGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';

/** Genuine setup followed by a conserved, explicitly staged final Collection
 * position. This proves the endgame path, not naturally reached co-occupation. */
export function fremenEcazFinalTurn(advanced = true, ids = ['ec', 'fr', 'gu', 'bg']) {
  let g = createGame('FREMENQA', newPlayer(ids[0], 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  for (const [index, faction] of (['fremen', 'guild', 'beneGesserit'] as const).entries())
    joinGame(g, newPlayer(ids[index + 1], faction, faction));
  for (const p of g.players) p.ready = true;
  g = initializeFactionExpansionsGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 80; i++) {
    const next = g.players.flatMap((p) => {
      const view = viewGame(g, p.id);
      view.players.find((other) => other.id === p.id)!.bot = 'Medium';
      return botActions(view).map((action) => ({ id: p.id, action }));
    })[0];
    assert.ok(next, 'Genuine setup must provide a legal action');
    g = applyAction(g, next.id, next.action);
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0);
      p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces['sietch_tabr:14'] = 3;
    p.reserves -= 3;
    p.ally = g.players.find((other) => other.id !== p.id && ['ecaz', 'fremen'].includes(other.faction))!.id;
    p.allySinceTurn = 9;
  }
  g.turn = 10; g.phase = 7; g.storm = 18; g.ready = []; g.active = null;
  g.order = g.players.map((p) => p.id); g.phaseOpening = null;
  g.players[3].prediction = { faction: 'fremen', turn: 10 };
  for (const p of g.players) viewGame(g, p.id);
  return g;
}

export function finishFremenEcazTurn(state: Game, profile: Difficulty = 'Medium') {
  let g = JSON.parse(JSON.stringify(state)) as Game;
  for (let i = 0; g.status === 'playing' && i < 30; i++) {
    const next = g.players.flatMap((p) => {
      const view = viewGame(g, p.id);
      view.players.find((other) => other.id === p.id)!.bot = profile;
      return botActions(view).map((action) => ({ id: p.id, action }));
    })[0];
    assert.ok(next, 'Final-turn continuation must have a legal action');
    g = applyAction(JSON.parse(JSON.stringify(g)), next.id, next.action);
  }
  assert.equal(g.status, 'finished');
  return g;
}

export function fremenEcazCustody(g: Game) {
  return {
    cards: [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)].map((c) => c.id).sort(),
    traitors: [...(g.traitorReserve ?? []), ...g.players.flatMap((p) => p.traitors)].sort(),
    forces: g.players.map((p) => ({ id: p.id, reserves: p.reserves, tanks: p.tanks, forces: p.forces, elites: p.elites })),
  };
}
