import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import {
  NEXUS_CHOAM_EFFECTS,
  nexusChoamFixture,
  nexusChoamRequest,
  nexusChoamInventory,
  type NexusChoamEffect,
} from './fixture-nexus-choam';
import { applyAction, viewGame, type Game, type Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(effect: NexusChoamEffect) {
  const store = unitStore(),
    made = await store.rooms.createRoom('CHOAM SQL', 'harkonnen', false, []),
    code = made.view.code,
    tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const f = nexusChoamFixture(effect, { seatIds: ids });
  f.g.code = code;
  f.g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(f.g), f.g.version, code);
  store.writes.length = 0;
  return { ...store, ...f, code, tokens, auths, ids };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token),
      v = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(v, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(v, 'nexusChoamHistory'), false);
    if (i !== 0) assert.equal(v.choamWorthless, null);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusChoamInventory(g);
}
async function act(f: Fixture, seat: number, action: Action) {
  const g = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[seat], g.version, action, clock);
  return f.restart().readRoom(f.code);
}
void test('SQLite all five CHOAM Nexus effects recover private pending payment and settle each allowed/canceled parent once', async () => {
  for (const effect of NEXUS_CHOAM_EFFECTS)
    for (const cancel of [false, true]) {
      const f = await fixture(effect);
      try {
        // Drop the successful response, then recover only through a new production module.
        await f.rooms.act(
          f.code,
          f.auths[0],
          f.g.version,
          nexusChoamRequest(f),
          clock,
        );
        const pending = await f.restart().readRoom(f.code);
        assert.equal(pending.nexusChoamLast?.stage, 'pending');
        assert.deepEqual(
          pending.players[0].hand.find((c) => c.id === f.cost.id),
          f.cost,
        );
        await restored(f, pending);
        const decision: Action = cancel
          ? { type: 'card', mode: 'cancel', card: f.karama }
          : { type: 'passResponse' };
        const expected = applyAction(pending, f.target, decision);
        const done = await act(f, 1, decision);
        expected.version = done.version;
        assert.deepEqual(done, JSON.parse(JSON.stringify(expected)));
        assert.equal(
          done.nexusChoamLast?.stage,
          cancel ? 'canceled' : 'complete',
        );
        assert.equal(
          done.discard.filter((c) => c.id === f.cost.id).length,
          cancel ? 0 : 1,
        );
        assert.equal(
          done.nexusCards!.cards!.discard.filter((card) => card === 'choam')
            .length,
          1,
        );
        await restored(f, done);
        const before = row(f);
        await assert.rejects(
          f.rooms.act(
            f.code,
            f.auths[0],
            done.version,
            nexusChoamRequest(f),
            clock,
          ),
        );
        assert.deepEqual(row(f), before);
      } finally {
        f.sqlite.close();
      }
    }
});
void test('SQLite simultaneous last-holder pass and printed Karama settle one CHOAM Nexus outcome and preserve the other request as stale', async () => {
  for (const effect of NEXUS_CHOAM_EFFECTS) {
    const f = await fixture(effect);
    try {
      const pending = await act(f, 0, nexusChoamRequest(f));
      f.writes.length = 0;
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
        [
          { type: 'passResponse' },
          { type: 'card', mode: 'cancel', card: f.karama },
        ].map((action) =>
          f
            .restart()
            .act(f.code, f.auths[1], pending.version, action as Action, clock),
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
      const done = await f.restart().readRoom(f.code);
      assert.equal(done.version, pending.version + 1);
      assert.equal(done.nexusChoamHistory!.length, 1);
      const canceled = done.nexusChoamLast!.stage === 'canceled';
      assert.equal(
        done.discard.filter((c) => c.id === f.cost.id).length,
        canceled ? 0 : 1,
      );
      assert.equal(
        done.discard.filter((c) => c.id === f.karama).length,
        canceled ? 1 : 0,
      );
      await restored(f, done);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('SQLite damaged CHOAM Nexus payment, virtual effect, parent, turn or completion proof is rejected without a write', async () => {
  const f = await fixture('baliset');
  try {
    const pending = await act(f, 0, nexusChoamRequest(f));
    const corruptions: ((g: Game) => void)[] = [
      (g) => {
        g.pendingChoamWorthless!.card = 'unknown';
      },
      (g) => {
        g.pendingChoamWorthless!.effect = 'kulon';
      },
      (g) => {
        g.pendingChoamWorthless!.nexusEvent = 'stale';
      },
      (g) => {
        g.pendingChoamMove!.total = 1;
        g.pendingChoamMove!.group[0][1] = 1;
      },
      (g) => {
        g.turn++;
      },
      (g) => {
        g.nexusChoamHistory![0].stage = 'complete';
      },
      (g) => {
        delete g.nexusChoamLast;
      },
      (g) => {
        delete g.nexusChoamHistory;
      },
      (g) => {
        g.response = null;
      },
    ];
    for (const [index, corrupt] of corruptions.entries()) {
      const bad = structuredClone(pending);
      corrupt(bad);
      f.sqlite
        .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
        .run(JSON.stringify(bad), bad.version, f.code);
      const before = row(f);
      f.writes.length = 0;
      for (const action of [
        { type: 'passResponse' },
        { type: 'card', mode: 'cancel', card: f.karama },
      ] as Action[]) {
        await assert.rejects(
          f.restart().act(f.code, f.auths[1], bad.version, action, clock),
          `corruption ${index}`,
        );
        assert.deepEqual(row(f), before);
        assert.equal(f.writes.length, 0);
      }
      for (const auth of f.auths)
        await assert.rejects(
          f.restart().readSeatView(f.code, auth),
          `read corruption ${index}`,
        );
    }
  } finally {
    f.sqlite.close();
  }
});
