import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { holdRevivalCard, positionRevivalForces } from './fixture-homeworld-revival';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function passCurrent(g: Game) {
  const actor = g.players.find((p) => {
    const controls = viewGame(g, p.id).responseControls;
    return controls && !controls.hasPassed && controls.cancelCards.length;
  });
  assert.ok(actor);
  return applyAction(reload(g), actor.id, { type: 'passResponse' });
}

void test('a Southern Ghola placement keeps the actual CHOAM sale suspended until its separate income finishes', () => {
  // Explicit market audit position: complete CHOAM setup/deck remains gated.
  let g = createGame('REVIVALMARKET', newPlayer('c', 'CHOAM', 'choam'), false, ['choam']);
  g.players.push(newPlayer('f', 'Fremen', 'fremen'), newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(g, { status: 'playing', phase: 2, turn: 2, storm: 18,
    order: ['c', 'f', 't'], deck: baseDeck(), spiceDeck: spiceDeck(),
    phaseOpening: null, choamCharity: { turn: 2, canceled: false } });
  for (const player of g.players)
    Object.assign(player, { hand: [], spice: 20, traitors: [], traitorChoices: [], reserves: 20, tanks: 0, forces: {} });
  g.players[0].reserves = 10;
  g.players[0].forces = { 'polar_sink:0': 10 };
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  positionRevivalForces(g, 'f', { native: 3, tanks: 5, eliteTanks: 2 });
  const saleAt = g.deck.findIndex((card) => card.kind === 'worthless');
  const sale = g.deck.splice(saleAt, 1)[0];
  g.players[0].hand.push(sale);
  const ghola = holdRevivalCard(g, 'f', 'ghola');
  holdRevivalCard(g, 'f', 'karama');
  holdRevivalCard(g, 'c', 'karama');
  for (const player of g.players) g = applyAction(g, player.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  g = applyAction(g, 'c', { type: 'decision', mode: 'sell', card: sale.id });
  assert.equal(g.response?.kind, 'choamSale');
  const originalSale = structuredClone(g.response);
  const spice = g.players.map((p) => p.spice);
  g = applyAction(reload(g), 'f', { type: 'card', card: ghola, amount: 2, elite: 1 });
  assert.equal(g.homeworldRevivalReturn?.stage, 'choice');
  assert.equal(g.homeworldRevivalReturn.resumeResponse?.kind, 'revivalIncome');
  assert.ok(g.pendingChoamMarketGhola);
  assert.equal(g.discard.filter((card) => card.id === ghola).length, 1);
  assert.ok(g.players[0].hand.some((card) => card.id === sale.id));
  assert.deepEqual(g.players.map((p) => p.spice), spice);
  g = applyAction(reload(g), 'f', { type: 'decision', event: g.homeworldRevivalReturn.event,
    destination: 'arrakeen:10', amount: 1 });
  assert.equal(g.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(g.response?.kind, 'revivalIncome');
  for (let n = 0; g.response?.kind === 'revivalIncome' && n < 6; n++) g = passCurrent(g);
  assert.deepEqual(g.response, originalSale);
  assert.equal(g.players[2].spice, spice[2] + 1);
  assert.equal(g.players[0].spice, spice[0]);
  for (let n = 0; g.response?.kind === 'choamSale' && n < 6; n++) g = passCurrent(g);
  assert.equal(g.players[0].spice, spice[0] + 2);
  assert.equal(g.discard.filter((card) => card.id === sale.id).length, 1);
  assert.equal(g.discard.filter((card) => card.id === ghola).length, 1);
  assert.equal(g.players[1].reserves, 4);
  assert.equal(g.players[1].tanks, 3);
  homeworldGameIntegrity(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
});
