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
  type AmbassadorEffect,
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

async function fixture(effect: AmbassadorEffect, purchaseBenefits = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Owner',
    purchaseBenefits ? 'atreides' : 'emperor',
    false,
    [],
  );
  const code = created.view.code;
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'guild');
  const observer = await store.rooms.joinRoom(
    code,
    'Observer',
    purchaseBenefits ? 'harkonnen' : 'atreides',
  );
  const emperor = purchaseBenefits
    ? await store.rooms.joinRoom(code, 'Emperor', 'emperor')
    : null;
  const auth = await store.rooms.authenticate(code, created.token);
  const entrantAuth = await store.rooms.authenticate(code, entrant.token!);
  const observerAuth = await store.rooms.authenticate(code, observer.token!);
  const initial = await store.rooms.readRoom(code);
  if (purchaseBenefits) {
    initial.players[0].ally = observerAuth.playerId;
    initial.players[2].ally = auth.playerId;
  }
  initial.players[0] = engine.newPlayer(auth.playerId, 'Ecaz', 'ecaz');
  if (purchaseBenefits) initial.players[0].ally = observerAuth.playerId;
  initial.status = 'playing';
  initial.phase = 5;
  initial.turn = 2;
  initial.advanced = false;
  initial.expansions = ['ecaz'];
  initial.storm = 18;
  initial.order = initial.players.map((p) => p.id);
  initial.active = entrantAuth.playerId;
  initial.movementRemaining = [
    entrantAuth.playerId,
    auth.playerId,
    observerAuth.playerId,
  ];
  for (const p of initial.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [p.leaders[0].id];
  }
  const cards = baseDeck();
  initial.players[0].hand = cards
    .filter((c) => c.kind === 'worthless')
    .slice(0, 2);
  initial.players[1].hand = [
    cards.find((c) => c.kind === 'shield')!,
    cards.find((c) => c.kind === 'poison')!,
  ];
  if (purchaseBenefits)
    initial.players[1].hand.push(cards.find((c) => c.effect === 'karama')!);
  initial.deck = [
    cards.find((c) => c.kind === 'snooper')!,
    cards.find((c) => c.kind === 'projectile')!,
  ];
  initial.players[1].forces = { 'imperial_basin:10': 3 };
  initial.players[1].reserves = 17;
  let ambassadors = createAmbassadors(() => 0.3);
  const selected = ambassadors.tokens.find((t) => t.effect === effect)!;
  // Seed a valid current cohort that includes the effect under test.
  ambassadors.cohort = [
    selected.id,
    ...ambassadors.tokens
      .filter((t) => t.effect !== 'ecaz' && t.id !== selected.id)
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const t of ambassadors.tokens) {
    t.zone =
      t.effect === 'ecaz' || ambassadors.cohort.includes(t.id)
        ? 'supply'
        : 'pool';
    t.location = null;
  }
  ambassadors = placeAmbassador(ambassadors, selected.id, {
    turn: 2,
    availableSpice: 10,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  initial.ecazAmbassadors = ambassadors;
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  const move = {
    type: 'move',
    from: 'imperial_basin:10',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  };
  const view = await store.rooms.act(
    code,
    entrantAuth,
    initial.version,
    move,
    clock,
  );
  assert.equal(view.decision?.kind, 'ecazAmbassador');
  assert.ok(view.ambassadorEntry?.event);
  const pending = await store.rooms.readRoom(code);
  store.writes.length = 0;
  const trigger = {
    type: 'decision',
    event: view.ambassadorEntry.event,
    trigger: true,
    beneficiary: auth.playerId,
  };
  return {
    ...store,
    code,
    auth,
    entrantAuth,
    observerAuth,
    seatTokens: [
      created.token,
      entrant.token!,
      observer.token!,
      ...(emperor ? [emperor.token!] : []),
    ],
    initial,
    pending,
    trigger,
    move,
    save,
    token: selected.id,
  };
}
function conserved(g: engine.Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) resolve();
    await promise;
  };
}

