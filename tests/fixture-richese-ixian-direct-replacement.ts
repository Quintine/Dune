import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import {
  createRicheseIxianReplacementFixture, nextRicheseIxianReplacementNativeStep,
  type RicheseIxianReplacementFixture, type RicheseIxianReplacementStep,
} from './fixture-richese-ixian-replacement';

export type RicheseIxianDirectReplacementContext = 'quiet' | 'auctionPayment' | 'income' | 'revival';
export type RicheseIxianDirectReplacementOptions = {
  context?: RicheseIxianDirectReplacementContext;
  /** Defaults to true; false uses fresh native Richese/Atreides/Guild + CHOAM. */
  emperor?: boolean;
  /** Only a fresh undealt native Richese/classics CHOAM lobby or admitted setup. */
  initial?: Game;
  /** Original shared CHOAM normal lot used by the base native purchase. */
  purchasedId?: string;
  /** Original shared CHOAM replacement reserved in the still-undealt deck. */
  replacementId?: string;
  /** Original cache card kept by the genuine first-turn compulsory lot. */
  cacheCardId?: string;
  /** Still-present original cache face, excluding any card reserved by a live lot. */
  targetId?: string;
};

export type RicheseIxianDirectReplacementFixture = {
  context: RicheseIxianDirectReplacementContext;
  setup: Game;
  beforeNexusDraw: Game;
  nexusDrawAction: Action;
  /** The base recipe's actual original normal payment and its pre-payment state. */
  base: RicheseIxianReplacementFixture;
  beforePurchase: Game;
  actor: string;
  action: Action;
  game: Game;
  event: string | null;
  buyer: string;
  cost: Card;
  target: Card;
  nextCard: Card;
  price: 3;
  emperor: string | null;
  beforeSpice: number;
  paidSpice: number;
  beforeEmperorSpice: number | null;
  originalControls: Pick<Game, 'active' | 'response' | 'decision' | 'pendingKarama'>;
  funding: { wallet: number; reservedNormalBid: number; uncommitted: number };
  provenance: {
    /** Actual actions from the base checkpoint, not a synthetic source reconstruction. */
    checkpoint: 'beforeNexusDraw' | 'beforePayment' | 'normalOffer';
    steps: RicheseIxianReplacementStep[];
    /** Quiet replay alone orders these original undealt cards at declaration. */
    undealtDeclarationOrder: string[] | null;
  };
};

const owner = (game: Game, id: string) => {
  const seat = game.players.find(player => player.id === id);
  assert.ok(seat, 'The original Richese/classics seat must remain seated.');
  return seat;
};

/** Original native suffix driver; a later NORMAL purchase may open a distinct
 * purchased-card offer after the direct Keep. Keep that separate source rather
 * than clearing it or pretending the original payment stalled. */
export function nextRicheseIxianDirectReplacementNativeStep(
  game: Game,
  cacheCardId?: string,
): RicheseIxianReplacementStep {
  const source = game.pendingNexusIxianReplacement;
  if (source) return { actor: source.buyer,
    action: { type: 'nexusIxianReplacementPass', event: source.event } };
  return nextRicheseIxianReplacementNativeStep(game, cacheCardId);
}

/** Settle only the purchase's original responses/payment and a possible fresh
 * normal Keep offer. Stop before another bid or native cache decision. Never
 * advance the row by hand, clear controls, replay a quote or pay a source twice. */
export function settleRicheseIxianDirectReplacementSuffix(state: Game): Game {
  let game = state;
  for (let count = 0; count < 100; count++) {
    const source = game.pendingNexusIxianReplacement;
    if (source) {
      assert.equal(viewGame(game, source.buyer).nexusIxianReplacement?.origin, 'normal',
        'Choose the direct purchased-card offer before settling its suffix.');
    } else if (!game.pendingTreacheryDiscard && !game.response &&
      game.decision?.kind !== 'auctionPayment') return game;
    const next = nextRicheseIxianDirectReplacementNativeStep(game);
    game = applyAction(game, next.actor, next.action);
  }
  throw new Error('The original direct-purchase controls did not settle.');
}

/** Advanced native Richese, genuinely unallied and holding its naturally drawn
 * Ixian Nexus and its printed starting Karama. The original base recipe supplies
 * the complete first turn, worm, alliance, Nexus draw and normal purchase.
 *
 * Quiet replays its before-draw checkpoint and stops at bid zero, without ever
 * buying that normal lot. AuctionPayment instead suspends the original funded
 * bid 2 (wallet 5, three uncommitted). Income Keeps the normal purchase without
 * settling Emperor income 2. Revival Keeps that purchase and follows the real
 * remaining normal bids/cache lot into phase 4, where the same special purchase
 * is legal but has no Bidding-only Ixian replacement.
 *
 * Only original undealt inventories are ordered. Every card delivery, discard,
 * Nexus draw, phase transition, income and debit is an original engine action. */
