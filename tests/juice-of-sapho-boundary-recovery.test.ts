import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import * as engine from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const SAPHO = 'richese-juice-of-sapho';
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

function barrier() {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}

function physical(g: engine.Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
    ...(g.ixAuction?.cards ?? []),
  ]
    .map((card) => card.id)
    .sort();
}

function persist(sqlite: DatabaseSync, code: string, g: engine.Game) {
  sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
}

void test('a completed combined turn survives a concurrent persisted Sapho first claim at the next clean boundary', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom(
      'Completed A',
      'atreides',
      false,
      [],
    );
    const code = made.view.code;
    const joinedB = await store.rooms.joinRoom(code, 'Fresh B', 'emperor');
    const joinedC = await store.rooms.joinRoom(code, 'Sapho C', 'guild');
    const seats = await Promise.all(
      [made.token, joinedB.token!, joinedC.token!].map((token) =>
        store.rooms.authenticate(code, token),
      ),
    );
    const [a, b, c] = seats.map((seat) => seat.playerId);

    let staged = await store.rooms.readRoom(code);
    for (const player of staged.players) player.ready = true;
    staged = engine.applyAction(staged, a, { type: 'start' });
    for (const player of staged.players)
      if (player.traitorChoices.length)
        staged = engine.applyAction(staged, player.id, {
          type: 'traitor',
          leader: player.traitorChoices[0],
        });

    Object.assign(staged, {
      turn: 2,
      phase: 4,
      storm: 18,
      order: [a, b, c],
      ready: [],
      active: null,
      response: null,
      decision: null,
      phaseOpening: null,
      advanced: false,
      deck: baseDeck(),
      discard: [],
      richeseCache: richeseCards(),
      richeseRemoved: [],
    });
    for (const player of staged.players) {
      player.hand = [];
      player.spice = 20;
      player.forces = {};
      player.reserves = 20;
      player.shipped = false;
      player.moved = 0;
    }
    const saphoAt = staged.richeseCache!.findIndex(
      (card) => card.id === SAPHO,
    );
    assert.ok(saphoAt >= 0);
    staged.players.find((player) => player.id === c)!.hand.push(
      staged.richeseCache!.splice(saphoAt, 1)[0],
    );
    const shieldAt = staged.deck.findIndex((card) => card.name === 'Shield');
    assert.ok(shieldAt >= 0);
    staged.players.find((player) => player.id === a)!.hand.push(
      staged.deck.splice(shieldAt, 1)[0],
    );
    persist(store.sqlite, code, staged);

    async function act(index: number, action: engine.Action) {
      const current = await store.restart().readRoom(code);
      await store
        .restart()
        .act(code, seats[index], current.version, action, clock);
      return store.restart().readRoom(code);
    }

    for (const index of [0, 1, 2]) await act(index, { type: 'ready' });
    let game = await store.restart().readRoom(code);
    assert.equal(game.phase, 5);
    assert.equal(game.active, a);
    assert.deepEqual(game.movementRemaining, [a, b, c]);

    game = await act(0, {
      type: 'ship',
      territory: 'polar_sink',
      sector: 0,
      amount: 2,
    });
    assert.equal(game.players.find((player) => player.id === a)!.shipped, true);
    game = await act(0, { type: 'endMovement' });
    assert.equal(game.active, b);
    assert.deepEqual(game.movementRemaining, [b, c]);

    const completedA = structuredClone(
      game.players.find((player) => player.id === a)!,
    );
    assert.equal(completedA.spice, 16);
    assert.equal(completedA.reserves, 18);
    assert.equal(completedA.forces['polar_sink:0'], 2);
    assert.equal(completedA.hand.length, 1);
    assert.equal(game.players.find((player) => player.id === b)!.shipped, false);
    assert.equal(game.players.find((player) => player.id === b)!.moved, 0);
    const physicalBefore = physical(game);
    assert.equal(physicalBefore.filter((id) => id === SAPHO).length, 1);
    const event = `movement:${game.turn}`;
    for (const [index, seat] of seats.entries()) {
      const view = await store.restart().readSeatView(code, seat);
      assert.deepEqual(
        view.saphoOptions,
        index === 2 ? [{ scope: 'movement', event, mode: 'first' }] : [],
      );
      for (const opponent of view.players.filter(
        (player) => player.id !== seat.playerId,
      ))
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in opponent, false, `Other seat disclosed ${key}`);
      if (index !== 2)
        assert.equal(JSON.stringify(view).includes(SAPHO), false);
    }

    const request: engine.Action = {
      type: 'card',
      card: SAPHO,
      scope: 'movement',
      event,
      mode: 'first',
    };
    store.writes.length = 0;
    store.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      store.rooms.act(code, seats[2], game.version, request, clock),
      store.restart().act(code, seats[2], game.version, request, clock),
    ]);
    store.hooks.beforeWrite = undefined;
    assert.equal(
      attempts.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      attempts.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      store.writes.map((write) => write.changes).sort((x, y) => x - y),
      [0, 1],
    );

    const after = await store.restart().readRoom(code);
    assert.equal(after.version, game.version + 1);
    assert.equal(after.active, c);
    assert.deepEqual(after.movementRemaining, [c, b]);
    assert.deepEqual(after.order, [a, b, c]);
    assert.deepEqual(
      after.players.find((player) => player.id === a),
      completedA,
      'Sapho must not replay or undo A\'s completed shipment and custody.',
    );
    assert.equal(
      after.players
        .find((player) => player.id === c)!
        .hand.some((card) => card.id === SAPHO),
      false,
    );
    assert.equal(after.discard.filter((card) => card.id === SAPHO).length, 1);
    assert.deepEqual(physical(after), physicalBefore);
    assert.equal(
      after.log.filter((entry) =>
        entry.text.includes('discarded Juice of Sapho'),
      ).length,
      1,
    );

    const writes = store.writes.length;
    await assert.rejects(
      store.restart().act(code, seats[2], after.version, request, clock),
    );
    assert.equal(store.writes.length, writes);
    assert.deepEqual(await store.restart().readRoom(code), after);
  } finally {
    store.hooks.beforeWrite = undefined;
    store.sqlite.close();
  }
});
