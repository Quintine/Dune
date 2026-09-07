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

/** Conserved offline board only; production last movement action creates every
 * collection receipt and allocation. Migrations, auth and CAS run in memory. */
async function fixture(
  form: 'basic' | 'advanced' | 'printed' | 'converted' = 'basic',
) {
  const store = unitStore();
  const host = await store.rooms.createRoom('Ecaz', 'harkonnen', false, []);
  const code = host.view.code;
  const ally = await store.rooms.joinRoom(code, 'Ally', 'atreides');
  const rival = await store.rooms.joinRoom(code, 'Rival', 'emperor');
  const bg = await store.rooms.joinRoom(code, 'Predictor', 'beneGesserit');
  const tokens = [host.token, ally.token!, rival.token!, bg.token!];
  const auths = await Promise.all(
    tokens.map((t) => store.rooms.authenticate(code, t)),
  );
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(auths[0].playerId, 'Ecaz', 'ecaz');
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    advanced: form !== 'basic',
    expansions: ['ecaz'],
    order: auths.map((a) => a.playerId),
    ready: [],
    active: auths[2].playerId,
    movementRemaining: [auths[2].playerId],
    response: null,
    decision: null,
    phaseOpening: null,
    ecazPlacementTurn: 2,
    deck: baseDeck(),
    discard: [],
    spice: { 'hagga_basin:12': 5, 'wind_pass:14': 7 },
  });
  for (const [i, p] of g.players.entries())
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: [11, 19, 23, 29][i],
      hand: [],
      traitors: [p.leaders[0].id],
      traitorChoices: [],
      shipped: true,
      moved: 0,
    });
  const take = (
    index: number,
    predicate: (c: engine.Player['hand'][number]) => boolean,
  ) => {
    const at = g.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const c = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(c);
    return c.id;
  };
  for (let i = 0; i < g.players.length; i++)
    take(i, (c) => c.kind === 'shield');
  let paidCard: string | null = null;
  if (form === 'printed') paidCard = take(2, (c) => c.effect === 'karama');
  if (form === 'converted') {
    paidCard = take(3, (c) => c.kind === 'worthless');
    take(0, (c) => c.effect === 'karama');
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 1, 'hagga_basin:12': 1, 'wind_pass:14': 1 };
    p.reserves = 17;
    p.allySinceTurn = 1;
  }
  g.players[0].ally = g.players[1].id;
  g.players[1].ally = g.players[0].id;
  g.players[3].prediction = { faction: 'ecaz', turn: 7 };
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, initial: g, save, paidCard };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function refresh(f: Fixture) {
  f.rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((t) => f.rooms.authenticate(f.code, t)),
  );
  assert.deepEqual(
    auths.map((a) => a.playerId),
    f.auths.map((a) => a.playerId),
  );
  assert.ok(auths.every((a, i) => a.tokenHash === f.auths[i].tokenHash));
  return f.rooms.readRoom(f.code);
}
async function start(f: Fixture) {
  await f.rooms.act(
    f.code,
    f.auths[2],
    f.initial.version,
    { type: 'endMovement' },
    clock,
  );
  return refresh(f);
}
async function act(
  f: Fixture,
  g: engine.Game,
  id: string,
  action: engine.Action,
) {
  const auth = f.auths.find((a) => a.playerId === id)!;
  assert.ok(auth);
  await f.rooms.act(f.code, auth, g.version, action, clock);
  return refresh(f);
}
async function race(
  f: Fixture,
  g: engine.Game,
  id: string,
  action: engine.Action,
) {
  const auth = f.auths.find((a) => a.playerId === id)!;
  let release!: () => void;
  let arrivals = 0;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.writes.length = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await barrier;
  };
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
  const after = await refresh(f);
  assert.equal(after.version, g.version + 1);
  return after;
}
function conserved(g: engine.Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}

function allocationAction(
  g: engine.Game,
  allocation: Record<string, unknown>,
): engine.Action {
  assert.equal(g.decision?.kind, 'ecazSpice');
  assert.equal(g.ecazCollection?.stage, 'allocation');
  return { type: 'decision', event: g.ecazCollection!.event, allocation };
}
async function equalAll(f: Fixture, input: engine.Game) {
  let g = input;
  let decisions = 0;
  while (g.decision?.kind === 'ecazSpice' && decisions < 4) {
    g = await act(
      f,
      g,
      g.decision.player,
      allocationAction(g, { kind: 'equal' }),
    );
    decisions++;
  }
  assert.equal(decisions, 2);
  assert.equal(g.ecazCollection?.stage, 'complete');
  assert.equal(g.decision, null);
  assert.equal(g.phase, 7);
  return g;
}
async function privateViews(f: Fixture, g: engine.Game) {
  const views = await Promise.all(
    f.auths.map((a) => f.rooms.readSeatView(f.code, a)),
  );
  for (const [index, view] of views.entries())
    for (const p of view.players) {
      if (p.id === f.auths[index].playerId) {
        assert.deepEqual(p.hand, player(g, p.id).hand);
        assert.equal(p.spice, player(g, p.id).spice);
        assert.deepEqual(p.prediction, player(g, p.id).prediction);
      } else {
        assert.equal('spice' in p, false);
        assert.equal('hand' in p, false);
        assert.equal('prediction' in p, false);
      }
    }
  return views;
}

