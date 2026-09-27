import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import {
  finishNexusSpice, nexusAllow, nexusInventory, nexusPlayer, nexusReady,
  nexusReject, nexusReload, nexusTurnTwo, orderNexusSpice,
} from './fixture-nexus-cards';

const owner = 'h';
const ecaz = 'f';
const ally = 'a';
const location = 'wind_pass';

function setup(): { game: Game; action: Action } {
  let g = nexusTurnTwo({ hostFaction: 'ecaz', secondFaction: 'emperor', advanced: true });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  assert.equal(g.nexus, true);
  // A reciprocal alliance is negotiated in the actual second-turn Nexus.
  g = applyAction(g, ecaz, { type: 'alliance', target: ally });
  g = applyAction(g, ally, { type: 'alliance', target: ecaz });
  assert.equal(nexusPlayer(g, ecaz).ally, ally);
  assert.equal(nexusPlayer(g, ally).ally, ecaz);
  g = finishNexusSpice(g);
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  const cards = g.nexusCards!.cards!;
  assert.ok(cards.deck.includes('ecaz'));
  cards.deck = ['ecaz', ...cards.deck.filter(card => card !== 'ecaz')];
  g = applyAction(g, owner, {
    type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'draw', ownRedraws: 0,
  });
  assert.equal(g.phase, 2);
  assert.equal(g.nexusCards!.cards!.hands[owner], 'ecaz');
  g = nexusReady(g);
  for (let step = 0; g.phase === 3 && step < 30; step++) {
    if (g.phaseOpening) {
      const id = g.players.find(p => !g.phaseOpening!.passed.includes(p.id))!.id;
      g = applyAction(g, id, { type: 'ready' });
    } else if (g.auction) {
      g = applyAction(g, g.auction.active, { type: 'passBid' });
    } else {
      g = nexusReady(g);
    }
  }
  assert.equal(g.phase, 4, 'actual auction must reach revival');
  for (let step = 0; g.phase === 4 && step < 10; step++) {
    if (g.decision?.kind === 'ecazPlacement')
      g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
    else if (g.response) g = nexusAllow(g);
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 5, 'actual revival must reach shipment opening');
  assert.equal(g.active, g.order[0]);
  assert.deepEqual(g.movementRemaining, g.order);

  // Reallocate only existing physical counters from the genuine Emperor seat.
  const target = nexusPlayer(g, ally);
  target.reserves += Object.values(target.forces).reduce((sum, n) => sum + n, 0);
  target.elites!.reserves += Object.values(target.elites!.forces).reduce((sum, n) => sum + n, 0);
  target.forces = { 'wind_pass:14': 3, 'wind_pass:15': 2, 'carthag:11': 1 };
  target.elites!.forces = { 'wind_pass:14': 1, 'wind_pass:15': 1 };
  target.reserves -= 6;
  target.elites!.reserves -= 2;
  const native = nexusPlayer(g, ecaz);
  native.reserves -= 2;
  native.forces['wind_pass:14'] = (native.forces['wind_pass:14'] ?? 0) + 2;
  nexusInventory(g);
  const offer = viewGame(g, owner).nexusEcazBetrayal!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.ally, ally);
  assert.deepEqual(offer.territories.find(row => row.territory === location), {
    territory: location,
    sectors: {
      'wind_pass:14': { normal: 2, elite: 1 },
      'wind_pass:15': { normal: 1, elite: 1 },
    },
    total: { normal: 3, elite: 2 },
  });
  return { game: g, action: { type: 'nexusEcazBetrayal', event: offer.event, territory: location } };
}

function karama(g: Game): string {
  const index = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0, 'a physical Karama remains in the treachery deck');
  const card = g.deck.splice(index, 1)[0];
  nexusPlayer(g, ecaz).hand.push(card);
  nexusInventory(g);
  return card.id;
}

