import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody, quoteHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  richeseHomeworldShipmentEnabled, quoteRicheseHomeworldForces, quoteRicheseHomeworldPair,
  RicheseHomeworldShipmentError, type RicheseHomeworldForcesInput, type RicheseHomeworldPairInput,
} from '../game/richese-homeworld-shipment';

/** Controlled native population context, not an earned shipment chronology. */
function populationContext(population = 10, advanced = false): Pick<Game, 'advanced' | 'players' | 'homeworlds'> {
  const players = [newPlayer('r', 'Richese', 'richese'), newPlayer('g', 'Guild', 'guild')];
  players[0].reserves = population;
  players[0].tanks = 20 - population;
  return { advanced, players, homeworlds: { custody: createHomeworldCustody(homeworldContext({ advanced, players })) } };
}

void test('native Richese High enables mixed No-Field shipment at ten counters in both rules bands', () => {
  for (const advanced of [false, true]) for (const population of [0, 9, 10, 11, 20]) {
    const context = populationContext(population, advanced), before = structuredClone(context);
    assert.equal(richeseHomeworldShipmentEnabled(context, 'r'), population >= 10);
    assert.equal(richeseHomeworldShipmentEnabled(context, 'g'), false);
    assert.equal(richeseHomeworldShipmentEnabled(context, 'missing'), false);
    assert.deepEqual(context, before);
  }
});

void test('missing custody and foreign visitors cannot supply the native Richese High entitlement', () => {
  const context = populationContext(9);
  assert.equal(richeseHomeworldShipmentEnabled({ ...context, homeworlds: undefined }, 'r'), false);
  assert.equal(richeseHomeworldShipmentEnabled({ ...context, homeworlds: { custody: null } }, 'r'), false);
  const visit = quoteHomeworldCustody(homeworldContext(context), context.homeworlds!.custody!, [
    { homeworld: 'homeworld:guild', player: 'g', withdraw: { normal: 8, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:richese', player: 'g', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 8, elite: 0 } },
  ]);
  for (const next of visit.players) context.players.find(player => player.id === next.id)!.reserves = next.reserves;
  context.homeworlds!.custody = visit.state;
  assert.equal(richeseHomeworldShipmentEnabled(context, 'r'), false);
});

const shipment = (patch: Partial<RicheseHomeworldForcesInput> = {}): RicheseHomeworldForcesInput => ({
  enabled: true, reserves: 10, amount: 3, ...patch,
});

void test('one marker and paid physical forces form one priced group independently of concealed value', () => {
  const input = shipment(), before = structuredClone(input);
  assert.deepEqual(quoteRicheseHomeworldForces(input), { paid: 3, physical: 3, priced: 4 });
  assert.deepEqual(input, before);
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ amount: 20, reserves: 20 })), { paid: 20, physical: 20, priced: 21 });
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ amount: 0, reserves: 0 })), { paid: 0, physical: 0, priced: 1 });
});

void test('a Smuggler force consumes a real reserve counter without adding to the paid invoice', () => {
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ smuggler: true })), { paid: 3, physical: 4, priced: 4 });
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ amount: 19, reserves: 20, smuggler: true })), { paid: 19, physical: 20, priced: 20 });
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ reserves: 3, smuggler: true })), /physical reserves/);
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ amount: 20, reserves: 20, smuggler: true })), /physical reserves/);
});

void test('ordinary marker-only shipment remains available without the benefit but cannot manufacture forces', () => {
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ enabled: false, amount: 0, reserves: 0 })), { paid: 0, physical: 0, priced: 1 });
  assert.deepEqual(quoteRicheseHomeworldForces(shipment({ enabled: false, amount: 0, reserves: 1, smuggler: true })), { paid: 0, physical: 1, priced: 1 });
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ enabled: false })), /High population/);
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ reserves: 2 })), /physical reserves/);
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ amount: 0, reserves: 0, smuggler: true })), /physical reserves/);
});

void test('malformed physical counts and source flags reject before producing a quote', () => {
  for (const field of ['reserves', 'amount'] as const) for (const value of [-1, 0.5, 21, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = shipment({ [field]: value }), before = structuredClone(input);
    assert.throws(() => quoteRicheseHomeworldForces(input), RicheseHomeworldShipmentError);
    assert.deepEqual(input, before);
  }
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ enabled: 'yes' as unknown as boolean })), RicheseHomeworldShipmentError);
  assert.throws(() => quoteRicheseHomeworldForces(shipment({ smuggler: 1 as unknown as boolean })), RicheseHomeworldShipmentError);
});

void test('public pair reserves paid counters before materializing a scarce revealed denomination', () => {
  const input: RicheseHomeworldPairInput = { enabled: true, reserves: 5, amount: 4, revealedValue: 5 };
  const before = structuredClone(input);
  assert.deepEqual(quoteRicheseHomeworldPair(input), { paid: 4, physical: 5, priced: 5, revealed: 1 });
  assert.deepEqual(input, before);
  assert.deepEqual(quoteRicheseHomeworldPair({ enabled: true, reserves: 3, amount: 3, revealedValue: 3 }),
    { paid: 3, physical: 3, priced: 4, revealed: 0 });
});

void test('public zero, three and five affect physical reveal without changing the combined paid invoice', () => {
  for (const revealedValue of [0, 3, 5] as const) {
    const input = { enabled: true, reserves: 10, amount: 2, revealedValue };
    const before = structuredClone(input);
    assert.deepEqual(quoteRicheseHomeworldPair(input),
      { paid: 2, physical: 2 + revealedValue, priced: 3, revealed: revealedValue });
    assert.deepEqual(input, before);
  }
});

void test('ordinary zero-paid public pairs need no High benefit and reveal only actual remaining stock', () => {
  for (const revealedValue of [0, 3, 5] as const) {
    const input = { enabled: false, reserves: 2, amount: 0, revealedValue };
    const revealed = Math.min(2, revealedValue);
    assert.deepEqual(quoteRicheseHomeworldPair(input), { paid: 0, physical: revealed, priced: 1, revealed });
    assert.deepEqual(quoteRicheseHomeworldPair({ ...input, reserves: 0 }),
      { paid: 0, physical: 0, priced: 1, revealed: 0 });
  }
  assert.throws(() => quoteRicheseHomeworldPair({ enabled: false, reserves: 10, amount: 1, revealedValue: 3 }), /High population/);
  assert.throws(() => quoteRicheseHomeworldPair({ enabled: true, reserves: 2, amount: 3, revealedValue: 5 }), /physical reserves/);
});

void test('public pair rejects invalid denominations and reuses safe physical count validation without mutation', () => {
  const invalid: unknown[] = [-1, 1, 2, 4, 6, 3.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '3', null, undefined];
  for (const value of invalid) {
    const input: RicheseHomeworldPairInput = {
      enabled: true, reserves: 10, amount: 2, revealedValue: value as RicheseHomeworldPairInput['revealedValue'],
    };
    const before = structuredClone(input);
    assert.throws(() => quoteRicheseHomeworldPair(input), RicheseHomeworldShipmentError);
    assert.deepEqual(input, before);
  }
  for (const field of ['reserves', 'amount'] as const) for (const value of [-1, 0.5, 21, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input: RicheseHomeworldPairInput = { enabled: true, reserves: 10, amount: 2, revealedValue: 3, [field]: value };
    const before = structuredClone(input);
    assert.throws(() => quoteRicheseHomeworldPair(input), RicheseHomeworldShipmentError);
    assert.deepEqual(input, before);
  }
});
