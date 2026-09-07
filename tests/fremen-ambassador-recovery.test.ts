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
} from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
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
async function fixture(kind: 'clean' | 'baliset' | 'terror') {
  const store = unitStore();
  const created = await store.rooms.createRoom('Ecaz', 'emperor', false, []);
  const code = created.view.code;
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'guild');
  const other = await store.rooms.joinRoom(code, 'Other', 'atreides');
  const bg =
    kind === 'baliset'
      ? await store.rooms.joinRoom(code, 'BG', 'beneGesserit')
      : null;
  const tokens = [
    created.token,
    entrant.token!,
    other.token!,
    ...(bg ? [bg.token!] : []),
  ];
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const [ownerAuth, entrantAuth, otherAuth, bgAuth] = auths;
  const g = await store.rooms.readRoom(code);
  g.players[0] = engine.newPlayer(ownerAuth.playerId, 'Ecaz', 'ecaz');
  g.players[2] = engine.newPlayer(
    otherAuth.playerId,
    'Other',
    kind === 'baliset' ? 'choam' : kind === 'terror' ? 'moritani' : 'atreides',
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    advanced: true,
    expansions: ['ecaz'],
    storm: 18,
    active: entrantAuth.playerId,
    order: auths.map((a) => a.playerId),
    movementRemaining: [
      entrantAuth.playerId,
      ...auths.filter((a) => a !== entrantAuth).map((a) => a.playerId),
    ],
    response: null,
    decision: null,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      hand: [],
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [p.leaders[0].id],
      traitorChoices: [],
    });
  const take = (
    id: string,
    predicate: (card: engine.Player['hand'][number]) => boolean,
  ) => {
    const index = g.deck.findIndex(predicate);
    assert.ok(index >= 0);
    player(g, id).hand.push(g.deck.splice(index, 1)[0]);
  };
  take(ownerAuth.playerId, (c) => c.kind === 'shield');
  take(entrantAuth.playerId, (c) => c.effect === 'karama');
  take(otherAuth.playerId, (c) =>
    kind === 'baliset' ? c.name === 'Baliset' : c.kind === 'poison',
  );
  if (bgAuth) {
    take(bgAuth.playerId, (c) => c.kind === 'worthless');
    player(g, bgAuth.playerId).reserves = 0;
    player(g, bgAuth.playerId).tanks = 20;
  }
  player(g, entrantAuth.playerId).forces = { 'imperial_basin:10': 3 };
  player(g, entrantAuth.playerId).reserves = 17;
  player(g, ownerAuth.playerId).forces = {
    'hagga_basin:12': 2,
    'hagga_basin:13': 1,
  };
  player(g, ownerAuth.playerId).reserves = 17;
  if (kind === 'baliset') {
    player(g, otherAuth.playerId).forces = { 'carthag:11': 1 };
    player(g, otherAuth.playerId).reserves = 19;
  }
  const ambassadors = createAmbassadors(() => 0.3);
  const selected = ambassadors.tokens.find((t) => t.effect === 'fremen')!;
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
  g.ecazAmbassadors = placeAmbassador(ambassadors, selected.id, {
    turn: 2,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  if (kind === 'terror') {
    g.moritaniTerror = createTerrorState(() => 0);
    const token = g.moritaniTerror.tokens.find((t) => t.kind === 'sabotage')!;
    g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'carthag', 1);
  }
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  await store.rooms.act(
    code,
    entrantAuth,
    g.version,
    {
      type: 'move',
      from: 'imperial_basin:10',
      amount: 1,
      territory: 'arrakeen',
      sector: 10,
    },
    clock,
  );
  const arrived = await store.rooms.readRoom(code);
  assert.equal(arrived.pendingAmbassador?.stage, 'offer');
  const event = arrived.pendingAmbassador!.event;
  await store.rooms.act(
    code,
    ownerAuth,
    arrived.version,
    { type: 'decision', event, trigger: true, beneficiary: ownerAuth.playerId },
    clock,
  );
  const pending = await store.rooms.readRoom(code);
  assert.equal(pending.pendingAmbassador?.stage, 'move');
  store.writes.length = 0;
  return {
    ...store,
    code,
    auths,
    tokens,
    ownerAuth,
    entrantAuth,
    otherAuth,
    bgAuth,
    save,
    pending,
    event,
    move: {
      type: 'decision',
      event,
      forces: { 'hagga_basin:12': 2, 'hagga_basin:13': 1 },
      territory: 'carthag',
      sector: 11,
    },
  };
}
function barrier() {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await wait;
  };
}
function conserved(g: engine.Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, baseDeck().length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}
async function fresh(f: Awaited<ReturnType<typeof fixture>>) {
  const rooms = f.restart();
  const auths = await Promise.all(
    f.tokens.map((token) => rooms.authenticate(f.code, token)),
  );
  return { rooms, auths };
}
async function race(
  f: Awaited<ReturnType<typeof fixture>>,
  auth: Rooms.SeatAuth,
  g: engine.Game,
  action: engine.Action,
) {
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const attempts = await Promise.allSettled([
    f.rooms.act(f.code, auth, g.version, action, clock),
    f.restart().act(f.code, auth, g.version, action, clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((a) => a.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const result = await f.rooms.readRoom(f.code);
  assert.equal(result.version, g.version + 1);
  return result;
}

void test('actual remote relocation restores private views and commits once across competing authenticated requests', async () => {
  const f = await fixture('clean');
  try {
    const { rooms, auths } = await fresh(f);
    const before = await rooms.readRoom(f.code);
    for (const auth of auths) {
      const view = await rooms.readSeatView(f.code, auth);
      assert.equal(
        !!view.ambassadorEntry?.movement,
        auth.playerId === f.ownerAuth.playerId,
      );
      assert.deepEqual(
        view.players.find((p) => p.id === auth.playerId)!.hand,
        player(before, auth.playerId).hand,
      );
      assert.ok(
        view.players.every((p) => p.id === auth.playerId || !('hand' in p)),
      );
    }
    const after = await race(f, auths[0], before, f.move);
    assert.equal(after.pendingAmbassador, null);
    assert.equal(after.active, f.entrantAuth.playerId);
    assert.deepEqual(player(after, f.ownerAuth.playerId).forces, {
      'carthag:11': 3,
    });
    for (const p of before.players) {
      const now = player(after, p.id);
      assert.equal(now.moved, p.moved);
      assert.equal(now.shipped, p.shipped);
      assert.equal(now.spice, p.spice);
      assert.deepEqual(now.hand, p.hand);
    }
    assert.equal(
      after.log.filter(
        (l) => l.automatic?.name === 'Fremen Ambassador relocation',
      ).length,
      1,
    );
    assert.deepEqual(after.movementRemaining, before.movementRemaining);
    conserved(after);
    f.writes.length = 0;
    await assert.rejects(
      rooms.act(f.code, auths[0], after.version, f.move, clock),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await rooms.readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});

void test('persisted Baliset BG cancellation resumes the declared Ambassador move exactly once', async () => {
  const f = await fixture('baliset');
  try {
    await f.rooms.act(f.code, f.ownerAuth, f.pending.version, f.move, clock);
    let g = await f.rooms.readRoom(f.code);
    assert.equal(g.decision?.kind, 'choamMovement');
    assert.equal(g.pendingChoamMove?.source, 'ambassador');
    await f.rooms.act(
      f.code,
      f.otherAuth,
      g.version,
      {
        type: 'card',
        mode: 'choam',
        card: player(g, f.otherAuth.playerId).hand.find(
          (c) => c.name === 'Baliset',
        )!.id,
      },
      clock,
    );
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.response?.kind, 'choamWorthless');
    const worthless = player(g, f.bgAuth!.playerId).hand.find(
      (c) => c.kind === 'worthless',
    )!.id;
    await f.rooms.act(
      f.code,
      f.bgAuth!,
      g.version,
      { type: 'card', mode: 'cancel', card: worthless },
      clock,
    );
    g = await f.rooms.readRoom(f.code);
    assert.equal(g.response?.kind, 'worthlessKarama');
    assert.equal(g.pendingChoamMove?.ambassadorEvent, f.event);
    const resumed = await fresh(f);
    f.rooms = resumed.rooms;
    while (g.response) {
      const actor = f.auths.find(
        (a) => !g.response!.passed.includes(a.playerId),
      )!;
      const action = { type: 'passResponse' };
      const trial = engine.applyAction(g, actor.playerId, action);
      if (!trial.pendingAmbassador) {
        const after = await race(f, actor, g, action);
        assert.equal(after.pendingAmbassador, null);
        assert.equal(after.pendingChoamMove, null);
        assert.deepEqual(player(after, f.ownerAuth.playerId).forces, {
          'carthag:11': 3,
        });
        assert.equal(after.discard.filter((c) => c.id === worthless).length, 1);
        assert.ok(
          player(after, f.otherAuth.playerId).hand.some(
            (c) => c.name === 'Baliset',
          ),
        );
        assert.equal(
          after.log.filter(
            (l) => l.automatic?.name === 'Fremen Ambassador relocation',
          ).length,
          1,
        );
        assert.equal(player(after, f.entrantAuth.playerId).moved, 1);
        conserved(after);
        return;
      }
      await f.rooms.act(f.code, actor, g.version, action, clock);
      g = await f.rooms.readRoom(f.code);
    }
    assert.fail('Expected a final response allowance');
  } finally {
    f.sqlite.close();
  }
});

void test('Terror child and Sabotage disposal finish the original relocation without replay after reload', async () => {
  const f = await fixture('terror');
  try {
    await f.rooms.act(f.code, f.ownerAuth, f.pending.version, f.move, clock);
    let g = await f.rooms.readRoom(f.code);
    assert.equal(g.pendingAmbassador?.stage, 'arrival');
    assert.equal(g.pendingTerrorEntry?.cause, 'ambassador');
    const before = JSON.parse(JSON.stringify(g)) as engine.Game;
    const { rooms, auths } = await fresh(f);
    f.rooms = rooms;
    const afterReveal = await race(f, auths[2], g, {
      type: 'decision',
      reveal: true,
    });
    assert.equal(afterReveal.pendingTerrorEntry?.stage, 'gift');
    assert.equal(afterReveal.treacheryDiscardSequence, 1);
    assert.equal(afterReveal.resolvedTreacheryDiscardSequence, 1);
    assert.equal(player(afterReveal, f.ownerAuth.playerId).hand.length, 0);
    assert.equal(
      afterReveal.log.filter((l) =>
        l.text.includes('random Treachery card to Sabotage'),
      ).length,
      1,
    );
    g = await race(f, auths[2], afterReveal, {
      type: 'decision',
      decline: true,
    });
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.pendingTerrorEntry, null);
    assert.deepEqual(
      player(g, f.ownerAuth.playerId).forces,
      player(before, f.ownerAuth.playerId).forces,
    );
    assert.equal(
      g.log.filter((l) => l.automatic?.name === 'Fremen Ambassador relocation')
        .length,
      1,
    );
    assert.equal(player(g, f.entrantAuth.playerId).moved, 1);
    conserved(g);
  } finally {
    f.sqlite.close();
  }
});

void test('copied malformed completed-parent receipts reject before any SQL mutation', async () => {
  const f = await fixture('terror');
  try {
    await f.rooms.act(f.code, f.ownerAuth, f.pending.version, f.move, clock);
    const valid = await f.rooms.readRoom(f.code);
    const changes: ((g: engine.Game) => void)[] = [
      (g) => {
        (g.pendingAmbassador!.relocation as unknown as { next: string }).next =
          'forged';
      },
      (g) => {
        g.pendingAmbassador!.relocation!.order.player = f.entrantAuth.playerId;
      },
      (g) => {
        g.pendingTerrorEntry!.amount++;
      },
      (g) => {
        g.pendingAmbassador!.event = 'replaced';
      },
    ];
    for (const change of changes) {
      const bad = JSON.parse(JSON.stringify(valid)) as engine.Game;
      change(bad);
      f.save(bad);
      f.writes.length = 0;
      const rooms = f.restart();
      await assert.rejects(
        rooms.act(
          f.code,
          f.otherAuth,
          bad.version,
          { type: 'decision', decline: true },
          clock,
        ),
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.code), bad);
    }
    f.save(valid);
    f.writes.length = 0;
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.ownerAuth,
        valid.version,
        { type: 'decision', decline: true },
        clock,
      ),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.otherAuth,
        valid.version - 1,
        { type: 'decision', decline: true },
        clock,
      ),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), valid);
  } finally {
    f.sqlite.close();
  }
});

