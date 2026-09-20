// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView } from '../game/engine';

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

void test('lobby AI configuration HTTP keeps host authority, saved identity, readiness and private views', async () => {
  const host = await request('/api/rooms', {
    name: 'Configuration host',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(host.status, 201);
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const peer = await request(path, {
    type: 'join',
    name: 'Configuration peer',
    faction: 'emperor',
  });
  assert.equal(peer.status, 200);
  assert.ok(peer.cookie);
  let result = await request(
    path,
    {
      version: peer.data.version,
      action: { type: 'addBot', faction: 'harkonnen', difficulty: 'Easy' },
    },
    host.cookie,
  );
  assert.equal(result.status, 200);
  const bot = result.data.players.find((player) => player.bot)!;
  for (const cookie of [host.cookie, peer.cookie]) {
    result = await request(
      path,
      { version: result.data.version, action: { type: 'ready' } },
      cookie,
    );
    assert.equal(result.status, 200);
  }
  const version = result.data.version;
  const action = {
    type: 'configureBot',
    target: bot.id,
    difficulty: 'Hard',
    faction: 'guild',
    position: 6,
  };
  for (const rejected of [
    await request(path, { version, action }),
    await request(path, { version, action }, peer.cookie),
    await request(
      path,
      { version, action },
      host.cookie,
      'https://other.invalid',
    ),
    await request(
      path,
      { version, action: { ...action, target: peer.data.me } },
      host.cookie,
    ),
    await request(path, { version: version + 1, action }, host.cookie),
  ])
    assert.ok(rejected.status >= 400);
  assert.equal(
    (await request(path, undefined, host.cookie)).data.version,
    version,
  );
  const changed = await request(path, { version, action }, host.cookie);
  assert.equal(changed.status, 200);
  assert.equal(changed.data.version, version + 1);
  assert.ok(
    (await request(path, { version, action }, host.cookie)).status >= 400,
  );
  for (const [cookie, me] of [
    [host.cookie, host.data.me],
    [peer.cookie, peer.data.me],
  ]) {
    const restored = await request(path, undefined, cookie);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.me, me);
    const configured = restored.data.players.find(
      (player) => player.id === bot.id,
    )!;
    assert.equal(configured.faction, 'guild');
    assert.equal(configured.bot, 'Hard');
    assert.equal(configured.ready, true);
    assert.equal(restored.data.playerPositions[bot.id], 6);
    assert.ok(
      restored.data.players
        .filter((player) => !player.bot)
        .every((player) => !player.ready),
    );
    for (const rival of restored.data.players.filter(
      (player) => player.id !== me,
    ))
      for (const secret of ['hand', 'spice', 'traitors', 'traitorChoices'])
        assert.equal(Object.hasOwn(rival, secret), false);
  }
});
