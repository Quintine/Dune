import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import {
  actMentatBribe as act, createMentatBribeFixture as fixture,
  mentatBribeInventory as inventory, mentatBribePlayer as player,
} from './fixture-mentat-bribes';

function agree(game: Game, proposer: string, payer: string) {
  const offered = act(game, proposer, { type: 'dealOffer', target: payer, terms: 'Pay this turn.',
    payment: { kind: 'deferredBribe', payer, recipient: proposer, amount: 4, dueTurn: game.turn } });
  const id = offered.deals!.at(-1)!.id;
  return { game: act(offered, payer, { type: 'dealRespond', deal: id, accept: true }), id };
}
const spice = (game: Game) => game.players.reduce((sum, seat) => sum + seat.spice + seat.bribes, 0);

for (const pick of ['first', 'second'] as const) {
  void test(`external shortage preserves both individually payable deals until payer chooses ${pick}`, () => {
    // The fixture reaches actual Basic Mentat with Emperor's original ten
    // spice. Both independent agreements are really offered and accepted.
    const f = fixture(), first = agree(f.game, f.asker, f.target);
    const second = agree(first.game, f.asker, f.target);
    const staged = structuredClone(second.game), target = player(staged, f.target), other = player(staged, f.opponent);
    const originalSpice = spice(staged);
    // Model an external loss: transfer five existing spice, not create or
    // destroy it. Each four-spice payment is now possible on its own.
    target.spice -= 5; other.spice += 5;
    const waiting = act(staged, f.opponent, { type: 'ready' });
    assert.equal(waiting.deals!.find(row => row.id === first.id)!.paymentStatus, 'pending');
    assert.equal(waiting.deals!.find(row => row.id === second.id)!.paymentStatus, 'pending');
    const options = viewGame(waiting, f.target).deferredDealPaymentOptions;
    assert.equal(options[first.id]?.blocked, null);
    assert.equal(options[second.id]?.blocked, null);

    const chosen = pick === 'first' ? first.id : second.id;
    const unchosen = pick === 'first' ? second.id : first.id;
    const paid = act(waiting, f.target, { type: 'dealPay', deal: chosen });
    assert.equal(paid.deals!.find(row => row.id === chosen)!.paymentStatus, 'paid');
    assert.equal(paid.deals!.find(row => row.id === unchosen)!.paymentStatus, 'void');
    assert.equal(player(paid, f.target).spice, 1);
    assert.equal(player(paid, f.asker).bribes, 4);
    assert.equal(spice(paid), originalSpice);
    assert.deepEqual(inventory(paid), f.originalCards);
  });
}
