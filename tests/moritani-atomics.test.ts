import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atomicsAllianceStatus,
  atomicsEffectiveHandLimit,
  atomicsShipmentBlocked,
  quoteMoritaniAtomics,
  type AtomicsPlayer,
  type AtomicsAftermath,
} from '../game/moritani-atomics';
import type { TerrorToken } from '../game/moritani-terror';

const token: TerrorToken = {
  id: 'terror-opaque', kind: 'atomics', status: 'placed', location: 'arrakeen',
};
const moritani: AtomicsPlayer = {
  id: 'm', faction: 'moritani', ally: null, forces: {}, tanks: 0,
  handSize: 4, baseHandLimit: 4,
};
const quote = (players: readonly AtomicsPlayer[], aftermath: AtomicsAftermath | null = null) =>
  quoteMoritaniAtomics({ token, territory: 'arrakeen', players,
    moritaniId: 'm', turn: 3, aftermath });

void test('no ally at activation: all owners lose typed forces in the territory, not elsewhere', () => {
  const players: AtomicsPlayer[] = [
    { ...moritani, forces: { 'arrakeen:10': 2, 'carthag:11': 3 } },
    { id: 'ix', faction: 'ixians', ally: null, forces: {
      'arrakeen:10': 4, 'carthag:11': 2,
    }, elites: { reserves: 0, tanks: 0, revived: 0,
      forces: { 'arrakeen:10': 2 } }, tanks: 1,
    handSize: 5, baseHandLimit: 4 },
    { id: 'bg', faction: 'beneGesserit', ally: null,
      forces: { 'arrakeen:10': 1, 'carthag:11': 2 },
      advisors: { arrakeen: {} }, tanks: 0, handSize: 4, baseHandLimit: 4 },
    { id: 'zero', faction: 'fremen', ally: null,
      forces: { 'arrakeen:10': 0 }, tanks: 0,
      handSize: 0, baseHandLimit: 4 },
  ];
  const before = structuredClone(players);
  const plan = quote(players);
  assert.deepEqual(plan.casualties, [
    { playerId: 'm', location: 'arrakeen:10', normal: 2, elite: 0, advisor: 0 },
    { playerId: 'ix', location: 'arrakeen:10', normal: 2, elite: 2, advisor: 0 },
    { playerId: 'bg', location: 'arrakeen:10', normal: 1, elite: 0, advisor: 1 },
  ]);
  assert.deepEqual(plan.handReductions,
    [{ playerId: 'm', limit: 3, randomDiscards: 1 }]);
  assert.deepEqual(plan.aftermath, { territory: 'arrakeen', turn: 3,
    moritaniId: 'm', allyAtActivation: null, alliancePolicy: 'unresolved' });
  assert.deepEqual(players, before);
  assert.equal(atomicsEffectiveHandLimit(plan.aftermath, 'ix', null, 4), 4);
  assert.equal(atomicsEffectiveHandLimit(plan.aftermath, 'm', null, 4), 3);
  assert.equal(atomicsAllianceStatus(plan.aftermath, null), 'activation-alliance');
  assert.equal(atomicsAllianceStatus(plan.aftermath, 'newAlly'), 'clarification-required');
  assert.throws(() => atomicsEffectiveHandLimit(plan.aftermath, 'm', 'newAlly', 4),
    /alliance change/);
});

void test('activation ally is reduced with Moritani; counts exceed-one overflow without selecting cards', () => {
  const plan = quote([
    { ...moritani, ally: 'choam', handSize: 6, baseHandLimit: 4 },
    { id: 'choam', faction: 'choam', ally: 'm', tanks: 0,
      forces: { 'arrakeen:10': 1 }, handSize: 6, baseHandLimit: 5 },
    { id: 'other', faction: 'harkonnen', ally: null, tanks: 0,
      forces: {}, handSize: 9, baseHandLimit: 8 },
  ]);
  assert.deepEqual(plan.handReductions, [
    { playerId: 'm', limit: 3, randomDiscards: 3 },
    { playerId: 'choam', limit: 4, randomDiscards: 2 },
  ]);
  assert.equal(atomicsEffectiveHandLimit(plan.aftermath, 'choam', 'choam', 5), 4);
  assert.equal(atomicsEffectiveHandLimit(plan.aftermath, 'other', 'choam', 8), 8);
  for (const next of [null, 'other']) {
    assert.equal(atomicsAllianceStatus(plan.aftermath, next), 'clarification-required');
    assert.throws(() => atomicsEffectiveHandLimit(plan.aftermath, 'other', next, 8),
      /alliance change/);
  }
});

void test('Aftermath blocks shipment by territory regardless of faction or sector, not other territories', () => {
  const aftermath = quote([moritani]).aftermath;
  assert.equal(atomicsShipmentBlocked(aftermath, 'arrakeen'), true);
  assert.equal(atomicsShipmentBlocked(aftermath, 'carthag'), false);
  assert.equal(atomicsShipmentBlocked(null, 'arrakeen'), false);
  assert.equal(atomicsShipmentBlocked(aftermath, 'arrakeen:10'), false);
});

void test('placement, existing Aftermath, alliance inconsistency and malformed physical custody fail closed', () => {
  const aftermath = quote([moritani]).aftermath;
  assert.throws(() => quote([moritani], aftermath), /already on the board/);
  for (const wrong of [
    { ...token, status: 'removed', location: null } as TerrorToken,
    { ...token, kind: 'robbery' } as TerrorToken,
    { ...token, location: 'hidden_mobile_stronghold' } as TerrorToken,
    { ...token, location: 'carthag' } as TerrorToken,
  ]) assert.throws(() => quoteMoritaniAtomics({ token: wrong,
    territory: 'arrakeen', moritaniId: 'm', turn: 3,
    aftermath: null, players: [moritani] }),
  /still-placed token/);
  assert.throws(() => quoteMoritaniAtomics({ token, territory: 'carthag',
    moritaniId: 'm', turn: 3, aftermath: null, players: [moritani] }),
  /entered ordinary stronghold/);
  assert.throws(() => quote([{ ...moritani, ally: 'missing' }]), /mutual ally/);
  assert.throws(() => quote([{ ...moritani, forces: { 'arrakeen:11': 1 } }]),
    /valid typed forces/);
  assert.throws(() => quote([{ ...moritani, forces: { 'arrakeen:10': 1 },
    elites: { reserves: 0, tanks: 0, revived: 0,
      forces: { 'arrakeen:10': 2 } } }]), /valid typed forces/);
  assert.throws(() => quote([{ ...moritani, noField: {
    tokens: [{ id: 'zero', value: 0 }], lastShipped: null,
    deployed: { tokenId: 'zero', controller: 'm',
      location: { territory: 'arrakeen', sector: 10 } },
  } }]), /concealed No-Field/);
});

void test('a token at a storm-exposed stronghold still quotes all occupied counters', () => {
  const stormExposed = quoteMoritaniAtomics({
    token: { ...token, location: 'tueks_sietch' }, territory: 'tueks_sietch', players: [
      { ...moritani, forces: { 'tueks_sietch:5': 1, 'arrakeen:10': 1 } },
    ], moritaniId: 'm', turn: 4, aftermath: null,
  });
  assert.deepEqual(stormExposed.casualties,
    [{ playerId: 'm', location: 'tueks_sietch:5', normal: 1, elite: 0, advisor: 0 }]);
  assert.equal(stormExposed.aftermath.territory, 'tueks_sietch');
});
