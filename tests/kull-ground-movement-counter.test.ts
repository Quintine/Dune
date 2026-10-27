import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { act, advance, clean, createKullBribeFixture, inventory, player } from './fixture-kull-bribe';

/** Build the question and both distinct Karama costs from the original
 * unopened public setup. Emperor voluntarily retains either four or eight
 * spice before answering; no hand, force, promise or phase is installed. */
function pendingCounter(retained: 4 | 8) {
  const f = createKullBribeFixture();
  let game = act(f.early, 'emperor', { type: 'bribe', target: 'guild', amount: 10 - retained });
  assert.equal(player(game, 'emperor').spice, retained);
  assert.ok(player(game, 'emperor').hand.some(card => card.id === f.karama));
  game = act(game, 'guild', { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const seat = game.players.find(row => !game.truthtrance!.passed.includes(row.id));
    assert.ok(seat);
    game = act(game, seat.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  game = act(game, 'guild', { type: 'truthAsk', question: {
    kind: 'movement', target: 'emperor', territory: 'carthag', minimum: 8,
  } });
  assert.ok(viewGame(game, 'emperor').truthMovementAnswers?.includes('yes'));
  game = act(game, 'emperor', { type: 'truthAnswer', answer: 'yes' });
  const accepted = structuredClone(game.movementPromises);
  game = advance(game, state => state.phase === 2 && state.response?.kind === 'choamCharity');

  // Harkonnen attempts the original cancellation with its own physical
  // Karama; CHOAM declares its unopened-deal Kull, and Emperor may counter
  // only with its different physical card.
  game = act(game, 'harkonnen', { type: 'card', mode: 'cancel', card: f.counter });
  assert.equal(game.pendingKull?.stage, 'offer');
  assert.deepEqual(game.movementPromises, accepted);
  const reaction = viewGame(game, 'choam').kullReaction;
  assert.ok(reaction);
  assert.ok(reaction.plays.some(row => row.card.id === f.kull && !row.blocked));
  game = act(game, 'choam', { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  // If no responder can legally counter, native continuation immediately
  // settles Kull instead of exposing an empty counter window.
  if (retained === 8) assert.equal(game.pendingKull?.stage, 'counter');
  assert.deepEqual(game.movementPromises, accepted);
  return { f, game, accepted };
}

function finishMovement(game: Game) {
  game = advance(game, state => state.phase === 5 && state.active === 'emperor' && clean(state));
  // Preserve the required Karama rate when eight forces cannot be shipped for
  // the four remaining spice without it; ordinary cash payment works with eight.
  if (player(game, 'emperor').spice === 4) {
    const card = player(game, 'emperor').hand.find(row => row.effect === 'karama');
    assert.ok(card);
    game = advance(act(game, 'emperor', { type: 'card', mode: 'shipment', card: card.id, target: 'emperor' }), clean);
  }
  game = advance(act(game, 'emperor', { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 8, elite: 0, allyPayment: 0 }), clean);
  game = advance(act(game, 'emperor', { type: 'move', from: 'arrakeen:10', territory: 'carthag',
    sector: 11, amount: 8, elite: 0 }), clean);
  assert.equal(game.movementPromises?.[0].fulfilled, true);
  return game;
}

void test('a distinct Kull counter cannot spend the only Karama needed by its own movement Yes', () => {
  const { f, game, accepted } = pendingCounter(4);
  assert.equal(game.pendingKull, null,
    'With no legal counter the Kull response settles automatically');
  assert.deepEqual(game.movementPromises, accepted);
  const settled = advance(game, clean);
  assert.equal(settled.pendingKull, null);
  assert.equal(settled.movementPromises?.[0].released, undefined);
  assert.ok(player(settled, 'emperor').hand.some(card => card.id === f.karama));
  assert.deepEqual(inventory(finishMovement(settled)), f.originalCards);
});

void test('the distinct counter remains legal when cash independently funds the promised movement', () => {
  const { f, game, accepted } = pendingCounter(8);
  assert.ok(viewGame(game, 'emperor').responseControls?.cancelCards.includes(f.karama));
  let settled = act(game, 'emperor', { type: 'card', mode: 'cancel', card: f.karama });
  settled = advance(settled, clean);
  assert.equal(settled.pendingKull, null);
  assert.deepEqual(settled.movementPromises, accepted);
  assert.equal(settled.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(finishMovement(settled)), f.originalCards);
});
