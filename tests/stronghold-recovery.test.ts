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
  createStrongholdCards,
  type StrongholdId,
} from '../game/stronghold-cards';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
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
    'Mobile owner',
    'guild',
    false,
    [],
  );
  const code = created.view.code;
  const enemy = await store.rooms.joinRoom(code, 'Opponent', 'emperor');
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
  let initial = await action(0, { type: 'start' });
  for (const [index, player] of initial.players.entries())
    if (player.traitorChoices.length)
      await action(index, {
        type: 'traitor',
        leader: player.traitorChoices[0],
      });
  initial = await store.restart().readRoom(code);
  assert.equal(initial.status, 'playing');
  Object.assign(initial, {
    advanced: true,
    phase: 6,
    turn: 2,
    storm: 18,
    active: seats[0].playerId,
    order: seats.map((seat) => seat.playerId),
    deck: baseDeck(),
    discard: [],
    decision: null,
    response: null,
    phaseOpening: null,
    mobileStronghold: { location: 'red_chasm:7' },
    strongholdCards: createStrongholdCards(),
  });
  initial.strongholdCards!.claimedTurn = 1;
  initial.strongholdCards!.owners.hidden_mobile_stronghold = seats[0].playerId;
  // Current physical control supplies copy choices even when someone else holds a card.
  initial.strongholdCards!.owners.arrakeen = seats[1].playerId;
  initial.strongholdCards!.owners.sietch_tabr = seats[2].playerId;
  for (const [index, player] of initial.players.entries()) {
    player.hand = [];
    player.spice = 20;
    player.forces = index < 2 ? { [MOBILE_LOCATION]: 6 } : {};
    player.reserves = index < 2 ? 14 : 20;
    player.traitors = [];
    player.ally = null;
    delete player.elites;
    const kind = index === 0 ? 'worthless' : index === 1 ? 'shield' : 'poison';
    const at = initial.deck.findIndex((card) => card.kind === kind);
    assert.ok(at >= 0);
    player.hand.push(initial.deck.splice(at, 1)[0]);
  }
  Object.assign(initial.players[0].forces, {
    'arrakeen:10': 1,
    'sietch_tabr:14': 1,
  });
  initial.players[0].reserves -= 2;
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  // Only this in-memory room receives the battle fixture. Every later command uses production APIs.
  save(initial);
  let pending = await action(0, {
    type: 'chooseBattle',
    territory: MOBILE_STRONGHOLD,
    target: seats[1].playerId,
  });
  for (const index of [0, 1])
    if (pending.battle?.preLeader && !pending.battle.preLeader.closed)
      pending = await action(index, {
        type: 'battlePreparationReady',
        event: pending.battle.event,
      });
  assert.equal(pending.decision?.kind, 'strongholdCopy');
  if (pending.decision?.kind !== 'strongholdCopy')
    throw Error('Copy choice missing');
  assert.deepEqual(pending.decision.choices, ['arrakeen', 'sietch_tabr']);
  store.writes.length = 0;
  return { ...store, code, seats, tokens, action, initial, pending, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function prepare(f: Fixture) {
  for (let limit = 0; limit < 30; limit++) {
    const g = await f.restart().readRoom(f.code);
    if (g.response) {
      const index = g.players.findIndex(
        (p) => !g.response!.passed.includes(p.id),
      );
      await f.action(index, { type: 'passResponse' });
    } else if (g.battle?.preparation) {
      await f.action(
        f.seats.findIndex((p) => p.playerId === g.battle!.preparation!.owner),
        { type: 'declineBattlePower' },
      );
    } else if (g.decision?.kind === 'fullPlanOffer') {
      await f.action(
        f.seats.findIndex((p) => p.playerId === g.decision!.player),
        { type: 'decision', decline: true },
      );
    } else return g;
  }
  throw Error('Battle preparation did not finish');
}
function inventory(g: engine.Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
}
async function rejectUnchanged(
  f: Fixture,
  index: number,
  command: engine.Action,
  version?: number,
) {
  const before = await f.restart().readRoom(f.code);
  const writes = f.writes.length;
  await assert.rejects(
    f
      .restart()
      .act(f.code, f.seats[index], version ?? before.version, command, clock),
  );
  assert.equal(f.writes.length, writes);
  assert.deepEqual(await f.restart().readRoom(f.code), before);
}
async function race(
  f: Fixture,
  index: number,
  commands: [engine.Action, engine.Action],
) {
  const before = await f.restart().readRoom(f.code);
  let release!: () => void;
  let arrivals = 0;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.writes.length = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
  try {
    const attempts = await Promise.allSettled(
      commands.map((command) =>
        f.restart().act(f.code, f.seats[index], before.version, command, clock),
      ),
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    return after;
  } finally {
    f.hooks.beforeWrite = undefined;
  }
}
async function plan(f: Fixture, index: number, dial: number, support = 0) {
  const g = await f.restart().readRoom(f.code);
  const player = g.players[index];
  const leader = [...player.leaders].sort((a, b) =>
    index === 0 ? b.strength - a.strength : a.strength - b.strength,
  )[0];
  return f.action(index, {
    type: 'battlePlan',
    dial,
    support,
    leader: leader.id,
    ...(index === 0
      ? { weapon: player.hand.find((c) => c.kind === 'worthless')!.id }
      : {}),
  });
}

void test('mobile copy persists through module reload and real seat recovery; later private plans stay sealed', async () => {
  const f = await fixture();
  try {
    const pending = f.pending;
    assert.deepEqual(await f.restart().readRoom(f.code), pending);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    for (const seat of f.seats) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.deepEqual(view.strongholdCards, pending.strongholdCards);
      assert.deepEqual(view.battle!.plans, {});
      assert.deepEqual(view.battle!.cards, []);
      for (const player of view.players)
        assert.deepEqual(
          player.hand,
          player.id === seat.playerId
            ? pending.players.find((p) => p.id === player.id)!.hand
            : undefined,
        );
    }
    const recoverySecret = 'a'.repeat(64),
      newSessionToken = 'b'.repeat(64);
    await f
      .restart()
      .setRecoveryKey(f.code, f.seats[0], pending.version, recoverySecret);
    const secured = await f.restart().readRoom(f.code);
    await f.restart().recoverSeat(f.code, {
      playerId: f.seats[0].playerId,
      recoverySecret,
      operationId: '1452d78d-b3ba-4359-8af5-56d8f410aa81',
      newSessionToken,
    });
    await assert.rejects(f.restart().authenticate(f.code, f.tokens[0]));
    f.seats[0] = await f.restart().authenticate(f.code, newSessionToken);
    const recovered = await f.restart().readRoom(f.code);
    assert.deepEqual(recovered.decision, pending.decision);
    assert.deepEqual(recovered.strongholdCards, pending.strongholdCards);
    assert.deepEqual(recovered.players, pending.players);
    assert.deepEqual(recovered.battle, pending.battle);
    assert.equal(recovered.version, secured.version + 1);
    await f.action(0, {
      type: 'decision',
      event: pending.battle!.event,
      stronghold: 'arrakeen',
    });
    await prepare(f);
    const sealed = await plan(f, 0, 2, 2);
    assert.equal(sealed.battle!.revealed, false);
    for (const [index, seat] of f.seats.entries()) {
      const view = await f.restart().readSeatView(f.code, seat);
      assert.equal(view.battle!.strongholdCopy, 'arrakeen');
      assert.deepEqual(view.battle!.cards, []);
      assert.deepEqual(
        view.battle!.plans,
        index === 0 ? sealed.battle!.plans : {},
      );
    }
    const writes = f.writes.length;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await f.restart().readRoom(f.code), sealed);
  } finally {
    f.sqlite.close();
  }
});

