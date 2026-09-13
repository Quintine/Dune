import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  leaderSkillBattle,
  resolveLeaderSkillBattle,
} from './leader-skill-battle-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('SQLite restart preserves both Rihani choices and concurrent submissions change physical Traitors exactly once', async () => {
  const f = unitStore();
  const sqlite: DatabaseSync = f.sqlite;
  try {
    const created = await f.rooms.createRoom(
      'Decipherer',
      'emperor',
      false,
      [],
    );
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'Opponent', 'guild');
    const tokens = [created.token!, joined.token!];
    const old = await Promise.all(
      tokens.map((token) => f.rooms.authenticate(code, token)),
    );
    for (const [index, auth] of old.entries())
      sqlite
        .prepare(
          'UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?',
        )
        .run(index ? 'd' : 'a', code, auth.playerId);
    const auths = await Promise.all(
      tokens.map((token) => f.restart().authenticate(code, token)),
    );

    const state = resolveLeaderSkillBattle(
      leaderSkillBattle({ skill: 'rihani-decipherer' }),
    );
    state.code = code;
    state.version = (await f.rooms.readRoom(code)).version;
    sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);

    const ownerOffer = await f.restart().readSeatView(code, auths[0]);
    const observerOffer = await f.restart().readSeatView(code, auths[1]);
    assert.equal(ownerOffer.decision?.kind, 'rihani');
    assert.equal(ownerOffer.rihani?.history[0].peeked.length, 2);
    assert.deepEqual(observerOffer.rihani?.history, []);
    assert.equal('rihaniHistory' in observerOffer, false);
    assert.equal('drawn' in observerOffer.rihani!.pending!, false);
    assert.equal('eligible' in observerOffer.rihani!.pending!, false);
    assert.deepEqual(await f.restart().readRoom(code), state);

    const event = state.rihaniHistory![0].event;
    const draw = { type: 'decision' as const, event, draw: true };
    let arrivals = 0;
    let release!: () => void;
    let barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await barrier;
    };
    const drawResults = await Promise.allSettled([
      f.rooms.act(code, auths[0], state.version, draw, clock),
      f.restart().act(code, auths[0], state.version, draw, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(
      drawResults.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      drawResults.filter((result) => result.status === 'rejected').length,
      1,
    );

    const drawn = await f.restart().readRoom(code);
    const receipt = drawn.rihaniHistory![0];
    assert.equal(drawn.version, state.version + 1);
    assert.equal(receipt.stage, 'return');
    assert.equal(receipt.drawn.length, 2);
    assert.equal(
      drawn.players[0].traitors.length,
      state.players[0].traitors.length + 2,
    );
    assert.equal(
      drawn.traitorReserve!.length,
      state.traitorReserve!.length - 2,
    );
    const observerReturn = await f.restart().readSeatView(code, auths[1]);
    assert.equal(observerReturn.rihani?.pending?.stage, 'return');
    assert.equal('drawn' in observerReturn.rihani!.pending!, false);
    assert.equal('eligible' in observerReturn.rihani!.pending!, false);

    const kept = receipt.drawn[0];
    const given = receipt.eligible[0];
    const returned = receipt.drawn[1];
    const finish = {
      type: 'decision' as const,
      event,
      cards: [kept, given],
    };
    arrivals = 0;
    barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await barrier;
    };
    const finishResults = await Promise.allSettled([
      f.rooms.act(code, auths[0], drawn.version, finish, clock),
      f.restart().act(code, auths[0], drawn.version, finish, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(
      finishResults.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      finishResults.filter((result) => result.status === 'rejected').length,
      1,
    );

    const done = await f.restart().readRoom(code);
    assert.equal(done.version, state.version + 2);
    assert.equal(done.rihaniHistory![0].stage, 'complete');
    assert.equal(done.lastBattleContext?.rihani?.completed, true);
    assert.equal(
      done.players[0].traitors.length,
      state.players[0].traitors.length,
    );
    assert.ok(done.players[0].traitors.includes(kept));
    assert.ok(!done.players[0].traitors.includes(given));
    assert.ok(done.traitorReserve!.includes(given));
    assert.ok(done.traitorReserve!.includes(returned));
    assert.equal(done.traitorReserve!.length, state.traitorReserve!.length);
    await assert.rejects(() =>
      f.restart().act(code, auths[0], drawn.version, finish, clock),
    );
    assert.deepEqual(await f.restart().readRoom(code), done);
  } finally {
    sqlite.close();
  }
});
