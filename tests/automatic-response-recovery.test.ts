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
      const continuation =
        this.sql.startsWith('UPDATE rooms SET state') &&
        !this.sql.includes('EXISTS');
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
  return { rooms: exports as typeof Rooms, sqlite, hooks, writes };
}

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

function emptyMarketState(f: Awaited<ReturnType<typeof fixture>>) {
  const g = structuredClone(f.initial);
  g.players[0] = engine.newPlayer(f.auth.playerId, 'CHOAM', 'choam');
  for (const player of g.players) {
    player.hand = [];
    player.spice = 10;
  }
  g.phase = 3;
  g.auction = null;
  g.response = null;
  g.deck = baseDeck();
  g.discard = [];
  g.choamMarket = { owner: f.auth.playerId, resume: 'phase', blocked: [] };
  g.decision = { kind: 'choamMarket', player: f.auth.playerId };
  g.aid = { [f.auth.playerId]: { recipient: 'emperor', amount: 2 } };
  return g;
}

void test('recovery finishes a choice-free CHOAM market and credits escrow refund once', async () => {
  const f = await fixture();
  try {
    const initial = emptyMarketState(f);
    f.save(initial);
    const snapshot = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(snapshot.decision?.kind, 'choamMarket');
    assert.deepEqual(await f.rooms.readRoom(f.code), initial);
    assert.equal(f.writes.length, 0);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.phase, 4);
    assert.equal(next.choamMarket, null);
    assert.equal(next.decision, null);
    assert.equal(next.players[0].spice, 12);
    assert.deepEqual(next.aid, {});
    assert.equal(next.version, initial.version + 1);
    const notification = next.log.filter(
      (entry) => entry.automatic?.name === 'Market complete',
    );
    assert.equal(notification.length, 1);
    assert.equal(notification[0].automatic?.faction, 'choam');
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), next);
    assert.equal(f.writes.length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('competing workers finish an empty market without duplicate escrow refund or announcements', async () => {
  const f = await fixture();
  try {
    const initial = emptyMarketState(f);
    f.save(initial);
    const gate = deferred();
    let arrivals = 0;
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) gate.resolve();
      await gate.promise;
    };
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.phase, 4);
    assert.equal(next.version, initial.version + 1);
    assert.equal(next.players[0].spice, 12);
    assert.equal(
      next.log.filter((entry) => entry.automatic?.name === 'Market complete')
        .length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('market recovery preserves a possible incoming card choice without inspecting its hidden identity', async () => {
  const f = await fixture();
  try {
    const initial = emptyMarketState(f);
    initial.players[1].hand = initial.deck.splice(0, 2);
    f.save(initial);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), initial);
    assert.equal(f.writes.length, 0);
    const view = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(view.players[1].hand, undefined);
    assert.equal(view.decision?.kind, 'choamMarket');
    assert.equal(view.players[0].spice, 10);
  } finally {
    f.sqlite.close();
  }
});

async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom('Owner', 'harkonnen', false, []);
  const code = created.view.code;
  const auth = await store.rooms.authenticate(code, created.token);
  const g = await store.rooms.readRoom(code);
  g.players.push(engine.newPlayer('emperor', 'Emperor', 'emperor'));
  g.players.push(engine.newPlayer('guild', 'Guild', 'guild'));
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  g.order = g.players.map((p) => p.id);
  g.active = auth.playerId;
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  const cards = baseDeck();
  const shield = cards.find((c) => c.kind === 'shield')!;
  const bonus = cards.find((c) => c.kind === 'worthless')!;
  g.players[0].hand = [shield];
  g.deck = [bonus];
  g.auction = {
    cards: [shield],
    index: 0,
    bid: 4,
    bidder: auth.playerId,
    active: auth.playerId,
    passed: ['emperor', 'guild'],
    opener: 0,
    peekKnown: false,
  };
  g.response = { kind: 'emperorIncome', owner: 'emperor', passed: [] };
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  return {
    ...store,
    code,
    auth,
    token: created.token,
    initial: g,
    bonus,
    save,
  };
}
function assertSettled(g: engine.Game, owner: string) {
  assert.equal(g.response, null);
  assert.equal(g.players.find((p) => p.id === 'emperor')!.spice, 14);
  assert.equal(g.players.find((p) => p.id === owner)!.hand.length, 2);
  assert.equal(g.deck.length, 0);
  assert.deepEqual(
    g.log.filter((e) => e.automatic).map((e) => e.automatic!.name),
    ['Auction income', 'Bonus treachery card'],
  );
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function route(
  store: ReturnType<typeof unitStore>,
  automatic: (code: string) => Promise<void>,
  run: (code: string) => Promise<void>,
) {
  const pending: Promise<void>[] = [];
  const exports: {
    GET?: (req: Request) => Promise<Response>;
    POST?: (req: Request) => Promise<Response>;
  } = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../app/api/rooms/[code]/route.ts', import.meta.url),
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      URL,
      Response,
      JSON,
      require: (name: string) => {
        if (name === '@/db/rooms')
          return {
            ...store.rooms,
            continueRoomAutomatic: automatic,
            continueRoomBots: run,
          };
        if (name === '@/game/engine') return engine;
        if (name === 'cloudflare:workers')
          return { waitUntil: (work: Promise<void>) => pending.push(work) };
        throw new Error('Unexpected route dependency ' + name);
      },
    },
  );
  return { GET: exports.GET!, POST: exports.POST!, pending };
}
function request(f: { code: string; token: string }) {
  return new Request(`http://localhost/api/rooms/${f.code}`, {
    headers: { cookie: `dune_${f.code}=${f.token}` },
  });
}