export function createRicheseIxianDirectReplacementFixture(
  options: RicheseIxianDirectReplacementOptions = {},
): RicheseIxianDirectReplacementFixture {
  const context = options.context ?? 'quiet';
  let initial = options.initial;
  if (!initial && options.emperor === false) {
    initial = createGame('RICDIRECT', newPlayer('richese', 'Richese', 'richese'), true, ['choam']);
    joinGame(initial, newPlayer('atreides', 'Atreides', 'atreides'));
    joinGame(initial, newPlayer('guild', 'Guild', 'guild'));
  }
  const base = createRicheseIxianReplacementFixture({
    initial, advanced: true, buyerFaction: 'richese',
    purchasedId: options.purchasedId, replacementId: options.replacementId,
    cacheCardId: options.cacheCardId,
  });
  const buyer = base.buyer;
  const emperor = base.emperor;
  if (options.emperor !== undefined) assert.equal(emperor !== null, options.emperor);
  if (context === 'income') assert.ok(emperor, 'The original income-2 context requires seated Emperor.');
  const steps: RicheseIxianReplacementStep[] = [];
  let undealtDeclarationOrder: string[] | null = null;
  let game = structuredClone(context === 'quiet' ? base.beforeNexusDraw :
    context === 'auctionPayment' ? base.beforePayment : base.game);
  const act = (actor: string, action: Action) => {
    steps.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  const native = () => {
    const next = nextRicheseIxianDirectReplacementNativeStep(game, options.cacheCardId);
    act(next.actor, next.action);
  };
  if (context === 'quiet') {
    act(buyer, base.nexusDrawAction);
    for (const id of game.nexusCards!.phase!.eligible)
      if (!game.nexusCards!.phase!.done.includes(id))
        act(id, { type: 'nexusCardChoice', turn: game.turn, card: null,
          choice: 'keep', ownRedraws: 0 });
    for (let count = 0; game.decision?.kind !== 'richeseDeclaration' && count < 400; count++) native();
    assert.equal(game.decision?.kind, 'richeseDeclaration');
    // This is still the original undealt deck, before native row allocation.
    const pool = [...game.deck];
    const take = (id: string): Card => {
      const at = pool.findIndex(card => card.id === id);
      assert.ok(at >= 0, 'The conserved requested CHOAM face must remain undealt.');
      return pool.splice(at, 1)[0];
    };
    const purchased = take(base.purchased.id);
    const replacement = take(base.nextCard.id);
    game.deck = [purchased, ...pool];
    game.deck.splice(base.rowSize, 0, replacement);
    undealtDeclarationOrder = game.deck.map(card => card.id);
    for (let count = 0; !(game.phase === 3 && game.auction && !game.phaseOpening &&
      !game.response && !game.decision) && count < 400; count++) native();
    assert.equal(game.auction?.bid, 0);
    assert.equal(game.response, null);
    assert.equal(game.decision, null);
  } else if (context === 'income' || context === 'revival') {
    act(buyer, { type: 'nexusIxianReplacementPass', event: base.event });
    if (context === 'income') {
      assert.equal(game.response?.kind, 'emperorIncome');
      assert.equal(game.currentAuctionSale?.amount, 2);
    } else {
      for (let count = 0; !(game.phase === 4 && !game.phaseOpening && !game.response &&
        !game.decision) && count < 500; count++) native();
      assert.equal(game.phase, 4, 'The actual native auction/cache suffix must reach Revival.');
    }
  }
  assert.equal(owner(game, buyer).faction, 'richese');
  assert.equal(owner(game, buyer).ally, null);
  assert.equal(game.nexusCards!.cards!.hands[buyer], 'ixians');
  const cost = owner(game, buyer).hand.find(card => card.effect === 'karama');
  assert.ok(cost, 'Richese must still hold its actual printed starting Karama.');
  const target = game.richeseCache?.find(card =>
    (options.targetId === undefined || card.id === options.targetId) &&
    !(game.richeseAuction?.source === 'cache' && !game.currentAuctionSale &&
      game.richeseAuction.cardId === card.id));
  assert.ok(target, 'Choose a still-present original cache card not reserved by a live lot.');
  const beforePurchase = structuredClone(game);
  const beforeSpice = owner(game, buyer).spice;
  const beforeEmperorSpice = emperor ? owner(game, emperor).spice : null;
  const originalControls = structuredClone({ active: game.active, response: game.response,
    decision: game.decision, pendingKarama: game.pendingKarama });
  const reservedNormalBid = game.auction?.bidder === buyer && !game.currentAuctionSale
    ? game.auction.bid - (game.auction.allyPayment ?? 0) : 0;
  const funding = { wallet: beforeSpice, reservedNormalBid, uncommitted: beforeSpice - reservedNormalBid };
  assert.ok(funding.uncommitted >= 3);
  const nextCard = structuredClone(game.deck[0]);
  assert.ok(nextCard, 'A real Treachery Deck replacement must remain.');
  const action: Action = { type: 'card', mode: 'special', card: cost.id, acquire: target.id };
  game = applyAction(game, buyer, action);
  assert.equal(owner(game, buyer).spice, beforeSpice - 3);
  assert.equal(owner(game, buyer).specialKaramaUsed, true);
  assert.ok(owner(game, buyer).hand.some(card => card.id === target.id));
  assert.equal(game.discard.filter(card => card.id === cost.id).length, 1);
  const offer = viewGame(game, buyer).nexusIxianReplacement;
  if (context === 'revival') assert.equal(offer, null);
  else {
    assert.ok(offer, 'The paid Bidding-phase direct purchase must open its own Ixian offer.');
    assert.equal(offer.origin, 'richeseSpecial');
    assert.equal(offer.purchased?.id, target.id);
    if (emperor) assert.equal(owner(game, emperor).spice, beforeEmperorSpice,
      'The direct choice must precede the original three-spice income.');
  }
  return {
    context, setup: base.setup, beforeNexusDraw: base.beforeNexusDraw,
    nexusDrawAction: base.nexusDrawAction, base, beforePurchase, actor: buyer, action, game,
    event: offer?.event ?? null, buyer, cost: structuredClone(cost), target: structuredClone(target),
    nextCard, price: 3, emperor, beforeSpice, paidSpice: owner(game, buyer).spice,
    beforeEmperorSpice, originalControls, funding,
    provenance: { checkpoint: context === 'quiet' ? 'beforeNexusDraw' :
      context === 'auctionPayment' ? 'beforePayment' : 'normalOffer', steps, undealtDeclarationOrder },
  };
}
