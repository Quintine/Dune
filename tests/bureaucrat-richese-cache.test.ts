import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createRicheseBureaucratFixture, payRicheseBureaucrat,
  allowRicheseBureaucratResponses, chooseRicheseBureaucrat,
  richeseBureaucratPlayer, richeseBureaucratCards,
  type RicheseBureaucratFixture,
} from './fixture-bureaucrat-richese-funding';
import {
  advanceSpiceBankerIncomeToMentat, nextSpiceBankerIncomeNativeStep,
} from './fixture-spice-banker-income';

const spice = (game: Game, actor: string) => richeseBureaucratPlayer(game, actor).spice;

function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before);
}

function assertPaidCard(f: RicheseBureaucratFixture, game: Game): void {
  assert.equal(spice(game, f.payer), spice(f.beforePledge, f.payer) - f.primary);
  assert.equal(game.aid[f.donor]?.amount ?? 0, 0);
  assert.deepEqual(game.richeseFunding, {});
  assert.equal(richeseBureaucratPlayer(game, f.payer).hand.filter(c => c.id === f.card).length, 1);
  assert.deepEqual(richeseBureaucratPlayer(game, f.payer).hand.map(c => c.id),
    [...richeseBureaucratPlayer(f.beforeAction, f.payer).hand.map(c => c.id), f.card]);
  assert.equal(game.richeseCache!.some(c => c.id === f.card), false);
  assert.deepEqual(richeseBureaucratCards(game), f.physical);
}

function assertNormalContinuation(f: RicheseBureaucratFixture, game: Game): void {
  assertPaidCard(f, game);
  assert.equal(game.phase, 3);
  assert.equal(game.turn, f.beforeAction.turn);
  assert.equal(game.currentAuctionSale, null);
  assert.equal(game.richeseAuction, null);
  assert.equal(game.richeseBidding!.stage, 'normal');
  assert.ok(game.auction);
  assert.equal(game.auction.index, 0);
  assert.equal(game.decision, null);
  assert.equal(game.response, null);
}

function assertPublicAllocation(f: RicheseBureaucratFixture, game: Game, payee: string): void {
  const event = game.bureaucratPaymentEvent;
  assert.ok(event);
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    assert.deepEqual(view.bureaucrat.pending, {
      event, owner: f.trainer, payer: null, payee, amount: f.price,
      kind: 'auction', redirect: 2, richeseAllocation: true,
    });
    const publicState = view as unknown as Record<string, unknown>;
    assert.equal('richeseFunding' in publicState, false);
    assert.equal('bureaucratPayments' in publicState, false);
    assert.equal('bureaucratPayment' in ((publicState.currentAuctionSale as Record<string, unknown> | undefined) ?? {}), false);
    assert.equal('bureaucratPayment' in (view.response ?? {}), false);
  }
}

