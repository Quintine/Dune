import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { viewGame, type Game } from '../game/engine';
import {
  actMentatBribe as act, createMentatBribeFixture as fixture,
  finishMentatBribe as finish, mentatBribeInventory as inventory, mentatBribePlayer as player,
  nextMentatBribeOpening as nextMentat,
} from './fixture-mentat-bribes';

function offer(f: ReturnType<typeof fixture>, game: Game, amount: number, dueTurn: number) {
  game = act(game, f.asker, { type: 'dealOffer', target: f.target, terms: 'Pay the agreed spice.',
    payment: { kind: 'deferredBribe', payer: f.target, recipient: f.asker, amount, dueTurn } });
  const deal = game.deals!.at(-1)!.id;
  game = act(game, f.target, { type: 'dealRespond', deal, accept: true });
  return { game, deal };
}

void test('human autopilot waits for the actual due turn before paying a future deal', () => {
  const f = fixture();
  const accepted = offer(f, f.game, 3, f.game.turn + 1);
  let game = act(accepted.game, f.target, { type: 'setAutopilot', difficulty: 'Easy' });
  assert.equal(player(game, f.target).autopilot, 'Easy');
  assert.equal(viewGame(game, f.target).deferredDealPaymentOptions[accepted.deal]?.blocked, null);
  assert.ok(!botActions(viewGame(game, f.target)).some(action => action.type === 'dealPay'));
  assert.equal(player(game, f.target).spice, 10);
  assert.equal(game.deals!.find(row => row.id === accepted.deal)!.paymentStatus, 'pending');
  assert.deepEqual(inventory(game), f.originalCards);

  game = finish(game);
  assert.equal(game.turn, f.game.turn + 1);
  assert.equal(game.phase, 0);
  assert.equal(player(game, f.target).spice, 10);
  const action = botActions(viewGame(game, f.target))[0];
  assert.deepEqual(action, { type: 'dealPay', deal: accepted.deal });
  game = act(game, f.target, action);
  assert.equal(game.deals!.find(row => row.id === accepted.deal)!.paymentStatus, 'paid');
  assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.asker).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('an insolvent Mentat payer cannot sacrifice an individually payable current deal for a future one', () => {
  const f = fixture();
  const first = offer(f, f.game, 6, f.game.turn + 1);
  const second = offer(f, first.game, 6, f.game.turn + 1);
  const future = offer(f, second.game, 2, f.game.turn + 2);
  const smallerFuture = offer(f, future.game, 1, f.game.turn + 2);
  let game = act(smallerFuture.game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  game = nextMentat(finish(game));
  assert.equal(game.turn, f.game.turn + 1);
  assert.equal(game.phase, 8);
  assert.equal(player(game, f.target).spice, 7);
  for (const deal of [first.deal, second.deal])
    assert.equal(game.deals!.find(row => row.id === deal)!.paymentStatus, 'pending');
  const before = structuredClone(game);
  assert.ok(viewGame(game, f.target).deferredDealPaymentOptions[future.deal]?.blocked);
  assert.throws(() => act(game, f.target, { type: 'dealPay', deal: future.deal }));
  assert.deepEqual(game, before);
  assert.equal(viewGame(game, f.target).deferredDealPaymentOptions[smallerFuture.deal]?.blocked, null);
  const sparePaid = act(game, f.target, { type: 'dealPay', deal: smallerFuture.deal });
  assert.equal(player(sparePaid, f.target).spice, 6);
  assert.equal(sparePaid.deals!.find(row => row.id === smallerFuture.deal)!.paymentStatus, 'paid');
  for (const deal of [first.deal, second.deal])
    assert.equal(sparePaid.deals!.find(row => row.id === deal)!.paymentStatus, 'pending');
  const paid = act(game, f.target, { type: 'dealPay', deal: first.deal });
  assert.equal(player(paid, f.target).spice, 1);
  assert.equal(paid.deals!.find(row => row.id === first.deal)!.paymentStatus, 'paid');
  assert.equal(paid.deals!.find(row => row.id === second.deal)!.paymentStatus, 'void');
  assert.equal(paid.deals!.find(row => row.id === future.deal)!.paymentStatus, 'pending');
  assert.deepEqual(inventory(paid), f.originalCards);
});

void test('early future payment cannot spend the funds needed for a currently due deal', () => {
  const f = fixture();
  const due = offer(f, f.game, 8, f.game.turn);
  const future = offer(f, due.game, 3, f.game.turn + 1);
  const before = structuredClone(future.game);
  assert.ok(viewGame(before, f.target).deferredDealPaymentOptions[future.deal]?.blocked);
  assert.throws(() => act(future.game, f.target, { type: 'dealPay', deal: future.deal }));
  assert.deepEqual(future.game, before);
  assert.equal(player(future.game, f.target).spice, 10);
  assert.equal(future.game.deals!.find(row => row.id === due.deal)!.paymentStatus, 'pending');
  assert.equal(future.game.deals!.find(row => row.id === future.deal)!.paymentStatus, 'pending');

  const paid = act(future.game, f.target, { type: 'dealPay', deal: due.deal });
  assert.equal(player(paid, f.target).spice, 2);
  assert.equal(player(paid, f.asker).bribes, 8);
  assert.equal(paid.deals!.find(row => row.id === due.deal)!.paymentStatus, 'paid');
  assert.equal(paid.deals!.find(row => row.id === future.deal)!.paymentStatus, 'pending');
  assert.deepEqual(inventory(paid), f.originalCards);
});
