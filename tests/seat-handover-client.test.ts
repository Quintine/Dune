import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOVER_CLAIM_STORAGE_KEY,
  clearHandoverClaim,
  clearHandoverOwner,
  createHandoverClaim,
  createHandoverKit,
  handoverClaimConfirmed,
  handoverOwnerStorageKey,
  parseHandoverClaim,
  parseHandoverKit,
  saveHandoverClaim,
  serializeHandoverKit,
} from '../lib/seat-handover';
const player = '93c66e7c-2d3b-4845-aedf-5d1f06cf3371';
const kit = () => createHandoverKit('ABCD2345', player);
const storage = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
};
void test('confirmed recovery removes only the invalidated owner offer and verifies cleanup before restoring the UI', () => {
  const saved = storage(),
    key = handoverOwnerStorageKey('ABCD2345', player);
  const other = handoverOwnerStorageKey('BCDE2345', player);
  saved.setItem(key, 'old private offer');
  saved.setItem(other, 'another room offer');
  saved.setItem(HANDOVER_CLAIM_STORAGE_KEY, 'unrelated pending claim');
  clearHandoverOwner(saved, 'ABCD2345', player);
  assert.equal(saved.getItem(key), null);
  assert.equal(saved.getItem(other), 'another room offer');
  assert.equal(
    saved.getItem(HANDOVER_CLAIM_STORAGE_KEY),
    'unrelated pending claim',
  );
  assert.throws(() =>
    clearHandoverOwner(
      { getItem: () => 'old private offer', removeItem() {} },
      'ABCD2345',
      player,
    ),
  );
});
void test('handover kits have fresh secure one-time offer identities and strict round-trip format', () => {
  const a = kit(),
    b = kit();
  assert.deepEqual(parseHandoverKit(serializeHandoverKit(a)), a);
  assert.notEqual(a.offerId, b.offerId);
  assert.notEqual(a.handoverSecret, b.handoverSecret);
  assert.match(a.handoverSecret, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(a));
});
void test('kits reject substituted recovery formats, secret-bearing URLs and injected fields without echoing inputs', () => {
  const a = kit();
  for (const text of [
    'null',
    '[]',
    '{',
    'x'.repeat(4097),
    ...[
      { ...a, format: 'dune-seat-recovery' },
      { ...a, roomCode: 'https://evil.test' },
      { ...a, playerId: 'host' },
      { ...a, handoverSecret: 'secret-to-not-echo' },
      { ...a, newSessionToken: 'ff'.repeat(32) },
      { ...a, version: 2 },
    ].map((value) => JSON.stringify(value)),
  ]) {
    assert.throws(
      () => parseHandoverKit(text),
      (error) =>
        error instanceof Error && !error.message.includes('secret-to-not-echo'),
    );
  }
});
void test('refresh restores exactly the same claim proof and prevents a second claim from replacing it', () => {
  const a = createHandoverClaim(kit()),
    saved = storage();
  saveHandoverClaim(saved, a);
  const restored = parseHandoverClaim(
    saved.getItem(HANDOVER_CLAIM_STORAGE_KEY)!,
  );
  assert.deepEqual(restored, a);
  assert.equal(JSON.stringify(restored.attempt), JSON.stringify(a.attempt));
  assert.ok(Object.isFrozen(restored.attempt));
  assert.notEqual(a.attempt.newSessionToken, a.kit.handoverSecret);
  saveHandoverClaim(saved, restored);
  assert.throws(() => saveHandoverClaim(saved, createHandoverClaim(a.kit)));
  assert.deepEqual(
    parseHandoverClaim(saved.getItem(HANDOVER_CLAIM_STORAGE_KEY)!),
    a,
  );
  clearHandoverClaim(saved);
  assert.equal(saved.getItem(HANDOVER_CLAIM_STORAGE_KEY), null);
});
void test('saved claim validation rejects altered bindings, reused secrets and unexpected authority fields', () => {
  const a = createHandoverClaim(kit());
  for (const value of [
    { ...a, extra: true },
    { ...a, attempt: { ...a.attempt, playerId: crypto.randomUUID() } },
    { ...a, attempt: { ...a.attempt, offerId: crypto.randomUUID() } },
    { ...a, attempt: { ...a.attempt, newSessionToken: a.kit.handoverSecret } },
    { ...a, attempt: { ...a.attempt, operationId: 'again' } },
    { ...a, attempt: { ...a.attempt, host: true } },
  ])
    assert.throws(() => parseHandoverClaim(JSON.stringify(value)));
});
void test('unavailable or silently dropping browser storage cannot confirm saved or removed retry proof', () => {
  const a = createHandoverClaim(kit());
  assert.throws(() =>
    saveHandoverClaim({ getItem: () => null, setItem() {} }, a),
  );
  assert.throws(() =>
    saveHandoverClaim(
      {
        getItem: () => null,
        setItem() {
          throw new Error('blocked');
        },
      },
      a,
    ),
  );
  assert.throws(() =>
    clearHandoverClaim({ getItem: () => JSON.stringify(a), removeItem() {} }),
  );
});
void test('a claimed seat is confirmed only after receipt and cookie-authorized read both identify the intended seat', () => {
  const a = createHandoverClaim(kit());
  const view = {
    code: a.kit.roomCode,
    me: player,
    version: 4,
    players: [{ id: player }],
  };
  const response = { view, transferred: true, replayed: false };
  assert.ok(handoverClaimConfirmed(a, response, view));
  assert.ok(
    handoverClaimConfirmed(
      a,
      { ...response, replayed: true },
      { ...view, version: 9 },
    ),
  );
  assert.equal(handoverClaimConfirmed(a, { view }, view), false);
  assert.equal(
    handoverClaimConfirmed(a, response, { ...view, me: crypto.randomUUID() }),
    false,
  );
  assert.equal(
    handoverClaimConfirmed(
      a,
      { ...response, view: { ...view, code: 'BCDE2345' } },
      view,
    ),
    false,
  );
  assert.equal(
    handoverClaimConfirmed(a, response, { ...view, players: [] }),
    false,
  );
  assert.equal(
    handoverClaimConfirmed(a, response, { ...view, version: 3 }),
    false,
  );
});
