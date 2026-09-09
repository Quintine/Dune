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

import {
  homeworldRevivalFixture,
  enterHomeworldRevival,
  holdRevivalCard,
  revivalInventory,
  revivalPlayer,
  revivalReload,
} from './fixture-homeworld-revival';

type Game = engine.Game;
type Mode = 'fremen' | 'tleilax' | 'ghola';
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

async function persisted(mode: Mode = 'fremen') {
  const store = unitStore();
  const expansion = mode !== 'fremen';
  const advanced = mode === 'ghola';
  const made = await store.rooms.createRoom('Revival SQL QA', 'fremen', advanced, expansion ? ['ix'] : []);
  const code = made.view.code;
  const emperor = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const tleilaxu = expansion ? await store.rooms.joinRoom(code, 'Tleilaxu', 'tleilaxu') : null;
  const tokens = [made.token, emperor.token!, ...(tleilaxu ? [tleilaxu.token!] : [])];
  const auths = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const initial = await store.rooms.readRoom(code);
  const prepared = homeworldRevivalFixture({ advanced, tleilaxu: expansion });
  let encoded = JSON.stringify(prepared);
  for (const [index, id] of ['f', 'e', ...(expansion ? ['t'] : [])].entries())
    encoded = encoded.replaceAll(JSON.stringify(id), JSON.stringify(auths[index].playerId));
  let g: Game = JSON.parse(encoded);
  g.code = code;
  g.host = auths[0].playerId;
  g.version = initial.version;
  // All authentic entry receipts are created after production IDs are bound.
  g = enterHomeworldRevival(g);
  // Stage real card custody after Bidding, avoiding an unrelated Kaitain
  // end-Bidding choice. The cancellation card keeps income responses durable.
  holdRevivalCard(g, auths[1].playerId, 'karama');
  const ghola = mode === 'ghola' ? holdRevivalCard(g, auths[0].playerId, 'ghola') : null;
  const save = (state: Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom('Untouched revival observer room', 'atreides', false, []);
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return { ...store, mode, code, tokens, auths, ids: auths.map((a) => a.playerId), initial: g,
    ghola, save, otherCode: other.view.code, otherBefore };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(f.code)!;
  return { version: row.version, hash: createHash('sha256').update(String(row.state)).digest('hex') };
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, f.ids[i]));
    for (const other of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  homeworldGameIntegrity(g);
  revivalInventory(g);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
function barrier(f: Fixture) {
  let count = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++count === 2) release(); await waiting; };
}
async function act(f: Fixture, g: Game, actor: string, action: engine.Action) {
  const auth = f.auths.find((a) => a.playerId === actor)!;
  await f.rooms.act(f.code, auth, g.version, action, clock);
  return f.rooms.readRoom(f.code);
}
async function opened(f: Fixture) {
  let g = f.initial;
  const actor = f.mode === 'tleilax' ? f.ids[2] : f.ids[0];
  const action: engine.Action = f.mode === 'ghola'
    ? { type: 'card', card: f.ghola!, amount: 2, elite: 1 }
    : { type: 'revive', amount: 3, elite: f.mode === 'fremen' ? 2 : 0 };
  g = await act(f, g, actor, action);
  // Normal revival may have its own cancellable pre-return responses. Pass
  // these through real actions, stopping at the owned deployment decision.
  for (let n = 0; !g.homeworldRevivalReturn && g.response && n < 20; n++)
    g = await act(f, g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.equal(g.homeworldRevivalReturn?.stage, 'choice');
  assert.equal(g.decision?.kind, 'homeworldRevivalDeployment');
  await restored(f, g);
  f.writes.length = 0;
  return g;
}
function deployment(g: Game, destination = 'arrakeen:10'): engine.Action {
  const frame = g.homeworldRevivalReturn!;
  return { type: 'decision', event: frame.event, destination, amount: frame.quote.normal + frame.quote.elite };
}
async function settleIncome(f: Fixture, state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 20; n++) {
    assert.equal(g.response.kind, 'revivalIncome');
    g = await act(f, g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

void test('production SQL competing Fedaykin deployment commits the exact returned stars once', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const owner = revivalPlayer(g, f.ids[0]);
    const rooms = await restored(f, g);
    const action = deployment(g);
    barrier(f);
    const results = await Promise.allSettled([
      rooms.act(f.code, f.auths[0], g.version, action, clock),
      f.rooms.act(f.code, f.auths[0], g.version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
    const done = await rooms.readRoom(f.code);
    const placed = revivalPlayer(done, f.ids[0]);
    assert.equal(done.version, g.version + 1);
    assert.equal(done.homeworldRevivalReturn?.stage, 'complete');
    assert.equal(placed.reserves, owner.reserves - 2);
    assert.equal(placed.elites!.reserves, owner.elites!.reserves - 2);
    assert.equal(placed.forces['arrakeen:10'], owner.forces['arrakeen:10'] + 2);
    assert.equal(placed.elites!.forces['arrakeen:10'], 2);
    assert.equal(placed.tanks, owner.tanks);
    assert.equal(placed.spice, owner.spice);
    assert.equal(placed.shipped, owner.shipped);
    assert.equal(placed.moved, owner.moved);
    const before = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, action, clock));
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL lost Tleilax deployment response restores paid/free custody and held income without replay', async () => {
  const f = await persisted('tleilax');
  try {
    const g = await opened(f);
    assert.deepEqual(g.homeworldRevivalReturn!.group, { amount: 3, elite: 0, free: 2 });
    assert.equal(g.homeworldRevivalReturn!.resumeResponse?.kind, 'revivalIncome');
    const owner = revivalPlayer(g, f.ids[2]);
    const action = deployment(g, 'polar_sink:0');
    // The server completes this request; pretend its response was lost.
    await f.rooms.act(f.code, f.auths[2], g.version, action, clock);
    const rooms = f.restart();
    let done = await rooms.readRoom(f.code);
    assert.equal(done.homeworldRevivalReturn?.stage, 'complete');
    assert.equal(done.response?.kind, 'revivalIncome');
    assert.equal(revivalPlayer(done, f.ids[2]).reserves, owner.reserves - 2);
    assert.equal(revivalPlayer(done, f.ids[2]).forces['polar_sink:0'], 2);
    assert.equal(revivalPlayer(done, f.ids[2]).tanks, owner.tanks);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[2], g.version, action, clock));
    await assert.rejects(rooms.act(f.code, f.auths[2], done.version, action, clock));
    assert.deepEqual(snapshot(f), before);
    done = await settleIncome(f, done);
    assert.equal(revivalPlayer(done, f.ids[2]).spice, owner.spice + 1);
    const settled = snapshot(f);
    await rooms.continueRoomAutomatic(f.code, clock);
    await restored(f, done);
    assert.deepEqual(snapshot(f), settled);
  } finally { f.sqlite.close(); }
});

void test('production SQL Ghola return and declined placement survive restart with one card disposal and one income', async () => {
  const f = await persisted('ghola');
  try {
    const g = await opened(f);
    assert.equal(g.homeworldRevivalReturn!.source, 'ghola');
    assert.equal(g.homeworldRevivalReturn!.card, f.ghola);
    assert.equal(g.discard.filter((c) => c.id === f.ghola).length, 1);
    const owner = revivalPlayer(g, f.ids[0]);
    const tleilaxSpice = revivalPlayer(g, f.ids[2]).spice;
    const action: engine.Action = { type: 'decision', event: g.homeworldRevivalReturn!.event, decline: true };
    let done = await act(f, g, f.ids[0], action);
    assert.equal(done.homeworldRevivalReturn?.destination, 'decline');
    assert.equal(revivalPlayer(done, f.ids[0]).reserves, owner.reserves);
    assert.equal(revivalPlayer(done, f.ids[0]).tanks, owner.tanks);
    assert.equal(revivalPlayer(done, f.ids[0]).revived, owner.revived);
    assert.deepEqual(revivalPlayer(done, f.ids[0]).forces, owner.forces);
    await restored(f, done);
    done = await settleIncome(f, done);
    assert.equal(revivalPlayer(done, f.ids[2]).spice, tleilaxSpice + 1);
    assert.equal(done.discard.filter((c) => c.id === f.ghola).length, 1);
    const before = snapshot(f);
    const rooms = await restored(f, done);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, action, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
  } finally { f.sqlite.close(); }
});

void test('production SQL altered original group and captured income response reject reads and actions without writes', async () => {
  const f = await persisted('tleilax');
  try {
    const g = await opened(f);
    for (const mutate of [
      (state: Game) => { state.homeworldRevivalReturn!.group.free++; },
      (state: Game) => { state.homeworldRevivalReturn!.quote.normal++; },
      (state: Game) => { state.homeworldRevivalReturn!.quote.beforePopulation--; },
      (state: Game) => { state.homeworldRevivalReturn!.resumeResponse!.amount!++; },
      (state: Game) => { state.homeworldRevivalReturn!.resumeSignature = 'replayed'; },
      (state: Game) => { state.homeworldRevivalReturn!.player = f.ids[0]; },
    ]) {
      const corrupt = revivalReload(g);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[2]));
      await assert.rejects(rooms.act(f.code, f.auths[2], corrupt.version, deployment(g), clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});

void test('production SQL completed arrival proof cannot be retargeted or replayed after restart', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const done = await act(f, g, f.ids[0], deployment(g));
    for (const mutate of [
      (state: Game) => { state.homeworldRevivalReturn!.destination = 'polar_sink:0'; },
      (state: Game) => { state.homeworldRevivalReturn!.arrivalSignature = 'replayed'; },
      (state: Game) => { state.homeworldRevivalReturn!.stage = 'choice'; },
      (state: Game) => { state.homeworldRevivalReturn!.ambassadors!.push({ event: 'forged', entrant: f.ids[0], destination: 'arrakeen', completed: false }); },
    ]) {
      const corrupt = revivalReload(done);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, { type: 'ready' }, clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally { f.sqlite.close(); }
});
