import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
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

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(kind: 'shipment' | 'treachery') {
  const store = unitStore();
  const made = await store.rooms.createRoom('Payment recovery', 'emperor', true, []);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['atreides', 'guild'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = engine.applyAction(g, p.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: engine.Game | undefined;
    for (const p of g.players) {
      const v = engine.viewGame(g, p.id);
      v.players.find(seat => seat.id === p.id)!.bot = 'Easy';
      const action = bots.botActions(v)[0];
      if (action) { next = engine.applyAction(g, p.id, action); break; }
    }
    assert.ok(next); g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) { g.deck.push(...p.hand.splice(0)); p.spice = 20; }
  const [emperor, buyer, guild] = g.players;
  // Advanced Salusa retains five Sardaukar; Kaitain has four native normals.
  emperor.reserves = 9; emperor.forces = { 'polar_sink:0': 11 };
  guild.reserves = 3; guild.forces = { 'polar_sink:0': 17 };
  const at = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(at >= 0);
  const karama = g.deck.splice(at, 1)[0];
  buyer.hand.push(karama);
  Object.assign(g, { turn: 2, phase: kind === 'shipment' ? 5 : 2, storm: 18,
    active: kind === 'shipment' ? buyer.id : null,
    order: g.players.map(p => p.id), movementRemaining: g.players.map(p => p.id),
    ready: [], decision: null, response: null, phaseOpening: null });
  homeworldGameIntegrity(g);
  if (kind === 'shipment') {
    g = engine.applyAction(g, buyer.id, { type: 'ship', territory: 'carthag', sector: 11, amount: 3 });
  } else {
    for (const p of g.players) g = engine.applyAction(g, p.id, { type: 'ready' });
    for (let n = 0; g.auction?.active !== buyer.id && n < 6; n++)
      g = engine.applyAction(g, g.auction!.active, { type: 'passBid' });
    g = engine.applyAction(g, buyer.id, { type: 'bid', amount: 5 });
    for (let n = 0; !g.response && !g.decision && g.auction && n < 8; n++)
      g = engine.applyAction(g, g.auction.active, { type: 'passBid' });
  }
  if (g.decision?.kind === 'guildShipment') g = engine.applyAction(g, g.decision.player, { type: 'decision', allow: true });
  if (g.decision?.kind === 'auctionPayment') g = engine.applyAction(g, g.decision.player, { type: 'decision', karama: false });
  assert.equal(g.response?.kind, kind === 'shipment' ? 'guildIncome' : 'emperorIncome');
  const save = (state: engine.Game) => store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(state), state.version, code);
  save(g); store.writes.length = 0;
  return { ...store, code, auths, initial: g, save, karama,
    owner: kind === 'shipment' ? guild.id : emperor.id, payer: buyer.id,
    gross: kind === 'shipment' ? 3 : 5, income: kind === 'shipment' ? 2 : 3 };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function restore(f: Fixture) {
  const state = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), state);
  homeworldGameIntegrity(state);
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, auth);
    for (const p of view.players) {
      const physical = state.players.find(seat => seat.id === p.id)!;
      assert.equal(p.spice, p.id === auth.playerId ? physical.spice : undefined);
      assert.deepEqual(p.hand, p.id === auth.playerId ? physical.hand : undefined);
    }
    if (state.response) assert.deepEqual(view.paymentIncome, {
      owner: f.owner, kind: state.response.kind === 'guildIncome' ? 'shipment' : 'treachery',
      gross: f.gross, income: f.income, bank: f.gross - f.income, low: true,
    });
  }
  return state;
}
for (const kind of ['shipment', 'treachery'] as const)
  for (const canceled of [false, true])
    void test(`low Homeworld ${kind} income ${canceled ? 'cancellation' : 'allowance'} restores private seats and settles once across SQL workers`, async () => {
      const f = await fixture(kind);
      try {
        const before = await restore(f);
        let arrivals = 0; let release!: () => void;
        const wait = new Promise<void>(resolve => { release = resolve; });
        f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await wait; };
        const action: engine.Action = canceled ? { type: 'card', mode: 'cancel', card: f.karama.id } : { type: 'passResponse' };
        const results = await Promise.allSettled([
          f.rooms.act(f.code, f.auths[1], before.version, action, clock),
          f.restart().act(f.code, f.auths[1], before.version, action, clock),
        ]);
        delete f.hooks.beforeWrite;
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.deepEqual(f.writes.map(w => w.changes).sort((a, b) => a - b), [0, 1]);
        const after = await restore(f);
        assert.equal(after.version, before.version + 1);
        assert.equal(after.players.find(p => p.id === f.owner)!.spice, 20 + (canceled ? 0 : f.income));
        assert.equal(after.players.find(p => p.id === f.payer)!.spice, 20 - f.gross);
        assert.deepEqual(after.players.map(p => [p.reserves, p.forces, p.elites]), before.players.map(p => [p.reserves, p.forces, p.elites]));
        await assert.rejects(f.restart().act(f.code, f.auths[1], before.version, action, clock));
        assert.deepEqual(await f.restart().readRoom(f.code), after);
      } finally { f.sqlite.close(); }
    });

void test('malformed saved Homeworld payment contributions reject before a private read, normalization or SQL write', async () => {
  const f = await fixture('shipment');
  try {
    for (const corrupt of [
      (g: engine.Game) => { g.response!.amount = -3; },
      (g: engine.Game) => { g.response!.amount = 4; },
      (g: engine.Game) => { delete g.response!.guildContributions; },
      (g: engine.Game) => { delete g.response!.guildPaymentProof; },
      (g: engine.Game) => { g.response!.guildContributions = [1, 1]; },
    ]) {
      const broken = structuredClone(f.initial); corrupt(broken); f.save(broken);
      await assert.rejects(f.restart().readSeatView(f.code, f.auths[0]));
      assert.throws(() => engine.normalizeAutomaticGame(broken));
      await assert.rejects(f.restart().act(f.code, f.auths[1], broken.version, { type: 'passResponse' }, clock));
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.restart().readRoom(f.code), broken);
    }
  } finally { f.sqlite.close(); }
});
