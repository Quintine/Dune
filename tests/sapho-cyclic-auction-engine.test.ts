import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actSaphoCyclic, advanceSaphoCyclic, completeSaphoCyclicAuction, createSaphoCyclicAuctionFixture, saphoCyclicAction,
  saphoCyclicBid, saphoCyclicLot, saphoCyclicPlayer as player, type SaphoCyclicAuctionFixture,
} from './fixture-sapho-cyclic-auction';

function source(f: SaphoCyclicAuctionFixture) {
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.card));
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.equal(saphoCyclicLot(f.game).bid, 0);
  assert.equal(player(f.game).hand.some(card => card.id === f.card), true);
  if (f.kind === 'blackMarket') {
    assert.equal(f.game.advanced, true);
    assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'seatPosition' && step.action.position === 5));
    assert.equal(f.lobby.playerPositions![f.owner], 5,
      'The actual pre-start circle choice leaves genuine forward first/last options after the native second Storm');
    assert.equal(f.blackMarketStep!.action.method, 'normal');
    assert.ok(player(f.afterSetup, f.seller).hand.some(card => card.id === f.target));
    assert.ok(player(f.game, f.seller).hand.some(card => card.id === f.target));
  }
}
function finished(f: SaphoCyclicAuctionFixture, result: ReturnType<typeof completeSaphoCyclicAuction>) {
  const before = saphoCyclicLot(result.beforeSapho), ordered = saphoCyclicLot(result.ordered);
  assert.equal(before.bid, 1);
  assert.equal(ordered.bid, before.bid);
  assert.equal(ordered.bidder, before.bidder);
  assert.deepEqual(ordered.passed, before.passed);
  assert.deepEqual(ordered.funding, before.funding);
  assert.deepEqual(result.ordered.order, result.beforeSapho.order);
  assert.deepEqual(result.ordered.players.map(player => player.spice), result.beforeSapho.players.map(player => player.spice));
  assert.equal(result.ordered.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(result.ordered).hand.some(card => card.id === f.card), false);
  assert.equal(player(result.beforeSapho).spice - player(result.game).spice, 4,
    'Native sale debits the final strict winning bid once');
  assert.equal(player(result.game).hand.filter(card => card.id === f.target).length, 1);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(result.game.order, f.game.order);
  const raises = result.bids.filter(bid => bid.step.actor === f.owner && bid.step.action.amount !== undefined && bid.step.action.amount !== null);
  assert.deepEqual(raises.map(bid => bid.step.action.amount), [2, 4], 'Going first/last does not remove ordinary cyclic bidding on a later wrap');
  assert.throws(() => actSaphoCyclic(result.game, f.owner, result.action), /Sapho|card|hand|opportunity|expired/i);
}

void test('genuine paid Sapho first and last preserve a prior funded raise and ordinary next-lot rotation in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const f = createSaphoCyclicAuctionFixture({ advanced });
    source(f);
    for (const mode of ['first', 'last'] as const) {
      const result = completeSaphoCyclicAuction(f, mode);
      finished(f, result);
      assert.equal(result.action.scope, 'cyclicAuction');
      assert.equal(saphoCyclicLot(result.ordered).active === f.owner, mode === 'first');
      assert.equal(result.ordered.auction!.opener, f.originalOpener);
      assert.equal(result.game.auction!.index, f.game.auction!.index + 1);
      assert.equal(result.game.auction!.opener, (f.originalOpener + 1) % f.game.order.length);
      assert.equal(result.game.auction!.active, f.game.order[(f.originalOpener + 1) % f.game.order.length]);
      assert.equal(result.game.auction!.bid, 0);
      assert.equal(result.game.auction!.bidder, null);
      assert.deepEqual(result.game.auction!.passed, []);
    }
  }
});

void test('genuine Advanced Black Market Sapho keeps the original sale price, seller payment and following normal opener', () => {
  const f = createSaphoCyclicAuctionFixture({ advanced: true, blackMarket: true });
  source(f);
  for (const mode of ['first', 'last'] as const) {
    const result = completeSaphoCyclicAuction(f, mode);
    finished(f, result);
    assert.equal(player(result.game, f.seller).hand.some(card => card.id === f.target), false);
    assert.equal(player(result.game, f.seller).spice - player(result.beforeSapho, f.seller).spice, 4,
      'The native original seller receives the full sale once');
    assert.equal(result.game.richeseBidding!.blackMarketSold, true);
    assert.equal(result.game.auction!.opener, (f.originalOpener + 1) % f.game.order.length);
    assert.equal(result.game.auction!.active, f.game.order[(f.originalOpener + 1) % f.game.order.length]);
    assert.equal(result.game.auction!.index, 0);
  }
});

