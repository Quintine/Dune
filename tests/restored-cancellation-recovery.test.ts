import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type * as Rooms from '../db/rooms';

/** Execute the production room module and SQL, with a hook immediately before its CAS. */
function unitStore(runBots = bots.runBots) {
  const sqlite = new DatabaseSync(':memory:');
  const hooks: { beforeWrite?: () => Promise<void> } = {};
  const writes: { expected: number; changes: number }[] = [];
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      this.values = values;
      return this;
    }
    async first() {
      return sqlite.prepare(this.sql).get(...this.values) ?? null;
    }
    async run() {
      const continuation = this.sql.startsWith('UPDATE rooms SET state');
      if (continuation) await hooks.beforeWrite?.();
      const changes = Number(
        sqlite.prepare(this.sql).run(...this.values).changes,
      );
      if (continuation)
        writes.push({ expected: Number(this.values[3]), changes });
      return { meta: { changes } };
    }
  }
  const database = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  function loadRooms() {
    const exports = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL('../db/rooms.ts', import.meta.url), 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
      {
        exports,
        crypto: webcrypto,
        TextEncoder,
        structuredClone,
        // Keep persisted JSON values in the test realm for strict structural assertions.
        JSON,
        require: (name: string) => {
          if (name === 'cloudflare:workers') return { env: { DB: database } };
          if (name === '@/game/engine') return engine;
          if (name === '@/game/bots') return { ...bots, runBots };
          throw new Error('Unexpected module ' + name);
        },
      },
    );
    return exports as typeof Rooms;
  }
  return { rooms: loadRooms(), restart: loadRooms, sqlite, hooks, writes };
}

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

