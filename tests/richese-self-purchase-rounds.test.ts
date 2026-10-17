import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  allowRicheseBureaucratResponses, chooseRicheseBureaucrat,
  richeseBureaucratCards, richeseBureaucratPlayer,
} from './fixture-bureaucrat-richese-funding';
import {
  createRicheseSelfPurchaseFixture, payRicheseSelfPurchase,
  type RicheseSelfPurchaseFixture,
} from './fixture-richese-self-purchase';
import { nextHomeworldEcazStep } from './fixture-homeworld-ecaz-occupy';

// Provisional shared Richese payment inheritance, not an official ruling on
// positive seller participation. The common producer retains the native setup,
// real Mentat bribe/worm alliance and conserved original counter-card swap.
function retained(game: Game, f: RicheseSelfPurchaseFixture) {
  assert.deepEqual(richeseBureaucratPlayer(game, f.seller).hand.map(c => c.id), f.originalHand,
    'Paid retention neither removes/reappends the offered card nor makes an acquisition');
  assert.equal(richeseBureaucratPlayer(game, f.seller).hand.filter(c => c.id === f.card).length, 1);
  for (const player of game.players)
    assert.deepEqual(player.hand.map(c => c.id), richeseBureaucratPlayer(f.beforeAction, player.id).hand.map(c => c.id));
  assert.deepEqual(richeseBureaucratCards(game), f.physical);
  assert.deepEqual(game.richeseCache, f.beforeAction.richeseCache);
}

function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected input preserves custody, wallets, prepaid aid and the original opportunity');
}

function emperorAllowance(game: Game, f: RicheseSelfPurchaseFixture) {
  retained(game, f);
  assert.equal(game.response?.kind, 'emperorIncome');
  assert.equal(game.response!.owner, f.emperor);
  assert.ok(viewGame(game, f.counterActor).responseControls?.cancelCards.includes(f.counterCard!));
  assert.equal(viewGame(game, f.trainer!).bureaucrat.pending, null,
    'Native Emperor Karama allowance precedes any optional Bureaucrat diversion');
  assert.equal(richeseBureaucratPlayer(game, f.emperor!).spice,
    richeseBureaucratPlayer(f.beforeAction, f.emperor!).spice);
  assert.equal(richeseBureaucratPlayer(game, f.seller).spice,
    richeseBureaucratPlayer(f.beforeAction, f.seller).spice - f.primary);
  assert.equal(game.currentAuctionSale!.winner, f.seller);
  assert.equal(game.currentAuctionSale!.seller, f.seller);
  assert.equal(game.currentAuctionSale!.origin, 'blackMarket');
  assert.equal(game.currentAuctionSale!.amount, f.price);
  assert.equal(game.currentAuctionSale!.free, false);
  const invoice = game.currentAuctionSale!.bureaucratPayment!;
  assert.equal(invoice.payer, f.seller);
  assert.equal(invoice.payee, f.emperor);
  assert.equal(invoice.amount, f.price);
}

function declaration(game: Game, f: RicheseSelfPurchaseFixture, sold: boolean) {
  retained(game, f);
  assert.equal(game.phase, 3);
  assert.equal(game.richeseBidding!.blackMarketSold, sold);
  assert.equal(game.decision?.kind, 'richeseDeclaration');
  assert.equal(game.decision!.player, f.seller);
  assert.equal(game.currentAuctionSale, null);
  assert.equal(game.richeseAuction, null);
  assert.equal(game.response, null);
}

