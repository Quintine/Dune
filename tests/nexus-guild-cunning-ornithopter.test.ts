import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNexusGuildCunning,
  nexusGuildCunningMoves,
  validateNexusGuildCunning,
  type NexusGuildCunningMovementBefore,
  type NexusGuildCunningMovementReceipt,
  type NexusGuildCunningReceipt,
} from '../game/nexus-guild-cunning';

const context = {
  turn: 3,
  phase: 5,
  active: 'g',
  players: [
    { id: 'a', faction: 'atreides' as const },
    { id: 'g', faction: 'guild' as const },
    { id: 'f', faction: 'fremen' as const },
  ],
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const movement = (moved: number, hajrPlays: number, ornithopterExtraMoves: number) =>
  createNexusGuildCunning(context, 'g', {
    shipped: true, moved, hajrPlays, ornithopterExtraMoves,
  });

// These pure inputs represent accepted physical movement/card-play counts.
// Original acquisition, grant replacement and an active flight's unfinished
// rights remain engine integration evidence, not claims made by these quotes.
void test('v3 Guild Cunning records completed preflight credits without losing an unused Hajr grant', () => {
  const before = Object.freeze({
    shipped: true, moved: 3, hajrPlays: 2, ornithopterExtraMoves: 1,
  });
  const receipt: NexusGuildCunningMovementReceipt = createNexusGuildCunning(context, 'g', before);
  assert.equal(receipt.version, 3);
  assert.deepEqual(receipt.before, before);
  assert.notEqual(receipt.before, before);
  assert.deepEqual(Object.keys(receipt.before).sort(), [
    'hajrPlays', 'moved', 'ornithopterExtraMoves', 'shipped',
  ]);
  assert.equal(receipt.signature, JSON.stringify([
    'nexusGuildCunningReceipt', 3, '["nexusGuildCunning",3,"g"]',
    'g', 3, 5, 'cunning', [['a', 'atreides'], ['f', 'fremen'], ['g', 'guild']],
    [true, 3, 2, 1],
  ]));
  validateNexusGuildCunning(context, clone(receipt));
  assert.equal(nexusGuildCunningMoves(receipt, 2, 0, 1), 1,
    'Two first-flight groups plus one later move consumed three physical moves, not both Hajr grants');
  assert.equal(nexusGuildCunningMoves(receipt, 2, 1, 1), 0);
  assert.throws(() => nexusGuildCunningMoves(receipt, 2, 2, 1));
  assert.deepEqual(receipt.before, before);
});

void test('completed first-flight groups consume their earned extra credit before Cunning', () => {
  const oneHajrUnused = movement(2, 1, 1);
  assert.equal(nexusGuildCunningMoves(oneHajrUnused, 1, 0, 1), 1);
  const oneHajrSpent = movement(3, 1, 1);
  assert.equal(nexusGuildCunningMoves(oneHajrSpent, 1, 0, 1), 0);
  assert.throws(() => nexusGuildCunningMoves(oneHajrSpent, 1, 1, 1));
  assert.equal(nexusGuildCunningMoves(oneHajrSpent, 2, 0, 1), 1,
    'A genuinely new Hajr play can still earn one new grant');
  const bothHajrSpent = movement(4, 2, 1);
  assert.equal(nexusGuildCunningMoves(bothHajrSpent, 2, 0, 1), 0);
});

void test('post-shipment Hajr and a completed two-group card use retain the actual physical movement count', () => {
  const receipt = movement(1, 0, 0);
  assert.equal(nexusGuildCunningMoves(receipt, 0), 0);
  assert.equal(nexusGuildCunningMoves(receipt, 1), 1,
    'The actual Hajr play earns one replacement allowance');
  assert.equal(nexusGuildCunningMoves(receipt, 1, 1), 0,
    'A range-three move or an unfinished flight has no completed extra credit');
  assert.equal(nexusGuildCunningMoves(receipt, 1, 2, 1), 0,
    'The completed two-group use records one extra credit and both physical moves');
  assert.throws(() => nexusGuildCunningMoves(receipt, 1, 3, 1));
  assert.equal(nexusGuildCunningMoves(receipt, 2, 2, 1), 1,
    'A further actual Hajr adds one grant without replaying either card group');
});

void test('Cunning never restores an ordinary move or an already spent Hajr or card credit', () => {
  for (const moved of [0, 1]) {
    const receipt = movement(moved, 0, 0);
    assert.equal(nexusGuildCunningMoves(receipt, false), 0);
    assert.throws(() => nexusGuildCunningMoves(receipt, false, 1));
  }
  const completedFlightWithoutHajr = movement(2, 0, 1);
  assert.equal(nexusGuildCunningMoves(completedFlightWithoutHajr, 0, 0, 1), 0);
  assert.throws(() => nexusGuildCunningMoves(completedFlightWithoutHajr, 0, 1, 1));
  const consumedHajr = movement(2, 1, 0);
  assert.equal(nexusGuildCunningMoves(consumedHajr, true), 0);
  assert.throws(() => nexusGuildCunningMoves(consumedHajr, true, 1));
});

void test('v1 and v2 Guild Cunning receipt bytes and default movement quotes remain unchanged', () => {
  const common = {
    event: '["nexusGuildCunning",3,"g"]', owner: 'g', turn: 3,
    phase: 5, mode: 'cunning',
    roster: [
      { id: 'a', faction: 'atreides' },
      { id: 'f', faction: 'fremen' },
      { id: 'g', faction: 'guild' },
    ],
  };
  const legacy = createNexusGuildCunning(context, 'g', {
    shipped: true, moved: 1, hajrUsed: true,
  });
  const counted = createNexusGuildCunning(context, 'g', {
    shipped: true, moved: 1, hajrPlays: 2,
  });
  assert.equal(JSON.stringify(legacy), JSON.stringify({
    version: 1, ...common,
    before: { shipped: true, moved: 1, hajrUsed: true },
    signature: '["nexusGuildCunningReceipt",1,"[\\"nexusGuildCunning\\",3,\\"g\\"]","g",3,5,"cunning",[["a","atreides"],["f","fremen"],["g","guild"]],[true,1,true]]',
  }));
  assert.equal(JSON.stringify(counted), JSON.stringify({
    version: 2, ...common,
    before: { shipped: true, moved: 1, hajrPlays: 2 },
    signature: '["nexusGuildCunningReceipt",2,"[\\"nexusGuildCunning\\",3,\\"g\\"]","g",3,5,"cunning",[["a","atreides"],["f","fremen"],["g","guild"]],[true,1,2]]',
  }));
  validateNexusGuildCunning(context, clone(legacy));
  validateNexusGuildCunning(context, clone(counted));
  assert.equal(nexusGuildCunningMoves(legacy, true), 1);
  assert.equal(nexusGuildCunningMoves(legacy, true, 1), 0);
  assert.equal(nexusGuildCunningMoves(counted, 2), 2);
  assert.equal(nexusGuildCunningMoves(counted, 2, 2), 0);
});

void test('older signed receipts can count genuinely new Ornithopter credits without changing their original snapshots', () => {
  const receipts = [
    createNexusGuildCunning(context, 'g', { shipped: true, moved: 1, hajrUsed: false }),
    createNexusGuildCunning(context, 'g', { shipped: true, moved: 1, hajrPlays: 0 }),
  ];
  for (const receipt of receipts) {
    const original = JSON.stringify(receipt);
    assert.equal(nexusGuildCunningMoves(receipt, 1, 2, 1), 0);
    assert.equal(nexusGuildCunningMoves(receipt, 2, 2, 1), 1);
    assert.equal(JSON.stringify(receipt), original);
    validateNexusGuildCunning(context, receipt);
  }
});

void test('v3 validates exact original movement shapes and safe combined ceilings', () => {
  const before: NexusGuildCunningMovementBefore = {
    shipped: true, moved: 2, hajrPlays: 1, ornithopterExtraMoves: 1,
  };
  for (const bad of [
    { ...before, shipped: 1 },
    { ...before, moved: -1 },
    { ...before, moved: 0.5 },
    { ...before, moved: 4 },
    { ...before, moved: Number.MAX_SAFE_INTEGER + 1 },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, undefined, true].map(
      ornithopterExtraMoves => ({ ...before, ornithopterExtraMoves })),
    { ...before, hajrPlays: -1 },
    { ...before, hajrPlays: Number.MAX_SAFE_INTEGER - 1 },
    { ...before, hajrUsed: true },
    { ...before, privateFlight: {} },
  ]) assert.throws(() => createNexusGuildCunning(context, 'g', bad as NexusGuildCunningMovementBefore));
  const maximum = movement(1, Number.MAX_SAFE_INTEGER - 2, 1);
  assert.equal(nexusGuildCunningMoves(maximum, Number.MAX_SAFE_INTEGER - 2, 0, 1), Number.MAX_SAFE_INTEGER - 1);
  assert.equal(nexusGuildCunningMoves(maximum, Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER - 1, 1), 0);
});

