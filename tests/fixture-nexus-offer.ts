import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Game } from '../game/engine';
import { nexusReady, orderNexusSpice } from './fixture-nexus-cards';

/** Genuine Basic setup, then a controlled later-Storm boundary. Existing spice
 * cards are reordered; actual storm/blow actions create the playable Nexus.
 * This is a focused position, not a complete first-turn simulation. */
export function nexusOfferGame(ids: [string, string, string] = ['a', 'e', 'h'], code = 'NEXOFFER'): Game {
  let g = createGame(code, newPlayer(ids[0], 'Atreides offerer', 'atreides'));
  joinGame(g, newPlayer(ids[1], 'Emperor recipient', 'emperor'));
  joinGame(g, newPlayer(ids[2], 'Harkonnen observer', 'harkonnen'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = applyAction(g, ids[0], { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length) g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  assert.equal(g.status, 'playing');
  Object.assign(g, { turn: 2, phase: 0, storm: 18, stormDials: {}, stormPending: null, ready: [] });
  orderNexusSpice(g, ['worm', 'land']);
  for (const id of g.stormDialers) g = applyAction(g, id, { type: 'stormDial', amount: 1 });
  g = nexusReady(g);
  assert.equal(g.phase, 1);
  g = nexusReady(g);
  assert.ok(g.spiceWindow);
  g = nexusReady(g);
  assert.ok(g.nexus);
  assert.equal(g.spiceWindow, null);
  assert.equal(g.spiceResolution, null);
  return g;
}
