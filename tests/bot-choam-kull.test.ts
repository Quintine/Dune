import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { choamKullGame, kullShipmentAttempt, takeKullCard } from './fixture-choam-kull';

void test('every profile uses the projected physical Kull and cannot act from a foreign offer', () => {
  for (const profile of DIFFICULTIES) {
    const original = choamKullGame();
    original.players[0].bot = profile;
    original.deck.push(...original.players[2].hand);
    original.players[2].hand = [];
    original.players[3].bot = profile;
    const attemptedCard = original.players[1].hand[0].id;
    const saved = JSON.parse(JSON.stringify(applyAction(original, 'e', kullShipmentAttempt(original))));
    const own = viewGame(saved, 'c');
    for (const player of own.players) {
      if (player.id === own.me) continue;
      for (const key of ['hand', 'traitors', 'spice']) {
        Object.defineProperty(player, key, {
          get() { throw new Error(`Read rival ${key}`); },
        });
      }
    }
    const actions = botActions(own);
    assert.deepEqual(actions, [{ type: 'kullDecision', event: own.kullReaction!.event, source: 'printed', card: 'ix-kull-wahad' }]);
    assert.deepEqual(botActions(viewGame(saved, 'h')), []);
    let settled = applyAction(saved, 'c', actions[0]);
    // A non-target declines the native response with its own legal card held.
    const h = viewGame(settled, 'h');
    assert.deepEqual(botActions(h), [{ type: 'passResponse' }]);
    settled = applyAction(settled, 'h', botActions(h)[0]);
    assert.equal(settled.pendingKull, null);
    assert.equal(settled.karamaShipping, null);
    assert.ok(settled.players[1].hand.some(card => card.id === attemptedCard));
    assert.ok(settled.discard.some(card => card.id === 'ix-kull-wahad'));
    assert.ok(viewGame(settled, 'e').karamaBlocked);
  }
});

void test('every profile declines no-cost and allied offers and resumes the original shipment once after saving', () => {
  for (const profile of DIFFICULTIES) {
    for (const allied of [false, true]) {
      const game = choamKullGame();
      game.players[0].bot = profile;
      if (allied) {
        game.players[0].ally = 'e';
        game.players[1].ally = 'c';
      } else {
        game.deck.push(takeKullCard(game, 'ix-kull-wahad'));
      }
      const attemptedCard = game.players[1].hand[0].id;
      const offer = JSON.parse(JSON.stringify(applyAction(game, 'e', kullShipmentAttempt(game))));
      const own = viewGame(offer, 'c');
      const action = botActions(own)[0];
      assert.deepEqual(action, { type: 'kullDecision', event: own.kullReaction!.event, decline: true });
      const resumed = applyAction(offer, 'c', action);
      assert.equal(resumed.pendingKull, null);
      assert.equal(resumed.karamaShipping?.owner, 'e');
      assert.equal(resumed.karamaShipping?.player, 'e');
      assert.equal(resumed.discard.filter(card => card.id === attemptedCard).length, 1);
      assert.ok(!resumed.players[1].hand.some(card => card.id === attemptedCard));
    }
  }
});

void test('every profile counters Kull only with a distinct projected card and resumes the reserved original', () => {
  for (const profile of DIFFICULTIES) {
    const game = choamKullGame();
    game.players[1].bot = profile;
    const reserved = game.players[1].hand[0].id;
    const counter = takeKullCard(game, game.players[3].hand[0].id);
    game.players[1].hand.push(counter);
    const offer = applyAction(game, 'e', kullShipmentAttempt(game));
    const declared = applyAction(offer, 'c', {
      type: 'kullDecision', event: offer.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad',
    });
    const own = viewGame(JSON.parse(JSON.stringify(declared)), 'e');
    assert.ok(!own.responseControls!.cancelCards.includes(reserved));
    const actions = botActions(own);
    assert.deepEqual(actions, [{ type: 'card', mode: 'cancel', card: counter.id }]);
    const resumed = applyAction(declared, 'e', actions[0]);
    assert.equal(resumed.pendingKull, null);
    assert.equal(resumed.karamaShipping?.owner, 'e');
    for (const id of [reserved, counter.id])
      assert.equal(resumed.discard.filter(card => card.id === id).length, 1);
    assert.ok(resumed.players[0].hand.some(card => card.id === 'ix-kull-wahad'));
    assert.equal(viewGame(resumed, 'e').karamaBlocked, null);
  }
});

void test('a blocked projected cost is declined rather than treated as a playable held card', () => {
  for (const profile of DIFFICULTIES) {
    const game = choamKullGame();
    game.players[0].bot = profile;
    const offer = applyAction(game, 'e', kullShipmentAttempt(game));
    const own = viewGame(offer, 'c');
    own.kullReaction!.blocked = 'The cost is reserved for another continuation.';
    Object.defineProperty(own.kullReaction, 'plays', {
      get() { throw new Error('Read ineligible cost choices'); },
    });
    const action = botActions(own)[0];
    assert.deepEqual(action, { type: 'kullDecision', event: own.kullReaction!.event, decline: true });
    const resumed = applyAction(offer, 'c', action);
    assert.equal(resumed.karamaShipping?.owner, 'e');
    assert.ok(resumed.players[0].hand.some(card => card.id === 'ix-kull-wahad'));
  }
});

void test('BG counter conversion keeps all profiles in standard response controls until the saved attempt resumes', () => {
  for (const profile of DIFFICULTIES) {
    const game = choamKullGame();
    game.players[2].bot = profile;
    game.players[3].bot = profile;
    game.players[2].ally = 'e';
    game.players[1].ally = 'b';
    const counter = game.players[2].hand[0].id;
    const offer = applyAction(game, 'e', kullShipmentAttempt(game));
    const declared = applyAction(offer, 'c', {
      type: 'kullDecision', event: offer.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad',
    });
    const action = botActions(viewGame(declared, 'b'))[0];
    assert.deepEqual(action, { type: 'card', mode: 'cancel', card: counter });
    const conversion = applyAction(declared, 'b', action);
    assert.equal(conversion.response?.kind, 'worthlessKarama');
    const saved = JSON.parse(JSON.stringify(conversion));
    const own = viewGame(saved, 'h');
    assert.equal(own.kullCounterEvent, offer.pendingKull!.event);
    assert.deepEqual(botActions(own), [{ type: 'passResponse' }]);
    const resumed = applyAction(saved, 'h', botActions(own)[0]);
    assert.equal(resumed.pendingKull, null);
    assert.equal(resumed.karamaShipping?.owner, 'e');
    assert.equal(resumed.discard.filter(card => card.id === counter).length, 1);
    assert.ok(resumed.players[0].hand.some(card => card.id === 'ix-kull-wahad'));
  }
});
