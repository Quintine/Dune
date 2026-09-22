import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientRequestError,
  requestJson,
  requestMayHaveCompleted,
  isRoomRemoved,
  subscribeRoomRemoval,
} from '../lib/client-request';

const never = () => new Promise<never>(() => {});
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

void test('typed removal retains post-commit proofs and notifies only the affected public room', async () => {
  const rooms: string[] = [];
  const stop = subscribeRoomRemoval(room => rooms.push(room));
  const fetcher: typeof fetch = async () => Response.json({ code: 'ROOM_REMOVED', error: 'Room removed', private: 'NOT_FOR_LISTENERS' }, { status: 410 });
  try {
    for (const path of ['/api/rooms/TEST2345', '/api/rooms/TEST2345/control', '/api/rooms/TEST2345/messages', '/api/rooms'])
      await assert.rejects(requestJson(path, { method: 'POST' }, { fetcher }), error => isRoomRemoved(error) && error.status === 410 && requestMayHaveCompleted(error));
    assert.deepEqual(rooms, ['TEST2345', 'TEST2345', 'TEST2345']);
  } finally { stop(); }
  await assert.rejects(requestJson('/api/rooms/TEST2345', {}, { fetcher }));
  assert.equal(rooms.length, 3, 'Unmounted controllers no longer receive removal events');
  assert.equal(requestMayHaveCompleted(new ClientRequestError('Ordinary rejection', 'http', 410)), false);
});

void test('removal observers cannot swallow the typed error or trigger automatic request retries', async () => {
  let calls = 0;
  const stop = subscribeRoomRemoval(() => { throw new Error('Controller failed'); });
  try {
    await assert.rejects(requestJson('/api/rooms/TEST2345', {}, { fetcher: async () => {
      calls++; return Response.json({ code: 'ROOM_REMOVED', error: 'Removed' }, { status: 410 });
    } }), isRoomRemoved);
    assert.equal(calls, 1);
  } finally { stop(); }
});

void test('successful JSON preserves mutation body, version and credential options, with one fetch', async () => {
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const body = JSON.stringify({ version: 12, action: { type: 'ready' } });
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, '/api/rooms/TEST2345');
    assert.equal(init?.body, body);
    assert.equal(init?.credentials, 'same-origin');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, { 'Content-Type': 'application/json' });
    signal = init?.signal;
    return Response.json({ version: 13, me: 'private-seat' });
  };
  assert.deepEqual(
    await requestJson(
      '/api/rooms/TEST2345',
      {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      },
      { fetcher, timeoutMs: 20 },
    ),
    { version: 13, me: 'private-seat' },
  );
  await pause(30);
  assert.equal(calls, 1);
  assert.equal(
    signal?.aborted,
    false,
    'completed requests have no lingering timeout',
  );
});

void test('a stalled fetch aborts by the deadline even if transport ignores the signal, without replaying POST', async () => {
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const fetcher: typeof fetch = async (_, init) => {
    calls++;
    signal = init?.signal;
    return never();
  };
  await assert.rejects(
    requestJson(
      '/api/rooms/TEST2345',
      { method: 'POST' },
      { fetcher, timeoutMs: 10 },
    ),
    (error: unknown) =>
      error instanceof ClientRequestError && error.kind === 'timeout',
  );
  assert.equal(signal?.aborted, true);
  await pause(20);
  assert.equal(calls, 1);
});

void test('the request deadline includes a stalled JSON response body', async () => {
  let signal: AbortSignal | null | undefined;
  let bodyStarted = false;
  const fetcher: typeof fetch = async (_, init) => {
    signal = init?.signal;
    return {
      ok: true,
      status: 200,
      json: () => {
        bodyStarted = true;
        return never();
      },
    } as unknown as Response;
  };
  await assert.rejects(
    requestJson('/api/rooms/TEST2345', {}, { fetcher, timeoutMs: 10 }),
    (error: unknown) =>
      error instanceof ClientRequestError && error.kind === 'timeout',
  );
  assert.equal(bodyStarted, true);
  assert.equal(signal?.aborted, true);
});

void test('409 rejection retains the server message and HTTP status for reconciliation', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      { error: 'The table changed. Refresh before trying again.' },
      { status: 409 },
    );
  await assert.rejects(
    requestJson('/api/rooms/TEST2345', {}, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError &&
      error.kind === 'http' &&
      error.status === 409 &&
      error.message === 'The table changed. Refresh before trying again.',
  );
});

