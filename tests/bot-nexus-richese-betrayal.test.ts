import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createRicheseBetrayalFixture } from './fixture-richese-betrayal';

function saved(game: Game): Game {
  return JSON.parse(JSON.stringify(game));
}

void test('all four profiles commit the saved purchase veto and sale diversion from their private projection', () => {
  for (const profile of DIFFICULTIES) {
    for (const kind of ['purchase', 'sale'] as const) {
      const fixture = createRicheseBetrayalFixture(kind);
      fixture.game.players.find(player => player.id === fixture.holder)!.bot = profile;
      const game = saved(fixture.game);
      const own = viewGame(game, fixture.holder);
      // No rival hand or resources may be needed to choose the response.
      for (const rival of own.players) {
        if (rival.id !== own.me) {
          delete rival.hand;
          delete rival.spice;
        }
      }
      const reaction = own.richeseBetrayalReaction!;
      assert.equal(reaction.canUse, true);
      const actions = botActions(own);
      assert.deepEqual(actions, [{ type: 'richeseBetrayalUse', event: reaction.event }]);
      const balances = game.players.map(player => player.spice);
      const buyerCount = game.players.find(player => player.id === fixture.buyer)!.hand.length;
      const result = saved(applyAction(game, fixture.holder, actions[0]));
      assert.equal(viewGame(result, fixture.holder).richeseBetrayalReaction, null);
      assert.ok(result.nexusCards?.cards?.discard.includes('richese'));
      if (kind === 'purchase') {
        assert.deepEqual(result.players.map(player => player.spice), balances);
        assert.equal(result.players.find(player => player.id === fixture.buyer)!.hand.length, buyerCount);
        assert.ok(result.discard.some(card => card.id === fixture.card));
      } else {
        assert.equal(result.players.find(player => player.id === fixture.target)!.spice,
          game.players.find(player => player.id === fixture.target)!.spice);
        assert.equal(result.players.find(player => player.id === fixture.buyer)!.spice,
          game.players.find(player => player.id === fixture.buyer)!.spice - reaction.price);
        assert.ok(result.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === fixture.card));
      }
    }
  }
});

void test('all profiles pass publicly possible nonholder boundaries through saved original settlement', () => {
  for (const profile of DIFFICULTIES) {
    for (const kind of ['purchase', 'sale'] as const) {
      const fixture = createRicheseBetrayalFixture(kind, { holderNexus: 'choam' });
      for (const player of fixture.game.players) player.bot = profile;
      let game = saved(fixture.game);
      const original = viewGame(game, fixture.holder).richeseBetrayalReaction!;
      assert.equal(original.canUse, false);
      for (let acknowledgements = 0; acknowledgements < game.players.length; acknowledgements++) {
        const responder = game.players.find(player => {
          const reaction = viewGame(game, player.id).richeseBetrayalReaction;
          return reaction?.canPass && !reaction.hasPassed;
        });
        if (!responder) break;
        const view = viewGame(game, responder.id);
        const actions = botActions(view);
        assert.deepEqual(actions, [{ type: 'richeseBetrayalPass', event: original.event }]);
        game = saved(applyAction(game, responder.id, actions[0]));
        if (viewGame(game, responder.id).richeseBetrayalReaction) {
          assert.deepEqual(botActions(viewGame(game, responder.id)), []);
        }
      }
      assert.equal(viewGame(game, fixture.holder).richeseBetrayalReaction, null);
      assert.ok(game.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === fixture.card));
      assert.equal(game.players.find(player => player.id === fixture.buyer)!.spice,
        fixture.game.players.find(player => player.id === fixture.buyer)!.spice - original.price);
      assert.equal(game.nexusCards?.cards?.hands[fixture.holder], 'choam');
    }
  }
});

void test('projected restrictions defeat physical Richese Nexus hints without exposing underlying bot actions', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createRicheseBetrayalFixture('purchase');
    fixture.game.players.find(player => player.id === fixture.holder)!.bot = profile;
    const view = viewGame(saved(fixture.game), fixture.holder);
    assert.equal(view.nexusCards?.card, 'richese');
    const reaction = view.richeseBetrayalReaction!;
    reaction.canUse = false;
    reaction.blocked = 'The committed promise prevents spending this Nexus card.';
    assert.deepEqual(botActions(view), [{ type: 'richeseBetrayalPass', event: reaction.event }]);
    reaction.hasPassed = true;
    assert.deepEqual(botActions(view), []);
    reaction.hasPassed = false;
    reaction.canPass = false;
    assert.deepEqual(botActions(view), []);
    reaction.canPass = true;
    view.status = 'finished';
    assert.deepEqual(botActions(view), []);
  }
});
