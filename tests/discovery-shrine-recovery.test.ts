import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { baseDeck } from '../game/cards';
import { createDiscoveryState } from '../game/discoveries';
import { createGame, newPlayer, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

function savedShrineGame(code: string, ids: [string, string, string]): Game {
  const game = createGame(code, newPlayer(ids[0], 'Atreides', 'atreides'));
  game.players.push(
    newPlayer(ids[1], 'Emperor', 'emperor'),
    newPlayer(ids[2], 'Guild', 'guild'),
  );
  Object.assign(game, {
    status: 'playing',
    phase: 4,
    turn: 2,
    active: ids[0],
    advanced: true,
    discoveryEnabled: true,
    discoveries: createDiscoveryState(() => 0),
    order: ids,
    deck: baseDeck(),
    response: {
      kind: 'emperorGift',
      owner: ids[1],
      recipient: ids[2],
      amount: 5,
      passed: [],
    },
    decision: null,
    phaseOpening: null,
  });
  for (const player of game.players) {
    player.hand = [];
    player.forces = {};
    player.spice = 10;
    player.traitorChoices = [];
  }
  game.players[1].ally = ids[2];
  game.players[2].ally = ids[1];
  const shrine = game.discoveries!.tokens.find(
    (token) => token.face === 'shrine',
  )!;
  Object.assign(shrine, {
    status: 'placed',
    territory: 'gara_kulon',
    sector: 8,
    revealedTurn: 1,
  });
  game.players[0].forces['shrine:0'] = 1;
  game.players[0].reserves--;
  const index = game.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  game.players[0].hand.push(game.deck.splice(index, 1)[0]);
  return game;
}

void test('SQLite restoration and competing Shrine declarations keep one physical Karama private and complete once', async () => {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  try {
    const created = await store.rooms.createRoom(
      'Shrine recovery',
      'atreides',
      false,
      [],
    );
    const joined = await store.rooms.joinRoom(
      created.view.code,
      'Emperor',
      'emperor',
    );
    const third = await store.rooms.joinRoom(
      created.view.code,
      'Guild',
      'guild',
    );
    const auths = await Promise.all(
      [created.token, joined.token!, third.token!].map((token) =>
        store.rooms.authenticate(created.view.code, token),
      ),
    );
    const ids = auths.map((auth) => auth.playerId) as [string, string, string];
    const stored = await store.rooms.readRoom(created.view.code);
    const game = savedShrineGame(created.view.code, ids);
    game.version = stored.version;
    const karama = game.players[0].hand[0];
    sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, game.code);
    const seats = sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();

    const action = {
      type: 'card' as const,
      card: karama.id,
      shrineTruthtrance: [karama.id],
    };
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    const timer = setTimeout(release, 2000);
    try {
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          store
            .restart()
            .act(game.code, auths[0], game.version, action, clock),
        ),
      );
      assert.equal(arrivals, 2);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
    } finally {
      clearTimeout(timer);
      delete store.hooks.beforeWrite;
    }

    let saved = await store.restart().readRoom(game.code);
    assert.equal(saved.version, game.version + 1);
    assert.deepEqual(saved.truthtrance!.queue, [
      { player: ids[0], card: karama.id, source: 'shrine' },
    ]);
    assert.equal(saved.players[0].hand[0].effect, 'karama');
    const ownerView = await store.restart().readSeatView(game.code, auths[0]);
    const otherView = await store.restart().readSeatView(game.code, auths[1]);
    assert.equal(ownerView.players[0].hand![0].effect, 'karama');
    assert.equal(otherView.players[0].hand, undefined);

    for (let i = 1; i < auths.length; i++) {
      await store
        .restart()
        .act(game.code, auths[i], saved.version, { type: 'truthPass' }, clock);
      saved = await store.restart().readRoom(game.code);
    }
    assert.equal(saved.truthtrance!.stage, 'ask');
    await store.restart().act(
      game.code,
      auths[0],
      saved.version,
      {
        type: 'truthAsk',
        question: {
          kind: 'fact',
          target: ids[1],
          fact: { kind: 'spice', compare: 'eq', value: 10 },
        },
      },
      clock,
    );
    saved = await store.restart().readRoom(game.code);
    assert.deepEqual(saved.response, game.response);
    await store.restart().act(
      game.code,
      auths[1],
      saved.version,
      { type: 'truthAnswer', answer: 'yes' },
      clock,
    );
    const done = await store.restart().readRoom(game.code);
    assert.equal(done.truthtrance, null);
    assert.equal(done.response, null);
    assert.equal(done.players[1].spice, 5);
    assert.equal(done.players[2].spice, 15);
    assert.equal(
      done.players[0].hand.some((card) => card.id === karama.id),
      false,
    );
    assert.deepEqual(
      done.discard.filter((card) => card.id === karama.id),
      [{ ...karama, effect: 'karama' }],
    );
    assert.deepEqual(
      sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
  } finally {
    sqlite.close();
  }
});