void test('real Basic collection restores a zero-share proposal and counteroffer, and simultaneous acceptance credits once', async () => {
  const f = await fixture();
  try {
    delete f.initial.spice['wind_pass:14'];
    f.save(f.initial);
    const other = await f.rooms.createRoom(
      'Unrelated human',
      'guild',
      false,
      [],
    );
    const untouched = await f.rooms.readRoom(other.view.code);
    let g = await start(f);
    assert.equal(g.decision?.kind, 'ecazSpice');
    assert.equal(g.decision?.player, f.auths[0].playerId);
    assert.deepEqual(
      g.players.map((p) => p.forces),
      f.initial.players.map((p) => p.forces),
    );
    const proposal = allocationAction(g, { kind: 'propose', ecazShare: 0 });
    g = await race(f, g, f.auths[0].playerId, proposal);
    assert.equal(g.decision?.player, f.auths[1].playerId);
    await privateViews(f, g);
    g = await act(
      f,
      g,
      f.auths[1].playerId,
      allocationAction(g, { kind: 'propose', ecazShare: 5 }),
    );
    assert.equal(g.decision?.player, f.auths[0].playerId);
    const before = clone(g);
    const accept = allocationAction(g, { kind: 'accept' });
    g = await race(f, g, f.auths[0].playerId, accept);
    assert.equal(g.ecazCollection?.stage, 'complete');
    assert.equal(g.phase, 7);
    assert.equal(g.decision, null);
    assert.equal(g.players[0].spice, 16);
    assert.equal(g.players[1].spice, 19);
    assert.equal(g.spice['hagga_basin:12'] ?? 0, 0);
    assert.deepEqual(engine.normalizeAutomaticGame(clone(g)), clone(g));
    const log = JSON.stringify(g.log);
    f.writes.length = 0;
    await assert.rejects(() =>
      f.rooms.act(f.code, f.auths[0], before.version, accept, clock),
    );
    await assert.rejects(() =>
      f.rooms.act(f.code, f.auths[0], g.version, accept, clock),
    );
    assert.deepEqual(f.writes, []);
    assert.equal(JSON.stringify((await refresh(f)).log), log);
    assert.deepEqual(await f.rooms.readRoom(other.view.code), untouched);
    conserved(g);
  } finally {
    f.sqlite.close();
  }
});

void test('printed and BG-converted Advanced bank cancellation survive reload while two desert pools keep their default odd-to-ally split', async () => {
  for (const form of ['printed', 'converted'] as const) {
    const f = await fixture(form);
    try {
      let g = await start(f);
      assert.equal(g.response?.kind, 'ecazCollection');
      const canceler = f.auths[form === 'printed' ? 2 : 3].playerId;
      g = await act(f, g, canceler, {
        type: 'card',
        card: f.paidCard!,
        mode: 'cancel',
      });
      if (form === 'converted')
        assert.equal(g.response?.kind, 'worthlessKarama');
      for (let n = 0; g.response && n < 12; n++) {
        const responder = g.players.find(
          (p) => !g.response!.passed.includes(p.id),
        )!;
        assert.ok(responder);
        g = await race(f, g, responder.id, { type: 'passResponse' });
      }
      assert.equal(g.response, null);
      assert.equal(g.ecazCollection?.canceled, true);
      g = await equalAll(f, g);
      assert.equal(g.players[0].spice, 16);
      assert.equal(g.players[1].spice, 27);
      assert.equal(g.players[2].spice, 23);
      assert.equal(g.players[3].spice, 29);
      assert.equal(g.spice['hagga_basin:12'] ?? 0, 0);
      assert.equal(g.spice['wind_pass:14'], 1);
      assert.equal(g.discard.filter((c) => c.id === f.paidCard).length, 1);
      assert.deepEqual(engine.normalizeAutomaticGame(clone(g)), clone(g));
      await privateViews(f, g);
      conserved(g);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('allocation refresh preserves private seats and rejects stale event, wrong actor and malformed shares before any SQL write', async () => {
  const f = await fixture('advanced');
  try {
    const g = await start(f);
    assert.equal(g.decision?.kind, 'ecazSpice');
    const views = await privateViews(f, g);
    const variant = clone(g);
    variant.players[3].prediction = { faction: 'atreides', turn: 9 };
    f.save(variant);
    await refresh(f);
    const changed = await privateViews(f, variant);
    for (let i = 0; i < 3; i++) assert.deepEqual(changed[i], views[i]);
    // Compare independent saved states; this is a privacy perturbation, not a
    // gameplay resource grant. The production rival projection must not change.
    const differentBalances = clone(variant);
    differentBalances.players[0].spice += 100;
    differentBalances.players[1].spice += 200;
    f.save(differentBalances);
    await refresh(f);
    assert.deepEqual(
      await f.rooms.readSeatView(f.code, f.auths[2]),
      changed[2],
    );
    f.save(variant);
    await refresh(f);
    await assert.rejects(() =>
      f.rooms.readSeatView(f.code, {
        ...f.auths[0],
        tokenHash: f.auths[2].tokenHash,
      }),
    );
    const valid = allocationAction(variant, { kind: 'equal' });
    const bad = [
      { ...valid, event: 'ecaz-collection:stale' },
      allocationAction(variant, { kind: 'propose', ecazShare: -1 }),
      allocationAction(variant, { kind: 'propose', ecazShare: 999 }),
      allocationAction(variant, { kind: 'propose', ecazShare: 0.5 }),
      allocationAction(variant, { kind: 'accept' }),
    ];
    f.writes.length = 0;
    for (const action of bad)
      await assert.rejects(() =>
        f.rooms.act(f.code, f.auths[0], variant.version, action, clock),
      );
    await assert.rejects(() =>
      f.rooms.act(f.code, f.auths[2], variant.version, valid, clock),
    );
    assert.deepEqual(f.writes, []);
    assert.deepEqual(await refresh(f), variant);
    const done = await equalAll(f, variant);
    assert.equal(done.players[0].spice, 18);
    assert.equal(done.players[1].spice, 27);
    conserved(done);
  } finally {
    f.sqlite.close();
  }
});