void test('Advanced native cache 3+5: only Richese-to-Emperor five qualifies, redirects two and resumes ordinary lots once', () => {
  const f = createRicheseBureaucratFixture({ primary: 3, pledge: 5, counter: true });
  const paid = payRicheseBureaucrat(f);
  assertPaidCard(f, paid);
  assert.equal(paid.response?.kind, 'emperorIncome');
  assert.equal(viewGame(paid, f.trainer).bureaucrat.pending, null);
  assert.equal(spice(paid, f.donor), spice(f.beforePledge, f.donor) - 5 + 3);
  assert.equal(spice(paid, f.emperor!), spice(f.beforePledge, f.emperor!));

  const pending = allowRicheseBureaucratResponses(paid);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(pending.bureaucratPayments!.pending!.source.payer, f.donor);
  assert.equal(pending.bureaucratPayments!.pending!.source.payee, f.emperor);
  assert.equal(pending.bureaucratPayments!.pending!.source.amount, 5);
  assertPublicAllocation(f, pending, f.emperor!);
  assert.equal(spice(pending, f.emperor!), spice(f.beforePledge, f.emperor!));

  const done = allowRicheseBureaucratResponses(chooseRicheseBureaucrat(pending, true));
  assertNormalContinuation(f, done);
  assert.equal(spice(done, f.donor), spice(f.beforePledge, f.donor) - 2);
  assert.equal(spice(done, f.emperor!), spice(f.beforePledge, f.emperor!) + 3);
  assert.equal(done.bureaucratPayments!.used.length, 1);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, true);
  assert.equal(viewGame(done, f.trainer).bureaucrat.pending, null);
  rejectUnchanged(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });

  // Exercise the original ordinary opener, not merely the special-lot callback.
  const balances = done.players.map(p => [p.id, p.spice]);
  const hands = done.players.map(p => [p.id, p.hand.map(c => c.id)]);
  const used = structuredClone(done.bureaucratPayments!.used);
  const actor = done.auction!.active;
  const next = allowRicheseBureaucratResponses(applyAction(done, actor, { type: 'passBid' }));
  assert.equal(next.auction!.index, 0);
  assert.notEqual(next.auction!.active, actor);
  assert.deepEqual(next.auction!.cards, done.auction!.cards);
  assert.deepEqual(next.players.map(p => [p.id, p.spice]), balances);
  assert.deepEqual(next.players.map(p => [p.id, p.hand.map(c => c.id)]), hands);
  assert.deepEqual(next.bureaucratPayments!.used, used);
  assert.deepEqual(richeseBureaucratCards(next), f.physical);
});

void test('Advanced native cache 5+5: decline seller, allow Emperor, reject stale seller event and redirect only donor income', () => {
  const f = createRicheseBureaucratFixture({ primary: 5, pledge: 5, counter: true });
  const seller = payRicheseBureaucrat(f);
  assert.equal(seller.decision?.kind, 'bureaucratPayment');
  assertPublicAllocation(f, seller, f.seller);
  assertPaidCard(f, seller);
  assert.equal(spice(seller, f.seller), spice(f.beforePledge, f.seller) - 5);
  const sellerEvent = seller.bureaucratPaymentEvent;

  const income = chooseRicheseBureaucrat(seller, false);
  assert.equal(income.response?.kind, 'emperorIncome');
  assert.equal(spice(income, f.seller), spice(f.beforePledge, f.seller));
  assert.equal(income.bureaucratPayments?.used.length ?? 0, 0);
  const donor = allowRicheseBureaucratResponses(income);
  assert.equal(donor.decision?.kind, 'bureaucratPayment');
  assert.notEqual(donor.bureaucratPaymentEvent, sellerEvent);
  assertPublicAllocation(f, donor, f.emperor!);
  assert.equal(donor.bureaucratPayments!.pending!.source.amount, 5);
  rejectUnchanged(donor, f.trainer, { type: 'decision', event: sellerEvent, redirect: true });
  rejectUnchanged(donor, f.donor, { type: 'decision', event: donor.bureaucratPaymentEvent, redirect: true });

  const done = allowRicheseBureaucratResponses(chooseRicheseBureaucrat(donor, true));
  assertNormalContinuation(f, done);
  assert.equal(spice(done, f.seller), spice(f.beforePledge, f.seller));
  assert.equal(spice(done, f.emperor!), spice(f.beforePledge, f.emperor!) + 3);
  assert.equal(done.bureaucratPayments!.used.length, 1);
  assert.equal(done.bureaucratPayments!.used[0].event, donor.bureaucratPaymentEvent);
});

