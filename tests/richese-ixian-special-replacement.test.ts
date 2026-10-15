import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  createRicheseIxianSpecialReplacementFixture, settleRicheseIxianSpecialReplacementSuffix,
  type RicheseIxianSpecialReplacementOrigin, type RicheseIxianSpecialReplacementSaleFixture,
  type RicheseIxianSpecialReplacementUnbidFixture,
} from './fixture-richese-ixian-special-replacement';

const owner = (game: Game, id: string) => game.players.find(player => player.id === id)!;

const BUILT: Record<string, RicheseIxianSpecialReplacementSaleFixture> = {};
/** One genuine native run per source/mode; each test reloads its own copy. */
function saleFixture(
  origin: RicheseIxianSpecialReplacementOrigin,
  advanced: boolean,
): RicheseIxianSpecialReplacementSaleFixture {
  const key = `${origin}:${advanced}`;
  const held = BUILT[key];
  if (held) return held;
  const created = createRicheseIxianSpecialReplacementFixture({ origin, advanced });
  if (created.mode !== 'sold') throw new Error('The paid native source sale is missing.');
  BUILT[key] = created;
  return created;
}

const UNBID: Partial<Record<RicheseIxianSpecialReplacementOrigin, RicheseIxianSpecialReplacementUnbidFixture>> = {};
function unbidFixture(origin: RicheseIxianSpecialReplacementOrigin): RicheseIxianSpecialReplacementUnbidFixture {
  const held = UNBID[origin];
  if (held) return held;
  const created = createRicheseIxianSpecialReplacementFixture({ origin, mode: 'unbid' });
  if (created.mode !== 'unbid') throw new Error('The genuine unbid outcome is missing.');
  UNBID[origin] = created;
  return created;
}

const SOURCES: [RicheseIxianSpecialReplacementOrigin, boolean][] = [
  ['cache', false], ['cache', true], ['blackMarket', true],
];

for (const [origin, advanced] of SOURCES)
  void test(`${advanced ? 'Advanced' : 'Basic'} native ${origin} Once Around purchase is already paid when its purchased-card offer opens`, () => {
    const f = saleFixture(origin, advanced);
    // The public offer binds the exact concealed/delivered native card, never a
    // top deck card and never an unsold lot card.
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    assert.equal(offer.origin, origin);
    assert.equal(offer.canPass, true);
    assert.equal(offer.canUse, true);
    assert.deepEqual(offer.purchased, f.purchased);
    // The genuine payment is already debited exactly once; the seller is not yet
    // credited and no Emperor gift exists for this unallied native sale.
    assert.equal(owner(f.game, f.buyer).spice, f.beforeSpice - f.bid);
    assert.equal(owner(f.game, f.seller).spice, owner(f.beforePurchase, f.seller).spice);
    assert.equal(owner(f.game, f.emperor!).spice, owner(f.beforePurchase, f.emperor!).spice);
    assert.equal(f.game.nexusCards!.cards!.hands[f.buyer], 'ixians');
    assert.deepEqual(owner(f.game, f.buyer).hand,
      [...owner(f.beforePurchase, f.buyer).hand, f.purchased]);
    if (origin === 'cache') {
      assert.deepEqual(f.game.richeseCache,
        f.cacheBefore.filter(card => card.id !== f.purchased.id));
      assert.equal(owner(f.beforePurchase, f.seller).hand.some(card => card.id === f.purchased.id), false);
    } else {
      assert.deepEqual(f.game.richeseCache, f.cacheBefore,
        'A Black Market sale never touches the compulsory cache.');
      assert.equal(owner(f.beforePurchase, f.seller).hand.some(card => card.id === f.purchased.id), true);
      assert.equal(owner(f.game, f.seller).hand.some(card => card.id === f.purchased.id), false);
    }
  });

for (const [origin, advanced] of SOURCES)
  void test(`${advanced ? 'Advanced' : 'Basic'} native ${origin} Use spends the Ixian Nexus on that card and leaves the original native suffix intact`, () => {
    const f = saleFixture(origin, advanced);
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    const used = settleRicheseIxianSpecialReplacementSuffix(applyAction(structuredClone(f.game), f.buyer,
      { type: 'nexusIxianReplacementUse', event: offer.event }), origin);
    // Only the purchased native card is discarded and only the actual top card
    // is drawn; the paid purchase is never re-debited or credited.
    assert.deepEqual(owner(used, f.buyer).hand,
      [...owner(f.game, f.buyer).hand.filter(card => card.id !== f.purchased.id), f.nextCard]);
    assert.deepEqual(used.discard, [...f.game.discard, f.purchased]);
    assert.deepEqual(used.deck, f.game.deck.slice(1));
    assert.equal(used.nexusCards!.cards!.hands[f.buyer], null);
    assert.deepEqual(used.nexusCards!.cards!.discard,
      [...f.game.nexusCards!.cards!.discard, 'ixians']);
    assert.equal(owner(used, f.buyer).spice, f.paidSpice);
    assert.equal(owner(used, f.seller).spice, f.sellerSpiceAtOffer + f.bid);
    assert.equal(owner(used, f.emperor!).spice, f.emperorSpiceAtOffer);
    assert.equal(used.pendingNexusIxianReplacement, null);
    assert.equal(used.currentAuctionSale, null);
    assert.equal(used.richeseAuction, null);
    assert.equal(used.richeseBidding!.blackMarketSold, origin === 'blackMarket');
    if (origin === 'cache') {
      assert.deepEqual(used.richeseCache, f.game.richeseCache);
      assert.equal(used.richeseBidding!.stage, 'complete');
      assert.equal(used.decision, null);
      assert.equal(used.phase, 4);
    } else {
      assert.deepEqual(used.richeseCache, f.cacheBefore);
      assert.equal(used.richeseBidding!.stage, 'declaration');
      assert.deepEqual(used.decision, { kind: 'richeseDeclaration', player: f.seller });
    }
  });