void test('two simultaneous Emperor triggers commit one reward, token use and entry movement', async () => {
  const f = await fixture('emperor');
  try {
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.auth, f.pending.version, f.trigger, clock),
      f.rooms.act(f.code, f.auth, f.pending.version, f.trigger, clock),
    ]);
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((r) => r.status === 'rejected').length, 1);
    const g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.pending.version + 1);
    assert.equal(g.players[0].spice, 15);
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.decision, null);
    assert.equal(
      g.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
      'used',
    );
    assert.equal(g.players[1].forces['arrakeen:10'], 1);
    assert.equal(g.players[1].forces['imperial_basin:10'], 2);
    assert.equal(g.players[1].moved, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(
      g.log.filter((e) => e.automatic?.name === 'Emperor Ambassador').length,
      1,
    );
    conserved(g);
    await assert.rejects(
      f.rooms.act(f.code, f.auth, g.version, f.trigger, clock),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), g);
  } finally {
    f.sqlite.close();
  }
});

void test('Atreides snapshot survives a room-module restart and remains private after the entrant hand changes', async () => {
  const f = await fixture('atreides');
  try {
    const pendingOwner = await f.rooms.readSeatView(f.code, f.auth);
    const pendingOther = await f.rooms.readSeatView(f.code, f.observerAuth);
    assert.equal(pendingOwner.ambassadorInsights.length, 0);
    assert.equal(pendingOther.ambassadorInsights.length, 0);
    assert.equal('pendingAmbassador' in pendingOther, false);
    const restarted = f.restart();
    await restarted.act(f.code, f.auth, f.pending.version, f.trigger, clock);
    const settled = await restarted.readRoom(f.code);
    const record = settled.ambassadorInsights![0];
    assert.deepEqual(record.cards, f.pending.players[1].hand);
    const changed = structuredClone(settled);
    changed.discard.push(changed.players[1].hand.shift()!);
    changed.players[1].hand.push(changed.deck.shift()!);
    changed.version++;
    f.save(changed);
    const owner = await f.restart().readSeatView(f.code, f.auth);
    assert.deepEqual(
      owner.ambassadorInsights[0].cards,
      f.pending.players[1].hand,
    );
    assert.notDeepEqual(
      owner.ambassadorInsights[0].cards,
      changed.players[1].hand,
    );
    for (const auth of [f.entrantAuth, f.observerAuth]) {
      const privateView = await restarted.readSeatView(f.code, auth);
      assert.deepEqual(privateView.ambassadorInsights, []);
      assert.equal('pendingAmbassador' in privateView, false);
    }
    await assert.rejects(
      restarted.act(f.code, f.auth, changed.version, f.trigger, clock),
    );
    assert.deepEqual(await restarted.readRoom(f.code), changed);
    conserved(changed);
  } finally {
    f.sqlite.close();
  }
});

void test('Harkonnen random inspection is persisted once and refresh/duplicate commands do not select another card', async () => {
  const f = await fixture('harkonnen');
  try {
    await f.rooms.act(f.code, f.auth, f.pending.version, f.trigger, clock);
    const settled = await f.rooms.readRoom(f.code);
    assert.equal(settled.ambassadorInsights!.length, 1);
    assert.ok(
      f.pending.players[1].traitors.includes(
        settled.ambassadorInsights![0].traitor!,
      ),
    );
    assert.deepEqual(settled.ambassadorInsights![0].cards, []);
    for (let i = 0; i < 3; i++) {
      const resumed = f.restart();
      const view = await resumed.readSeatView(f.code, f.auth);
      assert.deepEqual(view.ambassadorInsights, settled.ambassadorInsights);
      assert.deepEqual(
        (await resumed.readSeatView(f.code, f.entrantAuth)).ambassadorInsights,
        [],
      );
      await assert.rejects(
        resumed.act(f.code, f.auth, settled.version, f.trigger, clock),
      );
    }
    assert.deepEqual(await f.rooms.readRoom(f.code), settled);
    assert.equal(f.writes.length, 1);
    conserved(settled);
  } finally {
    f.sqlite.close();
  }
});