void test('Advanced native cache 5+5: seller diversion does not cancel native Emperor Karama or pool buyer Bank two with donor five', () => {
  const f = createRicheseBureaucratFixture({ primary: 5, pledge: 5, counter: true });
  const seller = payRicheseBureaucrat(f);
  const sourceCount = f.beforeAction.spiceBankerIncome!.sources.length;
  const bankerBalance = spice(f.beforeAction, f.banker);
  const income = chooseRicheseBureaucrat(seller, true);
  assert.equal(income.response?.kind, 'emperorIncome');
  assert.equal(spice(income, f.seller), spice(f.beforePledge, f.seller) - 2);
  assert.equal(spice(income, f.emperor!), bankerBalance);
  assert.equal(viewGame(income, f.trainer).bureaucrat.pending, null);
  assert.equal(viewGame(income, f.trainer).bureaucrat.usedThisPhase, true);
  assert.deepEqual(viewGame(income, f.banker).spiceBankerIncome!.deferred, []);
  assert.equal(income.spiceBankerIncome!.sources.slice(sourceCount).some(row => row.grant), false);
  assert.ok(viewGame(income, f.counterActor).responseControls!.cancelCards.includes(f.counterCard!));

  const canceled = applyAction(income, f.counterActor, { type: 'card', card: f.counterCard!, mode: 'cancel' });
  const done = allowRicheseBureaucratResponses(canceled);
  assertNormalContinuation(f, done);
  assert.equal(spice(done, f.seller), spice(f.beforePledge, f.seller) - 2);
  assert.equal(spice(done, f.emperor!), bankerBalance);
  assert.equal(done.bureaucratPayments!.used.length, 1);
  assert.equal(done.bureaucratPayments!.used[0].event, seller.bureaucratPaymentEvent);
  assert.equal(viewGame(done, f.trainer).bureaucrat.pending, null);
  assert.equal(done.discard.filter(c => c.id === f.counterCard).length, 1);
  assert.equal(richeseBureaucratPlayer(done, f.counterActor).hand.some(c => c.id === f.counterCard), false);
  const grants = done.spiceBankerIncome!.sources.slice(sourceCount).filter(row => row.grant);
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].source.bankLegs, [{ payer: f.donor, amount: 5 }]);
  assert.deepEqual(viewGame(done, f.banker).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  rejectUnchanged(done, f.counterActor, { type: 'card', card: f.counterCard!, mode: 'cancel' });

  // Native passes and endMovement leave the deferred credit untouched until Mentat.
  let beforeMentat = done;
  for (let n = 0; (beforeMentat.phase !== 7 || beforeMentat.phaseOpening || beforeMentat.response || beforeMentat.decision) && n < 400; n++) {
    const step = nextSpiceBankerIncomeNativeStep(beforeMentat);
    assert.ok(step);
    beforeMentat = applyAction(beforeMentat, step.actor, step.action);
  }
  assert.equal(beforeMentat.phase, 7);
  assert.equal(spice(beforeMentat, f.banker), bankerBalance);
  assert.deepEqual(viewGame(beforeMentat, f.banker).spiceBankerIncome!.deferred, [{ owner: f.banker, amount: 1 }]);
  rejectUnchanged(beforeMentat, f.banker, { type: 'bribe', target: f.trainer, amount: bankerBalance + 1 });
  const collected = advanceSpiceBankerIncomeToMentat(beforeMentat);
  assert.equal(spice(collected, f.banker), bankerBalance + 1);
  assert.deepEqual(viewGame(collected, f.banker).spiceBankerIncome!.deferred, []);
  const collection = collected.spiceBankerIncome!.collections.at(-1)!;
  assert.deepEqual(collection.credits, [{ owner: f.banker, amount: 1 }]);
  assert.equal(collection.grants.filter(cursor => cursor === grants[0].cursor).length, 1);
  assert.deepEqual(richeseBureaucratCards(collected), f.physical);
});

void test('Advanced native cache 4+4: separate seller and Emperor receipts never pool into a Bureaucrat payer', () => {
  const f = createRicheseBureaucratFixture({ primary: 4, pledge: 4, counter: true });
  const income = payRicheseBureaucrat(f);
  assert.equal(income.response?.kind, 'emperorIncome');
  assertPaidCard(f, income);
  assert.equal(spice(income, f.seller), spice(f.beforePledge, f.seller));
  assert.equal(viewGame(income, f.trainer).bureaucrat.pending, null);
  const done = allowRicheseBureaucratResponses(income);
  assertNormalContinuation(f, done);
  assert.equal(spice(done, f.seller), spice(f.beforePledge, f.seller));
  assert.equal(spice(done, f.emperor!), spice(f.beforePledge, f.emperor!) + 4);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(viewGame(done, f.trainer).bureaucrat.pending, null);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, false);
  assert.deepEqual(viewGame(done, f.banker).spiceBankerIncome!.deferred, []);
});
