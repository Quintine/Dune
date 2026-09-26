// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';

void test('admin HTTP denies anonymous, forged admin, room-host and spoofed identity-header access', async () => {
  const created = await fetch(base + '/api/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin: base },
    body: JSON.stringify({ name: 'Admin boundary QA', faction: 'atreides', advanced: false, expansions: [] }),
  });
  assert.equal(created.status, 201);
  const cookie = created.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const room = (await created.json() as { code: string }).code;
  for (const headers of [{}, { cookie }, { cookie: 'dune_admin_session=' + 'a'.repeat(64) }, { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.test' }] as Record<string, string>[]) {
    for (const path of ['/api/admin/session', '/api/admin/rooms', `/api/admin/rooms/${room}/control`, `/api/admin/rooms/${room}/lobby`, `/api/admin/rooms/${room}/removal`, `/api/admin/rooms/${room}/closure`, `/api/admin/rooms/${room}/archive`, `/api/admin/rooms/${room}/seat-ai`, `/api/admin/rooms/${room}/discussion`]) {
      const result = await fetch(base + path, { headers, signal: AbortSignal.timeout(15000) });
      assert.equal(result.status, 401, path);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Object.keys(await result.json()), ['error']);
    }
    const write = await fetch(`${base}/api/admin/rooms/${room}/control`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedRevision: 0, paused: true, joinLocked: true, reason: 'Denied QA request' }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(write.status, 401);
    assert.deepEqual(Object.keys(await write.json()), ['error']);
    const lobby = await fetch(`${base}/api/admin/rooms/${room}/lobby`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, action: { type: 'rules', advanced: true }, reason: 'Denied lobby QA' }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(lobby.status, 401);
    assert.equal(lobby.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await lobby.json()), ['error']);
    const removal = await fetch(`${base}/api/admin/rooms/${room}/removal`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, expectedRevision: 0, removed: true, reason: 'Denied removal QA' }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(removal.status, 401);
    assert.equal(removal.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await removal.json()), ['error']);
    const closure = await fetch(`${base}/api/admin/rooms/${room}/closure`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, expectedRevision: 0, closed: true, reason: 'Denied closure QA' }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(closure.status, 401);
    assert.equal(closure.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await closure.json()), ['error']);
    const archive = await fetch(`${base}/api/admin/rooms/${room}/archive`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, expectedRevision: 0, archived: true, reason: 'Denied archive QA' }),
    });
    assert.equal(archive.status, 401);
    assert.equal(archive.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await archive.json()), ['error']);
    const participant = await fetch(`${base}/api/admin/rooms/${room}/seat-ai`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, expectedControlRevision: 0, target: 'owner', difficulty: 'Easy', reason: 'Denied participant QA' }),
    });
    assert.equal(participant.status, 401);
    assert.equal(participant.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await participant.json()), ['error']);
    const discussion = await fetch(`${base}/api/admin/rooms/${room}/discussion`, {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: 0, expectedRevision: 0, target: 'owner', muted: true, reason: 'Denied moderation QA' }),
    });
    assert.equal(discussion.status, 401);
    assert.equal(discussion.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await discussion.json()), ['error']);
    const create = await fetch(base + '/api/admin/rooms', {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId: crypto.randomUUID(), sessionToken: 'b'.repeat(64), name: 'Denied creation QA', faction: 'atreides', advanced: false, techTokens: false, strongholdCards: false, bots: [], reason: 'Must not create a room' }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(create.status, 401);
    assert.equal(create.headers.get('set-cookie'), null);
    assert.deepEqual(Object.keys(await create.json()), ['error']);
  }
});
void test('admin HTTP rejects login CSRF, oversized bodies and invalid credentials without setting sessions', async () => {
  for (const [origin, body, expected] of [
    ['', '{}', 403], ['https://foreign.invalid', '{}', 403],
    [base, ' '.repeat(2049), 413], [base, JSON.stringify({ action: 'login', key: 'invalid' }), 401],
  ] as const) {
    const result = await fetch(base + '/api/admin/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body,
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(result.status, expected);
    assert.equal(result.headers.get('set-cookie'), null);
    if (expected !== 403) assert.equal(result.headers.get('cache-control'), 'no-store');
    await result.text();
  }
});
