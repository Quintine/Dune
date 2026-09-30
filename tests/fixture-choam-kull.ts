import { applyAction, createGame, initializeKullGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';

export function takeKullCard(g: Game, idOrEffect: string): Card {
  const zones = [g.deck, g.discard, ...(g.richeseCache ? [g.richeseCache] : []), ...g.players.map(p => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex(card => card.id === idOrEffect || card.effect === idOrEffect || card.name === idOrEffect);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw new Error(`Missing physical Kull fixture card: ${idOrEffect}`);
}

export function choamKullGame(options: {
  seatIds?: readonly string[];
  advanced?: boolean;
  opponents?: readonly [FactionId, FactionId, FactionId];
} = {}): Game {
  const ids = options.seatIds ?? ['c', 'e', 'b', 'h'];
  if (ids.length !== 4 || new Set(ids).size !== 4) throw new Error('Kull fixture needs four distinct seat IDs.');
  let g = createGame('KULLQA01', newPlayer(ids[0], 'CHOAM', 'choam'), options.advanced ?? true, ['choam', 'ix']);
  const opponents: readonly FactionId[] = options.opponents ?? ['emperor', 'beneGesserit', 'harkonnen'];
  for (let index = 0; index < 3; index++)
    joinGame(g, newPlayer(ids[index + 1], opponents[index], opponents[index]));
  for (const p of g.players) { p.bot = 'Medium'; p.ready = true; }
  g = initializeKullGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 100; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const action = botActions(viewGame(g, p.id))[0];
      if (action) { next = applyAction(g, p.id, action); break; }
    }
    if (!next) throw new Error('Genuine Kull setup has no legal action.');
    g = next;
  }
  if (g.status !== 'playing') throw new Error('Genuine Kull setup did not complete.');
  g.deck.push(...g.players.flatMap(p => p.hand));
  for (const p of g.players) { p.hand = []; delete p.bot; }
  g.players[0].hand.push(takeKullCard(g, 'ix-kull-wahad'));
  g.players[1].hand.push(takeKullCard(g, 'karama'));
  g.players[2].hand.push(takeKullCard(g, 'Baliset'));
  g.players[3].hand.push(takeKullCard(g, 'karama'));
  Object.assign(g, { turn: 2, phase: 5, active: ids[1], storm: 18, ready: [], decision: null,
    response: null, pendingKarama: null, phaseOpening: null, stormPending: null,
    stormResolution: null, movementRemaining: [...ids] });
  return g;
}

export function kullShipmentAttempt(g: Game, owner = g.players[1].id): Action {
  const p = g.players.find(p => p.id === owner)!;
  const card = p.hand.find(card => card.effect === 'karama' || (p.faction === 'beneGesserit' && card.kind === 'worthless'));
  if (!card) throw new Error('Kull shipment fixture needs a held Karama.');
  return { type: 'card', mode: 'shipment', card: card.id, target: owner };
}