void test('legacy saved mandatory move with no surviving sources automatically finishes once under racing workers', async () => {
  const f = await fixture('clean');
  try {
    // Copied legacy/interruption save after a genuine entry and trigger. The
    // beneficiary's three on-board units were lost; card/token custody remains.
    const waiting = JSON.parse(JSON.stringify(f.pending)) as engine.Game;
    const owner = player(waiting, f.ownerAuth.playerId);
    owner.forces = {};
    owner.tanks = 3;
    f.save(waiting);
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    await Promise.all([
      f.rooms.continueRoomAutomatic(f.code, clock),
      f.restart().continueRoomAutomatic(f.code, clock),
    ]);
    delete f.hooks.beforeWrite;
    const after = await f.rooms.readRoom(f.code);
    assert.equal(after.version, waiting.version + 1);
    assert.equal(after.pendingAmbassador, null);
    assert.equal(after.decision, null);
    assert.deepEqual(
      f.writes.map((w) => w.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.deepEqual(player(after, f.ownerAuth.playerId).forces, {});
    assert.equal(player(after, f.ownerAuth.playerId).moved, owner.moved);
    assert.equal(
      after.log.filter((l) =>
        l.text.includes('has no legal Fremen Ambassador relocation'),
      ).length,
      1,
    );
    assert.equal(
      after.log.filter(
        (l) => l.automatic?.name === 'Fremen Ambassador relocation',
      ).length,
      0,
    );
    conserved(after);
    f.writes.length = 0;
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(await f.rooms.readRoom(f.code), after);
  } finally {
    f.sqlite.close();
  }
});