void test('real Nexus card spends once and returns every typed sector without using shipment or movement', () => {
  const { game, action } = setup();
  karama(game); // Keep the ordinary response open until every player passes.
  const before = nexusReload(game);
  const target = nexusPlayer(before, ally);
  const projected = viewGame(before, owner).nexusEcazBetrayal!;
  for (const id of [ecaz, ally]) {
    assert.equal(viewGame(before, id).nexusEcazBetrayal, null);
    assert.equal(viewGame(before, id).nexusCards?.card, null);
  }
  assert.equal(projected.territories.length > 0, true);
  nexusReject(game, ecaz, action, /Ecaz|Nexus/);
  nexusReject(game, ally, action, /Ecaz|Nexus/);
  nexusReject(game, owner, { ...action, event: 'stale' }, /Ecaz|Nexus/);
  nexusReject(game, owner, { ...action, territory: 'polar_sink' }, /Ecaz|Nexus/);
  assert.deepEqual(game, before);
  let pending = applyAction(nexusReload(game), owner, action);
  assert.equal(pending.response?.kind, 'nexusEcazBetrayal');
  assert.equal(pending.nexusCards!.cards!.hands[owner], null);
  assert.deepEqual(pending.nexusCards!.cards!.discard, ['ecaz']);
  assert.equal(pending.nexusEcazBetrayalHistory?.[0].stage, 'pending');
  assert.deepEqual(nexusPlayer(pending, ally).forces, target.forces);
  nexusReject(pending, owner, action, /Ecaz|Nexus/);
  pending = nexusReload(pending);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(pending)), pending);
  for (const counter of ['reserves', 'eliteReserves'] as const) {
    const corrupted = nexusReload(pending);
    const affected = nexusPlayer(corrupted, ally);
    if (counter === 'reserves') affected.reserves = '14' as never;
    else affected.elites!.reserves = '3' as never;
    const saved = nexusReload(corrupted);
    assert.throws(() => nexusAllow(corrupted), /valid reserve and elite counters/);
    assert.deepEqual(corrupted, saved);
  }
  const result = nexusAllow(pending);
  const returned = nexusPlayer(result, ally);
  assert.equal(returned.forces['wind_pass:14'], undefined);
  assert.equal(returned.forces['wind_pass:15'], undefined);
  assert.equal(returned.elites!.forces['wind_pass:14'], undefined);
  assert.equal(returned.elites!.forces['wind_pass:15'], undefined);
  assert.equal(returned.reserves, target.reserves + 5);
  assert.equal(returned.elites!.reserves, target.elites!.reserves + 2);
  assert.equal(returned.forces['carthag:11'], 1);
  assert.deepEqual(nexusPlayer(result, ecaz).forces, nexusPlayer(before, ecaz).forces);
  assert.equal(result.phase, 5);
  assert.equal(result.active, before.active);
  assert.deepEqual(result.movementRemaining, before.movementRemaining);
  for (const p of result.players) {
    assert.equal(p.shipped, false);
    assert.equal(p.moved, 0);
  }
  assert.equal(result.nexusEcazBetrayalHistory?.[0].stage, 'complete');
  assert.equal(result.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  nexusReject(result, owner, action, /Ecaz|Nexus/);
  nexusInventory(result);
});

void test('Karama cancellation after saved JSON leaves both force groups in place but spends both physical cards', () => {
  const { game, action } = setup();
  const card = karama(game);
  const original = nexusReload(game);
  let pending = applyAction(nexusReload(game), owner, action);
  pending = nexusReload(pending);
  assert.equal(pending.nexusEcazBetrayalHistory?.[0].stage, 'pending');
  let canceled = applyAction(pending, ecaz, { type: 'card', card, mode: 'cancel' });
  canceled = nexusAllow(nexusReload(canceled));
  assert.equal(canceled.response, null);
  assert.equal(canceled.nexusEcazBetrayalHistory?.[0].stage, 'complete');
  for (const id of [ally, ecaz]) {
    assert.deepEqual(nexusPlayer(canceled, id).forces, nexusPlayer(original, id).forces);
    assert.deepEqual(nexusPlayer(canceled, id).elites, nexusPlayer(original, id).elites);
    assert.equal(nexusPlayer(canceled, id).reserves, nexusPlayer(original, id).reserves);
  }
  assert.equal(canceled.discard.filter(item => item.id === card).length, 1);
  assert.equal(canceled.nexusCards!.cards!.discard.filter(item => item === 'ecaz').length, 1);
  assert.equal(canceled.phase, 5);
  assert.equal(canceled.active, original.active);
  assert.deepEqual(canceled.movementRemaining, original.movementRemaining);
  nexusReject(canceled, owner, action, /Ecaz|Nexus/);
  nexusInventory(canceled);
});

void test('a bot holding the real card proposes a legal opening action from its private view', () => {
  const { game } = setup();
  karama(game); // The bot's declaration opens a real Karama response.
  const view = viewGame(game, owner);
  view.players.find(p => p.id === owner)!.bot = 'Easy';
  const action = botActions(view).find(candidate => candidate.type === 'nexusEcazBetrayal');
  assert.ok(action, 'bot should act on a legal Ecaz Betrayal offer');
  assert.equal(action.territory, location);
  const pending = applyAction(game, owner, action);
  assert.equal(pending.response?.kind, 'nexusEcazBetrayal');
  nexusInventory(nexusAllow(pending));
});

void test('an automated holder spends Betrayal before a seated-earlier opening movement bot', () => {
  const { game } = setup();
  game.order = [ecaz, ally, owner];
  game.movementRemaining = [...game.order];
  game.active = ecaz;
  nexusPlayer(game, ecaz).bot = 'Easy';
  nexusPlayer(game, owner).bot = 'Easy';
  karama(game);
  const next = runBots(game, 1);
  assert.equal(next.response?.kind, 'nexusEcazBetrayal');
  assert.equal(next.nexusEcazBetrayalHistory?.[0].stage, 'pending');
  assert.equal(next.nexusCards!.cards!.hands[owner], null);
  nexusInventory(next);
});
