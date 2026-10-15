import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';
import {
  createRicheseIxianReplacementFixture, nextRicheseIxianReplacementNativeStep,
  type RicheseIxianReplacementFixture,
} from './fixture-richese-ixian-replacement';

const owner = (game: Game, id: string) => game.players.find(player => player.id === id)!;
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, id: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, id, action));
  assert.deepEqual(game, before);
}

const BUILT: Record<string, RicheseIxianReplacementFixture> = {};
/** One genuine native Richese run per roster/mode; each test reloads its own copy. */
function fixtureFor(
  advanced: boolean,
  buyerFaction: 'atreides' | 'richese',
  endingAuction = false,
): RicheseIxianReplacementFixture {
  const key = `${advanced}:${buyerFaction}:${endingAuction}`;
  const held = BUILT[key];
  if (held) return held;
  const created = createRicheseIxianReplacementFixture({ advanced, buyerFaction, endingAuction });
  BUILT[key] = created;
  return created;
}

for (const advanced of [false, true])
for (const buyerFaction of ['atreides', 'richese'] as const)
  void test(`${advanced ? 'Advanced' : 'Basic'} native ${buyerFaction} normal CHOAM purchase spends the Nexus for the real top replacement`, () => {
    const f = fixtureFor(advanced, buyerFaction);
    assert.equal(f.purchased.id, 'ix-poison-tooth');
    assert.equal(f.nextCard.id, 'ix-artillery');
    assert.equal(f.rowSize, 2);
    // The cache stayed its own original collection: only the one genuine Once
    // Around keep left it, and the normal purchase itself never touched it.
    assert.equal(f.keptCacheCards.length, 1);
    assert.ok(f.setup.richeseCache!.some(card => card.id === f.keptCacheCards[0]));
    assert.equal(f.cacheAtPurchase.length, richeseCards().length - 1);
    assert.equal(f.beforePayment.currentAuctionSale, null);
    assert.equal(f.beforePayment.auction!.cards[f.auctionIndex].id, f.purchased.id);
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    assert.equal(offer.canUse, true);
    assert.equal(offer.canPass, true);
    assert.deepEqual(offer.purchased, f.purchased);
    assert.equal(owner(f.game, f.buyer).spice, f.beforeSpice - 2);
    assert.equal(owner(f.game, f.emperor!).spice, f.beforeEmperorSpice);
    const partners = f.beforeNexusDraw.players.filter(player => player.id !== f.buyer);
    for (const partner of partners)
      for (const type of ['nexusIxianReplacementUse', 'nexusIxianReplacementPass'] as const)
        reject(f.game, partner.id, { type, event: offer.event });

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
    assert.deepEqual(use.richeseCache, f.cacheAtPurchase);
    assert.equal(use.richeseBidding!.stage, 'normal');
    assert.equal(use.auction!.index, f.auctionIndex + 1);
    assert.deepEqual(use.auction!.cards.slice(use.auction!.index), unsold);
    reject(use, f.buyer, { type: 'nexusIxianReplacementUse', event: f.event });
  });

for (const advanced of [false, true])
for (const buyerFaction of ['atreides', 'richese'] as const)
  void test(`${advanced ? 'Advanced' : 'Basic'} native ${buyerFaction} normal CHOAM purchase retains its card and Nexus card`, () => {
    const f = fixtureFor(advanced, buyerFaction);
    const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
    const pass = settleIxianReplacementFixture(applyAction(reload(f.game), f.buyer,
      { type: 'nexusIxianReplacementPass', event: offer.event }));
    assert.deepEqual(owner(pass, f.buyer).hand, owner(f.game, f.buyer).hand);
    assert.ok(owner(pass, f.buyer).hand.some(card => card.id === f.purchased.id));
    assert.deepEqual(pass.deck, f.game.deck);
    assert.deepEqual(pass.discard, f.game.discard);
    assert.deepEqual(pass.nexusCards!.cards, f.game.nexusCards!.cards);
    assert.equal(pass.nexusCards!.cards!.hands[f.buyer], 'ixians');
    assert.equal(owner(pass, f.buyer).spice, f.paidSpice);
    assert.equal(owner(pass, f.emperor!).spice, f.beforeEmperorSpice! + 2);
    assert.equal(pass.currentAuctionSale, null);
    assert.equal(pass.pendingNexusIxianReplacement, null);
    assert.deepEqual(pass.richeseCache, f.cacheAtPurchase);
    assert.equal(pass.auction!.index, f.auctionIndex + 1);
  });

