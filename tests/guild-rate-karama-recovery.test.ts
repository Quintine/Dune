import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck } from '../game/cards';
import { newPlayer, type Game } from '../game/engine';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('restarted rooms expose the unpaid Guild rate choice and commit one Karama cancellation under a CAS race', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('Guild rate CAS', 'guild', false, []);
    const code = made.view.code;
    const joinedEmperor = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
    const joinedAtreides = await store.rooms.joinRoom(code, 'Atreides', 'atreides');
    const tokens = [made.token, joinedEmperor.token!, joinedAtreides.token!];
    const seats = await Promise.all(tokens.map(token => store.restart().authenticate(code, token)));
    const ids = seats.map(seat => seat.playerId);
    const initial = await store.restart().readRoom(code);
    const g: Game = {
      ...initial,
      players: [
        newPlayer(ids[0], 'Guild', 'guild'),
        newPlayer(ids[1], 'Emperor', 'emperor'),
        newPlayer(ids[2], 'Atreides', 'atreides'),
      ],
      status: 'playing', phase: 5, turn: 2, storm: 18,
      order: ids, movementRemaining: ids, active: ids[0],
      ready: [], decision: null, response: null, phaseOpening: null,
      deck: baseDeck(), discard: [],
    };
    for (const player of g.players) {
      player.spice = 20;
      player.reserves = 20;
      player.forces = {};
      player.hand = [];
    }
    const index = g.deck.findIndex(card => card.effect === 'karama');
    const karama = g.deck.splice(index, 1)[0];
    g.players[2].hand.push(karama);
    store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
    store.writes.length = 0;

    await store.restart().act(code, seats[0], g.version, {
      type: 'ship', territory: 'arrakeen', sector: 10, amount: 3, allyPayment: 0,
    }, clock);
    const offered = await store.restart().readRoom(code);
    assert.equal(offered.version, g.version + 1);
    assert.equal(offered.response?.kind, 'guildRate');
    assert.equal(offered.pendingShipment?.cost, 2);
    assert.equal(offered.players[0].spice, 20);
    assert.equal(offered.players[0].reserves, 20);
    const responderView = await store.restart().readSeatView(code, seats[2]);
    assert.equal(responderView.responseControls?.cancelCards.includes(karama.id), true);
    assert.equal(responderView.players.find(player => player.id === ids[0])?.spice, undefined);
    assert.equal((await store.restart().readSeatView(code, seats[1])).response?.kind, 'guildRate');
    const before = JSON.parse(JSON.stringify(offered));
    await assert.rejects(store.restart().act(code, seats[0], offered.version,
      { type: 'card', mode: 'cancel', card: karama.id }, clock));
    assert.deepEqual(await store.restart().readRoom(code), before);

    let arrivals = 0;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await waiting;
    };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([0, 1].map(() => store.restart().act(
        code, seats[2], offered.version,
        { type: 'card', mode: 'cancel', card: karama.id }, clock,
      )));
    } finally {
      delete store.hooks.beforeWrite;
    }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(store.writes.slice(-2).map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    const done = await store.restart().readRoom(code);
    assert.equal(done.version, offered.version + 1);
    assert.equal(done.pendingShipment, null);
    assert.equal(done.response, null);
    assert.equal(done.players[0].spice, 17);
    assert.equal(done.players[0].reserves, 17);
    assert.equal(done.players[0].forces['arrakeen:10'], 3);
    assert.equal(done.discard.filter(card => card.id === karama.id).length, 1);
    await assert.rejects(store.restart().act(code, seats[2], offered.version,
      { type: 'card', mode: 'cancel', card: karama.id }, clock));
    assert.deepEqual(await store.restart().readRoom(code), done);
  } finally {
    store.sqlite.close();
  }
});
