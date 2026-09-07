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
import {
  createAmbassadors,
  placeAmbassador,
  validateAmbassadors,
} from '../game/ecaz-ambassadors';
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
const player = (g: engine.Game, id: string) =>
  g.players.find((p) => p.id === id)!;
const clone = (g: engine.Game): engine.Game => JSON.parse(JSON.stringify(g));
async function fixture(
  kind: 'clean' | 'guild' | 'bg' | 'chain' = 'clean',
  phase: 1 | 5 = 5,
) {
  const store = unitStore();
  const made = await store.rooms.createRoom('Ecaz', 'harkonnen', false, []);
  const code = made.view.code;
  const entrant = await store.rooms.joinRoom(
    code,
    'Entrant',
    phase === 1 ? 'fremen' : 'emperor',
  );
  const other = await store.rooms.joinRoom(
    code,
    'Other',
    kind === 'guild'
      ? 'guild'
      : kind === 'bg' || kind === 'chain'
        ? 'beneGesserit'
        : 'atreides',
  );
  const tokens = [made.token, entrant.token!, other.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const [ownerAuth, entrantAuth, otherAuth] = auths;
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(ownerAuth.playerId, 'Ecaz', 'ecaz');
  Object.assign(g, {
    status: 'playing',
    phase,
    turn: 2,
    advanced: true,
    expansions: ['ecaz'],
    storm: 18,
    active: phase === 5 ? entrantAuth.playerId : null,
    order: auths.map((a) => a.playerId),
    movementRemaining: [
      entrantAuth.playerId,
      ownerAuth.playerId,
      otherAuth.playerId,
    ],
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      hand: [],
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [p.leaders[0].id],
      traitorChoices: [],
      moved: 0,
      shipped: false,
    });
  const take = (
    id: string,
    predicate: (c: engine.Player['hand'][number]) => boolean,
  ) => {
    const at = g.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const c = g.deck.splice(at, 1)[0];
    player(g, id).hand.push(c);
    return c.id;
  };
  take(ownerAuth.playerId, (c) => c.kind === 'shield');
  const printed = take(entrantAuth.playerId, (c) => c.effect === 'karama');
  const otherCard = take(otherAuth.playerId, (c) =>
    kind === 'guild' ? c.effect === 'karama' : c.kind === 'worthless',
  );
  player(g, entrantAuth.playerId).forces = { 'imperial_basin:10': 2 };
  player(g, entrantAuth.playerId).reserves = 18;
  if (phase === 1) {
    player(g, entrantAuth.playerId).forces['hagga_basin:12'] = 1;
    player(g, entrantAuth.playerId).reserves = 17;
    Object.assign(g, {
      nexus: false,
      wormRides: ['hagga_basin'],
      decision: {
        kind: 'wormRide',
        player: entrantAuth.playerId,
        territory: 'imperial_basin',
      },
    });
  }
  if (kind === 'chain') {
    player(g, ownerAuth.playerId).forces = { 'red_chasm:7': 1 };
    player(g, ownerAuth.playerId).reserves = 19;
    player(g, otherAuth.playerId).forces = { 'carthag:11': 1 };
    player(g, otherAuth.playerId).reserves = 19;
  }
  const state = createAmbassadors(() => 0.3),
    selected = state.tokens.find((t) => t.effect === 'guild')!;
  state.cohort = [
    selected.id,
    ...state.tokens
      .filter((t) => t.effect !== 'ecaz' && t.id !== selected.id)
      .slice(0, 4)
      .map((t) => t.id),
  ];
  if (kind === 'chain')
    state.cohort[4] = state.tokens.find((t) => t.effect === 'fremen')!.id;
  for (const t of state.tokens) {
    t.zone =
      t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool';
    t.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(state, selected.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  if (kind === 'chain')
    g.ecazAmbassadors = placeAmbassador(
      g.ecazAmbassadors,
      g.ecazAmbassadors.tokens.find((t) => t.effect === 'fremen')!.id,
      {
        turn: 1,
        availableSpice: 20,
        destination: {
          id: 'carthag',
          stronghold: true,
          inStorm: false,
          allowed: true,
        },
      },
    ).state;
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  await store.rooms.act(
    code,
    entrantAuth,
    g.version,
    phase === 1
      ? {
          type: 'decision',
          accept: true,
          forces: { 'imperial_basin:10': 1 },
          territory: 'arrakeen',
          sector: 10,
        }
      : {
          type: 'move',
          forces: { 'imperial_basin:10': 1 },
          territory: 'arrakeen',
          sector: 10,
        },
    clock,
  );
  const arrived = await store.rooms.readRoom(code);
  assert.equal(arrived.pendingAmbassador?.stage, 'offer');
  const event = arrived.pendingAmbassador!.event;
  await store.rooms.act(
    code,
    ownerAuth,
    arrived.version,
    { type: 'decision', event, trigger: true, beneficiary: ownerAuth.playerId },
    clock,
  );
  const pending = await store.rooms.readRoom(code);
  assert.equal(pending.pendingAmbassador?.stage, 'ship');
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    ownerAuth,
    entrantAuth,
    otherAuth,
    printed,
    otherCard,
    save,
    pending,
    event,
    ship: {
      type: 'decision',
      event,
      amount: 3,
      territory: 'carthag',
      sector: 11,
    } as engine.Action,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function barrier() {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await wait;
  };
}
async function race(
  f: Fixture,
  auth: Rooms.SeatAuth,
  g: engine.Game,
  action: engine.Action,
) {
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const results = await Promise.allSettled([
    f.rooms.act(f.code, auth, g.version, action, clock),
    f.restart().act(f.code, auth, g.version, action, clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await f.rooms.readRoom(f.code);
  assert.equal(after.version, g.version + 1);
  return after;
}
async function act(f: Fixture, auth: Rooms.SeatAuth, action: engine.Action) {
  const state = await f.rooms.readRoom(f.code);
  await f.rooms.act(f.code, auth, state.version, action, clock);
  return f.rooms.readRoom(f.code);
}
async function fresh(f: Fixture) {
  f.rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((token) => f.rooms.authenticate(f.code, token)),
  );
  assert.deepEqual(
    auths.map((a) => a.playerId),
    f.auths.map((a) => a.playerId),
  );
  return auths;
}
function conserved(g: engine.Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}
function shipmentCount(g: engine.Game) {
  return g.log.filter((l) => l.automatic?.name === 'Guild Ambassador shipment')
    .length;
}
async function privateViews(f: Fixture, g: engine.Game) {
  for (const auth of f.auths) {
    const v = await f.rooms.readSeatView(f.code, auth);
    assert.deepEqual(
      v.players.find((p) => p.id === auth.playerId)!.hand,
      player(g, auth.playerId).hand,
    );
    assert.ok(v.players.every((p) => p.id === auth.playerId || !('hand' in p)));
    assert.equal('pendingShipment' in v, false);
    assert.equal('pendingAmbassador' in v, false);
  }
}

void test('a real free shipment survives module restart and racing authenticated requests with one CAS debit and no neighboring-room writes', async () => {
  const f = await fixture();
  try {
    const neighbor = await f.rooms.createRoom(
      'Unrelated human',
      'atreides',
      false,
      [],
    );
    const untouched = await f.rooms.readRoom(neighbor.view.code);
    const auths = await fresh(f);
    const before = await f.rooms.readRoom(f.code);
    await privateViews(f, before);
    for (const auth of auths) {
      const v = await f.rooms.readSeatView(f.code, auth);
      assert.equal(
        !!v.ambassadorEntry?.shipment,
        auth.playerId === f.ownerAuth.playerId,
      );
    }
    const after = await race(f, auths[0], before, f.ship);
    assert.equal(after.pendingAmbassador, null);
    assert.equal(player(after, f.ownerAuth.playerId).reserves, 17);
    assert.equal(player(after, f.ownerAuth.playerId).forces['carthag:11'], 3);
    assert.equal(shipmentCount(after), 1);
    assert.deepEqual(after.movementRemaining, before.movementRemaining);
    for (const p of before.players) {
      const now = player(after, p.id);
      assert.equal(now.moved, p.moved);
      assert.equal(now.shipped, p.shipped);
      assert.equal(now.spice, p.spice);
    }
    conserved(after);
    f.writes.length = 0;
    await assert.rejects(
      f.rooms.act(f.code, auths[0], before.version, f.ship, clock),
    );
    await assert.rejects(
      f.rooms.act(f.code, auths[0], after.version, f.ship, clock),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), after);
    assert.deepEqual(await f.rooms.readRoom(neighbor.view.code), untouched);
  } finally {
    f.sqlite.close();
  }
});
void test('a persisted Guild special decision allows or stops the independent shipment exactly once and leaves the ordinary allowance unused', async () => {
  for (const stop of [false, true]) {
    const f = await fixture('guild');
    try {
      let g = await act(f, f.ownerAuth, f.ship);
      assert.equal(g.decision?.kind, 'guildShipment');
      assert.equal(g.pendingShipment?.source, 'ambassador');
      assert.equal(player(g, f.ownerAuth.playerId).reserves, 20);
      const auths = await fresh(f);
      await privateViews(f, g);
      g = await race(
        f,
        auths[2],
        g,
        stop
          ? { type: 'card', mode: 'special', card: f.otherCard }
          : { type: 'decision', allow: true },
      );
      assert.equal(g.pendingAmbassador, null);
      assert.equal(g.pendingShipment, null);
      assert.equal(player(g, f.ownerAuth.playerId).reserves, stop ? 20 : 17);
      assert.equal(player(g, f.ownerAuth.playerId).shipped, false);
      assert.equal(player(g, f.ownerAuth.playerId).moved, 0);
      assert.equal(shipmentCount(g), stop ? 0 : 1);
      assert.equal(
        g.discard.filter((c) => c.id === f.otherCard).length,
        stop ? 1 : 0,
      );
      assert.equal(player(g, f.otherAuth.playerId).spice, 20);
      conserved(g);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('BG accompaniment response reloads privately and racing printed cancellation or allowance consumes no primary shipment twice', async () => {
  for (const cancel of [false, true]) {
    const f = await fixture('bg');
    try {
      let g = await act(f, f.ownerAuth, f.ship);
      assert.equal(g.decision?.kind, 'advisor');
      g = await act(f, f.otherAuth, {
        type: 'decision',
        accept: true,
        accompany: true,
      });
      assert.equal(g.response?.kind, 'advisor');
      await fresh(f);
      await privateViews(f, g);
      const action: engine.Action = cancel
        ? { type: 'card', mode: 'cancel', card: f.printed }
        : { type: 'passResponse' };
      g = await race(f, f.entrantAuth, g, action);
      assert.equal(g.pendingAmbassador, null);
      assert.equal(player(g, f.ownerAuth.playerId).reserves, 17);
      assert.equal(player(g, f.otherAuth.playerId).reserves, cancel ? 20 : 19);
      assert.equal(
        player(g, f.otherAuth.playerId).forces['carthag:11'] ?? 0,
        cancel ? 0 : 1,
      );
      assert.equal(
        g.discard.filter((c) => c.id === f.printed).length,
        cancel ? 1 : 0,
      );
      assert.equal(shipmentCount(g), 1);
      conserved(g);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('chained BG-fighter Ambassador refresh retains the original movement or worm parent until the new effect resolves', async () => {
  for (const phase of [5, 1] as const) {
    const f = await fixture('chain', phase);
    try {
      let g = await act(f, f.ownerAuth, f.ship);
      assert.equal(g.decision?.kind, 'intrusion');
      g = await act(f, f.otherAuth, { type: 'decision', accept: false });
      g = await act(f, f.otherAuth, {
        type: 'decision',
        accept: true,
        accompany: true,
      });
      assert.equal(g.response?.kind, 'advisor');
      g = await race(f, f.entrantAuth, g, { type: 'passResponse' });
      assert.equal(g.pendingAmbassador?.stage, 'offer');
      assert.equal(g.pendingAmbassador?.entrant, f.otherAuth.playerId);
      assert.notEqual(g.pendingAmbassador?.event, f.event);
      assert.equal(g.pendingAmbassador?.effect, undefined);
      const childEvent = g.pendingAmbassador!.event;
      await fresh(f);
      await privateViews(f, g);
      g = await act(f, f.ownerAuth, {
        type: 'decision',
        event: childEvent,
        trigger: true,
        beneficiary: f.ownerAuth.playerId,
      });
      assert.equal(g.pendingAmbassador?.stage, 'move');
      await fresh(f);
      g = await race(f, f.ownerAuth, g, {
        type: 'decision',
        event: childEvent,
        forces: { 'red_chasm:7': 1 },
        territory: 'sietch_tabr',
        sector: 14,
      });
      assert.equal(g.pendingAmbassador, null);
      assert.equal(player(g, f.ownerAuth.playerId).reserves, 16);
      assert.equal(player(g, f.ownerAuth.playerId).forces['carthag:11'], 3);
      assert.equal(player(g, f.ownerAuth.playerId).forces['sietch_tabr:14'], 1);
      assert.equal(player(g, f.otherAuth.playerId).forces['carthag:11'], 2);
      assert.equal(shipmentCount(g), 1);
      if (phase === 1) {
        assert.deepEqual(g.decision, {
          kind: 'wormRide',
          player: f.entrantAuth.playerId,
          territory: 'hagga_basin',
        });
        assert.deepEqual(g.wormRides, []);
      } else {
        assert.equal(g.decision, null);
        assert.equal(g.active, f.entrantAuth.playerId);
      }
      conserved(g);
    } finally {
      f.sqlite.close();
    }
  }
});
void test('corrupted completed shipment or advisor parent bindings reject after restart with zero SQL changes', async () => {
  const f = await fixture('bg');
  try {
    const valid = await act(f, f.ownerAuth, f.ship);
    assert.equal(valid.decision?.kind, 'advisor');
    const mutations: ((g: engine.Game) => void)[] = [
      (g) => {
        g.pendingAmbassador!.event = 'different-parent';
      },
      (g) => {
        g.pendingAmbassador!.shipmentReceipt!.order.player =
          f.entrantAuth.playerId;
      },
      (g) => {
        g.pendingAmbassador!.shipmentReceipt!.order.cost = 1 as 0;
      },
      (g) => {
        g.pendingAmbassador!.turn++;
      },
    ];
    for (const mutate of mutations) {
      const bad = clone(valid);
      mutate(bad);
      f.save(bad);
      await fresh(f);
      f.writes.length = 0;
      await assert.rejects(f.rooms.readSeatView(f.code, f.otherAuth));
      await assert.rejects(
        f.rooms.act(
          f.code,
          f.otherAuth,
          bad.version,
          { type: 'decision', accept: false },
          clock,
        ),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), bad);
    }
    f.save(valid);
    f.writes.length = 0;
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.ownerAuth,
        valid.version,
        { type: 'decision', accept: false },
        clock,
      ),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.otherAuth,
        valid.version - 1,
        { type: 'decision', accept: false },
        clock,
      ),
    );
    assert.equal(f.writes.length, 0);
    const done = await act(f, f.otherAuth, { type: 'decision', accept: false });
    assert.equal(done.pendingAmbassador, null);
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});
void test('a recovered committed shipment with no remaining reserves automatically finishes once under competing workers', async () => {
  const f = await fixture();
  try {
    const waiting = clone(f.pending);
    const owner = player(waiting, f.ownerAuth.playerId);
    owner.tanks += owner.reserves;
    owner.reserves = 0;
    f.save(waiting);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      f.restart().continueRoomAutomatic(f.code, clock),
    ]);
    delete f.hooks.beforeWrite;
    const done = await f.rooms.readRoom(f.code);
    assert.equal(done.version, waiting.version + 1);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.decision, null);
    assert.equal(shipmentCount(done), 0);
    assert.equal(
      done.log.filter((l) =>
        l.text.includes('has no available physical Guild Ambassador shipment'),
      ).length,
      1,
    );
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(player(done, f.ownerAuth.playerId).shipped, false);
    conserved(done);
    f.writes.length = 0;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});
