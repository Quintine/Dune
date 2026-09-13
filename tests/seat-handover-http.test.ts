// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView } from '../game/engine';
import { createHandoverKit, createHandoverClaim } from '../lib/seat-handover';
const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const secret = () =>
  crypto.randomUUID().replaceAll('-', '') +
  crypto.randomUUID().replaceAll('-', '');
async function request(
  path: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { error: 'Non-JSON response' };
  }
  const data = parsed as GameView & {
    view: GameView;
    error?: string;
    code: string;
    replayed?: boolean;
    transferred?: boolean;
    expiresAt?: number;
    revoked?: boolean;
  };
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    cookieHeader: response.headers.get('set-cookie'),
    cache: response.headers.get('cache-control'),
  };
}
async function create() {
  const result = await request('/api/rooms', {
    name: 'Handover HTTP QA',
    faction: 'atreides',
    expansions: [],
    advanced: false,
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return { ...result, path: `/api/rooms/${result.data.code}` };
}
const sameGame = (a: GameView, b: GameView) =>
  assert.deepEqual({ ...a, version: 0 }, { ...b, version: 0 });
void test('HTTP owner handover preserves seat, invalidates old browser/recovery and confirms exact claim retry', async () => {
  const a = await create(),
    recoverySecret = secret();
  const saved = await request(
    a.path + '/control',
    { type: 'setRecoveryKey', version: a.data.version, recoverySecret },
    a.cookie,
  );
  assert.equal(saved.status, 200);
  const kit = createHandoverKit(a.data.code, a.data.me);
  const body = {
    type: 'createSeatHandover',
    version: saved.data.view.version,
    offerId: kit.offerId,
    handoverSecret: kit.handoverSecret,
  };
  const offered = await request(a.path + '/control', body, a.cookie);
  assert.equal(offered.status, 200);
  assert.ok(offered.data.expiresAt! > Date.now());
  sameGame(offered.data.view, saved.data.view);
  const retriedOffer = await request(a.path + '/control', body, a.cookie);
  assert.equal(retriedOffer.status, 200);
  assert.equal(retriedOffer.data.replayed, true);
  assert.equal(retriedOffer.data.view.version, offered.data.view.version);
  const attempt = createHandoverClaim(kit).attempt;
  const claimed = await request(a.path + '/control', attempt);
  assert.equal(claimed.status, 200);
  assert.equal(claimed.data.transferred, true);
  assert.ok(claimed.cookieHeader?.includes('HttpOnly'));
  assert.ok(claimed.cookieHeader?.includes('SameSite=Strict'));
  assert.ok(claimed.cookieHeader?.includes(`Path=${a.path}`));
  assert.equal(claimed.cache, 'no-store');
  sameGame(claimed.data.view, offered.data.view);
  assert.equal((await request(a.path, undefined, a.cookie)).status, 409);
  assert.equal(
    (
      await request(a.path + '/control', {
        type: 'recoverSeat',
        playerId: a.data.me,
        recoverySecret,
        operationId: crypto.randomUUID(),
        newSessionToken: secret(),
      })
    ).status,
    409,
  );
  const replay = await request(a.path + '/control', attempt);
  assert.equal(replay.status, 200);
  assert.equal(replay.cookie, claimed.cookie);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.view.version, claimed.data.view.version);
  const read = await request(a.path, undefined, replay.cookie);
  assert.equal(read.status, 200);
  sameGame(read.data, claimed.data.view);
  assert.equal(JSON.stringify(read.data).includes(kit.handoverSecret), false);
  assert.equal(JSON.stringify(read.data).includes(kit.offerId), false);
  assert.equal(
    (await request(a.path + '/control', createHandoverClaim(kit).attempt))
      .status,
    409,
  );
});
void test('HTTP handover rejects another active seat cookie, wrong secrets and cross-origin writes without changing ownership', async () => {
  const a = await create();
  const other = await request(a.path, {
    type: 'join',
    name: 'Other handover seat',
    faction: 'harkonnen',
  });
  assert.equal(other.status, 200);
  const kit = createHandoverKit(a.data.code, a.data.me);
  const offer = {
    type: 'createSeatHandover',
    version: other.data.version,
    offerId: kit.offerId,
    handoverSecret: kit.handoverSecret,
  };
  assert.equal((await request(a.path + '/control', offer)).status, 409);
  assert.equal(
    (await request(a.path + '/control', offer, a.cookie, 'https://other.test'))
      .status,
    403,
  );
  const made = await request(a.path + '/control', offer, a.cookie);
  assert.equal(made.status, 200);
  const attempt = createHandoverClaim(kit).attempt;
  const wrongSeat = await request(a.path + '/control', attempt, other.cookie);
  assert.equal(wrongSeat.status, 409);
  assert.equal(wrongSeat.data.code, 'ALREADY_SEATED');
  const bad = await request(a.path + '/control', {
    ...attempt,
    handoverSecret: secret(),
  });
  assert.equal(bad.status, 409);
  assert.equal(bad.data.view, undefined);
  assert.equal((await request(a.path, undefined, a.cookie)).status, 200);
  const cancelled = await request(
    a.path + '/control',
    {
      type: 'revokeSeatHandover',
      version: made.data.view.version,
      offerId: kit.offerId,
    },
    a.cookie,
  );
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.revoked, true);
  assert.equal((await request(a.path + '/control', attempt)).status, 409);
});
void test('HTTP simultaneous identical handover retries establish one credential and one ownership change', async () => {
  const a = await create(),
    kit = createHandoverKit(a.data.code, a.data.me);
  const offered = await request(
    a.path + '/control',
    {
      type: 'createSeatHandover',
      version: a.data.version,
      offerId: kit.offerId,
      handoverSecret: kit.handoverSecret,
    },
    a.cookie,
  );
  assert.equal(offered.status, 200);
  const attempt = createHandoverClaim(kit).attempt;
  const results = await Promise.all([
    request(a.path + '/control', attempt),
    request(a.path + '/control', attempt),
  ]);
  assert.ok(results.some((result) => result.status === 200));
  const confirmed = await request(a.path + '/control', attempt);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.view.version, offered.data.view.version + 1);
  for (const result of results.filter((value) => value.status === 200))
    assert.equal(result.cookie, confirmed.cookie);
  assert.equal(
    (await request(a.path, undefined, confirmed.cookie)).status,
    200,
  );
});
