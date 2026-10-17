import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import {
  allowRicheseBureaucratResponses, richeseBureaucratCards, richeseBureaucratPlayer,
} from './fixture-bureaucrat-richese-funding';
import {
  createRicheseSelfPurchaseFixture, payRicheseSelfPurchase,
} from './fixture-richese-self-purchase';
import { createRicheseFullHandSelfPurchaseGame } from './fixture-richese-self-purchase-full-hand';
import {
  advanceSpiceBankerIncomeToMentat, nextSpiceBankerIncomeNativeStep,
} from './fixture-spice-banker-income';

function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before);
}

void test('provisional Silent paid retention admits a full seller, seals its bid, and reduces the real ordinary pool once unlike zero retention', () => {
  const initial = createRicheseFullHandSelfPurchaseGame();
  const f = createRicheseSelfPurchaseFixture({ initial, price: 1, counter: true });
  const seller = richeseBureaucratPlayer(f.beforeAction, f.seller);
  assert.equal(seller.hand.length, handLimit(seller));
  assert.ok(f.game.richeseAuction!.eligible.includes(f.seller));
  assert.equal(f.game.players.filter(p => p.hand.length < handLimit(p)).length, 3);
  let sealed = applyAction(f.game, f.seller, f.action);
  assert.deepEqual(richeseBureaucratPlayer(sealed, f.seller).hand.map(c => c.id), f.originalHand);
  assert.equal(richeseBureaucratPlayer(sealed, f.seller).spice, seller.spice);
  for (const player of sealed.players) {
    const auction = viewGame(sealed, player.id).richeseAuction!;
    assert.equal(auction.ownBid, player.id === f.seller ? 1 : null);
    assert.equal(auction.revealedBids, null);
    assert.equal(auction.bid, 0);
    assert.equal(auction.bidder, null);
    assert.equal(auction.cardId, player.id === f.seller ? f.card : null);
    assert.ok(auction.submitted.includes(f.seller));
  }
  rejectUnchanged(sealed, f.seller, f.action);
  for (const actor of sealed.richeseAuction!.order.filter(id => id !== f.seller))
    sealed = applyAction(sealed, actor, { type: 'richeseBid', event: f.action.event, amount: 0 });
  assert.equal(sealed.response?.kind, 'emperorIncome');
  for (const player of sealed.players)
    assert.equal(viewGame(sealed, player.id).richeseAuction!.revealedBids![f.seller], 1);
  const paid = allowRicheseBureaucratResponses(sealed);
  assert.deepEqual(richeseBureaucratPlayer(paid, f.seller).hand.map(c => c.id), f.originalHand);
  assert.equal(richeseBureaucratPlayer(paid, f.seller).hand.filter(c => c.id === f.card).length, 1);
  assert.equal(richeseBureaucratPlayer(paid, f.seller).spice, seller.spice - 1);
  assert.equal(richeseBureaucratPlayer(paid, f.emperor!).spice,
    richeseBureaucratPlayer(f.beforeAction, f.emperor!).spice + 1);
  assert.equal(paid.decision?.kind, 'richeseDeclaration');
  assert.equal(paid.richeseAuction, null);
  assert.equal(paid.richeseBidding!.blackMarketSold, true);
  assert.equal(paid.richeseBidding!.normalCount, 1);
  assert.deepEqual(richeseBureaucratCards(paid), f.physical);
  rejectUnchanged(paid, f.seller, f.action);
  const ordinary = allowRicheseBureaucratResponses(applyAction(paid, f.seller,
    { type: 'decision', event: paid.richeseBidding!.event, position: 'last' }));
  assert.equal(ordinary.auction!.cards.length, 1);
  assert.notEqual(ordinary.auction!.active, f.seller);
  assert.deepEqual(richeseBureaucratCards(ordinary), f.physical);

  const zero = createRicheseSelfPurchaseFixture({ initial, price: 0 });
  const retained = allowRicheseBureaucratResponses(payRicheseSelfPurchase(zero));
  assert.equal(retained.richeseBidding!.blackMarketSold, false);
  assert.equal(retained.richeseBidding!.normalCount, 2);
  assert.equal(richeseBureaucratPlayer(retained, zero.seller).spice, seller.spice);
  assert.deepEqual(richeseBureaucratPlayer(retained, zero.seller).hand.map(c => c.id), zero.originalHand);
  const unsoldOrdinary = allowRicheseBureaucratResponses(applyAction(retained, zero.seller,
    { type: 'decision', event: retained.richeseBidding!.event, position: 'last' }));
  assert.equal(unsoldOrdinary.auction!.cards.length, 2);
  assert.deepEqual(richeseBureaucratCards(unsoldOrdinary), zero.physical);
});

