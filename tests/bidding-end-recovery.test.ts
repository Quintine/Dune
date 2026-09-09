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

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(ecaz = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Kaitain recovery QA',
    'emperor',
    true,
    [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of [
    'atreides',
    'guild',
    ...(ecaz ? ['harkonnen'] : []),
  ] as const) {
    const joined = await store.rooms.joinRoom(
      code,
      faction,
      faction as engine.Player['faction'],
    );
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  // Offline lobby faction seam: public expansion joins remain gated, but final
  // identities precede every genuine setup allocation and signed history.
  g.players[2] = engine.newPlayer(g.players[2].id, 'CHOAM', 'choam');
  if (ecaz) g.players[3] = engine.newPlayer(g.players[3].id, 'Ecaz', 'ecaz');
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: engine.Game | undefined;
    for (const player of g.players) {
      const view = engine.viewGame(g, player.id);
      view.players.find((p) => p.id === player.id)!.bot = 'Easy';
      const action = bots.botActions(view)[0];
      if (action) {
        next = engine.applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine Homeworld setup must expose a legal choice.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  const ids = g.players.map((p) => p.id);
  // The final faction roster is established before genuine Homeworld setup.
  // These later positions preserve its signed identities and physical counters.
  g.players[2].name = 'CHOAM';
  if (ecaz) {
    Object.assign(g.players[3], {
      name: 'Ecaz',
      reserves: 20,
      forces: {},
    });
  }
  Object.assign(g, {
    phase: 2,
    turn: 2,
    storm: 18,
    active: null,
    order: ids,
    ready: [],
    phaseOpening: null,
    decision: null,
    response: null,
    choamCharity: { turn: 2, canceled: false },
  });
  for (const player of g.players) player.spice = 20;
  const hold = (
    who: number,
    predicate: (card: engine.Player['hand'][number]) => boolean,
  ) => {
    const at = g.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[who].hand.push(card);
    return card.id;
  };
  const poison = hold(0, (c) => c.kind === 'poison');
  const second = hold(0, (c) => c.kind === 'poison');
  const returned = hold(0, (c) => c.kind === 'shield');
  hold(0, (c) => c.kind === 'hero');
  const offered = hold(2, (c) => c.kind === 'worthless');
  g.players[0].ally = ids[2];
  g.players[2].ally = ids[0];
  homeworldGameIntegrity(g);
  for (const id of ids) g = engine.applyAction(g, id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  g = engine.applyAction(g, ids[2], { type: 'decision', done: true });
  assert.equal(g.phase, 3);
  assert.ok(g.auction, 'Real phase transition opens the auction.');
  for (let n = 0; g.auction && n < 40; n++)
    g = engine.applyAction(g, g.auction.active, { type: 'passBid' });
  assert.equal(g.auction, null);
  assert.ok(
    g.biddingEnd,
    'The completed real auction opens the shared window.',
  );
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched room',
    'atreides',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  const cardIds = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    ids,
    initial: g,
    poison,
    second,
    returned,
    offered,
    cardIds,
    save,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function snapshot(f: Fixture) {
  const row = f.sqlite
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(f.code)!;
  return {
    version: row.version,
    hash: createHash('sha256').update(String(row.state)).digest('hex'),
  };
}
async function restored(f: Fixture, state: engine.Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, f.ids[i]));
    for (const opponent of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.traitors, undefined);
      assert.equal(opponent.spice, undefined);
    }
    if (i !== 3) assert.deepEqual(view.ecazPoisonIncome, []);
    assert.ok(!JSON.stringify(view.biddingEnd).includes(f.poison));
  }
  homeworldGameIntegrity(state);
  for (const p of state.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
  }
  assert.deepEqual(
    [...state.deck, ...state.discard, ...state.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    f.cardIds,
  );
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
function action(
  g: engine.Game,
  details: Omit<engine.Action, 'type'>,
): engine.Action {
  return { type: 'biddingEnd', event: g.biddingEnd!.event, ...details };
}
function barrier(f: Fixture) {
  let arrivals = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await waiting;
  };
}

void test('production SQL duplicate Kaitain multi-card disposal charges, discards and restores exactly once', async () => {
  const f = await fixture();
  try {
    const rooms = await restored(f, f.initial);
    const command = action(f.initial, {
      mode: 'discard',
      cards: [f.second, f.poison],
    });
    barrier(f);
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[0], f.initial.version, command, clock),
      rooms.act(f.code, f.auths[0], f.initial.version, command, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.equal(done.players[0].spice, 16);
    for (const id of [f.poison, f.second])
      assert.equal(done.discard.filter((c) => c.id === id).length, 1);
    assert.equal(done.biddingEnd?.event, f.initial.biddingEnd!.event);
    assert.equal(done.auction, null);
    const before = snapshot(f);
    await assert.rejects(
      rooms.act(f.code, f.auths[0], f.initial.version, command, clock),
    );
    await assert.rejects(
      rooms.act(f.code, f.auths[0], done.version, command, clock),
    );
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL paid private poison disposal restores Ecaz income only to its owner without changing forces', async () => {
  const f = await fixture(true);
  try {
    const rooms = await restored(f, f.initial);
    await rooms.act(
      f.code,
      f.auths[0],
      f.initial.version,
      action(f.initial, { mode: 'discard', cards: [f.poison, f.second] }),
      clock,
    );
    const done = await rooms.readRoom(f.code);
    assert.equal(done.players[0].spice, 16);
    assert.equal(done.players[3].spice, 26);
    assert.equal(
      done.ecazPoisonIncome?.reduce((sum, income) => sum + income.amount, 0),
      6,
    );
    assert.equal(
      done.ecazPoisonIncome?.reduce((sum, income) => sum + income.count, 0),
      2,
    );
    for (let i = 0; i < done.players.length; i++) {
      assert.equal(done.players[i].reserves, f.initial.players[i].reserves);
      assert.deepEqual(done.players[i].forces, f.initial.players[i].forces);
    }
    const restarted = await restored(f, done);
    const ecaz = await restarted.readSeatView(f.code, f.auths[3]);
    assert.equal(
      ecaz.ecazPoisonIncome.reduce((sum, receipt) => sum + receipt.amount, 0),
      6,
    );
    const observer = await restarted.readSeatView(f.code, f.auths[1]);
    const newLogs = observer.log.slice(f.initial.log.length);
    assert.ok(!JSON.stringify(newLogs).includes('poison'));
    assert.ok(!JSON.stringify(newLogs).includes(f.poison));
    const before = snapshot(f);
    await restarted.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL restored readiness is reopened by an allied exchange and closes only after both owners agree again', async () => {
  const f = await fixture();
  try {
    let rooms = await restored(f, f.initial);
    await rooms.act(
      f.code,
      f.auths[0],
      f.initial.version,
      action(f.initial, { mode: 'ready' }),
      clock,
    );
    let g = await rooms.readRoom(f.code);
    assert.deepEqual(g.biddingEnd?.ready, [f.ids[0]]);
    rooms = await restored(f, g);
    await rooms.act(
      f.code,
      f.auths[2],
      g.version,
      action(g, { mode: 'trade', card: f.offered }),
      clock,
    );
    g = await rooms.readRoom(f.code);
    assert.deepEqual(g.biddingEnd?.ready, []);
    assert.equal(g.decision?.kind, 'choamTradeReply');
    rooms = await restored(f, g);
    await rooms.act(
      f.code,
      f.auths[0],
      g.version,
      { type: 'decision', card: f.returned },
      clock,
    );
    g = await rooms.readRoom(f.code);
    assert.equal(g.decision?.kind, 'choamTradeConfirm');
    rooms = await restored(f, g);
    await rooms.act(
      f.code,
      f.auths[2],
      g.version,
      { type: 'decision', accept: true },
      clock,
    );
    g = await rooms.readRoom(f.code);
    assert.ok(g.players[0].hand.some((c) => c.id === f.offered));
    assert.ok(g.players[2].hand.some((c) => c.id === f.returned));
    assert.deepEqual(g.biddingEnd?.ready, []);
    rooms = await restored(f, g);
    await rooms.act(
      f.code,
      f.auths[0],
      g.version,
      action(g, { mode: 'ready' }),
      clock,
    );
    g = await rooms.readRoom(f.code);
    assert.equal(g.phase, 3);
    rooms = await restored(f, g);
    const command = action(g, { mode: 'ready' });
    await rooms.act(f.code, f.auths[2], g.version, command, clock);
    const done = await rooms.readRoom(f.code);
    assert.equal(done.phase, 4);
    assert.equal(done.biddingEnd, null);
    assert.equal(done.choamMarket, null);
    const before = snapshot(f);
    await assert.rejects(
      rooms.act(f.code, f.auths[2], done.version, command, clock),
    );
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL invalid event, held cards and unaffordable Kaitain requests preserve room hash and avoid writes', async () => {
  const f = await fixture();
  try {
    for (const [state, command] of [
      [
        f.initial,
        action(f.initial, {
          event: 'expired',
          mode: 'discard',
          cards: [f.poison],
        }),
      ],
      [f.initial, action(f.initial, { mode: 'discard', cards: [f.offered] })],
      [
        f.initial,
        action(f.initial, { mode: 'discard', cards: [f.poison, f.poison] }),
      ],
      [
        (() => {
          const g = structuredClone(f.initial);
          g.players[0].spice = 1;
          return g;
        })(),
        action(f.initial, { mode: 'discard', cards: [f.poison] }),
      ],
    ] as [engine.Game, engine.Action][]) {
      f.save(state);
      const rooms = await restored(f, state);
      const before = snapshot(f);
      await assert.rejects(
        rooms.act(f.code, f.auths[0], state.version, command, clock),
      );
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL corrupted shared bidding parent rejects restored views and disposal without spending or writing', async () => {
  const f = await fixture();
  try {
    for (const mutate of [
      (g: engine.Game) => {
        g.biddingEnd!.turn++;
      },
      (g: engine.Game) => {
        g.biddingEnd!.owners.reverse();
      },
      (g: engine.Game) => {
        g.biddingEnd!.ready = [f.ids[0], f.ids[0]];
      },
      (g: engine.Game) => {
        g.choamMarket!.owner = f.ids[1];
      },
    ]) {
      const corrupt = structuredClone(f.initial);
      mutate(corrupt);
      f.save(corrupt);
      const before = snapshot(f);
      const rooms = f.restart();
      await assert.rejects(rooms.readSeatView(f.code, f.auths[0]));
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[0],
          corrupt.version,
          action(corrupt, { mode: 'discard', cards: [f.poison] }),
          clock,
        ),
      );
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
    }
    f.save(f.initial);
    await restored(f, f.initial);
  } finally {
    f.sqlite.close();
  }
});
