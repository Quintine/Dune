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
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
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

async function fixture(guild = false) {
  const store = unitStore();
  const created = await store.rooms.createRoom('Richese', 'guild', false, []);
  const code = created.view.code;
  const joined = await store.rooms.joinRoom(code, 'Ally', 'atreides');
  const third = await store.rooms.joinRoom(code, 'Other', 'emperor');
  const owner = await store.rooms.authenticate(code, created.token);
  const ally = await store.rooms.authenticate(code, joined.token!);
  const other = await store.rooms.authenticate(code, third.token!);
  const stored = await store.rooms.readRoom(code);
  const initial = engine.createGame(
    code,
    engine.newPlayer(owner.playerId, 'Richese', 'richese'),
    guild,
    ['choam'],
  );
  initial.players.push(
    engine.newPlayer(ally.playerId, 'Ally', 'atreides'),
    engine.newPlayer(other.playerId, 'Other', guild ? 'guild' : 'emperor'),
  );
  initial.version = stored.version;
  initial.status = 'playing';
  initial.phase = 5;
  initial.turn = 2;
  initial.active = ally.playerId;
  initial.order = initial.players.map((p) => p.id);
  initial.storm = 18;
  initial.deck = baseDeck();
  initial.discard = [];
  initial.players.forEach((p) => {
    p.spice = 10;
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
  });
  initial.players[0].ally = ally.playerId;
  initial.players[1].ally = owner.playerId;
  initial.players[0].noField = createRicheseNoField([
    'concealed-zero',
    'concealed-three',
    'concealed-five',
  ]);
  initial.players[0].noFieldEvent = 'token-generation';
  initial.players[0].noField = deployRicheseNoField(
    initial.players[0].noField,
    {
      tokenId: 'concealed-three',
      controller: owner.playerId,
      location: { territory: 'imperial_basin', sector: 10 },
    },
  );
  const k = initial.deck.findIndex((c) => c.effect === 'karama');
  initial.players[2].hand.push(...initial.deck.splice(k, 1));
  function save(g: engine.Game) {
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  }
  save(initial);
  store.writes.length = 0;
  async function action(
    auth: Rooms.SeatAuth,
    value: engine.Action,
    rooms = store.rooms,
  ) {
    const state = await rooms.readRoom(code);
    return rooms.act(code, auth, state.version, value, clock);
  }
  const offer: engine.Action = {
    type: 'offerRicheseNoField',
    token: 'concealed-five',
    event: 'token-generation',
    territory: 'arrakeen',
    sector: 10,
    payer: owner.playerId,
  };
  return { ...store, owner, ally, other, code, initial, save, action, offer };
}
function barrier() {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let n = 0;
  return async () => {
    if (++n === 2) release();
    await ready;
  };
}
function oneCommit(
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
function conservation(g: engine.Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}

void test('restarted authenticated consent is private to the two allies and concurrent accept commits only one pending shipment', async () => {
  const f = await fixture();
  try {
    await f.action(f.owner, f.offer);
    const offered = await f.rooms.readRoom(f.code);
    const restarted = f.restart();
    const recipient = await restarted.readSeatView(f.code, f.ally);
    const unrelated = await restarted.readSeatView(f.code, f.other);
    assert.equal(recipient.richeseNoField!.allyOffer!.value, 5);
    assert.equal(recipient.richeseNoField!.allyOffer!.amount, 5);
    assert.equal(recipient.richeseNoField!.private, null);
    assert.equal(unrelated.richeseNoField!.allyOffer, null);
    for (const token of ['concealed-zero', 'concealed-three', 'concealed-five'])
      assert.equal(JSON.stringify(unrelated).includes(token), false);
    const choice = {
      type: 'decision',
      event: offered.richeseAllyOffer!.event,
      accept: true,
      elite: 0,
    };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      restarted.act(f.code, f.ally, offered.version, choice, clock),
      f.rooms.act(f.code, f.ally, offered.version, choice, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const pending = await restarted.readRoom(f.code);
    assert.equal(pending.version, offered.version + 1);
    assert.equal(pending.response?.kind, 'richeseNoField');
    assert.equal(
      pending.players[0].noField!.deployed!.tokenId,
      'concealed-three',
    );
    assert.equal(pending.players[0].spice, 10);
    assert.equal(pending.players[1].reserves, 20);
    await assert.rejects(
      restarted.act(f.code, f.ally, pending.version, choice, clock),
    );
    assert.deepEqual(await restarted.readRoom(f.code), pending);
    await restarted.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await restarted.readRoom(f.code), pending);
    conservation(pending);
  } finally {
    f.sqlite.close();
  }
});
void test('duplicate cancellation after restart returns allied shipment custody once and preserves ordinary shipment recovery', async () => {
  const f = await fixture();
  try {
    await f.action(f.owner, f.offer);
    let state = await f.rooms.readRoom(f.code);
    await f.action(f.ally, {
      type: 'decision',
      event: state.richeseAllyOffer!.event,
      accept: true,
      elite: 0,
    });
    state = await f.rooms.readRoom(f.code);
    const resumed = f.restart(),
      cancel = {
        type: 'card',
        mode: 'cancel',
        card: state.players[2].hand[0].id,
      };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.other, state.version, cancel, clock),
      f.rooms.act(f.code, f.other, state.version, cancel, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const stopped = await resumed.readRoom(f.code);
    assert.equal(
      stopped.players[0].noField!.deployed!.tokenId,
      'concealed-three',
    );
    assert.equal(stopped.players[0].spice, 10);
    assert.equal(stopped.players[1].shipped, false);
    assert.equal(stopped.pendingShipment, null);
    assert.equal(stopped.discard.filter((c) => c.id === cancel.card).length, 1);
    await f.action(
      f.ally,
      { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 },
      resumed,
    );
    const recovered = await resumed.readRoom(f.code);
    assert.equal(recovered.players[1].forces['arrakeen:10'], 2);
    assert.equal(recovered.players[1].spice, 8);
    assert.equal(recovered.players[0].reserves, 20);
    conservation(recovered);
  } finally {
    f.sqlite.close();
  }
});
void test('stale private consent can decline after reload and stale Guild commitment aborts under CAS without reveal or payment', async () => {
  const f = await fixture(true);
  try {
    await f.action(f.owner, f.offer);
    let offered = await f.rooms.readRoom(f.code);
    const event = offered.richeseAllyOffer!.event;
    offered.players[0].noFieldEvent = 'obsolete-consent';
    f.save(offered);
    let resumed = f.restart();
    assert.match(
      (await resumed.readSeatView(f.code, f.ally)).richeseNoField!.allyOffer!
        .blocked!,
      /stale/,
    );
    await f.action(f.ally, { type: 'decision', event, decline: true }, resumed);
    const declined = await resumed.readRoom(f.code);
    assert.equal(declined.richeseAllyOffer, null);
    assert.equal(declined.players[0].spice, 10);
    assert.equal(
      declined.players[0].noField!.deployed!.tokenId,
      'concealed-three',
    );
    await f.action(f.owner, { ...f.offer, event: 'obsolete-consent' }, resumed);
    offered = await resumed.readRoom(f.code);
    await f.action(
      f.ally,
      {
        type: 'decision',
        event: offered.richeseAllyOffer!.event,
        accept: true,
        elite: 0,
      },
      resumed,
    );
    await f.action(f.other, { type: 'passResponse' }, resumed);
    const pending = await resumed.readRoom(f.code);
    const foreign = await resumed.readSeatView(f.code, f.other);
    assert.equal(
      foreign.decision?.kind === 'guildShipment'
        ? foreign.decision.amount
        : null,
      1,
    );
    assert.equal(foreign.richeseNoField!.allyOffer, null);
    pending.players[1].reserves = 2;
    pending.players[1].tanks = 18;
    f.save(pending);
    resumed = f.restart();
    const allow = { type: 'decision', allow: true };
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier();
    const results = await Promise.allSettled([
      resumed.act(f.code, f.other, pending.version, allow, clock),
      f.rooms.act(f.code, f.other, pending.version, allow, clock),
    ]);
    f.hooks.beforeWrite = undefined;
    oneCommit(results, f.writes);
    const aborted = await resumed.readRoom(f.code);
    assert.equal(aborted.version, pending.version + 1);
    assert.equal(aborted.pendingShipment, null);
    assert.equal(aborted.players[1].shipped, false);
    assert.equal(aborted.players[0].spice, 10);
    assert.equal(
      aborted.players[0].noField!.deployed!.tokenId,
      'concealed-three',
    );
    assert.deepEqual(aborted.players[1].forces, {});
    conservation(aborted);
    await resumed.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(await resumed.readRoom(f.code), aborted);
  } finally {
    f.sqlite.close();
  }
});
