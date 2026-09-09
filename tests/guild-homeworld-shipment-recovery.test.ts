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
import { richeseCards } from '../game/richese-cards';

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
  const made = await store.rooms.createRoom(
    'Guild Arrakis recovery QA',
    'guild',
    true,
    [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['emperor', 'atreides'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    tokens.push(joined.token!);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  let g = await store.rooms.readRoom(code);
  g = engine.applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = engine.applyAction(g, player.id, { type: 'ready' });
  g = engine.initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
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
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  const ids = g.players.map((p) => p.id);
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    order: ids,
    active: ids[0],
    ready: [],
    storm: 18,
  });
  for (const player of g.players) player.shipped = false;
  const hold = (index: number, effect: string) => {
    const at = g.deck.findIndex((card) => card.effect === effect);
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[index].hand.push(card);
    return card.id;
  };
  const karama = hold(0, 'karama');
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  homeworldGameIntegrity(g);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched other table',
    'atreides',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    auths,
    ids,
    save,
    initial: g,
    karama,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function declaration(
  state: engine.Game,
  destination = 'homeworld:atreides',
): engine.Action {
  return {
    type: 'guildHomeworldShip',
    event: engine.viewGame(state, state.players[0].id).guildHomeworldShipment!
      .event,
    destination,
    sources: { 'tueks_sietch:5': { normal: 3, elite: 0 } },
  };
}
const allowance = (g: engine.Game): engine.Action => ({
  type: 'decision',
  allow: true,
  event: g.pendingHomeworldShipment!.event,
});
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
async function restored(f: Fixture, state: engine.Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, f.ids[i]));
    for (const opponent of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.traitors, undefined);
    }
    const event =
      view.guildHomeworldShipment?.event ?? view.homeworldShipment!.event;
    for (const player of state.players) {
      for (const card of player.hand)
        assert.equal(event.includes(card.id), false);
      for (const traitor of player.traitors)
        assert.equal(event.includes(traitor), false);
    }
  }
  homeworldGameIntegrity(state);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
async function pending(f: Fixture) {
  await f.rooms.act(
    f.code,
    f.auths[0],
    f.initial.version,
    declaration(f.initial),
    clock,
  );
  const g = await f.rooms.readRoom(f.code);
  assert.equal(g.decision?.kind, 'homeworldShipmentGuild');
  assert.equal(g.pendingHomeworldShipment!.route, 'arrakis');
  assert.equal(g.decision.player, g.decision.shipper);
  assert.equal(g.players[0].spice, f.initial.players[0].spice);
  assert.deepEqual(g.homeworlds!.custody, f.initial.homeworlds!.custody);
  f.writes.length = 0;
  return g;
}

