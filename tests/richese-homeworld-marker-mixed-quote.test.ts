import assert from 'node:assert/strict';
import test from 'node:test';
import { HomeworldCustodyError, type HomeworldCustody } from '../game/homeworld-custody';
import type { HomeworldShipmentContext } from '../game/homeworld-shipment';
import { quoteRicheseHomeworldMarkerTransfer as quote, type RicheseHomeworldMarkerTransferIntent } from '../game/richese-homeworld-marker-shipment';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';

function fixture(tokenId = 'zero', physical = 20) {
  const context: HomeworldShipmentContext = { advanced: true, players: [
    { id: 'r', faction: 'richese', reserves: 0, eliteReserves: 0, ally: null },
    { id: 'a', faction: 'atreides', reserves: 17, eliteReserves: 0, ally: null },
    { id: 'g', faction: 'guild', reserves: 20, eliteReserves: 0, ally: null },
  ] };
  const custody: HomeworldCustody = { salusa: null, visitors: {
    'homeworld:atreides': { r: { normal: physical, elite: 0 } },
  } };
  const noField = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']),
    { tokenId, controller: 'r', location: { homeworld: 'homeworld:atreides' } });
  const intent: RicheseHomeworldMarkerTransferIntent = { player: 'r', tokenId,
    source: 'homeworld:atreides', destination: 'homeworld:guild', forces: { normal: 2, elite: 0 } };
  return { context, custody, noField, intent };
}

void test('mixed transfers move actual same-source counters and preserve concealed marker custody in both modes', () => {
  for (const advanced of [false, true]) for (const tokenId of ['zero', 'three', 'five']) {
    const f = fixture(tokenId);
    f.context.advanced = advanced;
    const before = structuredClone(f);
    const result = quote(f.context, f.custody, f.intent, f.noField);
    assert.equal(result.amount, 3);
    assert.equal(result.cost, 3);
    assert.equal(result.elite, 0);
    assert.equal(result.noField.lastShipped, tokenId);
    assert.deepEqual(result.noField.deployed, { tokenId, controller: 'r', location: { homeworld: 'homeworld:guild' } });
    assert.deepEqual(result.state?.visitors['homeworld:atreides'].r, { normal: 18, elite: 0 });
    assert.deepEqual(result.state?.visitors['homeworld:guild'].r, { normal: 2, elite: 0 });
    assert.deepEqual(result.sources?.[0], { homeworld: 'homeworld:atreides', player: 'r',
      before: { normal: 20, elite: 0 }, after: { normal: 18, elite: 0 } });
    assert.equal(result.players?.find(p => p.id === 'r')?.reserves, 0);
    assert.deepEqual(f, before);
    result.state!.visitors['homeworld:guild'].r.normal = 0;
    result.noField.tokens[0].id = 'detached';
    assert.deepEqual(f, before);
  }
});

void test('purchased Guild rate rounds once over the full marker and physical group', () => {
  for (const physical of [1, 2, 3, 19, 20]) {
    const f = fixture();
    f.context.purchasedGuildRate = true;
    f.intent.forces = { normal: physical, elite: 0 };
    const result = quote(f.context, f.custody, f.intent, f.noField);
    assert.equal(result.amount, physical + 1);
    assert.equal(result.cost, Math.ceil((physical + 1) / 2));
  }
});

void test('zero physical forces preserve marker-only quote; malformed or unavailable groups reject immutably', () => {
  const f = fixture();
  const legacy = { ...f.intent }; delete legacy.forces;
  const zero = { ...f.intent, forces: { normal: 0, elite: 0 } };
  assert.deepEqual(quote(f.context, f.custody, zero, f.noField), quote(f.context, f.custody, legacy, f.noField));
  for (const forces of [
    { normal: 21, elite: 0 }, { normal: 1, elite: 1 }, { normal: -1, elite: 0 },
    { normal: 0.5, elite: 0 }, { normal: 1 }, { normal: 1, elite: 0, extra: 0 }, null,
  ]) {
    const bad = { ...f.intent, forces } as unknown as RicheseHomeworldMarkerTransferIntent;
    const before = structuredClone({ f, bad });
    assert.throws(() => quote(f.context, f.custody, bad, f.noField), HomeworldCustodyError);
    assert.deepEqual({ f, bad }, before);
  }
});

void test('physical counters at a different world cannot accompany this marker', () => {
  const f = fixture('zero', 1);
  f.custody.visitors['homeworld:guild'] = { r: { normal: 2, elite: 0 } };
  f.intent.forces = { normal: 2, elite: 0 };
  const before = structuredClone(f);
  assert.throws(() => quote(f.context, f.custody, f.intent, f.noField), HomeworldCustodyError);
  assert.deepEqual(f, before);
});
