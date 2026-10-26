import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as engine from '../game/engine';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { loadRoomContinuation } from './fixture-room-continuation';
import {
  actTruthBid, bindTruthBid, createTruthBidFixture, declareTruthBid, truthBidInventory,
} from './fixture-truth-bid';

function fakeClock(start = 10000) {
  let time = start;
  const sleeps: number[] = [];
  return { now: () => time, advance: (ms: number) => { time += ms; }, sleeps,
    sleep: async (ms: number) => { sleeps.push(ms); time += ms; } } satisfies Rooms.RoomsClock & {
      advance(ms: number): void; sleeps: number[];
    };
}
function fixture(options: { required?: 'scalar' | 'aggregate'; legacy?: boolean } = {}) {
  const native = createTruthBidFixture({ window: options.required ? 'active' : 'waiting' });
  let game = structuredClone(native.game);
  if (options.required === 'scalar') game = bindTruthBid(native, 'yes', 4).game;
  if (options.required === 'aggregate') {
    game = declareTruthBid(native).game;
    game = actTruthBid(game, native.asker, { type: 'truthAsk', question: { kind: 'turnActions',
      target: native.target, turn: game.turn, mixed: { kind: 'and', terms: [
        { kind: 'action', action: { kind: 'bid', lot: game.auction!.index + 1, minimum: 4 } },
        { kind: 'action', action: { kind: 'payment', recipient: native.asker, minimum: 2 } },
      ] } } });
    game = actTruthBid(game, native.target, { type: 'truthAnswer', answer: 'yes' });
  }
  assert.equal(game.auction?.clockVersion, 1, 'The genuine new ordinary lot opts into trusted timing');
  // This one controlled metadata omission represents a current saved lot
  // predating the clock marker; no card, wallet, force or played action changes.
  if (options.legacy) delete game.auction!.clockVersion;
  const store = unitStore(), clock = fakeClock(), code = game.code;
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,0,?)').run(code, JSON.stringify(game), clock.now());
  const auth = Object.fromEntries(game.players.map(player => {
    const tokenHash = createHash('sha256').update(`auction-clock-test:${player.id}`).digest('hex');
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)').run(tokenHash, code, player.id);
    return [player.id, { playerId: player.id, tokenHash }];
  })) as Record<string, Rooms.SeatAuth>;
  return { ...store, clock, code, native, auth, actor: game.auction!.active };
}

void test('trusted private read arms a genuine ordinary lot and projects remaining time without per-poll writes', async () => {
  const f = fixture();
  try {
    const view = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
    assert.equal(view.version, 1); assert.equal(view.auctionClock?.player, f.actor);
    assert.equal(view.auctionClock?.remainingMs, 10000); assert.equal(view.auctionClock?.running, true);
    assert.equal(typeof view.auctionClock?.event, 'string');
    const stored = await f.rooms.readRoom(f.code); assert.equal(stored.auctionClock?.controlEpoch, '0:0');
    assert.equal(stored.auctionClock?.startedAt, f.clock.now());
    assert.equal(f.rooms.needsAutomaticRoomRecovery(stored), true);
    assert.equal(f.rooms.needsAutomaticRoomRecovery(view), true);
    f.clock.advance(4321);
    const later = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
    assert.equal(later.version, view.version); assert.equal(later.auctionClock?.remainingMs, 5679);
    assert.equal(later.auctionClock?.event, view.auctionClock?.event);
    assert.deepEqual(await f.rooms.readRoom(f.code), stored);
  } finally { f.sqlite.close(); }
});

void test('trusted deadline acts exactly at ten seconds and a waiting worker sleeps once before one native pass', async () => {
  const f = fixture();
  try {
    await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    f.clock.advance(9999); assert.equal(await f.rooms.continueRoomAuctionClock(f.code, f.clock), false);
    let game = await f.rooms.readRoom(f.code); assert.equal(game.auction?.active, f.actor);
    await f.rooms.continueRoomAuctionClock(f.code, f.clock, true);
    assert.deepEqual(f.clock.sleeps, [1]); game = await f.rooms.readRoom(f.code);
    assert.ok(game.auction?.passed.includes(f.actor)); assert.notEqual(game.auction?.active, f.actor);
    assert.equal(game.version, 2); assert.equal(game.auctionClock?.remainingMs, 10000);
    assert.equal(game.auctionClock?.startedAt, f.clock.now());
    assert.deepEqual(truthBidInventory(game), f.native.originalCards);
  } finally { f.sqlite.close(); }
});

