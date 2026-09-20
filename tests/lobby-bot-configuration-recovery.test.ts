import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';

async function fixture() {
  const store = unitStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const host = await store.rooms.createRoom('Host', 'atreides', false, []);
  const code = host.view.code;
  const peer = await store.rooms.joinRoom(code, 'Peer', 'emperor');
  assert.ok(peer.token);
  const hostAuth = await store.rooms.authenticate(code, host.token);
  const peerAuth = await store.rooms.authenticate(code, peer.token);
  let current = await store.rooms.readRoom(code);
  await store.rooms.act(code, hostAuth, current.version, {
    type: 'addBot',
    faction: 'harkonnen',
    difficulty: 'Easy',
  });
  for (const auth of [hostAuth, peerAuth]) {
    current = await store.rooms.readRoom(code);
    await store.rooms.act(code, auth, current.version, { type: 'ready' });
  }
  current = await store.rooms.readRoom(code);
  const bot = current.players.find((player) => player.bot)!;
  const action = {
    type: 'configureBot',
    target: bot.id,
    difficulty: 'Brutal',
    faction: 'guild',
    position: 6,
  };
  return { ...store, code, hostAuth, peerAuth, current, bot, action };
}

void test('AI configuration persists the same seat and roster, clears readiness and survives a room module restart', async () => {
  const f = await fixture();
  try {
    const seats = f.sqlite.prepare('SELECT * FROM seats').all();
    const result = await f.rooms.act(
      f.code,
      f.hostAuth,
      f.current.version,
      f.action,
    );
    assert.equal(result.version, f.current.version + 1);
    const restarted = f.restart();
    const restored = await restarted.readRoom(f.code);
    const bot = restored.players.find((player) => player.id === f.bot.id)!;
    assert.equal(bot.name, 'Spacing Guild AI');
    assert.equal(bot.bot, 'Brutal');
    assert.equal(bot.faction, 'guild');
    assert.equal(restored.playerPositions![bot.id], 6);
    assert.ok(bot.leaders.every((leader) => leader.id.startsWith('guild-')));
    assert.equal(bot.ready, true);
    assert.ok(
      restored.players
        .filter((player) => !player.bot)
        .every((player) => !player.ready),
    );
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
    for (const auth of [f.hostAuth, f.peerAuth]) {
      const view = await restarted.readSeatView(f.code, auth);
      assert.equal(
        view.players.find((player) => player.id === bot.id)!.bot,
        'Brutal',
      );
      for (const rival of view.players.filter(
        (player) => player.id !== auth.playerId,
      )) {
        for (const secret of ['spice', 'hand', 'traitors', 'traitorChoices'])
          assert.equal(Object.hasOwn(rival, secret), false);
      }
    }
    await assert.rejects(
      restarted.act(f.code, f.hostAuth, restored.version, { type: 'start' }),
      /ready/i,
    );
    assert.deepEqual(await restarted.readRoom(f.code), restored);
    for (const auth of [f.hostAuth, f.peerAuth]) {
      const before = await restarted.readRoom(f.code);
      await restarted.act(f.code, auth, before.version, { type: 'ready' });
    }
    const beforeStart = await restarted.readRoom(f.code);
    await restarted.act(f.code, f.hostAuth, beforeStart.version, {
      type: 'start',
    });
    const started = await restarted.readRoom(f.code);
    assert.equal(started.status, 'setup');
    assert.equal(
      started.players.find((player) => player.id === bot.id)!.bot,
      'Brutal',
    );
    await assert.rejects(
      restarted.act(f.code, f.hostAuth, started.version, f.action),
    );
    assert.deepEqual(await restarted.readRoom(f.code), started);
  } finally {
    f.sqlite.close();
  }
});

void test('unauthorized, stale, future and human-target configuration cannot mutate saved lobby state', async () => {
  const f = await fixture();
  try {
    for (const [auth, version, action] of [
      [f.peerAuth, f.current.version, f.action],
      [f.hostAuth, f.current.version - 1, f.action],
      [f.hostAuth, f.current.version + 1, f.action],
      [
        f.hostAuth,
        f.current.version,
        { ...f.action, target: f.peerAuth.playerId },
      ],
    ] as const) {
      await assert.rejects(f.rooms.act(f.code, auth, version, action));
      assert.deepEqual(await f.rooms.readRoom(f.code), f.current);
    }
    const noChange = {
      ...f.action,
      difficulty: f.bot.bot,
      faction: f.bot.faction,
      position: f.current.playerPositions![f.bot.id],
    };
    await f.rooms.act(f.code, f.hostAuth, f.current.version, noChange);
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, f.current.version + 1);
    assert.deepEqual(after.players, f.current.players);
    assert.deepEqual(after.log, f.current.log);
  } finally {
    f.sqlite.close();
  }
});

void test('configuration and start races cannot overwrite the winning saved state in either order', async () => {
  for (const first of ['configure', 'start']) {
    const f = await fixture();
    try {
      const winner = first === 'configure' ? f.action : { type: 'start' };
      const loser = first === 'configure' ? { type: 'start' } : f.action;
      f.hooks.beforeWrite = async () => {
        f.hooks.beforeWrite = undefined;
        await f.rooms.act(f.code, f.hostAuth, f.current.version, winner);
      };
      await assert.rejects(
        f.rooms.act(f.code, f.hostAuth, f.current.version, loser),
        /changed|again|stale/i,
      );
      const saved = await f.restart().readRoom(f.code);
      assert.equal(saved.version, f.current.version + 1);
      assert.equal(saved.status, first === 'configure' ? 'lobby' : 'setup');
      assert.equal(
        saved.players.find((player) => player.id === f.bot.id)!.bot,
        first === 'configure' ? 'Brutal' : 'Easy',
      );
      assert.equal(f.writes.at(-1)!.changes, 0);
    } finally {
      f.sqlite.close();
    }
  }
});
