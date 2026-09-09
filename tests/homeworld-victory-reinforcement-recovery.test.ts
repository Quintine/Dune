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
import { homeworldVictoryObligationSignature } from '../game/homeworld-victory-return';

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

import {
  caladanVictoryFixture,
  prepareVictoryBattle,
  holdVictoryCard,
  victoryInventory,
  victoryPlayer,
  victoryReload,
} from './fixture-caladan-victory';
import { caladanAmbassadorFixture } from './fixture-caladan-ambassador';

type Game = engine.Game;
const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

async function persisted(ambassador = false, native = 6) {
  const store = unitStore();
  const made = await store.rooms.createRoom('Caladan SQL QA', 'atreides', ambassador, ambassador ? ['ecaz'] : []);
  const code = made.view.code;
  const guild = await store.rooms.joinRoom(code, 'Guild', 'guild');
  const tokens = [made.token, guild.token!];
  if (ambassador) {
    for (const faction of ['ecaz', 'harkonnen', 'beneGesserit'] as const) {
      const joined = await store.rooms.joinRoom(code, faction, faction);
      tokens.push(joined.token!);
    }
  }
  const auths = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const initial = await store.rooms.readRoom(code);
  let encoded = JSON.stringify(ambassador ? caladanAmbassadorFixture() : caladanVictoryFixture());
  for (const [index, id] of (ambassador ? ['a', 'g', 'ec', 'h', 'bg'] : ['a', 'g']).entries())
    encoded = encoded.replaceAll(JSON.stringify(id), JSON.stringify(auths[index].playerId));
  let g: Game = JSON.parse(encoded);
  g.code = code;
  g.host = auths[0].playerId;
  g.version = initial.version;
  const atreides = victoryPlayer(g, auths[0].playerId);
  atreides.forces['polar_sink:0'] -= native - atreides.reserves;
  atreides.reserves = native;
  // Actual card custody and battle preparation precede the persisted real plans.
  const weapon = holdVictoryCard(g, auths[0].playerId, 'projectile');
  holdVictoryCard(g, auths[1].playerId, 'worthless');
  g = prepareVictoryBattle(g, ambassador ? 'arrakeen' : 'hagga_basin', auths[0].playerId, auths[1].playerId);
  const save = (state: Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(state), state.version, code);
  save(g);
  const other = await store.rooms.createRoom('Untouched Caladan observer room', 'fremen', false, []);
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return { ...store, ambassador, code, tokens, auths, ids: auths.map((a) => a.playerId), initial: g,
    weapon, save, otherCode: other.view.code, otherBefore };
}
type Fixture = Awaited<ReturnType<typeof persisted>>;
function snapshot(f: Fixture) {
  const row = f.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(f.code)!;
  return { version: row.version, hash: createHash('sha256').update(String(row.state)).digest('hex') };
}
async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  for (let i = 0; i < f.tokens.length; i++) {
    const auth = await rooms.authenticate(f.code, f.tokens[i]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, engine.viewGame(g, f.ids[i]));
    for (const other of view.players.filter((p) => p.id !== f.ids[i])) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  homeworldGameIntegrity(g);
  victoryInventory(g);
  assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
  return rooms;
}
function barrier(f: Fixture) {
  let count = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++count === 2) release(); await waiting; };
}
async function act(f: Fixture, g: Game, actor: string, action: engine.Action) {
  const auth = f.auths.find((a) => a.playerId === actor)!;
  await f.rooms.act(f.code, auth, g.version, action, clock);
  return f.rooms.readRoom(f.code);
}
async function opened(f: Fixture) {
  let g = f.initial;
  const winner = victoryPlayer(g, f.ids[0]);
  const loser = victoryPlayer(g, f.ids[1]);
  const winningLeader = winner.leaders.reduce((a, b) => a.strength > b.strength ? a : b);
  const losingLeader = loser.leaders.reduce((a, b) => a.strength < b.strength ? a : b);
  g = await act(f, g, winner.id, { type: 'battlePlan', leader: winningLeader.id, dial: 1, support: g.advanced ? 1 : 0, weapon: f.weapon });
  g = await act(f, g, loser.id, { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0 });
  for (let n = 0; g.battle && n < 10; n++) {
    const view = engine.viewGame(g, winner.id).battle!;
    const voter = view.traitorVoters.find((id) => g.battle!.traitorCalls[id] === undefined)!;
    assert.ok(voter);
    g = await act(f, g, voter, { type: 'traitorCall', call: false });
  }
  assert.equal(g.battle, null);
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.homeworldVictoryReinforcement?.stage, 'waiting');
  // Retain the actual winning weapon using ordinary winner cleanup.
  g = await act(f, g, winner.id, { type: 'decision', discard: [] });
  assert.equal(g.homeworldVictoryReinforcement?.stage, 'choice');
  assert.equal(g.decision?.kind, 'caladanReinforcement');
  assert.equal(g.lastBattleContext?.winner, winner.id);
  assert.equal(g.lastBattleContext?.caladanReinforcement?.completed, false);
  assert.equal(victoryPlayer(g, winner.id).spice, winner.spice + losingLeader.strength - (g.advanced ? 1 : 0));
  await restored(f, g);
  f.writes.length = 0;
  return g;
}
function choice(g: Game, decline = false): engine.Action {
  const event = g.homeworldVictoryReinforcement!.event;
  return decline ? { type: 'decision', event, decline: true }
    : { type: 'decision', event, amount: 1, destination: 'hagga_basin:12' };
}

