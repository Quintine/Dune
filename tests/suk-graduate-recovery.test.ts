import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { resolveSuk, sukBattle } from './suk-graduate-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('SQLite restart preserves Suk rescue and concurrent submissions save physical counters exactly once', async () => {
  const f = unitStore();
  const sqlite: DatabaseSync = f.sqlite;
  try {
    const created = await f.rooms.createRoom('Rescuer', 'emperor', false, []);
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'Opponent', 'guild');
    const tokens = [created.token!, joined.token!];
    const old = await Promise.all(tokens.map((token) => f.rooms.authenticate(code, token)));
    for (const [i, auth] of old.entries())
      sqlite.prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?').run(i ? 'd' : 'a', code, auth.playerId);
    const auths = await Promise.all(tokens.map((token) => f.restart().authenticate(code, token)));
    const state = resolveSuk(sukBattle());
    state.code = code;
    state.version = (await f.rooms.readRoom(code)).version;
    sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(state), state.version, code);
    const own = await f.restart().readSeatView(code, auths[0]);
    const other = await f.restart().readSeatView(code, auths[1]);
    assert.equal(own.decision?.kind, 'sukRescue');
    assert.deepEqual(own.decision, other.decision, 'public casualty routing reveals no private hand');
    assert.equal('pendingSukRescue' in other, false);
    assert.equal(other.players.find((p) => p.id === 'a')!.hand, undefined);
    assert.deepEqual(await f.restart().readRoom(code), state);
    const decision = own.decision;
    if (decision?.kind !== 'sukRescue') throw new Error('Missing rescue');
    const choice = decision.options.findIndex((o) => o.normal + o.elite === 3);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const action = { type: 'decision' as const, event: decision.event, choice };
    const results = await Promise.allSettled([
      f.rooms.act(code, auths[0], state.version, action, clock),
      f.restart().act(code, auths[0], state.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    const after = await f.restart().readRoom(code);
    assert.equal(after.version, state.version + 1);
    assert.equal(after.pendingSukRescue, null);
    assert.equal(after.players[0].reserves, 17);
    assert.equal(after.players[0].tanks, 1);
    assert.equal(after.players[0].forces['arrakeen:10'], 2);
    await assert.rejects(() => f.restart().act(code, auths[0], state.version, action, clock));
    assert.deepEqual(await f.restart().readRoom(code), after);
  } finally { sqlite.close(); }
});
