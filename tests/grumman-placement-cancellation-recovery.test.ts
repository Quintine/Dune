import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import {
  grummanCollectionFixture,
  grummanInventory,
  grummanToken,
  holdGrummanCard,
} from './fixture-grumman-collection';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture() {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Grumman cancellation SQL',
    'moritani',
    false,
    [],
  );
  const code = made.view.code,
    credentials = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    credentials.push(
      (await store.rooms.joinRoom(code, faction, faction)).token!,
    );
  const auths = await Promise.all(
    credentials.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const g = grummanCollectionFixture({ seatIds: ids });
  const karama = holdGrummanCard(g, ids[1], 'karama').id;
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  const save = (state: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  return { ...store, code, credentials, auths, ids, initial: g, karama, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>> & { sqlite: DatabaseSync };
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
async function act(f: Fixture, g: Game, index: number, action: Action) {
  const rooms = f.restart();
  await rooms.act(f.code, f.auths[index], g.version, action, clock);
  return rooms.readRoom(f.code);
}
async function pending(f: Fixture) {
  let g = await act(f, f.initial, 1, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  g = await act(f, g, 0, {
    type: 'decision',
    event: g.grummanCollection!.event,
    mode: 'add',
    token: grummanToken(g, 'sabotage').id,
    territory: 'arrakeen',
  });
  for (let i = 0; i < f.ids.length && g.phase === 7; i++)
    g = await act(f, g, i, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  g = await act(f, g, 0, {
    type: 'decision',
    token: grummanToken(g, 'sneakAttack').id,
    territory: 'carthag',
  });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  assert.equal(
    g.moritaniTerror!.tokens.filter((t) => t.location === 'arrakeen').length,
    2,
  );
  assert.equal(grummanToken(g, 'sneakAttack').status, 'available');
  assert.equal(g.players[0].spice, 24);
  assert.equal(g.moritaniTerror!.placementTurn, 1);
  grummanInventory(g);
  return g;
}
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [index, credential] of f.credentials.entries()) {
    const auth = await rooms.authenticate(f.code, credential);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, f.ids[index]));
    for (const opponent of view.players.filter((p) => p.id !== auth.playerId)) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.spice, undefined);
    }
    if (index !== 0) {
      for (const token of view.moritaniTerror!.tokens.filter(
        (t) => t.status === 'placed',
      ))
        assert.equal('kind' in token, false);
      assert.equal(
        view.moritaniTerror!.tokens.some(
          (t) => t.id === grummanToken(g, 'sneakAttack').id,
        ),
        grummanToken(g, 'sneakAttack').status === 'placed',
      );
    }
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  grummanInventory(g);
}
const cancel = (f: Fixture): Action => ({
  type: 'card',
  card: f.karama,
  mode: 'cancel',
});
function outcome(f: Fixture, before: Game, done: Game, canceled: boolean) {
  assert.equal(done.response, null);
  assert.equal(done.pendingMoritaniPlacement, null);
  assert.equal(done.moritaniTerror!.placementTurn, before.turn);
  assert.equal(done.players[0].spice, 24);
  assert.deepEqual(done.grummanCollection, before.grummanCollection);
  assert.deepEqual(
    done.moritaniTerror!.tokens.filter((t) => t.location === 'arrakeen'),
    before.moritaniTerror!.tokens.filter((t) => t.location === 'arrakeen'),
  );
  assert.equal(
    grummanToken(done, 'sneakAttack').status,
    canceled ? 'available' : 'placed',
  );
  assert.equal(
    grummanToken(done, 'sneakAttack').location,
    canceled ? null : 'carthag',
  );
  assert.equal(
    done.discard.filter((c) => c.id === f.karama).length,
    canceled ? 1 : 0,
  );
  assert.deepEqual(
    done.players.map((p) => [p.spice, p.forces, p.reserves, p.tanks]),
    before.players.map((p) => [p.spice, p.forces, p.reserves, p.tanks]),
  );
  grummanInventory(done);
}

void test('SQLite reconnect cancels subsequent Mentat placement without disturbing the completed Grumman stack or income', async () => {
  const f = await fixture();
  try {
    const g = await pending(f);
    await restored(f, g);
    const done = await act(f, g, 1, cancel(f));
    outcome(f, g, done, true);
    await restored(f, done);
    const before = row(f);
    for (const version of [g.version, done.version])
      await assert.rejects(
        f.restart().act(f.code, f.auths[1], version, cancel(f), clock),
      );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite cancellation racing the last allowance commits one placement outcome and at most one Karama', async () => {
  const f = await fixture();
  try {
    const g = await pending(f);
    f.writes.length = 0;
    let arrivals = 0,
      release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // A failed preflight must fail this regression rather than strand the
    // competing valid request at the CAS barrier forever.
    const timeout = setTimeout(release, 1000);
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    const results = await Promise.allSettled([
      f.restart().act(f.code, f.auths[1], g.version, cancel(f), clock),
      f
        .restart()
        .act(f.code, f.auths[1], g.version, { type: 'passResponse' }, clock),
    ]);
    clearTimeout(timeout);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, g.version + 1);
    outcome(
      f,
      g,
      done,
      done.discard.some((c) => c.id === f.karama),
    );
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite damaged pending token, destination or turn rejects cancellation and allowance before card cost or any write', async () => {
  const f = await fixture();
  try {
    const good = await pending(f);
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.pendingMoritaniPlacement!.token = 'missing-physical-token';
      },
      (g) => {
        g.pendingMoritaniPlacement!.territory = 'not-a-territory';
      },
      (g) => {
        grummanToken(g, 'assassination').id = g.pendingMoritaniPlacement!.token;
      },
      (g) => {
        // Neither identity is the proposed source: allowance still must not
        // persist an invalid inventory merely because placeTerror can run.
        grummanToken(g, 'assassination').id = grummanToken(g, 'atomics').id;
      },
      (g) => {
        g.pendingMoritaniPlacement!.turn--;
      },
    ];
    for (const [index, mutate] of mutations.entries()) {
      const bad = JSON.parse(JSON.stringify(good)) as Game;
      mutate(bad);
      f.save(bad);
      const before = row(f);
      f.writes.length = 0;
      for (const action of [cancel(f), { type: 'passResponse' }])
        await assert.rejects(
          f.restart().act(f.code, f.auths[1], bad.version, action, clock),
          `Mutation ${index}, action ${action.type} must reject`,
        );
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
      const retained = await f.rooms.readRoom(f.code);
      assert.ok(retained.players[1].hand.some((c) => c.id === f.karama));
      assert.equal(
        retained.discard.some((c) => c.id === f.karama),
        false,
      );
    }
  } finally {
    f.sqlite.close();
  }
});
