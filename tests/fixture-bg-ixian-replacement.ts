import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { createIxianNexusReplacementFixture, settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

/** Original Advanced BG setup, native worm/alliance/Nexus deal and paid
 * Worthless purchase. Keep that first lot, then spend it on a second actual
 * normal auction lot. Only original undealt deck/Nexus order is selected. */
export function createOriginalBgIxianReplacement(use: 'purchase' | 'auctionPayment' = 'purchase') {
  const lobby = createGame('BGIXIANREPLACE', newPlayer('b', 'Bene Gesserit', 'beneGesserit'), true, []);
  joinGame(lobby, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(lobby, newPlayer('g', 'Guild', 'guild'));
  const first = createIxianNexusReplacementFixture({ initial: lobby, purchasedKind: 'worthless' });
  let game = settleIxianReplacementFixture(applyAction(first.game, first.buyer,
    { type: 'nexusIxianReplacementPass', event: first.event }));
  assert.ok(game.auction && !game.response && !game.decision && !game.phaseOpening);
  const cost = game.players.find(p => p.id === first.buyer)!.hand.find(c => c.id === first.purchased.id)!;
  assert.equal(cost.kind, 'worthless');
  const lot = game.auction.cards[game.auction.index];
  const next = game.deck[0]; assert.ok(next);
  if (use === 'auctionPayment') {
    for (let n = 0; game.auction!.active !== first.buyer && n < 10; n++)
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
    game = applyAction(game, first.buyer, { type: 'bid', amount: 2 });
    for (let n = 0; !game.decision && n < 10; n++)
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
    assert.deepEqual(game.decision, { kind: 'auctionPayment', player: first.buyer });
  }
  const beforeCost = structuredClone(game);
  const action: Action = use === 'purchase'
    ? { type: 'card', card: cost.id, mode: 'purchase' }
    : { type: 'decision', karama: true, card: cost.id };
  game = applyAction(game, first.buyer, action);
  return { game, beforeCost, buyer: first.buyer, cost, lot, next, action, use,
    provenance: 'Original setup, qualifying Nexus draw, paid Worthless purchase, original first-lot Pass, then native second-lot BG conversion; no played state staged.' };
}
export function allowBgIxianConversion(game: Game): Game {
  return settleIxianReplacementFixture(game);
}
