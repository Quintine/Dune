import test from 'node:test';
import assert from 'node:assert/strict';
import { randomId } from '../lib/random-id';
import { createRoomEntry } from '../lib/room-entry';

void test('LAN HTTP operations work with getRandomValues and no randomUUID', (t) => {
  const native = globalThis.crypto;
  t.mock.getter(globalThis, 'crypto', () => ({
    getRandomValues: native.getRandomValues.bind(native),
  }) as Crypto);
  assert.equal(typeof globalThis.crypto.randomUUID, 'undefined');
  const id = randomId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(randomId(), id);
  const attempt = createRoomEntry({
    name: 'LAN player', faction: 'atreides', advanced: false, expansions: [],
  });
  assert.ok(attempt);
});

void test('UUID creation fails closed when cryptographic randomness fails', (t) => {
  t.mock.getter(globalThis, 'crypto', () => ({
    getRandomValues() { throw new Error('Randomness unavailable'); },
  }) as unknown as Crypto);
  assert.throws(() => randomId(), /Randomness unavailable/);
});
