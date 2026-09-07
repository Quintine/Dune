import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as bots from '../game/bots';
import { baseDeck, createAuditorLeader } from '../game/cards';
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

async function fixture() {
  const store = unitStore();
  const created = await store.rooms.createRoom(
    'Auditor owner',
    'guild',
    false,
    [],
  );
  const code = created.view.code;
  const enemy = await store.rooms.joinRoom(code, 'Audited opponent', 'emperor');
  const observer = await store.rooms.joinRoom(code, 'Observer', 'atreides');
  const tokens = [created.token, enemy.token!, observer.token!];
  const seats = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const action = async (index: number, command: engine.Action) => {
    const current = await store.restart().readRoom(code);
    await store
      .restart()
      .act(code, seats[index], current.version, command, clock);
    return store.restart().readRoom(code);
  };
  for (const index of [0, 1, 2]) await action(index, { type: 'ready' });
  const started = await action(0, { type: 'start' });
  for (const [index, player] of started.players.entries())
    if (player.traitorChoices.length)
      await action(index, {
        type: 'traitor',
        leader: player.traitorChoices[0],
      });
  const initial = await store.restart().readRoom(code);
  assert.equal(initial.status, 'playing');
  Object.assign(initial, {
    advanced: true,
    phase: 6,
    turn: 2,
    storm: 18,
    active: null,
    order: seats.map((seat) => seat.playerId),
    deck: baseDeck(),
    discard: [],
    decision: null,
    response: null,
    phaseOpening: null,
    battle: null,
    lastBattle: [seats[0].playerId, seats[1].playerId],
  });
  Object.assign(
    initial.players[0],
    engine.newPlayer(seats[0].playerId, 'Auditor owner', 'choam'),
  );
  initial.players[0].leaders.push(createAuditorLeader());
  for (const player of initial.players) {
    player.hand = [];
    player.spice = 10;
    player.forces = {};
    player.reserves = 20;
    player.traitors = [];
    player.traitorChoices = [];
    player.ally = null;
    delete player.elites;
  }
  const opponent = initial.players[1];
  for (const kind of ['shield', 'poison', 'worthless', 'karama']) {
    const index = initial.deck.findIndex((card) =>
      kind === 'karama' ? card.effect === kind : card.kind === kind,
    );
    assert.ok(index >= 0);
    opponent.hand.push(initial.deck.splice(index, 1)[0]);
  }
  const event = 'f3c0907c-0881-428d-858d-71f052a4d3d6';
  initial.pendingAuditor = {
    event,
    owner: seats[0].playerId,
    opponent: seats[1].playerId,
    territory: 'arrakeen',
    turn: 2,
    survived: true,
    usedCards: [opponent.hand[0].id],
    stage: 'offer',
  };
  initial.decision = { kind: 'choamAudit', player: seats[0].playerId, event };
  // This fixture is confined to one real in-memory SQLite room. Subsequent
  // reads, authentication, recovery, normalization and actions use production APIs.
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, seats, tokens, action, initial, event };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

void test('background recovery completes empty offers and unaffordable audit payments exactly once', async () => {
  for (const stage of ['offer', 'payment'] as const) {
    const f = await fixture();
    try {
      const initial =
        stage === 'payment' ? await payment(f) : structuredClone(f.initial);
      const opponent = initial.players[1];
      if (stage === 'offer') initial.discard.push(...opponent.hand.splice(0));
      else opponent.spice = 0;
      f.sqlite
        .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
        .run(JSON.stringify(initial), initial.version, f.code);
      f.writes.length = 0;
      const snapshot = await f.restart().readSeatView(f.code, f.seats[0]);
      assert.equal(f.restart().needsAutomaticRoomRecovery(snapshot), true);
      assert.deepEqual(await f.restart().readRoom(f.code), initial);
      await f.restart().continueRoomAutomatic(f.code, clock);
      const after = await f.restart().readRoom(f.code);
      assert.equal(after.pendingAuditor, null);
      assert.notEqual(after.decision?.kind, 'choamAudit');
      assert.notEqual(after.decision?.kind, 'choamAuditPayment');
      assert.equal(
        after.auditorInsight?.cards.length ?? 0,
        stage === 'payment' ? 2 : 0,
      );
      assert.equal(after.players[1].spice, opponent.spice);
      assert.equal(after.version, initial.version + 1);
      await assertPrivate(f, after);
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), after);
      assert.equal(f.writes.length, 1);
    } finally {
      f.sqlite.close();
    }
  }
});

