import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, distance, location, splitLocation } from '../game/board';
import {
  enterNexusSpice, finishNexusSpice, nexusInventory, nexusPlayer, nexusReady,
  nexusTurnTwo, orderNexusSpice,
} from './fixture-nexus-cards';

export const fremenBetrayalSource = 'red_chasm:7';
const destinations = TERRITORIES.filter(t => t.type === 'sand').flatMap(t =>
  t.sectors.filter(sector => sector !== 18).map(sector => location(t.id, sector)));

export function fremenBetrayalMovement(range: number): Action {
  const destination = destinations.find(to =>
    distance(fremenBetrayalSource, to, key => splitLocation(key).sector === 18) === range);
  assert.ok(destination, `range ${range} from ${fremenBetrayalSource}`);
  const to = splitLocation(destination);
  return {
    type: 'move', from: fremenBetrayalSource, amount: 4,
    territory: to.territory, sector: to.sector,
  };
}

/** Actual setup, second-turn Nexus draw, Bidding and Revival; only final board
 * force positions are chosen for a deterministic native movement boundary. */
export function fremenBetrayalFixture(
  advanced = false,
  ids: [string, string, string] = ['f', 'a', 'h'],
) {
  const [riderId, allyId, holderId] = ids;
  let g = nexusTurnTwo({ seatIds: ids, hostFaction: 'fremen', secondFaction: 'atreides', advanced });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  assert.equal(g.nexus, true);
  g = applyAction(g, riderId, { type: 'alliance', target: allyId });
  g = applyAction(g, allyId, { type: 'alliance', target: riderId });
  g = finishNexusSpice(g);
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  const cards = g.nexusCards!.cards!;
  cards.deck = ['fremen', ...cards.deck.filter(card => card !== 'fremen')];
  g = applyAction(g, holderId, {
    type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'draw', ownRedraws: 0,
  });
  assert.equal(g.nexusCards!.cards!.hands[holderId], 'fremen');
  g = nexusReady(g);
  for (let step = 0; g.phase === 3 && step < 30; step++) {
    if (g.phaseOpening) {
      const id = g.players.find(p => !g.phaseOpening!.passed.includes(p.id))!.id;
      g = applyAction(g, id, { type: 'ready' });
    } else if (g.auction) g = applyAction(g, g.auction.active, { type: 'passBid' });
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 4);
  for (let step = 0; g.phase === 4 && step < 20; step++) {
    if (g.response) {
      const id = g.players.find(p => !g.response!.passed.includes(p.id))!.id;
      g = applyAction(g, id, { type: 'passResponse' });
    } else g = nexusReady(g);
  }
  assert.equal(g.phase, 5);
  const rider = nexusPlayer(g, riderId);
  const total = rider.reserves + Object.values(rider.forces).reduce((sum, count) => sum + count, 0);
  rider.forces = { [fremenBetrayalSource]: 4 };
  rider.reserves = total - 4;
  if (rider.elites) {
    const eliteTotal = rider.elites.reserves +
      Object.values(rider.elites.forces).reduce((sum, count) => sum + count, 0);
    rider.elites.forces = {};
    rider.elites.reserves = eliteTotal;
  }
  rider.shipped = true;
  rider.moved = 0;
  g.active = riderId;
  nexusInventory(g);
  const offer = viewGame(g, holderId).nexusFremenBetrayal!;
  assert.equal(offer.blocked, null);
  return { g, play: { type: 'nexusFremenBetrayal', event: offer.event } as Action };
}

/** Preserve the genuinely drawn card into the next turn's clean pre-blow window. */
export function fremenBetrayalWormFixture(
  advanced = false,
  ids: [string, string, string] = ['f', 'a', 'h'],
) {
  const previous = fremenBetrayalFixture(advanced, ids);
  const g = enterNexusSpice(previous.g, true);
  assert.equal(g.phase, 1);
  const offer = viewGame(g, ids[2]).nexusFremenBetrayal!;
  assert.equal(offer.mode, 'worm');
  assert.equal(offer.blocked, null);
  return { g, play: { type: 'nexusFremenBetrayal', event: offer.event } as Action };
}

/** Preserve the physical Spice Deck census while choosing a real next appearance. */
export function fremenBetrayalNextWorm(g: Game, target: string) {
  const cards = [...g.spiceDeck, ...g.spiceDiscard.flat()];
  const landIndex = cards.findIndex(card => 'territory' in card && card.territory === target);
  assert.ok(landIndex >= 0, `Spice deck needs ${target}`);
  const land = cards.splice(landIndex, 1)[0];
  const wormIndex = cards.findIndex(card => 'worm' in card && !card.suppressed);
  assert.ok(wormIndex >= 0, 'Spice deck needs a natural worm');
  const worm = cards.splice(wormIndex, 1)[0];
  g.spiceDeck = [worm, ...cards];
  g.spiceDiscard = [[land], []];
}

/** Recreate the exact six-field receipt persisted by the movement-only checkpoint. */
export function useLegacyFremenMovementReceipt(g: Game) {
  const history = g.nexusFremenBetrayalHistory!;
  const record = history.at(-1)!;
  assert.equal(record.mode, 'movement');
  const legacy = {
    event: JSON.stringify(['nexusFremenBetrayal', record.turn, record.owner, record.target]),
    owner: record.owner, target: record.target, turn: record.turn,
    phase: 5 as const, signature: '',
  };
  legacy.signature = JSON.stringify({ ...legacy, signature: undefined });
  history[history.length - 1] = legacy;
}
