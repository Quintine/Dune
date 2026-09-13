import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { discoveryBattleBeforeFinalVote } from './fixture-discovery-battle';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('SQLite restoration and competing final votes commit Jacurutu income exactly once', async () => {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  try {
    const created = await store.rooms.createRoom(
      'Jacurutu recovery',
      'atreides',
      false,
      [],
    );
    const joined = await store.rooms.joinRoom(
      created.view.code,
      'Guild',
      'guild',
    );
    const third = await store.rooms.joinRoom(
      created.view.code,
      'Fremen',
      'fremen',
    );
    const tokens = [created.token, joined.token!, third.token!];
    const auths = await Promise.all(
      tokens.map((token) => store.rooms.authenticate(created.view.code, token)),
    );
    const ids = auths.map((auth) => auth.playerId) as [string, string, string];
    const stored = await store.rooms.readRoom(created.view.code);
    const { game, attacker, defender } = discoveryBattleBeforeFinalVote(
      false,
      ids,
    );
    game.code = created.view.code;
    game.version = stored.version;
    sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, game.code);
    const seats = sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();

    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    const timer = setTimeout(release, 2000);
    try {
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          store
            .restart()
            .act(
              game.code,
              auths[1],
              game.version,
              { type: 'traitorCall', call: false },
              clock,
            ),
        ),
      );
      assert.equal(arrivals, 2);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
    } finally {
      clearTimeout(timer);
      delete store.hooks.beforeWrite;
    }

    const done = await store.restart().readRoom(game.code);
    assert.equal(done.version, game.version + 1);
    assert.equal(
      done.players.find((player) => player.id === attacker)!.spice,
      23,
    );
    assert.equal(
      done.players.find((player) => player.id === defender)!.tanks,
      5,
    );
    assert.equal(
      done.log.filter(
        (entry) => entry.automatic?.name === 'Jacurutu Sietch income',
      ).length,
      1,
    );
    const stable = JSON.stringify(done);
    await store.restart().continueRoomAutomatic(game.code, clock);
    assert.equal(
      JSON.stringify(await store.restart().readRoom(game.code)),
      stable,
    );
    assert.deepEqual(
      sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
  } finally {
    sqlite.close();
  }
});
