import assert from 'node:assert/strict';
import test from 'node:test';
import { type Action, type Game } from '../game/engine';
import {
  actTruthBribe as act, createTruthBribeFixture as fixture,
  truthBribeInventory as inventory, truthBribePlayer as player,
} from './fixture-truth-bribe';
import { enterMentatBribeWithUnpaidPromise as enterMentat, finishMentatBribe as finish } from './fixture-mentat-bribes';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'A rejected action leaves the source state unchanged.');
}

/** This is a genuine public H/A/E Basic source at Collection. Its starting
 * deal/auction and Spice cards were selected while unopened; all payments and
 * Mentat transitions below are actual native actions, with no purse staging. */
void test('already paid bribe escrow can fund a deferred deal at this turn’s real Mentat opening', () => {
  const f = fixture({ phase: 7 }), initial = f.game;
  assert.equal(initial.phase, 7);
  assert.equal(player(initial, f.asker).spice, 10);
  // H spends nine now, then receives an independently completed E→H bribe.
  let game = act(initial, f.asker, { type: 'bribe', target: f.opponent, amount: 9 });
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.asker).spice, 1);
  assert.equal(player(game, f.asker).bribes, 3);
  assert.equal(player(game, f.opponent).bribes, 9);

  // A has not yet received its own nine either; E's three are already in
  // H's native escrow and cannot be spent until this turn's real Mentat.
  game = act(game, f.asker, { type: 'dealOffer', target: f.opponent,
    terms: 'Pay four after the upcoming Mentat opening.',
    payment: { kind: 'deferredBribe', payer: f.asker, recipient: f.opponent, amount: 4, dueTurn: game.turn } });
  const id = game.deals!.at(-1)!.id;
  game = act(game, f.opponent, { type: 'dealRespond', deal: id, accept: true });
  assert.equal(game.deals!.at(-1)!.paymentStatus, 'pending');
  assert.equal(player(game, f.asker).spice, 1);
  assert.equal(player(game, f.asker).bribes, 3);
  rejected(game, f.asker, { type: 'dealPay', deal: id });
  rejected(game, f.asker, { type: 'bribe', target: f.target, amount: 1 });

  const mentat = enterMentat(game);
  assert.equal(mentat.phase, 8); assert.equal(mentat.turn, initial.turn);
  assert.equal(player(mentat, f.asker).spice, 4);
  assert.equal(player(mentat, f.asker).bribes, 0);
  assert.equal(player(mentat, f.opponent).bribes, 0);
  const paid = act(mentat, f.asker, { type: 'dealPay', deal: id });
  assert.equal(paid.deals!.find(deal => deal.id === id)!.paymentStatus, 'paid');
  assert.equal(player(paid, f.asker).spice, 0);
  assert.equal(player(paid, f.opponent).bribes, 4,
    'A payment after this Mentat opening waits for the next opening.');
  const next = finish(paid);
  assert.equal(next.turn, initial.turn + 1); assert.equal(next.phase, 0);
  assert.equal(player(next, f.opponent).bribes, 4);
  assert.deepEqual(inventory(next), f.originalCards);
});
