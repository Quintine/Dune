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
    for (const path of ['/api/admin/session', '/api/admin/rooms', `/api/admin/rooms/${room}/control`]) {
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
