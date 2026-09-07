import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_ENTRY_STORAGE_KEY,
  clearRoomEntry,
  createRoomEntry,
  parseRoomEntry,
  roomEntryConfirmed,
  roomEntryRejectedBeforeCommit,
  roomEntryUrl,
  saveRoomEntry,
} from '../lib/room-entry';
import {
  ClientRequestError,
  requestJson,
  requestMayHaveCompleted,
} from '../lib/client-request';

const fields = {
  name: '  Jessica  ',
  faction: 'atreides',
  expansions: ['ecaz', 'ix'],
  advanced: false,
};
const playerId = '93c66e7c-2d3b-4845-aedf-5d1f06cf3371';
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};
const view = {
  code: 'ABCD2345',
  me: playerId,
  players: [{ id: playerId }],
  version: 1,
};

void test('each new explicit attempt has secure credentials; hydration preserves exact raw fields and body bytes', () => {
  const first = createRoomEntry(fields);
  const originalBody = first.bodyText;
  const body = JSON.parse(originalBody);
  assert.equal(body.name, fields.name);
  assert.deepEqual(body.expansions, ['ecaz', 'ix']);
  assert.match(body.entry.sessionToken, /^[0-9a-f]{64}$/);
  assert.match(
    body.entry.operationId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const storage = memoryStorage();
  saveRoomEntry(storage, first);
  const restored = parseRoomEntry(storage.getItem(ROOM_ENTRY_STORAGE_KEY)!);
  assert.equal(restored.bodyText, originalBody);
  assert.equal(roomEntryUrl(restored), '/api/rooms');
  assert.ok(Object.isFrozen(restored));
  assert.throws(() => Object.assign(restored, { bodyText: '{}' }), TypeError);
  const second = JSON.parse(createRoomEntry(fields).bodyText);
  assert.notEqual(body.entry.operationId, second.entry.operationId);
  assert.notEqual(body.entry.sessionToken, second.entry.sessionToken);
});

void test('join endpoint is derived only from a validated room, and join preserves its exact small payload', () => {
  const attempt = createRoomEntry(fields, 'ABCD2345');
  assert.equal(roomEntryUrl(attempt), '/api/rooms/ABCD2345');
  assert.deepEqual(Object.keys(JSON.parse(attempt.bodyText)).sort(), [
    'entry',
    'faction',
    'name',
    'type',
  ]);
  for (const code of [
    '../rooms',
    'abcd2345',
    'ABCD2340',
    'https://elsewhere.test',
  ])
    assert.throws(() => createRoomEntry(fields, code));
});

void test('stored records reject unsupported schemas, malformed proofs, unexpected body fields and altered endpoints without exposing secrets', () => {
  const attempt = createRoomEntry(fields);
  const body = JSON.parse(attempt.bodyText);
  const corruptBodies = [
    { ...body, entry: { ...body.entry, sessionToken: 'private-secret' } },
    { ...body, entry: { ...body.entry, operationId: '../request' } },
    { ...body, entry: { ...body.entry, extra: true } },
    { ...body, faction: 'invented' },
    { ...body, name: ' ' },
    { ...body, name: 'x'.repeat(33) },
    { ...body, advanced: 'false' },
    { ...body, expansions: ['unsupported'] },
    { ...body, action: { type: 'advanceBots' } },
  ];
  const bad = [
    '',
    '{',
    'null',
    '[]',
    'x'.repeat(8193),
    JSON.stringify({ ...attempt, schemaVersion: 2 }),
    JSON.stringify({ ...attempt, roomCode: 'ABCD2345' }),
    JSON.stringify({ ...attempt, createdAt: -1 }),
    JSON.stringify({ ...attempt, url: 'https://elsewhere.test' }),
    JSON.stringify({
      ...attempt,
      bodyText: '{"name":"duplicate",' + attempt.bodyText.slice(1),
    }),
    ...corruptBodies.map((changed) =>
      JSON.stringify({ ...attempt, bodyText: JSON.stringify(changed) }),
    ),
  ];
  for (const text of bad)
    assert.throws(
      () => parseRoomEntry(text),
      (error: unknown) =>
        error instanceof Error && !error.message.includes('private-secret'),
    );
});

void test('old records do not expire or lose their proof; parsing is read-only even on a future schema', () => {
  const storage = memoryStorage();
  const old = parseRoomEntry(
    JSON.stringify({ ...createRoomEntry(fields), createdAt: 0 }),
  );
  saveRoomEntry(storage, old);
  assert.equal(
    parseRoomEntry(storage.getItem(ROOM_ENTRY_STORAGE_KEY)!).createdAt,
    0,
  );
  const future = JSON.stringify({ ...old, schemaVersion: 99 });
  storage.setItem(ROOM_ENTRY_STORAGE_KEY, future);
  assert.throws(() => parseRoomEntry(storage.getItem(ROOM_ENTRY_STORAGE_KEY)!));
  assert.equal(storage.getItem(ROOM_ENTRY_STORAGE_KEY), future);
});

void test('only the matching receipt, room and seated player confirm a saved request; a cookie GET never does', () => {
  const attempt = createRoomEntry(fields, 'ABCD2345');
  const { operationId } = JSON.parse(attempt.bodyText).entry;
  const response = { ...view, entryReceipt: { operationId, replayed: true } };
  assert.equal(roomEntryConfirmed(attempt, response), true);
  assert.equal(roomEntryConfirmed(attempt, view), false);
  assert.equal(
    roomEntryConfirmed(attempt, { ...response, code: 'EFGH6789' }),
    false,
  );
  assert.equal(
    roomEntryConfirmed(attempt, { ...response, me: 'not-a-seat' }),
    false,
  );
  assert.equal(
    roomEntryConfirmed(attempt, { ...response, players: [] }),
    false,
  );
  assert.equal(
    roomEntryConfirmed(attempt, {
      ...response,
      entryReceipt: { operationId: crypto.randomUUID(), replayed: true },
    }),
    false,
  );
  assert.equal(
    roomEntryConfirmed(attempt, { ...view, alreadySeated: true }),
    false,
  );
  assert.equal(
    roomEntryConfirmed(attempt, { ...view, alreadySeated: true }, true),
    true,
  );
  assert.equal(
    roomEntryConfirmed(
      createRoomEntry(fields),
      { ...view, alreadySeated: true },
      true,
    ),
    false,
  );
});

void test('storage denial or a failed write is detected before a caller can dispatch; clearing removes only the scoped proof', () => {
  const attempt = createRoomEntry(fields);
  assert.throws(() =>
    saveRoomEntry(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('denied');
        },
      },
      attempt,
    ),
  );
  assert.throws(() =>
    saveRoomEntry({ getItem: () => null, setItem: () => {} }, attempt),
  );
  const storage = memoryStorage();
  storage.setItem('other-setting', 'keep');
  saveRoomEntry(storage, attempt);
  clearRoomEntry(storage);
  assert.equal(storage.getItem(ROOM_ENTRY_STORAGE_KEY), null);
  assert.equal(storage.getItem('other-setting'), 'keep');
  assert.throws(() =>
    clearRoomEntry({ getItem: () => 'still-present', removeItem: () => {} }),
  );
});

