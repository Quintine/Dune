import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { bureaucratPaymentGame, bureaucratPlayer } from './bureaucrat-payment-fixture';
import { knowledgeGame } from './truthtrance-knowledge-fixture';

/** Normal Basic setup; no purse or phase is fabricated. */
function playing(): Game {
  let game = createGame('PAYDEAL', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = applyAction(game, 'a', { type: 'start' });
  for (const player of game.players) if (player.traitorChoices.length)
    game = applyAction(game, player.id, { type: 'traitor', leader: player.traitorChoices[0] });
  assert.equal(game.status, 'playing');
  return game;
}

const payment = (payer = 'a', recipient = 'h', amount = 3) =>
  ({ kind: 'immediateBribe', payer, recipient, amount } as const);
const player = (game: Game, id: string) => game.players.find(seat => seat.id === id)!;
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected deal action must not change its source game.');
}
function propose(game: Game, actor: string, target: string, clause: unknown) {
  const next = applyAction(game, actor, { type: 'dealOffer', target, terms: 'Information for spice.', payment: clause });
  const deal = next.deals?.at(-1);
  assert.ok(deal);
  assert.equal(deal.status, 'offered');
  return { game: next, deal };
}

void test('two-party consent pays the pledged gross bribe exactly once into native Mentat escrow', () => {
  const initial = playing();
  const beforePayer = player(initial, 'a').spice;
  const beforeRecipient = player(initial, 'h').bribes;
  const offered = propose(initial, 'a', 'h', payment());
  assert.equal(player(offered.game, 'a').spice, beforePayer);
  assert.equal(player(offered.game, 'h').bribes, beforeRecipient);
  assert.deepEqual((offered.deal as unknown as { payment: unknown }).payment, payment());
  assert.deepEqual(viewGame(offered.game, 'e').deals.at(-1), offered.deal);

  const accepted = applyAction(offered.game, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(accepted.deals!.at(-1)!.status, 'active');
  assert.equal(player(accepted, 'a').spice, beforePayer - 3);
  assert.equal(player(accepted, 'h').bribes, beforeRecipient + 3);
  assert.equal(player(accepted, 'h').spice, player(initial, 'h').spice);
  assert.match(accepted.log.map(entry => entry.text).join('\n'), /paid a 3-spice bribe/i);
  reject(accepted, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(player(accepted, 'a').spice, beforePayer - 3);
  assert.equal(player(accepted, 'h').bribes, beforeRecipient + 3);
});

void test('a multiparty payment waits for every recipient and may have a different payer from the last voter', () => {
  const initial = playing();
  const beforePayer = player(initial, 'h').spice;
  const beforeRecipient = player(initial, 'e').bribes;
  let game = applyAction(initial, 'a', {
    type: 'dealOffer', targets: ['h', 'e'], terms: 'Pledge when everyone agrees.', payment: payment('h', 'e', 2),
  });
  const deal = game.deals!.at(-1)!;
  game = applyAction(game, 'h', { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'offered');
  assert.equal(player(game, 'h').spice, beforePayer);
  assert.equal(player(game, 'e').bribes, beforeRecipient);
  game = applyAction(game, 'e', { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'active');
  assert.equal(player(game, 'h').spice, beforePayer - 2);
  assert.equal(player(game, 'e').bribes, beforeRecipient + 2);
  reject(game, 'e', { type: 'dealRespond', deal: deal.id, accept: true });
});

void test('declining or withdrawing a payment offer does not pay', () => {
  const initial = playing();
  const baseline = initial.players.map(seat => ({ id: seat.id, spice: seat.spice, bribes: seat.bribes }));
  let offered = propose(initial, 'a', 'h', payment());
  let game = applyAction(offered.game, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: false });
  assert.equal(game.deals!.at(-1)!.status, 'declined');
  assert.deepEqual(game.players.map(seat => ({ id: seat.id, spice: seat.spice, bribes: seat.bribes })), baseline);
  offered = propose(game, 'a', 'h', payment());
  game = applyAction(offered.game, 'a', { type: 'dealWithdraw', deal: offered.deal.id });
  assert.equal(game.deals!.at(-1)!.status, 'withdrawn');
  assert.deepEqual(game.players.map(seat => ({ id: seat.id, spice: seat.spice, bribes: seat.bribes })), baseline);
  reject(game, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
});

void test('forged, invalid and nonparticipant payments are rejected without a deal or debit', () => {
  const game = playing();
  for (const clause of [
    { ...payment(), payer: 'e' }, { ...payment(), recipient: 'e' }, { ...payment(), recipient: 'a' },
    { ...payment(), payer: 'missing' }, { ...payment(), amount: 0 }, { ...payment(), amount: -1 },
    { ...payment(), amount: 1.5 }, { ...payment(), amount: '3' }, { ...payment(), amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...payment(), kind: 'spiceGift' }, { ...payment(), extra: true }, null,
  ]) reject(game, 'a', { type: 'dealOffer', target: 'h', terms: 'Terms.', payment: clause });
  reject(game, 'a', { type: 'dealOffer', targets: ['h', 'e'], terms: 'Terms.', payment: payment('h', 'h', 2) });
});

void test('a once-affordable payment that becomes unaffordable leaves the final consent and purse unchanged', () => {
  const initial = playing();
  const offered = propose(initial, 'a', 'h', payment('a', 'h', 6));
  const spent = applyAction(offered.game, 'a', { type: 'bribe', target: 'e', amount: 8 });
  assert.equal(player(spent, 'a').spice, 2);
  reject(spent, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(spent.deals!.at(-1)!.status, 'offered');
  assert.equal(player(spent, 'h').bribes, 0);
  assert.throws(() => applyAction(spent, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true }),
    /The agreed payment could not be completed/);
});

void test('an earlier consenting payer must retake control before another seat can settle the payment', () => {
  const offered = propose(playing(), 'a', 'h', payment());
  const delegated = applyAction(offered.game, 'a', { type: 'setAutopilot', difficulty: 'Easy' });
  reject(delegated, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(delegated.deals!.at(-1)!.status, 'offered');
  const resumed = applyAction(delegated, 'a', { type: 'setAutopilot', difficulty: null });
  const done = applyAction(resumed, 'h', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(done.deals!.at(-1)!.status, 'active');
  assert.equal(player(done, 'a').spice, player(resumed, 'a').spice - 3);
});

void test('a payment offered before a real Truthtrance priority cannot settle through the blocked timing window', () => {
  let game = knowledgeGame();
  const offered = propose(game, 'a', 'b', payment('a', 'b', 1));
  const card = player(offered.game, 'a').hand.find(item => item.effect === 'truthtrance');
  assert.ok(card);
  game = applyAction(offered.game, 'a', { type: 'card', card: card.id });
  assert.equal(game.truthtrance?.stage, 'priority');
  reject(game, 'b', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'offered');
  assert.equal(game.truthtrance?.stage, 'priority');
});

void test('native Bureaucrat diversion suspends the already-paid deal and settles the original bribe once', () => {
  const initial = bureaucratPaymentGame();
  const offered = propose(initial, 'p', 'e', payment('p', 'e', 5));
  let game = applyAction(offered.game, 'e', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'active');
  assert.equal(bureaucratPlayer(game, 'p').spice, 25);
  assert.equal(bureaucratPlayer(game, 'e').bribes, 0);
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  game = applyAction(game, 'b', { type: 'decision', event: game.bureaucratPaymentEvent, redirect: true });
  assert.equal(bureaucratPlayer(game, 'p').spice, 25);
  assert.equal(bureaucratPlayer(game, 'e').bribes, 3);
  assert.equal(viewGame(game, 'b').bureaucrat.usedThisPhase, true);
  reject(game, 'e', { type: 'dealRespond', deal: offered.deal.id, accept: true });
});
