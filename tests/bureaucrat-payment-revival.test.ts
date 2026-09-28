import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  bureaucratPaymentGame,
  bureaucratPlayer as player,
  bureaucratReload as reload,
  takeBureaucratCard,
} from './bureaucrat-payment-fixture';

function paidRevival(kind: 'leader' | 'forces', cancelIncome = false): Game {
  let game = bureaucratPaymentGame({ tleilaxu: true, phase: 4 });
  game.active = null;
  player(game, 'p').leaders[1].dead = true;
  player(game, 'p').leaderRevived = false;
  player(game, 'p').tanks = 3;
  player(game, 'p').reserves = 17;
  const karama = takeBureaucratCard(game, 'e');
  if (kind === 'leader') {
    game = applyAction(game, 'p', { type: 'requestLeaderRevival', leader: 'harkonnen-1' });
    game = applyAction(game, 't', { type: 'quoteLeaderRevival', target: 'p', amount: 7 });
    game = applyAction(game, 'p', { type: 'acceptLeaderRevival' });
  } else game = applyAction(game, 'p', { type: 'revive', amount: 3 });
  for (let step = 0; game.response && step < 30; step++) {
    if (cancelIncome && game.response.kind === 'revivalIncome') {
      game = applyAction(game, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
      continue;
    }
    const responder = game.players.find((seat) => !game.response!.passed.includes(seat.id));
    assert.ok(responder);
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

void test('negotiated paid leader revival opens Bureaucrat after Tleilaxu income response, then redirects exactly two', () => {
  const before = paidRevival('leader');
  assert.equal(before.decision?.kind, 'bureaucratPayment');
  assert.equal(before.bureaucratPayments?.pending?.source.kind, 'revival');
  assert.equal(before.bureaucratPayments?.pending?.source.amount, 7);
  assert.equal(player(before, 'p').spice, 23);
  assert.equal(player(before, 't').spice, 30);
  assert.equal(player(before, 'p').leaders[1].dead, false);
  const event = before.decision!.event!;
  assert.throws(() => applyAction(reload(before), 'p', { type: 'decision', event, redirect: true }));
  const after = applyAction(reload(before), 'b', { type: 'decision', event, redirect: true });
  assert.equal(player(after, 'p').spice, 23);
  assert.equal(player(after, 't').spice, 35);
  assert.equal(after.bureaucratPayments?.used.length, 1);
  assert.equal(after.response, null);
  assert.equal(after.decision, null);
  const notice = after.log.findLast((entry) => entry.text.includes('used Bureaucrat'));
  assert.match(notice?.text ?? '', /qualifying revival payment/);
  assert.doesNotMatch(notice!.text, /7.spice/);
  assert.deepEqual(after.players.map((seat) => seat.hand), before.players.map((seat) => seat.hand));
  assert.throws(() => applyAction(reload(after), 'b', { type: 'decision', event, redirect: true }));
});

void test('Karama-stopped native revival income goes to the bank without a Bureaucrat offer', () => {
  const after = paidRevival('leader', true);
  assert.equal(after.decision?.kind, undefined);
  assert.equal(after.bureaucratPayments?.pending, undefined);
  assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(player(after, 'p').spice, 23);
  assert.equal(player(after, 't').spice, 30);
  assert.equal(after.discard.filter((card) => card.effect === 'karama').length, 1);
});

void test('owner alone sees negotiated revival price in pending Bureaucrat choice; decline preserves the skill', () => {
  const before = paidRevival('leader');
  assert.equal(viewGame(before, 'g').bureaucrat.pending, null);
  assert.equal(viewGame(before, 'b').bureaucrat.pending?.amount, 7);
  const decision = before.decision;
  assert.ok(decision?.kind === 'bureaucratPayment');
  const after = applyAction(reload(before), 'b', {
    type: 'decision', event: decision.event, redirect: false,
  });
  assert.equal(player(after, 't').spice, 37);
  assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(after.decision, null);
});

void test('a small force-revival payment and separate free-revival reward cannot trigger Bureaucrat', () => {
  const game = paidRevival('forces');
  assert.equal(game.decision?.kind, undefined);
  assert.equal(game.bureaucratPayments?.pending, undefined);
  assert.equal(player(game, 'p').spice, 28);
  assert.equal(player(game, 't').spice, 33);
});

for (const difficulty of DIFFICULTIES) void test(`${difficulty} resolves paid revival Bureaucrat through the projected legal choice`, () => {
  const game = paidRevival('leader');
  player(game, 'b').bot = difficulty;
  const actions = botActions(viewGame(game, 'b'));
  const decision = game.decision;
  assert.ok(decision?.kind === 'bureaucratPayment');
  assert.ok(actions.some((action) => action.type === 'decision' && action.event === decision.event));
  const after = applyAction(reload(game), 'b', actions[0]);
  assert.equal(after.bureaucratPayments?.pending, undefined);
  assert.equal(after.response, null);
});
