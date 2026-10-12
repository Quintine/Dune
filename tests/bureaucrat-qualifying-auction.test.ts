import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advanceBureaucratQualifyingSplit } from './fixture-bureaucrat-qualifying-split';
import {
  createBureaucratQualifyingAuctionFixture, payBureaucratQualifyingAuction,
  allowQualifyingAuctionResponses, chooseQualifyingAuction, qualifyingAuctionPlayer,
  qualifyingAuctionPhysicalCards, type BureaucratQualifyingAuctionFixture,
} from './fixture-bureaucrat-qualifying-auction';

function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before);
}
function assertPaid(fixture: BureaucratQualifyingAuctionFixture, game: Game) {
  const payer = qualifyingAuctionPlayer(game, fixture.payer), donor = qualifyingAuctionPlayer(game, fixture.donor);
  assert.equal(payer.spice, qualifyingAuctionPlayer(fixture.beforePledge, fixture.payer).spice - fixture.payerShare);
  assert.equal(donor.spice, qualifyingAuctionPlayer(fixture.beforePledge, fixture.donor).spice - fixture.donorShare);
  assert.equal(game.aid[fixture.donor].amount, 0);
  assert.equal(payer.hand.length, qualifyingAuctionPlayer(fixture.beforeAction, fixture.payer).hand.length + 1);
  assert.equal(payer.hand.filter(card => card.id === fixture.reservedCard).length, 1);
  assert.equal(qualifyingAuctionPlayer(game, fixture.emperor).spice, qualifyingAuctionPlayer(fixture.beforeAction, fixture.emperor).spice);
  assert.deepEqual(qualifyingAuctionPhysicalCards(game), fixture.physical);
  assert.equal(game.auction!.index, fixture.beforeAction.auction!.index);
  assert.deepEqual(game.auction!.cards, fixture.sourceSetup.auction!.cards);
  for (const original of fixture.beforeAction.players) {
    const actual = qualifyingAuctionPlayer(game, original.id);
    assert.deepEqual(actual.forces, original.forces);
    assert.equal(actual.reserves, original.reserves);
  }
}
function assertCompleted(fixture: BureaucratQualifyingAuctionFixture, pending: Game, done: Game, diverted: number) {
  assert.equal(qualifyingAuctionPlayer(done, fixture.emperor).spice,
    qualifyingAuctionPlayer(fixture.beforeAction, fixture.emperor).spice + fixture.amount - diverted);
  for (const actor of [fixture.payer, fixture.donor, fixture.trainer])
    assert.equal(qualifyingAuctionPlayer(done, actor).spice, qualifyingAuctionPlayer(pending, actor).spice);
  const payer = qualifyingAuctionPlayer(done, fixture.payer);
  assert.deepEqual(payer.hand.map(card => card.id), [
    ...qualifyingAuctionPlayer(pending, fixture.payer).hand.map(card => card.id), fixture.bonusCard,
  ]);
  assert.deepEqual(done.deck.map(card => card.id), pending.deck.slice(1).map(card => card.id));
  assert.deepEqual(qualifyingAuctionPhysicalCards(done), fixture.physical);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.auction!.index, fixture.beforeAction.auction!.index + 1);
  assert.equal(done.auction!.cards[done.auction!.index].id, fixture.beforeAction.auction!.cards[fixture.beforeAction.auction!.index + 1].id);
  assert.equal(done.auction!.bid, 0);
  assert.equal(done.auction!.bidder, null);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, diverted ? 1 : 0);
  assert.equal(viewGame(done, fixture.trainer).bureaucrat.usedThisPhase, diverted === 2);
}

