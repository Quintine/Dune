import assert from 'node:assert/strict';
import test from 'node:test';
import { type Game } from '../game/engine';
import {
  actTruthCharityPayments as act,
  createTruthCharityPaymentsFixture as fixture,
  truthCharityPaymentsInventory as inventory,
  truthCharityPaymentsPlayer as player,
} from './fixture-truth-charity-payments';

function agree(game: Game, proposer: string, payer: string, amount: number) {
  const offered = act(game, proposer, { type: 'dealOffer', target: payer, terms: 'Pay this turn.',
    payment: { kind: 'deferredBribe', payer, recipient: proposer, amount, dueTurn: game.turn } });
  const id = offered.deals!.at(-1)!.id;
  return { game: act(offered, payer, { type: 'dealRespond', deal: id, accept: true }), id };
}

void test('two whole deal payments can be funded by paying one before a real Charity claim', () => {
  // The native source plays the actual Amal at Spice Blow, halving the
  // Emperor's original ten spice to five, then enters actual Basic Charity.
  // Only unopened card/Spice ordering was selected; no wallet or hand staged.
  const f = fixture({ source: 'phase2', advanced: false });
  assert.equal(f.game.phase, 2);
  assert.equal(player(f.game, f.target).spice, 5);
  assert.notEqual(player(f.game, f.target).charityTurn, f.game.turn);
  const first = agree(f.game, f.asker, f.target, 4);
  const second = agree(first.game, f.asker, f.target, 2);
  const accepted = second.game;
  assert.equal(player(accepted, f.target).spice, 5, 'Both exact deals can be accepted before either payment.');
  assert.equal(accepted.deals!.find(row => row.id === first.id)!.paymentStatus, 'pending');
  assert.equal(accepted.deals!.find(row => row.id === second.id)!.paymentStatus, 'pending');

  const beforeMalformed = structuredClone(accepted);
  assert.throws(() => act(accepted, f.target, { type: 'dealPay', deal: first.id, amount: 1 }));
  assert.deepEqual(accepted, beforeMalformed, 'A partial dealPay cannot settle either exact payment.');
  const separate = act(accepted, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(separate.deals!.find(row => row.id === first.id)!.paymentStatus, 'pending');
  assert.equal(separate.deals!.find(row => row.id === second.id)!.paymentStatus, 'pending',
    'An untagged transfer does not silently settle either distinct deal.');

  let game = act(accepted, f.target, { type: 'dealPay', deal: first.id });
  assert.equal(player(game, f.target).spice, 1);
  assert.equal(game.deals!.find(row => row.id === first.id)!.paymentStatus, 'paid');
  assert.equal(game.deals!.find(row => row.id === second.id)!.paymentStatus, 'pending');
  game = act(game, f.target, { type: 'charity' });
  assert.equal(player(game, f.target).spice, 2);
  assert.equal(player(game, f.target).charityTurn, game.turn);
  game = act(game, f.target, { type: 'dealPay', deal: second.id });
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.asker).bribes, 6);
  assert.equal(game.deals!.find(row => row.id === second.id)!.paymentStatus, 'paid');
  assert.deepEqual(inventory(game), f.originalCards);
});
