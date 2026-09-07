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
import { richeseCards } from '../game/richese-cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import type * as Rooms from '../db/rooms';
import { createRequire } from 'node:module';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

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

/** Observe the real dispatcher before its public wrapper drains the saved frame. */
const observed: { applyActionInner?: typeof engine.applyAction } = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: engine.Game, id: string, action: engine.Action): engine.Game {
  const before = structuredClone(g);
  const next = JSON.parse(
    JSON.stringify(observed.applyActionInner!(g, id, action)),
  );
  assert.deepEqual(g, before);
  return next;
}

async function fixture(choam = false, marker = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Mover', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Other', 'atreides');
  const third = await store.rooms.joinRoom(code, 'Observer', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token),
    other = await store.rooms.authenticate(code, joined.token!),
    observer = await store.rooms.authenticate(code, third.token!);
  // Internal expansion component setup; room identities, SQL and every
  // movement/decision/recovery action use the production APIs.
  const old = await store.rooms.readRoom(code),
    initial = engine.createGame(
      code,
      engine.newPlayer(owner.playerId, 'Mover', 'richese'),
      false,
      ['choam'],
    );
  initial.players.push(
    engine.newPlayer(other.playerId, 'Other', choam ? 'choam' : 'atreides'),
    engine.newPlayer(observer.playerId, 'Observer', 'emperor'),
  );
  Object.assign(initial, {
    version: old.version,
    status: 'playing',
    phase: 5,
    turn: 2,
    active: owner.playerId,
    order: initial.players.map((p) => p.id),
    movementRemaining: initial.players.map((p) => p.id),
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of initial.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  const card = initial.richeseCache!.find((c) => c.effect === 'ornithopter')!;
  initial.richeseCache = initial.richeseCache!.filter((c) => c.id !== card.id);
  initial.players[0].hand.push(card);
  initial.players[0].forces = { 'imperial_basin:10': 3 };
  initial.players[0].reserves = 17;
  if (choam) {
    initial.players[1].forces = { 'hagga_basin:12': 1 };
    initial.players[1].reserves = 19;
  }
  if (marker) {
    initial.players[0].noField = createRicheseNoField([
      'private-zero',
      'private-three',
      'private-five',
    ]);
    initial.players[0].noField = deployRicheseNoField(
      initial.players[0].noField,
      {
        tokenId: 'private-three',
        controller: owner.playerId,
        location: { territory: 'carthag', sector: 11 },
      },
    );
    initial.players[0].noFieldEvent = 'original-marker-event';
  }
  const save = (g: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
  save(initial);
  store.writes.length = 0;
  const first: engine.Action = {
    type: 'move',
    movementCard: card.id,
    ornithopter: choam ? 'range3' : 'twoGroups',
    forces: { 'imperial_basin:10': 1 },
    territory: choam ? 'hagga_basin' : 'arrakeen',
    sector: choam ? 12 : 10,
  };
  return { ...store, code, owner, other, observer, initial, card, first, save };
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await ready;
  };
}
function committedOnce(
  results: PromiseSettledResult<unknown>[],
  writes: { changes: number }[],
) {
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
function receipt(g: engine.Game) {
  const c = g.pendingTreacheryDiscard?.continuation;
  assert.equal(c?.kind, 'ornithopterDiscard');
  if (c?.kind !== 'ornithopterDiscard') throw Error('Missing retired flight');
  return c;
}
function inventory(g: engine.Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
async function saveFrame(f: Fixture, frame: engine.Game) {
  receipt(frame);
  f.save(frame);
  f.writes.length = 0;
  for (const seat of [f.owner, f.other, f.observer]) {
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(f.restart().needsAutomaticRoomRecovery(view), true);
    assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
    assert.equal(view.ornithopter, null);
    assert.equal(view.decision, null);
    assert.equal(view.response, null);
    for (const p of view.players)
      assert.deepEqual(
        p.hand,
        p.id === seat.playerId
          ? frame.players.find((q) => q.id === p.id)!.hand
          : undefined,
      );
    if (seat.playerId !== f.owner.playerId)
      for (const secret of ['private-zero', 'private-three', 'private-five'])
        assert.equal(JSON.stringify(view).includes(secret), false);
  }
  assert.equal(f.writes.length, 0);
}
async function recoverRace(f: Fixture, frame: engine.Game) {
  f.hooks.beforeWrite = barrier();
  await Promise.all([
    f.restart().continueRoomAutomatic(f.code, clock),
    f.restart().continueRoomAutomatic(f.code, clock),
  ]);
  f.hooks.beforeWrite = undefined;
  const done = await f.restart().readRoom(f.code);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  assert.equal(done.version, frame.version + 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(
    done.resolvedTreacheryDiscardSequence,
    frame.treacheryDiscardSequence,
  );
  assert.deepEqual(
    done.players,
    frame.players,
    'committed force, marker, money and movement changes never replay',
  );
  assert.deepEqual(done.deck, frame.deck);
  assert.deepEqual(done.discard, frame.discard);
  assert.deepEqual(inventory(done), inventory(f.initial));
  assert.equal(
    done.log.filter((l) => l.text.includes('finished Ornithopter')).length,
    1,
  );
  assert.deepEqual(done.log.slice(0, frame.log.length), frame.log);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  return done;
}

void test('the original fixed-range room action drains its retirement in one CAS under duplicate requests', async () => {
  const f = await fixture();
  try {
    const action = {
      ...f.first,
      ornithopter: 'range3',
      territory: 'hagga_basin',
      sector: 12,
    };
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      f.restart().act(f.code, f.owner, f.initial.version, action, clock),
      f.restart().act(f.code, f.owner, f.initial.version, action, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    committedOnce(results, f.writes);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.resolvedTreacheryDiscardSequence, 1);
    assert.equal(done.ornithopter, null);
    assert.equal(done.players[0].moved, 1);
    assert.deepEqual(done.players[0].forces, {
      'imperial_basin:10': 2,
      'hagga_basin:12': 1,
    });
    assert.deepEqual(done.discard, [f.card]);
    assert.equal(
      done.log.filter((l) => l.text.includes('finished Ornithopter')).length,
      1,
    );
    assert.equal(
      done.log.filter((l) => l.text.includes('moved 1 forces')).length,
      1,
    );
    assert.equal(done.active, f.owner.playerId);
    assert.deepEqual(done.movementRemaining, f.initial.movementRemaining);
    assert.deepEqual(inventory(done), inventory(f.initial));
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 2);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
  } finally {
    f.sqlite.close();
  }
});

void test('frozen final movement creates its actual Terror arrival only after retirement recovery and never advances the turn', async () => {
  const f = await fixture();
  try {
    f.initial.players[1].faction = 'moritani';
    f.initial.moritaniTerror = createTerrorState(() => 0);
    const token = f.initial.moritaniTerror.tokens.find(
      (t) => t.kind === 'sabotage',
    )!;
    f.initial.moritaniTerror = placeTerror(
      f.initial.moritaniTerror,
      token.id,
      'arrakeen',
      1,
    );
    const action = { ...f.first, ornithopter: 'range3' };
    const frame = inner(f.initial, f.owner.playerId, action);
    assert.equal(receipt(frame).source, 'move');
    assert.equal(frame.pendingTerrorEntry ?? null, null);
    assert.equal(frame.players[0].moved, 1);
    assert.equal(
      frame.log.filter((l) => l.text.includes('moved 1 forces')).length,
      0,
    );
    await saveFrame(f, frame);
    await assert.rejects(
      f
        .restart()
        .act(f.code, f.other, frame.version, { type: 'endMovement' }, clock),
    );
    assert.equal(f.writes.length, 0);
    const done = await recoverRace(f, frame);
    assert.equal(done.pendingTerrorEntry?.stage, 'offer');
    assert.equal(done.decision?.player, f.other.playerId);
    assert.equal(done.decision?.kind, 'moritaniTerror');
    assert.equal(done.active, f.owner.playerId);
    assert.deepEqual(done.movementRemaining, frame.movementRemaining);
    assert.deepEqual(
      done.moritaniTerror,
      frame.moritaniTerror,
      'arrival offers but does not consume the token',
    );
    assert.equal(
      done.log.filter((l) => l.text.includes('moved 1 forces')).length,
      1,
    );
    const view = await f.restart().readSeatView(f.code, f.other);
    assert.equal(view.automaticContinuationPending, false);
    assert.equal(view.decision?.kind, 'moritaniTerror');
  } finally {
    f.sqlite.close();
  }
});

void test('early ending after zero prevented or one completed group restores only the movement queue once', async () => {
  for (const prevented of [false, true]) {
    const f = await fixture(prevented);
    try {
      if (prevented) {
        const at = f.initial.deck.findIndex((c) => c.name === 'Baliset');
        assert.ok(at >= 0);
        f.initial.players[1].hand.push(...f.initial.deck.splice(at, 1));
        f.save(f.initial);
      }
      await f.restart().act(f.code, f.owner, f.initial.version, f.first, clock);
      let prior = await f.restart().readRoom(f.code);
      if (prevented) {
        assert.equal(prior.decision?.kind, 'choamMovement');
        await f.restart().act(
          f.code,
          f.other,
          prior.version,
          {
            type: 'card',
            mode: 'choam',
            card: prior.players[1].hand[0].id,
            target: f.owner.playerId,
            territory: 'hagga_basin',
          },
          clock,
        );
        prior = await f.restart().readRoom(f.code);
      }
      assert.equal(prior.ornithopter!.completed, prevented ? 0 : 1);
      assert.equal(prior.pendingTreacheryDiscard ?? null, null);
      const frame = inner(prior, f.owner.playerId, { type: 'endMovement' });
      assert.equal(receipt(frame).source, 'end');
      assert.equal(receipt(frame).movement, null);
      assert.equal(frame.active, f.owner.playerId);
      assert.deepEqual(frame.movementRemaining, prior.movementRemaining);
      await saveFrame(f, frame);
      const done = await recoverRace(f, frame);
      assert.equal(done.active, f.other.playerId);
      assert.deepEqual(done.movementRemaining, [
        f.other.playerId,
        f.observer.playerId,
      ]);
      assert.equal(done.phase, 5);
      assert.equal(done.pendingTerrorEntry ?? null, null);
      assert.equal(
        done.log.filter((l) => l.text.includes('moved 1 forces')).length,
        prevented ? 0 : 1,
      );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('second-group concealed marker retirement preserves its new event and rejects stale or retired replays', async () => {
  const f = await fixture(false, true);
  try {
    await f.restart().act(f.code, f.owner, f.initial.version, f.first, clock);
    const prior = await f.restart().readRoom(f.code);
    assert.equal(prior.ornithopter?.completed, 1);
    assert.equal(prior.pendingTreacheryDiscard ?? null, null);
    const action = {
      type: 'move',
      ornithopterEvent: prior.ornithopter!.event,
      event: prior.players[0].noFieldEvent,
      noField: 'private-three',
      forces: {},
      territory: 'imperial_basin',
      sector: 11,
    };
    const frame = inner(prior, f.owner.playerId, action);
    assert.equal(receipt(frame).flight.completed, 2);
    assert.equal(receipt(frame).movement?.noField, true);
    assert.notEqual(
      frame.players[0].noFieldEvent,
      prior.players[0].noFieldEvent,
    );
    assert.deepEqual(frame.players[0].forces, prior.players[0].forces);
    await saveFrame(f, frame);
    const done = await recoverRace(f, frame);
    assert.equal(done.players[0].noFieldEvent, frame.players[0].noFieldEvent);
    assert.equal(done.players[0].moved, 2);
    assert.equal(
      done.log.filter((l) => l.text.includes('moved a concealed No-Field'))
        .length,
      1,
    );
    for (const version of [prior.version, done.version])
      await assert.rejects(
        f.restart().act(f.code, f.owner, version, action, clock),
      );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    assert.equal(f.writes.length, 2);
    const replay = structuredClone(done);
    replay.pendingTreacheryDiscard = frame.pendingTreacheryDiscard;
    f.save(replay);
    await assert.rejects(
      f.restart().continueRoomAutomatic(f.code, clock),
      /sequence|resolved/,
    );
    await assert.rejects(f.restart().readSeatView(f.code, f.owner));
    assert.deepEqual(await f.restart().readRoom(f.code), replay);
    assert.equal(f.writes.length, 2);
  } finally {
    f.sqlite.close();
  }
});

void test('corrupted retired flight receipt, custody, context and arrival reject before any room CAS', async () => {
  const f = await fixture();
  try {
    const moved = inner(f.initial, f.owner.playerId, {
      ...f.first,
      ornithopter: 'range3',
    });
    const first = engine.applyAction(f.initial, f.owner.playerId, f.first);
    const ended = inner(first, f.owner.playerId, { type: 'endMovement' });
    const changes: ((g: engine.Game) => void)[] = [
      (g) => {
        g.pendingTreacheryDiscard!.batch.event = 'old-discard';
      },
      (g) => {
        receipt(g).flight.event = 'other-flight';
      },
      (g) => {
        receipt(g).flight.player = f.other.playerId;
      },
      (g) => {
        receipt(g).flight.completed = 99;
      },
      (g) => {
        receipt(g).flight.turn--;
      },
      (g) => {
        g.players[0].moved++;
      },
      (g) => {
        g.movementRemaining!.reverse();
      },
      (g) => {
        g.active = f.other.playerId;
      },
      (g) => {
        g.players[0].hand.push(structuredClone(f.card));
      },
      (g) => {
        g.ornithopter = structuredClone(receipt(g).flight);
      },
      (g) => {
        receipt(g).stateSignature = '{}';
      },
      (g) => {
        receipt(g).resume.decision = {
          kind: 'stormDial',
        } as unknown as engine.Game['decision'];
      },
    ];
    for (const frame of [moved, ended]) {
      for (const change of changes) {
        const bad = structuredClone(frame);
        change(bad);
        f.save(bad);
        await assert.rejects(f.restart().readSeatView(f.code, f.owner));
        await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
        await assert.rejects(
          f
            .restart()
            .act(f.code, f.owner, bad.version, { type: 'advanceBots' }, clock),
        );
        assert.deepEqual(await f.restart().readRoom(f.code), bad);
        assert.equal(f.writes.length, 0);
      }
    }
    const bad = structuredClone(moved);
    receipt(bad).movement!.to = 'carthag';
    receipt(bad).movement!.sector = 11;
    f.save(bad);
    await assert.rejects(f.restart().continueRoomAutomatic(f.code, clock));
    assert.deepEqual(await f.restart().readRoom(f.code), bad);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});