for (const duplicate of [false, true])
  void test(`concurrent SQL Guild Arrakis ${duplicate ? 'duplicate' : 'competing'} declarations store one unpaid shipment`, async () => {
    const f = await fixture();
    try {
      const fresh = await restored(f, f.initial);
      barrier(f);
      const results = await Promise.allSettled([
        f.rooms.act(
          f.code,
          f.auths[0],
          f.initial.version,
          declaration(f.initial),
          clock,
        ),
        fresh.act(
          f.code,
          f.auths[0],
          f.initial.version,
          declaration(
            f.initial,
            duplicate ? 'homeworld:atreides' : 'homeworld:guild',
          ),
          clock,
        ),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const after = await fresh.readRoom(f.code);
      assert.equal(after.version, f.initial.version + 1);
      assert.equal(after.decision?.kind, 'homeworldShipmentGuild');
      assert.equal(
        after.pendingHomeworldShipment!.destination,
        duplicate || results[0].status === 'fulfilled'
          ? 'homeworld:atreides'
          : 'homeworld:guild',
      );
      assert.deepEqual(after.players, f.initial.players);
      assert.deepEqual(
        after.homeworlds!.custody,
        f.initial.homeworlds!.custody,
      );
      await restored(f, after);
    } finally {
      f.sqlite.close();
    }
  });

for (const intercepted of [false, true])
  void test(`concurrent SQL Guild allowance versus ${intercepted ? 'interception' : 'duplicate allowance'} settles one Homeworld shipment`, async () => {
    const f = await fixture();
    try {
      const before = await pending(f);
      const fresh = await restored(f, before);
      barrier(f);
      const results = await Promise.allSettled([
        f.rooms.act(
          f.code,
          f.auths[0],
          before.version,
          allowance(before),
          clock,
        ),
        fresh.act(
          f.code,
          f.auths[0],
          before.version,
          intercepted
            ? { type: 'card', mode: 'special', card: f.karama }
            : allowance(before),
          clock,
        ),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const after = await fresh.readRoom(f.code);
      const stopped = intercepted && results[1].status === 'fulfilled';
      assert.equal(after.version, before.version + 1);
      assert.equal(after.pendingHomeworldShipment, null);
      assert.equal(after.players[0].shipped, true);
      assert.equal(
        after.players[0].spice,
        before.players[0].spice - (stopped ? 0 : 2),
      );
      assert.equal(after.players[0].reserves, before.players[0].reserves);
      assert.equal(
        after.players[0].forces['tueks_sietch:5'],
        before.players[0].forces['tueks_sietch:5'] - (stopped ? 0 : 3),
      );
      assert.equal(
        after.discard.filter((card) => card.id === f.karama).length,
        stopped ? 1 : 0,
      );
      if (stopped)
        assert.deepEqual(after.homeworlds!.custody, before.homeworlds!.custody);
      else
        assert.deepEqual(
          after.homeworlds!.custody!.visitors['homeworld:atreides'][f.ids[0]],
          { normal: 3, elite: 0 },
        );
      await assert.rejects(
        fresh.act(f.code, f.auths[0], before.version, allowance(before), clock),
      );
      await assert.rejects(
        fresh.act(f.code, f.auths[0], after.version, allowance(before), clock),
      );
      await fresh.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await fresh.readRoom(f.code), after);
      await restored(f, after);
    } finally {
      f.sqlite.close();
    }
  });

void test('saved Guild Arrakis shipment event, typed pool and Guild parent corruption rejects every seat read and action without SQL writes', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    for (const mutate of [
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.event += 'stale';
      },
      (g: engine.Game) => {
        g.players[0].forces['tueks_sietch:5']--;
        g.players[0].forces['arrakeen:10'] = 1;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.pools[0].before.normal--;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.cost++;
      },
      (g: engine.Game) => {
        g.storm = 0;
      },
      (g: engine.Game) => {
        g.storm = 5;
      },
      (g: engine.Game) => {
        delete g.pendingHomeworldShipment!.route;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.sources['tueks_sietch:5'].normal = 0;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.pools[0].after.normal++;
      },
      (g: engine.Game) => {
        if (g.decision?.kind === 'homeworldShipmentGuild')
          g.decision.shipper = f.ids[2];
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment = null;
      },
    ]) {
      const corrupt = structuredClone(before);
      mutate(corrupt);
      f.save(corrupt);
      const fresh = f.restart();
      for (const auth of f.auths)
        await assert.rejects(fresh.readSeatView(f.code, auth));
      await assert.rejects(
        fresh.act(
          f.code,
          f.auths[0],
          corrupt.version,
          allowance(before),
          clock,
        ),
      );
      await assert.rejects(fresh.continueRoomAutomatic(f.code, clock));
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await fresh.readRoom(f.code), corrupt);
      assert.deepEqual(await fresh.readRoom(f.otherCode), f.otherBefore);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('paid Box search preserves a Guild self-interception parent through SQL restart and rejects paused-parent corruption', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    const box = richeseCards().find(
      (card) => card.effect === 'nullentropyBox',
    )!;
    before.players[0].hand.push(box);
    const recovered = before.deck.shift()!;
    before.discard.push(recovered);
    before.discard.push(before.deck.shift()!);
    const tooPoor = structuredClone(before);
    tooPoor.players[0].spice = 3;
    f.save(tooPoor);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[0],
        tooPoor.version,
        { type: 'card', card: box.id },
        clock,
      ),
    );
    assert.deepEqual(await f.rooms.readRoom(f.code), tooPoor);
    assert.equal(f.writes.length, 0);
    f.save(before);
    await f.rooms.act(
      f.code,
      f.auths[0],
      before.version,
      { type: 'card', card: box.id },
      clock,
    );
    const search = await f.rooms.readRoom(f.code);
    assert.equal(search.decision?.kind, 'nullentropy');
    assert.deepEqual(
      search.pendingNullentropy!.resume.decision,
      before.decision,
    );
    assert.equal(search.players[0].spice, before.players[0].spice - 2);
    await restored(f, search);
    const selection = {
      type: 'decision',
      event: search.pendingNullentropy!.event,
      card: recovered.id,
    };
    f.writes.length = 0;
    for (const mutate of [
      (g: engine.Game) => {
        delete g.pendingHomeworldShipment!.route;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment!.pools[0].before.normal--;
      },
      (g: engine.Game) => {
        g.storm = 0;
      },
      (g: engine.Game) => {
        g.pendingHomeworldShipment = null;
      },
      (g: engine.Game) => {
        const d = g.pendingNullentropy!.resume.decision!;
        if (d.kind === 'homeworldShipmentGuild') d.event += 'stale';
      },
      (g: engine.Game) => {
        const d = g.pendingNullentropy!.resume.decision!;
        if (d.kind === 'homeworldShipmentGuild') d.player = f.ids[2];
      },
    ]) {
      const corrupt = structuredClone(search);
      mutate(corrupt);
      f.save(corrupt);
      const fresh = f.restart();
      for (const auth of f.auths)
        await assert.rejects(fresh.readSeatView(f.code, auth));
      await assert.rejects(
        fresh.act(f.code, f.auths[0], corrupt.version, selection, clock),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await fresh.readRoom(f.code), corrupt);
    }
    f.save(search);
    const fresh = f.restart();
    await fresh.act(f.code, f.auths[0], search.version, selection, clock);
    const resumed = await fresh.readRoom(f.code);
    assert.equal(resumed.pendingNullentropy, null);
    assert.deepEqual(resumed.decision, before.decision);
    assert.equal(resumed.players[0].spice, search.players[0].spice);
    assert.equal(
      resumed.players[0].hand.filter((c) => c.id === recovered.id).length,
      1,
    );
    assert.equal(resumed.discard.filter((c) => c.id === box.id).length, 1);
    await fresh.act(
      f.code,
      f.auths[0],
      resumed.version,
      allowance(resumed),
      clock,
    );
    const after = await fresh.readRoom(f.code);
    assert.equal(after.players[0].spice, before.players[0].spice - 4);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent automatic SQL recovery permits an old zero-card Guild Arrakis interception exactly once', async () => {
  const f = await fixture();
  try {
    const before = await pending(f);
    before.deck.push(...before.players[0].hand.splice(0));
    f.save(before);
    const fresh = await restored(f, before);
    barrier(f);
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      fresh.continueRoomAutomatic(f.code, clock),
    ]);
    delete f.hooks.beforeWrite;
    const after = await fresh.readRoom(f.code);
    assert.equal(after.version, before.version + 1);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(after.pendingHomeworldShipment, null);
    assert.equal(after.decision, null);
    assert.equal(after.players[0].shipped, true);
    assert.equal(after.players[0].spice, before.players[0].spice - 2);
    assert.deepEqual(
      after.homeworlds!.custody!.visitors['homeworld:atreides'][f.ids[0]],
      { normal: 3, elite: 0 },
    );
    await fresh.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await fresh.readRoom(f.code), after);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('legacy Guild reserve return competes with a world-origin shipment through the same SQL opportunity', async () => {
  const f = await fixture();
  try {
    const fresh = f.restart();
    const legacy = {
      type: 'guildShip',
      from: 'tueks_sietch:5',
      amount: 3,
      territory: 'reserves',
    };
    const world = {
      type: 'homeworldShip',
      event: engine.viewGame(f.initial, f.ids[0]).homeworldShipment!.event,
      destination: 'homeworld:atreides',
      sources: { 'homeworld:guild': { normal: 3, elite: 0 } },
    };
    barrier(f);
    const results = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[0], f.initial.version, legacy, clock),
      fresh.act(f.code, f.auths[0], f.initial.version, world, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
    const declared = await fresh.readRoom(f.code);
    const returning = results[0].status === 'fulfilled';
    assert.equal(
      declared.pendingHomeworldShipment!.route,
      returning ? 'arrakis' : undefined,
    );
    assert.equal(
      declared.pendingHomeworldShipment!.destination,
      returning ? 'homeworld:guild' : 'homeworld:atreides',
    );
    assert.equal(declared.players[0].spice, f.initial.players[0].spice);
    await fresh.act(
      f.code,
      f.auths[0],
      declared.version,
      allowance(declared),
      clock,
    );
    const after = await fresh.readRoom(f.code);
    assert.equal(
      after.players[0].reserves,
      f.initial.players[0].reserves + (returning ? 3 : -3),
    );
    assert.equal(
      after.players[0].forces['tueks_sietch:5'],
      f.initial.players[0].forces['tueks_sietch:5'] - (returning ? 3 : 0),
    );
    assert.equal(after.players[0].spice, f.initial.players[0].spice - 2);
    assert.equal(after.players[0].shipped, true);
    const writes = f.writes.length;
    await assert.rejects(
      fresh.act(f.code, f.auths[0], after.version, legacy, clock),
    );
    await assert.rejects(
      fresh.act(f.code, f.auths[0], after.version, world, clock),
    );
    assert.equal(f.writes.length, writes);
    assert.deepEqual(await fresh.readRoom(f.code), after);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('legacy Guild return cannot bypass canonical source, special identity, storm or Homeworld restrictions in SQL', async () => {
  const f = await fixture();
  try {
    const legacy = {
      type: 'guildShip',
      from: 'tueks_sietch:5',
      amount: 3,
      territory: 'reserves',
    };
    for (const action of [
      { ...legacy, from: 'tueks_sietch:05' },
      { ...legacy, from: 'reserves' },
      { ...legacy, amount: 6 },
      { ...legacy, elite: 1 },
      { ...legacy, noField: 'invented' },
      { ...legacy, sector: 5 },
      { ...legacy, territory: 'homeworld:harkonnen' },
      { ...legacy, forces: { 'tueks_sietch:05': 3 } },
    ]) {
      await assert.rejects(
        f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), f.initial);
    }
    const storm = structuredClone(f.initial);
    storm.storm = 5;
    f.save(storm);
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], storm.version, legacy, clock),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), storm);
    const allies = structuredClone(f.initial);
    allies.players[0].ally = f.ids[1];
    allies.players[1].ally = f.ids[0];
    f.save(allies);
    for (const destination of ['homeworld:emperor', 'homeworld:emperor:salusa'])
      await assert.rejects(
        f.rooms.act(
          f.code,
          f.auths[0],
          allies.version,
          { ...legacy, territory: destination },
          clock,
        ),
      );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), allies);
    assert.deepEqual(await f.rooms.readRoom(f.otherCode), f.otherBefore);
  } finally {
    f.sqlite.close();
  }
});
