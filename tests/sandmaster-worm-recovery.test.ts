import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { sandmasterWormGame, sandmasterRide } from './fixture-sandmaster-worm';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('concurrent authenticated rides collect once, and SQLite restart resumes only the remaining BG arrival', async () => {
  const f = unitStore(), sqlite: DatabaseSync = f.sqlite;
  try {
    const created = await f.rooms.createRoom('Rider', 'fremen', false, []);
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'BG', 'beneGesserit');
    const tokens = [created.token!, joined.token!];
    for (const [i, token] of tokens.entries()) {
      const auth = await f.rooms.authenticate(code, token);
      sqlite.prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?').run(i ? 'h' : 'p', code, auth.playerId);
    }
    const auth = await Promise.all(tokens.map(token => f.restart().authenticate(code, token)));
    const state = sandmasterWormGame(true, true);
    state.code = code; state.version = (await f.rooms.readRoom(code)).version;
    state.spice['red_chasm:7'] = 1;
    sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(state), state.version, code);
    const seats = sqlite.prepare('SELECT * FROM seats WHERE room_code=? ORDER BY player_id').all(code);
    const restored = await f.restart().readSeatView(code, auth[0]);
    assert.equal(restored.decision?.kind, 'wormRide');
    assert.equal(restored.players[0].spice, 5);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const action = sandmasterRide();
    const race = await Promise.allSettled([
      f.rooms.act(code, auth[0], state.version, action, clock),
      f.restart().act(code, auth[0], state.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(race.filter(r => r.status === 'rejected').length, 1);
    const pending = await f.restart().readRoom(code);
    assert.equal(pending.version, state.version + 1);
    assert.equal(pending.decision?.kind, 'intrusion');
    assert.equal(pending.players[0].spice, 6);
    assert.equal(pending.spice['red_chasm:7'], 0);
    assert.equal(pending.players[0].forces['red_chasm:7'], 4);
    assert.equal(pending.players[0].elites!.forces['red_chasm:7'], 2);
    for (const seat of auth) {
      const view = await f.restart().readSeatView(code, seat);
      assert.deepEqual(view, await f.rooms.readSeatView(code, seat));
      assert.equal('spice' in view.players.find(p => p.id !== view.me)!, false);
      assert.equal('hand' in view.players.find(p => p.id !== view.me)!, false);
    }
    await assert.rejects(f.restart().act(code, auth[0], state.version, action, clock));
    await f.restart().act(code, auth[1], pending.version, { type: 'decision', accept: false }, clock);
    const done = await f.restart().readRoom(code);
    assert.equal(done.players[0].spice, 6);
    assert.equal(done.spice['red_chasm:7'], 0);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 1);
    await assert.rejects(f.restart().act(code, auth[0], done.version, action, clock));
    assert.deepEqual(await f.restart().readRoom(code), done);
    assert.deepEqual(sqlite.prepare('SELECT * FROM seats WHERE room_code=? ORDER BY player_id').all(code), seats);
  } finally { sqlite.close(); }
});