void test('production SQL competing Caladan placement and decline commit exactly one victory choice', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const owner = victoryPlayer(g, f.ids[0]);
    const rooms = await restored(f, g);
    barrier(f);
    const results = await Promise.allSettled([
      rooms.act(f.code, f.auths[0], g.version, choice(g), clock),
      f.rooms.act(f.code, f.auths[0], g.version, choice(g, true), clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
    const done = await rooms.readRoom(f.code);
    const placed = victoryPlayer(done, f.ids[0]);
    const amount = done.homeworldVictoryReinforcement!.destination === 'decline' ? 0 : 1;
    assert.equal(done.version, g.version + 1);
    assert.equal(done.homeworldVictoryReinforcement?.stage, 'complete');
    assert.equal(done.lastBattleContext?.event, g.lastBattleContext?.event);
    assert.equal(done.lastBattleContext?.caladanReinforcement?.completed, true);
    assert.equal(placed.reserves, owner.reserves - amount);
    assert.equal(placed.forces['hagga_basin:12'], owner.forces['hagga_basin:12'] + amount);
    assert.equal(placed.spice, owner.spice);
    assert.equal(placed.tanks, owner.tanks);
    const before = snapshot(f);
    for (const decline of [false, true])
      await assert.rejects(rooms.act(f.code, f.auths[0], done.version, choice(g, decline), clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL lost Caladan response restores one native withdrawal and does not replay battle bounty', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const owner = victoryPlayer(g, f.ids[0]);
    await f.rooms.act(f.code, f.auths[0], g.version, choice(g), clock);
    const rooms = f.restart();
    const done = await rooms.readRoom(f.code);
    const placed = victoryPlayer(done, f.ids[0]);
    assert.equal(done.homeworldVictoryReinforcement?.stage, 'complete');
    assert.equal(done.homeworldVictoryReinforcement?.destination, 'hagga_basin:12');
    assert.equal(placed.reserves, 5);
    assert.equal(placed.reserves, owner.reserves - 1);
    assert.equal(placed.forces['hagga_basin:12'], owner.forces['hagga_basin:12'] + 1);
    assert.equal(placed.tanks, owner.tanks);
    assert.equal(placed.spice, owner.spice);
    assert.equal(placed.shipped, owner.shipped);
    assert.equal(placed.moved, owner.moved);
    assert.deepEqual(placed.hand, owner.hand);
    assert.deepEqual(done.lastBattleContext?.combatants, g.lastBattleContext?.combatants);
    assert.equal(done.lastBattleContext?.event, g.lastBattleContext?.event);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], g.version, choice(g), clock));
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, choice(g), clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL declined Caladan reinforcement survives reload without withdrawing or repeating a victory', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const done = await act(f, g, f.ids[0], choice(g, true));
    assert.equal(done.homeworldVictoryReinforcement?.destination, 'decline');
    assert.equal(done.lastBattleContext?.caladanReinforcement?.completed, true);
    const beforeOwner = victoryPlayer(g, f.ids[0]);
    const owner = victoryPlayer(done, f.ids[0]);
    for (const field of ['reserves', 'tanks', 'spice', 'forces', 'hand'] as const)
      assert.deepEqual(owner[field], beforeOwner[field]);
    const rooms = await restored(f, done);
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, choice(g), clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
  } finally { f.sqlite.close(); }
});

void test('production SQL damaged Caladan victory, offer and completion obligations cannot silently finish or write', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    for (const mutate of [
      (state: Game) => { delete state.homeworldVictoryReinforcement; },
      (state: Game) => { state.decision = null; },
      (state: Game) => { state.homeworldVictoryReinforcement!.signature = 'replayed'; },
      (state: Game) => { state.homeworldVictoryReinforcement!.territory = 'polar_sink'; },
      (state: Game) => { state.homeworldVictoryReinforcement!.offer!.population++; },
      (state: Game) => { state.homeworldVictoryReinforcement!.offer!.survivors++; },
      (state: Game) => { delete state.homeworldVictoryReinforcement!.offer; },
      (state: Game) => { delete state.lastBattleContext!.caladanReinforcement; },
      (state: Game) => { state.lastBattleContext!.caladanReinforcement!.completed = true; },
      (state: Game) => { state.lastBattleContext!.caladanReinforcement!.signature = 'replayed'; },
    ]) {
      const corrupt = victoryReload(g);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, choice(g), clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});

