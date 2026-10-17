import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  allowRicheseBureaucratResponses,
  chooseRicheseBureaucrat,
  createRicheseBureaucratFixture,
  payRicheseBureaucrat,
  richeseBureaucratCards,
  richeseBureaucratPlayer,
  type RicheseBureaucratFixture,
} from './fixture-bureaucrat-richese-funding';

function allocation(game: Game, f: RicheseBureaucratFixture, payee: string) {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(game.decision!.player, f.trainer);
  const event = game.bureaucratPaymentEvent;
  assert.ok(event);
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    assert.deepEqual(view.bureaucrat.pending, {
      event,
      owner: f.trainer,
      payer: null,
      payee,
      amount: f.price,
      kind: 'auction',
      redirect: 2,
      richeseAllocation: true,
    }, 'Every seat sees the original public price, never the private recipient leg or qualifying payer');
    assert.equal('bureaucratPayments' in view, false);
    assert.equal('bureaucratUseEvents' in view, false);
  }
  return event;
}

function paidOnce(game: Game, f: RicheseBureaucratFixture, sellerReceipt: number, emperorReceipt: number) {
  const balances = new Map(f.beforePledge.players.map(player => [player.id, player.spice]));
  balances.set(f.donor, balances.get(f.donor)! - f.pledge + sellerReceipt);
  balances.set(f.payer, balances.get(f.payer)! - f.primary);
  if (f.emperor) balances.set(f.emperor, balances.get(f.emperor)! + emperorReceipt);
  else assert.equal(emperorReceipt, 0);
  for (const player of game.players) {
    assert.equal(player.spice, balances.get(player.id), `${player.id} retains only its actual payment and receipt`);
    const before = richeseBureaucratPlayer(f.beforeAction, player.id);
    const delta = Number(player.id === f.payer) - Number(f.source === 'blackMarket' && player.id === f.seller);
    assert.equal(player.hand.length, before.hand.length + delta);
  }
  assert.equal(f.beforeAction.aid[f.donor].amount, f.pledge);
  assert.equal(game.aid[f.donor].amount, 0, 'Original prepaid donor escrow is consumed once');
  assert.equal(richeseBureaucratPlayer(game, f.payer).hand.filter(card => card.id === f.card).length, 1);
  assert.equal(richeseBureaucratPlayer(game, f.seller).hand.some(card => card.id === f.card), false);
  assert.deepEqual(richeseBureaucratCards(game), f.physical);
  assert.equal(game.currentAuctionSale, null);
  assert.equal(game.richeseAuction, null);
  assert.equal(game.response, null);
  assert.equal(viewGame(game, f.trainer).bureaucrat.pending, null);
}

function blackMarketDeclaration(game: Game, f: RicheseBureaucratFixture) {
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(game.decision?.kind, 'richeseDeclaration');
  assert.equal(game.decision!.player, f.seller);
  assert.equal(game.active, f.seller);
  assert.deepEqual(game.richeseCache, f.beforeAction.richeseCache, 'A hidden hand sale does not spend a cache card');
}

void test('Advanced Black Market buyer5/donor3 diverts only seller5, retains native Emperor3 and resumes the cache declaration', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', primary: 5, pledge: 3, counter: true });
  assert.equal(viewGame(f.game, f.trainer).richeseAuction!.card, null);
  assert.equal(richeseBureaucratPlayer(f.game, f.seller).hand.filter(card => card.id === f.card).length, 1);
  let game = payRicheseBureaucrat(f);
  const event = allocation(game, f, f.seller);
  assert.equal(richeseBureaucratPlayer(game, f.payer).spice, richeseBureaucratPlayer(f.beforeAction, f.payer).spice - 5);
  assert.equal(richeseBureaucratPlayer(game, f.seller).spice, richeseBureaucratPlayer(f.beforeAction, f.seller).spice);
  game = chooseRicheseBureaucrat(game, true);
  assert.equal(richeseBureaucratPlayer(game, f.seller).spice, richeseBureaucratPlayer(f.beforeAction, f.seller).spice + 3);
  assert.equal(game.response?.kind, 'emperorIncome', 'Using Bureaucrat on seller income does not suppress native Karama');
  assert.equal(richeseBureaucratPlayer(game, f.emperor!).spice, richeseBureaucratPlayer(f.beforeAction, f.emperor!).spice);
  game = allowRicheseBureaucratResponses(game);
  paidOnce(game, f, 3, 3);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, true);
  assert.equal(game.bureaucratPayments!.used.filter(use => use.turn === game.turn && use.phase === game.phase).length, 1);
  const beforeStale = JSON.stringify(game);
  assert.throws(() => applyAction(game, f.trainer, { type: 'decision', event, redirect: true }));
  assert.equal(JSON.stringify(game), beforeStale);

  game = applyAction(game, f.seller, { type: 'decision', event: game.richeseBidding!.event, position: 'first' });
  assert.equal(game.response?.kind, 'richeseAuction');
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.decision?.kind, 'richeseCache');
  assert.equal(game.decision!.player, f.seller);
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(richeseBureaucratPlayer(game, f.payer).hand.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(richeseBureaucratCards(game), f.physical);
});