void test('timely authenticated bid starts its successor clock while a missed deadline rejects a late bid before submission', async () => {
  for (const timely of [true, false]) {
    const f = fixture();
    try {
      const view = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
      f.clock.advance(timely ? 9999 : 10000);
      const action: engine.Action = { type: 'bid', amount: 1, allyPayment: 0 };
      if (timely) {
        const done = await f.rooms.act(f.code, f.auth[f.actor], view.version, action, f.clock);
        assert.equal(done.auction?.bid, 1); assert.equal(done.auction?.bidder, f.actor);
        assert.notEqual(done.auctionClock?.event, view.auctionClock?.event);
        assert.equal(done.auctionClock?.remainingMs, 10000);
      } else {
        await assert.rejects(f.rooms.act(f.code, f.auth[f.actor], view.version, action, f.clock), /table changed/i);
        const game = await f.rooms.readRoom(f.code);
        assert.equal(game.auction?.bid, 0); assert.ok(game.auction?.passed.includes(f.actor));
        assert.notEqual(game.auction?.active, f.actor);
      }
    } finally { f.sqlite.close(); }
  }
});

void test('a fresh room-module instance resumes the persisted missed deadline on an authenticated read', async () => {
  const f = fixture();
  try {
    const before = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
    f.clock.advance(10000);
    const restarted = f.restart();
    const view = await restarted.readSeatView(f.code, f.auth[f.actor], f.clock);
    assert.equal(view.version, before.version + 1); assert.notEqual(view.auctionClock?.player, f.actor);
    const game = await restarted.readRoom(f.code); assert.ok(game.auction?.passed.includes(f.actor));
    assert.deepEqual(f.clock.sleeps, []);
  } finally { f.sqlite.close(); }
});

void test('actual Truthtrance interrupts suspend the retained budget and actual completion resumes it without charging blocked time', async () => {
  const f = fixture();
  try {
    let view = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
    f.clock.advance(4000);
    view = await f.rooms.act(f.code, f.auth[f.native.asker], view.version,
      { type: 'card', card: f.native.truth }, f.clock);
    let game = await f.rooms.readRoom(f.code); assert.ok(game.truthtrance);
    assert.equal(game.auctionClock?.remainingMs, 6000); assert.equal(game.auctionClock?.startedAt, null);
    f.clock.advance(60000); const before = structuredClone(game);
    await f.rooms.continueRoomAuctionClock(f.code, f.clock, true);
    assert.deepEqual(f.clock.sleeps, []); assert.deepEqual(await f.rooms.readRoom(f.code), before);
    while (game.truthtrance?.stage === 'priority') {
      const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
      await f.rooms.act(f.code, f.auth[actor.id], game.version, { type: 'truthPass' }, f.clock);
      game = await f.rooms.readRoom(f.code);
    }
    await f.rooms.act(f.code, f.auth[f.native.asker], game.version, { type: 'truthAsk', question: {
      kind: 'fact', target: f.native.target, fact: { kind: 'spice', compare: 'gte', value: 0 },
    } }, f.clock);
    game = await f.rooms.readRoom(f.code);
    await f.rooms.act(f.code, f.auth[f.native.target], game.version, { type: 'truthAnswer', answer: 'yes' }, f.clock);
    game = await f.rooms.readRoom(f.code);
    assert.equal(game.truthtrance, null); assert.equal(game.auctionClock?.remainingMs, 6000);
    assert.equal(game.auctionClock?.startedAt, f.clock.now());
    f.clock.advance(5999); await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    assert.equal((await f.rooms.readRoom(f.code)).auction?.active, f.actor);
    f.clock.advance(1); await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    assert.ok((await f.rooms.readRoom(f.code)).auction?.passed.includes(f.actor));
  } finally { f.sqlite.close(); }
});