void test('production SQL completed Caladan arrival cannot be retargeted, reopened or given an invented Ambassador', async () => {
  const f = await persisted();
  try {
    const g = await opened(f);
    const done = await act(f, g, f.ids[0], choice(g));
    for (const mutate of [
      (state: Game) => { state.homeworldVictoryReinforcement!.destination = 'polar_sink:0'; },
      (state: Game) => { state.homeworldVictoryReinforcement!.arrivalSignature = 'replayed'; },
      (state: Game) => { state.homeworldVictoryReinforcement!.stage = 'choice'; },
      (state: Game) => { state.homeworldVictoryReinforcement!.ambassadors!.push({
        event: 'invented', entrant: f.ids[0], destination: 'hagga_basin:12', completed: false,
      }); },
    ]) {
      const corrupt = victoryReload(done);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, choice(g), clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});

async function openedChild(f: Fixture) {
  let g = await opened(f);
  g = await act(f, g, f.ids[0], {
    type: 'decision', event: g.homeworldVictoryReinforcement!.event, amount: 1, destination: 'arrakeen:10',
  });
  assert.equal(g.homeworldVictoryReinforcement?.stage, 'arrival');
  const parent = g.pendingAmbassador!.event;
  g = await act(f, g, f.ids[2], { type: 'decision', event: parent, trigger: true, beneficiary: f.ids[3] });
  g = await act(f, g, f.ids[3], { type: 'decision', event: parent, amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.decision?.kind, 'intrusion');
  g = await act(f, g, f.ids[4], { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'advisor');
  g = await act(f, g, f.ids[4], { type: 'decision', accept: true, accompany: true });
  assert.equal(g.response?.kind, 'advisor');
  for (let n = 0; g.response?.kind === 'advisor' && n < 40; n++)
    g = await act(f, g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.pendingAmbassador?.entrant, f.ids[4]);
  assert.equal(g.pendingAmbassador?.victoryEvent, g.homeworldVictoryReinforcement!.event);
  assert.equal(g.pendingAmbassador?.revivalEvent, undefined);
  assert.deepEqual(g.homeworldVictoryReinforcement!.ambassadors!.map((entry) => entry.completed), [true, false]);
  assert.equal(g.homeworldVictoryReinforcement!.ambassadors![1].parent, parent);
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, false);
  assert.equal(victoryPlayer(g, f.ids[0]).reserves, 5);
  await restored(f, g);
  f.writes.length = 0;
  return g;
}

void test('production SQL live Caladan Ambassador child reloads and finishes once without replaying the victorious army', async () => {
  const f = await persisted(true);
  try {
    let g = await openedChild(f);
    const original = victoryReload(g);
    const event = g.pendingAmbassador!.event;
    g = await act(f, g, f.ids[2], { type: 'decision', event, trigger: true, beneficiary: f.ids[2] });
    assert.equal(g.pendingAmbassador?.stage, 'move');
    const rooms = await restored(f, g);
    const move: engine.Action = {
      type: 'decision', event, forces: { 'red_chasm:7': 1 }, territory: 'carthag', sector: 11,
    };
    f.writes.length = 0;
    barrier(f);
    const outcomes = await Promise.allSettled([
      rooms.act(f.code, f.auths[2], g.version, move, clock),
      f.rooms.act(f.code, f.auths[2], g.version, move, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map((write) => write.changes).sort((a, b) => a - b), [0, 1]);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.homeworldVictoryReinforcement?.stage, 'complete');
    assert.equal(done.lastBattleContext?.event, original.lastBattleContext?.event);
    assert.equal(done.lastBattleContext?.caladanReinforcement?.completed, true);
    assert.deepEqual(done.homeworldVictoryReinforcement!.ambassadors!.map((entry) => entry.completed), [true, true]);
    assert.equal(done.homeworldRevivalReturn, undefined);
    assert.equal(victoryPlayer(done, f.ids[0]).reserves, 5);
    assert.equal(victoryPlayer(done, f.ids[0]).forces['arrakeen:10'], 3);
    assert.equal(victoryPlayer(done, f.ids[2]).forces['carthag:11'], 1);
    assert.equal(victoryPlayer(done, f.ids[2]).forces['red_chasm:7'] ?? 0, 0);
    assert.equal(victoryPlayer(done, f.ids[3]).forces['sietch_tabr:14'], 2);
    assert.equal(victoryPlayer(done, f.ids[4]).forces['sietch_tabr:14'], 2);
    for (const id of f.ids) {
      assert.equal(victoryPlayer(done, id).spice, victoryPlayer(original, id).spice);
      assert.deepEqual(victoryPlayer(done, id).hand, victoryPlayer(original, id).hand);
    }
    const before = snapshot(f);
    await assert.rejects(rooms.act(f.code, f.auths[2], done.version, move, clock));
    await assert.rejects(rooms.act(f.code, f.auths[0], done.version, {
      type: 'decision', event: done.homeworldVictoryReinforcement!.event, destination: 'arrakeen:10',
    }, clock));
    await rooms.continueRoomAutomatic(f.code, clock);
    assert.deepEqual(snapshot(f), before);
    await restored(f, done);
  } finally { f.sqlite.close(); }
});

void test('production SQL a missing or edited live Caladan Ambassador child cannot silently complete the battle', async () => {
  const f = await persisted(true);
  try {
    const g = await openedChild(f);
    for (const mutate of [
      (state: Game) => { state.pendingAmbassador = null; state.decision = null; },
      (state: Game) => { delete state.pendingAmbassador!.victoryEvent; },
      (state: Game) => { state.pendingAmbassador!.revivalEvent = state.pendingAmbassador!.victoryEvent; },
      (state: Game) => { state.homeworldVictoryReinforcement!.ambassadors![1].completed = true; },
      (state: Game) => { state.homeworldVictoryReinforcement!.ambassadors![1].parent = 'another-arrival'; },
      (state: Game) => { delete state.lastBattleContext!.caladanReinforcement; },
      (state: Game) => { state.homeworldVictoryReinforcement!.stage = 'complete'; },
    ]) {
      const corrupt = victoryReload(g);
      mutate(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[2], corrupt.version, {
        type: 'decision', event: g.pendingAmbassador!.event, decline: true,
      }, clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});

void test('production SQL committed Caladan arrival cannot rewind to a payable choice or downgrade its stage proof', async () => {
  const f = await persisted(true, 7);
  try {
    const choiceState = await opened(f);
    const event = choiceState.homeworldVictoryReinforcement!.event;
    const arrived = await act(f, choiceState, f.ids[0], {
      type: 'decision', event, amount: 1, destination: 'arrakeen:10',
    });
    assert.equal(arrived.homeworldVictoryReinforcement?.stage, 'arrival');
    assert.equal(arrived.lastBattleContext?.caladanReinforcement?.stage, 'arrival');
    assert.equal(arrived.lastBattleContext?.caladanReinforcement?.completed, false);
    assert.equal(arrived.pendingAmbassador?.stage, 'offer');
    // Another withdrawal remains physically affordable. Rejection must come
    // from the durable commitment, not accidentally from a low population.
    assert.equal(victoryPlayer(arrived, f.ids[0]).reserves, 6);
    assert.equal(victoryPlayer(arrived, f.ids[0]).forces['arrakeen:10'], 3);
    await restored(f, arrived);
    const rewind = (state: Game) => {
      const frame = state.homeworldVictoryReinforcement!;
      frame.stage = 'choice';
      delete frame.destination;
      delete frame.ambassadors;
      delete frame.arrivalSignature;
      state.pendingAmbassador = null;
      state.decision = { kind: 'caladanReinforcement', player: f.ids[0], event };
    };
    for (const mutate of [
      rewind,
      (state: Game) => { delete state.lastBattleContext!.caladanReinforcement!.stage; },
      (state: Game) => { state.lastBattleContext!.caladanReinforcement!.stage = 'choice'; },
      (state: Game) => {
        rewind(state);
        const context = state.lastBattleContext!;
        delete context.caladanReinforcement!.stage;
        // A live save cannot be downgraded to the older completed-save format.
        context.caladanReinforcement!.signature = homeworldVictoryObligationSignature(context, false);
      },
      (state: Game) => {
        rewind(state);
        state.lastBattleContext!.caladanReinforcement!.stage = 'choice';
      },
    ]) {
      const corrupt = victoryReload(arrived);
      mutate(corrupt);
      victoryInventory(corrupt);
      f.save(corrupt);
      f.writes.length = 0;
      const before = snapshot(f);
      const rooms = f.restart();
      for (const auth of f.auths) await assert.rejects(rooms.readSeatView(f.code, auth));
      await assert.rejects(rooms.act(f.code, f.auths[0], corrupt.version, {
        type: 'decision', event, amount: 1, destination: 'arrakeen:10',
      }, clock));
      assert.throws(() => engine.normalizeAutomaticGame(corrupt));
      assert.deepEqual(snapshot(f), before);
      assert.equal(f.writes.length, 0);
      assert.deepEqual(await rooms.readRoom(f.otherCode), f.otherBefore);
    }
  } finally { f.sqlite.close(); }
});