void test('private reads have no automatic effect; persisted recovery settles income and hidden bonus exactly once', async () => {
  const f = await fixture();
  try {
    const before = JSON.stringify(await f.rooms.readRoom(f.code));
    const view = await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(view.response?.kind, 'emperorIncome');
    assert.equal(view.players.find((p) => p.id === 'emperor')!.hand, undefined);
    assert.equal('deck' in view, false);
    assert.equal(JSON.stringify(await f.rooms.readRoom(f.code)), before);
    assert.equal(f.writes.length, 0);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    const settled = await f.rooms.readRoom(f.code);
    assertSettled(settled, f.auth.playerId);
    assert.equal(settled.version, f.initial.version + 1);
    assert.equal(settled.botsPending, false);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), settled);
    assert.equal(f.writes.length, 1);
    const publicView = engine.viewGame(settled, 'guild');
    assert.equal(publicView.players[0].hand, undefined);
    assert.equal(JSON.stringify(publicView).includes(f.bonus.id), false);
  } finally {
    f.sqlite.close();
  }
});

void test('competing automatic workers commit one income/draw sequence through production CAS', async () => {
  const f = await fixture();
  try {
    const gate = deferred();
    let arrivals = 0;
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) gate.resolve();
      await gate.promise;
    };
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    const settled = await f.rooms.readRoom(f.code);
    assertSettled(settled, f.auth.playerId);
    assert.equal(settled.version, f.initial.version + 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('takeback winning the CAS survives automatic recovery and does not re-enable autopilot', async () => {
  const f = await fixture();
  try {
    f.initial.players[0].autopilot = 'Hard';
    f.initial.botsPending = true;
    f.initial.botNextActionAt = 11500;
    f.save(f.initial);
    f.hooks.beforeWrite = async () => {
      f.hooks.beforeWrite = undefined;
      await f.rooms.act(
        f.code,
        f.auth,
        f.initial.version,
        { type: 'setAutopilot', difficulty: null },
        clock,
      );
    };
    await f.rooms.continueRoomAutomatic(f.code, clock);
    const settled = await f.rooms.readRoom(f.code);
    assertSettled(settled, f.auth.playerId);
    assert.equal(settled.players[0].autopilot, undefined);
    assert.equal(settled.botsPending, false);
    assert.equal(settled.botNextActionAt, undefined);
    assert.equal(settled.version, f.initial.version + 2);
    assert.deepEqual(
      f.writes.map((w) => w.changes),
      [0, 1],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('bounded recovery stops after four lost CAS writes and remains recoverable on the next request', async () => {
  const f = await fixture();
  try {
    f.hooks.beforeWrite = async () => {
      const latest = await f.rooms.readRoom(f.code);
      latest.version++;
      f.save(latest);
    };
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 4);
    assert.ok(f.writes.every((w) => w.changes === 0));
    const pending = await f.rooms.readRoom(f.code);
    assert.equal(pending.response?.kind, 'emperorIncome');
    assert.equal(pending.players[1].spice, 10);
    assert.equal(pending.deck.length, 1);
    f.hooks.beforeWrite = undefined;
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assertSettled(await f.rooms.readRoom(f.code), f.auth.playerId);
  } finally {
    f.sqlite.close();
  }
});

void test('a genuinely cancelable legacy response remains available without metadata-only writes', async () => {
  const f = await fixture();
  try {
    const karama = baseDeck().find((c) => c.effect === 'karama')!;
    f.initial.players[2].hand = [karama];
    f.save(f.initial);
    const before = await f.rooms.readRoom(f.code);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), before);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('overlapping authenticated GETs share one worker promise, return private snapshots, and restart after completion', async () => {
  const f = await fixture();
  const gate = deferred();
  try {
    let automaticCalls = 0,
      botCalls = 0;
    const r = route(
      f,
      async (code) => {
        automaticCalls++;
        await gate.promise;
        await f.rooms.continueRoomAutomatic(code, clock);
      },
      async () => {
        botCalls++;
      },
    );
    const responses = await Promise.all([
      r.GET(request(f)),
      r.GET(request(f)),
      r.GET(request(f)),
    ]);
    assert.equal(automaticCalls, 1);
    assert.equal(r.pending.length, 3);
    assert.ok(r.pending.every((work) => work === r.pending[0]));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const view = (await response.json()) as engine.GameView;
      assert.equal(view.version, f.initial.version);
      assert.equal(view.me, f.auth.playerId);
      assert.equal(view.response?.kind, 'emperorIncome');
      assert.equal(view.players[1].hand, undefined);
      assert.equal('deck' in view, false);
    }
    assert.equal(f.writes.length, 0);
    gate.resolve();
    await r.pending[0];
    assert.equal(botCalls, 1);
    assertSettled(await f.rooms.readRoom(f.code), f.auth.playerId);
    // A later pending interval must be eligible for a fresh worker after cleanup.
    const next = await f.rooms.readRoom(f.code);
    next.botsPending = true;
    f.save(next);
    await r.GET(request(f));
    assert.equal(automaticCalls, 2);
    assert.notEqual(r.pending[3], r.pending[0]);
    await r.pending[3];
    assert.equal(botCalls, 2);
    const denied = await r.GET(
      new Request(`http://localhost/api/rooms/${f.code}`),
    );
    assert.notEqual(denied.status, 200);
    assert.equal(r.pending.length, 4);
  } finally {
    gate.resolve();
    f.sqlite.close();
  }
});

void test('rejected route worker releases its room gate so a later authenticated request can recover', async () => {
  const f = await fixture();
  const gate = deferred();
  try {
    let automaticCalls = 0,
      botCalls = 0;
    const r = route(
      f,
      async (code) => {
        if (++automaticCalls === 1) await gate.promise;
        await f.rooms.continueRoomAutomatic(code, clock);
      },
      async () => {
        botCalls++;
      },
    );
    await r.GET(request(f));
    await r.GET(request(f));
    assert.equal(r.pending[0], r.pending[1]);
    const rejection = assert.rejects(r.pending[0], /worker interrupted/);
    gate.reject(new Error('worker interrupted'));
    await rejection;
    assert.equal(botCalls, 0);
    assert.equal(f.writes.length, 0);
    await r.GET(request(f));
    assert.equal(automaticCalls, 2);
    assert.notEqual(r.pending[2], r.pending[0]);
    await r.pending[2];
    assert.equal(botCalls, 1);
    assertSettled(await f.rooms.readRoom(f.code), f.auth.playerId);
  } finally {
    gate.resolve();
    f.sqlite.close();
  }
});

function paymentState(f: Awaited<ReturnType<typeof fixture>>) {
  const g = structuredClone(f.initial);
  g.response = null;
  g.decision = { kind: 'auctionPayment', player: f.auth.playerId };
  g.players[0].hand = [];
  return g;
}
function inspectionState(f: Awaited<ReturnType<typeof fixture>>) {
  const g = structuredClone(f.initial);
  g.players[0] = engine.newPlayer(f.auth.playerId, 'Atreides', 'atreides');
  g.phase = 6;
  g.auction = null;
  g.response = null;
  g.players[1].hand = [baseDeck().find((c) => c.kind === 'shield')!];
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 3 };
    p.reserves = 17;
  }
  g.battle = {
    territory: 'arrakeen',
    attacker: f.auth.playerId,
    defender: 'emperor',
    prepared: true,
    plans: {
      emperor: {
        dial: 0,
        support: 0,
        leader: 'emperor-0',
        weapon: null,
        defense: g.players[1].hand[0].id,
      },
    },
    revealed: false,
    traitorCalls: {},
    fullPlan: { owner: f.auth.playerId, target: 'emperor' },
  };
  g.decision = {
    kind: 'fullPlanRead',
    player: f.auth.playerId,
    target: 'emperor',
  };
  return g;
}

void test('authenticated reconnect recovers legacy inspection without changing sealed plans; a new route instance cannot replay it', async () => {
  const f = await fixture();
  try {
    const initial = inspectionState(f);
    f.save(initial);
    const r = route(
      f,
      (code) => f.rooms.continueRoomAutomatic(code, clock),
      async () => {},
    );
    const denied = await r.GET(
      new Request(`http://localhost/api/rooms/${f.code}`),
    );
    assert.notEqual(denied.status, 200);
    assert.equal(r.pending.length, 0);
    const response = await r.GET(request(f));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const snapshot = (await response.json()) as engine.GameView;
    assert.equal(snapshot.decision?.kind, 'fullPlanRead');
    assert.ok(snapshot.battle?.fullPlanInsight);
    assert.equal(snapshot.players[1].hand, undefined);
    await Promise.all(r.pending);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.decision, null);
    assert.equal(next.version, initial.version + 1);
    assert.deepEqual(next.battle, initial.battle);
    assert.deepEqual(next.players, initial.players);
    assert.equal(
      next.log.filter((e) => e.automatic?.name === 'Full plan inspection')
        .length,
      1,
    );
    assert.equal(engine.viewGame(next, 'guild').battle?.fullPlanInsight, null);
    const restarted = route(
      f,
      (code) => f.rooms.continueRoomAutomatic(code, clock),
      async () => {},
    );
    const reconnected = await restarted.GET(request(f));
    assert.equal(reconnected.status, 200);
    assert.equal(restarted.pending.length, 0);
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), next);
    assert.equal(f.writes.length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('competing decision-only payment recovery workers charge, award and announce once', async () => {
  const f = await fixture();
  try {
    const initial = paymentState(f);
    f.save(initial);
    const gate = deferred();
    let arrivals = 0;
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) gate.resolve();
      await gate.promise;
    };
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      f.rooms.continueRoomAutomatic(f.code, clock),
    ]);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.version, initial.version + 1);
    assert.equal(next.decision, null);
    assert.equal(next.response, null);
    assert.equal(next.players[0].spice, 6);
    assert.equal(next.players[1].spice, 14);
    assert.equal(next.players[0].hand.length, 2);
    assert.equal(next.deck.length, 0);
    assert.deepEqual(
      next.log.filter((e) => e.automatic).map((e) => e.automatic!.name),
      ['Auction payment', 'Auction income', 'Bonus treachery card'],
    );
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    await f.rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await f.rooms.readRoom(f.code), next);
  } finally {
    f.sqlite.close();
  }
});

