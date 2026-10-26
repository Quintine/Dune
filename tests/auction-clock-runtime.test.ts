import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, advanceAuctionClock, hasAuctionClockOpportunity, synchronizeAuctionClock,
  viewGame } from '../game/engine';
import { createTruthBidFixture as fixture, declareTruthBid as declare, askTruthBid as ask,
  answerTruthBid as answer, bindTruthBid as bind, continueTruthBidLot as closeLot,
  truthBidInventory as inventory, truthBidPlayer as player } from './fixture-truth-bid';
import { createTruthTurnPreparationFixture as preparation, bindTruthTurnPreparation as bindPreparation,
  truthTurnPreparationBid as bid, truthTurnPreparationGroup as group,
  truthTurnPreparationPayment as payment, settleTruthTurnPreparation as settle } from './fixture-truth-turn-preparation';
const epoch = '0:0';

void test('native Basic and Advanced original auction lots expire at ten seconds through the canonical pass', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), before = structuredClone(f.game), actor = f.game.auction!.active;
    assert.equal(f.game.auction!.clockVersion, 1); assert.equal(f.game.auctionClock, undefined);
    assert.equal(hasAuctionClockOpportunity(f.game), true);
    const armed = synchronizeAuctionClock(f.game, 1_000, epoch);
    const early = advanceAuctionClock(armed, 10_999, epoch);
    assert.deepEqual(early, armed); assert.deepEqual(f.game, before);
    const expected = applyAction(f.game, actor, { type: 'passBid' });
    const expired = advanceAuctionClock(early, 11_000, epoch);
    assert.deepEqual(expired.auction, expected.auction); assert.equal(expired.active, expected.active);
    assert.notEqual(expired.auctionClock!.event, armed.auctionClock!.event);
    assert.equal(expired.auctionClock!.remainingMs, 10_000); assert.equal(expired.auctionClock!.startedAt, 11_000);
    assert.match(expired.log.at(-1)!.text, /ten-second bidding time expired; they passed/);
    assert.deepEqual(inventory(expired), f.originalCards);
  }
});

void test('a real raised bid starts the next bidder clock while unchanged polls cannot refresh it', () => {
  const f = fixture(), actor = f.game.auction!.active;
  let game = synchronizeAuctionClock(f.game, 1_000, epoch);
  const original = game.auctionClock!.event;
  game = applyAction(game, actor, { type: 'bid', amount: 1, allyPayment: 0 });
  game = synchronizeAuctionClock(game, 5_000, epoch);
  const next = game.auctionClock!; assert.notEqual(next.event, original);
  assert.equal(next.player, game.auction!.active); assert.equal(next.startedAt, 5_000);
  const observed = advanceAuctionClock(game, 14_999, epoch); assert.equal(observed, game);
  assert.equal(observed.auctionClock, next);
  const expired = advanceAuctionClock(observed, 15_000, epoch);
  assert.ok(expired.auction?.passed.includes(next.player) || expired.auction?.index !== game.auction!.index);
  assert.deepEqual(inventory(expired), f.originalCards);
});

void test('actual Truthtrance suspends the remaining bid budget and the resolved native question resumes it', () => {
  const f = fixture({ window: 'active' });
  let game = synchronizeAuctionClock(f.game, 1_000, epoch);
  game = declare(f, game).game; game = synchronizeAuctionClock(game, 3_000, epoch);
  assert.equal(game.auctionClock!.remainingMs, 8_000); assert.equal(game.auctionClock!.startedAt, null);
  const event = game.auctionClock!.event, waiting = advanceAuctionClock(game, 50_000, epoch);
  assert.deepEqual(waiting, game); assert.equal(waiting.auction!.active, f.target);
  game = ask(waiting, f.asker, f.target, 4); game = answer(game, f.target, 'no');
  game = synchronizeAuctionClock(game, 50_000, epoch);
  assert.equal(game.auctionClock!.event, event); assert.equal(game.auctionClock!.remainingMs, 8_000);
  assert.equal(game.auctionClock!.startedAt, 50_000);
  assert.equal(advanceAuctionClock(game, 57_999, epoch), game);
  const expired = advanceAuctionClock(game, 58_000, epoch);
  assert.match(expired.log.at(-1)!.text, /passed this bid/); assert.deepEqual(inventory(expired), f.originalCards);
});