void test('a gateway failure and page refresh retain the exact request for explicit replay; a matching receipt permits cleanup', async () => {
  const storage = memoryStorage();
  const attempt = createRoomEntry(fields, 'ABCD2345');
  saveRoomEntry(storage, attempt);
  const sent: string[] = [];
  const failedFetch: typeof fetch = async (_url, init) => {
    sent.push(init?.body as string);
    return new Response(JSON.stringify({ error: 'Gateway unavailable' }), {
      status: 503,
    });
  };
  await assert.rejects(
    requestJson(
      roomEntryUrl(attempt),
      { method: 'POST', body: attempt.bodyText },
      { fetcher: failedFetch },
    ),
    (error) => requestMayHaveCompleted(error),
  );
  assert.equal(sent.length, 1, 'there is no automatic retry');
  const restored = parseRoomEntry(storage.getItem(ROOM_ENTRY_STORAGE_KEY)!);
  const { operationId } = JSON.parse(restored.bodyText).entry;
  const recovered = await requestJson(
    roomEntryUrl(restored),
    { method: 'POST', body: restored.bodyText },
    {
      fetcher: async (_url, init) => {
        sent.push(init?.body as string);
        return new Response(
          JSON.stringify({
            ...view,
            entryReceipt: { operationId, replayed: true },
          }),
        );
      },
    },
  );
  assert.deepEqual(sent, [attempt.bodyText, attempt.bodyText]);
  assert.equal(roomEntryConfirmed(restored, recovered), true);
  clearRoomEntry(storage);
  assert.equal(storage.getItem(ROOM_ENTRY_STORAGE_KEY), null);
});

