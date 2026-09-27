import assert from 'node:assert/strict';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { test } from 'node:test';
import { captureFremenCunningOccurrence, fremenCunningDestinationBlock,
  quoteFremenCunning, quoteFremenCunningRide, validateFremenCunningSelection,
  type FremenCunningOccurrence, type FremenCunningRideAuthorization,
  type FremenCunningSelection } from '../game/nexus-fremen-cunning';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusFixture, nexusTurnTwo, nexusReady, nexusAllow, nexusInventory, nexusReload, orderNexusSpice } from './fixture-nexus-cards';

function fixture() {
  const g = nexusFixture({ advanced: true });
  g.turn = 2;
  g.phase = 1;
  g.storm = 0;
  for (const p of g.players) {
    p.forces = {};
    if (p.elites) p.elites.forces = {};
  }
  const cards = g.nexusCards!.cards!;
  cards.deck = cards.deck.filter(card => card !== 'fremen');
  cards.discard = cards.discard.filter(card => card !== 'fremen');
  for (const id of Object.keys(cards.hands))
    if (cards.hands[id] === 'fremen') cards.hands[id] = null;
  cards.hands[g.players[0].id] = 'fremen';
  const fremen = g.players[0];
  fremen.forces['wind_pass:14'] = 3;
  fremen.forces['wind_pass:15'] = 2;
  fremen.elites!.forces['wind_pass:14'] = 1;
  fremen.elites!.forces['wind_pass:15'] = 2;
  return { g, fremen, other: g.players[1] };
}

function appearance(g: Game, territory = 'hagga_basin', event = 'worm-pile-0') {
  return captureFremenCunningOccurrence(g, {
    event, territory, origin: 'natural', pile: 0,
  });
}
function accepted(g: Game, occurrence: FremenCunningOccurrence): FremenCunningRideAuthorization {
  const owner = g.players[0].id;
  g.nexusCards!.cards!.hands[owner] = null;
  g.nexusCards!.cards!.discard.push('fremen');
  return { event: occurrence.event, turn: occurrence.turn, owner };
}
const selection: FremenCunningSelection = {
  source: 'wind_pass',
  forces: { 'wind_pass:14': { normal: 1, elite: 1 }, 'wind_pass:15': { normal: 0, elite: 2 } },
  destination: { territory: 'carthag', sector: 11 },
};

void test('initial public emptiness belongs to an individual appearance, not its post-devour board', () => {
  const { g, other } = fixture();
  const empty = appearance(g);
  assert.equal(empty.initiallyEmpty, true);
  other.forces['hagga_basin:12'] = 2;
  const occupied = appearance(g, 'hagga_basin', 'worm-pile-1');
  assert.equal(occupied.initiallyEmpty, false);
  delete other.forces['hagga_basin:12']; // worm devoured the defenders
  assert.equal(quoteFremenCunning(g, g.players[0].id, occupied), null);
  const quote = quoteFremenCunning(g, g.players[0].id, empty)!;
  assert.equal(quote.event, 'worm-pile-0');
  assert.deepEqual(quote.sources, [{ territory: 'wind_pass', sectors: {
    'wind_pass:14': { normal: 2, elite: 1 }, 'wind_pass:15': { normal: 0, elite: 2 },
  } }]);
  const receipt = accepted(g, empty);
  assert.deepEqual(validateFremenCunningSelection(g, g.players[0].id, empty, selection, receipt),
    { total: 4, elite: 3 });
  assert.equal(g.players[0].forces['wind_pass:14'], 3); // pure quote, no movement
  assert.equal(quoteFremenCunning(g, g.players[0].id, { ...empty, turn: 1 }), null);
  assert.equal(quoteFremenCunningRide(g, g.players[0].id, occupied, receipt), null);
  assert.equal(quoteFremenCunningRide(g, g.players[0].id, empty,
    { ...receipt, event: 'worm-pile-1' }), null);
  assert.equal(quoteFremenCunningRide(g, g.players[0].id, empty,
    { ...receipt, owner: other.id }), null);
  assert.equal(quoteFremenCunningRide(g, g.players[0].id, empty,
    { ...receipt, turn: empty.turn - 1 }), null);
  assert.equal(quoteFremenCunningRide(g, g.players[0].id, { ...empty, turn: 1 }, receipt), null);
});

void test('advisers and a public No-Field count as initial force presence without reading marker denomination', () => {
  const { g, other } = fixture();
  other.faction = 'beneGesserit';
  other.forces['hagga_basin:13'] = 1;
  other.advisors = { hagga_basin: {} };
  assert.equal(appearance(g).initiallyEmpty, false);
  delete other.forces['hagga_basin:13'];
  other.faction = 'richese';
  const marker = { deployed: { location: { territory: 'hagga_basin', sector: 12 } } };
  Object.defineProperty(marker, 'tokens', { get() { throw new Error('private denomination read'); } });
  other.noField = marker as typeof other.noField;
  assert.equal(appearance(g).initiallyEmpty, false);
  assert.equal(appearance(g, 'carthag').initiallyEmpty, true);
});