void test('GET schedules decision-only payment recovery but a genuine Karama choice causes no version or resource write', async () => {
  const f = await fixture();
  try {
    const initial = paymentState(f);
    initial.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
    f.save(initial);
    const r = route(
      f,
      (code) => f.rooms.continueRoomAutomatic(code, clock),
      async () => {},
    );
    await r.GET(request(f));
    await Promise.all(r.pending);
    assert.equal(r.pending.length, 1);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), initial);
    initial.players[0].hand = [];
    f.save(initial);
    const resumed = route(
      f,
      (code) => f.rooms.continueRoomAutomatic(code, clock),
      async () => {},
    );
    await resumed.GET(request(f));
    await Promise.all(resumed.pending);
    assert.equal(resumed.pending.length, 1);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.players[0].spice, 6);
    assert.equal(next.version, initial.version + 1);
    assert.equal(next.decision, null);
    assert.equal(f.writes.length, 1);
  } finally {
    f.sqlite.close();
  }
});

void test('a manual legacy payment winning the CAS fences an already prepared automatic payment and reward', async () => {
  const f = await fixture();
  try {
    const initial = paymentState(f);
    f.save(initial);
    f.hooks.beforeWrite = async () => {
      f.hooks.beforeWrite = undefined;
      await f.rooms.act(
        f.code,
        f.auth,
        initial.version,
        { type: 'decision', karama: false },
        clock,
      );
    };
    await f.rooms.continueRoomAutomatic(f.code, clock);
    const next = await f.rooms.readRoom(f.code);
    assert.equal(next.version, initial.version + 1);
    assert.equal(next.players[0].spice, 6);
    assert.equal(next.players[1].spice, 14);
    assert.equal(next.players[0].hand.length, 2);
    assert.equal(next.deck.length, 0);
    assert.deepEqual(
      f.writes.map((w) => w.changes),
      [0],
    );
    assert.equal(
      next.log.filter((e) => e.automatic?.name === 'Bonus treachery card')
        .length,
      1,
    );
    assert.equal(
      next.log.filter((e) => e.automatic?.name === 'Auction payment').length,
      0,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('decision-only recovery preserves active overlays and their exact private continuation', async () => {
  const f = await fixture();
  try {
    for (const kind of ['truth', 'opening'] as const) {
      const initial = inspectionState(f);
      if (kind === 'truth')
        initial.truthtrance = {
          stage: 'ask',
          queue: [{ player: f.auth.playerId, card: 'truth' }],
          passed: [],
          question: null,
        };
      else initial.phaseOpening = { passed: [], initialize: false };
      f.save(initial);
      await f.rooms.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.rooms.readRoom(f.code), initial);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
