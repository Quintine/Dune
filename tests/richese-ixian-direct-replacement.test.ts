import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createRicheseIxianDirectReplacementFixture, settleRicheseIxianDirectReplacementSuffix,
  type RicheseIxianDirectReplacementContext, type RicheseIxianDirectReplacementFixture,
} from './fixture-richese-ixian-direct-replacement';

const owner = (game: Game, id: string) => game.players.find(player => player.id === id)!;
const totalSpice = (game: Game) => game.players.reduce((sum, player) => sum + player.spice, 0);
const BUILT: Record<string, RicheseIxianDirectReplacementFixture> = {};
function fixture(context: RicheseIxianDirectReplacementContext, emperor = true) {
  const key = `${context}:${emperor}`;
  return BUILT[key] ??= createRicheseIxianDirectReplacementFixture({ context, emperor });
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function choose(f: RicheseIxianDirectReplacementFixture, use: boolean): Game {
  assert.ok(f.event);
  return applyAction(JSON.parse(JSON.stringify(f.game)) as Game, f.buyer,
    { type: use ? 'nexusIxianReplacementUse' : 'nexusIxianReplacementPass', event: f.event });
}
function assertPaidOffer(f: RicheseIxianDirectReplacementFixture) {
  const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
  assert.equal(offer.origin, 'richeseSpecial');
  assert.equal(offer.buyer, f.buyer);
  assert.equal(offer.canUse, true);
  assert.equal(offer.canPass, true);
  assert.deepEqual(offer.purchased, f.target);
  assert.equal(owner(f.game, f.buyer).spice, f.beforeSpice - 3);
  assert.equal(owner(f.game, f.buyer).specialKaramaUsed, true);
  assert.deepEqual(owner(f.game, f.buyer).hand,
    [...owner(f.beforePurchase, f.buyer).hand.filter(card => card.id !== f.cost.id), f.target]);
  assert.deepEqual(f.game.discard, [...f.beforePurchase.discard, f.cost]);
  assert.deepEqual(f.game.richeseCache,
    f.beforePurchase.richeseCache!.filter(card => card.id !== f.target.id));
  // This purchase has no auction: the unrelated physical row, sale and native
  // lot must survive untouched while the direct receipt takes source authority.
  assert.deepEqual(f.game.auction, f.beforePurchase.auction);
  assert.deepEqual(f.game.currentAuctionSale, f.beforePurchase.currentAuctionSale);
  assert.deepEqual(f.game.richeseAuction, f.beforePurchase.richeseAuction);
  assert.equal(f.game.pendingNexusIxianReplacement!.auctionIndex, 0);
  assert.equal(f.game.pendingNexusIxianReplacement!.amount, 3);
  assert.equal(f.game.pendingNexusIxianReplacement!.free, false);
  assert.deepEqual(f.game.pendingNexusIxianReplacement!.card, f.target);
  if (f.emperor) assert.equal(owner(f.game, f.emperor).spice, f.beforeEmperorSpice);
}
function assertDirectRetired(f: RicheseIxianDirectReplacementFixture, game: Game, use: boolean) {
  const receipts = game.nexusIxianReplacementHistory!.filter(receipt => receipt.source.event === f.event);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].outcome, use ? 'use' : 'pass');
  assert.deepEqual(receipts[0].source.card, f.target);
  assert.deepEqual(receipts[0].replacement, use ? f.nextCard : null);
  assert.equal(game.pendingNexusIxianSpecialPurchase ?? null, null);
  assert.equal(game.pendingRichesePurchaseIncome ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.cost.id).length, 1);
  assert.equal(owner(game, f.buyer).specialKaramaUsed, true);
  assert.equal(game.richeseCache!.some(card => card.id === f.target.id), false);
  reject(game, f.buyer, f.action);
  reject(game, f.buyer, { type: 'nexusIxianReplacementUse', event: f.event! });
  reject(game, f.buyer, { type: 'nexusIxianReplacementPass', event: f.event! });
}