async function rejectUnchanged(
  f: Fixture,
  index: number,
  command: engine.Action,
  version?: number,
) {
  const before = await f.restart().readRoom(f.code),
    writes = f.writes.length;
  await assert.rejects(
    f
      .restart()
      .act(f.code, f.seats[index], version ?? before.version, command, clock),
  );
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), before);
}
async function payment(f: Fixture, recoverResponse = false) {
  let response = await f.action(0, {
    type: 'decision',
    event: f.event,
    audit: true,
  });
  assert.equal(response.pendingAuditor?.stage, 'response');
  assert.equal(response.response?.kind, 'choamAudit');
  if (recoverResponse) response = await recover(f, '3');
  assert.deepEqual(await f.restart().readRoom(f.code), response);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), response);
  const g = await f.action(1, { type: 'passResponse' });
  assert.equal(g.pendingAuditor?.stage, 'payment');
  assert.equal(g.decision?.kind, 'choamAuditPayment');
  return g;
}
async function recover(f: Fixture, suffix: '1' | '2' | '3') {
  const before = await f.restart().readRoom(f.code);
  const recoverySecret = suffix.repeat(64),
    newSessionToken = { '1': 'a', '2': 'b', '3': 'c' }[suffix].repeat(64);
  await f
    .restart()
    .setRecoveryKey(f.code, f.seats[0], before.version, recoverySecret);
  await f.restart().recoverSeat(f.code, {
    playerId: f.seats[0].playerId,
    recoverySecret,
    operationId: `adc66321-1681-4b3c-af04-e812c538bd0${suffix}`,
    newSessionToken,
  });
  await assert.rejects(f.restart().authenticate(f.code, f.tokens[0]));
  f.tokens[0] = newSessionToken;
  f.seats[0] = await f.restart().authenticate(f.code, newSessionToken);
  const after = await f.restart().readRoom(f.code);
  assert.deepEqual(after.players, before.players);
  assert.deepEqual(after.pendingAuditor, before.pendingAuditor);
  assert.deepEqual(after.auditorInsight, before.auditorInsight);
  assert.deepEqual(after.decision, before.decision);
  assert.deepEqual(after.response, before.response);
  return after;
}
async function toCollection(f: Fixture) {
  let g = await f.restart().readRoom(f.code);
  if (g.decision?.kind === 'choamMarket')
    g = await f.action(0, { type: 'decision', done: true });
  assert.equal(g.phase, 7);
  assert.equal(g.pendingAuditor, null);
  return g;
}
async function assertPrivate(f: Fixture, g: engine.Game) {
  for (const [index, seat] of f.seats.entries()) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.deepEqual(
      view.auditorInsight,
      index === 0 ? (g.auditorInsight ?? null) : null,
    );
    for (const player of view.players)
      assert.deepEqual(
        player.hand,
        player.id === seat.playerId
          ? g.players.find((p) => p.id === player.id)!.hand
          : undefined,
      );
    assert.ok(!Object.hasOwn(view, 'pendingAuditor'));
  }
}
async function race(f: Fixture, commands: [engine.Action, engine.Action]) {
  const before = await f.restart().readRoom(f.code);
  let release!: () => void,
    arrivals = 0;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.writes.length = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await wait;
  };
  try {
    const results = await Promise.allSettled(
      commands.map((command) =>
        f.restart().act(f.code, f.seats[1], before.version, command, clock),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    return after;
  } finally {
    f.hooks.beforeWrite = undefined;
  }
}

void test('Auditor offer, live cancellation and payment survive module reload and genuine seat recovery', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.restart().readRoom(f.code), f.initial);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    await recover(f, '1');
    const pending = await payment(f, true);
    await assertPrivate(f, pending);
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), pending);
    await recover(f, '2');
    const result = await f.action(1, {
      type: 'decision',
      event: f.event,
      pay: false,
    });
    assert.equal(result.auditorInsight?.cards.length, 2);
    assert.ok(
      result.auditorInsight?.cards.every(
        (card) => !f.initial.pendingAuditor!.usedCards.includes(card.id),
      ),
    );
    const final = await toCollection(f);
    await assertPrivate(f, final);
    const count = f.writes.length;
    for (let i = 0; i < 3; i++) {
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await f.restart().readRoom(f.code), final);
      await assertPrivate(f, final);
    }
    assert.equal(f.writes.length, count);
  } finally {
    f.sqlite.close();
  }
});

