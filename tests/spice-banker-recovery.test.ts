import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { spiceBankerGame } from './spice-banker-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

function giveTraitor(
  game: ReturnType<typeof spiceBankerGame>,
  owner: string,
  identity: string,
) {
  const recipient = game.players.find((player) => player.id === owner)!;
  if (recipient.traitors.includes(identity)) return;
  const replaced = recipient.traitors[0];
  for (const player of game.players) {
    const index = player.traitors.indexOf(identity);
    if (index < 0) continue;
    player.traitors[index] = replaced;
    recipient.traitors[0] = identity;
    return;
  }
  const index = game.traitorReserve!.indexOf(identity);
  assert.ok(index >= 0);
  game.traitorReserve![index] = replaced;
  recipient.traitors[0] = identity;
}

async function fixture(
  options: { advanced?: boolean; traitor?: boolean; spice?: number } = {},
) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Banker',
    'emperor',
    options.advanced ?? false,
    [],
  );
  const joined = await store.rooms.joinRoom(
    created.view.code,
    'Guild',
    'guild',
  );
  const code = created.view.code;
  const tokens = [created.token!, joined.token!];
  const original = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  for (const [index, seat] of original.entries())
    sqlite
      .prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?')
      .run(index === 0 ? 'a' : 'd', code, seat.playerId);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const state = spiceBankerGame(options.advanced ?? false);
  state.code = code;
  state.version = (await store.rooms.readRoom(code)).version;
  state.players[0].spice = options.spice ?? 20;
  if (options.traitor) giveTraitor(state, 'a', 'guild-1');
  sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(state), state.version, code);
  store.writes.length = 0;
  return { ...store, sqlite, code, seats, state };
}

const bankerPlan = (amount?: number): Action => ({
  type: 'battlePlan',
  dial: 0,
  support: 0,
  leader: 'emperor-0',
  ...(amount === undefined ? {} : { bankerSpice: amount }),
});

const guildPlan: Action = {
  type: 'battlePlan',
  dial: 0,
  support: 0,
  leader: 'guild-1',
};

void test('SQLite restart keeps the Banker commitment owner-private and reserves it from other spending', async () => {
  const f = await fixture({ spice: 3 });
  try {
    await f.rooms.act(
      f.code,
      f.seats[0],
      f.state.version,
      bankerPlan(3),
      clock,
    );
    const sealed = await f.restart().readRoom(f.code);
    assert.equal(sealed.battle?.plans.a.bankerSpice, 3);
    assert.equal(sealed.players[0].spice, 3);

    const owner = await f.restart().readSeatView(f.code, f.seats[0]);
    const opponent = await f.restart().readSeatView(f.code, f.seats[1]);
    assert.equal(owner.battle?.plans.a.bankerSpice, 3);
    assert.deepEqual(owner.battle?.submitted, ['a']);
    assert.deepEqual(opponent.battle?.plans, {});
    assert.deepEqual(opponent.battle?.submitted, ['a']);
    assert.equal('bankerSpice' in (opponent.battle?.plans.a ?? {}), false);

    await assert.rejects(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[0],
          sealed.version,
          { type: 'bribe', target: 'd', amount: 1 },
          clock,
        ),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), sealed);

    await f.restart().act(f.code, f.seats[1], sealed.version, guildPlan, clock);
    let revealed = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        revealed.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    revealed = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        revealed.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].spice, 0);
    assert.equal(
      done.log.filter(
        (entry) => entry.automatic?.name === 'Spice Banker payment',
      ).length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent final Traitor decisions waive one restored Banker payment exactly once', async () => {
  const f = await fixture({ traitor: true });
  try {
    const bounty = f.state.players
      .flatMap((player) => player.leaders)
      .find((leader) => leader.id === 'guild-1')!.strength;
    await f.rooms.act(
      f.code,
      f.seats[0],
      f.state.version,
      bankerPlan(3),
      clock,
    );
    let state = await f.restart().readRoom(f.code);
    await f.restart().act(f.code, f.seats[1], state.version, guildPlan, clock);
    state = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        state.version,
        { type: 'traitorCall', call: true },
        clock,
      );
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.battle?.plans.a.bankerSpice, 3);
    assert.equal(pending.players[0].spice, 20);

    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await barrier;
    };
    f.writes.length = 0;
    const finalCall: Action = { type: 'traitorCall', call: false };
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], pending.version, finalCall, clock),
      f.restart().act(f.code, f.seats[1], pending.version, finalCall, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );

    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.battle, null);
    assert.equal(done.lastBattleContext?.result, 'traitor');
    assert.equal(done.lastBattleContext?.winner, 'a');
    assert.equal(done.players[0].spice, 20 + bounty);
    assert.equal(
      done.log.filter(
        (entry) => entry.automatic?.name === 'Spice Banker payment',
      ).length,
      1,
    );
    assert.match(
      done.log.find(
        (entry) => entry.automatic?.name === 'Spice Banker payment',
      )!.text,
      /waived/,
    );
    const writes = f.writes.length;
    await assert.rejects(() =>
      f.restart().act(f.code, f.seats[1], pending.version, finalCall, clock),
    );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('a restored legacy plan without bankerSpice resolves without reserving or paying it', async () => {
  const f = await fixture({ spice: 4 });
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, bankerPlan(), clock);
    const sealed = await f.restart().readRoom(f.code);
    assert.equal('bankerSpice' in sealed.battle!.plans.a, false);

    await f.restart().act(f.code, f.seats[1], sealed.version, guildPlan, clock);
    let state = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        state.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    state = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        state.version,
        { type: 'traitorCall', call: false },
        clock,
      );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].spice, 4);
    assert.ok(
      !done.log.some(
        (entry) => entry.automatic?.name === 'Spice Banker payment',
      ),
    );
  } finally {
    f.sqlite.close();
  }
});
