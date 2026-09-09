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
import { homeworldContext } from '../game/homeworld-game';
import { tupileOccupationStatus } from '../game/homeworld-occupation-history';
import {
  tupileIntelligenceFixture,
  tupileInventory,
  tupilePlayer as player,
  tupileReload as reload,
  holdTupileCard,
} from './fixture-tupile-intelligence';

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

type Game = engine.Game;
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function persisted() {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Tupile intelligence SQL QA',
    'choam',
    false,
    [],
  );
  const code = made.view.code;
  const credentials = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    credentials.push(joined.token!);
  }
  const auths = await Promise.all(
    credentials.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const initial = tupileIntelligenceFixture({ seatIds: ids, contact: false });
  initial.code = code;
  initial.host = ids[0];
  initial.version = (await store.rooms.readRoom(code)).version;
  holdTupileCard(initial, ids[1], 'projectile');
  holdTupileCard(initial, ids[1], 'poison');
  holdTupileCard(initial, ids[1], 'shield');
  player(initial, ids[1]).spice = 997;
  const save = (state: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(initial);
  const other = await store.rooms.createRoom(
    'Untouched Tupile room',
    'fremen',
    false,
    [],
  );
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return {
    ...store,
    code,
    credentials,
    auths,
    ids,
    initial,
    save,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(f.code)!;
  return {
    version: row.version,
    hash: createHash('sha256').update(String(row.state)).digest('hex'),
  };
}
async function act(f: Fixture, g: Game, actor: string, action: engine.Action) {
  await f.restart().act(
    f.code,
    f.auths.find((auth) => auth.playerId === actor)!,
    g.version,
    action,
    clock,
  );
  return f.rooms.readRoom(f.code);
}
function request(
  f: Fixture,
  category: 'weapons' | 'defenses' = 'weapons',
): engine.Action {
  return { type: 'tupileIntelligence', target: f.ids[1], category };
}
async function contact(f: Fixture) {
  const owner = await f.rooms.readSeatView(f.code, f.auths[0]);
  const g = await act(f, f.initial, f.ids[0], {
    type: 'homeworldShip',
    event: owner.homeworldShipment!.event,
    destination: 'homeworld:atreides',
    sources: { 'homeworld:choam': { normal: 1, elite: 0 } },
  });
  assert.equal(
    g.homeworlds!.custody!.visitors['homeworld:atreides'][f.ids[0]].normal,
    1,
  );
  assert.equal(g.homeworldOccupationHistory!.qualifications.length, 0);
  assert.equal(
    (
      await f.rooms.readSeatView(f.code, f.auths[0])
    ).tupileIntelligence!.targets.find((t) => t.player === f.ids[1])!.blocked,
    null,
  );
  await restored(f, g);
  f.writes.length = 0;
  return g;
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  const before = snapshot(f);
  for (const [index, token] of f.credentials.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, f.ids[index]));
    for (const opponent of view.players.filter((p) => p.id !== auth.playerId)) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.spice, undefined);
    }
    if (index !== 0) {
      assert.equal(view.tupileIntelligence, null);
      // JSON export of another session's public/private view contains no CHOAM
      // observation identity or private consistency payload.
      const exported = JSON.stringify(view);
      for (const receipt of g.tupileIntelligence?.receipts ?? []) {
        assert.equal(exported.includes(receipt.event), false);
        assert.equal(exported.includes(receipt.signature), false);
      }
      assert.equal(exported.includes('tupileIntelligenceObservation'), false);
    }
    for (const entry of view.log.filter((entry) =>
      entry.text.includes('used Tupile intelligence'),
    )) {
      assert.doesNotMatch(
        entry.text,
        /997|weapons|defenses|count[=:]|balance[=:]/,
      );
    }
  }
  homeworldGameIntegrity(g);
  tupileInventory(g);
  assert.deepEqual(snapshot(f), before);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
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

