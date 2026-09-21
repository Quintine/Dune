import test from 'node:test';
import assert from 'node:assert/strict';
import { integerInputValue } from '../lib/integer-input';

void test('clearing a numeric draft stays invalid until a replacement is entered', () => {
  for (const replacement of ['2', '5', '9', '20']) {
    assert.equal(integerInputValue('1'), 1);
    assert.ok(Number.isNaN(integerInputValue('')));
    assert.equal(integerInputValue(replacement), Number(replacement));
  }
});

void test('explicit zero remains distinct from an empty or non-integer bid', () => {
  assert.equal(integerInputValue('0'), 0);
  assert.equal(integerInputValue('02'), 2);
  for (const draft of ['', ' ', '-', '1.5', 'Infinity', '9007199254740992']) {
    assert.ok(Number.isNaN(integerInputValue(draft)), draft);
  }
});