void test('an actual Emperor buyer3 still receives Richese donor5, with third-party Bureaucrat diverting only that receipt', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', buyer: 'emperor' });
  let game = allowRicheseBureaucratResponses(payRicheseBureaucrat(f));
  allocation(game, f, f.emperor!);
  assert.equal(game.bureaucratPayments!.pending!.resume.response?.kind, 'emperorIncome');
  assert.equal(richeseBureaucratPlayer(game, f.seller).spice, richeseBureaucratPlayer(f.beforeAction, f.seller).spice + 3);
  assert.equal(richeseBureaucratPlayer(game, f.payer).spice, richeseBureaucratPlayer(f.beforeAction, f.payer).spice - 3);
  game = chooseRicheseBureaucrat(game, true);
  paidOnce(game, f, 3, 3);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, true);
});

void test('the actual Atreides Bureaucrat skips its own buyer5 leg but can divert Richese donor5 to Emperor', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', owner: 'atreides', primary: 5 });
  let game = allowRicheseBureaucratResponses(payRicheseBureaucrat(f));
  allocation(game, f, f.emperor!);
  assert.equal(richeseBureaucratPlayer(game, f.seller).spice, richeseBureaucratPlayer(f.beforeAction, f.seller).spice + 5);
  game = chooseRicheseBureaucrat(game, true);
  paidOnce(game, f, 5, 3);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, true);
});

void test('the actual Richese Bureaucrat cannot divert either its seller5 receipt or its own donor5 payment', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', owner: 'richese', primary: 5 });
  const game = allowRicheseBureaucratResponses(payRicheseBureaucrat(f));
  paidOnce(game, f, 5, 5);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, false);
});

void test('the actual Emperor Bureaucrat may decline buyer5 to Richese but cannot divert its own incoming donor5', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', owner: 'emperor', primary: 5 });
  let game = payRicheseBureaucrat(f);
  allocation(game, f, f.seller);
  game = chooseRicheseBureaucrat(game, false);
  game = allowRicheseBureaucratResponses(game);
  paidOnce(game, f, 5, 5);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, false, 'Declining the first offer leaves the skill unused, so the payee exclusion alone suppresses the second');
});

void test('Basic cache control keeps the whole seller8 receipt, reduced to6, without an Advanced donor reroute', () => {
  const f = createRicheseBureaucratFixture({ advanced: false, primary: 5, pledge: 3 });
  let game = payRicheseBureaucrat(f);
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(viewGame(game, f.trainer).bureaucrat.pending!.payee, f.seller);
  assert.equal(viewGame(game, f.trainer).bureaucrat.pending!.amount, 8);
  game = chooseRicheseBureaucrat(game, true);
  game = allowRicheseBureaucratResponses(game);
  paidOnce(game, f, 6, 0);
  assert.equal(game.richeseCache!.length, f.beforeAction.richeseCache!.length - 1);
  assert.equal(game.richeseCache!.some(card => card.id === f.card), false);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assert.ok(game.auction, 'The original first-cache continuation prepares normal lots');
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, true);
});

void test('without Emperor the actual Black Market donor5 goes to Bank, buyer3 stays below Bureaucrat threshold, and Guild Banker defers1', () => {
  const f = createRicheseBureaucratFixture({ source: 'blackMarket', emperor: false });
  const bankerBefore = richeseBureaucratPlayer(f.beforeAction, f.banker).spice;
  const sourcesBefore = f.beforeAction.spiceBankerIncome!.sources.length;
  const game = allowRicheseBureaucratResponses(payRicheseBureaucrat(f));
  paidOnce(game, f, 3, 0);
  blackMarketDeclaration(game, f);
  assert.equal(viewGame(game, f.trainer).bureaucrat.usedThisPhase, false);
  assert.equal(richeseBureaucratPlayer(game, f.banker).spice, bankerBefore, 'Earned Banker income is not immediate spendable spice');
  assert.deepEqual(viewGame(game, f.banker).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  const receipts = game.spiceBankerIncome!.sources.slice(sourcesBefore);
  assert.equal(receipts.filter(receipt => receipt.grant).length, 1);
  assert.deepEqual(receipts.flatMap(receipt => receipt.source.bankLegs), [{ payer: f.donor, amount: 5 }], 'Only the actual donor Bank leg earns income; buyer3 is paid to Richese, not pooled into a fictitious Bank or player receipt');
  assert.equal(receipts.find(receipt => receipt.grant)!.grant!.owner, f.banker);
});
