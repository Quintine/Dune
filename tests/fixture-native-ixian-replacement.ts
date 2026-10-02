import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeIxianNexusReplacementGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck, type Card } from '../game/cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { advanceToNextStorm } from './fixture-advanced-source';
import {
  settleIxianReplacementFixture, type IxianReplacementFixture,
} from './fixture-nexus-ixian-replacement';

export type NativeIxianReplacementOptions = {
  initial?: Game;
  buyerFaction?: 'atreides' | 'tleilaxu';
  purchasedId?: string;
  replacementId?: string;
  endingAuction?: boolean;
};
export type NativeIxianReplacementFixture = IxianReplacementFixture & {
  setup: Game;
  beforeNexusDraw: Game;
  nexusDrawAction: Action;
  nextCard: Card;
};

export function assertNativeIxianReplacementInventory(game: Game): void {
  const physical = [
    ...game.players.flatMap(player => player.hand), ...game.deck, ...game.discard,
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
  ];
  assert.deepEqual(physical.map(card => card.id).sort(), treacheryDeck(['ix']).map(card => card.id).sort());
  const nexus = game.nexusCards!.cards!;
  validateNexusCards(nexus, game.players);
  assert.deepEqual([
    ...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter(face => face !== null),
  ].sort(), [...NEXUS_FACTIONS].sort());
}

