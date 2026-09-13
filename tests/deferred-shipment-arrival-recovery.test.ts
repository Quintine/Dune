import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { legacyGuildArrival } from './fixture-deferred-shipment-arrival';

const clock: RoomsClock = { now: () => 49000, sleep: async () => {} };
const allow = { type: 'decision', allow: true };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const rows = (db: DatabaseSync) => ({
  rooms: db.prepare('SELECT * FROM rooms ORDER BY code').all(),
  seats: db.prepare('SELECT * FROM seats ORDER BY player_id').all(),
});
const custody = (g: Game) => ({
  players: g.players,
  deck: g.deck,
  discard: g.discard,
  richeseCache: g.richeseCache,
  spice: g.spice,
  traitorReserve: g.traitorReserve,
  ambassadors: g.ecazAmbassadors,
  terror: g.moritaniTerror,
  nexus: g.nexusCards,
});

async function fixture(t: test.TestContext) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const pending = legacyGuildArrival();
  for (const player of pending.players) delete player.bot;
  pending.version = 31;
  const code = pending.code;
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
    .run(code, JSON.stringify(pending), pending.version, 48000);
  const tokens: Record<string, string> = {};
  const auths: Record<string, SeatAuth> = {};
  for (const player of pending.players) {
    tokens[player.id] = hash('deferred-shipment:' + player.id);
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)')
      .run(hash(tokens[player.id]), code, player.id);
    auths[player.id] = await store.rooms.authenticate(code, tokens[player.id]);
  }
  const guild = pending.players.find((p) => p.faction === 'guild')!.id;
  return { ...store, pending, code, tokens, auths, guild };
}

async function restoredViews(f: Awaited<ReturnType<typeof fixture>>, game: Game) {
  const before = rows(f.sqlite);
  for (const [id, token] of Object.entries(f.tokens)) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    assert.equal(auth.playerId, id);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(game, id));
    assert.equal('pendingShipment' in view, false);
    for (const other of view.players.filter((p) => p.id !== id))
      for (const field of ['hand', 'traitors', 'spice', 'prediction'])
        assert.equal(field in other, false);
  }
  assert.deepEqual(rows(f.sqlite), before);
}

void test('authenticated legacy Guild allowance returns an unsupported arrival once and keeps the private seat and shipment available after restart', async (t) => {
  const f = await fixture(t);
  const original = rows(f.sqlite), resources = structuredClone(custody(f.pending));
  await restoredViews(f, f.pending);
  const other = f.pending.players.find((p) => p.id !== f.guild)!.id;
  await assert.rejects(f.rooms.act(f.code, f.auths[other], 31, allow, clock));
  await assert.rejects(f.rooms.act(f.code, f.auths[f.guild], 30, allow, clock));
  await assert.rejects(f.rooms.act(f.code, f.auths[f.guild], 31, { type: 'decision', allow: false }, clock));
  assert.deepEqual(rows(f.sqlite), original);
  assert.equal(f.writes.length, 0);

  await f.restart().act(f.code, f.auths[f.guild], 31, allow, clock);
  const returned = await f.restart().readRoom(f.code);
  assert.equal(returned.version, 32);
  assert.equal(returned.decision, null);
  assert.equal(returned.pendingShipment, null);
  assert.equal(returned.active, f.pending.active);
  assert.deepEqual(custody(returned), resources);
  assert.match(returned.log.at(-1)!.text, /uncommitted shipment.*returned/i);
  assert.equal(f.writes.length, 1);
  await restoredViews(f, returned);
  const saved = rows(f.sqlite);
  await assert.rejects(f.restart().act(f.code, f.auths[f.guild], 31, allow, clock));
  await assert.rejects(f.restart().act(f.code, f.auths[f.guild], 32, allow, clock));
  assert.deepEqual(rows(f.sqlite), saved);

  await f.restart().act(f.code, f.auths[f.pending.active!], 32,
    { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1 }, clock);
  const alternative = await f.restart().readRoom(f.code);
  assert.equal(alternative.decision?.kind, 'guildShipment');
  assert.equal(alternative.pendingShipment?.territory, 'polar_sink');
  await f.restart().act(f.code, f.auths[f.guild], alternative.version, allow, clock);
  const arrived = await f.restart().readRoom(f.code);
  assert.equal(arrived.pendingShipment, null);
  assert.equal(arrived.players.find((p) => p.id === f.pending.active)!.shipped, true);
  assert.equal(arrived.players.find((p) => p.id === f.pending.active)!.forces['polar_sink:0'], 1);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), original.seats);
  await restoredViews(f, arrived);
});

void test('concurrent saved Guild allowances persist exactly one unspent return', async (t) => {
  const f = await fixture(t);
  let entered = 0, release!: () => void;
  const both = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++entered === 2) release(); await both; };
  const results = await Promise.allSettled([f.rooms, f.restart()].map((rooms) =>
    rooms.act(f.code, f.auths[f.guild], 31, allow, clock)));
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
  const returned = await f.restart().readRoom(f.code);
  assert.equal(returned.version, 32);
  assert.equal(returned.decision, null);
  assert.equal(returned.pendingShipment, null);
  assert.deepEqual(custody(returned), custody(f.pending));
  assert.equal(returned.log.filter((entry) => /uncommitted shipment.*returned/i.test(entry.text)).length, 1);
  await restoredViews(f, returned);
});

void test('saved declaration corruption is rejected without returning or rewriting the pending shipment', async (t) => {
  const f = await fixture(t);
  const corrupt = structuredClone(f.pending);
  corrupt.pendingShipment!.amount++;
  f.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run(JSON.stringify(corrupt), f.code);
  const before = rows(f.sqlite);
  await assert.rejects(f.restart().act(f.code, f.auths[f.guild], 31, allow, clock), /does not match/);
  assert.deepEqual(rows(f.sqlite), before);
  assert.equal(f.writes.length, 0);
});
