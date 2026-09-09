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
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createDukeVidal } from '../game/duke-vidal';
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

/** Only a conserved expansion movement position is staged; credentials, arrival,
 * proposal, reply and all recovery/CAS operations use production room functions. */
async function fixture() {
  const store = unitStore();
  const made = await store.rooms.createRoom('Ecaz', 'harkonnen', false, []);
  const code = made.view.code;
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'emperor');
  const observer = await store.rooms.joinRoom(
    code,
    'Predictor',
    'beneGesserit',
  );
  const tokens = [made.token, entrant.token!, observer.token!];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const [ownerAuth, entrantAuth, observerAuth] = auths;
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(ownerAuth.playerId, 'Ecaz', 'ecaz');
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    advanced: true,
    expansions: ['ecaz'],
    storm: 18,
    active: entrantAuth.playerId,
    order: [entrantAuth.playerId, ownerAuth.playerId, observerAuth.playerId],
    movementRemaining: [
      entrantAuth.playerId,
      ownerAuth.playerId,
      observerAuth.playerId,
    ],
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
    dukeVidal: createDukeVidal(),
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      hand: [g.deck.shift()!],
      traitors: [p.leaders[0].id],
      traitorChoices: [],
      moved: 0,
      shipped: false,
    });
  Object.assign(player(g, observerAuth.playerId), {
    reserves: 0,
    tanks: 20,
    prediction: { faction: 'emperor', turn: 7 },
  });
  const ambassadors = createAmbassadors(() => 0);
  const token = ambassadors.tokens.find((t) => t.effect === 'ecaz')!;
  g.ecazAmbassadors = placeAmbassador(ambassadors, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  g.allianceOffers = {
    [ownerAuth.playerId]: observerAuth.playerId,
    [observerAuth.playerId]: entrantAuth.playerId,
  };
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched',
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
    ownerAuth,
    entrantAuth,
    observerAuth,
    save,
    initial: clone(g),
    tokenId: token.id,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fresh(f: Fixture) {
  f.rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((token) => f.rooms.authenticate(f.code, token)),
  );
  assert.deepEqual(
    auths.map((a) => a.playerId),
    f.auths.map((a) => a.playerId),
  );
  [f.ownerAuth, f.entrantAuth, f.observerAuth] = auths;
}
async function views(f: Fixture, g: engine.Game) {
  for (const auth of [f.ownerAuth, f.entrantAuth, f.observerAuth]) {
    const view = await f.rooms.readSeatView(f.code, auth);
    assert.deepEqual(
      view.players.find((p) => p.id === auth.playerId)!.hand,
      player(g, auth.playerId).hand,
    );
    assert.ok(
      view.players.every((p) => p.id === auth.playerId || !('hand' in p)),
    );
    for (const p of view.players)
      if (p.id !== auth.playerId) assert.ok(!('prediction' in p));
    if (g.pendingAmbassador?.stage === 'allianceReply') {
      assert.equal(view.ambassadorEntry?.stage, 'allianceReply');
      assert.equal(view.decision?.player, f.entrantAuth.playerId);
    }
  }
}
async function enterAndPropose(f: Fixture) {
  await f.rooms.act(
    f.code,
    f.entrantAuth,
    f.initial.version,
    { type: 'ship', amount: 2, territory: 'arrakeen', sector: 10 },
    clock,
  );
  const entered = await f.rooms.readRoom(f.code);
  assert.equal(entered.pendingAmbassador?.stage, 'offer');
  assert.equal(entered.decision?.player, f.ownerAuth.playerId);
  await fresh(f);
  await views(f, entered);
  await f.rooms.act(
    f.code,
    f.ownerAuth,
    entered.version,
    {
      type: 'decision',
      event: entered.pendingAmbassador!.event,
      trigger: true,
      choice: 'alliance',
      beneficiary: f.ownerAuth.playerId,
    },
    clock,
  );
  const offered = await f.rooms.readRoom(f.code);
  assert.equal(offered.pendingAmbassador?.stage, 'allianceReply');
  assert.equal(
    offered.ecazAmbassadors!.tokens.find((t) => t.id === f.tokenId)!.zone,
    'supply',
  );
  await fresh(f);
  await views(f, offered);
  return offered;
}
async function race(f: Fixture, g: engine.Game, answers: [boolean, boolean]) {
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
  const other = f.restart();
  const otherAuth = await other.authenticate(f.code, f.tokens[1]);
  const results = await Promise.allSettled([
    f.rooms.act(
      f.code,
      f.entrantAuth,
      g.version,
      {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        accept: answers[0],
      },
      clock,
    ),
    other.act(
      f.code,
      otherAuth,
      g.version,
      {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        accept: answers[1],
      },
      clock,
    ),
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
  return {
    after,
    accepted: answers[results.findIndex((r) => r.status === 'fulfilled')],
  };
}
async function invariant(f: Fixture, g: engine.Game) {
  const entrant = player(g, f.entrantAuth.playerId);
  assert.deepEqual(entrant.forces, { 'arrakeen:10': 2 });
  assert.equal(entrant.reserves, 18);
  assert.equal(entrant.spice, 18);
  assert.equal(entrant.shipped, true);
  assert.equal(entrant.moved, 0);
  assert.equal(g.phase, 5);
  assert.equal(g.active, entrant.id);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision, null);
  assert.deepEqual(g.dukeVidal, f.initial.dukeVidal);
  assert.deepEqual(
    g.ecazAmbassadors!.cohort,
    f.initial.ecazAmbassadors!.cohort,
  );
  assert.equal(
    g.ecazAmbassadors!.tokens.find((t) => t.id === f.tokenId)!.zone,
    'supply',
  );
  for (const p of g.players) {
    assert.deepEqual(p.hand, player(f.initial, p.id).hand);
    assert.deepEqual(p.prediction, player(f.initial, p.id).prediction);
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  assert.deepEqual(await f.rooms.readRoom(f.otherCode), f.otherBefore);
  await views(f, g);
}

for (const accept of [true, false])
  void test(`actual Ecaz alliance ${accept ? 'acceptance' : 'refusal'} survives fresh authentication and duplicate SQL CAS without replaying arrival`, async () => {
    const f = await fixture();
    try {
      const offered = await enterAndPropose(f);
      const { after } = await race(f, offered, [accept, accept]);
      assert.equal(
        player(after, f.ownerAuth.playerId).ally,
        accept ? f.entrantAuth.playerId : null,
      );
      assert.equal(
        player(after, f.entrantAuth.playerId).ally,
        accept ? f.ownerAuth.playerId : null,
      );
      if (accept) {
        assert.equal(player(after, f.ownerAuth.playerId).allySinceTurn, 2);
        assert.equal(player(after, f.entrantAuth.playerId).allySinceTurn, 2);
        assert.deepEqual(after.allianceOffers, {});
      } else assert.deepEqual(after.allianceOffers, f.initial.allianceOffers);
      assert.equal(after.log.length, offered.log.length + 1);
      await fresh(f);
      await invariant(f, after);
      f.writes.length = 0;
      for (const version of [offered.version, after.version])
        await assert.rejects(() =>
          f.rooms.act(
            f.code,
            f.entrantAuth,
            version,
            {
              type: 'decision',
              event: offered.pendingAmbassador!.event,
              accept,
            },
            clock,
          ),
        );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), after);
      await f.rooms.act(
        f.code,
        f.entrantAuth,
        after.version,
        {
          type: 'move',
          forces: { 'arrakeen:10': 1 },
          territory: 'imperial_basin',
          sector: 10,
        },
        clock,
      );
      const moved = await f.rooms.readRoom(f.code);
      assert.equal(player(moved, f.entrantAuth.playerId).moved, 1);
      assert.equal(player(moved, f.entrantAuth.playerId).spice, 18);
      assert.deepEqual(player(moved, f.entrantAuth.playerId).forces, {
        'arrakeen:10': 1,
        'imperial_basin:10': 1,
      });
    } finally {
      f.sqlite.close();
    }
  });