for (const boundary of ['pause', 'closure'] as const)
  void test(`trusted ${boundary} revisions prevent clock writes while blocked and rearm a full budget on reopening`, async () => {
    const f = fixture();
    try {
      await f.rooms.continueRoomAuctionClock(f.code, f.clock); f.clock.advance(4000);
      if (boundary === 'pause') f.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES(?,1,0,1,?)')
        .run(f.code, f.clock.now());
      else f.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES(?,1,1,?,?)')
        .run(f.code, f.clock.now(), f.clock.now());
      const before = await f.rooms.readRoom(f.code); f.clock.advance(60000);
      await f.rooms.continueRoomAuctionClock(f.code, f.clock, true);
      const blocked = await f.rooms.readSeatView(f.code, f.auth[f.actor], f.clock);
      assert.equal(blocked.auctionClock?.running, false); assert.equal(blocked.auctionClock?.remainingMs, 10000);
      assert.deepEqual(await f.rooms.readRoom(f.code), before); assert.deepEqual(f.clock.sleeps, []);
      if (boundary === 'pause') f.sqlite.prepare('UPDATE room_controls SET paused=0,revision=2,updated_at=? WHERE room_code=?')
        .run(f.clock.now(), f.code);
      else f.sqlite.prepare('UPDATE room_closures SET closed=0,closed_at=NULL,revision=2,updated_at=? WHERE room_code=?')
        .run(f.clock.now(), f.code);
      await f.rooms.continueRoomAuctionClock(f.code, f.clock);
      let game = await f.rooms.readRoom(f.code);
      assert.equal(game.auctionClock?.controlEpoch, boundary === 'pause' ? '2:0' : '0:2');
      assert.equal(game.auctionClock?.remainingMs, 10000); assert.equal(game.auctionClock?.startedAt, f.clock.now());
      f.clock.advance(9999); await f.rooms.continueRoomAuctionClock(f.code, f.clock);
      assert.equal((await f.rooms.readRoom(f.code)).auction?.active, f.actor);
      f.clock.advance(1); await f.rooms.continueRoomAuctionClock(f.code, f.clock);
      game = await f.rooms.readRoom(f.code); assert.ok(game.auction?.passed.includes(f.actor));
    } finally { f.sqlite.close(); }
  });

void test('trusted clock CAS fences both administrative revisions even if a new revision is currently unpaused and open', async () => {
  for (const boundary of ['control', 'closure'] as const) {
    const f = fixture();
    try {
      await f.rooms.continueRoomAuctionClock(f.code, f.clock); f.clock.advance(10000);
      f.hooks.beforeWrite = async () => {
        delete f.hooks.beforeWrite;
        if (boundary === 'control') f.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES(?,0,0,1,?)')
          .run(f.code, f.clock.now());
        else f.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES(?,0,1,NULL,?)')
          .run(f.code, f.clock.now());
      };
      await f.rooms.continueRoomAuctionClock(f.code, f.clock);
      const game = await f.rooms.readRoom(f.code);
      assert.equal(game.auction?.active, f.actor); assert.equal(game.auction?.bid, 0);
      assert.equal(game.auctionClock?.controlEpoch, boundary === 'control' ? '1:0' : '0:1');
      assert.equal(game.auctionClock?.startedAt, f.clock.now()); assert.equal(game.auctionClock?.remainingMs, 10000);
      assert.ok(f.writes.some(write => write.changes === 0));
    } finally { f.sqlite.close(); }
  }
});

void test('a competing timely native bid wins the version CAS without a duplicate expired pass', async () => {
  const f = fixture();
  try {
    await f.rooms.continueRoomAuctionClock(f.code, f.clock); f.clock.advance(10000);
    f.hooks.beforeWrite = async () => {
      delete f.hooks.beforeWrite;
      const current = await f.rooms.readRoom(f.code);
      // Another request passed trusted preflight one millisecond before the
      // deadline and commits its legal native bid before this timer's CAS.
      const next = engine.synchronizeAuctionClock(engine.applyAction(current, f.actor,
        { type: 'bid', amount: 1, allyPayment: 0 }), f.clock.now() - 1, '0:0');
      next.version = current.version + 1;
      f.sqlite.prepare('UPDATE rooms SET state=?,version=version+1 WHERE code=? AND version=?')
        .run(JSON.stringify(next), f.code, current.version);
    };
    await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    const game = await f.rooms.readRoom(f.code);
    assert.equal(game.auction?.bid, 1); assert.equal(game.auction?.bidder, f.actor);
    assert.ok(!game.auction?.passed.includes(f.actor)); assert.notEqual(game.auction?.active, f.actor);
    assert.equal(game.version, 2); assert.ok(f.writes.some(write => write.changes === 0));
  } finally { f.sqlite.close(); }
});

