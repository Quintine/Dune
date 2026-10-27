import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { act, advance, clean, createKullBribeFixture, player } from './fixture-kull-bribe';

function shipmentOpening(answer: 'yes' | 'no', amalHolder?: 'emperor' | 'choam') {
  const f = createKullBribeFixture();
  let game = structuredClone(f.charity);
  // Controlled physical-card supplements: return Emperor’s original Karama
  // to the unopened deck and move an original Amal to the named hand. No
  // force, spice, phase or promise is staged.
  let amal: string | undefined;
  if (amalHolder) {
    const own = player(game, f.actor);
    const karamaIndex = own.hand.findIndex(card => card.id === f.karama);
    assert.ok(karamaIndex >= 0);
    game.deck.push(own.hand.splice(karamaIndex, 1)[0]);
    const index = game.deck.findIndex(card => card.effect === 'amal');
    assert.ok(index >= 0);
    const card = game.deck.splice(index, 1)[0];
    player(game, amalHolder).hand.push(card);
    amal = card.id;
  }
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer);
    game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.actor, territory: 'carthag', minimum: 8,
  } });
  assert.ok(viewGame(game, f.actor).truthShipmentAnswers?.includes(answer));
  game = act(game, f.actor, { type: 'truthAnswer', answer });
  game = advance(game, g => g.phase === 5 && g.phaseOpening?.initialize === true);
  assert.equal(game.active, null);
  assert.equal(game.movementRemaining, null);
  return { f, game, amal };
}

function completeOpening(game: Game) {
  while (game.phaseOpening) {
    const passer = game.players.find(p => !game.phaseOpening!.passed.includes(p.id));
    assert.ok(passer);
    game = act(game, passer.id, { type: 'ready' });
  }
  return game;
}

void test('an early shipment No survives each real Ix Movement opening pass', () => {
  const { f, game: opening } = shipmentOpening('no');
  const game = completeOpening(opening);
  assert.equal(player(game, f.actor).shipped, false);
  assert.equal(game.phase, 5);
  assert.ok(game.movementRemaining?.includes(f.actor));
  assert.equal(game.shipmentPromises?.[0].answer, false);
  assert.equal(game.shipmentPromises?.[0].released, undefined);
});

void test('an owner cannot play Amal to defeat a positive shipment promise at the Movement opening', () => {
  const { f, game, amal } = shipmentOpening('yes', 'emperor');
  assert.ok(amal);
  assert.equal(player(game, f.actor).spice, 10);
  const before = structuredClone(game);
  assert.throws(() => act(game, f.actor, { type: 'card', card: amal }), /Truthtrance shipment/);
  assert.deepEqual(game, before);
});

void test('another player’s Amal releases an impossible shipment only after the opening settles', () => {
  const { f, game: opening, amal } = shipmentOpening('yes', 'choam');
  assert.ok(amal);
  let game = act(opening, f.reactor, { type: 'card', card: amal });
  assert.equal(player(game, f.actor).spice, 5);
  assert.equal(game.shipmentPromises?.[0].released, undefined);
  game = completeOpening(game);
  game = advance(game, clean);
  assert.equal(game.shipmentPromises?.[0].released, true);
});

void test('a second-turn shipment promise survives the opening after a real previous shipment', () => {
  const f = createKullBribeFixture();
  let game = structuredClone(f.game);
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 5);
  assert.equal(game.active, f.actor);
  game = act(game, f.actor, { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 1, elite: 0, allyPayment: 0 });
  game = advance(game, clean);
  assert.equal(player(game, f.actor).shipped, true);
  game = act(game, f.actor, { type: 'endMovement' });
  game = advance(game, g => g.turn === 2 && g.phase === 2 && clean(g));
  assert.deepEqual(game.movementRemaining, []);
  assert.equal(player(game, f.actor).shipped, true);
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer);
    game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.actor, territory: 'carthag', minimum: 8,
  } });
  assert.ok(viewGame(game, f.actor).truthShipmentAnswers?.includes('no'));
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'no' });
  game = advance(game, g => g.turn === 2 && g.phase === 5 && g.phaseOpening?.initialize === true);
  assert.deepEqual(game.movementRemaining, []);
  assert.equal(player(game, f.actor).shipped, true);
  game = completeOpening(game);
  assert.equal(player(game, f.actor).shipped, false);
  assert.ok(game.movementRemaining?.includes(f.actor));
  assert.ok(game.shipmentPromises?.some(p => p.turn === 2 && p.answer === false && !p.released));
});