function nativeStep(game: Game): Game {
  if (game.response || game.pendingTreacheryDiscard) return settleIxianReplacementFixture(game);
  if (game.phaseOpening) return applyAction(game,
    game.players.find(player => !game.phaseOpening!.passed.includes(player.id))!.id, { type: 'ready' });
  if (game.status === 'playing' && !game.decision) {
    if (game.phase === 0 && game.stormPending === null) {
      const dialer = game.stormDialers.find(id => game.stormDials[id] === undefined);
      assert.ok(dialer);
      return applyAction(game, dialer, { type: 'stormDial', amount: game.turn === 1 ? 0 : 1 });
    }
    if (game.phase === 3 && game.auction) return applyAction(game, game.auction.active, { type: 'passBid' });
    if (game.phase === 5) return applyAction(game, game.active!, { type: 'endMovement' });
  }
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action = actions.find(candidate => candidate.type === 'ready') ?? actions[0];
    if (action) return applyAction(game, player.id, action);
  }
  throw new Error(`Native replacement fixture stalled at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}

/** Only reorder undealt original cards; never manufacture hand, sale or Nexus receipts. */
function orderStartingCards(game: Game, buyer: string, reserved: readonly string[]): void {
  const pool = [...game.deck];
  const front: Card[] = [];
  for (const player of game.players) {
    for (let count = 0; count < (player.faction === 'harkonnen' ? 2 : 1); count++) {
      const index = pool.findIndex(card => !reserved.includes(card.id) &&
        (player.id === buyer && count === 0 ? card.effect === 'karama' : card.effect !== 'karama'));
      assert.ok(index >= 0);
      front.push(pool.splice(index, 1)[0]);
    }
  }
  // Keep the requested turn-two cards outside the native turn-one auction row.
  game.deck = [...front, ...pool.filter(card => !reserved.includes(card.id)),
    ...pool.filter(card => reserved.includes(card.id))];
}

/** Basic native Tleilaxu + classic setup, a full first turn, an actual alliance-
 * qualified closing Nexus draw, and an original paid normal-auction purchase.
 * The unplayed deck is ordered before native auction allocation, not the row. */
export function createNativeIxianReplacementFixture(
  options: NativeIxianReplacementOptions = {},
): NativeIxianReplacementFixture {
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || (game.status === 'setup' &&
      game.nexusIxianReplacementPreview === true && game.turn === 1 && game.phase === 0 &&
      game.players.every(player => player.hand.length === 0)));
  } else {
    game = createGame('NATIXREP', newPlayer('a', 'Atreides', 'atreides'), false, ['ix']);
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    joinGame(game, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  }
  assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, ['ix']);
  assert.ok(game.players.some(player => player.faction === 'tleilaxu'));
  const buyer = game.players.find(player => player.faction === (options.buyerFaction ?? 'atreides'))!.id;
  const partners = game.players.filter(player => player.id !== buyer);
  assert.ok(partners.length >= 2);
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game.nexusCards ??= { cards: null, phase: null };
    game = initializeIxianNexusReplacementGameForAudit(game);
  }
  const purchasedId = options.purchasedId ?? 'ix-thumper';
  const replacementId = options.replacementId ?? 'ix-amal';
  assert.notEqual(purchasedId, replacementId);
  assert.ok(game.deck.some(card => card.id === purchasedId));
  assert.ok(game.deck.some(card => card.id === replacementId));
  orderStartingCards(game, buyer, [purchasedId, replacementId]);
  const nexus = game.nexusCards!.cards!;
  assert.ok(Object.values(nexus.hands).every(face => face === null));
  nexus.deck = ['ixians', ...nexus.deck.filter(face => face !== 'ixians')];
  const setup = structuredClone(game);
  for (let step = 0; game.status === 'setup' && step < 100; step++) game = nativeStep(game);
  assert.equal(game.status, 'playing');
  assert.equal(game.players.find(player => player.faction === 'tleilaxu')!.faceDancers!.length, 3);
  assertNativeIxianReplacementInventory(game);
  for (let position = 0; position < 2; position++) {
    const index = game.spiceDeck.findIndex((card, at) => at >= position && 'territory' in card);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = advanceToNextStorm(game);
  assert.equal(game.turn, 2);
  for (let step = 0; game.phase !== 1 && step < 200; step++) game = nativeStep(game);
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed);
  assert.ok(worm >= 0);
  game.spiceDeck.splice(0, 0, game.spiceDeck.splice(worm, 1)[0]);
  for (let step = 0; !(game.nexus && !game.spiceWindow && !game.spiceResolution &&
    !game.phaseOpening && !game.response && !game.decision) && step < 200; step++) game = nativeStep(game);
  assert.equal(game.nexus, true);
  game = applyAction(game, partners[0].id, { type: 'alliance', target: partners[1].id });
  game = applyAction(game, partners[1].id, { type: 'alliance', target: partners[0].id });
  for (let step = 0; game.nexusCards?.phase?.stage !== 'drawing' && step < 200; step++) game = nativeStep(game);
  assert.equal(game.nexusCards?.phase?.stage, 'drawing');
  const beforeNexusDraw = structuredClone(game);
  const nexusDrawAction: Action = { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 };
  game = applyAction(game, buyer, nexusDrawAction);
  assert.equal(game.nexusCards!.cards!.hands[buyer], 'ixians');
  for (const id of game.nexusCards!.phase!.eligible)
    if (!game.nexusCards!.phase!.done.includes(id))
      game = applyAction(game, id, { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'keep', ownRedraws: 0 });

  const rowSize = game.players.filter(player => player.hand.length < (player.faction === 'harkonnen' ? 8 : 4)).length;
  const auctionOffset = options.endingAuction ? rowSize - 1 : 0;
  const purchasedIndex = game.deck.findIndex(card => card.id === purchasedId);
  assert.ok(purchasedIndex >= 0);
  const originalPurchase = game.deck.splice(purchasedIndex, 1)[0];
  const replacementIndex = game.deck.findIndex(card => card.id === replacementId);
  assert.ok(replacementIndex >= 0);
  const originalReplacement = game.deck.splice(replacementIndex, 1)[0];
  game.deck.splice(auctionOffset, 0, originalPurchase);
  // Native allocation takes one lot per non-full seat; its remaining deck top
  // is the requested original replacement, not an unsold reserved lot.
  game.deck.splice(rowSize, 0, originalReplacement);
  for (let step = 0; !(game.decision?.kind === 'auctionPayment' && game.decision.player === buyer) && step < 300; step++) {
    if (game.decision?.kind === 'auctionPayment')
      game = applyAction(game, game.decision.player, { type: 'decision', karama: false });
    else if (game.phaseOpening || game.response || game.decision || !game.auction) game = nativeStep(game);
    else if (options.endingAuction && game.auction.index < game.auction.cards.length - 1) {
      const active = game.players.find(player => player.id === game.auction!.active)!;
      game = applyAction(game, active.id, active.id !== buyer && active.faction !== 'harkonnen' && game.auction.bid === 0 ?
        { type: 'bid', amount: 1 } : { type: 'passBid' });
    } else game = applyAction(game, game.auction.active,
      game.auction.active === buyer && game.auction.bid === 0 ? { type: 'bid', amount: 2 } : { type: 'passBid' });
  }
  assert.deepEqual(game.decision, { kind: 'auctionPayment', player: buyer });
  assert.equal(game.auction!.cards[game.auction!.index].id, purchasedId);
  assert.equal(game.deck[0].id, replacementId);
  assert.equal(game.auction!.bid, 2);
  assert.equal(game.auction!.allyPayment ?? 0, 0);
  const beforePayment = structuredClone(game);
  const beforeSpice = game.players.find(player => player.id === buyer)!.spice;
  const emperor = game.players.find(player => player.faction === 'emperor')?.id ?? null;
  const beforeEmperorSpice = emperor ? game.players.find(player => player.id === emperor)!.spice : null;
  const purchased = structuredClone(game.auction!.cards[game.auction!.index]);
  const paymentAction: Action = { type: 'decision', karama: false };
  game = applyAction(game, buyer, paymentAction);
  assert.ok(game.pendingNexusIxianReplacement);
  assertNativeIxianReplacementInventory(game);
  return {
    setup, beforeNexusDraw, nexusDrawAction, beforePayment, game, buyer,
    event: game.pendingNexusIxianReplacement.event, purchased, paymentAction, beforeSpice,
    paidSpice: game.players.find(player => player.id === buyer)!.spice, emperor, beforeEmperorSpice,
    nextCard: structuredClone(game.deck[0]), auctionIndex: beforePayment.auction!.index,
  };
}