void test('competing accept and refuse requests produce one complete consent outcome and one chronicle entry', async () => {
  const f = await fixture();
  try {
    const offered = await enterAndPropose(f);
    const { after, accepted } = await race(f, offered, [true, false]);
    assert.equal(
      player(after, f.ownerAuth.playerId).ally,
      accepted ? f.entrantAuth.playerId : null,
    );
    assert.equal(
      player(after, f.entrantAuth.playerId).ally,
      accepted ? f.ownerAuth.playerId : null,
    );
    assert.equal(after.log.length, offered.log.length + 1);
    await invariant(f, after);
  } finally {
    f.sqlite.close();
  }
});

void test('wrong actor, malformed consent and corrupted saved reply provenance reject before SQL writes', async () => {
  const f = await fixture();
  try {
    const offered = await enterAndPropose(f);
    f.writes.length = 0;
    for (const auth of [f.ownerAuth, f.observerAuth])
      await assert.rejects(() =>
        f.rooms.act(
          f.code,
          auth,
          offered.version,
          {
            type: 'decision',
            event: offered.pendingAmbassador!.event,
            accept: true,
          },
          clock,
        ),
      );
    for (const action of [
      {
        type: 'decision',
        event: offered.pendingAmbassador!.event,
        accept: 'yes',
      },
      { type: 'decision', event: 'expired', accept: true },
    ])
      await assert.rejects(() =>
        f.rooms.act(f.code, f.entrantAuth, offered.version, action, clock),
      );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), offered);
    for (const mutate of [
      (g: engine.Game) => {
        g.pendingAmbassador!.turn++;
      },
      (g: engine.Game) => {
        g.pendingAmbassador!.beneficiary = f.ownerAuth.playerId;
      },
      (g: engine.Game) => {
        g.decision = null;
      },
      (g: engine.Game) => {
        g.ecazAmbassadors!.tokens.find((t) => t.id === f.tokenId)!.zone =
          'used';
      },
      (g: engine.Game) => {
        player(g, f.observerAuth.playerId).ally = f.entrantAuth.playerId;
      },
    ]) {
      const damaged = clone(offered);
      mutate(damaged);
      f.save(damaged);
      await fresh(f);
      f.writes.length = 0;
      await assert.rejects(() => f.rooms.readSeatView(f.code, f.entrantAuth));
      await assert.rejects(() =>
        f.rooms.act(
          f.code,
          f.entrantAuth,
          damaged.version,
          {
            type: 'decision',
            event: offered.pendingAmbassador!.event,
            accept: true,
          },
          clock,
        ),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await f.rooms.readRoom(f.code), damaged);
      assert.deepEqual(await f.rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally {
    f.sqlite.close();
  }
});
