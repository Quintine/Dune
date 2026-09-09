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
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import {
  quoteHomeworldCustody,
  type HomeworldCustodyChange,
} from '../game/homeworld-custody';

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
function relocate(g: engine.Game, changes: HomeworldCustodyChange[]) {
  const quote = quoteHomeworldCustody(
    homeworldContext(g),
    g.homeworlds!.custody!,
    changes,
  );
  g.homeworlds!.custody = quote.state;
  for (const update of quote.players) {
    const player = g.players.find((player) => player.id === update.id)!;
    player.reserves = update.reserves;
    if (player.elites) player.elites.reserves = update.eliteReserves;
  }
  homeworldGameIntegrity(g);
}
async function fixture(kind: 'explosion' | 'stalled' = 'explosion') {
  const store = unitStore();
  const advanced = kind === 'explosion';
  const made = await store.rooms.createRoom(
    'Homeworld battle recovery QA',
    'atreides',
    advanced,
    [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['guild', 'emperor'] as const) {
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
      view.players.find((owner) => owner.id === player.id)!.bot = 'Easy';
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
  const ids = g.players.map((player) => player.id);
  Object.assign(g, {
    phase: 6,
    phaseOpening: null,
    response: null,
    decision: null,
    order: ids,
    active: ids[0],
    ready: [],
    storm: 18,
  });
  if (advanced)
    relocate(g, [
      {
        homeworld: 'homeworld:emperor',
        player: ids[2],
        withdraw: { normal: 1, elite: 0 },
        deposit: { normal: 0, elite: 1 },
      },
      {
        homeworld: 'homeworld:emperor:salusa',
        player: ids[2],
        withdraw: { normal: 0, elite: 1 },
        deposit: { normal: 1, elite: 0 },
      },
    ]);
  // Explicit conserved visitor positions after real setup. Invasion shipment
  // actions remain outside the scope of this runtime/persistence fixture.
  for (const index of kind === 'stalled' ? [0, 1] : [0])
    relocate(g, [
      {
        homeworld: `homeworld:${g.players[index].faction}`,
        player: ids[index],
        withdraw: { normal: 3, elite: 0 },
        deposit: { normal: 0, elite: 0 },
      },
      {
        homeworld: 'homeworld:emperor',
        player: ids[index],
        withdraw: { normal: 0, elite: 0 },
        deposit: { normal: 3, elite: 0 },
      },
    ]);
  if (kind === 'stalled') {
    const native = g.players[2];
    native.tanks = native.reserves;
    native.reserves = 0;
    native.elites!.tanks = native.elites!.reserves;
    native.elites!.reserves = 0;
    homeworldGameIntegrity(g);
  }
  const hold = (index: number, cardKind: string) => {
    const at = g.deck.findIndex((card) => card.kind === cardKind);
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[index].hand.push(card);
    return card.id;
  };
  const laser = kind === 'explosion' ? hold(0, 'lasgun') : null;
  const shield = kind === 'explosion' ? hold(2, 'shield') : null;
  g = engine.applyAction(g, ids[0], {
    type: 'chooseBattle',
    territory: 'homeworld:emperor',
    target: kind === 'explosion' ? ids[2] : ids[1],
  });
  for (
    let step = 0;
    (g.response || g.battle?.preparation || g.decision) && step < 30;
    step++
  ) {
    if (g.response)
      g = engine.applyAction(
        g,
        g.players.find((player) => !g.response!.passed.includes(player.id))!.id,
        { type: 'passResponse' },
      );
    else if (g.battle?.preparation)
      g = engine.applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    else {
      assert.equal(g.decision!.kind, 'fullPlanOffer');
      g = engine.applyAction(g, g.decision!.player, {
        type: 'decision',
        decline: true,
      });
    }
  }
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  const leader = (index: number) =>
    g.players[index].leaders.find((leader) => leader.strength === 1)?.id ??
    g.players[index].leaders[0].id;
  g = engine.applyAction(g, ids[0], {
    type: 'battlePlan',
    dial: kind === 'explosion' ? 0 : 1,
    support: 0,
    leader: leader(0),
    ...(laser ? { weapon: laser } : {}),
  });
  if (kind === 'explosion') {
    g = engine.applyAction(g, ids[2], {
      type: 'battlePlan',
      dial: 0,
      support: 0,
      leader: leader(2),
      defense: shield!,
    });
    g = engine.applyAction(g, ids[2], { type: 'traitorCall', call: false });
    assert.equal(g.decision?.kind, 'homeworldExplosion');
    assert.deepEqual(g.homeworldBattleLoss!.pool, { normal: 14, elite: 1 });
  } else {
    // Observed old save shape: second revealed plan was stored, but no caller
    // could submit a traitor vote. Recovery now owns the automatic settlement.
    g.battle!.plans[ids[1]] = {
      dial: 0,
      support: 0,
      leader: leader(1),
      weapon: null,
      defense: null,
    };
    g.battle!.revealed = true;
    assert.deepEqual(engine.viewGame(g, ids[0]).battle!.traitorVoters, []);
  }
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom(
    'Untouched saved table',
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
    laser,
    shield,
    otherCode: other.view.code,
    otherBefore,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function restored(f: Fixture, state: engine.Game) {
  const fresh = f.restart();
  for (let index = 0; index < f.tokens.length; index++) {
    const auth = await fresh.authenticate(f.code, f.tokens[index]);
    const view = await fresh.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(state, f.ids[index]));
    for (const opponent of view.players.filter(
      (player) => player.id !== f.ids[index],
    )) {
      assert.equal(opponent.hand, undefined);
      assert.equal(opponent.traitors, undefined);
    }
  }
  homeworldGameIntegrity(state);
  assert.deepEqual(await fresh.readRoom(f.otherCode), f.otherBefore);
  return fresh;
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
const choice = (state: engine.Game, index: number): engine.Action => ({
  type: 'decision',
  event: state.homeworldBattleLoss!.event,
  choice: index,
});

for (const choices of [
  [0, 0],
  [0, 1],
])
  void test(`native Homeworld explosion SQL choices ${choices.join('/')} settle one exact typed allocation across restarted modules`, async () => {
    const f = await fixture();
    try {
      const before = f.initial;
      const fresh = await restored(f, before);
      await fresh.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await fresh.readRoom(f.code), before);
      assert.equal(f.writes.length, 0);
      barrier(f);
      const auth = await fresh.authenticate(f.code, f.tokens[2]);
      const results = await Promise.allSettled([
        f.rooms.act(
          f.code,
          f.auths[2],
          before.version,
          choice(before, choices[0]),
          clock,
        ),
        fresh.act(
          f.code,
          auth,
          before.version,
          choice(before, choices[1]),
          clock,
        ),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.deepEqual(
        f.writes.map((write) => write.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const winner = results.findIndex(
        (result) => result.status === 'fulfilled',
      );
      const losses = before.homeworldBattleLoss!.options[choices[winner]];
      const after = await fresh.readRoom(f.code);
      assert.equal(after.version, before.version + 1);
      assert.equal(after.homeworldBattleLoss, null);
      assert.equal(after.battle, null);
      assert.equal(after.players[2].reserves, before.players[2].reserves - 2);
      assert.equal(after.players[2].tanks, 2);
      assert.equal(after.players[2].elites!.tanks, losses.elite);
      assert.deepEqual(
        after.homeworlds!.custody!.salusa,
        before.homeworlds!.custody!.salusa,
      );
      for (const card of [f.laser, f.shield])
        assert.equal(
          after.discard.filter((held) => held.id === card).length,
          1,
        );
      await assert.rejects(
        fresh.act(
          f.code,
          auth,
          before.version,
          choice(before, choices[winner]),
          clock,
        ),
      );
      await assert.rejects(
        fresh.act(
          f.code,
          auth,
          after.version,
          choice(before, choices[winner]),
          clock,
        ),
      );
      await fresh.continueRoomAutomatic(f.code, clock);
      assert.deepEqual(await fresh.readRoom(f.code), after);
      await restored(f, after);
    } finally {
      f.sqlite.close();
    }
  });

void test('saved Homeworld native loss receipts reject swapped same-total typed sources on read and action without SQL writes', async () => {
  const f = await fixture();
  try {
    for (const mutation of ['pool', 'receipt'] as const) {
      const corrupt = structuredClone(f.initial);
      if (mutation === 'pool')
        corrupt.homeworlds!.custody!.salusa = { normal: 0, elite: 5 };
      else corrupt.homeworldBattleLoss!.pool = { normal: 13, elite: 2 };
      f.save(corrupt);
      const fresh = f.restart();
      await assert.rejects(
        fresh.readSeatView(f.code, f.auths[2]),
        /Homeworld|pool|custody/i,
      );
      await assert.rejects(
        fresh.act(
          f.code,
          f.auths[2],
          corrupt.version,
          choice(corrupt, 0),
          clock,
        ),
        /Homeworld|pool|custody/i,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await fresh.readRoom(f.code), corrupt);
      assert.deepEqual(await fresh.readRoom(f.otherCode), f.otherBefore);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('concurrent recovery of an old zero-voter revealed Homeworld battle commits one settlement and restores every seat', async () => {
  const f = await fixture('stalled');
  try {
    const before = f.initial;
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
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    assert.equal(after.battle, null);
    assert.equal(after.lastBattleContext!.winner, f.ids[0]);
    assert.equal(after.players[0].tanks, 1);
    assert.equal(after.players[1].tanks, 3);
    assert.equal(after.players[2].tanks, 20);
    assert.deepEqual(
      after.homeworlds!.custody!.visitors['homeworld:emperor']![f.ids[0]],
      { normal: 2, elite: 0 },
    );
    await fresh.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await fresh.readRoom(f.code), after);
    await restored(f, after);
  } finally {
    f.sqlite.close();
  }
});