for (const advanced of [false, true]) {
  for (const [payerShare, donorShare] of [[5, 3], [3, 5], [5, 5], [0, 5]]) {
    for (const redirect of [true, false]) {
      void test(`${advanced ? 'Advanced' : 'Basic'} native ordinary auction ${payerShare}+${donorShare}: ${redirect ? 'Bank two' : 'full Emperor income'} and one Harkonnen bonus`, () => {
        const fixture = createBureaucratQualifyingAuctionFixture({ advanced, payerShare, donorShare });
        const paid = payBureaucratQualifyingAuction(fixture);
        assertPaid(fixture, paid);
        const pending = allowQualifyingAuctionResponses(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assertPaid(fixture, pending);
        const done = allowQualifyingAuctionResponses(chooseQualifyingAuction(JSON.parse(JSON.stringify(pending)) as Game, redirect));
        assertCompleted(fixture, pending, done, redirect ? 2 : 0);
        rejectUnchanged(done, fixture.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      });
    }
  }
  for (const [payerShare, donorShare] of [[3, 3], [4, 3]]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} native ordinary auction ${payerShare}+${donorShare} cannot pool sub-five shares`, () => {
      const fixture = createBureaucratQualifyingAuctionFixture({ advanced, payerShare, donorShare });
      const paid = payBureaucratQualifyingAuction(fixture);
      assertPaid(fixture, paid);
      const done = allowQualifyingAuctionResponses(paid);
      assertCompleted(fixture, paid, done, 0);
      assert.equal(viewGame(done, fixture.trainer).bureaucrat.pending, null);
    });
  }
  void test(`${advanced ? 'Advanced' : 'Basic'} original Emperor Karama cancellation banks the whole allied invoice, not just the primary contribution`, () => {
    const fixture = createBureaucratQualifyingAuctionFixture({ advanced, payerShare: 5, donorShare: 5, counter: true });
    const paid = payBureaucratQualifyingAuction(fixture);
    assertPaid(fixture, paid);
    assert.equal(paid.response?.kind, 'emperorIncome');
    assert.equal(viewGame(paid, fixture.trainer).bureaucrat.pending, null);
    const canceled = applyAction(paid, fixture.trainer, { type: 'card', mode: 'cancel', card: fixture.counterCard });
    const done = allowQualifyingAuctionResponses(canceled);
    assert.equal(qualifyingAuctionPlayer(done, fixture.emperor).spice, qualifyingAuctionPlayer(fixture.beforeAction, fixture.emperor).spice);
    assert.equal(qualifyingAuctionPlayer(done, fixture.payer).spice, qualifyingAuctionPlayer(paid, fixture.payer).spice);
    assert.equal(qualifyingAuctionPlayer(done, fixture.donor).spice, qualifyingAuctionPlayer(paid, fixture.donor).spice);
    assert.equal(qualifyingAuctionPlayer(done, fixture.payer).hand.length, qualifyingAuctionPlayer(paid, fixture.payer).hand.length + 1);
    assert.equal(done.discard.filter(card => card.id === fixture.counterCard).length, 1);
    assert.deepEqual(qualifyingAuctionPhysicalCards(done), fixture.physical);
    assert.equal(done.auction!.index, 1);
    assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(viewGame(done, fixture.trainer).bureaucrat.pending, null);
  });
}

void test('equal public eight-spice invoices conceal which allied contribution qualified from Bureaucrat and outside audiences', () => {
  const primary = createBureaucratQualifyingAuctionFixture({ payerShare: 5, donorShare: 3 });
  const ally = createBureaucratQualifyingAuctionFixture({ payerShare: 3, donorShare: 5 });
  const a = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(primary));
  const b = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(ally));
  for (const viewer of [primary.trainer, primary.guild, primary.emperor]) {
    const left = viewGame(a, viewer), right = viewGame(b, viewer);
    assert.equal(left.bureaucrat.pending!.payer, null);
    assert.equal(left.bureaucrat.pending!.amount, 8);
    assert.equal(left.bureaucrat.pending!.payee, primary.emperor);
    assert.equal(left.auction!.bid, 8);
    assert.equal(left.auction!.bidder, primary.payer);
    assert.equal(left.auction!.allyPayment, undefined);
    const { event: leftEvent, ...leftPayment } = left.bureaucrat.pending!;
    const { event: rightEvent, ...rightPayment } = right.bureaucrat.pending!;
    assert.notEqual(leftEvent, rightEvent);
    assert.deepEqual(leftPayment, rightPayment);
    assert.equal('contributions' in leftPayment, false);
    assert.equal('contributions' in rightPayment, false);
    assert.deepEqual(left.log.slice(primary.beforePledge.log.length).map(entry => entry.text),
      right.log.slice(ally.beforePledge.log.length).map(entry => entry.text));
  }
});

void test('a real original pledge is private funding, not a gift or a second income/payment action', () => {
  const fixture = createBureaucratQualifyingAuctionFixture({ payerShare: 3, donorShare: 5 });
  assert.equal(qualifyingAuctionPlayer(fixture.pledged, fixture.donor).spice, 1);
  assert.equal(qualifyingAuctionPlayer(fixture.pledged, fixture.payer).spice, qualifyingAuctionPlayer(fixture.beforePledge, fixture.payer).spice);
  assert.equal(qualifyingAuctionPlayer(fixture.pledged, fixture.payer).bribes, 0);
  assert.equal(fixture.pledged.aid[fixture.donor].amount, 5);
  assert.equal(fixture.pledged.decision, null);
  assert.equal(fixture.pledged.response, null);
  assert.equal(fixture.pledged.bureaucratPayments?.used.length ?? 0, 0);
  const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assertPaid(fixture, pending);
});

void test('stale and cross-actor choices cannot spend, refund, duplicate, or modify the reserved ordinary lot', () => {
  const fixture = createBureaucratQualifyingAuctionFixture();
  const bid = applyAction(fixture.game, fixture.payer, fixture.action);
  rejectUnchanged(bid, fixture.donor, { type: 'pledgeAid', amount: fixture.donorShare - 1 });
  const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
  rejectUnchanged(pending, fixture.donor, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
  rejectUnchanged(pending, fixture.trainer, { type: 'decision', event: 'old-auction-invoice', redirect: true });
  rejectUnchanged(pending, fixture.payer, { type: 'bid', amount: 1 });
  rejectUnchanged(pending, fixture.donor, { type: 'pledgeAid', amount: 0 });
  const done = allowQualifyingAuctionResponses(chooseQualifyingAuction(pending));
  assertCompleted(fixture, pending, done, 2);
});

void test('an original purchase using the last hand space has no premature or overflow Harkonnen bonus', () => {
  const fixture = createBureaucratQualifyingAuctionFixture({ lastHandSpace: true });
  const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
  assertPaid(fixture, pending);
  assert.equal(qualifyingAuctionPlayer(pending, fixture.payer).hand.length, handLimit(qualifyingAuctionPlayer(pending, fixture.payer)));
  const done = allowQualifyingAuctionResponses(chooseQualifyingAuction(pending));
  assert.deepEqual(qualifyingAuctionPlayer(done, fixture.payer).hand, qualifyingAuctionPlayer(pending, fixture.payer).hand);
  assert.deepEqual(done.deck, pending.deck);
  assert.equal(qualifyingAuctionPlayer(done, fixture.emperor).spice, qualifyingAuctionPlayer(pending, fixture.emperor).spice + 6);
  assert.deepEqual(qualifyingAuctionPhysicalCards(done), fixture.physical);
  assert.equal(done.auction!.index, 1);
  assert.equal(done.bureaucratPayments!.used.length, 1);
});

for (const difficulty of DIFFICULTIES) {
  void test(`${difficulty} Bureaucrat bot resolves the actual concealed allied invoice and hands control to the native next lot`, () => {
    const fixture = createBureaucratQualifyingAuctionFixture({ payerShare: 5, donorShare: 5 });
    const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
    const view = viewGame(pending, fixture.trainer);
    view.players.find(player => player.id === fixture.trainer)!.bot = difficulty;
    const action = botActions(view)[0];
    const done = allowQualifyingAuctionResponses(applyAction(pending, fixture.trainer, action));
    assertCompleted(fixture, pending, done, action.redirect ? 2 : 0);
    const next = advanceBureaucratQualifyingSplit(done, game => !game.decision && !game.response && !!game.auction?.peekKnown);
    assert.equal(next.auction!.index, 1);
    assert.equal(next.active, next.auction!.active);
    assert.ok(next.order.includes(next.active!));
    assert.equal(viewGame(next, fixture.trainer).bureaucrat.pending, null);
  });
}

void test('one split use covers both qualifying shares, blocks a later same-phase native payment, and refreshes only at a real phase boundary', () => {
  const fixture = createBureaucratQualifyingAuctionFixture({ payerShare: 5, donorShare: 5 });
  const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
  let game = allowQualifyingAuctionResponses(chooseQualifyingAuction(pending));
  const use = structuredClone(game.bureaucratPayments!.used);
  const secondLot = game.auction!.cards[1].id;
  game = advanceBureaucratQualifyingSplit(game, state => !!state.auction && state.auction.active === fixture.guild && !state.decision && !state.response);
  const guildBefore = qualifyingAuctionPlayer(game, fixture.guild).spice;
  const emperorBefore = qualifyingAuctionPlayer(game, fixture.emperor).spice;
  game = applyAction(game, fixture.guild, { type: 'bid', amount: 5 });
  for (let n = 0; game.auction?.index === 1 && !game.response && !game.decision && n < game.players.length + 2; n++)
    game = applyAction(game, game.auction!.active, { type: 'passBid' });
  if (game.decision?.kind === 'auctionPayment') game = applyAction(game, fixture.guild, { type: 'decision', karama: false });
  game = allowQualifyingAuctionResponses(game);
  assert.equal(viewGame(game, fixture.trainer).bureaucrat.pending, null);
  assert.deepEqual(game.bureaucratPayments!.used, use);
  assert.equal(qualifyingAuctionPlayer(game, fixture.guild).spice, guildBefore - 5);
  assert.equal(qualifyingAuctionPlayer(game, fixture.guild).hand.filter(card => card.id === secondLot).length, 1);
  assert.equal(qualifyingAuctionPlayer(game, fixture.emperor).spice, emperorBefore + 5);
  assert.equal(game.auction!.index, 2);
  game = advanceBureaucratQualifyingSplit(game, state => state.phase === 5 && !state.phaseOpening && !state.response && !state.decision);
  assert.equal(game.turn, pending.turn);
  assert.equal(viewGame(game, fixture.trainer).bureaucrat.usedThisPhase, false);
  const fresh = applyAction(game, fixture.emperor, { type: 'bribe', target: fixture.guild, amount: 5 });
  assert.equal(fresh.decision?.kind, 'bureaucratPayment');
  assert.notEqual(fresh.bureaucratPaymentEvent, pending.bureaucratPaymentEvent);
  const done = chooseQualifyingAuction(fresh);
  assert.equal(qualifyingAuctionPlayer(done, fixture.guild).bribes, 3);
  assert.equal(done.bureaucratPayments!.used.length, 2);
  assert.equal(viewGame(done, fixture.trainer).bureaucrat.usedThisPhase, true);
  assert.deepEqual(qualifyingAuctionPhysicalCards(done), fixture.physical);
});

for (const donor of ['b', 'e'] as const) {
  for (const [payerShare, donorShare] of [[3, 5], [5, 3]]) {
    void test(`native worm alliance with ${donor === 'b' ? 'Bureaucrat owner' : 'Emperor payee'} excludes only that contributor's threshold`, () => {
      const fixture = createBureaucratQualifyingAuctionFixture({ donor, payerShare, donorShare });
      assert.equal(qualifyingAuctionPlayer(fixture.alliance, fixture.payer).ally, donor);
      assert.equal(qualifyingAuctionPlayer(fixture.alliance, donor).ally, fixture.payer);
      const paid = payBureaucratQualifyingAuction(fixture);
      assertPaid(fixture, paid);
      const allowed = allowQualifyingAuctionResponses(paid);
      const qualifies = payerShare === 5;
      assert.equal(allowed.decision?.kind, qualifies ? 'bureaucratPayment' : undefined);
      const done = qualifies ? allowQualifyingAuctionResponses(chooseQualifyingAuction(allowed)) : allowed;
      assert.equal(qualifyingAuctionPlayer(done, fixture.payer).spice,
        qualifyingAuctionPlayer(fixture.beforePledge, fixture.payer).spice - payerShare);
      assert.equal(qualifyingAuctionPlayer(done, fixture.emperor).spice,
        qualifyingAuctionPlayer(fixture.beforePledge, fixture.emperor).spice - (donor === 'e' ? donorShare : 0) +
        fixture.amount - (qualifies ? 2 : 0));
      if (donor === 'b') assert.equal(qualifyingAuctionPlayer(done, donor).spice,
        qualifyingAuctionPlayer(fixture.beforePledge, donor).spice - donorShare);
      assert.equal(done.bureaucratPayments?.used.length ?? 0, qualifies ? 1 : 0);
      assert.equal(qualifyingAuctionPlayer(done, fixture.payer).hand.filter(card => card.id === fixture.reservedCard).length, 1);
      assert.equal(qualifyingAuctionPlayer(done, fixture.payer).hand.filter(card => card.id === fixture.bonusCard).length, 1);
      assert.equal(done.auction!.index, 1);
      assert.deepEqual(qualifyingAuctionPhysicalCards(done), fixture.physical);
    });
  }
}

