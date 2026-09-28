import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck } from '../game/cards';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { newRevivalRules } from '../game/revival';
import type { Action } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function room(t: test.TestContext, advanced: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Ecaz revival', 'ecaz', advanced, ['ecaz', 'ix']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['moritani', 'tleilaxu', 'emperor'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const ids = auths.map((auth) => auth.playerId);
  const game = await store.rooms.readRoom(code);
  Object.assign(game, {
    status: 'playing', phase: 4, turn: 3, order: ids,
    dukeVidal: createDukeVidal(), revivalRules: newRevivalRules(),
    deck: baseDeck(), discard: [],
  });
  game.dukeVidal!.leader.dead = true;
  game.dukeVidal!.leader.deaths = 1;
  game.players[0].spice = 10;
  return {
    ...store, code, tokens, auths, ids, game,
    save() {
      store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
        .run(JSON.stringify(game), game.version, code);
    },
    async act(index: number, action: Action) {
      const rooms = store.restart();
      const before = await rooms.readRoom(code);
      await rooms.act(code, auths[index], before.version, action, clock);
      return store.restart().readRoom(code);
    },
  };
}

void test('a discounted pending Ecaz Duke return survives SQLite restart and cancellation without double payment', async (t) => {
  const f = await room(t, true);
  const [ecaz, , tleilaxu] = f.game.players;
  ecaz.ally = tleilaxu.id;
  tleilaxu.ally = ecaz.id;
  tleilaxu.specialKaramaUsed = true;
  f.game.revivalRules!.allyDiscount = ecaz.id;
  const at = f.game.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(at >= 0);
  const card = f.game.deck.splice(at, 1)[0];
  f.game.players[3].hand.push(card);
  f.save();
  const ownerView = await f.restart().readSeatView(f.code, f.auths[0]);
  assert.equal(ownerView.revival.leaders.find((l) => l.id === DUKE_VIDAL_ID)?.cost, 3);
  assert.equal((await f.restart().readSeatView(f.code, f.auths[1])).revival.leaders.some(
    (l) => l.id === DUKE_VIDAL_ID), false);
  const pending = await f.act(0, { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.equal(pending.response?.kind, 'revivalDiscount');
  assert.equal(pending.pendingRevival?.normalCost, 5);
  assert.equal(pending.pendingRevival?.cost, 3);
  assert.equal(pending.players[0].spice, 10);
  assert.equal(pending.dukeVidal!.leader.dead, true);
  const done = await f.act(3, { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(done.dukeVidal!.leader.deaths, 1);
  assert.deepEqual([done.dukeVidal!.controller, done.dukeVidal!.source, done.dukeVidal!.acquiredTurn],
    [null, null, null]);
  assert.equal(done.players[0].spice, 5);
  assert.equal(done.players[2].spice, 5);
  assert.equal(done.players[0].leaderRevived, true);
  assert.equal(done.players[0].leaders.some((l) => l.id === DUKE_VIDAL_ID), false);
  assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
  await assert.rejects(f.restart().act(f.code, f.auths[0], pending.version,
    { type: 'reviveLeader', leader: DUKE_VIDAL_ID }, clock));
  assert.deepEqual(await f.restart().readRoom(f.code), done);
});

void test('a physical Ecaz Ghola returns the saved shared Duke once through SQLite, without a leader slot or spice', async (t) => {
  const f = await room(t, false);
  f.game.phase = 7;
  const at = f.game.deck.findIndex((card) => card.effect === 'ghola');
  assert.ok(at >= 0);
  const card = f.game.deck.splice(at, 1)[0];
  f.game.players[0].hand.push(card);
  f.game.dukeVidal!.leader.usedAt = 'arrakeen';
  f.save();
  const own = await f.restart().readSeatView(f.code, f.auths[0]);
  const rival = await f.restart().readSeatView(f.code, f.auths[1]);
  assert.equal(own.ghola.leaders.some((l) => l.id === DUKE_VIDAL_ID), true);
  assert.equal(rival.ghola.leaders.some((l) => l.id === DUKE_VIDAL_ID), false);
  const before = await f.restart().readRoom(f.code);
  await assert.rejects(f.restart().act(f.code, f.auths[1], before.version,
    { type: 'card', card: card.id, leader: DUKE_VIDAL_ID }, clock));
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  const done = await f.act(0, { type: 'card', card: card.id, leader: DUKE_VIDAL_ID });
  assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(done.dukeVidal!.leader.deaths, 1);
  assert.equal(done.dukeVidal!.leader.usedAt, undefined);
  assert.deepEqual([done.dukeVidal!.controller, done.dukeVidal!.source, done.dukeVidal!.acquiredTurn],
    [null, null, null]);
  assert.equal(done.players[0].spice, 10);
  assert.equal(done.players[0].leaderRevived, false);
  assert.equal(done.players[0].leaders.some((l) => l.id === DUKE_VIDAL_ID), false);
  assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
  await assert.rejects(f.restart().act(f.code, f.auths[0], before.version,
    { type: 'card', card: card.id, leader: DUKE_VIDAL_ID }, clock));
  assert.deepEqual(await f.restart().readRoom(f.code), done);
});
