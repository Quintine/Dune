import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { leaderSkillBattle } from './leader-skill-battle-fixture';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('two concurrent saved Diplomat retreats commit one exact physical transfer and one battle resolution', async () => {
  const store = unitStore();
  try {
    const created = await store.rooms.createRoom('Diplomat owner', 'emperor', false, []);
    const joined = await store.rooms.joinRoom(created.view.code, 'Opponent', 'guild');
    const code = created.view.code;
    const original = await Promise.all([created.token!, joined.token!].map(token =>
      store.rooms.authenticate(code, token)));
    for (const [index, seat] of original.entries())
      store.sqlite.prepare('UPDATE seats SET player_id=? WHERE room_code=? AND player_id=?')
        .run(index ? 'd' : 'a', code, seat.playerId);
    const seats = await Promise.all([created.token!, joined.token!].map(token =>
      store.restart().authenticate(code, token)));
    let game = leaderSkillBattle({ skill: 'diplomat', unsealed: true, hide: true });
    game = applyAction(game, 'a', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
    game = applyAction(game, 'd', { type: 'battlePlan', dial: 5, leader: 'guild-1' });
    game = applyAction(game, 'a', { type: 'traitorCall', call: false });
    game = applyAction(game, 'd', { type: 'traitorCall', call: false });
    const decision = game.decision;
    assert.equal(decision?.kind, 'diplomatRetreat');
    if (decision?.kind !== 'diplomatRetreat') return;
    game.code = code;
    game.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code);
    store.writes.length = 0;
    const destination = decision.destinations[0].location;
    const action = { type: 'decision', event: decision.event, destination, normal: 5, elite: 0 };
    let arrivals = 0;
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await ready; };
    const results = await Promise.allSettled([
      store.rooms.act(code, seats[0], game.version, action, clock),
      store.restart().act(code, seats[0], game.version, action, clock),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(store.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    const restored = await store.restart().readRoom(code);
    assert.equal(restored.version, game.version + 1);
    const owner = restored.players.find(player => player.id === 'a')!;
    assert.equal(owner.forces[destination], 5);
    assert.equal(owner.forces['arrakeen:10'], undefined);
    assert.equal(owner.tanks, 0);
    assert.equal(restored.battle, null);
    assert.equal(restored.decision, null);
    assert.equal(restored.phase, 7);
  } finally {
    store.sqlite.close();
  }
});
