import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { placeFixtureHand } from './fixture-hand';
import {
  conserveNoFieldForces,
  smugglerNoFieldAction,
  smugglerNoFieldGame,
} from './smuggler-no-field-fixture';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture(advanced = false, canceler: 'h' | 'g' | null = null) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Richese Smuggler',
    'richese',
    advanced,
    ['choam'],
  );
  const joined = await store.rooms.joinRoom(
    created.view.code,
    'Harkonnen',
    'harkonnen',
  );
  const guild = await store.rooms.joinRoom(created.view.code, 'Guild', 'guild');
  const code = created.view.code;
  const tokens = [created.token!, joined.token!, guild.token!];
  const original = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  for (const [index, seat] of original.entries())
    sqlite
      .prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?')
      .run(['r', 'h', 'g'][index], code, seat.playerId);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );

  const state = smugglerNoFieldGame(advanced);
  state.code = code;
  state.version = (await store.rooms.readRoom(code)).version;
  let karama = null;
  if (canceler) {
    karama = [
      ...state.deck,
      ...state.discard,
      ...state.players.flatMap((player) => player.hand),
    ].find((card) => card.effect === 'karama')!;
    assert.ok(karama);
    placeFixtureHand(state, canceler === 'h' ? 1 : 2, [karama]);
  }
  const action = smugglerNoFieldAction(state);
  sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(state), state.version, code);
  store.writes.length = 0;
  return { ...store, sqlite, code, seats, state, action, karama };
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

function committedOnce(
  results: PromiseSettledResult<unknown>[],
  writes: { changes: number }[],
) {
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === 'rejected').length,
    1,
  );
  assert.deepEqual(
    writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
}

void test('restart preserves the concealed companion through the No-Field and Guild stages, then concurrent allowance commits it once', async () => {
  const f = await fixture(true, 'g');
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, f.action, clock);
    const initial = await f.restart().readRoom(f.code);
    assert.equal(initial.response?.kind, 'richeseNoField');
    assert.deepEqual(initial.pendingShipment?.smugglerCompanion, {
      leader: initial.leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'r',
      )!.leader,
      amount: 1,
    });
    assert.equal(initial.pendingShipment?.amount, 1);
    assert.equal(initial.pendingShipment?.cost, 1);
    assert.equal(initial.players[0].reserves, 20);
    assert.deepEqual(initial.players[0].forces, {});
    assert.equal(initial.players[0].noField!.deployed, null);

    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.equal(JSON.stringify(view).includes('noFieldSkillProof'), false);
      assert.equal('pendingShipment' in view, false);
      if (seat.playerId !== 'r')
        assert.equal(
          JSON.stringify(view).includes(String(f.action.noField)),
          false,
        );
    }

    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const passes = await Promise.allSettled([
      f.rooms.act(
        f.code,
        f.seats[2],
        initial.version,
        { type: 'passResponse' },
        clock,
      ),
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          initial.version,
          { type: 'passResponse' },
          clock,
        ),
    ]);
    delete f.hooks.beforeWrite;
    committedOnce(passes, f.writes);

    const guildDecision = await f.restart().readRoom(f.code);
    assert.equal(guildDecision.decision?.kind, 'guildShipment');
    assert.deepEqual(
      guildDecision.pendingShipment?.smugglerCompanion,
      initial.pendingShipment?.smugglerCompanion,
    );
    assert.equal(guildDecision.players[0].reserves, 20);
    assert.deepEqual(guildDecision.players[0].forces, {});
    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.equal(
        JSON.stringify(view.decision).includes('noFieldSkillProof'),
        false,
      );
    }

    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const allow: Action = { type: 'decision', allow: true };
    const allowances = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[2], guildDecision.version, allow, clock),
      f.restart().act(f.code, f.seats[2], guildDecision.version, allow, clock),
    ]);
    delete f.hooks.beforeWrite;
    committedOnce(allowances, f.writes);

    const shipped = await f.restart().readRoom(f.code);
    assert.equal(shipped.pendingShipment, null);
    assert.equal(shipped.decision, null);
    assert.equal(shipped.players[0].reserves, 19);
    assert.equal(shipped.players[0].forces['arrakeen:10'], 1);
    assert.equal(shipped.players[0].spice, 9);
    assert.equal(shipped.players[2].spice, 11);
    assert.equal(
      shipped.log.filter(
        (entry) => entry.automatic?.name === 'No-Field shipment',
      ).length,
      1,
    );
    conserveNoFieldForces(shipped);

    await f.restart().act(
      f.code,
      f.seats[0],
      shipped.version,
      {
        type: 'revealNoField',
        event: shipped.players[0].noFieldEvent,
        token: shipped.players[0].noField!.deployed!.tokenId,
      },
      clock,
    );
    const revealed = await f.restart().readRoom(f.code);
    assert.equal(revealed.players[0].reserves, 14);
    assert.equal(revealed.players[0].forces['arrakeen:10'], 6);
    conserveNoFieldForces(revealed);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent restored No-Field cancellation leaves the marker and companion in reserve custody', async () => {
  const f = await fixture(false, 'h');
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, f.action, clock);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.response?.kind, 'richeseNoField');
    const cancel: Action = {
      type: 'card',
      mode: 'cancel',
      card: f.karama!.id,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const cancellations = await Promise.allSettled([
      f.rooms.act(f.code, f.seats[1], pending.version, cancel, clock),
      f.restart().act(f.code, f.seats[1], pending.version, cancel, clock),
    ]);
    delete f.hooks.beforeWrite;
    committedOnce(cancellations, f.writes);

    const canceled = await f.restart().readRoom(f.code);
    assert.equal(canceled.pendingShipment, null);
    assert.equal(canceled.response, null);
    assert.equal(canceled.players[0].reserves, 20);
    assert.deepEqual(canceled.players[0].forces, {});
    assert.equal(canceled.players[0].spice, 10);
    assert.equal(canceled.players[0].shipped, false);
    assert.equal(canceled.players[0].noField!.deployed, null);
    assert.equal(canceled.players[0].noField!.lastShipped, null);
    assert.equal(
      canceled.discard.filter((card) => card.id === f.karama!.id).length,
      1,
    );
    conserveNoFieldForces(canceled);
  } finally {
    f.sqlite.close();
  }
});

