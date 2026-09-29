import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { harassCustody, harassWithdrawGame, takeHarassCard } from './fixture-harass-withdraw';

const clock: RoomsClock = { now: () => 83001, sleep: async () => {} };
const rows = (sqlite: DatabaseSync) => ({
  rooms: sqlite.prepare('SELECT * FROM rooms ORDER BY code').all(),
  seats: sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
});

void test('a privately sealed Reinforcements plan and its one-time physical cost survive D1-style restart and competing final writes', async t => {
  for (const { advanced, factions } of [
    { advanced: false, factions: ['emperor', 'atreides', 'harkonnen'] as const },
    { advanced: true, factions: ['emperor', 'atreides', 'harkonnen'] as const },
    { advanced: true, factions: ['moritani', 'ecaz', 'atreides'] as const },
  ]) {
    const store = unitStore();
    t.after(() => store.sqlite.close());
    const made = await store.rooms.createRoom('Reinforcements recovery', factions[0], advanced,
      factions[0] === 'moritani' ? ['ecaz'] : []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of factions.slice(1))
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string, string, string];
    let game = harassWithdrawGame({ advanced, ids, factions });
    game.code = code;
    game.version = (await store.rooms.readRoom(code)).version;
    takeHarassCard(game, ids[0], 'ecaz-reinforcements');
    harassCustody(game);
    store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code);
    store.writes.length = 0;
    const act = async (index: number, action: Action) => {
      const rooms = store.restart();
      const before = await rooms.readRoom(code);
      await rooms.act(code, await rooms.authenticate(code, tokens[index]), before.version, action, clock);
      return rooms.readRoom(code);
    };
    game = await act(0, { type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
      leader: `${factions[0]}-0`, defense: 'ecaz-reinforcements' });
    const preReveal = rows(store.sqlite);
    for (const [index, token] of tokens.entries()) {
      const rooms = store.restart();
      const seat = await rooms.readSeatView(code, await rooms.authenticate(code, token));
      assert.deepEqual(seat, viewGame(game, ids[index]));
      assert.deepEqual(seat, viewGame(JSON.parse(JSON.stringify(game)) as Game, ids[index]));
      if (index !== 0) {
        assert.deepEqual(seat.battle?.plans, {});
        assert.equal(seat.battle?.reinforcements, null);
        assert.equal(JSON.stringify(seat).includes('ecaz-reinforcements'), false);
      }
    }
    assert.deepEqual(rows(store.sqlite), preReveal);
    game = await act(1, { type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
      leader: `${factions[1]}-0` });
    game = await act(0, { type: 'traitorCall', call: false });
    const before = rows(store.sqlite);
    const version = game.version;
    const rooms = store.restart();
    const auth = await rooms.authenticate(code, tokens[1]);
    const startWrite = store.writes.length;
    let entered = 0;
    let release!: () => void;
    const both = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => {
      if (++entered === 2) release();
      await both;
    };
    const attempts = await Promise.allSettled([0, 1].map(() =>
      rooms.act(code, auth, version, { type: 'traitorCall', call: false }, clock)));
    store.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(store.writes.slice(startWrite).map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    const resolved = await store.restart().readRoom(code);
    harassCustody(resolved);
    assert.equal(resolved.version, version + 1);
    assert.equal(resolved.battle, null);
    assert.equal(resolved.players[0].reserves, 12);
    assert.equal(resolved.discard.filter(card => card.id === 'ecaz-reinforcements').length, 1);
    assert.equal(resolved.log.filter(entry => entry.text.includes('used Reinforcements: three reserve forces')).length, 1);
    assert.notDeepEqual(rows(store.sqlite).rooms, before.rooms);
    for (const [index, token] of tokens.entries()) {
      const seat = await store.restart().readSeatView(code, await store.restart().authenticate(code, token));
      assert.deepEqual(seat, viewGame(JSON.parse(JSON.stringify(resolved)) as Game, ids[index]));
    }
  }
});
