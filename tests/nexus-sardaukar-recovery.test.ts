import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import {
  nexusSardaukarFixture,
  prepareSardaukarBattle,
  nexusSardaukarInventory,
} from './fixture-nexus-sardaukar';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(initial: Game) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Cunning SQL',
    'harkonnen',
    false,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const ids = ['p', 'q', 'r'];
  // Only disposable SQL seat bindings move. Existing game identities and their
  // signed battle/component histories remain untouched.
  for (const [i, token] of tokens.entries()) {
    const auth = await store.rooms.authenticate(code, token);
    store.sqlite
      .prepare(
        'UPDATE seats SET player_id = ? WHERE room_code = ? AND player_id = ?',
      )
      .run(ids[i], code, auth.playerId);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, initial };
}
type Fixture = Awaited<ReturnType<typeof fixture>> & { sqlite: DatabaseSync };
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
const sardaukarAction = (g: Game): Action => ({
  type: 'nexusSardaukar',
  event: viewGame(g, 'p').nexusSardaukar!.offer!.event,
});
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const actual = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(actual, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(actual, 'nexusSardaukarHistory'), false);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusSardaukarInventory(g);
}
async function compete(f: Fixture, action: Action) {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [f.restart(), f.restart()].map((rooms) =>
      rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
    ),
  );
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const g = await f.restart().readRoom(f.code);
  assert.equal(g.version, f.initial.version + 1);
  return g;
}

function initialBattle(sealed = false) {
  let g = prepareSardaukarBattle(nexusSardaukarFixture());
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const karama = g.deck.splice(index, 1)[0];
  g.players[1].hand.push(karama);
  if (sealed)
    g = applyAction(g, 'q', {
      type: 'battlePlan',
      dial: 0,
      support: 0,
      leader: g.players[1].leaders[0].id,
      weapon: null,
      defense: null,
    });
  nexusSardaukarInventory(g);
  return { g, karama: karama.id };
}
function physical(g: Game) {
  return g.players.map((p) => ({
    id: p.id,
    forces: p.forces,
    reserves: p.reserves,
    tanks: p.tanks,
    elites: p.elites,
    spice: p.spice,
  }));
}

void test('SQLite competing Emperor Cunning plays spend one card and restore a sealed opponent plus the pending response privately', async () => {
  const { g: initial } = initialBattle(true);
  const f = await fixture(initial);
  try {
    const action = sardaukarAction(initial);
    const g = await compete(f, action);
    assert.equal(g.response?.kind, 'nexusSardaukar');
    assert.equal(g.nexusSardaukarHistory!.length, 1);
    assert.equal(g.nexusSardaukarLast!.stage, 'pending');
    assert.deepEqual(g.battle!.plans.q, initial.battle!.plans.q);
    assert.deepEqual(physical(g), physical(initial));
    assert.equal(g.nexusCards!.cards!.hands.p, null);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((card) => card === 'emperor').length,
      1,
    );
    await restored(f, g);
    for (const id of ['p', 'r'])
      assert.equal(viewGame(g, id).battle!.plans.q, undefined);
    const before = row(f);
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], initial.version, action, clock),
    );
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], g.version, action, clock),
    );
    assert.deepEqual(row(f), before);
    await f
      .restart()
      .act(f.code, f.auths[1], g.version, { type: 'passResponse' }, clock);
    const active = await f.restart().readRoom(f.code);
    assert.equal(active.nexusSardaukarLast!.stage, 'active');
    assert.deepEqual(physical(active), physical(initial));
    assert.deepEqual(active.battle!.plans.q, initial.battle!.plans.q);
    await restored(f, active);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite lost acknowledgment followed by Karama cancels only temporary strength and retains all real Sardaukar in reserves', async () => {
  const { g: initial, karama } = initialBattle();
  const f = await fixture(initial);
  try {
    await f.rooms.act(
      f.code,
      f.auths[0],
      initial.version,
      sardaukarAction(initial),
      clock,
    );
    const pending = await f.restart().readRoom(f.code);
    await restored(f, pending);
    await f
      .restart()
      .act(
        f.code,
        f.auths[1],
        pending.version,
        { type: 'card', card: karama, mode: 'cancel' },
        clock,
      );
    const canceled = await f.restart().readRoom(f.code);
    assert.equal(canceled.nexusSardaukarLast!.stage, 'canceled');
    assert.deepEqual(physical(canceled), physical(initial));
    assert.equal(canceled.players[0].elites!.reserves, 5);
    assert.equal(canceled.players[0].elites!.tanks, 0);
    assert.equal(
      canceled.discard.filter((card) => card.id === karama).length,
      1,
    );
    assert.equal(
      canceled.nexusCards!.cards!.discard.filter((card) => card === 'emperor')
        .length,
      1,
    );
    await restored(f, canceled);
    const before = row(f);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[1],
        canceled.version,
        { type: 'card', card: karama, mode: 'cancel' },
        clock,
      ),
    );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite damaged Emperor battle source, history, stage or response refuses every seat and writes nothing', async () => {
  const { g: initial } = initialBattle();
  const f = await fixture(initial);
  try {
    await f.rooms.act(
      f.code,
      f.auths[0],
      initial.version,
      sardaukarAction(initial),
      clock,
    );
    const good = await f.rooms.readRoom(f.code);
    const changes: ((g: Game) => void)[] = [
      (g) => {
        delete g.nexusSardaukarHistory;
      },
      (g) => {
        delete g.nexusSardaukarLast;
      },
      (g) => {
        delete g.battle!.nexusSardaukarUsed;
      },
      (g) => {
        g.battle!.nexusSardaukarUsed = 'stale';
      },
      (g) => {
        g.nexusSardaukarHistory![0].stage = 'active';
      },
      (g) => {
        g.nexusSardaukarHistory![0].receipt.normal++;
      },
      (g) => {
        g.nexusSardaukarHistory![0].receipt.battle = 'stale';
      },
      (g) => {
        g.nexusSardaukarHistory![0].parent += '-stale';
      },
      (g) => {
        g.response = null;
      },
      (g) => {
        g.response!.owner = 'q';
      },
      (g) => {
        g.response!.intent += '-stale';
      },
      (g) => {
        g.players[0].forces['pasty_mesa:5']++;
        g.players[0].reserves--;
      },
    ];
    for (const change of changes) {
      const bad = structuredClone(good);
      change(bad);
      f.sqlite
        .prepare('UPDATE rooms SET state = ? WHERE code = ?')
        .run(JSON.stringify(bad), f.code);
      f.writes.length = 0;
      const before = row(f);
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code, auth));
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.auths[1],
            bad.version,
            { type: 'passResponse' },
            clock,
          ),
      );
      // Automatic recovery can decline an invalid continuation or surface its
      // integrity error; neither path may rewrite the damaged saved row.
      await f
        .restart()
        .continueRoomAutomatic(f.code, clock)
        .catch(() => {});
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
