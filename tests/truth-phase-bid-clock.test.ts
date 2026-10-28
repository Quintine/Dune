import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceAuctionClock, applyAction, hasAuctionClockOpportunity, synchronizeAuctionClock,
  viewGame } from '../game/engine';
import { truthBidInventory } from './fixture-truth-bid';
import { advanceTruthTurnBid, bindTruthTurnBid, createTruthTurnBidFixture,
  finishTruthTurnBidLot, purchaseTruthTurnBidLot, truthTurnBidClean,
  truthTurnBidPlayer } from './fixture-truth-turn-bid';

const epoch = 'phase-bid-test:0';

/** All three lots are original cards reached through the actual Basic auction.
 * Earlier cards are purchased through native bids, never staged into a hand. */
function finalLot(answer: 'yes' | 'no') {
  const fixture = createTruthTurnBidFixture();
  let game = fixture.game;
  for (let n = 0; n < 2; n++) game = purchaseTruthTurnBidLot(game, fixture.opponent).game;
  assert.equal(game.auction?.index, 2);
  game = advanceTruthTurnBid(game, state => truthTurnBidClean(state) &&
    state.auction?.active === fixture.target);
  game = bindTruthTurnBid(fixture, answer, 4, game).game;
  assert.equal(game.auction?.active, fixture.target);
  assert.equal(game.auction?.clockVersion, 1);
  assert.ok(hasAuctionClockOpportunity(game));
  return { fixture, game, card: game.auction!.cards[game.auction!.index].id };
}

void test('a real expiring last-lot clock submits the required phase Yes bid and keeps native payment', () => {
  const { fixture: f, game, card } = finalLot('yes');
  const original = structuredClone(game);
  assert.throws(() => applyAction(game, f.target, { type: 'passBid' }));
  assert.deepEqual(game, original);
  const guide = viewGame(game, f.target).phaseBidPromiseGuide;
  assert.ok(guide); assert.equal(guide.action.type, 'bid'); assert.equal(guide.action.amount, 4);
  const armed = synchronizeAuctionClock(game, 1_000, epoch);
  assert.equal(advanceAuctionClock(armed, 10_999, epoch), armed);
  const expired = advanceAuctionClock(armed, 11_000, epoch);
  assert.equal(expired.auction?.bidder, f.target);
  assert.equal(expired.auction?.bid, 4);
  assert.equal(truthTurnBidPlayer(expired, f.target).spice, truthTurnBidPlayer(game, f.target).spice,
    'A deadline declaration does not prepay or waive the native invoice');
  assert.ok(expired.phaseBidPromises?.some(row => row.player === f.target && row.minimum === 4 && row.fulfilled));
  assert.match(expired.log.at(-1)!.text, /legal bid required by their binding Truthtrance answer was submitted/);
  assert.deepEqual(truthBidInventory(expired), f.originalCards);
  const settled = finishTruthTurnBidLot(expired);
  assert.equal(truthTurnBidPlayer(settled, f.target).spice, truthTurnBidPlayer(game, f.target).spice - 4);
  assert.ok(truthTurnBidPlayer(settled, f.target).hand.some(item => item.id === card));
  assert.deepEqual(truthBidInventory(settled), f.originalCards);
});

void test('a real expiring last-lot clock preserves phase No and takes the legal pass', () => {
  const { fixture: f, game } = finalLot('no');
  assert.throws(() => applyAction(game, f.target, { type: 'bid', amount: 4, allyPayment: 0 }));
  const expected = applyAction(game, f.target, { type: 'passBid' });
  const armed = synchronizeAuctionClock(game, 1_000, epoch);
  const expired = advanceAuctionClock(armed, 11_000, epoch);
  assert.equal(expired.phase, expected.phase);
  assert.deepEqual(expired.auction, expected.auction);
  assert.deepEqual(expired.phaseBidPromises, expected.phaseBidPromises);
  assert.ok(expired.phaseBidPromises?.some(row => row.player === f.target && !row.answer && !row.fulfilled && !row.released),
    'A phase-wide No stays live while other bidders can still act');
  assert.match(expired.log.at(-1)!.text, /ten-second bidding time expired; they passed/);
  assert.deepEqual(truthBidInventory(expired), f.originalCards);
  const closed = advanceTruthTurnBid(expired, state => state.phase !== 3);
  assert.ok(closed.phaseBidPromises?.some(row => row.player === f.target && !row.answer && row.fulfilled),
    'The No is fulfilled only after the actual Bidding phase closes');
  assert.deepEqual(truthBidInventory(closed), f.originalCards);
});
