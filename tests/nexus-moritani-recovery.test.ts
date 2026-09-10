import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import { viewGame, type Game, type Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import {
  nexusMoritaniFixture,
  nexusMoritaniRequest,
  nexusMoritaniToken,
  nexusMoritaniInventory,
  nexusMoritaniMovement,
} from './fixture-nexus-moritani';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture() {
  const store = unitStore(),
    made = await store.rooms.createRoom('Moritani SQL', 'moritani', false, []),
    code = made.view.code,
    tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
      tokens.map((token) => store.rooms.authenticate(code, token)),
    ),
    ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const f = nexusMoritaniFixture({
    seatIds: ids,
    stack: true,
    homeworlds: true,
  });
  f.g.code = code;
  f.g.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(f.g);
  store.writes.length = 0;
  return { ...store, ...f, code, tokens, auths, ids, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
async function act(f: Fixture, seat: number, action: Action) {
  const g = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[seat], g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token),
      v = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(v, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(v, 'nexusMoritaniHistory'), false);
    if (i !== 0) {
      assert.equal(v.nexusMoritani, null);
      for (const token of v.moritaniTerror!.tokens.filter(
        (t) => t.status === 'placed',
      ))
        assert.equal('kind' in token, false);
    }
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusMoritaniInventory(g);
}
void test('SQLite lost acknowledgment restores hidden supply placement and preserves genuine Grumman history after allowance or cancellation', async () => {
  for (const canceled of [false, true])
    for (const territory of [
      'red_chasm',
      'sihaya_ridge',
      'polar_sink',
      'arrakeen',
    ]) {
      const f = await fixture();
      try {
        const request = nexusMoritaniRequest(f, 'robbery', territory),
          source = structuredClone(f.g.moritaniTerror),
          grumman = structuredClone(f.g.grummanCollection);
        await f.rooms.act(f.code, f.auths[0], f.g.version, request, clock);
        const pending = await f.restart().readRoom(f.code);
        assert.equal(pending.nexusMoritaniLast?.stage, 'pending');
        assert.deepEqual(pending.moritaniTerror, source);
        await restored(f, pending);
        const done = await act(
          f,
          1,
          canceled
            ? { type: 'card', mode: 'cancel', card: f.karama }
            : { type: 'passResponse' },
        );
        assert.equal(
          done.nexusMoritaniLast?.stage,
          canceled ? 'canceled' : 'complete',
        );
        assert.equal(done.nexusMoritaniHistory!.length, 1);
        assert.equal(
          nexusMoritaniToken(done, 'robbery').status,
          canceled ? 'available' : 'placed',
        );
        assert.equal(
          nexusMoritaniToken(done, 'robbery').location,
          canceled ? null : territory,
        );
        assert.equal(done.moritaniTerror!.placementTurn, done.turn);
        assert.deepEqual(done.grummanCollection, grumman);
        assert.equal(done.players[0].spice, 20);
        assert.equal(
          done.nexusCards!.cards!.discard.filter((card) => card === 'moritani')
            .length,
          1,
        );
        await restored(f, done);
        const before = row(f);
        await assert.rejects(
          f.restart().act(f.code, f.auths[0], done.version, request, clock),
        );
        assert.deepEqual(row(f), before);
      } finally {
        f.sqlite.close();
      }
    }
});
async function compete(
  f: Fixture,
  seat: number,
  version: number,
  actions: Action[],
) {
  let arrivals = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  const timer = setTimeout(release, 2000);
  const results = await Promise.allSettled(
    actions.map((action) =>
      f.restart().act(f.code, f.auths[seat], version, action, clock),
    ),
  );
  clearTimeout(timer);
  delete f.hooks.beforeWrite;
  assert.equal(arrivals, 2);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  return f.restart().readRoom(f.code);
}
void test('SQLite concurrent Moritani declarations and competing final Karama/pass each commit exactly once', async () => {
  const f = await fixture();
  try {
    const request = nexusMoritaniRequest(f),
      pending = await compete(f, 0, f.g.version, [request, request]);
    assert.equal(pending.version, f.g.version + 1);
    assert.equal(pending.nexusMoritaniHistory!.length, 1);
    assert.equal(nexusMoritaniToken(pending, 'robbery').status, 'available');
    await restored(f, pending);
    f.writes.length = 0;
    const done = await compete(f, 1, pending.version, [
      { type: 'passResponse' },
      { type: 'card', mode: 'cancel', card: f.karama },
    ]);
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.nexusMoritaniHistory!.length, 1);
    const canceled = done.nexusMoritaniLast!.stage === 'canceled';
    assert.equal(
      nexusMoritaniToken(done, 'robbery').status,
      canceled ? 'available' : 'placed',
    );
    assert.equal(
      done.discard.filter((c) => c.id === f.karama).length,
      canceled ? 1 : 0,
    );
    assert.equal(
      done.nexusCards!.cards!.discard.filter((c) => c === 'moritani').length,
      1,
    );
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});
void test('SQLite damaged Moritani original supply, target, response or completion proof rejects both settlement choices and every private read without writes', async () => {
  const f = await fixture();
  try {
    const pending = await act(f, 0, nexusMoritaniRequest(f));
    const changes: ((g: Game) => void)[] = [
      (g) => {
        g.pendingMoritaniPlacement!.token = 'unknown';
      },
      (g) => {
        g.pendingMoritaniPlacement!.territory = 'sihaya_ridge';
      },
      (g) => {
        g.pendingMoritaniPlacement!.turn++;
      },
      (g) => {
        g.pendingMoritaniPlacement!.nexusEvent = 'changed';
      },
      (g) => {
        g.response!.owner = f.target;
      },
      (g) => {
        g.response = null;
      },
      (g) => {
        g.moritaniTerror!.tokens[0].id = g.moritaniTerror!.tokens[1].id;
      },
      (g) => {
        nexusMoritaniToken(g, 'robbery').status = 'removed';
      },
      (g) => {
        g.nexusMoritaniHistory![0].stage = 'complete';
      },
      (g) => {
        delete g.nexusMoritaniLast;
      },
      (g) => {
        delete g.nexusMoritaniHistory;
      },
      (g) => {
        g.nexusMoritaniHistory![0].before = '{}';
      },
    ];
    for (const [index, change] of changes.entries()) {
      const bad = structuredClone(pending);
      change(bad);
      f.save(bad);
      f.writes.length = 0;
      const before = row(f);
      for (const action of [
        { type: 'passResponse' },
        { type: 'card', mode: 'cancel', card: f.karama },
      ] as Action[])
        await assert.rejects(
          f.restart().act(f.code, f.auths[1], bad.version, action, clock),
          `mutation ${index}`,
        );
      for (const auth of f.auths)
        await assert.rejects(
          f.restart().readSeatView(f.code, auth),
          `read mutation ${index}`,
        );
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
void test('SQLite later nonstronghold entry preserves the original Nexus placement proof through reveal, private choice and replay rejection', async () => {
  const f = await fixture();
  try {
    await act(f, 0, nexusMoritaniRequest(f, 'robbery', 'sihaya_ridge'));
    const placed = await act(f, 1, { type: 'passResponse' });
    // Complete genuine phase boundaries, then persist before the real SQL shipment.
    // No original receipt or seat identity is rewritten.
    const movement = nexusMoritaniMovement(placed);
    f.save(movement);
    f.writes.length = 0;
    const arrival = await act(f, 1, {
      type: 'ship',
      territory: 'sihaya_ridge',
      sector: 9,
      amount: 3,
    });
    assert.equal(arrival.pendingTerrorEntry?.stage, 'offer');
    await restored(f, arrival);
    const original = JSON.stringify(arrival.pendingTerrorEntry);
    const revealed = await act(f, 0, { type: 'decision', reveal: true });
    assert.equal(revealed.pendingTerrorEntry?.stage, 'robbery');
    await restored(f, revealed);
    const beforeSpice = revealed.players[0].spice,
      taken = Math.ceil(revealed.players[1].spice / 2);
    const done = await act(f, 0, { type: 'decision', choice: 'spice' });
    assert.equal(done.players[0].spice, beforeSpice + taken);
    assert.equal(done.pendingTerrorEntry, null);
    assert.equal(done.nexusMoritaniLast?.stage, 'complete');
    await restored(f, done);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[0],
          done.version,
          { type: 'decision', choice: 'spice' },
          clock,
        ),
    );
    assert.deepEqual(row(f), before);
    const bad = structuredClone(arrival);
    bad.pendingTerrorEntry!.territory = 'red_chasm';
    assert.notEqual(JSON.stringify(bad.pendingTerrorEntry), original);
    f.save(bad);
    f.writes.length = 0;
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[0],
          bad.version,
          { type: 'decision', reveal: true },
          clock,
        ),
    );
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});
