import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { createRicheseNoField, deployRicheseNoField, type NoFieldValue } from '../game/richese-no-field';
import { guildTransportQuote } from '../game/transport-quote';
import { quoteNexusGuildSecretShipment } from '../game/nexus-guild-secret-ally';
import { nexusGuildSecretAllyAction, nexusGuildSecretAllyQuote } from '../game/nexus-guild-secret-ally-options';
import { ShipmentQuote } from '../components/shipment-quote';

/** Controlled unit source, not an original-game chronology: initialize public
 * phase/armies and owned marker custody, then consume the real view projection.
 * Secret Ally offers below are explicitly public-view construction supplements;
 * native declaration, disposal and transport outcomes belong to engine tests. */
function projected({ value = 0, forces = {}, secret = false }: {
  value?: NoFieldValue;
  forces?: Record<string, number>;
  secret?: boolean;
} = {}) {
  const game = createGame('GUILDNFFORCEQUOTE', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  game.players.push(newPlayer('other', secret ? 'Atreides' : 'Guild', secret ? 'atreides' : 'guild'),
    newPlayer('h', 'Harkonnen', 'harkonnen'));
  Object.assign(game, { status: 'playing', phase: 5, turn: 2, active: 'r',
    order: ['r', 'other', 'h'], movementRemaining: ['r', 'other', 'h'], storm: 18 });
  const owner = game.players.find(player => player.id === 'r')!;
  owner.spice = 30;
  owner.forces = { ...forces };
  owner.reserves = 20 - Object.values(forces).reduce((sum, count) => sum + count, 0);
  const stock = createRicheseNoField(['controlled-zero', 'controlled-three', 'controlled-five']);
  const token = stock.tokens.find(candidate => candidate.value === value)!;
  owner.noField = deployRicheseNoField(stock, { tokenId: token.id, controller: owner.id,
    location: { territory: 'imperial_basin', sector: 10 } });
  owner.noFieldEvent = 'controlled-current-owner-event';
  if (!secret) {
    owner.ally = 'other';
    game.players.find(player => player.id === 'other')!.ally = owner.id;
  }
  const view = viewGame(game, owner.id);
  if (secret) {
    view.nexusCards = { card: 'guild', held: { r: true, other: false, h: false },
      deckCount: 11, discardCount: 0, turn: view.turn, choices: [], waiting: [] };
    view.nexusGuildSecretAlly = { event: JSON.stringify(['nexusGuildSecretAlly', view.turn, view.me]), blocked: null };
  }
  assert.ok(view.richeseNoField?.private?.deployed);
  const action: Action = { type: 'guildShip', from: 'imperial_basin:10', forces: { ...forces },
    territory: 'carthag', sector: 11, noField: token.id, event: view.richeseNoField.event };
  return { view, action };
}
function secretAction(view: GameView, action: Action) {
  const event = view.nexusGuildSecretAlly?.event; assert.ok(event);
  return nexusGuildSecretAllyAction(view, event, action);
}

void test('Secret Ally prices one marker separately from zero to twenty physical forces and preserves physical-only bounds', () => {
  assert.deepEqual(quoteNexusGuildSecretShipment('stronghold', 1, true), {
    physicalAmount: 0, cost: 1, source: 'nexusGuildSecretAlly',
  });
  assert.deepEqual(quoteNexusGuildSecretShipment('stronghold', 21, true), {
    physicalAmount: 20, cost: 11, source: 'nexusGuildSecretAlly',
  });
  assert.deepEqual(quoteNexusGuildSecretShipment('reserves', 20), {
    physicalAmount: 20, cost: 10, source: 'nexusGuildSecretAlly',
  });
  assert.deepEqual(quoteNexusGuildSecretShipment('homeworld', 1), {
    physicalAmount: 1, cost: 1, source: 'nexusGuildSecretAlly',
  });
  assert.throws(() => quoteNexusGuildSecretShipment('homeworld', 1, true));
  assert.throws(() => quoteNexusGuildSecretShipment('stronghold', 21));
  for (const amount of [0, -1, 1.5, 22])
    assert.throws(() => quoteNexusGuildSecretShipment('stronghold', amount, true));
});

void test('a concealed marker including zero quotes one billable unit and displays zero physical forces plus one marker', () => {
  for (const value of [0, 3, 5] as const) {
    const { view, action } = projected({ value });
    const quote = guildTransportQuote(view, action);
    assert.deepEqual(quote.unavailableReasons, []);
    assert.equal(quote.physicalForces, 0);
    assert.equal(quote.noField, true);
    assert.equal(quote.quote?.cost, 1);
    const html = renderToStaticMarkup(createElement(ShipmentQuote, { label: 'Guild cross-shipment', ...quote }));
    assert.match(html, /Physical forces selected<\/dt><dd[^>]*>0<\/dd>/);
    assert.match(html, /Concealed No-Field selected<\/dt><dd[^>]*>1 marker<\/dd>/);
    assert.match(html, /excluded from the physical force count/);
    assert.doesNotMatch(html, /Reveal|Materialize|5 forces|3 forces/);
  }
});

void test('a mixed same-territory group bills twenty physical counters plus its marker once', () => {
  const { view, action } = projected({ forces: { 'imperial_basin:10': 12, 'imperial_basin:11': 8 } });
  const quote = guildTransportQuote(view, action);
  assert.deepEqual(quote.unavailableReasons, []);
  assert.equal(quote.physicalForces, 20);
  assert.equal(quote.quote?.cost, 11);
  const ordinary = { ...action }; delete ordinary.noField; delete ordinary.event;
  const physical = guildTransportQuote(view, ordinary);
  assert.equal(physical.physicalForces, 20);
  assert.equal(physical.quote?.cost, 10);
  assert.equal(physical.noField, undefined);
  const html = renderToStaticMarkup(createElement(ShipmentQuote, physical));
  assert.doesNotMatch(html, /Concealed No-Field selected|one shipment unit/);
});

void test('current marker identity event source storm and physical quantities reject forged selections in quote and adapter', () => {
  const source = projected({ secret: true, forces: { 'imperial_basin:10': 2, 'imperial_basin:11': 1 } });
  const invalid: Action[] = [
    { ...source.action, noField: 'another-token' },
    { ...source.action, event: 'old-owner-event' },
    { ...source.action, forces: { 'imperial_basin:10': 3 } },
    { ...source.action, forces: { 'imperial_basin:10': -1 } },
    { ...source.action, forces: { 'imperial_basin:10': 0.5 } },
    { ...source.action, forces: [] },
    { ...source.action, from: 'reserves' },
  ];
  for (const action of invalid) {
    assert.equal(secretAction(source.view, action), null);
    assert.ok(guildTransportQuote(source.view, { ...action, nexus: source.view.nexusGuildSecretAlly!.event }).unavailableReasons.length);
  }
  for (const storm of [10, 11]) {
    const view = structuredClone(source.view); view.storm = storm;
    assert.equal(secretAction(view, source.action), null);
    assert.match(guildTransportQuote(view, { ...source.action, nexus: view.nexusGuildSecretAlly!.event }).unavailableReasons.join(' '), /source sector is in the storm/);
  }
  const foreign = structuredClone(source.view);
  foreign.richeseNoField!.public.deployed!.controller = 'other';
  assert.equal(secretAction(foreign, source.action), null);
  const mixedOrigin = structuredClone(source.view);
  mixedOrigin.players.find(player => player.id === mixedOrigin.me)!.forces['red_chasm:7'] = 1;
  const outside = { ...source.action, forces: { 'red_chasm:7': 1 } };
  assert.equal(secretAction(mixedOrigin, outside), null);
  assert.match(guildTransportQuote(mixedOrigin, { ...outside, nexus: mixedOrigin.nexusGuildSecretAlly!.event }).unavailableReasons.join(' '), /one territory/);
});

void test('ordinary Guild alliance grants cross-only while an explicit current absent-Guild source grants return at its own rate', () => {
  const native = projected({ forces: { 'imperial_basin:10': 2 } });
  const returned = { ...native.action, territory: 'reserves', sector: 0 };
  assert.match(guildTransportQuote(native.view, returned).unavailableReasons.join(' '), /Only the Guild may return/);
  native.view.guildRateCanceled = true;
  assert.equal(guildTransportQuote(native.view, native.action).quote?.cost, 3);
  const source = projected({ secret: true, forces: { 'imperial_basin:10': 2 } });
  source.view.guildRateCanceled = true;
  assert.equal(nexusGuildSecretAllyQuote(source.view, 'reserves', 21, true)?.physicalAmount, 20);
  assert.equal(nexusGuildSecretAllyQuote(source.view, 'reserves', 21), null);
  for (const territory of ['carthag', 'reserves']) {
    const original = { ...source.action, territory, sector: territory === 'reserves' ? 0 : 11 };
    const selected = secretAction(source.view, original); assert.ok(selected);
    assert.deepEqual(selected, { ...original, nexus: source.view.nexusGuildSecretAlly!.event });
    const quote = guildTransportQuote(source.view, selected);
    assert.deepEqual(quote.unavailableReasons, []);
    assert.equal(quote.physicalForces, 2);
    assert.equal(quote.quote?.cost, 2);
  }
  assert.equal(secretAction(source.view, { ...source.action, type: 'ship', amount: 1 }), null);
  assert.equal(secretAction(source.view, { ...source.action, type: 'homeworldShip', sources: {} }), null);
  assert.equal(nexusGuildSecretAllyAction(source.view, 'old-nexus-event', source.action), null);
});