void test('Auditor wrong actor, stale event and obsolete count cause zero SQLite state writes', async () => {
  const f = await fixture();
  try {
    await rejectUnchanged(f, 1, {
      type: 'decision',
      event: f.event,
      audit: true,
    });
    await rejectUnchanged(f, 0, {
      type: 'decision',
      event: 'stale',
      audit: true,
    });
    const pending = await payment(f);
    await rejectUnchanged(f, 0, {
      type: 'decision',
      event: f.event,
      pay: true,
      count: 2,
    });
    await rejectUnchanged(f, 1, {
      type: 'decision',
      event: 'stale',
      pay: true,
      count: 2,
    });
    for (const count of [0, 1, 3, -1])
      await rejectUnchanged(f, 1, {
        type: 'decision',
        event: f.event,
        pay: true,
        count,
      });
    await rejectUnchanged(f, 1, {
      type: 'decision',
      event: f.event,
      pay: false,
      count: 2,
    });
    assert.deepEqual(await f.restart().readRoom(f.code), pending);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent duplicate payment, duplicate inspection and payment versus inspection settle one audit once', async () => {
  for (const mode of ['pay', 'allow', 'competing'] as const) {
    const f = await fixture();
    try {
      const pending = await payment(f);
      const pay: engine.Action = {
        type: 'decision',
        event: f.event,
        pay: true,
        count: 2,
      };
      const allow: engine.Action = {
        type: 'decision',
        event: f.event,
        pay: false,
      };
      const after = await race(
        f,
        mode === 'pay'
          ? [pay, pay]
          : mode === 'allow'
            ? [allow, allow]
            : [pay, allow],
      );
      const inspected = !!after.auditorInsight;
      if (mode !== 'competing') assert.equal(inspected, mode === 'allow');
      assert.deepEqual(
        after.players.map((p) => p.spice),
        inspected ? [10, 10, 10] : [12, 8, 10],
      );
      assert.deepEqual(
        after.players.map((p) => p.hand),
        pending.players.map((p) => p.hand),
      );
      assert.deepEqual(after.deck, pending.deck);
      assert.deepEqual(after.discard, pending.discard);
      assert.equal(after.pendingAuditor, null);
      if (inspected) {
        const cards = after.auditorInsight!.cards;
        assert.equal(cards.length, 2);
        assert.equal(new Set(cards.map((c) => c.id)).size, 2);
        assert.ok(
          cards.every(
            (card) =>
              pending.players[1].hand.some((c) => c.id === card.id) &&
              !pending.pendingAuditor!.usedCards.includes(card.id),
          ),
        );
      }
      await rejectUnchanged(f, 1, pay, pending.version);
      await rejectUnchanged(f, 1, allow);
      const final = await toCollection(f);
      await assertPrivate(f, final);
      if (inspected) {
        await recover(f, '1');
        const restored = await f.restart().readRoom(f.code);
        assert.deepEqual(restored.auditorInsight, final.auditorInsight);
        await assertPrivate(f, restored);
      }
    } finally {
      f.sqlite.close();
    }
  }
});

void test('corrupt saved Auditor bindings reject actions and normalization while credential recovery preserves readable state', async () => {
  const corruptions: [string, (g: engine.Game) => void][] = [
    [
      'pending turn',
      (g) => {
        g.pendingAuditor!.turn--;
      },
    ],
    [
      'decision event',
      (g) => {
        assert.equal(g.decision?.kind, 'choamAudit');
        if (g.decision?.kind === 'choamAudit') g.decision.event = 'stale-event';
      },
    ],
    [
      'last battle pair',
      (g) => {
        g.lastBattle[1] = g.players[2].id;
      },
    ],
    [
      'foreign owner',
      (g) => {
        // Keep the battle pair and decision internally aligned, isolating native custody.
        g.pendingAuditor!.owner = g.players[2].id;
        g.lastBattle[0] = g.players[2].id;
        g.decision = {
          kind: 'choamAudit',
          player: g.players[2].id,
          event: g.pendingAuditor!.event,
        };
      },
    ],
    [
      'invalid stage',
      (g) => {
        Object.assign(g.pendingAuditor!, { stage: 'finished' });
      },
    ],
    [
      'missing payment continuation',
      (g) => {
        g.pendingAuditor!.stage = 'payment';
        g.decision = null;
      },
    ],
    [
      'missing response continuation',
      (g) => {
        g.pendingAuditor!.stage = 'response';
        g.decision = null;
      },
    ],
    [
      'nested response event',
      (g) => {
        const pending = g.pendingAuditor!;
        pending.stage = 'response';
        g.decision = null;
        // A matching direct parent must not hide a mismatched stored cancellation.
        g.response = {
          kind: 'choamAudit',
          owner: pending.owner,
          intent: pending.event,
          passed: [],
        };
        g.pendingKarama = {
          owner: pending.opponent,
          use: {
            kind: 'cancel',
            response: { ...g.response, intent: 'stale-event' },
          },
        };
      },
    ],
  ];
  for (const [label, corrupt] of corruptions) {
    const f = await fixture();
    try {
      const malformed = structuredClone(f.initial);
      corrupt(malformed);
      f.sqlite
        .prepare('UPDATE rooms SET state=? WHERE code=?')
        .run(JSON.stringify(malformed), f.code);
      const before = await f.restart().readRoom(f.code);
      assert.throws(
        () => engine.normalizeAutomaticGame(before),
        /Auditor/,
        label,
      );
      assert.deepEqual(before, malformed, label);
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[0],
            before.version,
            { type: 'decision', event: f.event, audit: true },
            clock,
          ),
        /Auditor/,
        label,
      );
      assert.equal(f.writes.length, 0, label);
      assert.deepEqual(await f.restart().readRoom(f.code), before, label);
      await assertPrivate(f, before);

      const restored = await recover(f, '1');
      assert.deepEqual({ ...restored, version: before.version }, before, label);
      await assertPrivate(f, restored);
      assert.equal(f.writes.length, 0, label);
      // Recovering authentication deliberately neither normalizes nor repairs gameplay.
      assert.throws(
        () => engine.normalizeAutomaticGame(restored),
        /Auditor/,
        label,
      );
      await rejectUnchanged(f, 0, {
        type: 'decision',
        event: f.event,
        audit: true,
      });
    } finally {
      f.sqlite.close();
    }
  }
});