void test('provisional Normal own5 retention pays Emperor once, permits native Karama then Bureaucrat2, and resumes original normal controls', () => {
  const f = createRicheseSelfPurchaseFixture({ method: 'normal', price: 5, emperor: true, counter: true });
  let game = f.game;
  for (let n = 0; game.richeseAuction!.active !== f.seller && n < game.players.length; n++) {
    const actor = game.richeseAuction!.active!;
    game = applyAction(game, actor, { type: 'richeseBid', event: f.action.event, amount: null });
  }
  assert.equal(game.richeseAuction!.active, f.seller);
  rejectUnchanged(game, f.seller, { ...f.action, event: game.richeseBidding!.event });
  rejectUnchanged(game, f.seller, { ...f.action, amount: 6 });
  game = payRicheseSelfPurchase({ ...f, game });
  emperorAllowance(game, f);
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  const event = game.bureaucratPaymentEvent!;
  for (const player of game.players) {
    const pending = viewGame(game, player.id).bureaucrat.pending!;
    assert.equal(pending.payee, f.emperor);
    assert.equal(pending.amount, 5);
    assert.equal(pending.payer, f.seller);
  }
  game = chooseRicheseBureaucrat(game, true);
  declaration(game, f, true);
  for (const player of game.players) {
    const delta = -Number(player.id === f.seller) * 5
      + Number(player.id === f.emperor) * 3;
    assert.equal(player.spice, richeseBureaucratPlayer(f.beforeAction, player.id).spice + delta);
  }
  assert.equal(viewGame(game, f.trainer!).bureaucrat.usedThisPhase, true);
  rejectUnchanged(game, f.seller, f.action);
  rejectUnchanged(game, f.trainer!, { type: 'decision', event, redirect: true });

  const normalCount = game.richeseBidding!.normalCount!;
  game = applyAction(game, f.seller,
    { type: 'decision', event: game.richeseBidding!.event, position: 'last' });
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assert.equal(game.auction!.cards.length, normalCount);
  const next = nextHomeworldEcazStep(game);
  assert.ok(next);
  assert.equal(next.action.type, 'passBid');
  assert.equal(next.actor, game.auction!.active, 'Use the original next controller, not a fixed Storm opener');
  game = applyAction(game, next.actor, next.action);
  retained(game, f);
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(game.richeseBidding!.normalCount, normalCount, 'Continuing the auction does not count retention twice');
});

void test('provisional Once Around outbids a real1 with R5/ally3, while all-other-pass remains free unsold without an owner opportunity', () => {
  const f = createRicheseSelfPurchaseFixture({ method: 'onceAround', direction: 'counterclockwise',
    price: 8, allyPayment: 3, emperor: true, counter: true });
  const free = payRicheseSelfPurchase({ ...f, actions: [] }, { openingBid: 0 });
  declaration(free, f, false);
  for (const player of free.players)
    assert.equal(player.spice, richeseBureaucratPlayer(f.beforeAction, player.id).spice);
  assert.equal(free.aid[f.donor!].amount, 3, 'Free unsold retention consumes none of the real prepaid aid');
  assert.equal(viewGame(free, f.trainer!).bureaucrat.usedThisPhase, false);
  rejectUnchanged(free, f.seller, f.action);

  let game = f.game;
  const openingActor = game.richeseAuction!.active!;
  assert.notEqual(openingActor, f.seller);
  game = applyAction(game, openingActor, { type: 'richeseBid', event: f.action.event, amount: 1, allyPayment: 0 });
  assert.equal(game.richeseAuction!.bidder, openingActor);
  assert.equal(game.richeseAuction!.bid, 1);
  for (let n = 0; game.richeseAuction!.active !== f.seller && n < game.players.length; n++)
    game = applyAction(game, game.richeseAuction!.active!, { type: 'richeseBid', event: f.action.event, amount: null });
  assert.equal(game.richeseAuction!.active, f.seller);
  rejectUnchanged(game, openingActor, { type: 'richeseBid', event: f.action.event, amount: 2 });
  rejectUnchanged(game, f.seller, { ...f.action, amount: 9 });
  rejectUnchanged(game, f.seller, { ...f.action, allyPayment: 4 });
  game = applyAction(game, f.seller, f.action);
  emperorAllowance(game, f);
  assert.equal(game.aid[f.donor!].amount, 0);
  assert.deepEqual(game.currentAuctionSale!.bureaucratPayment!.contributions,
    [{ payer: f.seller, amount: 5 }, { payer: f.donor!, amount: 3 }]);
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  const source = game.bureaucratPayments!.pending!.source;
  assert.equal(source.payee, f.emperor);
  assert.equal(source.amount, 8);
  for (const player of game.players) {
    const pending = viewGame(game, player.id).bureaucrat.pending!;
    assert.equal(pending.payer, null, 'Actual allied payment shares remain private');
    assert.equal(pending.payee, f.emperor);
    assert.equal(pending.amount, 8, 'Public payment is the whole original price');
  }
  game = chooseRicheseBureaucrat(game, false);
  declaration(game, f, true);
  for (const player of game.players) {
    const delta = -Number(player.id === f.seller) * 5 - Number(player.id === f.donor) * 3
      + Number(player.id === f.emperor) * 8;
    assert.equal(player.spice, richeseBureaucratPlayer(f.beforePledge, player.id).spice + delta,
      'Only actual retained funding is paid; the outbid bidder is not charged and Richese is not refunded');
  }
  assert.equal(game.aid[f.donor!].amount, 0);
  assert.equal(viewGame(game, f.trainer!).bureaucrat.usedThisPhase, false);
  assert.equal(free.richeseBidding!.normalCount, game.richeseBidding!.normalCount! + 1,
    'Exactly the positive sale, not free retention, removes one ordinary lot');
  rejectUnchanged(game, f.seller, f.action);

  game = applyAction(game, f.seller,
    { type: 'decision', event: game.richeseBidding!.event, position: 'first' });
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.decision?.kind, 'richeseCache');
  assert.equal(game.decision!.player, f.seller);
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(game.auction, null, 'Cache-first continues to the actual cache choice before dealing ordinary cards');
  retained(game, f);
});

