// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView, Action } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(
  path: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response
      .json()
      .catch(() => ({ error: 'Non-JSON response' }))) as GameView & {
      error?: string;
    },
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

void test('normal HTTP lobby explicitly starts Advanced preview and restores both private seats', async () => {
  const host = await request('/api/rooms', {
    name: 'Advanced preview host',
    faction: 'atreides',
    advanced: true,
    expansions: [],
  });
  assert.equal(host.status, 201);
  assert.ok(host.cookie);
  assert.equal(host.data.advanced, true);
  assert.equal(host.data.advancedPreview, false);
  const path = `/api/rooms/${host.data.code}`;
  const peer = await request(path, {
    type: 'join',
    name: 'Advanced preview peer',
    faction: 'emperor',
  });
  assert.equal(peer.status, 200);
  assert.ok(peer.cookie);
  let version = peer.data.version;
  async function act(action: Action, cookie = host.cookie) {
    const result = await request(path, { version, action }, cookie);
    assert.equal(result.status, 200, result.data.error);
    version = result.data.version;
    return result.data;
  }
  for (const cookie of [host.cookie, peer.cookie])
    await act({ type: 'ready' }, cookie);
  for (const [action, cookie, origin] of [
    [{ type: 'rules', advanced: false }, peer.cookie, undefined],
    [{ type: 'start' }, host.cookie, undefined],
    [{ type: 'start', advancedPreview: 'true' }, host.cookie, undefined],
    [{ type: 'start', advancedPreview: true }, peer.cookie, undefined],
    [{ type: 'start', advancedPreview: true }, undefined, undefined],
    [
      { type: 'start', advancedPreview: true },
      host.cookie,
      'https://other.invalid',
    ],
  ] as const) {
    const rejected = await request(path, { version, action }, cookie, origin);
    assert.ok(rejected.status >= 400);
    assert.equal(
      (await request(path, undefined, host.cookie)).data.version,
      version,
    );
  }
  const basic = await act({ type: 'rules', advanced: false });
  assert.ok(basic.players.every((p) => !p.ready));
  const preview = await act({ type: 'rules', advanced: true });
  assert.ok(preview.players.every((p) => !p.ready));
  for (const cookie of [host.cookie, peer.cookie])
    await act({ type: 'ready' }, cookie);
  const startVersion = version;
  const started = await act({ type: 'start', advancedPreview: true });
  assert.equal(started.status, 'setup');
  assert.equal(started.advancedPreview, true);
  assert.ok(
    (
      await request(
        path,
        {
          version: startVersion,
          action: { type: 'start', advancedPreview: true },
        },
        host.cookie,
      )
    ).status >= 400,
  );
  for (const [cookie, me] of [
    [host.cookie, host.data.me],
    [peer.cookie, peer.data.me],
  ]) {
    const restored = await request(path, undefined, cookie);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.me, me);
    assert.equal(restored.data.version, version);
    assert.equal(restored.data.advancedPreview, true);
    assert.ok(
      restored.data.players.find((p) => p.id === me)!.traitorChoices?.length,
    );
    for (const rival of restored.data.players.filter((p) => p.id !== me))
      for (const field of ['hand', 'spice', 'traitors', 'traitorChoices'])
        assert.equal(Object.hasOwn(rival, field), false);
  }
});
