import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  addArrivalTerror,
  arrivalMove,
  arrivalPlayer,
  arrivalReload,
  arrivalResources,
  holdArrivalCard,
  movementArrivalGame,
} from './deferred-movement-arrival-fixture';

const clock: Rooms.RoomsClock = { now: () => 48_000, sleep: async () => {} };
const decline = { type: 'decision', decline: true };
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function snapshot(db: DatabaseSync) {
  return {
    rooms: db.prepare('SELECT * FROM rooms ORDER BY code').all(),
    seats: db.prepare('SELECT * FROM seats ORDER BY player_id').all(),
  };
}
async function fixture(t: test.TestContext) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  let game = movementArrivalGame('tleilaxu', 'ambassador');
  for (const player of game.players) player.hand.push(game.deck.shift()!);
  const card = holdArrivalCard(game, 'tleilaxu', 'Ornithopter');
  game = applyAction(game, 'tleilaxu', {
    ...arrivalMove(game),
    movementCard: card,
    ornithopter: 'range3',
  });
  assert.equal(game.decision?.kind, 'choamMovement');
  // Restore the checkpoint's legacy topology after its genuine unspent declaration.
  addArrivalTerror(game);
  game.version = 31;
  const pending = arrivalReload(game),
    code = game.code;
  store.sqlite
    .prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
    .run(code, JSON.stringify(pending), pending.version, 47_000);
  const tokens = Object.fromEntries(
    pending.players.map((player) => [
      player.id,
      hash(`deferred-movement-test:${player.id}`),
    ]),
  );
  for (const player of pending.players)
    store.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run(hash(tokens[player.id]), code, player.id);
  const auths: Record<string, Rooms.SeatAuth> = {};
  for (const [id, token] of Object.entries(tokens)) {
    auths[id] = await store.rooms.authenticate(code, token);
    assert.equal(auths[id].playerId, id);
  }
  return { ...store, code, tokens, auths, pending, card };
}
async function privateViews(
  f: Awaited<ReturnType<typeof fixture>>,
  game: Game,
) {
  const restarted = f.restart(),
    before = snapshot(f.sqlite);
  for (const [id, token] of Object.entries(f.tokens)) {
    const auth = await restarted.authenticate(f.code, token);
    const view = await restarted.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(game, id));
    for (const other of view.players.filter((player) => player.id !== id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.faceDancers, undefined);
    }
    if (id !== 'moritani')
      assert.ok(
        view.moritaniTerror!.tokens.every((token) => !('kind' in token)),
      );
    assert.equal('pendingChoamMove' in view, false);
  }
  assert.deepEqual(snapshot(f.sqlite), before);
}

void test('authenticated saved CHOAM decline persists an unspent return and restores every private seat and reserved movement card', async (t) => {
  const f = await fixture(t),
    before = snapshot(f.sqlite),
    resources = structuredClone(arrivalResources(f.pending));
  await privateViews(f, f.pending);
  await assert.rejects(
    f.rooms.act(f.code, f.auths.tleilaxu, f.pending.version, decline, clock),
    /pending decision/,
  );
  await assert.rejects(
    f.rooms.act(f.code, f.auths.choam, f.pending.version - 1, decline, clock),
    /table changed/,
  );
  await assert.rejects(
    f.rooms.act(
      f.code,
      f.auths.choam,
      f.pending.version,
      { type: 'decision', decline: false },
      clock,
    ),
    /Allow the movement/,
  );
  assert.deepEqual(snapshot(f.sqlite), before);
  assert.equal(f.writes.length, 0);

  const restarted = f.restart();
  const auth = await restarted.authenticate(f.code, f.tokens.choam);
  await restarted.act(f.code, auth, f.pending.version, decline, clock);
  const returned = await f.restart().readRoom(f.code);
  assert.equal(returned.version, f.pending.version + 1);
  assert.deepEqual(arrivalResources(returned), resources);
  assert.equal(returned.pendingChoamMove, null);
  assert.equal(returned.decision, null);
  assert.equal(returned.active, 'tleilaxu');
  assert.equal(arrivalPlayer(returned, 'tleilaxu').moved, 0);
  assert.deepEqual(returned.ornithopter, f.pending.ornithopter);
  assert.equal(returned.ornithopter!.card.id, f.card);
  assert.equal(
    returned.discard.some((card) => card.id === f.card),
    false,
  );
  assert.equal(
    arrivalPlayer(returned, 'tleilaxu').hand.some((card) => card.id === f.card),
    false,
  );
  assert.match(
    returned.log.at(-1)!.text,
    /Ambassadors combined with another arrival reaction/,
  );
  assert.deepEqual(
    f.writes.map((write) => write.changes),
    [1],
  );
  await privateViews(f, returned);

  const saved = snapshot(f.sqlite);
  await assert.rejects(
    f.rooms.act(f.code, f.auths.choam, f.pending.version, decline, clock),
    /table changed/,
  );
  await assert.rejects(
    f.rooms.act(f.code, f.auths.choam, returned.version, decline, clock),
  );
  assert.deepEqual(snapshot(f.sqlite), saved);
  assert.equal(f.writes.length, 1);

  await f.restart().act(
    f.code,
    f.auths.tleilaxu,
    returned.version,
    {
      type: 'move',
      forces: { 'arrakeen:10': 3 },
      territory: 'imperial_basin',
      sector: 10,
      ornithopterEvent: returned.ornithopter!.event,
    },
    clock,
  );
  const moved = await f.restart().readRoom(f.code);
  assert.equal(moved.version, returned.version + 1);
  assert.equal(arrivalPlayer(moved, 'tleilaxu').moved, 1);
  assert.deepEqual(arrivalPlayer(moved, 'tleilaxu').forces, {
    'imperial_basin:10': 3,
  });
  assert.equal(moved.ornithopter, null);
  assert.equal(moved.discard.filter((card) => card.id === f.card).length, 1);
  await privateViews(f, moved);
});

void test('concurrent authenticated declines of the same saved version commit the unspent return exactly once', async (t) => {
  const f = await fixture(t),
    resources = structuredClone(arrivalResources(f.pending));
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await wait;
  };
  const restarted = f.restart(),
    otherAuth = await restarted.authenticate(f.code, f.tokens.choam);
  const attempts = await Promise.allSettled([
    f.rooms.act(f.code, f.auths.choam, f.pending.version, decline, clock),
    restarted.act(f.code, otherAuth, f.pending.version, decline, clock),
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
  assert.deepEqual(f.writes.map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
  assert.ok(f.writes.every((write) => write.expected === f.pending.version));
  const returned = await f.restart().readRoom(f.code);
  assert.equal(returned.version, f.pending.version + 1);
  assert.deepEqual(arrivalResources(returned), resources);
  assert.equal(returned.pendingChoamMove, null);
  assert.equal(returned.decision, null);
  assert.equal(
    returned.log.filter((entry) =>
      entry.text.includes('uncommitted movement returned for another choice'),
    ).length,
    1,
  );
  assert.deepEqual(returned.ornithopter, f.pending.ornithopter);
  assert.equal(returned.discard.filter((card) => card.id === f.card).length, 0);
  await privateViews(f, returned);
  const saved = snapshot(f.sqlite);
  await assert.rejects(
    f.rooms.act(f.code, f.auths.choam, f.pending.version, decline, clock),
    /table changed/,
  );
  await assert.rejects(
    f.rooms.act(f.code, f.auths.choam, returned.version, decline, clock),
  );
  assert.deepEqual(snapshot(f.sqlite), saved);
});
