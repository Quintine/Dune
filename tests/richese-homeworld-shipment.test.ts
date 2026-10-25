import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody, quoteHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  richeseHomeworldShipmentEnabled, quoteRicheseHomeworldForces, RicheseHomeworldShipmentError,
  type RicheseHomeworldForcesInput,
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