void test('current movement counts cannot lose original grants, overflow, or overconsume the signed allowance', () => {
  const receipt = movement(2, 1, 1);
  for (const currentExtra of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, true, null])
    assert.throws(() => nexusGuildCunningMoves(receipt, 1, 0, currentExtra as number));
  for (const currentHajr of [0, false, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER - 1])
    assert.throws(() => nexusGuildCunningMoves(receipt, currentHajr, 0, 1));
  for (const consumed of [-1, 0.5, NaN, Infinity, 2])
    assert.throws(() => nexusGuildCunningMoves(receipt, 1, consumed, 1));
  assert.throws(() => nexusGuildCunningMoves(receipt, 1),
    'A v3 receipt with prior extra credits requires their actual current count');
  assert.equal(nexusGuildCunningMoves(receipt, true, 1, 1), 0);
});

void test('v3 signatures bind original card credits and cannot be relabelled as a legacy format', () => {
  const receipt = movement(2, 1, 1);
  const mutations: ((value: NexusGuildCunningMovementReceipt) => void)[] = [
    value => { value.before.ornithopterExtraMoves = 2; },
    value => { value.before.hajrPlays = 2; },
    value => { value.before.moved = 1; },
    value => { value.before.shipped = false; },
    value => { value.signature = ''; },
  ];
  for (const change of mutations) {
    const invalid = clone(receipt); change(invalid);
    assert.throws(() => validateNexusGuildCunning(context, invalid));
  }
  for (const version of [1, 2, 4])
    assert.throws(() => validateNexusGuildCunning(context, {
      ...receipt, version,
    } as NexusGuildCunningReceipt));
  for (const version of [1, 2]) {
    const original = version === 1
      ? createNexusGuildCunning(context, 'g', { shipped: true, moved: 1, hajrUsed: true })
      : createNexusGuildCunning(context, 'g', { shipped: true, moved: 1, hajrPlays: 1 });
    assert.throws(() => validateNexusGuildCunning(context, {
      ...original, before: { ...original.before, ornithopterExtraMoves: undefined },
    } as NexusGuildCunningReceipt));
  }
});