for (const emperor of [true, false])
for (const use of [true, false])
void test(`native direct ${use ? 'Use' : 'Keep'} with ${emperor ? 'Emperor' : 'bank'} payment restores the exact quiet ordinary row`, () => {
  const f = fixture('quiet', emperor);
  assertPaidOffer(f);
  const done = settleRicheseIxianDirectReplacementSuffix(choose(f, use));
  assert.deepEqual(owner(done, f.buyer).hand,
    [...owner(f.game, f.buyer).hand.filter(card => !use || card.id !== f.target.id),
      ...(use ? [f.nextCard] : [])]);
  assert.deepEqual(done.deck, use ? f.game.deck.slice(1) : f.game.deck);
  assert.deepEqual(done.discard, use ? [...f.game.discard, f.target] : f.game.discard);
  assert.equal(done.nexusCards!.cards!.hands[f.buyer], use ? null : 'ixians');
  assert.deepEqual(done.nexusCards!.cards!.discard,
    [...f.game.nexusCards!.cards!.discard, ...(use ? ['ixians'] : [])]);
  assert.equal(owner(done, f.buyer).spice, f.paidSpice);
  if (f.emperor) assert.equal(owner(done, f.emperor).spice, f.beforeEmperorSpice! + 3);
  else for (const seat of done.players.filter(player => player.id !== f.buyer))
    assert.equal(seat.spice, owner(f.beforePurchase, seat.id).spice);
  assert.equal(totalSpice(done), totalSpice(f.beforePurchase) - (emperor ? 0 : 3));
  assert.equal(done.active, f.originalControls.active);
  assert.deepEqual(done.response, f.originalControls.response);
  assert.deepEqual(done.decision, f.originalControls.decision);
  assert.deepEqual(done.pendingKarama ?? null, f.originalControls.pendingKarama ?? null);
  assert.deepEqual(done.auction, f.beforePurchase.auction);
  assert.deepEqual(done.richeseBidding, f.beforePurchase.richeseBidding);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.pendingNexusIxianReplacement, null);
  assertDirectRetired(f, done, use);
});

for (const use of [true, false])
void test(`direct ${use ? 'Use' : 'Keep'} preserves the reserved original bid and lets its only funded payment complete once`, () => {
  const f = fixture('auctionPayment');
  assertPaidOffer(f);
  assert.deepEqual(f.funding, { wallet: 5, reservedNormalBid: 2, uncommitted: 3 });
  assert.deepEqual(f.beforePurchase.decision, { kind: 'auctionPayment', player: f.buyer });
  assert.equal(f.game.pendingNexusIxianSpecialPurchase!.resume.response?.kind, 'richesePurchaseIncome');
  assert.deepEqual(f.game.pendingRichesePurchaseIncome!.resume.decision, f.originalControls.decision);
  const chosen = choose(f, use);
  // Spending the starting Karama removes the alternative original payment
  // method. Automatic bid-2 payment is completion, not a missing decision.
  // With Keep the still-held Nexus can therefore open a NEW normal offer.
  if (!use) {
    const source = chosen.pendingNexusIxianReplacement;
    assert.ok(source, 'Original automatic payment should open its own normal purchased-card choice.');
    assert.notEqual(source.event, f.event);
    assert.equal(viewGame(chosen, f.buyer).nexusIxianReplacement!.origin, 'normal');
    assert.equal(source.amount, 2);
    assert.equal(source.card.id, f.base.purchased.id);
  }
  const done = settleRicheseIxianDirectReplacementSuffix(chosen);
  assert.equal(owner(done, f.buyer).spice, f.beforeSpice - 3 - 2);
  assert.equal(owner(done, f.emperor!).spice, f.beforeEmperorSpice! + 3 + 2);
  assert.deepEqual(owner(done, f.buyer).hand,
    [...owner(f.beforePurchase, f.buyer).hand.filter(card => card.id !== f.cost.id),
      use ? f.nextCard : f.target, f.base.purchased]);
  assert.deepEqual(done.deck, use ? f.game.deck.slice(1) : f.game.deck);
  assert.equal(done.nexusCards!.cards!.hands[f.buyer], use ? null : 'ixians');
  assert.equal(done.auction!.index, f.beforePurchase.auction!.index + 1);
  assert.deepEqual(done.auction!.cards, f.beforePurchase.auction!.cards);
  assert.equal(done.auction!.bid, 0);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.pendingNexusIxianReplacement, null);
  const newReceipts = done.nexusIxianReplacementHistory!.slice(f.beforePurchase.nexusIxianReplacementHistory!.length);
  assert.equal(newReceipts.length, use ? 1 : 2);
  if (!use) {
    assert.equal(newReceipts[1].source.card.id, f.base.purchased.id);
    assert.equal(newReceipts[1].source.amount, 2);
    assert.equal(newReceipts[1].outcome, 'pass');
  }
  assertDirectRetired(f, done, use);
});

