import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import type { PublicDeal } from '../game/public-deals';
import {
  actMentatBribe as act, createMentatBribeFixture as fixture,
  finishMentatBribe as finish, mentatBribeInventory as inventory,
  mentatBribePlayer as player,
} from './fixture-mentat-bribes';

type DeferredDeal = PublicDeal & { paymentStatus?: 'pending' | 'paid' | 'void' | 'released' };
const getDeal = (game: Game, id: string): DeferredDeal => {
  const deal = game.deals?.find(row => row.id === id); assert.ok(deal); return deal as DeferredDeal;
};
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'Rejected packets preserve the original game.');
}
function offer(game: Game, proposer: string, payer: string, recipient: string, amount: number,
  targets: string[] = [payer]) {
  const payment = { kind: 'deferredBribe', payer, recipient, amount, dueTurn: game.turn };
  const fields = targets.length === 1 ? { target: targets[0] } : { targets };
  const next = act(game, proposer, { type: 'dealOffer', ...fields, terms: 'Pay the agreed spice this turn.', payment });
  const deal = next.deals?.at(-1); assert.ok(deal);
  return { game: next, id: deal.id, payment };
}
function accept(game: Game, id: string, actors: string[]) {
  for (const actor of actors) game = act(game, actor, { type: 'dealRespond', deal: id, accept: true });
  return game;
}
function pay(game: Game, payer: string, id: string) {
  return act(game, payer, { type: 'dealPay', deal: id });
}

/** Each test reaches real Basic turn-one Mentat through original setup,
 * bidding and Collection. The source orders only unopened physical cards;
 * no dealt hand, purse, clock or agreement is installed. */
void test('unanimous deferred consent creates a pending exact payment without moving spice', () => {
  const f = fixture(), before = f.game;
  const { game: proposed, id, payment } = offer(before, f.opponent, f.target, f.asker, 3, [f.asker, f.target]);
  const first = accept(proposed, id, [f.asker]);
  assert.equal(getDeal(first, id).status, 'offered');
  assert.equal(player(first, f.target).spice, player(before, f.target).spice);
  const active = accept(first, id, [f.target]);
  assert.equal(getDeal(active, id).status, 'active');
  assert.equal(getDeal(active, id).paymentStatus, 'pending');
  assert.deepEqual(getDeal(active, id).payment, payment);
  assert.equal(player(active, f.target).spice, player(before, f.target).spice);
  assert.equal(player(active, f.asker).bribes, player(before, f.asker).bribes);
  assert.deepEqual(viewGame(active, f.opponent).deals.find(row => row.id === id), getDeal(active, id));
  rejected(active, f.opponent, { type: 'dealPay', deal: id });
  const paid = pay(active, f.target, id);
  assert.equal(getDeal(paid, id).paymentStatus, 'paid');
  assert.equal(player(paid, f.target).spice, player(before, f.target).spice - 3);
  assert.equal(player(paid, f.asker).bribes, player(before, f.asker).bribes + 3);
  assert.equal(player(paid, f.asker).spice, player(before, f.asker).spice);
  rejected(paid, f.target, { type: 'dealPay', deal: id });
  assert.deepEqual(inventory(paid), f.originalCards);
});

void test('two independently agreed debts need two exact native transfers', () => {
  const f = fixture();
  const first = offer(f.game, f.asker, f.target, f.asker, 3);
  let game = accept(first.game, first.id, [f.target]);
  const second = offer(game, f.asker, f.target, f.asker, 4);
  game = accept(second.game, second.id, [f.target]);
  assert.equal(player(game, f.target).spice, 10);
  game = pay(game, f.target, second.id);
  assert.equal(getDeal(game, first.id).paymentStatus, 'pending');
  assert.equal(getDeal(game, second.id).paymentStatus, 'paid');
  assert.equal(player(game, f.target).spice, 6);
  game = pay(game, f.target, first.id);
  assert.equal(player(game, f.target).spice, 3);
  assert.equal(player(game, f.asker).bribes, 7);
  assert.equal(getDeal(game, first.id).paymentStatus, 'paid');
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('unanimous release removes only the unpaid agreement and never refunds a paid one', () => {
  const f = fixture();
  const first = offer(f.game, f.asker, f.target, f.asker, 3);
  let game = accept(first.game, first.id, [f.target]);
  const second = offer(game, f.asker, f.target, f.asker, 4);
  game = accept(second.game, second.id, [f.target]);
  game = pay(game, f.target, first.id);
  game = act(game, f.asker, { type: 'dealRelease', deal: second.id, agree: true });
  assert.equal(getDeal(game, second.id).paymentStatus, 'pending');
  game = act(game, f.target, { type: 'dealRelease', deal: second.id, agree: true });
  assert.equal(getDeal(game, second.id).paymentStatus, 'released');
  rejected(game, f.target, { type: 'dealPay', deal: second.id });
  game = act(game, f.asker, { type: 'dealRelease', deal: first.id, agree: true });
  game = act(game, f.target, { type: 'dealRelease', deal: first.id, agree: true });
  assert.equal(getDeal(game, first.id).paymentStatus, 'paid');
  assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.asker).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('voluntary spending preserves enough cash for each accepted exact payment', () => {
  const f = fixture();
  const first = offer(f.game, f.asker, f.target, f.asker, 3);
  let game = accept(first.game, first.id, [f.target]);
  const second = offer(game, f.asker, f.target, f.asker, 4);
  game = accept(second.game, second.id, [f.target]);
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 });
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 3 });
  assert.equal(player(game, f.target).spice, 7);
  game = pay(game, f.target, first.id);
  game = pay(game, f.target, second.id);
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.opponent).bribes, 3);
  assert.equal(player(game, f.asker).bribes, 7);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a payable current-turn debt blocks its payer ending Mentat, then real turn advance retains the receipt', () => {
  const f = fixture();
  const offerResult = offer(f.game, f.asker, f.target, f.asker, 3);
  let game = accept(offerResult.game, offerResult.id, [f.target]);
  rejected(game, f.target, { type: 'ready' });
  game = pay(game, f.target, offerResult.id);
  game = act(game, f.target, { type: 'ready' });
  const next = finish(game);
  assert.equal(next.turn, f.game.turn + 1); assert.equal(next.phase, 0);
  assert.equal(getDeal(next, offerResult.id).paymentStatus, 'paid');
  assert.equal(player(next, f.asker).bribes, 3, 'Late Mentat transfers wait for the next Mentat opening.');
  assert.deepEqual(inventory(next), f.originalCards);
});

void test('a staged externally lost purse is voided on another player’s actual next action', () => {
  const f = fixture();
  const offered = offer(f.game, f.asker, f.target, f.asker, 3);
  let game = accept(offered.game, offered.id, [f.target]);
  // Controlled external loss: move existing spice, never create/destroy it.
  const staged = structuredClone(game), target = player(staged, f.target), other = player(staged, f.opponent);
  target.spice -= 8; other.spice += 8;
  game = act(staged, f.opponent, { type: 'ready' });
  assert.equal(getDeal(game, offered.id).paymentStatus, 'void');
  rejected(game, f.target, { type: 'dealPay', deal: offered.id });
  assert.equal(player(game, f.target).spice, 2);
  assert.equal(player(game, f.asker).bribes, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});
