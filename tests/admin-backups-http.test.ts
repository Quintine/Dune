// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const roomCode = 'BACKUPAA';
const backupId = '00000000-0000-4000-8000-000000000001';

void test('room-host and forged administrator credentials cannot list, create or export private backups', async () => {
  const created = await fetch(base + '/api/rooms', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin: base },
    body: JSON.stringify({ name: 'Backup boundary QA', faction: 'atreides', advanced: false, expansions: [] }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(created.status, 201);
  const seatCookie = created.headers.get('set-cookie')?.split(';')[0];
  assert.ok(seatCookie);
  await created.body?.cancel();
  const credentials: Record<string, string>[] = [
    {},
    { cookie: seatCookie, 'X-Dune-Admin-Id': backupId },
    { cookie: 'dune_admin_session=' + 'a'.repeat(64), 'X-Dune-Admin-Id': backupId },
  ];
  for (const headers of credentials) {
    for (const path of [`/api/admin/backups?room=${roomCode}`, `/api/admin/backups/${backupId}/download`]) {
      const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('content-disposition'), null);
      assert.deepEqual(Object.keys(await response.json()), ['error']);
    }
    const response = await fetch(base + '/api/admin/backups', {
      method: 'POST', headers: { ...headers, origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, operationId: crypto.randomUUID(), expectedVersion: 0, reason: 'Denied backup' }),
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(await response.json()), ['error']);
  }
});
