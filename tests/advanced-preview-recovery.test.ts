import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';

async function fixture() {
  const store = unitStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const host = await store.rooms.createRoom(
    'Preview host',
    'atreides',
    true,
    [],
  );
  const code = host.view.code;
  const peer = await store.rooms.joinRoom(code, 'Preview peer', 'emperor');
  assert.ok(peer.token);
  const hostAuth = await store.rooms.authenticate(code, host.token);
  const peerAuth = await store.rooms.authenticate(code, peer.token);
  for (const auth of [hostAuth, peerAuth]) {
    const before = await store.rooms.readRoom(code);
    await store.rooms.act(code, auth, before.version, { type: 'ready' });
  }
  return {
    ...store,
    code,
    hostAuth,
    peerAuth,
    current: await store.rooms.readRoom(code),
  };
}

void test('Advanced preview survives room restart without redealing or exposing rival secrets', async () => {
  const f = await fixture();
  try {
    const seats = f.sqlite.prepare('SELECT * FROM seats').all();
    const count = f.writes.length;
    await assert.rejects(
      f.rooms.act(f.code, f.hostAuth, f.current.version, { type: 'start' }),
      /preview/i,
    );
    await assert.rejects(
      f.rooms.act(f.code, f.peerAuth, f.current.version, {
        type: 'start',
        advancedPreview: true,
      }),
    );
    assert.equal(f.writes.length, count);
    assert.deepEqual(await f.rooms.readRoom(f.code), f.current);
    await f.rooms.act(f.code, f.hostAuth, f.current.version, {
      type: 'start',
      advancedPreview: true,
    });
    const started = await f.rooms.readRoom(f.code);
    assert.equal(started.status, 'setup');
    assert.equal(started.advancedPreview, true);
    const restarted = f.restart();
    for (const auth of [f.hostAuth, f.peerAuth]) {
      const view = await restarted.readSeatView(f.code, auth);
      assert.equal(view.advanced, true);
      assert.equal(view.advancedPreview, true);
      const own = view.players.find((p) => p.id === auth.playerId)!;
      assert.ok(own.traitorChoices?.length);
      for (const rival of view.players.filter((p) => p.id !== auth.playerId)) {
        for (const field of ['hand', 'traitors', 'traitorChoices', 'spice'])
          assert.equal(Object.hasOwn(rival, field), false);
      }
    }
    assert.deepEqual(await restarted.readRoom(f.code), started);
    const writes = f.writes.length;
    for (const action of [
      { type: 'start', advancedPreview: true },
      { type: 'rules', advanced: false },
    ])
      await assert.rejects(
        restarted.act(f.code, f.hostAuth, started.version, action),
      );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await restarted.readRoom(f.code), started);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
  } finally {
    f.sqlite.close();
  }
});

void test('a rules change survives restart and requires new readiness before an ordinary Basic start', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.hostAuth, f.current.version, {
      type: 'strongholdCards',
      enabled: true,
    });
    for (const auth of [f.hostAuth, f.peerAuth]) {
      const before = await f.rooms.readRoom(f.code);
      await f.rooms.act(f.code, auth, before.version, { type: 'ready' });
    }
    let before = await f.rooms.readRoom(f.code);
    await assert.rejects(
      f.rooms.act(f.code, f.peerAuth, before.version, {
        type: 'rules',
        advanced: false,
      }),
    );
    await f.rooms.act(f.code, f.hostAuth, before.version, {
      type: 'rules',
      advanced: false,
    });
    const restarted = f.restart();
    before = await restarted.readRoom(f.code);
    assert.equal(before.advanced, false);
    assert.equal(before.strongholdCards, null);
    assert.ok(before.players.every((p) => !p.ready));
    await assert.rejects(
      restarted.act(f.code, f.hostAuth, before.version, { type: 'start' }),
      /ready/i,
    );
    for (const auth of [f.hostAuth, f.peerAuth]) {
      before = await restarted.readRoom(f.code);
      await restarted.act(f.code, auth, before.version, { type: 'ready' });
    }
    before = await restarted.readRoom(f.code);
    await restarted.act(f.code, f.hostAuth, before.version, { type: 'start' });
    const started = await restarted.readRoom(f.code);
    assert.equal(started.advanced, false);
    assert.equal(started.advancedPreview, undefined);
    assert.equal(started.status, 'setup');
  } finally {
    f.sqlite.close();
  }
});

void test('racing Advanced start and rules changes preserve exactly one committed setup or lobby', async () => {
  for (const startWins of [true, false]) {
    const f = await fixture();
    try {
      const start = { type: 'start', advancedPreview: true };
      const rules = { type: 'rules', advanced: false };
      let winning: unknown;
      f.hooks.beforeWrite = async () => {
        f.hooks.beforeWrite = undefined;
        await f.rooms.act(
          f.code,
          f.hostAuth,
          f.current.version,
          startWins ? start : rules,
        );
        winning = await f.rooms.readRoom(f.code);
      };
      await assert.rejects(
        f.rooms.act(
          f.code,
          f.hostAuth,
          f.current.version,
          startWins ? rules : start,
        ),
        /changed|again|stale/i,
      );
      const restored = await f.restart().readRoom(f.code);
      assert.deepEqual(restored, winning);
      assert.equal(restored.version, f.current.version + 1);
      assert.equal(restored.status, startWins ? 'setup' : 'lobby');
      assert.equal(restored.advancedPreview, startWins ? true : undefined);
      assert.equal(f.writes.at(-1)!.changes, 0);
    } finally {
      f.sqlite.close();
    }
  }
});