void test('bare Advanced without Skills earns the same full hand and pays five for original-card retention', () => {
  const initial = createRicheseFullHandSelfPurchaseGame({ skills: false });
  const f = createRicheseSelfPurchaseFixture({ initial, price: 5, counter: true });
  const done = allowRicheseBureaucratResponses(payRicheseSelfPurchase(f));
  assert.equal(done.phase, 3);
  assert.equal(done.decision?.kind, 'richeseDeclaration');
  assert.equal(richeseBureaucratPlayer(done, f.seller).spice,
    richeseBureaucratPlayer(f.beforeAction, f.seller).spice - 5);
  assert.equal(richeseBureaucratPlayer(done, f.emperor!).spice,
    richeseBureaucratPlayer(f.beforeAction, f.emperor!).spice + 5);
  assert.deepEqual(richeseBureaucratPlayer(done, f.seller).hand.map(c => c.id), f.originalHand);
  assert.equal(done.richeseBidding!.normalCount, 1);
  assert.deepEqual(richeseBureaucratCards(done), f.physical);
});

void test('full-hand allied three plus five: original Emperor Karama banks two payer legs, never offers Bureaucrat, and defers only one Banker spice', () => {
  const f = createRicheseSelfPurchaseFixture({ initial: createRicheseFullHandSelfPurchaseGame(),
    price: 8, allyPayment: 5, counter: true });
  const sourceCount = f.beforeAction.spiceBankerIncome!.sources.length;
  const bankerBalance = richeseBureaucratPlayer(f.beforeAction, f.banker!).spice;
  const used = structuredClone(f.beforeAction.bureaucratPayments?.used ?? []);
  const income = payRicheseSelfPurchase(f);
  assert.equal(income.response?.kind, 'emperorIncome');
  assert.deepEqual(richeseBureaucratPlayer(income, f.seller).hand.map(c => c.id), f.originalHand);
  assert.equal(richeseBureaucratPlayer(income, f.seller).spice,
    richeseBureaucratPlayer(f.beforePledge, f.seller).spice - 3);
  assert.equal(richeseBureaucratPlayer(income, f.donor!).spice,
    richeseBureaucratPlayer(f.beforePledge, f.donor!).spice - 5);
  assert.equal(viewGame(income, f.trainer!).bureaucrat.pending, null);
  assert.deepEqual(viewGame(income, f.banker!).spiceBankerIncome!.deferred, []);
  assert.ok(viewGame(income, f.counterActor).responseControls!.cancelCards.includes(f.counterCard!));
  const canceled = applyAction(income, f.counterActor, { type: 'card', card: f.counterCard!, mode: 'cancel' });
  const done = allowRicheseBureaucratResponses(canceled);
  assert.equal(done.decision?.kind, 'richeseDeclaration');
  assert.equal(done.richeseBidding!.normalCount, 1);
  assert.equal(richeseBureaucratPlayer(done, f.emperor!).spice,
    richeseBureaucratPlayer(f.beforeAction, f.emperor!).spice);
  assert.equal(richeseBureaucratPlayer(done, f.banker!).spice, bankerBalance);
  assert.equal(viewGame(done, f.trainer!).bureaucrat.pending, null);
  assert.deepEqual(done.bureaucratPayments?.used ?? [], used);
  assert.equal(viewGame(done, f.trainer!).bureaucrat.usedThisPhase, false);
  const grants = done.spiceBankerIncome!.sources.slice(sourceCount).filter(row => row.grant);
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].source.bankLegs, [{ payer: f.seller, amount: 3 }, { payer: f.donor!, amount: 5 }]);
  assert.deepEqual(viewGame(done, f.banker!).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  assert.equal(done.aid[f.donor!]?.amount ?? 0, 0);
  assert.deepEqual(done.richeseFunding, {});
  assert.deepEqual(richeseBureaucratPlayer(done, f.seller).hand.map(c => c.id), f.originalHand);
  assert.deepEqual(richeseBureaucratCards(done), f.physical);
  assert.equal(done.discard.filter(c => c.id === f.counterCard).length, 1);
  rejectUnchanged(done, f.counterActor, { type: 'card', card: f.counterCard!, mode: 'cancel' });

  let beforeMentat = applyAction(done, f.seller,
    { type: 'decision', event: done.richeseBidding!.event, position: 'last' });
  for (let n = 0; (beforeMentat.phase !== 7 || beforeMentat.phaseOpening || beforeMentat.response || beforeMentat.decision) && n < 400; n++) {
    const step = nextSpiceBankerIncomeNativeStep(beforeMentat);
    assert.ok(step);
    beforeMentat = applyAction(beforeMentat, step.actor, step.action);
  }
  assert.equal(beforeMentat.phase, 7);
  assert.equal(richeseBureaucratPlayer(beforeMentat, f.banker!).spice, bankerBalance);
  assert.deepEqual(viewGame(beforeMentat, f.banker!).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  rejectUnchanged(beforeMentat, f.banker!, { type: 'bribe', target: f.seller, amount: bankerBalance + 1 });
  const collected = advanceSpiceBankerIncomeToMentat(beforeMentat);
  assert.equal(richeseBureaucratPlayer(collected, f.banker!).spice, bankerBalance + 1);
  assert.deepEqual(viewGame(collected, f.banker!).spiceBankerIncome!.deferred, []);
  const collection = collected.spiceBankerIncome!.collections.at(-1)!;
  assert.deepEqual(collection.credits, [{ owner: f.banker, amount: 1 }]);
  assert.equal(collection.grants.filter(cursor => cursor === grants[0].cursor).length, 1);
  assert.deepEqual(richeseBureaucratCards(collected), f.physical);
});