void test('storage read/write/readback/remove exceptions are surfaced, and an existing proof is never overwritten', () => {
  const attempt = createRoomEntry(fields);
  assert.throws(() =>
    saveRoomEntry(
      {
        getItem: () => {
          throw new Error('read denied');
        },
        setItem: () =>
          assert.fail('must not write after a failed initial read'),
      },
      attempt,
    ),
  );
  let reads = 0;
  assert.throws(() =>
    saveRoomEntry(
      {
        getItem: () => {
          if (++reads === 1) return null;
          throw new Error('readback denied');
        },
        setItem: () => {},
      },
      attempt,
    ),
  );
  assert.throws(() =>
    clearRoomEntry({
      getItem: () => null,
      removeItem: () => {
        throw new Error('remove denied');
      },
    }),
  );
  assert.throws(() =>
    clearRoomEntry({
      getItem: () => {
        throw new Error('readback denied');
      },
      removeItem: () => {},
    }),
  );
  const storage = memoryStorage();
  saveRoomEntry(storage, attempt);
  assert.throws(() => saveRoomEntry(storage, createRoomEntry(fields)));
  assert.equal(
    storage.getItem(ROOM_ENTRY_STORAGE_KEY),
    JSON.stringify(attempt),
  );
  saveRoomEntry(storage, attempt);
  assert.equal(
    storage.getItem(ROOM_ENTRY_STORAGE_KEY),
    JSON.stringify(attempt),
  );
});

void test('a body timeout retains the pending proof; a malformed receipt cannot fall back to alreadySeated', async () => {
  const attempt = createRoomEntry(fields, 'ABCD2345');
  const storage = memoryStorage();
  saveRoomEntry(storage, attempt);
  let aborted = false;
  await assert.rejects(
    requestJson(
      roomEntryUrl(attempt),
      { method: 'POST', body: attempt.bodyText },
      {
        timeoutMs: 5,
        fetcher: async (_url, init) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
          });
          return {
            ok: true,
            status: 200,
            json: () => new Promise(() => {}),
          } as Response;
        },
      },
    ),
    (error) => requestMayHaveCompleted(error),
  );
  assert.equal(aborted, true);
  assert.equal(
    parseRoomEntry(storage.getItem(ROOM_ENTRY_STORAGE_KEY)!).bodyText,
    attempt.bodyText,
  );
  for (const entryReceipt of [
    null,
    [],
    { replayed: true },
    {
      operationId: JSON.parse(attempt.bodyText).entry.operationId,
      replayed: 'yes',
    },
  ]) {
    assert.equal(
      roomEntryConfirmed(
        attempt,
        { ...view, alreadySeated: true, entryReceipt },
        true,
      ),
      false,
    );
    assert.notEqual(storage.getItem(ROOM_ENTRY_STORAGE_KEY), null);
  }
});

void test('only a first definitive HTTP rejection allows correcting entry details; uncertain or retried outcomes retain their proof', () => {
  for (const status of [400, 401, 403, 404, 409, 413, 429]) {
    const error = new ClientRequestError('Rejected', 'http', status);
    assert.equal(roomEntryRejectedBeforeCommit(true, error), true);
    assert.equal(roomEntryRejectedBeforeCommit(false, error), false);
  }
  for (const error of [
    new ClientRequestError('Timeout', 'timeout'),
    new ClientRequestError('Aborted', 'aborted'),
    new ClientRequestError('Network', 'network'),
    new ClientRequestError('Invalid response', 'invalid-response'),
    new ClientRequestError('HTTP timeout', 'http', 408),
    new ClientRequestError('Server', 'http', 500),
    new ClientRequestError('Gateway', 'http', 502),
    new ClientRequestError('Unavailable', 'http', 503),
    new ClientRequestError('Gateway timeout', 'http', 504),
    new Error('Unclassified'),
  ])
    assert.equal(roomEntryRejectedBeforeCommit(true, error), false);
});