void test('typed one-desert-source subset and ordinary destination occupancy/storm restrictions', () => {
  const { g, fremen, other } = fixture();
  const occurrence = appearance(g);
  const receipt = accepted(g, occurrence);
  const valid = (move: FremenCunningSelection) =>
    validateFremenCunningSelection(g, fremen.id, occurrence, move, receipt);
  const reject = (move: FremenCunningSelection, reason: RegExp) => assert.throws(() => valid(move), reason);
  reject({ ...selection, forces: { ...selection.forces, 'hagga_basin:12': { normal: 1, elite: 0 } } }, /physical forces/);
  reject({ ...selection, forces: { 'wind_pass:14': { normal: 3, elite: 0 } } }, /physical forces/);
  reject({ ...selection, forces: { 'wind_pass:15': { normal: 1, elite: 0 } } }, /physical forces/);
  reject({ ...selection, forces: { constructor: { normal: 20, elite: 0 } } },
    /physical forces/);
  reject({ ...selection, forces: {} }, /at least one/);
  reject({ ...selection, source: 'carthag' }, /desert/);
  assert.equal(fremenCunningDestinationBlock(g, fremen.id, occurrence, selection.source,
    { territory: 'hagga_basin', sector: 12 }), null);
  reject({ ...selection, destination: { territory: 'wind_pass', sector: 14 } }, /another destination/);
  reject({ ...selection, destination: { territory: 'carthag', sector: 12 } }, /Arrakis board sector/);
  g.storm = 11;
  reject(selection, /storm/);
  g.storm = 14;
  assert.equal(quoteFremenCunningRide(g, fremen.id, occurrence, receipt)!.sources[0].sectors['wind_pass:14'], undefined);
  reject(selection, /physical forces/);
  g.storm = 0;
  fremen.ally = other.id;
  other.ally = fremen.id;
  other.forces['carthag:11'] = 1;
  assert.notEqual(fremenCunningDestinationBlock(g, fremen.id, occurrence, selection.source, selection.destination), null);
  fremen.ally = null;
  other.ally = null;
  const third = g.players[2];
  third.forces['carthag:11'] = 1;
  assert.notEqual(fremenCunningDestinationBlock(g, fremen.id, occurrence, selection.source, selection.destination), null);
});