void test('non-JSON HTTP failures retain status without exposing returned HTML', async () => {
  const fetcher: typeof fetch = async () =>
    new Response('<html>internal server detail</html>', { status: 502 });
  await assert.rejects(
    requestJson('/api/rooms/TEST2345', {}, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError &&
      error.kind === 'http' &&
      error.status === 502 &&
      error.message === 'Request failed (502).',
  );
});

void test('invalid JSON in a successful response remains an uncertain-response error', async () => {
  const fetcher: typeof fetch = async () => new Response('truncated');
  await assert.rejects(
    requestJson('/api/rooms/TEST2345', {}, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError &&
      error.kind === 'invalid-response' &&
      error.status === 200,
  );
});

void test('network rejection is readable and never automatically retried', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw new TypeError('private transport details');
  };
  await assert.rejects(
    requestJson('/api/rooms', { method: 'POST' }, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError &&
      error.kind === 'network' &&
      !error.message.includes('private transport'),
  );
  assert.equal(calls, 1);
});

void test('caller cancellation aborts an in-progress body without waiting for the deadline', async () => {
  const caller = new AbortController();
  let transportSignal: AbortSignal | null | undefined;
  const fetcher: typeof fetch = async (_, init) => {
    transportSignal = init?.signal;
    return {
      ok: true,
      status: 200,
      json: () => never(),
    } as unknown as Response;
  };
  const request = requestJson(
    '/api/rooms/TEST2345',
    { signal: caller.signal },
    { fetcher },
  );
  caller.abort();
  await assert.rejects(
    request,
    (error: unknown) =>
      error instanceof ClientRequestError && error.kind === 'aborted',
  );
  assert.equal(transportSignal?.aborted, true);
});

void test('a request canceled before dispatch performs no fetch', async () => {
  const caller = new AbortController();
  caller.abort();
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({});
  };
  await assert.rejects(
    requestJson('/api/rooms', { signal: caller.signal }, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError && error.kind === 'aborted',
  );
  assert.equal(calls, 0);
});

void test('non-finite or non-positive deadlines are rejected before dispatch', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return Response.json({});
  };
  for (const timeoutMs of [0, -1, Infinity, NaN])
    await assert.rejects(
      requestJson('/api/rooms', {}, { fetcher, timeoutMs }),
      RangeError,
    );
  assert.equal(calls, 0);
});

void test('gateway and request-timeout HTTP errors remain uncertain mutation outcomes', () => {
  for (const status of [408, 500, 502, 503, 504])
    assert.equal(
      requestMayHaveCompleted(
        new ClientRequestError('Server error', 'http', status),
      ),
      true,
      String(status),
    );
  for (const status of [400, 401, 403, 404, 409, 413, 422, 429])
    assert.equal(
      requestMayHaveCompleted(
        new ClientRequestError('Request rejected', 'http', status),
      ),
      false,
      String(status),
    );
  for (const kind of [
    'timeout',
    'network',
    'invalid-response',
    'aborted',
  ] as const)
    assert.equal(
      requestMayHaveCompleted(new ClientRequestError('Unconfirmed', kind)),
      true,
      kind,
    );
  assert.equal(requestMayHaveCompleted(new Error('Unknown error')), true);
});

void test('a failed gateway response keeps its status and requires reconciliation without replay', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return new Response('Gateway timeout after the origin may have committed', {
      status: 504,
    });
  };
  await assert.rejects(
    requestJson('/api/rooms/TEST2345', { method: 'POST' }, { fetcher }),
    (error: unknown) =>
      error instanceof ClientRequestError &&
      error.status === 504 &&
      requestMayHaveCompleted(error),
  );
  assert.equal(calls, 1);
});

void test('a typed closure rejection retains possibly completed request proof without treating it as removal', async () => {
  const { isRoomClosed, isRoomRemoved, requestMayHaveCompleted } = await import('../lib/client-request');
  const error = new ClientRequestError('Room closed', 'http', 409, 'ROOM_CLOSED');
  assert.equal(isRoomClosed(error), true); assert.equal(isRoomRemoved(error), false);
  assert.equal(requestMayHaveCompleted(error), true);
});
