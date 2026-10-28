import assert from 'node:assert/strict';
import test from 'node:test';
import { HomeworldCustodyError, type HomeworldCustody } from '../game/homeworld-custody';
import type { HomeworldShipmentContext } from '../game/homeworld-shipment';
import { createRicheseNoField, type RicheseNoField } from '../game/richese-no-field';
import { quoteRicheseHomeworldMarkerShipment as quote,
  type RicheseHomeworldMarkerShipmentIntent } from '../game/richese-homeworld-marker-shipment';

function fixture(): { context: HomeworldShipmentContext; custody: HomeworldCustody; noField: RicheseNoField;
  intent: RicheseHomeworldMarkerShipmentIntent } {
  return {
    context: { advanced: true, players: [
      { id: 'r', faction: 'richese', reserves: 12, eliteReserves: 0, ally: null },
      { id: 'a', faction: 'atreides', reserves: 17, eliteReserves: 0, ally: null },
      { id: 'g', faction: 'guild', reserves: 20, eliteReserves: 0, ally: null },
    ] },
    custody: { salusa: null, visitors: { 'homeworld:atreides': { r: { normal: 2, elite: 0 } } } },
    noField: createRicheseNoField(['zero', 'three', 'five']),
    intent: { player: 'r', destination: 'homeworld:atreides', tokenId: 'zero' },
  };
}

void test('each concealed token ships as one marker at one spice without withdrawing a physical reserve', () => {
  for (const advanced of [false, true]) for (const tokenId of ['zero', 'three', 'five']) {
    const f = fixture(); f.context.advanced = advanced; f.intent.tokenId = tokenId;
    const before = structuredClone(f);
    const result = quote(f.context, f.custody, f.intent, f.noField);
    assert.deepEqual({ player: result.player, tokenId: result.tokenId, source: result.source,
      destination: result.destination, amount: result.amount, elite: result.elite, cost: result.cost },
    { player: 'r', tokenId, source: 'homeworld:richese', destination: 'homeworld:atreides', amount: 1, elite: 0, cost: 1 });
    assert.deepEqual(result.noField.deployed, { tokenId, controller: 'r', location: { homeworld: 'homeworld:atreides' } });
    assert.equal(result.noField.lastShipped, tokenId);
    assert.deepEqual(f, before);
    result.noField.tokens[0].id = 'detached';
    assert.deepEqual(f, before);
  }
});

void test('rates and empty physical reserves do not alter the one-marker invoice', () => {
  const f = fixture(); f.context.players[0].reserves = 0;
  f.context.purchasedGuildRate = true; f.context.nativeGuildRateCanceled = true;
  const result = quote(f.context, f.custody, f.intent, f.noField);
  assert.equal(result.amount, 1); assert.equal(result.cost, 1);
  assert.equal(f.context.players[0].reserves, 0);
  assert.equal(f.custody.visitors['homeworld:atreides'].r.normal, 2);
});

void test('own, allied, inactive and forged destinations or actors reject without mutation', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.intent.player = 'g'; },
    (f: ReturnType<typeof fixture>) => { f.intent.destination = 'homeworld:richese'; },
    (f: ReturnType<typeof fixture>) => { f.intent.destination = 'homeworld:unknown'; },
    (f: ReturnType<typeof fixture>) => { f.context.players[0].ally = 'a'; f.context.players[1].ally = 'r'; },
    (f: ReturnType<typeof fixture>) => { (f.intent as unknown as Record<string, unknown>).extra = 1; },
    (f: ReturnType<typeof fixture>) => { f.context.players[0].ally = 'missing'; },
  ]) {
    const f = fixture(); change(f); const before = structuredClone(f);
    assert.throws(() => quote(f.context, f.custody, f.intent, f.noField), HomeworldCustodyError);
    assert.deepEqual(f, before);
  }
});

void test('invalid, deployed and consecutively used physical markers cannot be shipped', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.intent.tokenId = 'missing'; },
    (f: ReturnType<typeof fixture>) => { f.noField.lastShipped = 'zero'; },
    (f: ReturnType<typeof fixture>) => {
      f.noField = quote(f.context, f.custody, f.intent, f.noField).noField;
      f.intent.tokenId = 'three';
    },
    (f: ReturnType<typeof fixture>) => { f.noField.tokens[1].value = 5; },
  ]) {
    const f = fixture(); change(f); const before = structuredClone(f);
    assert.throws(() => quote(f.context, f.custody, f.intent, f.noField), HomeworldCustodyError);
    assert.deepEqual(f, before);
  }
});

void test('malformed physical Homeworld custody is rejected before marker deployment', () => {
  const f = fixture(); f.custody.visitors['homeworld:unknown'] = { r: { normal: 1, elite: 0 } };
  const before = structuredClone(f);
  assert.throws(() => quote(f.context, f.custody, f.intent, f.noField), HomeworldCustodyError);
  assert.deepEqual(f, before);
});
