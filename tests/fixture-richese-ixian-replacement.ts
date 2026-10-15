import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeIxianNexusReplacementGameForAudit, joinGame,
  newPlayer, type Action, type Game,
} from '../game/engine';
import { choamDeck, treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';
import type { IxianReplacementFixture } from './fixture-nexus-ixian-replacement';

export type RicheseIxianReplacementStep = { actor: string; action: Action };

export type RicheseIxianReplacementOptions = {
  /** Continue only a fresh authenticated undealt Richese/CHOAM lobby or its admitted setup. */
  initial?: Game;
  advanced?: boolean;
  /** Seated seat that makes the original normal purchase; Richese may buy too. */
  buyerFaction?: 'atreides' | 'richese';
  /** Shared CHOAM addition bought as an ordinary normal-auction lot. */
  purchasedId?: string;
  /** Other shared CHOAM addition left as the real top card after that purchase. */
  replacementId?: string;
  /** Physical cache card the genuine turn-one cache lot offers. */
  cacheCardId?: string;
  /** Buy the final normal lot so the native pool closes instead of advancing. */
  endingAuction?: boolean;
};

export type RicheseIxianReplacementFixture = IxianReplacementFixture & {
  /** Admitted fresh setup before its first turn; only undealt decks were ordered. */
  setup: Game;
  beforeNexusDraw: Game;
  nexusDrawAction: Action;
  nextCard: Card;
  /** Native normal lot count for this Richese round (the cache reduction). */
  rowSize: number;
  advanced: boolean;
  expansions: readonly string[];
  factions: string[];
  /** The original ten-card cache minus only the cards a real cache lot kept. */
  cacheAtPurchase: Card[];
  keptCacheCards: string[];
};

/** Native policy for the fresh Richese/CHOAM Nexus profile. Richese's own
 * windows come first: the compulsory cache lot is announced last so the normal
 * pool leads, no Black Market card is offered, and the turn-one cache lot is a
 * real Once Around whose bids are all genuine zero offers. Every other window
 * is the ordinary native no-spend policy, with no card, spice or force staged. */
export function nextRicheseIxianReplacementNativeStep(
  game: Game,
  cacheCardId?: string,
): RicheseIxianReplacementStep {
  const round = game.richeseBidding;
  const decision = game.decision;
  if (decision?.kind === 'richeseDeclaration') {
    assert.ok(round, 'The native Richese round must still be open.');
    return { actor: decision.player,
      action: { type: 'decision', event: round.event, position: 'last' } };
  }
  if (decision?.kind === 'richeseBlackMarket') {
    assert.ok(round, 'A Black Market offer needs its original Richese round.');
    return { actor: decision.player,
      action: { type: 'decision', event: round.event, decline: true } };
  }
  if (decision?.kind === 'richeseCache') {
    const cache = game.richeseCache;
    assert.ok(round, 'The cache offer needs its original Richese round.');
    assert.ok(cache?.length, 'The cache offer needs its physical cache.');
    const card = cache.find(candidate => candidate.id === cacheCardId) ?? cache[0];
    return { actor: decision.player, action: { type: 'decision', event: round.event,
      card: card.id, method: 'onceAround', direction: 'clockwise' } };
  }
  if (decision?.kind === 'richeseUnbid') {
    assert.ok(round, 'An unbid cache card needs its original Richese round.');
    const owner = game.players.find(player => player.id === decision.player);
    assert.ok(owner, 'The unbid cache card needs its physical owner.');
    return { actor: decision.player, action: { type: 'decision', event: round.event,
      keep: owner.hand.length < handLimit(owner) } };
  }
  const lot = game.richeseAuction;
  if (!decision && !game.response && lot && !lot.outcome) {
    const actor = lot.method === 'silent'
      ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id))
      : lot.active;
    assert.ok(actor, 'The original Richese lot must still name its next bidder.');
    return { actor, action: { type: 'richeseBid', event: lot.event,
      amount: lot.method === 'silent' ? 0 : null } };
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next, 'The native Richese/CHOAM turn must still supply a next step.');
  return next;
}

