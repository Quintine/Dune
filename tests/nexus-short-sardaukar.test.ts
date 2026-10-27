import test from 'node:test';
import assert from 'node:assert/strict';
import { createNexusSardaukar, validateNexusSardaukar } from '../game/nexus-sardaukar';

const context = { turn: 2, players: [
  { id: 'e', faction: 'emperor' as const }, { id: 'a', faction: 'atreides' as const },
] };

void test('positive short Cunning groups use every available counter and explicitly record their provisional source', () => {
  for (const normal of [1, 2, 3, 4]) {
    const receipt = createNexusSardaukar(context, 'e', 'battle', 'arrakeen', normal);
    assert.equal(receipt.count, normal);
    assert.equal(receipt.shortGroup, true);
    validateNexusSardaukar(context, receipt);
    assert.throws(() => validateNexusSardaukar(context, { ...receipt, shortGroup: undefined }));
    assert.throws(() => validateNexusSardaukar(context, { ...receipt, count: normal - 1 }));
  }
  for (const normal of [0, -1, 21, 1.5, NaN])
    assert.throws(() => createNexusSardaukar(context, 'e', 'battle', 'arrakeen', normal));
});

void test('Cunning retains the original five-role shape and signature when the full group exists', () => {
  for (const normal of [5, 7, 20]) {
    const receipt = createNexusSardaukar(context, 'e', 'battle', 'arrakeen', normal);
    assert.equal(receipt.count, 5);
    assert.equal(Object.hasOwn(receipt, 'shortGroup'), false);
    assert.equal(receipt.signature, JSON.stringify([
      1, receipt.event, 'e', 2, 'battle', 'arrakeen', normal, 0, 5,
      [['a', 'atreides'], ['e', 'emperor']],
    ]));
    assert.throws(() => validateNexusSardaukar(context, { ...receipt, shortGroup: true }));
  }
});
