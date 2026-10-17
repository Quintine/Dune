import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
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