type Source = 'gift' | 'ix';
async function fixture(source: Source, converted = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, [
    'ix',
    'choam',
  ]);
  const code = made.view.code,
    tokens = [made.token];
  for (const [name, faction] of [
    [
      source === 'gift' ? 'Richese' : 'Ix',
      source === 'gift' ? 'richese' : 'ixians',
    ],
    ['Emperor', 'emperor'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const ids = seats.map((s) => s.playerId);
  const old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    ['ix', 'choam'],
  );
  g.players.push(
    engine.newPlayer(
      ids[1],
      source === 'gift' ? 'Richese' : 'Ix',
      source === 'gift' ? 'richese' : 'ixians',
    ),
    engine.newPlayer(ids[2], 'Emperor', 'emperor'),
  );
  // Conserved exposed positions with real room credentials. Every source power,
  // battle outcome, cleanup choice and conversion is produced by public actions.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: source === 'gift' ? 5 : 6,
    turn: 2,
    storm: 18,
    active: source === 'gift' ? ids[2] : ids[1],
    order: [ids[1], ids[2], ids[0]],
    movementRemaining: [ids[2], ids[1], ids[0]],
    deck: baseDeck(),
    discard: [],
    phaseOpening: null,
    ready: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
    });
  function hold(
    index: number,
    pred: (c: engine.Game['deck'][number]) => boolean,
  ) {
    const at = g.deck.findIndex(pred);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, (c) => c.kind === 'worthless'),
    printed = hold(2, (c) => c.effect === 'karama');
  let retained: engine.Game['deck'][number];
  if (source === 'gift') {
    hold(0, (c) => c.kind === 'worthless'); // Keeps the restored Emperor response answerable.
    g.players[1].ally = ids[2];
    g.players[2].ally = ids[1];
    g.richeseCache = richeseCards();
    const at = g.richeseCache.findIndex((c) => c.effect === 'ornithopter');
    assert.ok(at >= 0);
    retained = g.richeseCache.splice(at, 1)[0];
    g.players[1].hand.push(retained);
  } else {
    for (const index of [1, 2])
      Object.assign(g.players[index], {
        forces: { 'arrakeen:10': 8 },
        reserves: 12,
      });
    g.players[1].elites = {
      reserves: 5,
      tanks: 0,
      forces: { 'arrakeen:10': 2 },
      revived: 0,
    };
    g.players[2].elites = undefined;
    retained = hold(1, (c) => c.kind === 'shield');
  }
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  async function act(index: number, action: engine.Action) {
    const state = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], state.version, action, clock);
    return store.restart().readRoom(code);
  }
  let parent: engine.ResponseWindow | null = null;
  let original: engine.Game;
  if (source === 'gift') {
    const state = await act(2, { type: 'emperorGift', amount: 3 });
    assert.equal(state.response?.kind, 'emperorGift');
    parent = structuredClone(state.response);
    original = await act(1, { type: 'richeseGift', card: retained.id });
    assert.equal(original.response?.kind, 'richeseGift');
    assert.deepEqual(original.pendingRicheseGift!.resume.response, parent);
  } else {
    let state = await act(1, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: ids[2],
    });
    for (let n = 0; state.response && n < 20; n++) {
      const index = state.players.findIndex(
        (p) => !state.response!.passed.includes(p.id),
      );
      assert.ok(index >= 0);
      state = await act(index, { type: 'passResponse' });
    }
    assert.equal(state.response, null);
    await act(1, {
      type: 'battlePlan',
      leader: 'ixians-1',
      dial: 6,
      support: 2,
      defense: retained.id,
    });
    await act(2, { type: 'battlePlan', leader: 'emperor-4', dial: 0 });
    await act(1, { type: 'traitorCall', call: false });
    state = await act(2, { type: 'traitorCall', call: false });
    if (state.decision?.kind === 'battleLosses') {
      const choice = state.decision.options.findIndex(
        (c) => c.normal === 4 && c.elite === 2,
      );
      assert.ok(choice >= 0);
      state = await act(1, { type: 'decision', choice });
    }
    assert.equal(state.decision?.kind, 'ixSubstitution');
    original = await act(1, {
      type: 'decision',
      sources: { 'arrakeen:10': 1 },
      recover: { 'arrakeen:10': 1 },
    });
    assert.equal(original.response?.kind, 'ixSubstitution');
  }
  const pending = converted
    ? await act(0, { type: 'card', card: worthless.id, mode: 'cancel' })
    : original;
  if (converted) assert.equal(pending.response?.kind, 'worthlessKarama');
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    save,
    act,
    source,
    parent,
    retained,
    original,
    pending,
    worthless,
    printed,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function privateViews(f: Fixture) {
  for (const token of f.tokens) {
    const seat = await f.restart().authenticate(f.code, token),
      view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players)
      if (p.id !== seat.playerId)
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false);
    if (f.source === 'gift' && seat.playerId === f.ids[0])
      assert.equal(JSON.stringify(view).includes(f.retained.id), false);
  }
}
const material = (g: engine.Game) =>
  g.players.map((p) => ({
    spice: p.spice,
    forces: p.forces,
    tanks: p.tanks,
    reserves: p.reserves,
    elites: p.elites ?? null,
    battleLosses: p.battleLosses,
  }));
