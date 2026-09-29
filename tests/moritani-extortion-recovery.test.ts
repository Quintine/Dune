import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import * as seatAiDelegation from '../lib/seat-ai-delegation';
import type * as Rooms from '../db/rooms';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

/** Real room module and migrations, with a barrier immediately before the room CAS. */
function unitStore() {
  const sqlite = new DatabaseSync(':memory:');
  const hooks: { beforeWrite?: () => Promise<void> } = {};
  const writes: { expected: number; changes: number }[] = [];
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((name) => name.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
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
      const changes = Number(sqlite.prepare(this.sql).run(...this.values).changes);
      if (continuation) writes.push({ expected: Number(this.values[3]), changes });
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
      ts.transpileModule(readFileSync(new URL('../db/rooms.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        exports,
        crypto: webcrypto,
        TextEncoder,
        structuredClone,
        JSON,
        require: (name: string) => {
          if (name === 'cloudflare:workers') return { env: { DB: database } };
          if (name === '@/game/engine') return engine;
          if (name === '@/game/bots') return bots;
          if (name === '@/lib/seat-ai-delegation') return seatAiDelegation;
          throw new Error('Unexpected module ' + name);
        },
      },
    );
    return exports as typeof Rooms;
  }
  return { rooms: loadRooms(), restart: loadRooms, sqlite, hooks, writes };
}

async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom('Extortion seat', 'moritani', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Entrant', 'emperor');
  const witness = await store.rooms.joinRoom(code, 'Witness', 'atreides');
  const tokens = [created.token, joined.token!, witness.token!];
  const seats = await Promise.all(tokens.map((token) => store.restart().authenticate(code, token)));
  const ids = seats.map((seat) => seat.playerId);
  let g = await store.restart().readRoom(code);
  g.players = [
    engine.newPlayer(ids[0], 'Moritani', 'moritani'),
    engine.newPlayer(ids[1], 'Entrant', 'emperor'),
    engine.newPlayer(ids[2], 'Witness', 'atreides'),
  ];
  Object.assign(g, {
    status: 'playing', phase: 5, turn: 2, storm: 18, active: ids[1],
    order: [ids[1], ids[0], ids[2]], movementRemaining: [ids[1], ids[0], ids[2]],
    decision: null, response: null, phaseOpening: null, ready: [],
  });
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 12;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((item) => item.kind === 'extortion')!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  async function act(index: number, action: engine.Action) {
    const current = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], current.version, action, clock);
    return store.restart().readRoom(code);
  }
  g = await act(1, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 });
  assert.equal(g.decision?.kind, 'moritaniTerror');
  g = await act(0, { type: 'decision', reveal: true });
  assert.equal(g.moritaniTerror!.tokens.find((item) => item.kind === 'extortion')!.status, 'extortion');
  assert.equal(g.players[0].spice, 12);
  assert.equal((await store.restart().readSeatView(code, seats[1])).extortion.deferred, 5);
  return { ...store, code, tokens, seats, ids, act, revealed: g, token: token.id };
}

void test('SQLite reconnect preserves reserved bank award, payer privacy, and races one payment commit', async () => {
  const f = await fixture();
  try {
    let g = await f.restart().readRoom(f.code);
    g.phase = 7;
    g.ready = [];
    f.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, f.code);
    f.writes.length = 0;
    for (const [i] of f.seats.entries()) g = await f.act(i, { type: 'ready' });
    assert.equal(g.decision?.kind, 'moritaniPlacement');
    assert.equal(g.players[0].spice, 12);
    g = await f.act(0, { type: 'decision', decline: true });
    assert.equal(g.players[0].spice, 17);
    assert.ok(g.decision?.kind === 'moritaniExtortion');
    const event = g.decision.event;
    const payer = g.decision.player;
    const payerIndex = f.ids.indexOf(payer);
    assert.ok(payerIndex >= 0);
    for (const [i, seat] of f.seats.entries()) {
      const seatView = await f.restart().readSeatView(f.code, seat);
      assert.equal(seatView.extortion.deferred, 0);
      assert.equal(seatView.extortion.pending?.player, payer);
      assert.equal(seatView.extortion.pending?.canPay, i === payerIndex ? true : null);
      if (i !== 0)
        assert.equal(seatView.moritaniTerror!.tokens.some((item) => item.id !== f.token), false);
    }
    const before = structuredClone(g);
    await assert.rejects(f.restart().act(f.code, f.seats[0], g.version,
      { type: 'decision', event, pay: true }, clock));
    await assert.rejects(f.restart().act(f.code, f.seats[payerIndex], g.version,
      { type: 'decision', event: 'obsolete', pay: true }, clock));
    assert.deepEqual(await f.restart().readRoom(f.code), before);
    assert.equal(f.writes.length, f.seats.length + 1);
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([0, 1].map(() => f.restart().act(
        f.code, f.seats[payerIndex], g.version,
        { type: 'decision', event, pay: true }, clock,
      )));
    } finally {
      delete f.hooks.beforeWrite;
    }
    assert.equal(arrivals, 2);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.slice(-2).map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, g.version + 1);
    assert.equal(done.players[0].spice, 20);
    assert.equal(done.players[payerIndex].spice, g.players[payerIndex].spice - 3);
    assert.equal(done.moritaniTerror!.tokens.find((item) => item.kind === 'extortion')!.status, 'removed');
    await assert.rejects(f.restart().act(f.code, f.seats[payerIndex], g.version,
      { type: 'decision', event, pay: true }, clock), /table changed/i);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});