void test('restored Guild cancellation consumes the shipment opportunity without withdrawing the companion', async () => {
  const f = await fixture(true, 'g');
  try {
    await f.rooms.act(f.code, f.seats[0], f.state.version, f.action, clock);
    let pending = await f.restart().readRoom(f.code);
    assert.equal(pending.response?.kind, 'richeseNoField');
    await f
      .restart()
      .act(
        f.code,
        f.seats[2],
        pending.version,
        { type: 'passResponse' },
        clock,
      );
    pending = await f.restart().readRoom(f.code);
    assert.equal(pending.decision?.kind, 'guildShipment');
    assert.equal(pending.players[0].reserves, 20);
    await f.restart().act(
      f.code,
      f.seats[2],
      pending.version,
      {
        type: 'card',
        mode: 'special',
        card: f.karama!.id,
        target: 'r',
      },
      clock,
    );
    const canceled = await f.restart().readRoom(f.code);
    assert.equal(canceled.pendingShipment, null);
    assert.equal(canceled.decision, null);
    assert.equal(canceled.players[0].reserves, 20);
    assert.deepEqual(canceled.players[0].forces, {});
    assert.equal(canceled.players[0].spice, 10);
    assert.equal(canceled.players[0].shipped, true);
    assert.equal(canceled.players[0].noField!.deployed, null);
    assert.equal(canceled.players[0].noField!.lastShipped, null);
    assert.equal(canceled.players[2].specialKaramaUsed, true);
    assert.equal(
      canceled.discard.filter((card) => card.id === f.karama!.id).length,
      1,
    );
    conserveNoFieldForces(canceled);
  } finally {
    f.sqlite.close();
  }
});

void test('a restored No-Field declaration without the Smuggler flag retains legacy token-only custody', async () => {
  const f = await fixture();
  try {
    const { smuggler: _unused, ...legacy } = f.action;
    await f.rooms.act(f.code, f.seats[0], f.state.version, legacy, clock);
    const shipped = await f.restart().readRoom(f.code);
    assert.equal(shipped.pendingShipment, null);
    assert.equal(shipped.players[0].reserves, 20);
    assert.deepEqual(shipped.players[0].forces, {});
    assert.equal(shipped.players[0].spice, 9);
    assert.ok(shipped.players[0].noField!.deployed);
    assert.equal(
      shipped.log.some((entry) => entry.text.includes('free Smuggler force')),
      false,
    );
    conserveNoFieldForces(shipped);
  } finally {
    f.sqlite.close();
  }
});
