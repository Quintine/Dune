import assert from 'node:assert/strict';
import test from 'node:test';
import type { Game } from '../game/engine';
import {
  actTruthBribe as act, createTruthBribeFixture as fixture,
  truthBribeInventory as inventory, truthBribePlayer as player,
} from './fixture-truth-bribe';

function agree(game: Game, recipient: string, payer: string, amount: number) {
  const offered = act(game, recipient, { type: 'dealOffer', target: payer, terms: 'Pay this turn.',
    payment: { kind: 'deferredBribe', payer, recipient, amount, dueTurn: game.turn } });
  const deal = offered.deals!.at(-1)!;
  const accepted = act(offered, payer, { type: 'dealRespond', deal: deal.id, accept: true });
  return { game: accepted, id: deal.id };
}

void test('a temporarily allied recipient does not let the payer evade a different, still-payable deal', () => {
  // Real Basic setup, ordinary auction, hands and ten-spice Emperor purse.
  // Both agreements are genuinely proposed and unanimously accepted. Only
  // their later mutual alliance is staged; no card or spice is fabricated.
  const f = fixture(), first = agree(f.game, f.asker, f.target, 4);
  const second = agree(first.game, f.opponent, f.target, 3);
  const game = structuredClone(second.game);
  player(game, f.target).ally = f.asker;
  player(game, f.asker).ally = f.target;
  assert.equal(player(game, f.target).spice, 10);
  assert.equal(game.deals!.find(deal => deal.id === first.id)!.paymentStatus, 'pending');
  assert.equal(game.deals!.find(deal => deal.id === second.id)!.paymentStatus, 'pending');

  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.opponent, amount: 8 }),
    /deal|payment|fund/i, 'Spending below the other payable deal cannot use an unrelated temporarily blocked term as an escape.');
  assert.deepEqual(game, before, 'Rejected spending preserves both agreements and the complete source state.');

  const paid = act(game, f.target, { type: 'dealPay', deal: second.id });
  assert.equal(paid.deals!.find(deal => deal.id === second.id)!.paymentStatus, 'paid');
  assert.equal(paid.deals!.find(deal => deal.id === first.id)!.paymentStatus, 'pending');
  assert.equal(player(paid, f.target).spice, 7);
  assert.equal(player(paid, f.opponent).bribes, 3);
  assert.deepEqual(inventory(paid), f.originalCards);
});