void test('original no-Emperor Nexus table pays for retained ownership without inventing a free seller acquisition', () => {
  let game = createGame('RETAINNEXUS', newPlayer('richese', 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  game = applyAction(game, game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = applyAction(game, game.host, { type: 'start', advancedPreview: true });
  for (let n = 0; game.decision?.kind !== 'richeseBlackMarket' && n < 300; n++) {
    let step: { actor: string; action: Action } | undefined;
    if (game.status === 'setup') {
      for (const player of game.players) {
        const view = viewGame(game, player.id);
        view.players.find(p => p.id === player.id)!.bot = 'Easy';
        const action = botActions(view)[0];
        if (action) { step = { actor: player.id, action }; break; }
      }
    } else step = nextHomeworldEcazStep(game) ?? undefined;
    assert.ok(step);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.decision?.kind, 'richeseBlackMarket');
  const card = richeseBureaucratPlayer(game, 'richese').hand[0].id;
  game = applyAction(game, 'richese', { type: 'decision', event: game.richeseBidding!.event, card, method: 'silent' });
  game = allowRicheseBureaucratResponses(game);
  const before = structuredClone(game), event = game.richeseAuction!.event;
  game = applyAction(game, 'richese', { type: 'richeseBid', event, amount: 1, allyPayment: 0 });
  for (const actor of before.richeseAuction!.order) if (actor !== 'richese')
    game = applyAction(game, actor, { type: 'richeseBid', event, amount: 0 });
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.decision?.kind, 'richeseDeclaration');
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, richeseBureaucratPlayer(before, 'richese').spice - 1);
  for (const player of game.players) {
    assert.deepEqual(player.hand, richeseBureaucratPlayer(before, player.id).hand);
    if (player.id !== 'richese') assert.equal(player.spice, richeseBureaucratPlayer(before, player.id).spice);
  }
  assert.deepEqual(game.nexusCards, before.nexusCards);
  assert.deepEqual(richeseBureaucratCards(game), richeseBureaucratCards(before));
});
