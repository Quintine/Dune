import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { viewGame, type Game } from '../game/engine';
import {
  actMentatBribe as act, createMentatBribeFixture as fixture,
  mentatBribeInventory as inventory, mentatBribePlayer as player,
} from './fixture-mentat-bribes';

/** Native turn-one Basic Mentat: starting hands and purses come from actual
 * setup and auctions; only unopened source ordering was selected. */
function accepted() {
  const f = fixture();
  let game = act(f.game, f.asker, { type: 'dealOffer', target: f.target, terms: 'Pay the agreed spice this turn.',
    payment: { kind: 'deferredBribe', payer: f.target, recipient: f.asker, amount: 3, dueTurn: f.game.turn } });
  const deal = game.deals!.at(-1)!;
  game = act(game, f.target, { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(game.deals!.at(-1)!.paymentStatus, 'pending');
  return { f, game, deal: deal.id };
}

void test('human-controlled seats are not given an automatic deferred payment', () => {
  const { f, game, deal } = accepted();
  const view = viewGame(game, f.target);
  assert.equal(view.deferredDealPaymentOptions[deal]?.blocked, null);
  assert.ok(!botActions(view).some(action => action.type === 'dealPay'));
  assert.equal(player(game, f.target).spice, 10);
  assert.equal(game.deals!.at(-1)!.paymentStatus, 'pending');
});

void test('a delegated human seat pays its own exact pending deal legally', () => {
  const { f, game: source, deal } = accepted();
  const delegated = act(source, f.target, { type: 'setAutopilot', difficulty: 'Easy' });
  assert.equal(player(delegated, f.target).autopilot, 'Easy');
  const action = botActions(viewGame(delegated, f.target))[0];
  assert.deepEqual(action, { type: 'dealPay', deal });
  const settled = act(delegated, f.target, action);
  assert.equal(settled.deals!.at(-1)!.paymentStatus, 'paid');
  assert.equal(player(settled, f.target).spice, 7);
  assert.equal(player(settled, f.asker).bribes, 3);
  assert.deepEqual(inventory(settled), f.originalCards);
});

void test('a native Truthtrance response blocks autopilot payment until it resolves', () => {
  const { f, game: source, deal } = accepted();
  let game: Game = act(source, f.target, { type: 'setAutopilot', difficulty: 'Easy' });
  game = act(game, f.asker, { type: 'card', card: f.truths[0] });
  assert.ok(game.truthtrance, 'An actual original Truthtrance opens a native response.');
  const view = viewGame(game, f.target);
  assert.ok(view.deferredDealPaymentOptions[deal]?.blocked);
  assert.ok(!botActions(view).some(action => action.type === 'dealPay'));
  assert.equal(game.deals!.at(-1)!.paymentStatus, 'pending');
  assert.equal(player(game, f.target).spice, 10);
  assert.deepEqual(inventory(game), f.originalCards);
});
