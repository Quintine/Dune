import assert from 'node:assert/strict';
import test from 'node:test';
import { HomeworldCustodyError, type HomeworldCustody } from '../game/homeworld-custody';
import type { HomeworldShipmentContext } from '../game/homeworld-shipment';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';
import { quoteRicheseHomeworldMarkerTransfer as quote } from '../game/richese-homeworld-marker-shipment';

function fixture(tokenId = 'zero') {
  const context: HomeworldShipmentContext = { advanced: true, players: [
    { id: 'r', faction: 'richese', reserves: 0, eliteReserves: 0, ally: null },
    { id: 'a', faction: 'atreides', reserves: 17, eliteReserves: 0, ally: null },
    { id: 'g', faction: 'guild', reserves: 20, eliteReserves: 0, ally: null },
  ] };
  const custody: HomeworldCustody = { salusa: null, visitors: { 'homeworld:atreides': { r: { normal: 2, elite: 0 } } } };
  const noField = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']),
    { tokenId, controller: 'r', location: { homeworld: 'homeworld:atreides' } });
  return { context, custody, noField, intent: { player: 'r', tokenId, source: 'homeworld:atreides', destination: 'homeworld:guild' } };
}

void test('each physical marker transfers as one without materialization or shipment-history changes', () => {
  for (const advanced of [false, true]) for (const tokenId of ['zero', 'three', 'five']) {
    const f = fixture(tokenId); f.context.advanced = advanced;
    const before = structuredClone(f), result = quote(f.context, f.custody, f.intent, f.noField);
    assert.deepEqual({ player: result.player, tokenId: result.tokenId, source: result.source,
      destination: result.destination, amount: result.amount, elite: result.elite, cost: result.cost },
    { player: 'r', tokenId, source: 'homeworld:atreides', destination: 'homeworld:guild', amount: 1, elite: 0, cost: 1 });
    assert.deepEqual(result.noField.deployed, { tokenId, controller: 'r', location: { homeworld: 'homeworld:guild' } });
    assert.equal(result.noField.lastShipped, tokenId);
    assert.deepEqual(result.noField.tokens, f.noField.tokens);
    assert.deepEqual(f, before);
    result.noField.tokens[0].id = 'detached';
    assert.deepEqual(f, before);
  }
});

void test('missing, stale, own-world, same-world, allied and foreign marker requests reject immutably', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.intent.tokenId = 'three'; },
    (f: ReturnType<typeof fixture>) => { f.intent.source = 'homeworld:guild'; },
    (f: ReturnType<typeof fixture>) => { f.intent.destination = 'homeworld:atreides'; },
    (f: ReturnType<typeof fixture>) => { f.intent.destination = 'homeworld:richese'; },
    (f: ReturnType<typeof fixture>) => { f.intent.destination = 'homeworld:unknown'; },
    (f: ReturnType<typeof fixture>) => { f.intent.player = 'a'; },
    (f: ReturnType<typeof fixture>) => { f.noField.deployed = null; },
    (f: ReturnType<typeof fixture>) => { f.context.players[0].ally = 'g'; f.context.players[2].ally = 'r'; },
    (f: ReturnType<typeof fixture>) => { (f.intent as unknown as Record<string, unknown>).extra = true; },
  ]) {
    const f = fixture(); change(f); const before = structuredClone(f);
    assert.throws(() => quote(f.context, f.custody, f.intent, f.noField), HomeworldCustodyError);
    assert.deepEqual(f, before);
  }
});