for (const advanced of [false, true])
void test(`${advanced ? 'Advanced' : 'Basic'} native final-lot CHOAM purchase closes the pool into the untouched Richese cache offer`, () => {
  const f = fixtureFor(advanced, 'atreides', true);
  assert.equal(f.auctionIndex, f.rowSize - 1);
  assert.equal(f.purchased.id, 'ix-poison-tooth');
  assert.equal(f.nextCard.id, 'ix-artillery');
  const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
  assert.deepEqual(offer.purchased, f.purchased);
  const richese = f.game.players.find(player => player.faction === 'richese')!.id;
  const use = settleIxianReplacementFixture(applyAction(reload(f.game), f.buyer,
    { type: 'nexusIxianReplacementUse', event: offer.event }));
  assert.deepEqual(owner(use, f.buyer).hand, [...owner(f.beforePayment, f.buyer).hand, f.nextCard]);
  assert.deepEqual(use.discard, [...f.game.discard, f.purchased]);
  assert.equal(owner(use, f.buyer).spice, f.paidSpice);
  assert.equal(owner(use, f.emperor!).spice, f.beforeEmperorSpice! + 2);
  assert.equal(use.auction, null);
  assert.deepEqual(use.decision, { kind: 'richeseCache', player: richese });
  assert.equal(use.richeseBidding!.stage, 'cacheOffer');
  assert.equal(use.richeseBidding!.cacheCanceled, false);
  assert.deepEqual(use.richeseCache, f.cacheAtPurchase);
  assert.equal(use.pendingNexusIxianReplacement, null);
  assert.equal(use.nexusCards!.cards!.hands[f.buyer], null);
});

for (const advanced of [false, true])
void test(`${advanced ? 'Advanced' : 'Basic'} Richese cache lot keeps the Nexus replacement gated to normal purchases`, () => {
  const f = fixtureFor(advanced, 'atreides', true);
  const offer = viewGame(f.game, f.buyer).nexusIxianReplacement!;
  const richese = f.game.players.find(player => player.faction === 'richese')!.id;
  // Keep the purchased card and the unallied Nexus card, so the buyer is still
  // an eligible Nexus holder when the round reaches its own compulsory cache lot.
  let game = settleIxianReplacementFixture(applyAction(reload(f.game), f.buyer,
    { type: 'nexusIxianReplacementPass', event: offer.event }));
  assert.equal(game.nexusCards!.cards!.hands[f.buyer], 'ixians');
  assert.equal(game.auction, null);
  assert.equal(game.richeseBidding!.stage, 'cacheOffer');
  assert.deepEqual(game.decision, { kind: 'richeseCache', player: richese });
  assert.equal(game.pendingNexusIxianReplacement, null);
  const cacheCard = game.richeseCache![0];
  const before = { buyer: owner(game, f.buyer).spice, richese: owner(game, richese).spice,
    emperor: owner(game, f.emperor!).spice };
  game = applyAction(game, richese, { type: 'decision', event: game.richeseBidding!.event,
    card: cacheCard.id, method: 'onceAround', direction: 'clockwise' });
  assert.equal(game.richeseAuction?.source, 'cache');
  assert.equal(game.richeseAuction?.cardId, cacheCard.id);
  assert.equal(game.richeseAuction?.owner, richese);
  // A real Once Around: the native policy declines for every other seat, the
  // unallied Nexus holder buys the cache card with its own spice.
  for (let count = 0; game.richeseAuction && !game.richeseAuction.outcome && count < 20; count++) {
    const lot: NonNullable<Game['richeseAuction']> = game.richeseAuction;
    const next = nextRicheseIxianReplacementNativeStep(game);
    assert.equal(next.actor, lot.active);
    assert.equal(game.pendingNexusIxianReplacement, null);
    game = next.actor === f.buyer
      ? applyAction(game, f.buyer, { type: 'richeseBid', event: lot.event,
        amount: lot.bid === 0 ? 1 : null })
      : applyAction(game, next.actor, next.action);
  }
  // The cache purchase retires its own lot with no replacement frame, while the
  // same buyer's normal purchase above did open one.
  assert.equal(game.richeseAuction, null);
  assert.equal(game.pendingNexusIxianReplacement, null);
  assert.equal(game.decision, null);
  assert.equal(game.currentAuctionSale, null);
  assert.ok(owner(game, f.buyer).hand.some(card => card.id === cacheCard.id));
  assert.ok(!game.richeseCache!.some(card => card.id === cacheCard.id));
  assert.equal(owner(game, f.buyer).spice, before.buyer - 1);
  assert.equal(owner(game, richese).spice, before.richese + 1);
  assert.equal(owner(game, f.emperor!).spice, before.emperor);
  assert.equal(game.nexusCards!.cards!.hands[f.buyer], 'ixians');
  assert.equal(game.richeseBidding!.stage, 'complete');
  assert.equal(game.phase, 4);
});
