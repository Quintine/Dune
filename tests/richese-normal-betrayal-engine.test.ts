import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createRicheseNormalBetrayalFixture as fixture,
  actRicheseNormalBetrayal as act,
  passRicheseNormalBetrayal as pass,
  payRicheseNormalBetrayal as pay,
  finishRicheseNormalBetrayal as finish,
  richeseNormalBetrayalPlayer as player,
  richeseNormalBetrayalInventory as inventory,
  richeseNormalBetrayalNexusInventory as nexusInventory,
} from './fixture-richese-normal-betrayal';

const wallets = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: ReturnType<typeof fixture>) {
  const receipt = f.game.pendingRicheseBetrayal!.receipt;
  assert.equal(receipt.invoice.source, 'normal'); assert.equal(receipt.invoice.kind, 'purchase');
  assert.equal(receipt.invoice.buyer, f.target); assert.equal(receipt.invoice.price, 3);
  assert.equal(receipt.invoice.card.id, f.card);
  assert.equal(f.game.auction!.bidder, f.target); assert.equal(f.game.auction!.cards[f.game.auction!.index].id, f.card);
  assert.equal(f.game.decision, null); assert.ok(!f.game.currentAuctionSale);
  assert.equal(player(f.game, f.holder).ally, null);
  assert.equal(f.game.nexusCards!.cards!.hands[f.holder], f.holderNexus);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.deepEqual(nexusInventory(f.game), f.originalNexusInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
  return receipt;
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`${mode} normal Richese-family self-purchase veto spends its actual Nexus and skips the unpaid card`, () => {
    const f = fixture({ advanced }), receipt = source(f), before = wallets(f.game), index = f.game.auction!.index;
    assert.equal(f.initialization.before.status, 'lobby'); assert.equal(f.afterSetup.status, 'playing');
    assert.equal(f.firstPurchase.before.richeseCache!.length, 9);
    assert.equal(f.afterFirstBidding.discard.filter(card => card.id === f.recycledCard).length, 1);
    assert.ok(f.firstPurchase.steps.some(step => step.actor === f.target && step.action.type === 'decision' &&
      step.action.karama === true && step.action.card === f.recycledCard));
    assert.equal(f.recycle.controlled, true); assert.equal(f.recycle.from, 'discard');
    assert.equal(f.beforeRecycle.pendingRicheseBetrayal, null); assert.ok(!f.beforeRecycle.auction);
    const done = finish(act(f.game, f.holder, f.useAction));
    assert.deepEqual(wallets(done), before);
    assert.equal(done.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.card), false);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'used');
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.event, receipt.event);
    assert.equal(done.richeseBetrayal!.current, null); assert.ok(!done.currentAuctionSale);
    assert.equal(done.auction!.index, index + 1);
    assert.ok(player(done, f.target).hand.some(card => card.id === f.karama));
    assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(nexusInventory(done), f.originalNexusInventory);
  });

  void test(`${mode} all normal acknowledgements keep the Nexus and restore the original spice-or-Karama payment choice`, () => {
    const f = fixture({ advanced }), before = wallets(f.game); source(f);
    const pending = pass(f.game);
    assert.equal(pending.decision?.kind, 'auctionPayment'); assert.equal(pending.decision?.player, f.target);
    assert.deepEqual(wallets(pending), before);
    assert.equal(pending.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.equal(player(pending, f.target).hand.some(card => card.id === f.card), false);
    const done = pay(pending, f);
    assert.equal(player(done, f.target).spice, before[f.target] - f.price);
    assert.equal(player(done, f.emperor).spice, before[f.emperor] + f.price);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.discard.some(card => card.id === f.card), false);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'passed');
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(nexusInventory(done), f.originalNexusInventory);
  });

  void test(`${mode} ordinary-face MISS spends the blind Nexus then preserves one native purchase and payment`, () => {
    const f = fixture({ advanced, richeseCard: false }), before = wallets(f.game); source(f);
    assert.equal(viewGame(f.game, f.holder).richeseBetrayalReaction!.canUse, true);
    const pending = act(f.game, f.holder, f.useAction);
    assert.equal(pending.decision?.kind, 'auctionPayment'); assert.deepEqual(wallets(pending), before);
    assert.equal(pending.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(player(pending, f.target).hand.some(card => card.id === f.card), false);
    const done = pay(pending, f);
    assert.equal(player(done, f.target).spice, before[f.target] - 3);
    assert.equal(player(done, f.emperor).spice, before[f.emperor] + 3);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.discard.some(card => card.id === f.card), false);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'used');
    assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(nexusInventory(done), f.originalNexusInventory);
  });

  void test(`${mode} normal all-pass without a retained Karama follows the native automatic spice payment`, () => {
    const f = fixture({ advanced, karama: false }), before = wallets(f.game); source(f);
    assert.equal(player(f.game, f.target).hand.some(card => card.effect === 'karama'), false);
    const done = finish(pass(f.game));
    assert.equal(done.decision, null);
    assert.equal(player(done, f.target).spice, before[f.target] - 3);
    assert.equal(player(done, f.emperor).spice, before[f.emperor] + 3);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.deepEqual(inventory(done), f.originalInventory);
  });

  void test(`${mode} original winning-bid Karama remains usable after the normal blind counter passes`, () => {
    const f = fixture({ advanced }), before = wallets(f.game); assert.ok(f.karama);
    const pending = pass(f.game); assert.equal(pending.decision?.kind, 'auctionPayment');
    const done = pay(pending, f, true);
    assert.deepEqual(wallets(done), before);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'passed');
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.deepEqual(inventory(done), f.originalInventory);
  });
}

