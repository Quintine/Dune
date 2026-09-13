import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkSeatRestoration,
  loadRestorationConfig,
  type RestorationConfig,
} from '../tools/seat-restoration';

const config: RestorationConfig = {
  baseUrl: 'http://127.0.0.1:3000',
  isolatedQa: true,
  seats: [
    { code: 'ABCDEFGH', playerId: 'p1', version: 4, token: 'private_token' },
  ],
};
const view = () => ({
  code: 'ABCDEFGH',
  me: 'p1',
  version: 4,
  players: [{ id: 'p1', hand: [], traitors: [], spice: 10 }, { id: 'p2' }],
});
const respond =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });

void test('restoration authenticates the expected seat and prevents cookie redirects', async () => {
  const request: typeof fetch = async (url, options) => {
    assert.ok(url instanceof URL);
    assert.equal(url.href, 'http://127.0.0.1:3000/api/rooms/ABCDEFGH');
    assert.equal(
      new Headers(options?.headers).get('cookie'),
      'dune_ABCDEFGH=private_token',
    );
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal);
    return Response.json(view());
  };
  assert.deepEqual(await checkSeatRestoration(config, request), {
    checked: 1,
    passed: true,
  });
});

void test('restoration refuses wrong identity, stale versions, missing private state and rival secrets', async () => {
  for (const body of [
    { ...view(), me: 'p2' },
    { ...view(), code: 'BCDEFGHJ' },
    { ...view(), version: 5 },
    { ...view(), players: [{ id: 'p1' }] },
    { ...view(), botsPending: true },
    {
      ...view(),
      players: [...view().players, { id: 'p3', traitors: ['secret'] }],
    },
  ])
    await assert.rejects(
      checkSeatRestoration(config, respond(body)),
      /^Error: Seat 1 failed/,
    );
  await assert.rejects(
    checkSeatRestoration(
      config,
      respond({ error: 'private_token secret response' }, 403),
    ),
    (error) => {
      assert.equal(String(error).includes('private_token'), false);
      return true;
    },
  );
});

void test('invalid origins and unsafe credentials cause no network requests', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    return Response.json(view());
  };
  for (const baseUrl of [
    'https://example.com',
    'http://127.0.0.1.evil.test',
    'http://user:password@localhost',
    'http://localhost/other',
    'http://localhost/?secret=token',
  ])
    await assert.rejects(checkSeatRestoration({ ...config, baseUrl }, request));
  await assert.rejects(
    checkSeatRestoration(
      { ...config, seats: [{ ...config.seats[0], token: 'a; other=cookie' }] },
      request,
    ),
  );
  await assert.rejects(
    checkSeatRestoration(
      { ...config, isolatedQa: false } as unknown as RestorationConfig,
      request,
    ),
  );
  assert.equal(calls, 0);
});

void test('seat manifests must be private files outside the checkout', (t) => {
  const area = mkdtempSync(join(tmpdir(), 'dune-seat-manifest-'));
  t.after(() => rmSync(area, { recursive: true, force: true }));
  const root = join(area, 'repo');
  mkdirSync(root);
  const outside = join(area, 'seats.json'),
    inside = join(root, 'seats.json');
  writeFileSync(outside, JSON.stringify(config), { mode: 0o600 });
  writeFileSync(inside, JSON.stringify(config), { mode: 0o600 });
  assert.deepEqual(loadRestorationConfig(outside, root), config);
  assert.throws(
    () => loadRestorationConfig(inside, root),
    /private file outside/,
  );
  chmodSync(outside, 0o644);
  assert.throws(
    () => loadRestorationConfig(outside, root),
    /private file outside/,
  );
});
