import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import { nexusChoamTradeFixture, pausedNexusChoamTrade } from './fixture-nexus-choam-trade';
import { viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { nexusTraitorInventory } from './fixture-nexus-traitors';

const clock: RoomsClock = {now: () => 10000, sleep: async () => {}};
void test('SQLite competing trades settle once, restore private seats and resume an already-paid discard without another payout', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('Nexus trade SQL', 'atreides', true, []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string, string, string];
    const f = nexusChoamTradeFixture(true, ids);
    f.g.code = code; f.g.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?').run(JSON.stringify(f.g), f.g.version, code);
    const seats = store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([f.cost, f.spare].map(card =>
        store.restart().act(code, auths[0], f.g.version, {...f.action, card: card.id}, clock)));
    } finally { clearTimeout(timer); delete store.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const done = await store.restart().readRoom(code);
    assert.equal(done.players[0].spice, f.g.players[0].spice + 2);
    assert.equal(done.nexusChoamTrades!.length, 1);
    assert.equal(done.players[0].hand.length, f.g.players[0].hand.length - 1);
    assert.equal(done.version, f.g.version + 1);
    const before = JSON.stringify(done);
    await assert.rejects(store.restart().act(code, auths[0], done.version, f.action, clock));
    assert.equal(JSON.stringify(await store.restart().readRoom(code)), before);
    for (const [i, token] of tokens.entries()) {
      const rooms = store.restart(), auth = await rooms.authenticate(code, token);
      assert.deepEqual(await rooms.readSeatView(code, auth), viewGame(done, ids[i]));
    }
    const paused = pausedNexusChoamTrade(done);
    store.sqlite.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(paused), code);
    await store.restart().continueRoomAutomatic(code, clock);
    const resumed = await store.restart().readRoom(code);
    assert.equal(resumed.players[0].spice, done.players[0].spice);
    assert.equal(resumed.nexusChoamTrades![0].stage, 'complete');
    assert.equal(resumed.pendingTreacheryDiscard, null);
    const settled = JSON.stringify(resumed);
    await store.restart().continueRoomAutomatic(code, clock);
    assert.equal(JSON.stringify(await store.restart().readRoom(code)), settled);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
    nexusTraitorInventory(resumed);
  } finally { store.sqlite.close(); }
});
