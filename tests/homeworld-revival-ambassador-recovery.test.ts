import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import type * as Rooms from '../db/rooms';
import { homeworldGameIntegrity } from '../game/homeworld-game';

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

import { homeworldRevivalAmbassadorFixture } from './fixture-homeworld-revival-ambassador';
import { revivalInventory, revivalPlayer, revivalReload } from './fixture-homeworld-revival';

type Game = engine.Game;
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
const roster = [
  ['f', 'fremen'], ['e', 'emperor'], ['t', 'tleilaxu'],
  ['ec', 'ecaz'], ['bg', 'beneGesserit'], ['a', 'atreides'],
] as const;

async function persisted() {
  const store = unitStore();
  const made = await store.rooms.createRoom('Revival Ambassador SQL QA', 'fremen', true, ['ix', 'ecaz']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const [name, faction] of roster.slice(1)) {
    const joined = await store.rooms.joinRoom(code, name, faction);
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const initial = await store.rooms.readRoom(code);
  const ids = Object.fromEntries(roster.map(([id],index) => [id,auths[index].playerId]));
  const g: Game = homeworldRevivalAmbassadorFixture(ids);
  g.code = code;
  g.host = ids.f;
  g.version = initial.version;
  // The fixture is before revival: all signed return and arrival receipts
  // below are produced by real actions with the authenticated room identities.
  assert.equal(g.homeworldRevivalReturn, undefined);
  const save = (state: Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom('Untouched Ambassador room', 'atreides', false, []);
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, initial: g, save,
    otherCode: other.view.code, otherBefore };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(f.code)!;
  return { version: row.version, hash: createHash('sha256').update(String(row.state)).digest('hex') };
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  const before = snapshot(f);
  for (const [index] of roster.entries()) {
    const auth = await rooms.authenticate(f.code, f.tokens[index]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, auth.playerId));
    for (const other of view.players.filter((p) => p.id !== auth.playerId)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  homeworldGameIntegrity(g);
  revivalInventory(g);
  assert.deepEqual(snapshot(f), before);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function act(f: Fixture, g: Game, actor: string, action: engine.Action) {
  const rooms = f.restart();
  const auth = f.auths.find((a) => a.playerId === actor)!;
  await rooms.act(f.code, auth, g.version, action, clock);
  return rooms.readRoom(f.code);
}
async function allow(f: Fixture, state: Game, kind: string) {
  let g = state;
  for (let n = 0; g.response?.kind === kind && n < 40; n++)
    g = await act(f, g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.notEqual(g.response?.kind, kind);
  return g;
}
async function openedChild(f: Fixture) {
  let g = await act(f, f.initial, f.ids.f, { type: 'revive', amount: 1, elite: 1 });
  if (g.decision?.kind === 'revivalStop')
    g = await act(f, g, f.ids.t, { type: 'decision', decline: true });
  for (let n = 0; !g.homeworldRevivalReturn && g.response && n < 20; n++)
    g = await allow(f, g, g.response.kind);
  assert.equal(g.homeworldRevivalReturn?.stage, 'choice');
  const event = g.homeworldRevivalReturn!.event;
  g = await act(f, g, f.ids.f, { type: 'decision', event, destination: 'arrakeen:10', amount: 1 });
  assert.equal(g.homeworldRevivalReturn?.stage, 'arrival');
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  const parent = g.pendingAmbassador!.event;
  await restored(f, g);
  g = await act(f, g, f.ids.ec, { type: 'decision', event: parent, trigger: true, beneficiary: f.ids.a });
  g = await act(f, g, f.ids.a, { type: 'decision', event: parent, amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.decision?.kind, 'intrusion');
  g = await act(f, g, f.ids.bg, { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'advisor');
  g = await act(f, g, f.ids.bg, { type: 'decision', accept: true, accompany: true });
  g = await allow(f, g, 'advisor');
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.pendingAmbassador?.entrant, f.ids.bg);
  const records = g.homeworldRevivalReturn!.ambassadors!;
  assert.equal(records.length, 2);
  assert.equal(records[0].event, parent);
  assert.equal(records[0].completed, true);
  assert.equal(records[1].parent, parent);
  assert.equal(records[1].completed, false);
  await restored(f, g);
  f.writes.length = 0;
  return g;
}
function barrier(f: Fixture) {
  let count = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++count === 2) release(); await waiting; };
}

void test('production SQL live revival Ambassador child survives reload and competing final relocation settles income once', async () => {
  const f = await persisted();
  try {
    let g = await openedChild(f);
    const income = structuredClone(g.homeworldRevivalReturn!.resumeResponse!);
    const beforeIncome = revivalPlayer(g, f.ids.t).spice;
    const child = g.pendingAmbassador!.event;
    const before = snapshot(f);
    const rooms = await restored(f, g);
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    assert.equal(revivalPlayer(await rooms.readRoom(f.code), f.ids.t).spice, beforeIncome);
    g = await act(f, g, f.ids.ec, { type: 'decision', event: child, trigger: true, beneficiary: f.ids.ec });
    assert.equal(g.pendingAmbassador?.stage, 'move');
    await restored(f, g);
    const action: engine.Action = { type: 'decision', event: child,
      forces: { 'red_chasm:7': 1 }, territory: 'carthag', sector: 11 };
    const auth = f.auths.find((a) => a.playerId === f.ids.ec)!;
    f.writes.length = 0;
    barrier(f);
    const results = await Promise.allSettled([
      rooms.act(f.code, auth, g.version, action, clock),
      f.rooms.act(f.code, auth, g.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
    let done = await f.restart().readRoom(f.code);
    assert.equal(done.version, g.version + 1);
    assert.equal(done.pendingAmbassador ?? null, null);
    assert.equal(done.homeworldRevivalReturn?.stage, 'complete');
    assert.ok(done.homeworldRevivalReturn!.ambassadors!.every((record) => record.completed));
    assert.deepEqual(done.response, income);
    assert.equal(revivalPlayer(done, f.ids.t).spice, beforeIncome);
    assert.equal(revivalPlayer(done, f.ids.f).forces['arrakeen:10'], 13);
    assert.equal(revivalPlayer(done, f.ids.a).forces['sietch_tabr:14'], 2);
    assert.equal(revivalPlayer(done, f.ids.bg).forces['sietch_tabr:14'], 2);
    assert.equal(revivalPlayer(done, f.ids.ec).forces['carthag:11'], 1);
    await restored(f, done);
    done = await allow(f, done, 'revivalIncome');
    assert.equal(revivalPlayer(done, f.ids.t).spice, beforeIncome + income.amount!);
    const settled = snapshot(f);
    await assert.rejects(rooms.act(f.code, auth, done.version, action, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    await restored(f, done);
    assert.deepEqual(snapshot(f), settled);
  } finally { f.sqlite.close(); }
});

void test('production SQL missing live Ambassador or changed child completion cannot release retained revival income', async () => {
  const f = await persisted();
  try {
    const original = await openedChild(f);
    for (const mutate of [
      (g: Game) => { g.pendingAmbassador = null; g.decision = null; },
      (g: Game) => { g.homeworldRevivalReturn!.ambassadors![1].completed = true; },
      (g: Game) => { g.homeworldRevivalReturn!.ambassadors![1].parent = 'missing-parent'; },
      (g: Game) => { delete g.pendingAmbassador!.revivalEvent; },
      (g: Game) => { g.homeworldRevivalReturn!.stage = 'complete'; },
    ]) {
      const corrupt = revivalReload(original);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      const auth = f.auths.find((a) => a.playerId === f.ids.ec)!;
      await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, auth, corrupt.version,
        { type: 'decision', event: original.pendingAmbassador!.event, trigger: false }, clock));
      if (rooms.needsAutomaticRoomRecovery(corrupt))
        await assert.rejects(rooms.continueRoomAutomatic(f.code, clock));
      else await rooms.continueRoomAutomatic(f.code, clock);
      const input = revivalReload(corrupt);
      assert.throws(() => engine.normalizeAutomaticGame(input));
      assert.deepEqual(input, corrupt);
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});
