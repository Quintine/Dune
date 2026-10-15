import assert from 'node:assert/strict';
import { applyAction, handLimit, type Action, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import type { RicheseAuction } from '../game/richese-auction';
import { settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';
import {
  createRicheseIxianReplacementFixture, nextRicheseIxianReplacementNativeStep,
  type RicheseIxianReplacementStep,
} from './fixture-richese-ixian-replacement';

/** The two native Richese sources a genuine purchased-card replacement may bind:
 * the compulsory cache lot and the owner's own Black Market lot. */
export type RicheseIxianSpecialReplacementOrigin = 'cache' | 'blackMarket';
/** A real positive Once Around sale or the genuine zero-bid outcome. */
export type RicheseIxianSpecialReplacementMode = 'sold' | 'unbid';
/** The engine's own native lot facts, as bound by the live game. */
export type RicheseIxianSpecialReplacementLot =
  Pick<RicheseAuction, 'event' | 'cardId' | 'source' | 'owner' | 'outcome'>;

export type RicheseIxianSpecialReplacementOptions = {
  /** Continue only a fresh authenticated undealt Richese/CHOAM lobby or its admitted setup. */
  initial?: Game;
  /** Native profile mode. The Black Market offer exists only in Advanced. */
  advanced?: boolean;
  /** Native source of the genuine purchase. Defaults to the compulsory cache lot. */
  origin?: RicheseIxianSpecialReplacementOrigin;
  /** Real positive Once Around sale (default) or the genuine zero-bid outcome. */
  mode?: RicheseIxianSpecialReplacementMode;
  /** Shared CHOAM addition bought as the ordinary normal lot before the source lot. */
  purchasedId?: string;
  /** Original shared CHOAM addition left as the actual top card after that normal purchase. */
  replacementId?: string;
  /** Physical cache card the genuine turn-one cache lot keeps; supplies a Black Market offer. */
  cacheCardId?: string;
  /** Cache origin: physical cache card the genuine compulsory cache lot offers. */
  offerCardId?: string;
  /** Positive winning bid for the genuine Once Around sale. Default 1. */
  bid?: number;
};

type RicheseIxianSpecialReplacementCommon = {
  /** Admitted fresh setup before its first turn; only undealt decks were ordered. */
  setup: Game;
  /** Genuine unallied Ixian Nexus holder about to close the Nexus; only undealt decks ordered. */
  beforeNexusDraw: Game;
  nexusDrawAction: Action;
  /** The exact physical card this fixture offered in the real native lot. */
  offered: Card;
  /** The real native lot's own event; never a fabricated auction row. */
  lotEvent: string;
  lotMethod: 'onceAround';
  /** Live native lot at the returned state, or null once the round retired it. */
  richeseAuction: RicheseIxianSpecialReplacementLot | null;
  buyer: string;
  /** The Richese round owner whose own card or cache card was offered. */
  seller: string;
  emperor: string | null;
  origin: RicheseIxianSpecialReplacementOrigin;
  advanced: boolean;
  /** The original physical cache at this point; a purchase may only shrink it by its own lot. */
  cacheBefore: Card[];
  /** Cards a genuine turn-one cache lot kept instead of buying. */
  keptCacheCards: string[];
  /** Black Market origin: the genuine pre-decline offer decision this fixture replaced. */
  blackMarketOffer: { actor: string; event: string; card: Card } | null;
  /** Where the original native suffix resumes after the buyer's choice. */
  suffix: 'phase' | 'declaration';
};

export type RicheseIxianSpecialReplacementSaleFixture = RicheseIxianSpecialReplacementCommon & {
  mode: 'sold';
  /** State with the pending purchased-card offer, after payment and delivery only. */
  game: Game;
  /** Public purchased-card event opened for this genuinely paid native sale. */
  event: string;
  /** The exact delivered card the offer binds; never a top deck or unsold lot card. */
  purchased: Card;
  /** Actual top of the Treachery Deck at the offer: the only legal replacement draw. */
  nextCard: Card;
  bid: number;
  /** Real native state immediately before the action that paid and delivered the lot. */
  beforePurchase: Game;
  /** The real native action that closed the lot, and by whom it was taken. */
  purchaseActor: string;
  purchaseAction: Action;
  /** Buyer hand before paying for the source lot; the delivered card is excluded. */
  buyerHandBefore: Card[];
  beforeSpice: number;
  /** Buyer spice at the offer: the native payment is already debited exactly once. */
  paidSpice: number;
  /** Seller spice at the offer: the native credit has not happened yet. */
  sellerSpiceAtOffer: number;
  /** Emperor spice at the offer; an unallied native sale owes no Emperor gift. */
  emperorSpiceAtOffer: number | null;
};

export type RicheseIxianSpecialReplacementUnbidFixture = RicheseIxianSpecialReplacementCommon & {
  mode: 'unbid';
  /** State where the genuine zero-bid outcome retired the lot; no sale was ever paid. */
  game: Game;
  /** Real native state immediately before the action that retired the lot. */
  beforeFinalAction: Game;
  finalActor: string;
  finalAction: Action;
  /** Cache origin: the keeper's original unbid choice, applied only when room existed. */
  kept: boolean | null;
  /** The physical card no purchase ever bound. */
  card: Card;
};

export type RicheseIxianSpecialReplacementFixture =
  | RicheseIxianSpecialReplacementSaleFixture
  | RicheseIxianSpecialReplacementUnbidFixture;

function player(game: Game, id: string) {
  const seat = game.players.find(candidate => candidate.id === id);
  assert.ok(seat, `The original seat ${id} must remain at the table.`);
  return seat;
}

function liveLot(game: Game): RicheseIxianSpecialReplacementLot | null {
  const lot = game.richeseAuction;
  return lot ? {
    event: lot.event, cardId: lot.cardId, source: lot.source,
    owner: lot.owner, outcome: structuredClone(lot.outcome),
  } : null;
}

/** Exported native seam: drive the original undealt Richese/CHOAM turn with the
 * genuine native policy, so a throwaway API/browser smoke can reach the source. */
export function nextRicheseIxianSpecialReplacementNativeStep(
  game: Game,
  cacheCardId?: string,
): RicheseIxianReplacementStep {
  return nextRicheseIxianReplacementNativeStep(game, cacheCardId);
}

function nativeStep(game: Game, cacheCardId?: string): Game {
  const next = nextRicheseIxianSpecialReplacementNativeStep(game, cacheCardId);
  return applyAction(game, next.actor, next.action);
}

/** Drive only the original native suffix after the buyer's own choice: the cache
 * lot ends its round into the phase boundary, the Black Market sale resumes the
 * original declaration. Never bids, pays, draws or invents a new lot. */
export function settleRicheseIxianSpecialReplacementSuffix(
  state: Game,
  origin: RicheseIxianSpecialReplacementOrigin,
  cacheCardId?: string,
): Game {
  let game = state;
  for (let count = 0; count < 50; count++) {
    if (origin === 'cache'
      ? game.richeseBidding?.stage === 'complete'
      : game.decision?.kind === 'richeseDeclaration') return game;
    game = nativeStep(game, cacheCardId);
  }
  throw new Error('The original native Richese suffix did not settle.');
}

/** A genuine special-origin purchase for the Ixian Nexus purchased-card choice.
 *
 * Provenance, all through the original private initializer and original actions:
 * the profile is the fresh native Richese + Atreides + Emperor/CHOAM prototype
 * with the real closing Nexus. The unallied Atreides holder buys a real normal
 * CHOAM lot at the last scheduled lot and keeps it with its Ixian Nexus card
 * (cache origin), or the fixture replays the genuine Nexus turn from its own
 * undealt snapshot (Black Market origin).
 *
 * Cache origin then lets the compulsory cache lot run as a real Once Around for
 * a card the ten-card cache still holds. Black Market origin stops at Richese's
 * own pre-decline window and offers the one card a genuine turn-one cache lot
 * actually kept in the owner's hand. The buyer's positive bid is a real funded
 * native bid. All bid, wallet, clock and card changes come from native actions;
 * no played state is assigned.
 *
 * The returned `game` already contains the paid sale (buyer debited, card
 * delivered) and the pending purchased-card offer; the original seller credit,
 * lot retirement and native suffix still belong to the original continuation,
 * so Use/Keep can never re-debit or re-credit the purchase. */
export function createRicheseIxianSpecialReplacementFixture(
  options: RicheseIxianSpecialReplacementOptions = {},
): RicheseIxianSpecialReplacementFixture {
  const origin = options.origin ?? 'cache';
  const mode = options.mode ?? 'sold';
  const advanced = options.advanced ?? origin === 'blackMarket';
  if (origin === 'blackMarket')
    assert.ok(advanced,
      'The native Black Market offer exists only in the Advanced profile; pass advanced: true or leave it unset.');
  const bid = options.bid ?? 1;
  assert.ok(Number.isSafeInteger(bid) && bid > 0,
    'A genuine Once Around purchase needs a positive integer bid.');
  const cacheCardId = options.cacheCardId;
  const base = createRicheseIxianReplacementFixture({
    initial: options.initial, advanced, endingAuction: true,
    purchasedId: options.purchasedId, replacementId: options.replacementId, cacheCardId,
  });
  assert.equal(base.advanced, advanced);
  const seller = base.setup.players.find(candidate => candidate.faction === 'richese')!.id;
  const buyer = base.buyer;
  assert.notEqual(buyer, seller,
    'The genuine source purchase needs a buyer other than its own Richese seller.');
  const emperor = base.setup.players.find(candidate => candidate.faction === 'emperor')?.id ?? null;
  assert.equal(player(base.game, buyer).ally, null,
    'The source purchase needs the unallied Ixian Nexus holder as its buyer.');
  assert.equal(base.game.nexusCards!.cards!.hands[buyer], 'ixians',
    'The source purchase needs its buyer still holding the genuine Ixian Nexus card.');
  assert.ok(!base.setup.players.some(candidate => candidate.faction === 'ixians'),
    'The native Richese/CHOAM profile must have native Ixians absent.');
  const keptCacheCards = [...base.keptCacheCards];
  const cacheBefore = structuredClone(base.cacheAtPurchase);
  let game: Game;
  let offered: Card;
  let blackMarketOffer: RicheseIxianSpecialReplacementCommon['blackMarketOffer'] = null;

  if (origin === 'cache') {
    // Keep the real normal purchase and the unallied Ixian Nexus card, then let
    // Richese's own compulsory cache offer stand on the original physical cache.
    game = settleIxianReplacementFixture(applyAction(structuredClone(base.game), buyer,
      { type: 'nexusIxianReplacementPass', event: base.event }));
    assert.equal(game.pendingNexusIxianReplacement, null,
      'The genuine normal purchase must close before the compulsory cache lot.');
    assert.deepEqual(game.decision, { kind: 'richeseCache', player: seller });
    assert.equal(game.richeseBidding!.stage, 'cacheOffer');
    const cache = game.richeseCache;
    assert.ok(cache, 'The cache lot needs the original physical cache.');
    assert.deepEqual(cache, cacheBefore,
      'The genuine normal purchase must not touch the compulsory cache.');
    const chosen = options.offerCardId ?? cache.find(card => !keptCacheCards.includes(card.id))!.id;
    const cached = cache.find(card => card.id === chosen);
    assert.ok(cached, 'The offered cache card must still be in the physical cache.');
    assert.ok(!keptCacheCards.includes(cached.id),
      'The cache lot must not re-offer a card an earlier genuine lot already kept.');
    offered = structuredClone(cached);
    game = applyAction(game, seller, { type: 'decision', event: game.richeseBidding!.event,
      card: offered.id, method: 'onceAround', direction: 'clockwise' });
  } else {
    game = structuredClone(base.beforeNexusDraw);
    game = applyAction(game, buyer, base.nexusDrawAction);
    assert.equal(game.nexusCards!.cards!.hands[buyer], 'ixians');
    for (const id of game.nexusCards!.phase!.eligible)
      if (!game.nexusCards!.phase!.done.includes(id))
        game = applyAction(game, id, { type: 'nexusCardChoice', turn: game.turn,
          card: null, choice: 'keep', ownRedraws: 0 });
    for (let count = 0; game.decision?.kind !== 'richeseBlackMarket' && count < 600; count++)
      game = nativeStep(game, cacheCardId);
    const decision = game.decision;
    assert.equal(decision?.kind, 'richeseBlackMarket',
      'The genuine Advanced round must still offer its own Black Market window.');
    assert.equal(game.richeseBidding!.stage, 'blackMarketOffer');
    assert.equal(game.richeseAuction, null);
    const held = player(game, seller).hand.filter(card => keptCacheCards.includes(card.id));
    assert.equal(held.length, 1,
      'The genuine turn-one cache Keep must supply exactly one held Richese card.');
    const candidate = options.offerCardId
      ? held.find(card => card.id === options.offerCardId)
      : held[0];
    assert.ok(candidate, 'The Black Market offer needs a genuinely held Richese card.');
    offered = structuredClone(candidate);
    blackMarketOffer = { actor: decision.player, event: game.richeseBidding!.event,
      card: structuredClone(offered) };
    assert.equal(game.richeseOfferedCard, null);
    game = applyAction(game, seller, { type: 'decision', event: game.richeseBidding!.event,
      card: offered.id, method: 'onceAround', direction: 'clockwise' });
    assert.equal(game.richeseAuction?.source, 'blackMarket');
    assert.equal(game.richeseAuction!.cardId, offered.id);
    assert.equal(game.richeseOfferedCard?.id, offered.id);
  }

  const open = game.richeseAuction;
  assert.ok(open, 'The genuine native Once Around lot must be open.');
  assert.equal(open.source, origin);
  assert.equal(open.method, 'onceAround');
  assert.equal(open.cardId, offered.id);
  assert.equal(open.owner, seller);
  assert.equal(open.outcome, null);
  const lotEvent = open.event;
  let beforeFinalAction = structuredClone(game);
  let finalActor = '';
  let finalAction: Action = { type: 'richeseBid', event: lotEvent, amount: null };
  for (let count = 0; count < 200; count++) {
    if (mode === 'sold' && game.pendingNexusIxianReplacement) break;
    if (game.response || game.phaseOpening || game.pendingTreacheryDiscard) {
      const next = nextRicheseIxianSpecialReplacementNativeStep(game, cacheCardId);
      beforeFinalAction = structuredClone(game);
      finalActor = next.actor;
      finalAction = next.action;
      game = applyAction(game, next.actor, next.action);
      continue;
    }
    const lot = game.richeseAuction;
    if (!lot || lot.outcome) break;
    assert.equal(lot.event, lotEvent, 'The genuine lot must keep its own event.');
    const actor = lot.active;
    assert.ok(actor, 'A genuine Once Around lot always names its next bidder.');
    const action: Action = mode === 'sold' && actor === buyer && lot.bid === 0
      ? { type: 'richeseBid', event: lotEvent, amount: bid }
      : { type: 'richeseBid', event: lotEvent, amount: null };
    beforeFinalAction = structuredClone(game);
    finalActor = actor;
    finalAction = action;
    game = applyAction(game, actor, action);
  }

  const common = {
    setup: base.setup, beforeNexusDraw: base.beforeNexusDraw,
    nexusDrawAction: base.nexusDrawAction, offered, lotEvent, lotMethod: 'onceAround' as const,
    richeseAuction: liveLot(game), buyer, seller, emperor, origin, advanced,
    cacheBefore, keptCacheCards, blackMarketOffer,
    suffix: (origin === 'cache' ? 'phase' : 'declaration') as 'phase' | 'declaration',
  };

  if (mode === 'sold') {
    const closed = game.richeseAuction;
    assert.ok(closed, 'The paid native lot must remain the offer’s own source.');
    assert.deepEqual(closed.outcome, { kind: 'sold', winner: buyer, amount: bid });
    const source = game.pendingNexusIxianReplacement;
    assert.ok(source, 'The genuinely paid native sale must open the purchased-card offer.');
    assert.equal(source.version, 1);
    assert.equal(source.buyer, buyer);
    assert.equal(source.turn, game.turn);
    assert.equal(source.auctionIndex, 0,
      'A native Richese lot binds lot index 0, never a fabricated Game or normal-auction row.');
    assert.equal(source.amount, bid);
    assert.equal(source.free, false);
    assert.deepEqual(source.card, offered);
    assert.deepEqual(game.decision, { kind: 'nexusIxianReplacement', player: buyer,
      event: source.event });
    assert.equal(game.auction, null);
    assert.equal(game.currentAuctionSale?.origin, origin);
    assert.equal(game.players.flatMap(seat => seat.hand)
      .filter(card => card.id === offered.id).length, 1,
    'The paid native card must be delivered exactly once.');
    if (origin === 'cache') {
      assert.equal(game.richeseCache!.some(card => card.id === offered.id), false);
      assert.deepEqual(game.richeseCache,
        cacheBefore.filter(card => card.id !== offered.id));
    } else {
      assert.deepEqual(game.richeseCache, cacheBefore,
        'A Black Market sale must never touch the compulsory cache.');
      assert.equal(player(game, seller).hand.some(card => card.id === offered.id), false,
        'The concealed Black Market card must leave the seller’s own hand.');
      assert.equal(player(beforeFinalAction, seller).hand.some(card => card.id === offered.id),
        true, 'The Black Market offer must come from a genuinely held card.');
    }
    assert.ok(game.deck.length > 0);
    const nextCard = structuredClone(game.deck[0]);
    assert.notEqual(nextCard.id, offered.id);
    return {
      ...common, mode: 'sold', game, event: source.event,
      purchased: structuredClone(offered), nextCard, bid,
      beforePurchase: beforeFinalAction, purchaseActor: finalActor, purchaseAction: finalAction,
      buyerHandBefore: structuredClone(player(beforeFinalAction, buyer).hand),
      beforeSpice: player(beforeFinalAction, buyer).spice,
      paidSpice: player(game, buyer).spice,
      sellerSpiceAtOffer: player(game, seller).spice,
      emperorSpiceAtOffer: emperor ? player(game, emperor).spice : null,
    };
  }

  assert.equal(finalAction.type, 'richeseBid');
  assert.equal(finalAction.amount, null,
    'A genuine unbid outcome can only come from real zero offers.');
  assert.equal(game.pendingNexusIxianReplacement, null,
    'A lot that was never sold is not a purchase and opens no purchased-card offer.');
  assert.equal(game.currentAuctionSale, null);
  if (origin === 'cache') {
    const lot = game.richeseAuction;
    assert.ok(lot, 'The unbid cache lot waits for its owner’s own choice.');
    assert.deepEqual(lot.outcome, { kind: 'unbid' });
    assert.deepEqual(game.decision, { kind: 'richeseUnbid', player: seller });
    const sellerSeat = player(game, seller);
    const kept = sellerSeat.hand.length < handLimit(sellerSeat);
    game = applyAction(game, seller, { type: 'decision', event: game.richeseBidding!.event,
      keep: kept });
    assert.equal(game.pendingNexusIxianReplacement, null);
    assert.equal(player(game, seller).hand.some(card => card.id === offered.id), kept);
    assert.equal((game.richeseRemoved ?? []).some(card => card.id === offered.id), !kept);
    return {
      ...common, richeseAuction: liveLot(game), mode: 'unbid', game,
      beforeFinalAction, finalActor, finalAction, kept, card: structuredClone(offered),
    };
  }
  assert.equal(game.richeseAuction, null, 'The retained Black Market lot must retire itself.');
  assert.deepEqual(game.decision, { kind: 'richeseDeclaration', player: seller });
  assert.equal(game.richeseBidding!.blackMarketSold, false);
  assert.equal(player(game, seller).hand.some(card => card.id === offered.id), true,
    'The unbid Black Market card must stay with its own seller.');
  assert.equal(game.richeseOfferedCard, null);
  return {
    ...common, richeseAuction: null, mode: 'unbid', game,
    beforeFinalAction, finalActor, finalAction, kept: null, card: structuredClone(offered),
  };
}