function step(game: Game, cacheCardId?: string): Game {
  const next = nextRicheseIxianReplacementNativeStep(game, cacheCardId);
  return applyAction(game, next.actor, next.action);
}

/** Only reorders still-undealt original cards; no hand, lot or Nexus receipt is
 * manufactured. The requested buyer draws its printed Karama first. */
function orderStartingCards(game: Game, buyer: string, reserved: readonly string[]): void {
  const pool = [...game.deck];
  const front: Card[] = [];
  for (const player of game.players) {
    const index = pool.findIndex(card => !reserved.includes(card.id) &&
      (player.id === buyer ? card.effect === 'karama' : card.effect !== 'karama'));
    assert.ok(index >= 0, 'A conserved original starting face must remain undealt.');
    front.push(pool.splice(index, 1)[0]);
  }
  game.deck = [...front, ...pool.filter(card => !reserved.includes(card.id)),
    ...pool.filter(card => reserved.includes(card.id))];
}

/** Proves the purchase and the replacement stay inside their own original
 * inventories: the shared CHOAM deck is conserved apart from the ten-card
 * Richese cache, which is conserved with whatever a real cache lot kept. */
function assertOriginalInventory(game: Game): void {
  const physical = [
    ...game.players.flatMap(player => player.hand), ...game.deck, ...game.discard,
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
  ];
  const cache = physical.filter(card => card.id.startsWith('richese-'));
  assert.deepEqual(physical.filter(card => !cache.includes(card)).map(card => card.id).sort(),
    treacheryDeck(['choam']).map(card => card.id).sort());
  assert.deepEqual([...game.richeseCache!.map(card => card.id),
    ...(game.richeseRemoved ?? []).map(card => card.id), ...cache.map(card => card.id)].sort(),
  richeseCards().map(card => card.id).sort());
}

/** Fresh native Richese + classics with CHOAM alone: a real first turn, the
 * genuine closing Nexus draw by an unallied buyer, and an original paid normal
 * purchase of a shared CHOAM addition. Richese's own cache stays a separate
 * ten-card collection (the compulsory cache lot runs Once Around and is kept,
 * never bought through the Nexus replacement). Returned before the payment. */
