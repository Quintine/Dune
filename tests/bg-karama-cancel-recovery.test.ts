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

type Source = 'gift' | 'retention' | 'legacy';
function inventory(g: engine.Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
async function fixture(source: Source = 'gift', convert = true) {
  const store = unitStore();
  const made = await store.rooms.createRoom('BG', 'beneGesserit', false, []);
  const code = made.view.code;
  const tokens = [made.token];
  for (const [name, faction] of [
    ['Ally', 'guild'],
    ['Emperor', 'emperor'],
    ...(source === 'retention' ? [['Moritani', 'harkonnen']] : []),
  ] as const) {
    const joined = await store.rooms.joinRoom(
      code,
      name,
      faction as 'guild' | 'emperor' | 'harkonnen',
    );
    tokens.push(joined.token!);
  }
  const seats = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );
  const ids = seats.map((s) => s.playerId);
  const old = await store.restart().readRoom(code);
  const g = engine.createGame(
    code,
    engine.newPlayer(ids[0], 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    engine.newPlayer(
      ids[1],
      'Ally',
      source === 'retention' ? 'guild' : 'richese',
    ),
    engine.newPlayer(ids[2], 'Emperor', 'emperor'),
  );
  if (source === 'retention')
    g.players.push(engine.newPlayer(ids[3], 'Moritani', 'moritani'));
  // Bounded expansion scenario with production credentials, migrations and
  // one physical deck/cache. Opportunities below are genuine API actions;
  // this does not exercise or change the closed expansion start gate.
  Object.assign(g, {
    version: old.version,
    status: 'playing',
    phase: source === 'retention' ? 6 : source === 'legacy' ? 2 : 4,
    turn: 2,
    storm: 18,
    active: ids[2],
    order: [ids[2], ids[0], ids[1], ...ids.slice(3)],
    ready: [],
    deck: baseDeck(),
    richeseCache: richeseCards(),
    richeseRemoved: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
    for (const leader of p.leaders) leader.strength = 0;
  }
  if (source === 'retention') {
    for (const index of [1, 2]) {
      g.players[index].forces = { 'arrakeen:10': 5 };
      g.players[index].reserves = 15;
    }
    g.players[1].ally = ids[3];
    g.players[3].ally = ids[1];
  } else {
    g.players[1].ally = ids[2];
    g.players[2].ally = ids[1];
  }
  function hold(
    index: number,
    predicate: (card: engine.Game['deck'][number]) => boolean,
    cache = false,
  ) {
    const pile = cache ? g.richeseCache! : g.deck;
    const at = pile.findIndex(predicate);
    assert.ok(at >= 0);
    const card = pile.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const worthless = hold(0, (c) => c.kind === 'worthless');
  const karama = hold(2, (c) => c.effect === 'karama');
  const spare =
    source === 'legacy' ? hold(2, (c) => c.effect === 'karama') : null;
  const box = hold(2, (c) => c.effect === 'nullentropyBox', true);
  const selected = g.deck.splice(
    g.deck.findIndex((c) => c.name === 'Lasgun'),
    1,
  )[0];
  g.discard.push(selected);
  const weapon =
    source === 'retention' ? hold(1, (c) => c.kind === 'projectile') : null;
  const defense =
    source === 'retention' ? hold(1, (c) => c.kind === 'snooper') : null;
  const physical = inventory(g);
  const save = (state: engine.Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(state), state.version, code);
  save(g);
  async function act(index: number, action: engine.Action) {
    const state = await store.restart().readRoom(code);
    await store.restart().act(code, seats[index], state.version, action, clock);
    return store.restart().readRoom(code);
  }
  async function allow() {
    let state = await store.restart().readRoom(code);
    for (let i = 0; state.response && i < 30; i++) {
      const index = state.players.findIndex(
        (p) => !state.response!.passed.includes(p.id),
      );
      assert.ok(index >= 0);
      state = await act(index, { type: 'passResponse' });
    }
    assert.equal(state.response, null);
    return state;
  }
  let pending: engine.Game;
  if (source === 'gift')
    pending = await act(2, { type: 'emperorGift', amount: 3 });
  else if (source === 'retention') {
    await act(2, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: ids[1],
    });
    let battle = await allow();
    for (let i = 0; battle.battle?.preparation && i < 20; i++) {
      await act(ids.indexOf(battle.battle.preparation.owner), {
        type: 'declineBattlePower',
      });
      battle = await allow();
    }
    await act(2, {
      type: 'battlePlan',
      dial: 3,
      support: 3,
      leader: g.players[2].leaders[0].id,
    });
    await act(1, {
      type: 'battlePlan',
      dial: 0,
      support: 0,
      leader: g.players[1].leaders[0].id,
      weapon: weapon!.id,
      defense: defense!.id,
    });
    await act(2, { type: 'traitorCall', call: false });
    battle = await act(1, { type: 'traitorCall', call: false });
    for (
      let i = 0;
      battle.decision &&
      ['battleCards', 'battleLosses'].includes(battle.decision.kind) &&
      i < 10;
      i++
    )
      battle = await act(
        ids.indexOf(battle.decision.player),
        battle.decision.kind === 'battleCards'
          ? { type: 'decision', discard: [] }
          : { type: 'decision', choice: 0 },
      );
    assert.equal(battle.decision?.kind, 'moritaniRetention');
    pending = await act(1, {
      type: 'decision',
      keep: battle.moritaniRetention!.eligible[0],
    });
  } else {
    for (const index of [0, 1, 2]) await act(index, { type: 'ready' });
    const bidding = await store.restart().readRoom(code);
    assert.equal(bidding.decision?.kind, 'richeseDeclaration');
    pending = await act(1, {
      type: 'decision',
      event: bidding.richeseBidding!.event,
      position: 'first',
    });
    assert.equal(pending.response?.kind, 'richeseAuction');
  }
  const original = structuredClone(pending.response!);
  if (convert && source !== 'legacy') {
    pending = await act(0, {
      type: 'card',
      card: worthless.id,
      mode: 'cancel',
    });
    assert.equal(pending.pendingKarama?.opportunity?.kind, 'cancel');
  }
  assert.deepEqual(inventory(pending), physical);
  store.writes.length = 0;
  return {
    ...store,
    code,
    tokens,
    seats,
    ids,
    act,
    save,
    pending,
    original,
    physical,
    worthless,
    karama,
    spare,
    box,
    selected,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function privateViews(f: Fixture) {
  const state = await f.restart().readRoom(f.code);
  for (const [index, token] of f.tokens.entries()) {
    const seat = await f.restart().authenticate(f.code, token);
    const view = await f.restart().readSeatView(f.code, seat);
    assert.equal('pendingKarama' in view, false);
    assert.equal(JSON.stringify(view).includes('"signature"'), false);
    for (const p of view.players) {
      if (p.id === seat.playerId)
        assert.deepEqual(p.hand, state.players[index].hand);
      else
        for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
          assert.equal(key in p, false, key);
    }
  }
}
async function raceAllowance(f: Fixture, pending: engine.Game) {
  let arrivals = 0,
    release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.writes.length = 0;
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await ready;
  };
  const results = await Promise.allSettled(
    [0, 1].map(() =>
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          pending.version,
          { type: 'passResponse' },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, pending.version + 1);
  assert.equal(done.pendingKarama, null);
  assert.deepEqual(inventory(done), f.physical);
  assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  assert.equal(f.writes.length, 2);
  await assert.rejects(
    f
      .restart()
      .act(
        f.code,
        f.seats[2],
        pending.version,
        { type: 'passResponse' },
        clock,
      ),
    /changed/i,
  );
  assert.equal(f.writes.length, 2);
  return done;
}
void test('genuine BG gift cancellation survives authenticated restart and concurrent final allowance without transferring spice', async () => {
  const f = await fixture();
  try {
    await privateViews(f);
    assert.equal(f.pending.pendingKarama!.use.kind, 'cancel');
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(f.writes.length, 0);
    const done = await raceAllowance(f, f.pending);
    assert.deepEqual(
      done.players.map((p) => p.spice),
      [20, 20, 20],
    );
    assert.equal(done.response, null);
    assert.equal(
      done.players[2].hand.some((c) => c.id === f.karama.id),
      true,
    );
  } finally {
    f.sqlite.close();
  }
});
void test('actual canceled Moritani retention keeps its completed combat outcome and disposes each played card once across CAS recovery', async () => {
  const f = await fixture('retention');
  try {
    await privateViews(f);
    const played = f.pending.moritaniRetention!.played;
    const outcomes = f.pending.players.map((p) => ({
      spice: p.spice,
      tanks: p.tanks,
    }));
    // Finishing the last battle enters Collection: its two surviving Emperor
    // forces receive the ordinary Advanced Arrakeen income exactly once.
    outcomes[2].spice += 2;
    const done = await raceAllowance(f, f.pending);
    assert.equal(
      done.log.filter((l) =>
        l.text.includes('received 2 spice from strongholds'),
      ).length,
      1,
    );
    assert.equal(done.moritaniRetention, null);
    assert.equal(done.phase, 7);
    assert.deepEqual(
      done.players.map((p) => ({ spice: p.spice, tanks: p.tanks })),
      outcomes,
    );
    for (const card of played) {
      assert.equal(done.discard.filter((c) => c.id === card).length, 1);
      assert.equal(
        done.players[1].hand.some((c) => c.id === card),
        false,
      );
    }
  } finally {
    f.sqlite.close();
  }
});
void test('paid Box suspension restores the original cancel stamp, commits its fee once and then finishes cancellation once', async () => {
  for (const source of ['gift', 'retention'] as const) {
    const f = await fixture(source);
    try {
      const paid = await f.act(2, { type: 'card', card: f.box.id });
      assert.ok(paid.pendingNullentropy);
      assert.equal(paid.pendingKarama, null);
      assert.deepEqual(
        paid.pendingNullentropy.resume.pendingKarama,
        f.pending.pendingKarama,
      );
      assert.equal(paid.players[2].spice, f.pending.players[2].spice - 2);
      await privateViews(f);
      const restored = await f.act(2, {
        type: 'decision',
        event: paid.pendingNullentropy.event,
        card: f.selected.id,
      });
      assert.deepEqual(restored.pendingKarama, f.pending.pendingKarama);
      const done = await raceAllowance(f, restored);
      assert.equal(
        done.players[2].spice,
        f.pending.players[2].spice - 2 + (source === 'retention' ? 2 : 0),
      );
      assert.equal(
        done.players[2].hand.filter((c) => c.id === f.selected.id).length,
        1,
      );
      assert.equal(done.discard.filter((c) => c.id === f.box.id).length, 1);
      assert.equal(
        done.log.filter((l) => l.text.includes('paid two spice to the bank'))
          .length,
        1,
      );
    } finally {
      f.sqlite.close();
    }
  }
});
void test('changed canceled intent, owner, target and parent reject from every seat with zero SQL writes, including a saved paid Box', async () => {
  for (const source of ['gift', 'retention'] as const)
    for (const box of [false, true]) {
      const f = await fixture(source);
      try {
        const pending = box
          ? await f.act(2, { type: 'card', card: f.box.id })
          : f.pending;
        const conversion = (g: engine.Game) =>
          box ? g.pendingNullentropy!.resume.pendingKarama! : g.pendingKarama!;
        const response = (g: engine.Game) => {
          const use = conversion(g).use;
          assert.equal(use.kind, 'cancel');
          if (use.kind !== 'cancel')
            throw Error('Fixture needs canceled response');
          return use.response;
        };
        const mutations: ((g: engine.Game) => void)[] = [
          (g) => {
            g.turn++;
          },
          (g) => {
            g.phase = 7;
          },
          (g) => {
            conversion(g).owner = f.ids[1];
          },
          (g) => {
            conversion(g).opportunity!.signature = '{}';
          },
          (g) => {
            response(g).intent = 'different source';
          },
          (g) => {
            response(g).owner = f.ids[0];
          },
          (g) => {
            response(g).recipient = f.ids[0];
          },
          (g) => {
            response(g).amount = 9;
          },
          (g) => {
            (box ? g.pendingNullentropy!.resume.response! : g.response!).owner =
              f.ids[1];
          },
          ...(source === 'retention'
            ? [
                (g: engine.Game) => {
                  g.moritaniRetention!.keep = g.moritaniRetention!.eligible[1];
                },
                (g: engine.Game) => {
                  g.lastBattleContext!.territory = 'carthag';
                },
                (g: engine.Game) => {
                  g.moritaniRetention!.owner = f.ids[2];
                },
              ]
            : []),
        ];
        f.writes.length = 0;
        for (const mutate of mutations) {
          const bad = structuredClone(pending);
          mutate(bad);
          f.save(bad);
          for (const seat of f.seats)
            await assert.rejects(f.restart().readSeatView(f.code, seat));
          assert.throws(() => engine.normalizeAutomaticGame(bad));
          if (box) await f.restart().continueRoomAutomatic(f.code, clock);
          else
            await assert.rejects(
              f.restart().continueRoomAutomatic(f.code, clock),
            );
          await assert.rejects(
            f.restart().act(
              f.code,
              f.seats[2],
              bad.version,
              box
                ? {
                    type: 'decision',
                    event: bad.pendingNullentropy!.event,
                    card: f.selected.id,
                  }
                : { type: 'passResponse' },
              clock,
            ),
          );
          assert.deepEqual(await f.restart().readRoom(f.code), bad);
          assert.equal(f.writes.length, 0);
        }
      } finally {
        f.sqlite.close();
      }
    }
});
void test('invalid actual Moritani cleanup custody rejects before BG pays its Worthless cost or writes a new room version', async () => {
  const f = await fixture('retention', false);
  try {
    assert.equal(f.pending.response?.kind, 'moritaniRetention');
    const mutations: ((g: engine.Game) => void)[] = [
      (g) => {
        const id = g.moritaniRetention!.played[0];
        const at = g.players[1].hand.findIndex((c) => c.id === id);
        g.deck.push(g.players[1].hand.splice(at, 1)[0]);
      },
      (g) => {
        g.deck.push(structuredClone(g.players[1].hand[0]));
      },
      (g) => {
        g.lastBattleContext!.winner = f.ids[1];
      },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(f.pending);
      mutate(bad);
      f.save(bad);
      await assert.rejects(
        f
          .restart()
          .act(
            f.code,
            f.seats[0],
            bad.version,
            { type: 'card', card: f.worthless.id, mode: 'cancel' },
            clock,
          ),
      );
      const saved = await f.restart().readRoom(f.code);
      assert.deepEqual(saved, bad);
      assert.equal(
        saved.players[0].hand.filter((c) => c.id === f.worthless.id).length,
        1,
      );
      assert.equal(
        saved.discard.some((c) => c.id === f.worthless.id),
        false,
      );
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
void test('a historical unstamped unsupported Richese-count cancellation remains recoverable by printed counter-cancellation after restart', async () => {
  const f = await fixture('legacy', false);
  try {
    const legacy = structuredClone(f.pending);
    const at = legacy.players[0].hand.findIndex((c) => c.id === f.worthless.id);
    // Historical persistence compatibility only: current actions refuse this
    // conversion before cost. Its actual original count declaration is retained.
    legacy.discard.push(legacy.players[0].hand.splice(at, 1)[0]);
    legacy.pendingKarama = {
      owner: f.ids[0],
      use: { kind: 'cancel', response: f.original },
    };
    legacy.response = {
      kind: 'worthlessKarama',
      owner: f.ids[0],
      passed: [],
      intent: 'Cancel a power used by Richese.',
    };
    f.save(legacy);
    await privateViews(f);
    const done = await f.act(2, {
      type: 'card',
      card: f.karama.id,
      mode: 'cancel',
    });
    assert.equal(done.pendingKarama, null);
    assert.deepEqual(done.response, f.original);
    assert.deepEqual(done.richeseBidding, legacy.richeseBidding);
    assert.deepEqual(inventory(done), f.physical);
    assert.equal(done.discard.filter((c) => c.id === f.worthless.id).length, 1);
    assert.equal(done.discard.filter((c) => c.id === f.karama.id).length, 1);
    assert.equal(
      done.players[2].hand.some((c) => c.id === f.spare!.id),
      true,
    );
    assert.equal(f.writes.length, 1);
    const version = done.version;
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.seats[2],
          version,
          { type: 'card', card: f.spare!.id, mode: 'cancel' },
          clock,
        ),
      /ruling/i,
    );
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    assert.equal(f.writes.length, 1);
  } finally {
    f.sqlite.close();
  }
});