void test('wrong actor, stale event, unoffered and competing mobile choices cannot change the saved effect twice', async () => {
  for (const competing of [false, true]) {
    const f = await fixture();
    try {
      const event = f.pending.battle!.event;
      const choice: engine.Action = {
        type: 'decision',
        event,
        stronghold: 'arrakeen',
      };
      await rejectUnchanged(f, 1, choice);
      await rejectUnchanged(f, 0, { ...choice, event: 'stale' });
      await rejectUnchanged(f, 0, { ...choice, stronghold: 'carthag' });
      await rejectUnchanged(f, 1, {
        type: 'battlePlan',
        dial: 0,
        leader: f.pending.players[1].leaders[0].id,
      });
      const after = await race(f, 0, [
        choice,
        competing ? { ...choice, stronghold: 'sietch_tabr' } : choice,
      ]);
      assert.ok(
        ['arrakeen', 'sietch_tabr'].includes(after.battle!.strongholdCopy!),
      );
      if (!competing) assert.equal(after.battle!.strongholdCopy, 'arrakeen');
      assert.equal(
        after.log.filter((entry) =>
          entry.text.includes('as their copied mobile Stronghold advantage'),
        ).length,
        1,
      );
      assert.deepEqual(after.strongholdCards, f.pending.strongholdCards);
      assert.deepEqual(inventory(after), inventory(f.pending));
      assert.deepEqual(
        after.players.map((p) => p.spice),
        [20, 20, 20],
      );
      await rejectUnchanged(f, 0, choice, f.pending.version);
      await rejectUnchanged(f, 0, {
        ...choice,
        stronghold:
          after.battle!.strongholdCopy === 'arrakeen'
            ? 'sietch_tabr'
            : 'arrakeen',
      });
      assert.deepEqual(await f.restart().readRoom(f.code), after);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('copied support subsidy and victory income settle once under duplicate final battle submission and persist through cleanup reloads', async () => {
  for (const copy of ['arrakeen', 'sietch_tabr'] as StrongholdId[]) {
    const f = await fixture();
    try {
      await f.action(0, {
        type: 'decision',
        event: f.pending.battle!.event,
        stronghold: copy,
      });
      await prepare(f);
      await plan(f, 0, 3, 3);
      const revealed = await plan(f, 1, 1.5, 0);
      assert.equal(revealed.battle!.revealed, true);
      assert.deepEqual(
        revealed.players.map((p) => p.spice),
        [20, 20, 20],
      );
      await f.action(1, { type: 'traitorCall', call: false });
      const before = await f.restart().readRoom(f.code);
      const finish: engine.Action = { type: 'traitorCall', call: false };
      const after = await race(f, 0, [finish, finish]);
      assert.equal(after.battle, null);
      assert.equal(after.decision?.kind, 'battleCards');
      assert.equal(after.players[0].spice, copy === 'arrakeen' ? 19 : 18);
      assert.equal(after.players[1].spice, 20);
      assert.equal(after.players[0].forces[MOBILE_LOCATION], 3);
      assert.equal(after.players[1].forces[MOBILE_LOCATION], undefined);
      assert.equal(after.players[0].tanks, 3);
      assert.equal(after.players[1].tanks, 6);
      assert.deepEqual(after.strongholdCards, f.pending.strongholdCards);
      assert.deepEqual(inventory(after), inventory(before));
      assert.equal(
        after.log.filter((entry) => entry.text.includes('Sietch Tabr victory'))
          .length,
        copy === 'sietch_tabr' ? 1 : 0,
      );
      assert.equal(
        after.log.filter((entry) =>
          entry.text.includes('won in Hidden Mobile Stronghold'),
        ).length,
        1,
      );
      await rejectUnchanged(f, 0, finish, before.version);
      await rejectUnchanged(f, 0, finish);
      const writes = f.writes.length;
      for (let restart = 0; restart < 3; restart++) {
        await f.restart().continueRoomAutomatic(f.code, clock);
        const view = await f.restart().readSeatView(f.code, f.seats[0]);
        assert.deepEqual(view.strongholdCards, after.strongholdCards);
        assert.equal(view.players[0].spice, after.players[0].spice);
        assert.deepEqual(await f.restart().readRoom(f.code), after);
      }
      assert.equal(f.writes.length, writes);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('corrupted saved copy bindings reject actions and normalization while room recovery leaves the pending human choice unchanged', async () => {
  const f = await fixture();
  try {
    const mutations: [string, (g: engine.Game) => void][] = [
      [
        'stale event',
        (g) => {
          if (g.decision?.kind === 'strongholdCopy') g.decision.event = 'stale';
        },
      ],
      [
        'wrong decision owner',
        (g) => {
          if (g.decision?.kind === 'strongholdCopy')
            g.decision.player = f.seats[1].playerId;
        },
      ],
      [
        'duplicated choices',
        (g) => {
          if (g.decision?.kind === 'strongholdCopy')
            g.decision.choices = ['arrakeen', 'arrakeen'];
        },
      ],
      [
        'uncontrolled choice',
        (g) => {
          if (g.decision?.kind === 'strongholdCopy')
            g.decision.choices = ['arrakeen', 'carthag'];
        },
      ],
      [
        'lost physical control',
        (g) => {
          delete g.players[0].forces['sietch_tabr:14'];
          g.players[0].reserves++;
        },
      ],
      [
        'wrong phase',
        (g) => {
          g.phase = 7;
        },
      ],
      [
        'previous copy',
        (g) => {
          g.battle!.strongholdCopy = 'arrakeen';
        },
      ],
      [
        'premature plan',
        (g) => {
          g.battle!.plans[f.seats[0].playerId] = {
            dial: 0,
            support: 0,
            leader: g.players[0].leaders[0].id,
            weapon: null,
            defense: null,
          };
        },
      ],
    ];
    for (const [name, mutate] of mutations) {
      const malformed = structuredClone(f.pending);
      mutate(malformed);
      f.save(malformed);
      f.writes.length = 0;
      await rejectUnchanged(f, 0, {
        type: 'decision',
        event: f.pending.battle!.event,
        stronghold: 'arrakeen',
      });
      assert.throws(
        () => engine.normalizeAutomaticGame(malformed),
        /Stronghold/,
        name,
      );
      // The room scheduler never automatically answers a pending human copy choice.
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.equal(f.writes.length, 0, name);
      assert.deepEqual(await f.restart().readRoom(f.code), malformed, name);
      assert.deepEqual(inventory(malformed), inventory(f.pending), name);
    }
  } finally {
    f.sqlite.close();
  }
});