export function createRicheseIxianReplacementFixture(
  options: RicheseIxianReplacementOptions = {},
): RicheseIxianReplacementFixture {
  const purchasedId = options.purchasedId ?? 'ix-poison-tooth';
  const replacementId = options.replacementId ?? 'ix-artillery';
  assert.notEqual(purchasedId, replacementId);
  for (const id of [purchasedId, replacementId])
    assert.ok(choamDeck().some(card => card.id === id),
      'Only an original shared CHOAM addition may be bought or become the replacement.');
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || (game.status === 'setup' &&
      game.nexusIxianReplacementPreview === true && game.turn === 1 && game.phase === 0 &&
      game.players.every(player => player.hand.length === 0)),
    'Continue only an admitted fresh lobby or its undealt native prototype setup.');
  } else {
    game = createGame('RICNIXREP', newPlayer('richese', 'Richese', 'richese'),
      options.advanced ?? false, ['choam']);
    joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.deepEqual(game.expansions, ['choam'], 'This profile is CHOAM alone, with no Ix deck.');
  const buyerSeat = game.players.find(player => player.faction === (options.buyerFaction ?? 'atreides'));
  assert.ok(buyerSeat, 'The requested buyer faction must be seated in the Richese roster.');
  assert.ok(game.players.some(player => player.faction === 'richese'),
    'The native profile needs its seated Richese.');
  const buyer = buyerSeat.id;
  const partners = game.players.filter(player => player.id !== buyer);
  assert.equal(partners.length, 2, 'The closing Nexus needs two other seats to ally.');
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game.nexusCards ??= { cards: null, phase: null };
    game = initializeIxianNexusReplacementGameForAudit(game);
  }
  const cache = game.richeseCache;
  assert.ok(cache, 'The admitted Richese profile must own its physical cache.');
  assert.equal(cache.length, richeseCards().length);
  const cacheCardId = options.cacheCardId ?? cache[0].id;
  assert.ok(cache.some(card => card.id === cacheCardId),
    'The chosen cache card must be one of the original ten.');
  assert.ok(game.deck.some(card => card.id === purchasedId));
  assert.ok(game.deck.some(card => card.id === replacementId));
  orderStartingCards(game, buyer, [purchasedId, replacementId]);
  const nexus = game.nexusCards!.cards;
  assert.ok(nexus, 'The fresh Nexus profile must own its physical cards.');
  assert.ok(Object.values(nexus.hands).every(face => face === null),
    'No Nexus card is held before the closing Nexus.');
  assert.ok(nexus.deck.includes('ixians'));
  nexus.deck = ['ixians', ...nexus.deck.filter(face => face !== 'ixians')];
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) game = step(game, cacheCardId);
  assert.equal(game.status, 'playing');
  assert.ok(game.players.every(player => player.hand.length === 1),
    'Every seat holds exactly its one original starting card.');
  assert.ok(game.players.find(player => player.id === buyer)!.hand.some(card => card.effect === 'karama'),
    'The buyer holds its printed Karama while still paying its own spice.');
  // Only the two still-unplayed Spice positions are ordered so the first turn
  // cannot supply the closing worm; every later card is native.
  for (let position = 0; position < 2; position++) {
    const index = game.spiceDeck.findIndex((card, at) => at >= position && 'territory' in card);
    assert.ok(index >= position, 'A conserved original territory Spice Card must remain.');
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  const turnOne = game.turn;
  for (let count = 0; count < 1200; count++) {
    if (game.turn > turnOne && game.phase === 0 && !game.phaseOpening && !game.response && !game.decision) break;
    game = step(game, cacheCardId);
  }
  assert.equal(game.turn, 2, 'A complete native first turn must supply the next Storm.');
  assert.equal(game.richeseCache!.length, richeseCards().length - 1,
    'Exactly one compulsory cache lot ran, keeping its single original card.');
  for (let count = 0; game.phase !== 1 && count < 300; count++) game = step(game, cacheCardId);
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed);
  assert.ok(worm >= 0, 'An original worm Spice Card must remain for the closing Nexus.');
  game.spiceDeck.splice(0, 0, game.spiceDeck.splice(worm, 1)[0]);
  for (let count = 0; !(game.nexus && !game.spiceWindow && !game.spiceResolution &&
    !game.phaseOpening && !game.response && !game.decision) && count < 300; count++) game = step(game, cacheCardId);
  assert.equal(game.phase, 1);
  assert.equal(game.nexus, true);
  // A real alliance between the two non-recipients leaves the buyer unallied.
  game = applyAction(game, partners[0].id, { type: 'alliance', target: partners[1].id });
  game = applyAction(game, partners[1].id, { type: 'alliance', target: partners[0].id });
  for (let count = 0; game.nexusCards?.phase?.stage !== 'drawing' && count < 300; count++) game = step(game, cacheCardId);
  assert.equal(game.nexusCards?.phase?.stage, 'drawing');
  const beforeNexusDraw = structuredClone(game);
  const nexusDrawAction: Action = { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 };
  game = applyAction(game, buyer, nexusDrawAction);
  assert.equal(game.nexusCards!.cards!.hands[buyer], 'ixians');
  for (const id of game.nexusCards!.phase!.eligible)
    if (!game.nexusCards!.phase!.done.includes(id))
      game = applyAction(game, id, { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'keep', ownRedraws: 0 });
  // Reach the genuine Richese declaration of the auction turn, then order only
  // the still-undealt deck before the native row allocation consumes it.
  for (let count = 0; game.decision?.kind !== 'richeseDeclaration' && count < 400; count++) game = step(game, cacheCardId);
  const declaration = game.decision;
  assert.equal(declaration?.kind, 'richeseDeclaration');
  const round = game.richeseBidding!;
  const rowSize = game.richeseBidding!.normalCount!;
  assert.ok(Number.isSafeInteger(rowSize) && rowSize >= 1,
    'The original Richese round must schedule at least one normal lot.');
  const purchaseIndex = options.endingAuction ? rowSize - 1 : 0;
  const pool = [...game.deck];
  const reserve = (id: string): Card => {
    const at = pool.findIndex(card => card.id === id);
    assert.ok(at >= 0, `The still-undealt deck must hold ${id}.`);
    return pool.splice(at, 1)[0];
  };
  const originalPurchase = reserve(purchasedId);
  const originalReplacement = reserve(replacementId);
  game.deck = [...pool];
  game.deck.splice(purchaseIndex, 0, originalPurchase);
  // Native allocation takes one lot per scheduled seat; the remaining deck top
  // is the requested original replacement, never a reserved physical lot.
  game.deck.splice(rowSize, 0, originalReplacement);
  game = applyAction(game, declaration.player, { type: 'decision', event: round.event, position: 'last' });
  for (let count = 0; !(game.decision?.kind === 'auctionPayment' && game.decision.player === buyer) && count < 400; count++) {
    if (game.decision?.kind === 'auctionPayment')
      game = applyAction(game, game.decision.player, { type: 'decision', karama: false });
    else if (game.phaseOpening || game.response || game.decision || !game.auction) game = step(game, cacheCardId);
    else if (game.auction.index < purchaseIndex) {
      const active = game.auction.active;
      game = applyAction(game, active, active !== buyer && game.auction.bid === 0
        ? { type: 'bid', amount: 1 } : { type: 'passBid' });
    } else if (game.auction.active === buyer && game.auction.bid === 0)
      game = applyAction(game, buyer, { type: 'bid', amount: 2 });
    else game = applyAction(game, game.auction.active, { type: 'passBid' });
  }
  assert.deepEqual(game.decision, { kind: 'auctionPayment', player: buyer });
  const auction = game.auction!;
  assert.equal(auction.cards[auction.index].id, purchasedId);
  assert.equal(auction.bid, 2);
  assert.equal(auction.allyPayment ?? 0, 0);
  assert.equal(game.deck[0].id, replacementId);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assertOriginalInventory(game);
  const beforePayment = structuredClone(game);
  const owner = game.players.find(player => player.id === buyer)!;
  const emperor = game.players.find(player => player.faction === 'emperor')?.id ?? null;
  const beforeEmperorSpice = emperor ? game.players.find(player => player.id === emperor)!.spice : null;
  const beforeSpice = owner.spice;
  const purchased = structuredClone(auction.cards[auction.index]);
  const cacheAtPurchase = structuredClone(game.richeseCache!);
  const keptCacheCards = game.players.flatMap(player => player.hand)
    .filter(card => card.id.startsWith('richese-')).map(card => card.id);
  const paymentAction: Action = { type: 'decision', karama: false };
  game = applyAction(game, buyer, paymentAction);
  assert.ok(game.pendingNexusIxianReplacement, 'The normal purchase must offer the Nexus replacement.');
  assert.equal(game.pendingNexusIxianReplacement.buyer, buyer);
  assert.equal(game.decision?.kind, 'nexusIxianReplacement');
  assert.deepEqual(game.richeseCache, cacheAtPurchase, 'The purchase must not touch the Richese cache.');
  return {
    setup, beforeNexusDraw, nexusDrawAction, beforePayment, game, buyer,
    event: game.pendingNexusIxianReplacement.event, purchased, paymentAction, beforeSpice,
    paidSpice: game.players.find(player => player.id === buyer)!.spice, emperor, beforeEmperorSpice,
    nextCard: structuredClone(game.deck[0]), auctionIndex: beforePayment.auction!.index,
    rowSize, advanced: game.advanced, expansions: game.expansions,
    factions: game.players.map(player => player.faction),
    cacheAtPurchase, keptCacheCards,
  };
}
