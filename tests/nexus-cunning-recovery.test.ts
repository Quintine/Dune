import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { suboidFixture } from './fixture-nexus-cunning';
import { nexusFaceDancerFixture } from './fixture-nexus-face-dancers';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { viewGame, type Action, type Game } from '../game/engine';
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
const suboidAction = (g: Game): Action => ({
  type: 'nexusSuboids',
  event: viewGame(g, 'p').nexusSuboids!.offer!.event,
});
const dancerAction = (g: Game): Action => ({
  type: 'nexusFaceDancers',
  event: viewGame(g, 'p').nexusTleilaxu!.cunning!.event,
});
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const actual = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(actual, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(actual, 'nexusFaceDancerHistory'), false);
    assert.equal(Object.hasOwn(actual, 'nexusSuboidHistory'), false);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusTraitorInventory(g);
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

void test('SQLite competing Ixian Cunning plays persist one turn effect and spend one card in Basic and Advanced', async () => {
  for (const advanced of [false, true]) {
    const f = await fixture(suboidFixture(advanced));
    try {
      const action = suboidAction(f.initial),
        g = await compete(f, action);
      assert.equal(g.nexusSuboidHistory!.length, 1);
      assert.equal(g.nexusSuboidLast!.event, g.nexusSuboidHistory![0].event);
      assert.equal(
        g.nexusCards!.cards!.discard.filter((c) => c === 'ixians').length,
        1,
      );
      assert.equal(g.nexusCards!.cards!.hands.p, null);
      assert.equal(viewGame(g, 'p').battle!.ownForces!.normalFreeSupport, true);
      assert.equal(viewGame(g, 'p').battle!.ownForces!.freeSupport, !advanced);
      await restored(f, g);
      const before = row(f);
      await assert.rejects(
        f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
      );
      await assert.rejects(
        f.rooms.act(f.code, f.auths[0], g.version, action, clock),
      );
      assert.deepEqual(row(f), before);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('SQLite lost Ixian response restores private hands and the same boosted plan in a later request', async () => {
  const initial = suboidFixture(true);
  for (const [i, kind] of [
    [0, 'projectile'],
    [1, 'shield'],
  ] as const) {
    const index = initial.deck.findIndex((c) => c.kind === kind);
    initial.players[i].hand.push(initial.deck.splice(index, 1)[0]);
  }
  const f = await fixture(initial);
  try {
    await f.rooms.act(
      f.code,
      f.auths[0],
      f.initial.version,
      suboidAction(f.initial),
      clock,
    );
    let g = await f.restart().readRoom(f.code);
    await restored(f, g);
    const own = viewGame(g, 'p'),
      other = viewGame(g, 'q');
    assert.equal(own.players[0].hand![0].id, g.players[0].hand[0].id);
    assert.equal(other.players[0].hand, undefined);
    await f
      .restart()
      .act(
        f.code,
        f.auths[0],
        g.version,
        {
          type: 'battlePlan',
          dial: 3,
          support: 0,
          leader: g.players[0].leaders[0].id,
        },
        clock,
      );
    g = await f.restart().readRoom(f.code);
    assert.equal(g.battle!.plans.p.dial, 3);
    assert.equal(g.battle!.plans.p.support, 0);
    assert.equal(g.nexusSuboidHistory!.length, 1);
    assert.equal(viewGame(g, 'p').battle!.ownForces!.normalFreeSupport, true);
    assert.deepEqual(viewGame(g, 'q').battle!.plans, {});
    await restored(f, g);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite competing Face Dancer replacements commit one original draw and one shuffle, and lost responses cannot replay', async () => {
  const f = await fixture(nexusFaceDancerFixture());
  try {
    const action = dancerAction(f.initial),
      original = f.initial.players[0].faceDancers!,
      drawn = f.initial.traitorReserve!.slice(0, 2);
    const unrelated = await f.rooms.createRoom(
      'Unrelated',
      'atreides',
      false,
      [],
    );
    const otherRow = f.sqlite
      .prepare('SELECT state,version FROM rooms WHERE code = ?')
      .get(unrelated.view.code);
    f.writes.length = 0;
    const g = await compete(f, action);
    assert.equal(g.nexusFaceDancerHistory!.length, 1);
    assert.deepEqual(g.nexusFaceDancerHistory![0].drawn, drawn);
    assert.deepEqual(g.players[0].faceDancers, [
      original[2],
      ...drawn.map((leader) => ({ leader, revealed: false })),
    ]);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((c) => c === 'tleilaxu').length,
      1,
    );
    assert.equal(g.nexusCards!.cards!.hands.p, null);
    for (const id of ['q', 'r'])
      assert.equal(viewGame(g, id).players[0].faceDancers, undefined);
    await restored(f, g);
    const before = row(f);
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
    );
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], g.version, action, clock),
    );
    assert.deepEqual(row(f), before);
    assert.deepEqual(
      f.sqlite
        .prepare('SELECT state,version FROM rooms WHERE code = ?')
        .get(unrelated.view.code),
      otherRow,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite rejects corrupted Cunning history and missing Suboid last marker without repairing or writing saves', async () => {
  for (const kind of ['suboid', 'dancer'] as const) {
    const f = await fixture(
      kind === 'suboid' ? suboidFixture() : nexusFaceDancerFixture(),
    );
    try {
      const action =
        kind === 'suboid' ? suboidAction(f.initial) : dancerAction(f.initial);
      await f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock);
      const good = await f.rooms.readRoom(f.code);
      const mutations: Array<(g: Game) => void> =
        kind === 'suboid'
          ? [
              (g) => {
                delete g.nexusSuboidHistory;
              },
              (g) => {
                delete g.nexusSuboidLast;
              },
              (g) => {
                g.nexusSuboidHistory![0].turn++;
              },
            ]
          : [
              (g) => {
                g.nexusFaceDancerHistory![0].drawn.reverse();
              },
              (g) => {
                g.nexusFaceDancerHistory![0].source.players[0].faceDancers![0].revealed = false;
              },
            ];
      for (const mutate of mutations) {
        const bad = structuredClone(good);
        mutate(bad);
        f.sqlite
          .prepare('UPDATE rooms SET state = ? WHERE code = ?')
          .run(JSON.stringify(bad), f.code);
        f.writes.length = 0;
        const before = row(f);
        for (const auth of f.auths)
          await assert.rejects(f.restart().readSeatView(f.code, auth));
        await assert.rejects(
          f.restart().act(f.code, f.auths[0], bad.version, action, clock),
        );
        await f.restart().continueRoomAutomatic(f.code, clock);
        assert.deepEqual(row(f), before);
        assert.equal(f.writes.length, 0);
      }
    } finally {
      f.sqlite.close();
    }
  }
});
