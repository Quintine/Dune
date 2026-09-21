import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { applyAction } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import { nexusOfferGame } from './fixture-nexus-offer';

void test('saved offer withdrawal races acceptance without silently breaking a newly formed alliance', async () => {
  for (const withdrawFirst of [true, false]) {
    const store = unitStore();
    assert.ok(store.sqlite instanceof DatabaseSync);
    try {
      const host = await store.rooms.createRoom('Atreides offerer', 'atreides', false, []);
      const code = host.view.code;
      const peer = await store.rooms.joinRoom(code, 'Emperor recipient', 'emperor');
      const observer = await store.rooms.joinRoom(code, 'Harkonnen observer', 'harkonnen');
      const ids: [string, string, string] = [host.view.me, peer.view.me, observer.view.me];
      let game = nexusOfferGame(ids, code);
      game = applyAction(game, ids[0], { type: 'alliance', target: ids[1] });
      game.ready = [ids[2]]; game.version = 41;
      store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(game), 41, code);
      const seats = store.sqlite.prepare('SELECT * FROM seats').all();
      const hostAuth = await store.rooms.authenticate(code, host.token);
      const peerAuth = await store.rooms.authenticate(code, peer.token!);
      const offered = await store.restart().readSeatView(code, hostAuth);
      assert.deepEqual(offered.allianceOffers, { [ids[0]]: ids[1] });
      const actions = [
        { auth: hostAuth, action: { type: 'alliance' } },
        { auth: peerAuth, action: { type: 'alliance', target: ids[0] } },
      ];
      if (!withdrawFirst) actions.reverse();
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let arrived = 0;
      store.hooks.beforeWrite = async () => { if (++arrived === 2) release(); await gate; };
      const results = await Promise.allSettled(actions.map(({auth, action}) => store.restart().act(code, auth, 41, action)));
      store.hooks.beforeWrite = undefined;
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const after = await store.restart().readRoom(code);
      assert.equal(after.version, 42);
      assert.deepEqual(after.allianceOffers, {});
      assert.deepEqual(after.ready, []);
      const winner = actions[results.findIndex(r => r.status === 'fulfilled')];
      const accepted = winner.auth.playerId === ids[1];
      assert.equal(after.players[0].ally, accepted ? ids[1] : null);
      assert.equal(after.players[1].ally, accepted ? ids[0] : null);
      assert.deepEqual(after.players.map(p => ({ spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,hand:p.hand,traitors:p.traitors })),
        game.players.map(p => ({ spice:p.spice,forces:p.forces,reserves:p.reserves,tanks:p.tanks,hand:p.hand,traitors:p.traitors })));
      await assert.rejects(store.restart().act(code, hostAuth, 41, { type: 'alliance' }), /table changed/);
      for (const auth of [hostAuth, peerAuth]) {
        const restored = await store.restart().readSeatView(code, auth);
        assert.deepEqual(restored.allianceOffers, {});
        for (const rival of restored.players.filter(p => p.id !== auth.playerId)) {
          assert.equal(rival.hand, undefined); assert.equal(rival.traitors, undefined); assert.equal(rival.spice, undefined);
        }
      }
      assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats').all(), seats);
    } finally { store.sqlite.close(); }
  }
});