for (const effect of ['choam', 'ixians'] as const)
  void test(`${effect} card choice survives restart, rejects wrong event/seat, and commits a duplicate submission only once`, async () => {
    const f = await fixture(effect);
    try {
      const triggered = await f.rooms.act(
        f.code,
        f.auth,
        f.pending.version,
        f.trigger,
        clock,
      );
      assert.equal(triggered.ambassadorEntry?.stage, 'cards');
      const g = await f.rooms.readRoom(f.code);
      const chosen = g.players[0].hand[0].id;
      const expectedDraw = g.deck[0];
      const action = {
        type: 'decision',
        event: triggered.ambassadorEntry.event,
        cards: [chosen],
      };
      const restarted = f.restart();
      const owner = await restarted.readSeatView(f.code, f.auth);
      const observer = await restarted.readSeatView(f.code, f.observerAuth);
      assert.equal(owner.ambassadorEntry?.cards.length, 2);
      assert.deepEqual(observer.ambassadorEntry?.cards, []);
      assert.equal(observer.players[0].hand, undefined);
      await assert.rejects(
        restarted.act(
          f.code,
          f.auth,
          g.version,
          { ...action, event: 'obsolete-event' },
          clock,
        ),
        /no longer current/,
      );
      await assert.rejects(
        restarted.act(f.code, f.observerAuth, g.version, action, clock),
        /pending decision/,
      );
      assert.deepEqual(await restarted.readRoom(f.code), g);
      f.writes.length = 0;
      f.hooks.beforeWrite = barrier();
      const attempts = await Promise.allSettled([
        restarted.act(f.code, f.auth, g.version, action, clock),
        f.rooms.act(f.code, f.auth, g.version, action, clock),
      ]);
      assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
      const done = await restarted.readRoom(f.code);
      assert.equal(done.version, g.version + 1);
      assert.equal(done.pendingAmbassador, null);
      assert.equal(done.discard.filter((c) => c.id === chosen).length, 1);
      assert.equal(done.players[0].spice, effect === 'choam' ? 13 : 10);
      assert.equal(done.players[0].hand.length, effect === 'choam' ? 1 : 2);
      if (effect === 'ixians') {
        assert.ok(done.players[0].hand.some((c) => c.id === expectedDraw.id));
        assert.equal(done.deck.length, g.deck.length - 1);
      }
      assert.equal(done.players[1].forces['arrakeen:10'], 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      conserved(done);
    } finally {
      f.sqlite.close();
    }
  });

void test('an earlier declined event cannot trigger a later entry even with a refreshed current version', async () => {
  const f = await fixture('emperor');
  try {
    await f.rooms.act(
      f.code,
      f.auth,
      f.pending.version,
      { type: 'decision', event: f.trigger.event, decline: true },
      clock,
    );
    const later = await f.rooms.readRoom(f.code);
    assert.equal(
      later.ecazAmbassadors!.tokens.find((t) => t.id === f.token)!.zone,
      'placed',
    );
    later.turn++;
    later.players[1].moved = 0;
    later.version++;
    f.save(later);
    const entered = await f
      .restart()
      .act(f.code, f.entrantAuth, later.version, f.move, clock);
    assert.ok(entered.ambassadorEntry);
    assert.notEqual(entered.ambassadorEntry.event, f.trigger.event);
    const pending = await f.rooms.readRoom(f.code);
    await assert.rejects(
      f.rooms.act(f.code, f.auth, pending.version, f.trigger, clock),
      /no longer current/,
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), pending);
    await f.rooms.act(
      f.code,
      f.auth,
      pending.version,
      { ...f.trigger, event: entered.ambassadorEntry.event },
      clock,
    );
    const done = await f.rooms.readRoom(f.code);
    assert.equal(done.players[0].spice, 15);
    assert.equal(done.players[1].forces['arrakeen:10'], 2);
    assert.equal(
      done.log.filter((e) => e.automatic?.name === 'Emperor Ambassador').length,
      1,
    );
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent Richese Ambassador triggers charge once and recover the private paid card after restart', async () => {
  const f = await fixture('richese');
  try {
    const drawn = f.pending.deck[0];
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      f.rooms.act(f.code, f.auth, f.pending.version, f.trigger, clock),
      f.rooms.act(f.code, f.auth, f.pending.version, f.trigger, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const restarted = f.restart();
    const auth = await restarted.authenticate(f.code, f.seatTokens[0]);
    const done = await restarted.readRoom(f.code);
    assert.equal(done.version, f.pending.version + 1);
    assert.equal(done.players[0].spice, 7);
    assert.equal(
      done.players[0].hand.filter((c) => c.id === drawn.id).length,
      1,
    );
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.players[1].moved, 1);
    assert.equal(done.players[1].forces['arrakeen:10'], 1);
    const owner = await restarted.readSeatView(f.code, auth);
    assert.ok(owner.players[0].hand?.some((c) => c.id === drawn.id));
    const other = await restarted.readSeatView(f.code, f.observerAuth);
    assert.equal(other.players[0].hand, undefined);
    assert.ok(!JSON.stringify(other).includes(drawn.id));
    await assert.rejects(
      restarted.act(f.code, auth, done.version, f.trigger, clock),
    );
    assert.deepEqual(await restarted.readRoom(f.code), done);
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});

void test('Richese Ambassador income and Harkonnen bonus retain their purchase across restart and concurrent Karama cancellation', async () => {
  const f = await fixture('richese', true);
  try {
    const trigger = { ...f.trigger, beneficiary: f.observerAuth.playerId };
    await f.rooms.act(f.code, f.auth, f.pending.version, trigger, clock);
    const paid = await f.rooms.readRoom(f.code);
    const buyer = paid.players[2],
      emperor = paid.players[3];
    assert.equal(buyer.spice, 7);
    assert.equal(buyer.hand.length, 1);
    assert.equal(paid.response?.kind, 'emperorIncome');
    assert.equal(paid.response?.source, 'ambassador');
    assert.equal(
      paid.pendingAmbassador?.purchaseReceipt?.card,
      buyer.hand[0].id,
    );
    const restarted = f.restart();
    const entrantAuth = await restarted.authenticate(f.code, f.seatTokens[1]);
    const projected = await restarted.readSeatView(f.code, f.auth);
    assert.ok(!JSON.stringify(projected).includes(buyer.hand[0].id));
    const karama = paid.players[1].hand.find((c) => c.effect === 'karama')!;
    const cancel = { type: 'card', mode: 'cancel', card: karama.id };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const attempts = await Promise.allSettled([
      restarted.act(f.code, entrantAuth, paid.version, cancel, clock),
      restarted.act(f.code, entrantAuth, paid.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[2].spice, 7);
    assert.equal(done.players[2].hand.length, 2);
    assert.equal(done.players[3].spice, emperor.spice);
    assert.equal(done.discard.filter((c) => c.id === karama.id).length, 1);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.response, null);
    assert.equal(done.players[1].moved, 1);
    assert.equal(done.active, f.entrantAuth.playerId);
    assert.equal(
      done.log.filter(
        (e) => e.automatic?.name === 'Richese Ambassador purchase',
      ).length,
      1,
    );
    assert.equal(
      done.log.filter((e) => e.automatic?.name === 'Bonus treachery card')
        .length,
      1,
    );
    assert.deepEqual(engine.normalizeAutomaticGame(done), done);
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});
