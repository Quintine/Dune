import assert from 'node:assert/strict';
import test from 'node:test';
import { sandmasterVictoryPiles, sandmasterVictorySpice } from '../game/leader-skill-battle-board';

void test('Sandmaster offers exactly +3 on each existing positive battle-territory pile without mutation', () => {
  const spice = Object.freeze({ 'wind_pass:14': 2, 'wind_pass:15': 9, 'wind_pass:16': 0, 'red_chasm:7': 4 });
  const offers = sandmasterVictoryPiles('wind_pass', spice);
  assert.deepEqual(offers, [
    { key: 'wind_pass:14', before: 2, after: 5 },
    { key: 'wind_pass:15', before: 9, after: 12 },
  ]);
  assert.throws(() => sandmasterVictorySpice('wind_pass', spice), /requires selection/);
  for (const offered of offers) {
    const selected = sandmasterVictorySpice('wind_pass', spice, offered.key);
    assert.ok(selected);
    assert.deepEqual(selected, offered);
  }
  assert.deepEqual(spice, { 'wind_pass:14': 2, 'wind_pass:15': 9, 'wind_pass:16': 0, 'red_chasm:7': 4 });
});

void test('Sandmaster has no addition for empty or exhausted piles and resolves a singleton automatically', () => {
  const noPileSpice: Array<Record<string, number>> = [{}, { 'wind_pass:14': 0 }, { 'red_chasm:7': 8 }];
  for (const spice of noPileSpice) {
    assert.deepEqual(sandmasterVictoryPiles('wind_pass', spice), []);
    assert.equal(sandmasterVictorySpice('wind_pass', spice), null);
    assert.throws(() => sandmasterVictorySpice('wind_pass', spice, 'wind_pass:14'), /offered existing/);
  }
  const spice = { 'wind_pass:14': 0, 'wind_pass:15': 1, 'red_chasm:7': 8 };
  const expected = { key: 'wind_pass:15', before: 1, after: 4 };
  assert.deepEqual(sandmasterVictorySpice('wind_pass', spice), expected);
  assert.deepEqual(sandmasterVictorySpice('wind_pass', spice, expected.key), expected);
  assert.throws(() => sandmasterVictorySpice('wind_pass', spice, 'wind_pass:14'), /offered existing/);
  assert.throws(() => sandmasterVictorySpice('wind_pass', spice, 'red_chasm:7'), /offered existing/);
});

void test('Sandmaster rejects invalid quantities, malformed sectors and unknown territories rather than creating piles', () => {
  for (const before of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1,
    Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER]) {
    const spice = { 'wind_pass:14': before, 'wind_pass:15': 2 };
    const snapshot = { ...spice };
    assert.throws(() => sandmasterVictoryPiles('wind_pass', spice), /valid existing spice pile/);
    assert.throws(() => sandmasterVictorySpice('wind_pass', spice, 'wind_pass:15'), /valid existing spice pile/);
    assert.deepEqual(spice, snapshot);
  }
  for (const key of ['wind_pass', 'wind_pass:', 'wind_pass:1', 'wind_pass:14:extra', 'wind_pass:014',
    'wind_pass:14.0', 'wind_pass:NaN', 'wind_pass:Infinity']) {
    for (const amount of [0, 1]) {
      assert.throws(() => sandmasterVictoryPiles('wind_pass', { [key]: amount }), /valid existing spice pile/);
    }
  }
  assert.throws(() => sandmasterVictorySpice('not_a_territory', { 'not_a_territory:14': 2 }));
});

void test('Sandmaster accepts the largest safe +3 result and rejects every unoffered exact key', () => {
  const spice = { 'wind_pass:14': Number.MAX_SAFE_INTEGER - 3, 'wind_pass:15': 2, 'red_chasm:7': 3 };
  assert.deepEqual(sandmasterVictorySpice('wind_pass', spice, 'wind_pass:14'), {
    key: 'wind_pass:14', before: Number.MAX_SAFE_INTEGER - 3, after: Number.MAX_SAFE_INTEGER,
  });
  for (const key of ['', 'wind_pass:16', 'wind_pass:014', 'wind_pass:14:extra', 'wind_pass:1', 'red_chasm:7']) {
    assert.throws(() => sandmasterVictorySpice('wind_pass', spice, key), /offered existing/);
  }
});