void test('a timeout cannot evade a native Truthtrance Yes and submits only its required bid before normal paid purchase', () => {
  const f = fixture({ window: 'active' });
  let game = bind(f, 'yes', 4).game; game = synchronizeAuctionClock(game, 1_000, epoch);
  const before = structuredClone(game); game = advanceAuctionClock(game, 11_000, epoch);
  assert.equal(before.auction!.bid, 0); assert.equal(game.auction!.bid, 4); assert.equal(game.auction!.bidder, f.target);
  assert.equal(player(game, f.target).spice, 10, 'The bid is a declaration, not a free or prepaid purchase');
  assert.match(game.log.at(-1)!.text, /legal bid required by their binding Truthtrance answer was submitted/);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 6);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.ok(game.bidPromises!.every(promise => promise.fulfilled)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('a whole bid AND payment deadline selects the required bid even when its voluntary guide offers payment first', () => {
  const f = preparation();
  const mixed = group('and', bid(f.lot!, 3), payment(f.recipient));
  let game = bindPreparation(f, 'yes', mixed).game;
  assert.equal(viewGame(game, f.target).turnActionGuide!.action.type, 'bribe');
  game = synchronizeAuctionClock(game, 1_000, epoch); game = advanceAuctionClock(game, 11_000, epoch);
  assert.equal(game.auction!.bidder, f.target); assert.equal(game.auction!.bid, 3);
  assert.equal(game.turnActionPromises![0].preparation!.bid!.maximum, 3);
  assert.equal(game.turnActionPromises![0].fulfilled, false);
  game = applyAction(game, f.target, f.payment); assert.equal(game.turnActionPromises![0].fulfilled, true);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 5);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a whole bid OR payment keeps its legal timeout pass and the remaining real payment alternative', () => {
  const f = preparation(), mixed = group('or', bid(f.lot!, 3), payment(f.recipient));
  let game = bindPreparation(f, 'yes', mixed).game;
  game = synchronizeAuctionClock(game, 1_000, epoch);
  const nativePass = applyAction(game, f.target, { type: 'passBid' });
  game = advanceAuctionClock(game, 11_000, epoch);
  assert.deepEqual(game.auction, nativePass.auction); assert.equal(game.phase, nativePass.phase);
  assert.notEqual(game.auction?.bidder, f.target);
  assert.match(game.log.at(-1)!.text, /passed this bid/);
  assert.equal(game.turnActionPromises![0].fulfilled, false); assert.equal(game.turnActionPromises![0].released, false);
  game = settle(game); game = applyAction(game, f.target, f.payment);
  assert.equal(game.turnActionPromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a compelled bid uses the lowest legal whole-answer alternative regardless of question order', () => {
  const f = preparation();
  const mixed = group('or', bid(f.lot!, 5), bid(f.lot!, 3));
  let game = bindPreparation(f, 'yes', mixed).game;
  assert.equal(viewGame(game, f.target).turnActionGuide!.action.amount, 5);
  game = synchronizeAuctionClock(game, 1_000, epoch);
  game = advanceAuctionClock(game, 11_000, epoch);
  assert.equal(game.auction!.bid, 3); assert.equal(game.auction!.bidder, f.target);
  assert.equal(game.turnActionPromises![0].fulfilled, true);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 7);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a controlled legacy open lot remains untimed and its actual newly retired next lot adopts the clock', () => {
  const f = fixture(), legacy = structuredClone(f.game); delete legacy.auction!.clockVersion;
  assert.equal(hasAuctionClockOpportunity(legacy), false);
  assert.equal(synchronizeAuctionClock(legacy, 1_000, epoch), legacy);
  assert.equal(advanceAuctionClock(legacy, 1_000_000, epoch), legacy);
  assert.equal(viewGame(legacy, f.asker).auctionClock, null);
  let game = applyAction(legacy, legacy.auction!.active, { type: 'bid', amount: 1, allyPayment: 0 });
  game = closeLot(game); assert.equal(game.auction!.index, 1); assert.equal(game.auction!.clockVersion, 1);
  assert.equal(hasAuctionClockOpportunity(game), true); assert.equal(synchronizeAuctionClock(game, 1_000_000, epoch).auctionClock!.remainingMs, 10_000);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('only public bidder time is projected and the private physical-card source never enters the clock view', () => {
  const f = fixture(); const game = synchronizeAuctionClock(f.game, 1_000, epoch);
  for (const owner of game.players) {
    const view = viewGame(game, owner.id, 3_250);
    assert.deepEqual(Object.keys(view.auctionClock!).sort(), ['event', 'player', 'remainingMs', 'running']);
    assert.equal(view.auctionClock!.remainingMs, 7_750); assert.equal(view.auctionClock!.player, game.auction!.active);
    assert.ok(!JSON.stringify(view.auctionClock).includes(f.lotCard));
    assert.equal(view.auction?.clockVersion, 1);
  }
  const rearmed = synchronizeAuctionClock(game, 100_000, '2:0');
  assert.equal(rearmed.auctionClock!.remainingMs, 10_000); assert.equal(rearmed.auctionClock!.startedAt, 100_000);
  assert.equal(game.auctionClock!.startedAt, 1_000);
});
