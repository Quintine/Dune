import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createNexusEmperorPaymentFixture, nexusEmperorPaymentCards, nexusEmperorPaymentInventory,
  nexusEmperorPaymentPlayer, stepNexusEmperorPayment,
} from './fixture-nexus-emperor-payment';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const original = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, original, 'A rejected activation must not mutate its original source');
}

for (const advanced of [false, true]) {
  for (const prepaidAid of [0, 1]) for (const cancelIncome of [false, true]) void test(
    `${advanced ? 'Advanced' : 'Basic'} genuine allied purchase reuses ${prepaidAid} prepaid spice and ${cancelIncome ? 'cancels' : 'allows'} original Emperor income`, () => {
      const f = createNexusEmperorPaymentFixture({ advanced, prepaidAid });
      assert.equal(f.game.decision!.player, f.neutral);
      assert.deepEqual(f.game.pendingNexusEmperorPayment!.receipt.required, [f.neutral, f.owner]);
      for (const actor of [f.neutral, f.winner, f.emperor, f.owner])
        assert.equal(viewGame(f.game, actor).nexusEmperorPayment, null,
          'No private Emperor offer appears before its holder is current');
      rejectsUnchanged(f.game, f.owner, { type: 'nexusEmperorPayment', event: f.event, use: true });
      rejectsUnchanged(f.game, f.neutral, { type: 'nexusEmperorPayment', event: f.event, use: true });
      const beforeNeutral = structuredClone(f.game);
      let game = stepNexusEmperorPayment(f.game, { actor: f.neutral,
        action: { type: 'nexusEmperorPayment', event: f.event, use: false } });
      assert.equal(game.decision!.kind, 'nexusEmperorPayment');
      assert.equal(game.decision!.player, f.owner);
      assert.deepEqual(game.players, beforeNeutral.players, 'Neutral Continue changes neither wallet nor card custody');
      assert.deepEqual(game.auction, beforeNeutral.auction, 'Neutral Continue cannot create a new bid');
      const offer = viewGame(game, f.owner).nexusEmperorPayment!;
      assert.equal(offer.canUse, true); assert.equal(offer.blocked, null);
      for (const actor of [f.neutral, f.winner, f.emperor])
        assert.equal(viewGame(game, actor).nexusEmperorPayment, null);
      rejectsUnchanged(game, f.owner, { type: 'nexusEmperorPayment', event: `${f.event}:stale`, use: true });
      game = stepNexusEmperorPayment(game, { actor: f.owner,
        action: { type: 'nexusEmperorPayment', event: f.event, use: true } });
      assert.equal(game.pendingNexusEmperorPayment, null);
      assert.equal(game.nexusEmperorPayment!.current, null);
      const receipt = game.nexusEmperorPayment!.completed.at(-1)!;
      assert.equal(receipt.event, f.event); assert.equal(receipt.stage, 'used');
      assert.equal(receipt.owner, f.owner); assert.deepEqual(receipt.passed, [f.neutral]);
      assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
      assert.equal(game.nexusCards!.cards!.hands[f.neutral], 'fremen');
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner,
        'Full forced funding leaves the buyer’s original balance unchanged');
      assert.equal(nexusEmperorPaymentPlayer(game, f.emperor).spice, f.wallets.emperor - (f.price - prepaidAid),
        'Prepaid credit is already deducted; only the missing spice is newly escrowed');
      assert.deepEqual(game.aid[f.emperor], { recipient: f.winner, amount: 0 });
      assert.equal(game.auction!.bid, f.price); assert.equal(game.auction!.bidder, f.winner);
      assert.equal(game.auction!.allyPayment, f.price);
      assert.equal(game.auction!.index, f.game.auction!.index);
      assert.equal(game.currentAuctionSale!.origin, 'normal');
      assert.equal(game.currentAuctionSale!.winner, f.winner);
      assert.equal(game.currentAuctionSale!.amount, f.price); assert.equal(game.currentAuctionSale!.free, false);
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(game.response!.kind, 'emperorIncome', 'Only the original native income cancellation window opens');
      assert.equal(game.response!.owner, f.emperor);
      assert.ok(!game.pendingKarama);
      rejectsUnchanged(game, f.owner, { type: 'nexusEmperorPayment', event: f.event, use: true });
      if (cancelIncome) {
        game = stepNexusEmperorPayment(game, { actor: f.neutral,
          action: { type: 'card', mode: 'cancel', card: f.karama } });
        assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
      } else {
        while (game.response?.kind === 'emperorIncome') {
          const actor = game.players.find(player => !game.response!.passed.includes(player.id))!.id;
          game = stepNexusEmperorPayment(game, { actor, action: { type: 'passResponse' } });
        }
      }
      assert.equal(nexusEmperorPaymentPlayer(game, f.emperor).spice,
        f.wallets.emperorBeforeAid - (cancelIncome ? f.price : 0),
        'Original income is credited once or canceled without refunding the original forced payment');
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner);
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(game.auction!.index, f.game.auction!.index + 1, 'Original successor lot advances exactly once');
      assert.equal(game.response!.kind, 'atreidesAuction', 'Original next-lot inspection is restored');
      assert.equal(game.nexusEmperorPayment!.completed.length, 1);
      assert.deepEqual(nexusEmperorPaymentCards(game), f.originalCards);
      nexusEmperorPaymentInventory(game);
    },
  );

  for (const prepaidAid of [0, 1, 2]) void test(
    `${advanced ? 'Advanced' : 'Basic'} every real acknowledgement passes and preserves ordinary payment with ${prepaidAid} pledged spice`, () => {
      const f = createNexusEmperorPaymentFixture({ advanced, prepaidAid });
      let game = f.game;
      while (game.decision?.kind === 'nexusEmperorPayment') {
        const actor = game.decision.player;
        if (actor === f.owner && prepaidAid === f.price) {
          assert.equal(viewGame(game, actor).nexusEmperorPayment!.canUse, false);
          rejectsUnchanged(game, actor, { type: 'nexusEmperorPayment', event: f.event, use: true });
        }
        game = stepNexusEmperorPayment(game, { actor,
          action: { type: 'nexusEmperorPayment', event: f.event, use: false } });
      }
      assert.equal(game.decision!.kind, 'auctionPayment'); assert.equal(game.decision!.player, f.winner);
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner);
      assert.equal(nexusEmperorPaymentPlayer(game, f.emperor).spice, f.wallets.emperor);
      assert.equal(game.nexusCards!.cards!.hands[f.owner], 'emperor');
      assert.equal(game.nexusEmperorPayment!.completed.at(-1)!.stage, 'passed');
      assert.equal(game.auction!.bid, f.price); assert.equal(game.auction!.allyPayment, prepaidAid);
      game = stepNexusEmperorPayment(game, { actor: f.winner, action: { type: 'decision', karama: false } });
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner - f.price + prepaidAid);
      assert.equal(nexusEmperorPaymentPlayer(game, f.emperor).spice, f.wallets.emperor);
      assert.equal(game.response!.kind, 'emperorIncome');
      assert.equal(nexusEmperorPaymentPlayer(game, f.winner).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(game.nexusEmperorPayment!.completed.length, 1, 'Ordinary settlement does not reopen the same obligation');
      nexusEmperorPaymentInventory(game);
    },
  );
}