async function raceAllowance(f: Fixture) {
  await privateViews(f);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(f.writes.length, 0);
  const before = await f.restart().readRoom(f.code);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[0],
        before.version,
        { type: 'card', card: f.printed.id, mode: 'cancel' },
        clock,
      ),
  );
  assert.equal(f.writes.length, 0);
  let count = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.hooks.beforeWrite = async () => {
    if (++count === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [0, 1].map(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          before.version,
          { type: 'passResponse' },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, before.version + 1);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  assert.ok(done.players[2].hand.some((c) => c.id === f.printed.id));
  assert.deepEqual(material(done), material(f.original));
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  await assert.rejects(
    f
      .restart()
      .act(f.code, f.seats[2], before.version, { type: 'passResponse' }, clock),
    /changed/i,
  );
  assert.equal(f.writes.length, 2);
  await privateViews(f);
  return done;
}
void test('real Richese gift cancellation restores the private interrupted Emperor response with one racing allowance and no transfer or payment replay', async () => {
  const f = await fixture('gift');
  try {
    const done = await raceAllowance(f);
    assert.equal(done.pendingRicheseGift, null);
    assert.deepEqual(done.response, f.parent);
    assert.deepEqual(done.players[1].hand, f.original.players[1].hand);
    assert.ok(!done.players[2].hand.some((c) => c.id === f.retained.id));
    assert.deepEqual(done.richeseGiftBlocked, {
      turn: 2,
      phase: 5,
      cards: [f.retained.id],
    });
    const resumed = await f.act(0, { type: 'passResponse' });
    assert.equal(resumed.response, null);
    assert.equal(resumed.players[1].spice, 23);
    assert.equal(resumed.players[2].spice, 17);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.restart().readRoom(f.code), resumed);
  } finally {
    f.sqlite.close();
  }
});
void test('real Ixian cancellation races once into winner card cleanup and an actual discard survives recovery without repeated casualties or bounty', async () => {
  const f = await fixture('ix');
  try {
    const done = await raceAllowance(f);
    assert.equal(done.pendingIxSubstitution, null);
    assert.deepEqual(done.decision, {
      kind: 'battleCards',
      player: f.ids[1],
      territory: 'arrakeen',
      cards: [f.retained.id],
    });
    assert.ok(done.players[1].hand.some((c) => c.id === f.retained.id));
    const finished = await f.act(1, {
      type: 'decision',
      discard: [f.retained.id],
    });
    assert.equal(finished.phase, 7);
    assert.equal(finished.pendingTreacheryDiscard ?? null, null);
    assert.equal(
      finished.discard.filter((c) => c.id === f.retained.id).length,
      1,
    );
    assert.deepEqual(material(finished), material(done));
    await Promise.all([
      f.restart().continueRoomAutomatic(f.code, clock),
      f.restart().continueRoomAutomatic(f.code, clock),
    ]);
    assert.deepEqual(await f.restart().readRoom(f.code), finished);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[1],
          done.version,
          { type: 'decision', discard: [f.retained.id] },
          clock,
        ),
      /changed/i,
    );
  } finally {
    f.sqlite.close();
  }
});
for (const source of ['gift', 'ix'] as const)
  void test(`${source} malformed restored source rejects before a new cost and after a paid BG declaration without SQL writes`, async () => {
    for (const converted of [false, true]) {
      const f = await fixture(source, converted);
      try {
        const changes: ((g: engine.Game) => void)[] =
          source === 'gift'
            ? [
                (g) => {
                  g.pendingRicheseGift!.resume.response!.owner = f.ids[1];
                },
                (g) => {
                  g.pendingRicheseGift!.resume.response!.recipient = 'absent';
                },
                (g) => {
                  g.pendingRicheseGift!.resume.response!.amount = -1;
                },
              ]
            : [
                (g) => {
                  g.pendingIxSubstitution!.territory = 'carthag';
                },
                (g) => {
                  g.pendingIxSubstitution!.cards = ['absent'];
                },
                (g) => {
                  g.lastBattleContext!.winner = f.ids[2];
                },
              ];
        for (const change of changes) {
          const bad = structuredClone(f.pending);
          change(bad);
          f.save(bad);
          await assert.rejects(
            f
              .restart()
              .act(
                f.code,
                f.seats[converted ? 2 : 0],
                bad.version,
                converted
                  ? { type: 'passResponse' }
                  : { type: 'card', card: f.worthless.id, mode: 'cancel' },
                clock,
              ),
          );
          assert.deepEqual(await f.restart().readRoom(f.code), bad);
          assert.equal(f.writes.length, 0);
          assert.equal(
            bad.discard.filter((c) => c.id === f.worthless.id).length,
            converted ? 1 : 0,
          );
        }
      } finally {
        f.sqlite.close();
      }
    }
  });