void test('declining a native split invoice leaves the original card available for a distinct payment in the same Bidding phase', () => {
  const fixture = createBureaucratQualifyingAuctionFixture({ payerShare: 3, donorShare: 5 });
  const pending = allowQualifyingAuctionResponses(payBureaucratQualifyingAuction(fixture));
  const done = allowQualifyingAuctionResponses(chooseQualifyingAuction(pending, false));
  assertCompleted(fixture, pending, done, 0);
  const next = advanceBureaucratQualifyingSplit(done, state => !!state.auction?.peekKnown &&
    !state.phaseOpening && !state.response && !state.decision);
  assert.equal(next.auction!.index, 1);
  const paid = applyAction(next, fixture.emperor, { type: 'bribe', target: fixture.guild, amount: 5 });
  assert.equal(paid.phase, pending.phase);
  assert.equal(paid.decision?.kind, 'bureaucratPayment');
  assert.notEqual(paid.bureaucratPaymentEvent, pending.bureaucratPaymentEvent);
  const redirected = chooseQualifyingAuction(paid);
  assert.equal(qualifyingAuctionPlayer(redirected, fixture.guild).bribes, 3);
  assert.equal(redirected.bureaucratPayments!.used.length, 1);
  assert.equal(redirected.auction!.index, 1);
  assert.equal(qualifyingAuctionPlayer(redirected, fixture.payer).spice, qualifyingAuctionPlayer(done, fixture.payer).spice);
  assert.deepEqual(qualifyingAuctionPhysicalCards(redirected), fixture.physical);
});