for (const use of [true, false])
void test(`direct ${use ? 'Use' : 'Keep'} inside original Emperor income preserves both credits and advances its row once`, () => {
  const f = fixture('income');
  assertPaidOffer(f);
  assert.equal(f.beforePurchase.response!.kind, 'emperorIncome');
  assert.equal(f.beforePurchase.currentAuctionSale!.amount, 2);
  assert.equal(f.beforeSpice, 3);
  assert.deepEqual(f.game.pendingRichesePurchaseIncome!.resume.response, f.originalControls.response);
  assert.deepEqual(f.game.pendingRichesePurchaseIncome!.resume.decision, f.originalControls.decision);
  assert.equal(f.game.pendingNexusIxianSpecialPurchase!.resume.response?.amount, 3);
  const done = settleRicheseIxianDirectReplacementSuffix(choose(f, use));
  assert.equal(owner(done, f.buyer).spice, f.beforeSpice - 3);
  assert.equal(owner(done, f.emperor!).spice, f.beforeEmperorSpice! + 3 + 2);
  assert.deepEqual(owner(done, f.buyer).hand,
    [...owner(f.beforePurchase, f.buyer).hand.filter(card => card.id !== f.cost.id),
      use ? f.nextCard : f.target]);
  assert.ok(owner(done, f.buyer).hand.some(card => card.id === f.base.purchased.id),
    'The older normal purchase is not the direct replacement target.');
  assert.equal(done.auction!.index, f.beforePurchase.auction!.index + 1);
  assert.deepEqual(done.auction!.cards, f.beforePurchase.auction!.cards);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.response, null);
  assert.equal(done.pendingNexusIxianReplacement, null);
  assert.equal(done.nexusIxianReplacementHistory!.length,
    f.beforePurchase.nexusIxianReplacementHistory!.length + 1);
  assert.equal(done.nexusCards!.cards!.hands[f.buyer], use ? null : 'ixians');
  assertDirectRetired(f, done, use);
  reject(done, f.buyer, { type: 'nexusIxianReplacementPass', event: f.base.event });
});

for (const emperor of [true, false])
void test(`native Revival special purchase remains legal without a Bidding Nexus offer (${emperor ? 'Emperor' : 'bank'})`, () => {
  const f = fixture('revival', emperor);
  assert.equal(f.beforePurchase.phase, 4);
  assert.equal(f.beforePurchase.richeseBidding!.stage, 'complete');
  assert.equal(f.beforePurchase.auction, null);
  assert.equal(f.beforePurchase.richeseAuction, null);
  assert.equal(f.event, null);
  assert.equal(viewGame(f.game, f.buyer).nexusIxianReplacement, null);
  assert.equal(f.game.pendingNexusIxianSpecialPurchase ?? null, null);
  assert.equal(f.game.pendingNexusIxianReplacement, null);
  assert.deepEqual(f.game.nexusIxianReplacementHistory, f.beforePurchase.nexusIxianReplacementHistory);
  assert.equal(f.game.nexusCards!.cards!.hands[f.buyer], 'ixians');
  assert.deepEqual(f.game.deck, f.beforePurchase.deck);
  assert.deepEqual(owner(f.game, f.buyer).hand,
    [...owner(f.beforePurchase, f.buyer).hand.filter(card => card.id !== f.cost.id), f.target]);
  assert.deepEqual(f.game.discard, [...f.beforePurchase.discard, f.cost]);
  assert.equal(owner(f.game, f.buyer).spice, f.beforeSpice - 3);
  assert.equal(owner(f.game, f.buyer).specialKaramaUsed, true);
  if (f.emperor) assert.equal(owner(f.game, f.emperor).spice, f.beforeEmperorSpice! + 3);
  assert.equal(totalSpice(f.game), totalSpice(f.beforePurchase) - (emperor ? 0 : 3));
  assert.equal(f.game.pendingRichesePurchaseIncome ?? null, null);
  assert.equal(f.game.active, f.originalControls.active);
  assert.deepEqual(f.game.response, f.originalControls.response);
  assert.deepEqual(f.game.decision, f.originalControls.decision);
  reject(f.game, f.buyer, f.action);
});
