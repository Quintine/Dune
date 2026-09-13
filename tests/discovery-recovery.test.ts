import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import {
  discoveryFixture,
  enterDiscoveryCollection,
} from './fixture-discovery';
import { applyAction, viewGame, type Game } from '../game/engine';
import { discoveryStashSignature } from '../game/discovery-actions';
import { startPrototypeRoom } from '../tools/prototype-room';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('SQLite Discovery prototype preserves seats and competing stash reveals pay once; saved overflow discard resumes exactly once', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom(
        'Discovery SQL',
        'atreides',
        false,
        [],
      ),
      code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(
      tokens.map((token) => store.rooms.authenticate(code, token)),
    );
    const ids = auths.map((auth) => auth.playerId) as [string, string, string];
    let lobby = await store.rooms.readRoom(code);
    for (const p of lobby.players)
      lobby = applyAction(lobby, p.id, { type: 'ready' });
    store.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(lobby), code);
    const seats = store.sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();
    const begun = startPrototypeRoom(
      store.sqlite,
      code,
      lobby.version,
      'discovery',
    );
    assert.equal(begun.status, 'setup');
    assert.equal(begun.version, lobby.version + 1);
    assert.throws(() =>
      startPrototypeRoom(store.sqlite, code, begun.version, 'discovery'),
    );
    assert.deepEqual(
      store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
    let g = discoveryFixture(false, ids);
    g.code = code;
    g.version = begun.version;
    const stash = enterDiscoveryCollection(g, 'spice-stash');
    g = applyAction(g, ids[0], {
      type: 'discovery',
      token: stash.id,
      reveal: false,
    });
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
    let arrivals = 0,
      release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    const timer = setTimeout(release, 2000);
    const action = { type: 'discovery', token: stash.id, reveal: true };
    try {
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          store.restart().act(code, auths[0], g.version, action, clock),
        ),
      );
      assert.equal(arrivals, 2);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    } finally {
      clearTimeout(timer);
      delete store.hooks.beforeWrite;
    }
    const done = await store.restart().readRoom(code);
    assert.equal(done.players[0].spice, g.players[0].spice + 7);
    assert.equal(done.version, g.version + 1);
    await assert.rejects(
      store.restart().act(code, auths[0], done.version, action, clock),
    );
    for (const [i, token] of tokens.entries()) {
      const rooms = store.restart(),
        auth = await rooms.authenticate(code, token);
      assert.deepEqual(
        await rooms.readSeatView(code, auth),
        viewGame(done, ids[i]),
      );
    }
    g = done;
    const cardToken = enterDiscoveryCollection(g, 'treachery-card-stash');
    while (g.players[0].hand.length < 4)
      g.players[0].hand.push(g.deck.shift()!);
    g = applyAction(g, ids[0], {
      type: 'discovery',
      token: cardToken.id,
      reveal: false,
    });
    g = applyAction(g, ids[0], {
      type: 'discovery',
      token: cardToken.id,
      reveal: true,
    });
    store.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(g), code);
    const restored = await store.restart().readRoom(code);
    assert.equal(restored.players[0].hand.length, 5);
    assert.equal(restored.decision?.kind, 'discoveryDiscard');
    const discard = restored.players[0].hand.at(-1)!;
    await store
      .restart()
      .act(
        code,
        auths[0],
        restored.version,
        {
          type: 'decision',
          event: restored.discoveryStash!.event,
          card: discard.id,
        },
        clock,
      );
    const finished = await store.restart().readRoom(code);
    assert.equal(finished.discoveryStash!.stage, 'complete');
    assert.equal(finished.players[0].hand.length, 4);
    const paused = JSON.parse(JSON.stringify(finished)) as Game,
      record = paused.discoveryStash!;
    record.stage = 'discard';
    record.signature = discoveryStashSignature(record);
    const sequence = paused.treacheryDiscardSequence!;
    paused.resolvedTreacheryDiscardSequence = sequence - 1;
    paused.pendingTreacheryDiscard = {
      sequence,
      batch: {
        event: `discard:${paused.turn}:${paused.phase}:${sequence}`,
        turn: paused.turn,
        phase: paused.phase,
        cause: 'discovery:stash',
        entries: [{ card: discard, discardedBy: ids[0], publicFace: true }],
      },
      continuation: {
        kind: 'discoveryStash',
        event: record.event,
        owner: ids[0],
        card: discard.id,
      },
    };
    store.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(paused), code);
    await store.restart().continueRoomAutomatic(code, clock);
    const resumed = await store.restart().readRoom(code);
    assert.equal(resumed.discoveryStash!.stage, 'complete');
    assert.deepEqual(resumed.players, finished.players);
    assert.deepEqual(resumed.deck, finished.deck);
    assert.deepEqual(resumed.discard, finished.discard);
    const settled = JSON.stringify(resumed);
    await store.restart().continueRoomAutomatic(code, clock);
    assert.equal(JSON.stringify(await store.restart().readRoom(code)), settled);
    assert.deepEqual(
      store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
  } finally {
    store.sqlite.close();
  }
});