void test('actual current-first, highest-bidder and passed-holder positions cannot spend Sapho for a no-op or renewed chance', () => {
  const f = createSaphoCyclicAuctionFixture();
  const initial = saphoCyclicAction(f.game, 'first');
  let current = structuredClone(f.game);
  for (let count = 0; saphoCyclicLot(current).active !== f.owner && count < 8; count++) {
    const step = saphoCyclicBid(current, null); current = actSaphoCyclic(current, step.actor, step.action);
  }
  assert.equal(saphoCyclicLot(current).active, f.owner);
  assert.equal(viewGame(current, f.owner).saphoOptions.some(option => option.scope === 'cyclicAuction' && option.mode === 'first'), false);
  assert.throws(() => actSaphoCyclic(current, f.owner, initial), /Sapho|opportunity|expired|no.op/i);
  const highStep = saphoCyclicBid(current, 1), highest = actSaphoCyclic(current, highStep.actor, highStep.action);
  assert.equal(saphoCyclicLot(highest).bidder, f.owner);
  assert.equal(viewGame(highest, f.owner).saphoOptions.some(option => option.scope === 'cyclicAuction'), false);
  assert.throws(() => actSaphoCyclic(highest, f.owner, initial), /Sapho|opportunity|expired|bid/i);
  const passStep = saphoCyclicBid(current, null), passed = actSaphoCyclic(current, passStep.actor, passStep.action);
  assert.ok(saphoCyclicLot(passed).passed.includes(f.owner));
  assert.equal(viewGame(passed, f.owner).saphoOptions.some(option => option.scope === 'cyclicAuction'), false);
  assert.throws(() => actSaphoCyclic(passed, f.owner, initial), /Sapho|opportunity|expired|pass/i);
  for (const game of [current, highest, passed]) {
    assert.ok(player(game).hand.some(card => card.id === f.card));
    assert.equal(game.discard.some(card => card.id === f.card), false);
  }
});

void test('a genuinely full hand from paid purchases gains one current-lot slot by discarding Sapho', () => {
  const f = createSaphoCyclicAuctionFixture({ fullHand: true });
  source(f);
  assert.equal(player(f.game).hand.length, 4);
  assert.equal(f.actions.filter(step => step.actor === f.owner && step.action.type === 'bid' && step.action.amount === 1).length, 2);
  const result = completeSaphoCyclicAuction(f, 'first');
  finished(f, result);
  assert.equal(player(result.ordered).hand.length, 3);
  assert.equal(saphoCyclicLot(result.ordered).active, f.owner);
  assert.equal(player(result.game).hand.length, 4);
});

void test('all four minimal policies use legal original ordinary and Black Market cyclic Sapho options', () => {
  for (const blackMarket of [false, true]) {
    const f = createSaphoCyclicAuctionFixture({ advanced: blackMarket, blackMarket });
    const raise = saphoCyclicBid(f.game, 1), game = actSaphoCyclic(f.game, raise.actor, raise.action);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(game, f.owner);
      view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'card' && action.card === f.card && action.scope === 'cyclicAuction');
      assert.ok(action, `${difficulty} retains the owned original cyclic Sapho option`);
      const next = actSaphoCyclic(structuredClone(game), f.owner, action);
      assert.deepEqual(next.order, game.order);
      assert.equal(saphoCyclicLot(next).bid, 1);
      assert.equal(saphoCyclicLot(next).bidder, saphoCyclicLot(game).bidder);
      assert.equal(next.discard.filter(card => card.id === f.card).length, 1);
    }
  }
});

void test('genuine pending passes survive Sapho and cannot receive a repeat turn before a real raise', () => {
  for (const blackMarket of [false,true]) {
    const f = createSaphoCyclicAuctionFixture({advanced:blackMarket,blackMarket});
    const raised = saphoCyclicBid(f.game,1);
    let game = actSaphoCyclic(f.game,raised.actor,raised.action);
    const earlier = saphoCyclicBid(game,null);
    game = actSaphoCyclic(game,earlier.actor,earlier.action);
    assert.equal(saphoCyclicLot(game).active,f.owner);
    const before = saphoCyclicLot(game);
    game = actSaphoCyclic(game,f.owner,saphoCyclicAction(game,'last'));
    // Fresh Basic Richese also offers its original public used-card response.
    // Finish that real boundary before another bidder acts; do not skip it.
    game = advanceSaphoCyclic(game,state=>!state.pendingTreacheryDiscard);
    assert.deepEqual(saphoCyclicLot(game).passed,before.passed);
    const nextPass = saphoCyclicBid(game,null);
    game = actSaphoCyclic(game,nextPass.actor,nextPass.action);
    assert.equal(saphoCyclicLot(game).active,f.owner,
      'The earlier passed seat is skipped in the changed cycle');
    const standingPrice = saphoCyclicBid(game,1), snapshot = structuredClone(game);
    assert.throws(() => actSaphoCyclic(game,standingPrice.actor,standingPrice.action),/bid|raise/i);
    assert.deepEqual(game,snapshot);
    const newRaise = saphoCyclicBid(game,2);
    game = actSaphoCyclic(game,newRaise.actor,newRaise.action);
    assert.deepEqual(saphoCyclicLot(game).passed,[],
      'A genuine raise reopens the previously passed native opportunity');
    assert.deepEqual(game.order,f.game.order);
  }
});
