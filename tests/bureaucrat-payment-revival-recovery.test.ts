import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { newRevivalRules } from '../game/revival';
import { unitStore } from './fixture-nexus-room-store';
import { bureaucratPaymentGame, bureaucratPlayer as player, takeBureaucratCard } from './bureaucrat-payment-fixture';

const clock = { now: () => 82_000, sleep: async () => {} };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

void test('saved Tleilaxu revival payment survives restart and racing choices settle one actual recipient share', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  let game = bureaucratPaymentGame({ tleilaxu: true, phase: 4 });
  game.active = null;
  game.revivalRules = newRevivalRules();
  player(game, 'p').leaders[1].dead = true;
  takeBureaucratCard(game, 'e');
  game = applyAction(game, 'p', { type: 'requestLeaderRevival', leader: 'harkonnen-1' });
  game = applyAction(game, 't', { type: 'quoteLeaderRevival', target: 'p', amount: 7 });
  game = applyAction(game, 'p', { type: 'acceptLeaderRevival' });
  for (let step = 0; game.response && step < 30; step++) {
    const responder = game.players.find((seat) => !game.response!.passed.includes(seat.id));
    assert.ok(responder);
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(game.bureaucratPayments?.pending?.source.amount, 7);
  game.version = 41;
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
    .run(game.code, JSON.stringify(game), game.version, 80_000);
  const tokens = Object.fromEntries(game.players.map((seat) => [seat.id, hash(`revival-payment:${seat.id}`)]));
  for (const seat of game.players)
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)')
      .run(hash(tokens[seat.id]), game.code, seat.id);
  const auth = await store.rooms.authenticate(game.code, tokens.b);
  assert.deepEqual(await store.restart().readSeatView(game.code, auth), viewGame(game, 'b'));
  const outsider = await store.rooms.authenticate(game.code, tokens.g);
  assert.equal((await store.restart().readSeatView(game.code, outsider)).bureaucrat.pending, null);
  const event = game.decision.event!;
  const results = await Promise.allSettled([
    store.rooms.act(game.code, auth, 41, { type: 'decision', event, redirect: true }, clock),
    store.restart().act(game.code, auth, 41, { type: 'decision', event, redirect: false }, clock),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const after = await store.restart().readRoom(game.code);
  assert.equal(after.version, 42);
  assert.equal(player(after, 'p').spice, 23);
  assert.ok([35, 37].includes(player(after, 't').spice));
  assert.equal(after.bureaucratPayments?.used.length, player(after, 't').spice === 35 ? 1 : 0);
  assert.equal(after.bureaucratPayments?.pending, undefined);
  assert.equal(after.response, null);
  assert.equal(player(after, 'p').leaders[1].dead, false);
  assert.deepEqual(after.players.map((seat) => seat.hand), game.players.map((seat) => seat.hand));
  await assert.rejects(store.restart().act(game.code, auth, 41,
    { type: 'decision', event, redirect: true }, clock), /table changed/);
  assert.deepEqual(await store.restart().readSeatView(game.code, outsider), viewGame(after, 'g'));
});