void test('recoverable room removal fences a due timer write without advancing the saved native lot', async () => {
  const f = fixture();
  try {
    await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    const before = await f.rooms.readRoom(f.code); f.clock.advance(10000);
    f.hooks.beforeWrite = async () => {
      delete f.hooks.beforeWrite;
      f.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES(?,1,1,?,?)')
        .run(f.code, f.clock.now(), f.clock.now());
    };
    await f.rooms.continueRoomAuctionClock(f.code, f.clock);
    const stored = f.sqlite.prepare('SELECT state,version FROM rooms WHERE code=?').get(f.code)!;
    assert.equal(stored.version, before.version); assert.deepEqual(JSON.parse(stored.state as string), before);
    assert.ok(f.writes.some(write => write.changes === 0));
  } finally { f.sqlite.close(); }
});

for (const required of ['scalar', 'aggregate'] as const)
  void test(`trusted expired ${required} Truth bid submits only its required legal native bid instead of evading by pass`, async () => {
    const f = fixture({ required });
    try {
      await f.rooms.continueRoomAuctionClock(f.code, f.clock); f.clock.advance(10000);
      await f.rooms.continueRoomAuctionClock(f.code, f.clock);
      const game = await f.rooms.readRoom(f.code);
      assert.equal(game.auction?.bidder, f.native.target); assert.equal(game.auction?.bid, 4);
      assert.equal(game.players.find(player => player.id === f.native.target)!.spice, 10);
      if (required === 'scalar') assert.equal(game.bidPromises?.[0].fulfilled, true);
      else {
        assert.equal(game.turnActionPromises?.[0].preparation?.bid?.maximum, 4);
        assert.deepEqual(game.turnActionPromises?.[0].payments, []);
        assert.equal(game.turnActionPromises?.[0].fulfilled, false);
      }
      assert.equal(game.discard.filter(card => card.id === f.native.truth).length, 1);
      assert.deepEqual(truthBidInventory(game), f.native.originalCards);
    } finally { f.sqlite.close(); }
  });

void test('legacy unstamped current lots stay untimed and invalid credentials cannot arm or expire another room', async () => {
  const legacy = fixture({ legacy: true }), f = fixture();
  try {
    const view = await legacy.rooms.readSeatView(legacy.code, legacy.auth[legacy.actor], legacy.clock);
    assert.equal(view.auctionClock, null); assert.equal(view.version, 0);
    legacy.clock.advance(60000); await legacy.rooms.continueRoomAuctionClock(legacy.code, legacy.clock, true);
    assert.equal((await legacy.rooms.readRoom(legacy.code)).version, 0); assert.deepEqual(legacy.clock.sleeps, []);
    const forged = { playerId: f.actor, tokenHash: 'not-the-seat-hash' };
    await assert.rejects(f.rooms.readSeatView(f.code, forged, f.clock), /verified/);
    await assert.rejects(f.rooms.act(f.code, forged, 0, { type: 'passBid' }, f.clock), /verified/);
    const unchanged = await f.rooms.readRoom(f.code); assert.equal(unchanged.version, 0);
    assert.equal(unchanged.auctionClock, undefined);
  } finally { legacy.sqlite.close(); f.sqlite.close(); }
});

void test('resume runs native automatic then bots alongside a sleeping auction clock without delaying the bot lane', async () => {
  const calls: string[] = []; let release!: () => void;
  const sleeping = new Promise<void>(resolve => { release = resolve; });
  const continuation = loadRoomContinuation({
    continueRoomAutomatic: async () => { calls.push('automatic'); },
    continueRoomBots: async () => { calls.push('bots'); },
    continueRoomAuctionClock: async (_code, _clock, wait) => {
      assert.equal(wait, true); calls.push('clock'); await sleeping; return false;
    },
  });
  const first = continuation.resumeRoom('CLOCK'); const coalesced = continuation.resumeRoom('CLOCK');
  assert.equal(first, coalesced);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.ok(calls.includes('automatic') && calls.includes('clock') && calls.includes('bots'));
  assert.ok(calls.indexOf('automatic') < calls.indexOf('bots'));
  release(); await first;
});
