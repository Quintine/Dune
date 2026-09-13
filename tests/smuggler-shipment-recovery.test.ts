import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { richeseCards } from '../game/richese-cards';
import { unitStore } from './fixture-nexus-room-store';
import { smugglerShipmentGame } from './smuggler-shipment-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture(card: 'box' | 'karama' | null = null, ownerSpice = 3) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Smuggler',
    'emperor',
    false,
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
      .run(index === 0 ? 'p' : 'h', code, seat.playerId);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const state = smugglerShipmentGame('emperor', true);
  state.code = code;
  state.version = (await store.rooms.readRoom(code)).version;
  state.players[0].spice = ownerSpice;
  state.players[1].spice = 10;
  let stagedCard = null;
  if (card === 'box') {
    stagedCard = richeseCards().find(
      (candidate) => candidate.effect === 'nullentropyBox',
    )!;
    state.players[0].hand.push(stagedCard);
    state.discard.push(...state.deck.splice(0, 4));
  } else if (card === 'karama') {
    const index = state.deck.findIndex(
      (candidate) => candidate.effect === 'karama',
    );
    assert.ok(index >= 0);
    stagedCard = state.deck.splice(index, 1)[0];
    state.players[1].hand.push(stagedCard);
  }
  sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(state), state.version, code);
  store.writes.length = 0;
  return { ...store, sqlite, code, seats, state, stagedCard };
}

async function declare(
  f: Awaited<ReturnType<typeof fixture>>,
  smuggler: boolean | undefined,
) {
  const action: Action = {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
    elite: 2,
    ...(smuggler === undefined ? {} : { smuggler }),
  };
  await f.restart().act(f.code, f.seats[0], f.state.version, action, clock);
  return f.restart().readRoom(f.code);
}

void test('SQLite restart preserves a Smuggler quote and concurrent Guild allows commit it once', async () => {
  const f = await fixture();
  try {
    const pending = await declare(f, true);
    assert.equal(pending.decision?.kind, 'guildShipment');
    assert.equal(pending.decision?.player, 'h');
    assert.deepEqual(pending.pendingShipment?.smuggler, {
      leader: pending.leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'p',
      )!.leader,
      amount: 3,
    });
    assert.equal(pending.pendingShipment?.cost, 2);
    assert.equal(pending.players[0].spice, 3);
    assert.equal(pending.players[0].reserves, 20);

    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.decision, pending.decision);
      assert.equal('pendingShipment' in view, false);
      const other = view.players.find((player) => player.id !== seat.playerId)!;
      assert.equal('spice' in other, false);
      assert.equal('hand' in other, false);
    }

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
    const allow: Action = { type: 'decision', allow: true };
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], pending.version, allow, clock),
      f.restart().act(f.code, f.seats[1], pending.version, allow, clock),
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
    assert.equal(done.pendingShipment, null);
    assert.equal(done.decision, null);
    assert.equal(done.players[0].spice, 1);
    assert.equal(done.players[0].reserves, 17);
    assert.equal(done.players[0].elites!.reserves, 3);
    assert.equal(done.players[0].forces['arrakeen:10'], 3);
    assert.equal(done.players[0].elites!.forces['arrakeen:10'], 2);
    assert.equal(done.players[1].spice, 12);
    assert.equal(
      done.log.filter((entry) => entry.automatic?.name === 'Smuggler shipment')
        .length,
      1,
    );
    const writes = f.writes.length;
    await assert.rejects(() =>
      f.restart().act(f.code, f.seats[1], pending.version, allow, clock),
    );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('a restored shipment without the new Smuggler stamp retains its full quoted price', async () => {
  const f = await fixture();
  try {
    const pending = await declare(f, undefined);
    assert.equal(pending.decision?.kind, 'guildShipment');
    assert.equal(pending.pendingShipment?.smuggler, undefined);
    assert.equal(pending.pendingShipment?.cost, 3);
    delete pending.pendingShipment!.turn;
    f.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(pending), pending.version, f.code);
    const restored = await f.restart().readRoom(f.code);
    assert.equal(restored.pendingShipment?.turn, undefined);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        restored.version,
        { type: 'decision', allow: true },
        clock,
      );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].spice, 0);
    assert.equal(done.players[0].reserves, 17);
    assert.equal(done.players[1].spice, 13);
    assert.ok(
      !done.log.some((entry) => entry.automatic?.name === 'Smuggler shipment'),
    );
  } finally {
    f.sqlite.close();
  }
});

void test('a paid Box search can suspend and restore the saved Guild decision before shipment', async () => {
  const f = await fixture('box', 5);
  try {
    const pending = await declare(f, true);
    const source = structuredClone(pending.pendingShipment);
    await f
      .restart()
      .act(
        f.code,
        f.seats[0],
        pending.version,
        { type: 'card', card: f.stagedCard!.id },
        clock,
      );
    const searching = await f.restart().readRoom(f.code);
    assert.equal(searching.decision?.kind, 'nullentropy');
    assert.equal(
      searching.pendingNullentropy?.resume.decision?.kind,
      'guildShipment',
    );
    assert.deepEqual(searching.pendingShipment, source);
    assert.equal(searching.players[0].spice, 3);
    assert.equal(searching.players[0].reserves, 20);
    for (const seat of f.seats) await f.restart().readSeatView(f.code, seat);

    await f.restart().act(
      f.code,
      f.seats[0],
      searching.version,
      {
        type: 'decision',
        event: searching.pendingNullentropy!.event,
        card: searching.discard[0].id,
      },
      clock,
    );
    const restored = await f.restart().readRoom(f.code);
    assert.equal(restored.pendingNullentropy, null);
    assert.equal(restored.decision?.kind, 'guildShipment');
    assert.deepEqual(restored.pendingShipment, source);
    assert.equal(restored.players[0].reserves, 20);

    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        restored.version,
        { type: 'decision', allow: true },
        clock,
      );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.pendingShipment, null);
    assert.equal(done.players[0].spice, 1);
    assert.equal(done.players[0].reserves, 17);
    assert.equal(done.players[1].spice, 12);
    assert.equal(
      done.log.filter((entry) => entry.automatic?.name === 'Smuggler shipment')
        .length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('Guild cancellation survives restart without charging or moving the Smuggler shipment', async () => {
  const f = await fixture('karama');
  try {
    const pending = await declare(f, true);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        pending.version,
        { type: 'card', mode: 'special', card: f.stagedCard!.id },
        clock,
      );
    const stopped = await f.restart().readRoom(f.code);
    assert.equal(stopped.version, pending.version + 1);
    assert.equal(stopped.pendingShipment, null);
    assert.equal(stopped.decision, null);
    assert.equal(stopped.players[0].shipped, true);
    assert.equal(stopped.players[0].spice, 3);
    assert.equal(stopped.players[0].reserves, 20);
    assert.equal(stopped.players[0].forces['arrakeen:10'], undefined);
    assert.equal(stopped.players[1].spice, 10);
    assert.ok(stopped.discard.some((card) => card.id === f.stagedCard!.id));
    assert.ok(
      !stopped.log.some(
        (entry) => entry.automatic?.name === 'Smuggler shipment',
      ),
    );
    const writes = f.writes.length;
    await assert.rejects(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          pending.version,
          { type: 'card', mode: 'special', card: f.stagedCard!.id },
          clock,
        ),
    );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), stopped);
  } finally {
    f.sqlite.close();
  }
});
