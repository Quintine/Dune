import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { act, advance, clean, createKullBribeFixture, inventory, player } from './fixture-kull-bribe';

void test('a Basic Kull phase ban cannot fund a later shipment with the blocked auction Karama', () => {
  // The shared fixture selects the original unopened deal and Spice position;
  // it uses public Basic opt-in and real setup. No wallet or force is staged.
  const f = createKullBribeFixture();
  let game = structuredClone(f.charity);
  game = advance(game, g => g.phase === 3 && clean(g) && g.auction?.active === f.actor);
  assert.equal(player(game, f.actor).spice, 10);
  const lot = game.auction!.cards[game.auction!.index].id;

  // The holder actually attempts an ordinary free purchase. CHOAM interrupts
  // with its original Kull; everyone with a counter opportunity passes.
  game = act(game, f.actor, { type: 'card', mode: 'purchase', card: f.karama });
  const reaction = viewGame(game, f.reactor).kullReaction;
  assert.ok(reaction && reaction.plays.some(play => play.card.id === f.kull && !play.blocked));
  game = act(game, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  game = advance(game, clean);
  assert.equal(game.phase, 3);
  assert.ok(game.kullRestrictions?.some(row => row.player === f.actor && row.turn === game.turn && row.phase === 3));
  assert.ok(player(game, f.actor).hand.some(card => card.id === f.karama));
  assert.ok(viewGame(game, f.actor).karamaBlocked);
  const blockedPurchase = structuredClone(game);
  assert.throws(() => act(game, f.actor, { type: 'card', mode: 'purchase', card: f.karama }), /Kull Wahad/);
  assert.deepEqual(game, blockedPurchase);

  // Seven of ten spice is an actually funded bid; the real invoice leaves
  // three. Eight to Carthag costs eight normally or four at the Karama rate.
  // The one retained Karama cannot both evade this Bidding invoice (Kull) and
  // legitimately fund that shipment after cash payment.
  assert.equal(game.auction?.active, f.actor);
  game = act(game, f.actor, { type: 'bid', amount: 7, allyPayment: 0 });
  assert.equal(game.auction?.bidder, f.actor);
  assert.equal(game.auction?.bid, 7);
  assert.equal(player(game, f.actor).spice, 10);

  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer);
    game = act(game, passer.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.actor, territory: 'carthag', minimum: 8,
  } });
  const respondent = viewGame(game, f.actor);
  assert.deepEqual(respondent.truthShipmentAnswers, ['no']);
  assert.ok(respondent.shipmentPromisePolicy == null);
  assert.equal(respondent.shipmentPreparation, null);
  const beforeRejected = structuredClone(game);
  assert.throws(() => act(game, f.actor, { type: 'truthAnswer', answer: 'yes' }));
  assert.deepEqual(game, beforeRejected);
  // The other seat's private counter remains absent from an observer's view.
  assert.ok(!JSON.stringify(viewGame(game, f.asker)).includes(f.counter));
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'no' });

  // Complete the actual auction; the cash invoice settles automatically when
  // the blocked Karama leaves no legal alternative payment choice.
  game = advance(game, g => player(g, f.actor).hand.some(card => card.id === lot));
  assert.equal(player(game, f.actor).spice, 3);
  assert.ok(player(game, f.actor).hand.some(card => card.id === lot));
  assert.ok(player(game, f.actor).hand.some(card => card.id === f.karama));
  assert.deepEqual(inventory(game), f.originalCards);
});
