import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  createIxianReplacementSource, IxianReplacementError,
  type IxianReplacementContext,
} from '../game/nexus-ixian-replacement';
import {
  assertNativeIxianReplacementInventory, createNativeIxianReplacementFixture,
} from './fixture-native-ixian-replacement';
import { settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

const owner = (game: Game, id: string) => game.players.find(player => player.id === id)!;
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, id: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, id, action));
  assert.deepEqual(game, before);
}

for (const buyerFaction of ['atreides', 'tleilaxu'] as const)
  void test(`Basic native ${buyerFaction} paid Ix special replacement preserves its purchase and settles the real suffix once`, () => {
    const endingAuction = buyerFaction === 'tleilaxu';
    const f = createNativeIxianReplacementFixture({ buyerFaction, endingAuction });
    assert.equal(f.beforeNexusDraw.nexusCards!.cards!.hands[f.buyer], null);
    assert.equal(owner(f.beforeNexusDraw, f.buyer).ally, null);
    const partners = f.beforeNexusDraw.players.filter(player => player.id !== f.buyer);
    assert.equal(partners[0].ally, partners[1].id);
    assert.equal(partners[1].ally, partners[0].id);
    assert.equal(applyAction(reload(f.beforeNexusDraw), f.buyer, f.nexusDrawAction).nexusCards!.cards!.hands[f.buyer], 'ixians');
    assert.equal(f.purchased.id, 'ix-thumper');
    assert.equal(f.nextCard.id, 'ix-amal');
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    assert.equal(offer.canUse, true);
    assert.equal(offer.canPass, true);
    assert.deepEqual(offer.purchased, f.purchased);
    assert.equal(owner(f.game, f.buyer).spice, f.beforeSpice - 2);
    assert.equal(owner(f.game, f.emperor!).spice, f.beforeEmperorSpice);
    const deckBefore = structuredClone(f.game.deck);
    const unsold = structuredClone(f.game.auction!.cards.slice(f.auctionIndex + 1));
    const use = settleIxianReplacementFixture(applyAction(reload(f.game), f.buyer,
      { type: 'nexusIxianReplacementUse', event: offer.event }));
    assert.deepEqual(owner(use, f.buyer).hand, [...owner(f.beforePayment, f.buyer).hand, f.nextCard]);
    assert.deepEqual(use.deck, deckBefore.slice(1));
    assert.deepEqual(use.discard, [...f.game.discard, f.purchased]);
    assert.equal(use.nexusCards!.cards!.hands[f.buyer], null);
    assert.deepEqual(use.nexusCards!.cards!.discard, [...f.game.nexusCards!.cards!.discard, 'ixians']);
    assert.equal(owner(use, f.buyer).spice, f.paidSpice);
    assert.equal(owner(use, f.emperor!).spice, f.beforeEmperorSpice! + 2);
    assert.equal(use.currentAuctionSale, null);
    assert.equal(use.pendingNexusIxianReplacement, null);
    if (endingAuction) {
      assert.equal(use.auction, null);
      assert.equal(use.phase, 4);
    } else {
      assert.equal(use.auction!.index, f.auctionIndex + 1);
      assert.deepEqual(use.auction!.cards.slice(use.auction!.index), unsold);
    }
    reject(use, f.buyer, { type: 'nexusIxianReplacementUse', event: f.event });
    reject(use, f.buyer, { type: 'nexusIxianReplacementPass', event: f.event });
  });

void test('native Pass keeps the purchased Ix special and genuinely acquired Nexus without a draw or repayment', () => {
  const f = createNativeIxianReplacementFixture();
  const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
  const pass = settleIxianReplacementFixture(applyAction(reload(f.game), f.buyer,
    { type: 'nexusIxianReplacementPass', event: offer.event }));
  assert.deepEqual(owner(pass, f.buyer).hand, owner(f.game, f.buyer).hand);
  assert.deepEqual(pass.deck, f.game.deck);
  assert.deepEqual(pass.discard, f.game.discard);
  assert.deepEqual(pass.nexusCards!.cards, f.game.nexusCards!.cards);
  assert.equal(owner(pass, f.buyer).spice, f.paidSpice);
  assert.equal(owner(pass, f.emperor!).spice, f.beforeEmperorSpice! + 2);
  assert.equal(pass.auction!.index, f.auctionIndex + 1);
  assert.equal(pass.currentAuctionSale, null);
  assertNativeIxianReplacementInventory(pass);
  reject(pass, f.buyer, { type: 'nexusIxianReplacementUse', event: f.event });
});

void test('native descriptor admission rejects forged Ix effects and unrelated Richese faces even with matching row and hand', () => {
  const f = createNativeIxianReplacementFixture();
  const source = f.game.pendingNexusIxianReplacement!;
  for (const corrupt of [
    { ...f.purchased, effect: 'amal' },
    { ...f.purchased, name: 'Amal' },
    { ...f.purchased, kind: 'worthless' },
    { ...f.purchased, extra: true },
    richeseCards()[0],
  ] as Card[]) {
    const ctx: IxianReplacementContext = {
      status: f.game.status, phase: f.game.phase, turn: f.game.turn, sequence: source.sequence,
      auction: { ...f.game.auction!, cards: f.game.auction!.cards.map((card, index) =>
        index === f.auctionIndex ? corrupt : card) },
      sale: f.game.currentAuctionSale!,
      players: f.game.players.map(player => ({
        id: player.id, handLimit: 4,
        hand: player.hand.map(card => card.id === f.purchased.id ? corrupt : card),
      })),
      physicalCards: [
        ...f.game.players.flatMap(player => player.hand), ...f.game.deck, ...f.game.discard,
        ...f.game.auction!.cards.slice(f.auctionIndex + 1),
      ].map(card => card.id === f.purchased.id ? corrupt : card),
    };
    assert.throws(() => createIxianReplacementSource(ctx, source.event, source.parent), IxianReplacementError);
  }
  const parent = reload(f.beforePayment);
  parent.auction!.cards[parent.auction!.index].effect = 'amal';
  reject(parent, f.buyer, f.paymentAction);
});
