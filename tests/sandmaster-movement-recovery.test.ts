import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action, Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { gameDistance, location, mobileRouteDistance } from '../game/board';
import type { SandmasterChoice } from '../game/sandmaster-movement';
import { unitStore } from './fixture-nexus-room-store';
import {
  sandmasterMove,
  sandmasterMovementGame,
} from './sandmaster-movement-fixture';
import { placeFixtureHand } from './fixture-hand';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture(detour = false) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Fremen Sandmaster',
    'fremen',
    false,
    [],
  );
  const joined = await store.rooms.joinRoom(
    created.view.code,
    'Guild responder',
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

  const state = sandmasterMovementGame('fremen');
  state.code = code;
  state.version = (await store.rooms.readRoom(code)).version;
  const karama = [
    ...state.deck,
    ...state.discard,
    ...state.players.flatMap((player) => player.hand),
  ].find((card) => card.effect === 'karama')!;
  assert.ok(karama);
  placeFixtureHand(state, 1, [karama]);
  const action = sandmasterMove(state);
  if (detour) {
    const from = 'red_chasm:7';
    const route = [from, 'pasty_mesa:6', 'pasty_mesa:5', 'south_mesa:4'];
    state.spice = { 'pasty_mesa:6': 4, 'south_mesa:4': 4 };
    Object.assign(action, {
      territory: 'south_mesa',
      sector: 4,
      sandmaster: {
        routes: { [from]: route },
        collect: ['pasty_mesa:6', 'south_mesa:4'],
      } satisfies SandmasterChoice,
    });
    assert.equal(mobileRouteDistance(route), 2);
    assert.equal(
      gameDistance(state, from, location('south_mesa', 4), (key) =>
        key.endsWith(`:${state.storm}`),
      ),
      1,
      'The response must be bound to the chosen two-territory route, not only the endpoint distance.',
    );
  }
  sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(state), state.version, code);
  store.writes.length = 0;
  return { ...store, sqlite, code, seats, state, action, karama };
}

function spiceTotal(g: Game) {
  return (
    Object.values(g.spice).reduce((sum, spice) => sum + spice, 0) +
    g.players.reduce((sum, player) => sum + player.spice, 0)
  );
}

function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}

void test('SQLite restart keeps a Fremen Sandmaster route pending and concurrent allowance collects each pile once', async () => {
  const f = await fixture(true);
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, f.action, clock);
    const pending = await f.restart().readRoom(f.code);
    const saved = pending.pendingFremenMove?.order.sandmaster;
    assert.equal(pending.response?.kind, 'fremenMovement');
    assert.ok(saved);
    assert.deepEqual(pending.players[0].forces, f.state.players[0].forces);
    assert.equal(pending.players[0].spice, f.state.players[0].spice);
    assert.deepEqual(pending.spice, f.state.spice);
    assert.equal(spiceTotal(pending), spiceTotal(f.state));

    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.equal(view.response?.kind, 'fremenMovement');
      assert.equal(view.response?.sandmasterProof, undefined);
      assert.equal(
        JSON.stringify(view.response).includes('sandmasterProof'),
        false,
      );
      assert.equal('pendingFremenMove' in view, false);
      const other = view.players.find((player) => player.id !== seat.playerId)!;
      assert.equal('spice' in other, false);
      assert.equal('hand' in other, false);
    }

    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const allow: Action = { type: 'passResponse' };
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], pending.version, allow, clock),
      f.restart().act(f.code, f.seats[1], pending.version, allow, clock),
    ]);
    delete f.hooks.beforeWrite;
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
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.response, null);
    assert.equal(done.players[0].moved, 1);
    assert.equal(
      done.players[0].spice,
      f.state.players[0].spice + saved.collect.length,
    );
    for (const pile of saved.piles)
      assert.equal(done.spice[pile.key] ?? 0, pile.before - 1);
    assert.equal(
      done.log.filter(
        (entry) => entry.automatic?.name === 'Sandmaster collection',
      ).length,
      saved.collect.length,
    );
    assert.equal(spiceTotal(done), spiceTotal(f.state));
  } finally {
    f.sqlite.close();
  }
});

void test('a restored Karama cancellation releases the Fremen Sandmaster route without moving forces or spice', async () => {
  const f = await fixture();
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, f.action, clock);
    const pending = await f.restart().readRoom(f.code);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        pending.version,
        { type: 'card', mode: 'cancel', card: f.karama.id },
        clock,
      );
    const canceled = await f.restart().readRoom(f.code);
    assert.equal(canceled.pendingFremenMove, null);
    assert.equal(canceled.response, null);
    assert.equal(canceled.players[0].moved, 0);
    assert.deepEqual(canceled.players[0].forces, f.state.players[0].forces);
    assert.equal(canceled.players[0].spice, f.state.players[0].spice);
    assert.deepEqual(canceled.spice, f.state.spice);
    assert.deepEqual(canceled.players[0].fremenMovementBlocked, {
      turn: f.state.turn,
      move: 0,
    });
    assert.equal(
      canceled.log.some(
        (entry) => entry.automatic?.name === 'Sandmaster collection',
      ),
      false,
    );
    assert.equal(spiceTotal(canceled), spiceTotal(f.state));
  } finally {
    f.sqlite.close();
  }
});

void test('a restored movement without a Sandmaster selection remains an ordinary movement', async () => {
  const f = await fixture();
  try {
    const { sandmaster: _unused, ...ordinary } = f.action;
    await f.rooms.act(f.code, f.seats[0], f.state.version, ordinary, clock);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.response?.kind, 'fremenMovement');
    assert.equal(pending.pendingFremenMove?.order.sandmaster, undefined);
    await f
      .restart()
      .act(
        f.code,
        f.seats[1],
        pending.version,
        { type: 'passResponse' },
        clock,
      );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].spice, f.state.players[0].spice);
    assert.deepEqual(done.spice, f.state.spice);
    assert.equal(
      done.log.some(
        (entry) => entry.automatic?.name === 'Sandmaster collection',
      ),
      false,
    );
    assert.equal(spiceTotal(done), spiceTotal(f.state));
  } finally {
    f.sqlite.close();
  }
});
