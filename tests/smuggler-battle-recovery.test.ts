import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { applyAction } from '../game/engine';
import { smugglerBattle, revealSmuggler } from './fixture-smuggler-battle';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('authenticated SQLite restart and concurrent final votes collect Smuggler spice once with seat privacy', async () => {
  const f = unitStore(), sqlite: DatabaseSync = f.sqlite;
  try {
    const created = await f.rooms.createRoom('Smuggler', 'emperor', false, []);
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'Opponent', 'guild');
    const tokens = [created.token!, joined.token!];
    for (const [i, token] of tokens.entries()) {
      const auth = await f.rooms.authenticate(code, token);
      sqlite.prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?').run(i ? 'd' : 'a', code, auth.playerId);
    }
    const auth = await Promise.all(tokens.map(token => f.restart().authenticate(code, token)));
    const state = applyAction(revealSmuggler(smugglerBattle()), 'a', { type: 'traitorCall', call: false });
    state.code = code; state.version = (await f.rooms.readRoom(code)).version;
    sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(state), state.version, code);
    const beforeSeats = sqlite.prepare('SELECT * FROM seats WHERE room_code=? ORDER BY player_id').all(code);
    for (let i = 0; i < auth.length; i++) {
      const view = await f.restart().readSeatView(code, auth[i]);
      assert.equal(view.battle!.smugglerCollection!.amount, 6);
      assert.equal(view.players.find(p => p.id === view.me)!.spice, 20);
      assert.equal('spice' in view.players.find(p => p.id !== view.me)!, false);
      assert.equal('hand' in view.players.find(p => p.id !== view.me)!, false);
      assert.equal('frame' in view.battle!.smugglerCollection!, false);
    }
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const action = { type: 'traitorCall' as const, call: false };
    const race = await Promise.allSettled([
      f.rooms.act(code, auth[1], state.version, action, clock),
      f.restart().act(code, auth[1], state.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(race.filter(r => r.status === 'rejected').length, 1);
    const done = await f.restart().readRoom(code);
    assert.equal(done.version, state.version + 1);
    assert.equal(done.players[0].spice, 26);
    assert.equal(done.spice['wind_pass:14'], 2);
    assert.equal(done.lastBattleContext!.smugglerCollection!.stage, 'collected');
    assert.equal(done.log.filter(l => l.text.includes('surviving Smuggler collected')).length, 1);
    await assert.rejects(f.restart().act(code, auth[1], state.version, action, clock));
    await assert.rejects(f.restart().act(code, auth[1], done.version, action, clock));
    assert.deepEqual(await f.restart().readRoom(code), done);
    assert.deepEqual(sqlite.prepare('SELECT * FROM seats WHERE room_code=? ORDER BY player_id').all(code), beforeSeats);
    for (const seat of auth) {
      const first = await f.rooms.readSeatView(code, seat);
      assert.deepEqual(await f.restart().readSeatView(code, seat), first);
    }
  } finally { sqlite.close(); }
});
