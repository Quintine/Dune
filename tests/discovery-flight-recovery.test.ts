import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import { discoveryFlightFixture, flightDestination, flightOrigin } from './fixture-discovery-flight';
import { splitLocation } from '../game/board';
import { newPlayer, viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('SQLite restored Discovery flight preserves its owned declaration and competing CHOAM answers spend it once', async () => {
  const store = unitStore();
  try {
    const created = await store.rooms.createRoom('Discovery flight SQL', 'atreides', true, ['choam']);
    const code = created.view.code, sessions = [created.token];
    for (const faction of ['guild', 'fremen', 'choam'] as const)
      sessions.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(sessions.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.slice(0, 3).map(auth => auth.playerId) as [string, string, string];
    const { game, token, acquiredTurn } = discoveryFlightFixture(true, ids[2], ids);
    game.code = code;
    const destination = flightDestination(game), choam = newPlayer(auths[3].playerId, 'CHOAM', 'choam');
    game.players.push(choam); game.order.push(choam.id);
    choam.forces = { [destination]: 1 }; choam.reserves--;
    const pilot = game.players[2];
    pilot.elites!.forces[flightOrigin] = 1; pilot.elites!.reserves--;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, code);
    const seats = store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
    await store.restart().act(code, auths[2], game.version, { type: 'move',
      from: flightOrigin, amount: 2, elite: 1, ...splitLocation(destination),
      discoveryOrnithopter: token }, clock);
    const pending = await store.restart().readRoom(code);
    assert.equal(pending.decision?.kind, 'choamMovement');
    assert.equal(pending.pendingChoamMove!.discoveryFlight!.token, token);
    assert.equal(pending.discoveries!.tokens.find(t => t.id === token)!.status, 'carried');
    assert.equal(pending.players[2].moved, 0);
    for (const [index, auth] of auths.entries()) {
      const view = await store.restart().readSeatView(code, auth);
      assert.deepEqual(view, viewGame(pending, auth.playerId));
      assert.equal(view.discoveryOrnithopter !== null, index === 2);
      assert.equal(JSON.stringify(view).includes('discoveryFlight'), false);
    }
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    const answer = { type: 'decision', decline: true };
    try {
      const results = await Promise.allSettled([0, 1].map(() =>
        store.restart().act(code, auths[3], pending.version, answer, clock)));
      assert.equal(arrivals, 2);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    } finally { clearTimeout(timer); delete store.hooks.beforeWrite; }
    const done = await store.restart().readRoom(code), spent = done.discoveries!.tokens.find(t => t.id === token)!;
    assert.equal(done.version, pending.version + 1);
    assert.equal(done.players[2].forces[destination], 2);
    assert.equal(done.players[2].elites!.forces[destination], 1);
    assert.equal(done.players[2].moved, 1);
    assert.equal(done.pendingChoamMove, null);
    assert.equal(spent.status, 'removed'); assert.equal(spent.owner, null);
    assert.equal(spent.acquiredTurn, acquiredTurn);
    await assert.rejects(store.restart().act(code, auths[3], done.version, answer, clock));
    assert.deepEqual(await store.restart().readRoom(code), done);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
  } finally { store.sqlite.close(); }
});
