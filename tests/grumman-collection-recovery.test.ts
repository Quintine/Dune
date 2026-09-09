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
  grummanCollectionFixture, grummanInventory, grummanPlayer as p,
  grummanReload as reload, grummanToken as token, holdGrummanCard,
  stageGrummanArrival,
} from './fixture-grumman-collection';

type Game = engine.Game;
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

async function persisted() {
  const store = unitStore();
  const made = await store.rooms.createRoom('Grumman Collection SQL QA', 'moritani', false, []);
  const code = made.view.code;
  const credentials = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    credentials.push(joined.token!);
  }
  const auths = await Promise.all(credentials.map((value) => store.rooms.authenticate(code, value)));
  const initial = await store.rooms.readRoom(code);
  let encoded = JSON.stringify(grummanCollectionFixture());
  for (const [index, id] of ['m', 'a', 'g'].entries())
    encoded = encoded.replaceAll(JSON.stringify(id), JSON.stringify(auths[index].playerId));
  const g: Game = JSON.parse(encoded);
  g.code = code;
  g.host = auths[0].playerId;
  g.version = initial.version;
  holdGrummanCard(g, auths[0].playerId, 'worthless');
  holdGrummanCard(g, auths[1].playerId, 'projectile');
  assert.equal(g.grummanCollection, undefined);
  const save = (state: Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom('Untouched Grumman room', 'fremen', false, []);
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return { ...store, code, credentials, auths, ids: auths.map((auth) => auth.playerId), initial: g,
    save, otherCode: other.view.code, otherBefore };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(f.code)!;
  return { version: row.version, hash: createHash('sha256').update(String(row.state)).digest('hex') };
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  const before = snapshot(f);
  for (const [index, credential] of f.credentials.entries()) {
    const auth = await rooms.authenticate(f.code, credential);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, f.ids[index]));
    for (const opponent of view.players.filter((seat) => seat.id !== auth.playerId)) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.spice, undefined);
    }
    if (index !== 0) {
      if (view.grummanCollection) {
        assert.deepEqual(view.grummanCollection.tokens, []);
        assert.deepEqual(view.grummanCollection.destinations, []);
      }
      assert.equal(view.terrorEntry?.candidates, undefined);
      assert.equal(view.terrorEntry?.kind, undefined);
      for (const placed of view.moritaniTerror!.tokens.filter((candidate) => candidate.status === 'placed'))
        assert.equal('kind' in placed, false);
    }
  }
  homeworldGameIntegrity(g);
  grummanInventory(g);
  assert.deepEqual(snapshot(f), before);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function act(f: Fixture, g: Game, actor: string, action: engine.Action) {
  const rooms = f.restart();
  await rooms.act(f.code, f.auths.find((auth) => auth.playerId === actor)!, g.version, action, clock);
  return rooms.readRoom(f.code);
}
function barrier(f: Fixture) {
  let count = 0;
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++count === 2) release(); await wait; };
}
async function opened(f: Fixture) {
  const g = await act(f, f.initial, f.initial.active!, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  assert.equal(g.decision?.kind, 'grummanCollection');
  assert.equal(g.grummanCollection?.stage, 'choice');
  assert.equal(g.moritaniTerror!.placementTurn, 1);
  await restored(f, g);
  f.writes.length = 0;
  return g;
}
function add(g: Game): engine.Action {
  return { type: 'decision', event: g.grummanCollection!.event, mode: 'add', token: token(g, 'sabotage').id, territory: 'arrakeen' };
}
async function stacked(f: Fixture) {
  const g = await opened(f);
  const added = await act(f, g, f.ids[0], add(g));
  const movement = stageGrummanArrival(added);
  f.save(movement);
  // The following actual paid shipment creates the original stack receipt.
  const entered = await act(f, movement, f.ids[1], { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1 });
  assert.equal(entered.pendingTerrorEntry?.stage, 'select');
  assert.equal(entered.pendingTerrorEntry?.candidates?.length, 2);
  assert.equal(entered.pendingTerrorEntry?.amount, 1);
  assert.equal(entered.grummanCollection?.outcome, 'add');
  await restored(f, entered);
  f.writes.length = 0;
  return entered;
}

void test('production SQL competing Grumman add and decline commit one token change and at most four spice', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const rooms = await restored(f, g);
    barrier(f);
    const outcomes = await Promise.allSettled([
      rooms.act(f.code, f.auths[0], g.version, add(g), clock),
      f.rooms.act(f.code, f.auths[0], g.version, { type: 'decision', event: g.grummanCollection!.event, decline: true }, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
    const done = await rooms.readRoom(f.code);
    const added = done.grummanCollection!.outcome === 'add';
    assert.equal(done.grummanCollection!.stage, 'complete');
    assert.equal(done.version, g.version + 1);
    assert.equal(p(done, f.ids[0]).spice, p(g, f.ids[0]).spice + (added ? 4 : 0));
    assert.equal(token(done, 'sabotage').status, added ? 'placed' : 'available');
    assert.deepEqual(token(done, 'robbery'), token(g, 'robbery'));
    assert.equal(done.moritaniTerror!.placementTurn, 1);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, add(g), clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL lost Grumman add response preserves four spice and independent same-turn Mentat placement', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    await f.rooms.act(f.code, f.auths[0], g.version, add(g), clock);
    const rooms = f.restart();
    let done = await rooms.readRoom(f.code);
    assert.equal(p(done, f.ids[0]).spice, p(g, f.ids[0]).spice + 4);
    assert.equal(done.moritaniTerror!.tokens.filter((value) => value.location === 'arrakeen').length, 2);
    assert.equal(done.moritaniTerror!.placementTurn, 1);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], g.version, add(g), clock));
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, add(g), clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
    for (const id of f.ids) {
      if (done.phase !== 7) break;
      done = await act(f, done, id, { type: 'ready' });
    }
    assert.equal(done.phase, 8);
    assert.equal(done.decision?.kind, 'moritaniPlacement');
    const extra = token(done, 'sneakAttack').id;
    done = await act(f, done, f.ids[0], { type: 'decision', token: extra, territory: 'carthag' });
    for (let n = 0; done.response?.kind === 'moritaniPlacement' && n < 20; n++)
      done = await act(f, done, done.players.find((seat) => !done.response!.passed.includes(seat.id))!.id, { type: 'passResponse' });
    assert.equal(token(done, 'sneakAttack').location, 'carthag');
    assert.equal(done.moritaniTerror!.placementTurn, g.turn);
    assert.equal(done.grummanCollection!.outcome, 'add');
    assert.equal(p(done, f.ids[0]).spice, p(g, f.ids[0]).spice + 4);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL guarded removal and declined Grumman choice never pay or change token custody', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const before = snapshot(f);
    await assert.rejects(f.rooms.act(f.code, f.auths[0], g.version, {
      type: 'decision', event: g.grummanCollection!.event, mode: 'remove', token: token(g, 'robbery').id,
    }, clock));
    assert.deepEqual(snapshot(f), before);
    assert.equal(f.writes.length, 0);
    const done = await act(f, g, f.ids[0], { type: 'decision', event: g.grummanCollection!.event, decline: true });
    assert.equal(done.grummanCollection!.outcome, 'decline');
    assert.deepEqual(done.moritaniTerror, g.moritaniTerror);
    assert.equal(p(done, f.ids[0]).spice, p(g, f.ids[0]).spice);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

// Signatures are deterministic consistency receipts. These scenarios retain
// original evidence; they do not claim cryptographic protection from wholesale
// rewriting of every stored field and its matching receipt.
void test('production SQL Grumman phase and completion corruption rejects all seat views and writes', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const completed = await act(f, g, f.ids[0], add(g));
    const cases: [Game, (state: Game) => void][] = [
      [g, (state) => { delete state.grummanCollection; }],
      [g, (state) => { state.decision = null; }],
      [g, (state) => { state.grummanCollection!.event = 'another'; }],
      [g, (state) => { state.grummanCollection!.player = f.ids[1]; }],
      [g, (state) => { state.grummanCollection!.turn--; }],
      [g, (state) => { state.grummanCollection!.signature = 'altered'; }],
      [completed, (state) => { state.grummanCollection!.stage = 'choice'; delete state.grummanCollection!.outcome; delete state.grummanCollection!.token; delete state.grummanCollection!.territory; state.decision = { kind: 'grummanCollection', player: f.ids[0], event: g.grummanCollection!.event }; }],
      [completed, (state) => { state.grummanCollection!.token = token(state, 'robbery').id; }],
      [completed, (state) => { state.grummanCollection!.territory = 'carthag'; }],
    ];
    for (const [original, mutate] of cases) {
      const corrupt = reload(original);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, add(g), clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});

void test('production SQL two competing stacked-token choices preserve one selected identity and original paid entry', async () => {
  const f = await persisted();
  try {
    const g = await stacked(f);
    const candidates = g.pendingTerrorEntry!.candidates!;
    const rooms = await restored(f, g);
    barrier(f);
    const results = await Promise.allSettled(candidates.map((id) =>
      rooms.act(f.code, f.auths[0], g.version, { type: 'decision', token: id }, clock)));
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
    const selected = await rooms.readRoom(f.code);
    assert.equal(selected.pendingTerrorEntry?.stage, 'offer');
    assert.ok(candidates.includes(selected.pendingTerrorEntry!.token));
    for (const field of ['candidates', 'entrant', 'territory', 'sector', 'amount', 'elite', 'cause', 'turn', 'phase', 'resume'] as const)
      assert.deepEqual(selected.pendingTerrorEntry![field], g.pendingTerrorEntry![field]);
    assert.equal(typeof selected.pendingTerrorEntry?.selectionSignature, 'string');
    assert.deepEqual(selected.moritaniTerror, g.moritaniTerror);
    assert.equal(p(selected, f.ids[1]).reserves, p(g, f.ids[1]).reserves);
    assert.deepEqual(p(selected, f.ids[1]).forces, p(g, f.ids[1]).forces);
    assert.equal(p(selected, f.ids[1]).spice, p(g, f.ids[1]).spice);
    await restored(f, selected);
    const done = await act(f, selected, f.ids[0], { type: 'decision', decline: true });
    assert.equal(done.pendingTerrorEntry, null);
    assert.deepEqual(done.moritaniTerror, g.moritaniTerror);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, { type: 'decision', token: candidates[1] }, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL selected Robbery reveals only that token and resolves one income after restart', async () => {
  const f = await persisted();
  try {
    let g = await stacked(f);
    const original = reload(g);
    g = await act(f, g, f.ids[0], { type: 'decision', token: token(g, 'robbery').id });
    await restored(f, g);
    g = await act(f, g, f.ids[0], { type: 'decision', reveal: true });
    assert.equal(g.pendingTerrorEntry?.stage, 'robbery');
    assert.equal(token(g, 'robbery').status, 'removed');
    assert.deepEqual(token(g, 'sabotage'), token(original, 'sabotage'));
    const rooms = await restored(f, g);
    const expected = Math.ceil(p(g, f.ids[1]).spice / 2);
    await rooms.act(f.code, f.auths[0], g.version, { type: 'decision', choice: 'spice' }, clock);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.pendingTerrorEntry, null);
    assert.equal(p(done, f.ids[0]).spice, p(g, f.ids[0]).spice + expected);
    assert.equal(p(done, f.ids[1]).spice, p(g, f.ids[1]).spice - expected);
    assert.equal(token(done, 'sabotage').status, 'placed');
    assert.deepEqual(p(done, f.ids[1]).forces, p(original, f.ids[1]).forces);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, { type: 'decision', choice: 'spice' }, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL stacked original candidates, selected identity and physical custody cannot be edited across reload', async () => {
  const f = await persisted();
  try {
    const g = await stacked(f);
    const selected = await act(f, g, f.ids[0], { type: 'decision', token: token(g, 'sabotage').id });
    const cases: [Game, (state: Game) => void][] = [
      [g, (state) => { state.pendingTerrorEntry!.candidates!.reverse(); }],
      [g, (state) => { state.pendingTerrorEntry!.candidates!.push(state.pendingTerrorEntry!.candidates![0]); }],
      [g, (state) => { delete state.pendingTerrorEntry!.candidates; }],
      [g, (state) => { state.pendingTerrorEntry!.amount++; }],
      [g, (state) => { token(state, 'sabotage').location = 'carthag'; }],
      [g, (state) => { token(state, 'sabotage').status = 'removed'; token(state, 'sabotage').location = null; }],
      [selected, (state) => { state.pendingTerrorEntry!.token = token(state, 'robbery').id; }],
      [selected, (state) => { delete state.pendingTerrorEntry!.selectionSignature; }],
      [selected, (state) => { state.pendingTerrorEntry!.selectionSignature = 'another-selection'; }],
      [selected, (state) => {
        state.pendingTerrorEntry!.stage = 'select';
        state.pendingTerrorEntry!.token = state.pendingTerrorEntry!.candidates![0];
        delete state.pendingTerrorEntry!.selectionSignature;
      }],
    ];
    for (const [original, mutate] of cases) {
      const corrupt = reload(original);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, { type: 'decision', decline: true }, clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});
