import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action } from '../game/engine';
import { createIxianNexusReplacementFixture, settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

/** Original four-seat setup, qualifying alliance/Nexus draw and normal paid
 * purchases. Atreides retains its original starting Karama as a real counter.
 * Only undealt deck/Nexus order is selected; no played state is staged. */
export function createOriginalHarkonnenReplacement(advanced = false) {
  const lobby = createGame('HARKREPLACE', newPlayer('a', 'Atreides', 'atreides'), advanced, []);
  joinGame(lobby, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(lobby, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(lobby, newPlayer('g', 'Guild', 'guild'));
  const first = createIxianNexusReplacementFixture({ initial: lobby, face: 'richese',
    otherDraw: { player: 'h', face: 'ixians' } });
  let game = settleIxianReplacementFixture(applyAction(first.game, first.buyer,
    { type: 'nexusIxianReplacementPass', event: first.event }));
  for (let n = 0; game.auction!.active !== 'h' && n < 20; n++)
    game = applyAction(game, game.auction!.active, { type: 'passBid' });
  const lot = game.auction!.cards[game.auction!.index];
  const beforeBid = structuredClone(game);
  game = applyAction(game, 'h', { type: 'bid', amount: 2 });
  let beforePurchase = structuredClone(game);
  let purchaseAction: Action = { type: 'passBid' }, actor = '';
  for (let n = 0; !game.currentAuctionSale && n < 30; n++) {
    beforePurchase = structuredClone(game);
    actor = game.decision?.player ?? game.auction!.active;
    purchaseAction = game.decision?.kind === 'auctionPayment'
      ? { type: 'decision', karama: false } : { type: 'passBid' };
    game = applyAction(game, actor, purchaseAction);
  }
  assert.ok(game.currentAuctionSale);
  assert.equal(game.currentAuctionSale.winner, 'h');
  return { game, beforeBid, beforePurchase, purchaseAction, actor, lot,
    buyer: 'h', counter: 'a', next: game.deck[0], afterNext: game.deck[1],
    provenance: 'Original four-seat setup, native worm/alliance and two natural Nexus draws, actual Atreides first purchase/Keep then paid Harkonnen second lot; no played-state staging.' };
}
