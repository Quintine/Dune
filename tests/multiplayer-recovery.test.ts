import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, body?: unknown, cookie?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response.json()) as GameView & { error?: string },
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
const create = () =>
  request('/api/rooms', {
    name: 'Recovery audit host',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });

void test('replaying an acknowledged or uncertain action never toggles readiness twice', async () => {
  const host = await create();
  assert.equal(host.status, 201);
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const payload = { version: host.data.version, action: { type: 'ready' } };
  // The client may lose this successful response and retry the original payload.
  const accepted = await request(path, payload, host.cookie);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.version, host.data.version + 1);
  assert.equal(accepted.data.players[0].ready, true);
  const duplicates = await Promise.all(
    Array.from({ length: 3 }, () => request(path, payload, host.cookie)),
  );
  assert.ok(duplicates.every((r) => r.status === 409));
  const restored = await request(path, undefined, host.cookie);
  assert.equal(restored.status, 200);
  assert.deepEqual(restored.data, accepted.data);
  const subsequent = await request(
    path,
    { version: restored.data.version, action: { type: 'ready' } },
    host.cookie,
  );
  assert.equal(subsequent.status, 200);
  assert.equal(subsequent.data.players[0].ready, false);
  assert.equal(subsequent.data.version, accepted.data.version + 1);
});

void test('racing faction claims creates one seat and authenticated rejoin preserves that seat', async () => {
  const host = await create();
  assert.equal(host.status, 201);
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const claims = await Promise.all(
    ['First claimant', 'Second claimant'].map((name) =>
      request(path, { type: 'join', name, faction: 'harkonnen' }),
    ),
  );
  assert.deepEqual(
    claims.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  const winner = claims.find((r) => r.status === 200)!;
  assert.ok(winner.cookie);
  assert.equal(claims.find((r) => r.status === 409)!.cookie, undefined);
  const seated = await request(path, undefined, host.cookie);
  assert.equal(seated.data.players.length, 2);
  assert.equal(seated.data.version, host.data.version + 1);
  const retry = await request(path, {
    type: 'join',
    name: 'Retry claimant',
    faction: 'emperor',
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.players.length, 3);
  const before = await request(path, undefined, winner.cookie);
  const rejoin = await request(
    path,
    { type: 'join', name: 'Attempted duplicate seat', faction: 'guild' },
    winner.cookie,
  );
  assert.equal(rejoin.status, 200);
  assert.deepEqual(rejoin.data, before.data);
  assert.equal(rejoin.cookie, undefined);
});

void test('a valid seat token cannot read or mutate a different room', async () => {
  const [first, second] = await Promise.all([create(), create()]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.ok(first.cookie);
  assert.ok(second.cookie);
  const path = `/api/rooms/${second.data.code}`;
  // Rename the cookie to the target room: authentication must bind the hash to room.
  const transplanted = `dune_${second.data.code}=${first.cookie.split('=')[1]}`;
  for (const body of [
    undefined,
    { version: second.data.version, action: { type: 'ready' } },
  ]) {
    const response = await request(path, body, transplanted);
    assert.equal(response.status, 409);
    assert.deepEqual(Object.keys(response.data), ['error']);
  }
  const after = await request(path, undefined, second.cookie);
  assert.equal(after.status, 200);
  assert.deepEqual(after.data, second.data);
});