void test('real neutral response rejects stale events, wrong actors, extra keys and coercion atomically', () => {
  const f = createNexusEmperorPaymentFixture();
  for (const actor of [f.owner, f.emperor, f.winner])
    rejectsUnchanged(f.game, actor, { type: 'nexusEmperorPayment', event: f.event, use: false });
  for (const action of [
    { type: 'nexusEmperorPayment', event: 'not-the-original-event', use: false },
    { type: 'nexusEmperorPayment', event: f.event, use: false, amount: 2 },
    { type: 'nexusEmperorPayment', event: f.event, use: false, policy: 'full' },
    { type: 'nexusEmperorPayment', event: f.event, use: 'false' },
    { type: 'nexusEmperorPayment', event: f.event },
    { type: 'decision', event: f.event, use: false },
  ]) rejectsUnchanged(f.game, f.neutral, action);
  const ownerTurn = stepNexusEmperorPayment(f.game, { actor: f.neutral,
    action: { type: 'nexusEmperorPayment', event: f.event, use: false } });
  rejectsUnchanged(ownerTurn, f.neutral, { type: 'nexusEmperorPayment', event: f.event, use: false });
  rejectsUnchanged(ownerTurn, f.owner, { type: 'nexusEmperorPayment', event: f.event, use: true, amount: 2 });
});