void test('genuine Richese ally pledge remains unused on a normal veto and pays its original split after a MISS', () => {
  for (const family of [true, false]) {
    const f = fixture({ advanced: true, allyPayment: 2, richeseCard: family }), receipt = source(f); assert.ok(f.ally && f.funding);
    assert.equal(player(f.game, f.target).ally, f.ally); assert.equal(player(f.game, f.ally).ally, f.target);
    assert.deepEqual(f.funding.steps, [{ actor: f.ally, action: { type: 'pledgeAid', amount: 2 } }]);
    assert.equal(receipt.invoice.ownPayment, 1); assert.equal(receipt.invoice.allyPayment, 2);
    assert.equal(receipt.invoice.donor, f.ally);
    const before = wallets(f.game), credit = f.game.aid[f.ally].amount;
    const pending = act(f.game, f.holder, f.useAction), done = family ? finish(pending) : pay(pending, f);
    assert.equal(player(done, f.target).spice, before[f.target] - (family ? 0 : 1));
    assert.equal(player(done, f.ally).spice, before[f.ally]);
    assert.equal(player(done, f.emperor).spice, before[f.emperor] + (family ? 0 : 3));
    assert.equal(done.aid[f.ally].amount, credit - (family ? 0 : 2));
    assert.equal(player(done, f.target).hand.some(card => card.id === f.card), !family);
    assert.deepEqual(inventory(done), f.originalInventory); assert.deepEqual(nexusInventory(done), f.originalNexusInventory);
  }
});

void test('ordinary self-purchase acknowledgement is neutral for either card family and an irrelevant actually drawn Nexus', () => {
  const neutral: unknown[] = [];
  for (const family of [true, false]) for (const holderNexus of ['richese', 'guild'] as const) {
    const f = fixture({ richeseCard: family, holderNexus }); source(f);
    const reaction = viewGame(f.game, f.holder).richeseBetrayalReaction!;
    assert.equal(reaction.source, 'normal'); assert.equal(reaction.canPass, true); assert.equal(reaction.hasPassed, false);
    assert.equal(reaction.canUse, holderNexus === 'richese');
    assert.equal(Object.hasOwn(reaction, 'card'), false); assert.equal(Object.hasOwn(reaction, 'cardId'), false);
    assert.equal(reaction.event.includes(f.card), false);
    neutral.push({ kind: reaction.kind, target: reaction.target, buyer: reaction.buyer, source: reaction.source,
      price: reaction.price, canPass: reaction.canPass, hasPassed: reaction.hasPassed });
    const done = pay(pass(f.game), f); assert.equal(done.nexusCards!.cards!.hands[f.holder], holderNexus);
  }
  assert.ok(neutral.every(value => JSON.stringify(value) === JSON.stringify(neutral[0])));
});

void test('all four minimal policies make legal normal-counter choices for a Richese face and an ordinary MISS', () => {
  for (const family of [true, false]) {
    const f = fixture({ richeseCard: family });
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(f.game, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.ok(action.type === 'richeseBetrayalPass' || action.type === 'richeseBetrayalUse', difficulty);
      assert.equal(action.event, f.event);
      let game = act(f.game, f.holder, action);
      if (game.decision?.kind === 'auctionPayment') game = pay(game, f);
      else game = finish(game);
      assert.equal(game.nexusCards!.cards!.hands[f.holder], action.type === 'richeseBetrayalUse' ? null : 'richese');
      assert.deepEqual(inventory(game), f.originalInventory);
    }
  }
});

void test('a normal veto advances the real next lot without reopening its old acknowledgement or accepting stale use', () => {
  const f = fixture(), originalIndex = f.game.auction!.index;
  reject(f.game, f.target, f.useAction);
  reject(f.game, f.holder, { ...f.useAction, event: `${f.event}:stale` });
  let game = finish(act(f.game, f.holder, f.useAction));
  assert.equal(game.auction!.index, originalIndex + 1);
  const nextCard = game.auction!.cards[game.auction!.index].id;
  for (let count = 0; !game.decision && count < 16; count++) {
    assert.ok(game.auction); const actor = game.auction.active;
    game = act(game, actor, actor === f.target && game.auction.bidder !== f.target
      ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' });
    assert.equal(game.pendingRicheseBetrayal, null);
  }
  assert.equal(game.decision?.kind, 'auctionPayment');
  assert.equal(game.richeseBetrayal!.completed.filter(receipt => receipt.event === f.event).length, 1);
  reject(game, f.holder, f.useAction);
  game = pay(game, f);
  assert.equal(player(game, f.target).hand.filter(card => card.id === nextCard).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(nexusInventory(game), f.originalNexusInventory);
});