for (const [origin, advanced] of SOURCES)
  void test(`${advanced ? 'Advanced' : 'Basic'} native ${origin} Keep retains the exact purchased card and the Ixian Nexus while the original seller is credited once`, () => {
    const f = saleFixture(origin, advanced);
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    const kept = settleRicheseIxianSpecialReplacementSuffix(applyAction(structuredClone(f.game), f.buyer,
      { type: 'nexusIxianReplacementPass', event: offer.event }), origin);
    assert.deepEqual(owner(kept, f.buyer).hand, owner(f.game, f.buyer).hand);
    assert.ok(owner(kept, f.buyer).hand.some(card => card.id === f.purchased.id));
    assert.deepEqual(kept.deck, f.game.deck);
    assert.deepEqual(kept.discard, f.game.discard);
    assert.deepEqual(kept.nexusCards!.cards!.hands[f.buyer], f.game.nexusCards!.cards!.hands[f.buyer]);
    assert.equal(kept.nexusCards!.cards!.hands[f.buyer], 'ixians');
    assert.equal(owner(kept, f.buyer).spice, f.paidSpice);
    assert.equal(owner(kept, f.seller).spice, f.sellerSpiceAtOffer + f.bid);
    assert.equal(owner(kept, f.emperor!).spice, f.emperorSpiceAtOffer);
    assert.equal(kept.pendingNexusIxianReplacement, null);
    assert.equal(kept.currentAuctionSale, null);
    assert.equal(kept.richeseAuction, null);
    assert.deepEqual(kept.richeseCache,
      origin === 'cache' ? f.game.richeseCache : f.cacheBefore);
    if (origin === 'cache') {
      assert.equal(kept.richeseBidding!.stage, 'complete');
      assert.equal(kept.decision, null);
      assert.equal(kept.phase, 4);
      assert.equal(kept.richeseBidding!.blackMarketSold, false);
    } else {
      assert.equal(kept.richeseBidding!.stage, 'declaration');
      assert.deepEqual(kept.decision, { kind: 'richeseDeclaration', player: f.seller });
      assert.equal(kept.richeseBidding!.blackMarketSold, true);
    }
  });

void test('Basic native unbid cache lot is not a purchase: the owner keeps the card with no spice, Nexus spend or offer', () => {
  const f = unbidFixture('cache');
  // The compulsory cache lot really ran its own Once Around and every genuine
  // offer was zero, so the lot retired without a sale.
  assert.equal(f.game.richeseAuction, null);
  assert.equal(f.game.pendingNexusIxianReplacement, null);
  assert.notEqual(f.game.decision?.kind, 'nexusIxianReplacement');
  assert.equal(f.game.currentAuctionSale, null);
  assert.equal(f.game.richeseBidding!.stage, 'complete');
  assert.equal(f.game.richeseBidding!.blackMarketSold, false);
  // A Keep is not a purchase: no spice moved anywhere and no Emperor gift exists.
  for (const seat of f.game.players)
    assert.equal(owner(f.game, seat.id).spice, owner(f.beforeFinalAction, seat.id).spice);
  assert.equal(f.game.nexusCards!.cards!.hands[f.buyer], 'ixians');
  // The kept card left the original cache into the owner's own hand.
  assert.equal(f.game.richeseCache!.some(card => card.id === f.card.id), false);
  assert.equal(owner(f.game, f.seller).hand.some(card => card.id === f.card.id), true);
  assert.equal((f.game.richeseRemoved ?? []).some(card => card.id === f.card.id), false);
  assert.deepEqual(f.game.richeseCache, f.cacheBefore.filter(card => card.id !== f.card.id));
});

void test('Advanced native unbid Black Market lot retains its concealed card with no sale, payment or offer', () => {
  const f = unbidFixture('blackMarket');
  assert.equal(f.game.richeseAuction, null);
  assert.equal(f.game.pendingNexusIxianReplacement, null);
  assert.equal(f.game.currentAuctionSale, null);
  assert.equal(f.game.richeseBidding!.blackMarketSold, false);
  assert.equal(f.game.richeseBidding!.stage, 'declaration');
  assert.deepEqual(f.game.decision, { kind: 'richeseDeclaration', player: f.seller });
  for (const seat of f.game.players)
    assert.equal(owner(f.game, seat.id).spice, owner(f.beforeFinalAction, seat.id).spice);
  assert.equal(f.game.nexusCards!.cards!.hands[f.buyer], 'ixians');
  assert.ok(owner(f.game, f.seller).hand.some(card => card.id === f.card.id));
  assert.ok(f.keptCacheCards.includes(f.card.id));
  assert.deepEqual(f.game.richeseCache, f.cacheBefore,
    'An unbid Black Market lot must not consume a compulsory cache card.');
});