void test('without Emperor the full seller pays five to the Bank, not itself, and the actual Guild Banker receives one deferred credit', () => {
  const f = createRicheseSelfPurchaseFixture({ initial: createRicheseFullHandSelfPurchaseGame({ emperor: false }), price: 5 });
  const sourceCount = f.beforeAction.spiceBankerIncome!.sources.length;
  const balances = f.beforeAction.players.map(p => [p.id, p.spice] as const);
  const done = allowRicheseBureaucratResponses(payRicheseSelfPurchase(f));
  assert.equal(done.decision?.kind, 'richeseDeclaration');
  assert.deepEqual(done.players.map(p => [p.id, p.spice]),
    balances.map(([id, amount]) => [id, amount - (id === f.seller ? 5 : 0)]));
  assert.deepEqual(richeseBureaucratPlayer(done, f.seller).hand.map(c => c.id), f.originalHand);
  assert.equal(done.richeseBidding!.normalCount, 1);
  assert.equal(viewGame(done, f.trainer!).bureaucrat.pending, null);
  assert.equal(viewGame(done, f.trainer!).bureaucrat.usedThisPhase, false);
  const grants = done.spiceBankerIncome!.sources.slice(sourceCount).filter(row => row.grant);
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].source.bankLegs, [{ payer: f.seller, amount: 5 }]);
  assert.deepEqual(viewGame(done, f.banker!).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  assert.deepEqual(richeseBureaucratCards(done), f.physical);
});
