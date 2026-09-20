import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSeatAiDelegateRequest,
  seatAiDelegateStorageKey,
  storeSeatAiDelegateRequest,
  validSeatAiDelegateRequest,
  type SeatAiDelegateRequest,
} from '../lib/seat-ai-delegation';

const ownerId = crypto.randomUUID(),
  delegateId = crypto.randomUUID(),
  grantId = crypto.randomUUID();
const request: SeatAiDelegateRequest = {
  type: 'setSeatAiDelegate',
  version: 12,
  grantId,
  delegateId,
  difficulty: 'Hard',
};
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

void test('AI permission retry preserves exact consent and original version across refresh; cannot replace an uncertain request', () => {
  const tab = storage(),
    key = seatAiDelegateStorageKey('ABCDEFGH', ownerId);
  storeSeatAiDelegateRequest(tab, key, request);
  const restored = parseSeatAiDelegateRequest(tab.getItem(key)!);
  assert.deepEqual(restored, request);
  assert.equal(Object.isFrozen(restored), true);
  storeSeatAiDelegateRequest(tab, key, restored);
  for (const replacement of [
    { ...request, version: 13 },
    { ...request, grantId: crypto.randomUUID() },
    { ...request, delegateId: ownerId },
  ])
    assert.throws(
      () => storeSeatAiDelegateRequest(tab, key, replacement),
      /Resolve the saved/,
    );
  assert.equal(
    tab.getItem(seatAiDelegateStorageKey('ABCDEFGH', delegateId)),
    null,
  );
  assert.equal(
    tab.getItem(seatAiDelegateStorageKey('BCDEFGHJ', ownerId)),
    null,
  );
  storeSeatAiDelegateRequest(tab, key, null);
  assert.equal(tab.getItem(key), null);
  storeSeatAiDelegateRequest(tab, key, {
    ...request,
    grantId: crypto.randomUUID(),
  });
});

void test('AI permission request validation rejects alternate profiles, target injection, credentials, malformed versions and stored extras', () => {
  const use: SeatAiDelegateRequest = {
    type: 'useSeatAiDelegate',
    version: 13,
    grantId,
    ownerId,
  };
  const revoke: SeatAiDelegateRequest = {
    type: 'revokeSeatAiDelegate',
    version: 13,
    grantId,
  };
  for (const good of [request, use, revoke])
    assert.equal(validSeatAiDelegateRequest(good), true);
  for (const bad of [
    { ...request, ownerId },
    { ...request, sessionToken: 'secret' },
    { ...request, difficulty: 'Impossible' },
    { ...request, version: -1 },
    { ...request, version: 2.5 },
    { ...request, version: '12' },
    { ...request, grantId: '' },
    { ...request, delegateId: 'another player' },
    { ...use, difficulty: 'Brutal' },
    { ...use, delegateId },
    { ...revoke, ownerId },
    { ...request, type: 'setAutopilot' },
    null,
    [],
  ]) {
    assert.equal(validSeatAiDelegateRequest(bad), false);
    assert.throws(() => parseSeatAiDelegateRequest(JSON.stringify(bad)));
  }
  assert.throws(() => parseSeatAiDelegateRequest(' '.repeat(2001)));
});

void test('AI permission storage must persist exactly before a request can be dispatched', () => {
  const key = seatAiDelegateStorageKey('ABCDEFGH', ownerId);
  assert.throws(
    () =>
      storeSeatAiDelegateRequest(
        { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        key,
        request,
      ),
    /could not be saved/,
  );
  assert.throws(
    () =>
      storeSeatAiDelegateRequest(
        {
          getItem: () => JSON.stringify(request),
          setItem: () => {},
          removeItem: () => {},
        },
        key,
        null,
      ),
    /could not be saved/,
  );
  assert.throws(
    () =>
      storeSeatAiDelegateRequest(
        {
          getItem: () => {
            throw new Error('blocked');
          },
          setItem: () => {},
          removeItem: () => {},
        },
        key,
        request,
      ),
    /blocked/,
  );
});