void test('a real closing draw without the irrelevant holder gives only the actual remaining public responder', () => {
  const f = createNexusEmperorPaymentFixture({ neutralHolder: false });
  assert.equal(f.game.decision!.player, f.owner);
  assert.deepEqual(f.game.pendingNexusEmperorPayment!.receipt.required, [f.owner]);
  assert.equal(viewGame(f.game, f.owner).nexusEmperorPayment!.canUse, true);
  assert.equal(f.game.nexusCards!.cards!.hands[f.neutral], null);
  const game = stepNexusEmperorPayment(f.game, { actor: f.owner,
    action: { type: 'nexusEmperorPayment', event: f.event, use: true } });
  assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner);
  assert.equal(game.response!.kind, 'emperorIncome');
  nexusEmperorPaymentInventory(game);
});

void test('naturally setup-dealt Truthtrance has priority over the original acknowledgement and preserves its event', () => {
  const f = createNexusEmperorPaymentFixture({ truthtrance: true });
  const card = nexusEmperorPaymentPlayer(f.game, f.neutral).hand.find(held => held.effect === 'truthtrance')!;
  assert.ok(card);
  let game = stepNexusEmperorPayment(f.game, { actor: f.neutral, action: { type: 'card', card: card.id } });
  assert.equal(game.truthtrance!.stage, 'priority');
  assert.equal(game.pendingNexusEmperorPayment!.receipt.event, f.event);
  rejectsUnchanged(game, f.neutral, { type: 'nexusEmperorPayment', event: f.event, use: false });
  rejectsUnchanged(game, f.owner, { type: 'nexusEmperorPayment', event: f.event, use: true });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id))!.id;
    game = stepNexusEmperorPayment(game, { actor, action: { type: 'truthPass' } });
  }
  game = stepNexusEmperorPayment(game, { actor: f.neutral, action: { type: 'truthAsk',
    question: { kind: 'fact', target: f.winner, fact: { kind: 'hand', name: 'Karama' } } } });
  assert.equal(viewGame(game, f.winner).truthAnswer, 'yes');
  game = stepNexusEmperorPayment(game, { actor: f.winner, action: { type: 'truthAnswer', answer: 'yes' } });
  assert.equal(game.truthtrance, null);
  assert.equal(game.decision!.kind, 'nexusEmperorPayment');
  assert.equal(game.decision!.player, f.neutral);
  assert.equal(game.pendingNexusEmperorPayment!.receipt.event, f.event);
  assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner);
  assert.equal(nexusEmperorPaymentPlayer(game, f.emperor).spice, f.wallets.emperor);
  assert.equal(game.discard.filter(held => held.id === card.id).length, 1);
  game = stepNexusEmperorPayment(game, { actor: f.neutral,
    action: { type: 'nexusEmperorPayment', event: f.event, use: false } });
  game = stepNexusEmperorPayment(game, { actor: f.owner,
    action: { type: 'nexusEmperorPayment', event: f.event, use: true } });
  assert.equal(game.response!.kind, 'emperorIncome');
  assert.equal(nexusEmperorPaymentPlayer(game, f.winner).hand.filter(held => held.id === f.acquired).length, 1);
  nexusEmperorPaymentInventory(game);
});

void test('original Easy bot policy passes for an irrelevant real holder then uses its own eligible Emperor Nexus', () => {
  const f = createNexusEmperorPaymentFixture();
  let game = f.game;
  for (const actor of [f.neutral, f.owner]) {
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = 'Easy';
    const action = botActions(view)[0];
    game = stepNexusEmperorPayment(game, { actor, action });
  }
  assert.equal(game.response!.kind, 'emperorIncome');
  assert.equal(nexusEmperorPaymentPlayer(game, f.winner).spice, f.wallets.winner);
  assert.equal(game.nexusEmperorPayment!.completed.at(-1)!.stage, 'used');
  nexusEmperorPaymentInventory(game);
});