void test('production SQL competing weapon and defense requests reveal one historical answer to CHOAM and consume the target once', async () => {
  const f = await persisted();
  try {
    const g = await contact(f);
    barrier(f);
    const outcomes = await Promise.allSettled([
      f.rooms.act(f.code, f.auths[0], g.version, request(f, 'weapons'), clock),
      f
        .restart()
        .act(f.code, f.auths[0], g.version, request(f, 'defenses'), clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(
      outcomes.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.rooms.readRoom(f.code);
    assert.equal(done.version, g.version + 1);
    assert.equal(done.tupileIntelligence!.receipts.length, 1);
    const receipt = done.tupileIntelligence!.receipts[0];
    assert.equal(receipt.spice, 997);
    assert.equal(receipt.count, receipt.category === 'weapons' ? 2 : 1);
    assert.equal(receipt.target, f.ids[1]);
    assert.deepEqual(done.players, g.players);
    assert.deepEqual(done.homeworlds, g.homeworlds);
    const before = snapshot(f);
    for (const category of ['weapons', 'defenses'] as const) {
      await assert.rejects(
        f.rooms.act(f.code, f.auths[0], g.version, request(f, category), clock),
      );
      await assert.rejects(
        f.rooms.act(
          f.code,
          f.auths[0],
          done.version,
          request(f, category),
          clock,
        ),
        /already been used/,
      );
    }
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL a lost answer response is recovered privately and remains the original snapshot after target balance and hand change', async () => {
  const f = await persisted();
  try {
    const g = await contact(f);
    // Deliberately discard the successful response to model a lost network reply.
    await f.rooms.act(f.code, f.auths[0], g.version, request(f), clock);
    const done = await f.restart().readRoom(f.code);
    const expected = structuredClone(done.tupileIntelligence!.receipts[0]);
    assert.equal(expected.count, 2);
    const changed = reload(done);
    // A conserved later hand fixture proves stored observations do not follow
    // current private data; it does not invent a second request or receipt.
    changed.deck.push(...player(changed, f.ids[1]).hand.splice(0));
    player(changed, f.ids[1]).spice = 13;
    f.save(changed);
    const rooms = await restored(f, changed);
    const owner = await rooms.readSeatView(f.code, f.auths[0]);
    assert.deepEqual(owner.tupileIntelligence!.receipts, [
      {
        event: expected.event,
        target: expected.target,
        faction: expected.faction,
        category: 'weapons',
        spice: 997,
        count: 2,
        turn: expected.turn,
        phase: expected.phase,
      },
    ]);
    assert.deepEqual(changed.tupileIntelligence!.receipts[0], expected);
    const before = snapshot(f);
    f.writes.length = 0;
    await assert.rejects(
      rooms.act(
        f.code,
        f.auths[0],
        changed.version,
        request(f, 'defenses'),
        clock,
      ),
      /already been used/,
    );
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL corrupt answer, lifetime usage, setup marker or occupation evidence rejects every session without database writes', async () => {
  const f = await persisted();
  try {
    const g = await contact(f);
    const answered = await act(f, g, f.ids[0], request(f));
    const cases: ((state: Game) => void)[] = [
      (state) => {
        state.tupileIntelligence!.receipts[0].count++;
      },
      (state) => {
        state.tupileIntelligence!.receipts[0].spice++;
      },
      (state) => {
        state.tupileIntelligence!.receipts[0].category = 'defenses';
      },
      (state) => {
        state.tupileIntelligence!.receipts = [];
      },
      (state) => {
        delete state.tupileIntelligence;
      },
      (state) => {
        delete state.homeworlds!.historyVersion;
      },
      (state) => {
        delete state.homeworldOccupationHistory;
      },
      (state) => {
        state.homeworldOccupationHistory!.sources[0].event = 'another-setup';
      },
      (state) => {
        state.homeworldOccupationHistory!.signature = 'changed-history';
      },
    ];
    for (const mutate of cases) {
      const corrupt = reload(answered);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths)
        await assert.rejects(
          rooms.readSeatView(f.code, auth),
          /Tupile|Homeworld|occupation/i,
        );
      await assert.rejects(
        rooms.act(f.code, f.auths[0], corrupt.version, request(f), clock),
        /Tupile|Homeworld|occupation/i,
      );
      const stateBefore = reload(corrupt);
      assert.throws(
        () => engine.normalizeAutomaticGame(corrupt),
        /Tupile|Homeworld|occupation/i,
      );
      assert.deepEqual(corrupt, stateBefore);
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL legacy history absence stays unknown on reads and normalization with no reconstructed intelligence', async () => {
  const f = await persisted();
  try {
    const g = await contact(f);
    // Explicit legacy save seam: this game predates all three initialization
    // fields. Removing only one from an initialized game is tested above.
    delete g.homeworlds!.historyVersion;
    delete g.homeworldOccupationHistory;
    delete g.tupileIntelligence;
    f.save(g);
    f.writes.length = 0;
    const before = snapshot(f);
    const rooms = await restored(f, g);
    const view = await rooms.readSeatView(f.code, f.auths[0]);
    assert.match(view.tupileIntelligence!.blocked!, /lacks.*history/);
    assert.deepEqual(view.tupileIntelligence!.receipts, []);
    assert.equal(
      tupileOccupationStatus(
        g.homeworldOccupationHistory,
        homeworldContext(g),
        g.turn,
      ),
      'unknown',
    );
    const normalized = engine.normalizeAutomaticGame(reload(g));
    assert.deepEqual(normalized, g);
    await assert.rejects(
      rooms.act(f.code, f.auths[0], g.version, request(f), clock),
      /lacks.*history/,
    );
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    assert.equal(f.writes.length, 0);
  } finally {
    f.sqlite.close();
  }
});

void test('production SQL actual sole occupation suppresses Tupile after the qualifier departs without inventing a current controller', async () => {
  const f = await persisted();
  try {
    let g = await contact(f);
    assert.equal(
      tupileOccupationStatus(
        g.homeworldOccupationHistory,
        homeworldContext(g),
        g.turn,
      ),
      'unoccupied',
    );
    // Conserved battle-position seam empties natives before a genuine invading
    // Homeworld shipment. CHOAM keeps its real contact on Atreides throughout.
    player(g, f.ids[0]).forces['polar_sink:0'] += player(g, f.ids[0]).reserves;
    player(g, f.ids[0]).reserves = 0;
    g.active = f.ids[2];
    g.movementRemaining = [f.ids[2]];
    player(g, f.ids[2]).shipped = false;
    f.save(g);
    const invasionView = await f.rooms.readSeatView(f.code, f.auths[2]);
    g = await act(f, g, f.ids[2], {
      type: 'homeworldShip',
      event: invasionView.homeworldShipment!.event,
      destination: 'homeworld:choam',
      sources: { 'homeworld:harkonnen': { normal: 1, elite: 0 } },
    });
    const evidence = structuredClone(
      g.homeworldOccupationHistory!.qualifications.filter(
        (q) => q.world === 'homeworld:choam',
      ),
    );
    assert.deepEqual(
      evidence.map((q) => [q.player, q.cause]),
      [[f.ids[2], 'sole']],
    );
    assert.equal(
      tupileOccupationStatus(
        g.homeworldOccupationHistory,
        homeworldContext(g),
        g.turn,
      ),
      'unknown',
    );
    const before = snapshot(f);
    await assert.rejects(
      f.rooms.act(f.code, f.auths[0], g.version, request(f), clock),
      /occupation/,
    );
    assert.deepEqual(snapshot(f), before);
    // A later unused shipment is staged in the same turn so departure does not
    // imply an invented turn-expiry policy. Departure to another foreign world
    // is a real action; ordinary return to Harkonnen's own world stays gated.
    player(g, f.ids[2]).shipped = false;
    f.save(g);
    const returnView = await f.rooms.readSeatView(f.code, f.auths[2]);
    g = await act(f, g, f.ids[2], {
      type: 'homeworldShip',
      event: returnView.homeworldShipment!.event,
      destination: 'homeworld:atreides',
      sources: { 'homeworld:choam': { normal: 1, elite: 0 } },
    });
    assert.equal(
      g.homeworlds!.custody!.visitors['homeworld:choam']?.[f.ids[2]],
      undefined,
    );
    assert.deepEqual(
      g.homeworldOccupationHistory!.qualifications.filter(
        (q) => q.world === 'homeworld:choam',
      ),
      evidence,
    );
    assert.equal(
      tupileOccupationStatus(
        g.homeworldOccupationHistory,
        homeworldContext(g),
        g.turn,
      ),
      'unknown',
    );
    const departed = snapshot(f);
    f.writes.length = 0;
    await assert.rejects(
      f.restart().act(f.code, f.auths[0], g.version, request(f), clock),
      /occupation/,
    );
    await restored(f, g);
    assert.deepEqual(snapshot(f), departed);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(g.tupileIntelligence!.receipts, []);
  } finally {
    f.sqlite.close();
  }
});
