import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNexusGuildCunning,
  nexusGuildCunningMoves,
  validateNexusGuildCunning,
  type NexusGuildCunningCountedBefore,
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
const counted = (moved: number, hajrPlays: number) =>
  createNexusGuildCunning(context, 'g', { shipped: true, moved, hajrPlays });

// Counts describe already accepted physical card plays. The engine, rather
// than this allowance quote, proves actual Box retrieval and Advanced timing.
void test('counted Guild Cunning preserves the exact original boolean receipt bytes and allowance', () => {
  const receipt = createNexusGuildCunning(context, 'g', {
    shipped: true, moved: 1, hajrUsed: true,
  });
  const original = {
    version: 1,
    event: '["nexusGuildCunning",3,"g"]',
    owner: 'g',
    turn: 3,
    phase: 5,
    mode: 'cunning',
    roster: [
      { id: 'a', faction: 'atreides' },
      { id: 'f', faction: 'fremen' },
      { id: 'g', faction: 'guild' },
    ],
    before: { shipped: true, moved: 1, hajrUsed: true },
    signature: '["nexusGuildCunningReceipt",1,"[\\"nexusGuildCunning\\",3,\\"g\\"]","g",3,5,"cunning",[["a","atreides"],["f","fremen"],["g","guild"]],[true,1,true]]',
  };
  assert.equal(JSON.stringify(receipt), JSON.stringify(original));
  validateNexusGuildCunning(context, receipt);
  assert.equal(nexusGuildCunningMoves(receipt, true), 1);
  assert.equal(nexusGuildCunningMoves(receipt, true, 1), 0);
  assert.throws(() => nexusGuildCunningMoves(receipt, true, 2));
});

void test('a counted Guild Cunning receipt records all earned Hajr moves before its second shipment', () => {
  const before = Object.freeze({ shipped: true, moved: 3, hajrPlays: 2 });
  const receipt = createNexusGuildCunning(context, 'g', before);
  assert.equal(receipt.version, 2);
  assert.deepEqual(receipt.before, before);
  assert.notEqual(receipt.before, before);
  assert.deepEqual(Object.keys(receipt.before).sort(), ['hajrPlays', 'moved', 'shipped']);
  validateNexusGuildCunning(context, receipt);
  assert.equal(nexusGuildCunningMoves(receipt, 2), 0);
  assert.equal(nexusGuildCunningMoves(receipt, 3), 1,
    'Another actual play after the shipment earns one fresh move');
});

void test('Cunning forfeits an unused ordinary move while preserving every unspent counted Hajr move', () => {
  for (const [moved, remaining] of [[0, 2], [1, 2], [2, 1], [3, 0]]) {
    const receipt = counted(moved, 2);
    assert.equal(nexusGuildCunningMoves(receipt, 2), remaining);
    assert.equal(nexusGuildCunningMoves(receipt, 2, remaining), 0);
    assert.throws(() => nexusGuildCunningMoves(receipt, 2, remaining + 1));
  }
  for (const moved of [0, 1]) {
    const receipt = counted(moved, 0);
    assert.equal(nexusGuildCunningMoves(receipt, 0), 0,
      'The extra shipment supplies no ordinary movement, even after declining the first');
    assert.throws(() => nexusGuildCunningMoves(receipt, 0, 1));
  }
});

void test('actual Hajr replays after the second shipment add moves rather than renewing an already consumed grant', () => {
  const receipt = counted(1, 0);
  assert.equal(nexusGuildCunningMoves(receipt, 1), 1);
  assert.equal(nexusGuildCunningMoves(receipt, 1, 1), 0);
  assert.equal(nexusGuildCunningMoves(receipt, 2, 1), 1);
  assert.equal(nexusGuildCunningMoves(receipt, 2, 2), 0);
  assert.equal(nexusGuildCunningMoves(receipt, 3, 2), 1);
  assert.throws(() => nexusGuildCunningMoves(receipt, 2, 3));

  const legacy = createNexusGuildCunning(context, 'g', {
    shipped: true, moved: 2, hajrUsed: true,
  });
  assert.equal(nexusGuildCunningMoves(legacy, true), 0);
  assert.equal(nexusGuildCunningMoves(legacy, 2), 1,
    'An original v1 continuation may gain a genuinely new counted play');
  assert.equal(nexusGuildCunningMoves(legacy, 2, 1), 0);
});

void test('counted Cunning rejects lost grants and nonintegral or excessive consumed movement', () => {
  const receipt = counted(2, 2);
  for (const current of [false, true, 0, 1, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => nexusGuildCunningMoves(receipt, current));
  for (const moved of [-1, 0.5, NaN, Infinity, 2])
    assert.throws(() => nexusGuildCunningMoves(receipt, 2, moved));
  assert.equal(nexusGuildCunningMoves(receipt, 2, 1), 0);
  assert.equal(nexusGuildCunningMoves(counted(1, 1), true), 1,
    'Boolean callers still describe one actual play for a compatible counted receipt');
});

void test('counted Cunning binds its original count and cannot mix the two receipt formats', () => {
  const before = { shipped: true, moved: 1, hajrPlays: 2 };
  for (const bad of [
    { ...before, hajrPlays: -1 },
    { ...before, hajrPlays: 0.5 },
    { ...before, hajrPlays: NaN },
    { ...before, hajrPlays: Infinity },
    { ...before, hajrPlays: Number.MAX_SAFE_INTEGER },
    { ...before, moved: 4 },
    { ...before, hajrUsed: true },
  ]) assert.throws(() => createNexusGuildCunning(context, 'g', bad as NexusGuildCunningCountedBefore));
  const receipt = counted(1, 2);
  assert.throws(() => validateNexusGuildCunning(context, {
    ...receipt, before: { ...receipt.before, hajrPlays: 1 },
  }));
  assert.throws(() => validateNexusGuildCunning(context, {
    ...receipt, version: 1, before: { shipped: true, moved: 1, hajrUsed: true },
  }));
});
