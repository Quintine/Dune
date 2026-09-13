import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import { nexusChoamTradeAction } from '../game/nexus-choam-trade-options';
import { nexusChoamTradeSignature } from '../game/nexus-choam-trade';
import { viewGame } from '../game/engine';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { holdNexusChoamCard } from './fixture-nexus-choam';

export function nexusChoamTradeFixture(advanced = false, seatIds: [string, string, string] = ['p', 'q', 'r']) {
  const g = nexusTraitorFixture({ ownerFaction: 'atreides', advanced, phase: 7, seatIds });
  const [owner, target, observer] = seatIds;
  const cards = g.nexusCards!.cards!, index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner]!;
  cards.hands[owner] = 'choam';
  const cost = holdNexusChoamCard(g, owner, 'worthless');
  const spare = holdNexusChoamCard(g, owner, 'worthless');
  const other = holdNexusChoamCard(g, owner, 'projectile');
  nexusTraitorInventory(g);
  const action = nexusChoamTradeAction(viewGame(g, owner), cost.id)!;
  assert.ok(action);
  return { g, owner, target, observer, cost, spare, other, action };
}
/** Restore the exact already-paid semantic discard boundary. The normal live
 * action drains it automatically; recovery must never repeat its payment. */
export function pausedNexusChoamTrade(completed: Game): Game {
  const g = structuredClone(completed), record = g.nexusChoamTrades!.at(-1)!;
  record.stage = 'discard'; record.signature = nexusChoamTradeSignature(record);
  g.nexusChoamTradeLast = {event: record.event, stage: record.stage};
  const sequence = g.treacheryDiscardSequence!;
  g.resolvedTreacheryDiscardSequence = sequence - 1;
  g.pendingTreacheryDiscard = { sequence, batch: {
    event: `discard:${g.turn}:${g.phase}:${sequence}`, turn: g.turn, phase: g.phase,
    cause: 'nexus:choamTrade', entries: [{card: structuredClone(g.discard.find(card => card.id === record.card)!), discardedBy: record.owner, publicFace: true}],
  }, continuation: {kind: 'nexusChoamTrade', event: record.event, owner: record.owner, card: record.card, spiceAfter: record.spiceBefore + 2} };
  return g;
}