void test('physical Fremen card ownership and native entitlement are required', () => {
  const { g, fremen, other } = fixture();
  const occurrence = appearance(g);
  const cards = g.nexusCards!.cards!;
  cards.hands[fremen.id] = null;
  cards.hands[other.id] = 'fremen';
  assert.equal(quoteFremenCunning(g, fremen.id, occurrence), null);
  assert.equal(quoteFremenCunning(g, other.id, occurrence), null);
  assert.throws(() => validateFremenCunningSelection(g, fremen.id, occurrence, selection,
    { event: occurrence.event, turn: occurrence.turn, owner: fremen.id }), /not available/);
  cards.hands[other.id] = null;
  cards.hands[fremen.id] = 'fremen';
  cards.deck.push('fremen'); // duplicate physical card cannot establish custody
  assert.throws(() => quoteFremenCunning(g, fremen.id, occurrence), /Nexus/);
  cards.deck.pop();
  fremen.ally = other.id;
  other.ally = fremen.id;
  assert.equal(quoteFremenCunning(g, fremen.id, occurrence), null);
});

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} empty worm offers privately, spends once and rides remotely after the Nexus`, () => {
  let g = nexusTurnTwo({ advanced });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('fremen');
  assert.ok(index >= 0);
  cards.deck.splice(index, 1);
  cards.hands.f = 'fremen';
  const sourceSector = g.storm === 14 ? 15 : 14;
  g.players[0].reserves--;
  g.players[0].forces[`wind_pass:${sourceSector}`] = 1;
  orderNexusSpice(g, ['worm', 'land']);
  const empty = g.spiceDeck.find(card => 'territory' in card &&
    g.players.every(player => presenceAt(player, card.territory) === 0));
  assert.ok(empty && 'territory' in empty);
  g.spiceDeck.splice(g.spiceDeck.indexOf(empty), 1);
  if (!('territory' in g.spiceDeck[1])) {
    const nextLand = g.spiceDeck.findIndex((card, index) =>
      index > 1 && 'territory' in card);
    assert.ok(nextLand > 1);
    g.spiceDeck.splice(1, 0, g.spiceDeck.splice(nextLand, 1)[0]);
  }
  g.spiceDiscard[0].push(empty);
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  const event = g.nexusFremenCunningOffer!.occurrence.event;
  assert.equal(viewGame(g, 'a').nexusCards?.card, null);
  assert.equal(viewGame(g, 'f').nexusCards?.card, 'fremen');
  const karamaIndex = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  g.players[1].hand.push(g.deck.splice(karamaIndex, 1)[0]);
  const noCard = nexusReload(g);
  noCard.nexusCards!.cards!.hands.f = null;
  noCard.nexusCards!.cards!.deck.push('fremen');
  assert.equal(viewGame(noCard, 'a').decision?.kind, 'nexusFremenCunningOffer');
  assert.throws(() => applyAction(noCard, 'f', {
    type: 'decision', event, accept: true,
  }), /Fremen Cunning needs/);
  const passed = applyAction(noCard, 'f', { type: 'decision', event, accept: false });
  assert.equal(passed.nexusFremenCunningOffer, null);
  assert.equal(passed.nexusCards!.cards!.hands.f, null);
  assert.throws(() => applyAction(g, 'f', {
    type: 'decision', event: 'not-this-worm', accept: true,
  }), /empty-worm Nexus opportunity/);
  g = applyAction(nexusReload(g), 'f', { type: 'decision', event, accept: true });
  assert.equal(g.response?.kind, 'nexusFremenCunning');
  assert.equal(g.nexusCards!.cards!.hands.f, null);
  assert.ok(g.nexusCards!.cards!.discard.includes('fremen'));
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
  const canceled = applyAction(nexusReload(g), 'a', {
    type: 'card', card: g.players[1].hand[0].id, mode: 'cancel',
  });
  assert.equal(canceled.nexusFremenCunningRides?.[0].stage, 'complete');
  assert.ok(canceled.log.some(line => line.text.includes('Shai-Hulud appeared')));
  assert.equal(canceled.players[0].forces[`wind_pass:${sourceSector}`], 1);
  nexusInventory(canceled);
  g = nexusAllow(g);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
  for (let i = 0; !g.decision && g.phase === 1 && i < 6; i++) {
    if (g.response) g = nexusAllow(g);
    else g = nexusReady(g);
  }
  assert.equal(g.decision?.kind, 'nexusFremenCunningRide');
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'select');
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
  const botView = viewGame(g, 'f');
  botView.players.find(player => player.id === 'f')!.bot = 'Easy';
  const botRide = botActions(botView).find(candidate => candidate.accept === true);
  assert.ok(botRide);
  const botResult = applyAction(nexusReload(g), 'f', botRide);
  assert.equal(botResult.nexusFremenCunningRides?.[0].stage, 'complete');
  nexusInventory(botResult);
  const action = {
    type: 'decision' as const, event, accept: true, source: 'wind_pass',
    forces: { [`wind_pass:${sourceSector}`]: { normal: 1, elite: 0 } },
    territory: 'polar_sink', sector: 0,
  };
  assert.throws(() => applyAction(g, 'f', { ...action, source: 'sietch_tabr' }),
    /desert territory/);
  assert.throws(() => applyAction(g, 'f', {
    ...action, forces: { constructor: { normal: 20, elite: 0 } },
  }), /physical forces/);
  const before = nexusReload(g);
  assert.deepEqual(g, before);
  g = applyAction(g, 'f', action);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
  assert.equal(g.players[0].forces[`wind_pass:${sourceSector}`] ?? 0, 0);
  assert.equal(g.players[0].forces['polar_sink:0'], 1);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
  nexusInventory(g);
});

void test('an accepted Advanced additional-worm placement offers the distinct empty appearance', () => {
  let g = nexusTurnTwo({ advanced: true });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('fremen');
  assert.ok(index >= 0);
  cards.hands.f = cards.deck.splice(index, 1)[0];
  const sourceSector = g.storm === 14 ? 15 : 14;
  g.players[0].reserves--;
  g.players[0].forces[`wind_pass:${sourceSector}`] = 1;
  const empty = TERRITORIES.find(row => row.type === 'sand' &&
    g.players.every(player => presenceAt(player, row.id) === 0));
  assert.ok(empty);
  orderNexusSpice(g, ['worm', 'land']);
  const priorWorm = g.spiceDeck.findIndex((card, i) => i > 1 && 'worm' in card);
  assert.ok(priorWorm > 1);
  g.spiceDiscard[0].push(g.spiceDeck.splice(priorWorm, 1)[0]);
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'wormPlacement');
  g = applyAction(g, 'f', { type: 'decision', accept: true, territory: empty.id });
  g = nexusAllow(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  const occurrence = g.nexusFremenCunningOffer!.occurrence;
  assert.equal(occurrence.origin, 'additional');
  assert.equal(occurrence.territory, empty.id);
  assert.equal(occurrence.initiallyEmpty, true);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
  g = applyAction(g, 'f', { type: 'decision', event: occurrence.event, accept: true });
  g = nexusAllow(g);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
  assert.equal(g.nexusFremenCunningRides?.[0].occurrence.event, occurrence.event);
  assert.equal(g.nexusCards!.cards!.hands.f, null);
  nexusInventory(g);
});
