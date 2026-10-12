import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bureaucratAlliedFundingModeSupported, bureaucratPaymentModeSupported } from '../game/bureaucrat-payment';
import { advancePairedIxNexusSkills } from './fixture-paired-ix-nexus-skills';
import {
  allowE1Responses, bureaucratE1PhysicalCards, chooseBureaucratE1Payment,
  createBureaucratE1AuctionFixture, createBureaucratE1FundingBase,
  createBureaucratE1RevivalFixture, createBureaucratE1ShipmentFixture,
  declareBureaucratE1Shipment, payBureaucratE1Auction, payBureaucratE1Revival,
  reviveBureaucratE1,
  type BureaucratE1AuctionFixture, type BureaucratE1ShipmentFixture,
} from './fixture-bureaucrat-e1-funding';

const seat = (game: Game, id: string) => game.players.find(p => p.id === id)!;
const hand = (game: Game, id: string) => seat(game, id).hand.map(card => card.id);
const counters = (game: Game) => game.players.map(p => ({
  id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites,
}));

function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Full declared shares leave the payer wallet before any Bureaucrat choice.
 * A donor that is also the payee collects the sale later, so only its pledge is
 * checked here. */
function assertAuctionCosts(f: BureaucratE1AuctionFixture, game: Game): void {
  assert.equal(seat(game, f.payer).spice, seat(f.beforePledge, f.payer).spice - f.payerShare);
  if (f.donor !== f.payee)
    assert.equal(seat(game, f.donor).spice, seat(f.beforePledge, f.donor).spice - f.donorShare);
  assert.equal(game.aid[f.donor]?.amount ?? 0, 0);
  assert.deepEqual(bureaucratE1PhysicalCards(game), f.physical);
}

/** One purchase (with its original replacement draw) and original next lot. */
function assertAuctionOutcome(f: BureaucratE1AuctionFixture, done: Game, diverted: number): void {
  assertAuctionCosts(f, done);
  const donorLeg = f.donor === f.payee ? f.donorShare : 0;
  assert.equal(seat(done, f.payee).spice,
    seat(f.beforePledge, f.payee).spice - donorLeg + f.amount - diverted);
  assert.deepEqual(hand(done, f.payer),
    [...hand(f.beforeAction, f.payer), f.card, f.beforeAction.deck[0].id]);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, diverted ? 1 : 0);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, diverted === 2);
  assert.equal(done.auction!.index, f.beforeAction.auction!.index + 1);
}

function assertShipmentCosts(f: BureaucratE1ShipmentFixture, game: Game): void {
  assert.equal(seat(game, f.payer).spice, seat(f.beforePledge, f.payer).spice - f.primary);
  assert.equal(seat(game, f.donor).spice, seat(f.beforePledge, f.donor).spice - f.donorAmount);
  assert.equal(game.aid[f.donor]?.amount ?? 0, 0);
  assert.equal(seat(game, f.payer).reserves, seat(f.beforePledge, f.payer).reserves - f.amount);
  assert.deepEqual(seat(game, f.payer).forces,
    { ...seat(f.beforePledge, f.payer).forces, [`${f.target}:${f.sector}`]: f.amount });
  assert.equal(seat(game, f.payer).shipped, true);
  for (const id of f.game.players.map(p => p.id).filter(id => id !== f.payer)) {
    assert.deepEqual(seat(game, id).forces, seat(f.beforePledge, id).forces);
    assert.equal(seat(game, id).reserves, seat(f.beforePledge, id).reserves);
  }
  assert.deepEqual(bureaucratE1PhysicalCards(game), f.physical);
}

void test('paired E1 no-Homeworlds nexus skills admit both Bureaucrat mode gates and nothing broader', () => {
  const base = createBureaucratE1FundingBase({});
  assert.deepEqual(base.game.expansions, ['ix']);
  assert.equal(base.game.homeworlds, undefined);
  assert.equal(bureaucratPaymentModeSupported(base.game), true);
  assert.equal(bureaucratAlliedFundingModeSupported(base.game), true);
  const single = structuredClone(base.game);
  single.players = single.players.filter(p => p.id !== 'tleilaxu');
  assert.equal(bureaucratPaymentModeSupported(single), false);
  const multi = structuredClone(base.game);
  multi.expansions = ['ix', 'choam'];
  assert.equal(bureaucratPaymentModeSupported(multi), false);
  assert.equal(bureaucratAlliedFundingModeSupported(multi), false);
});

for (const advanced of [false, true])
  for (const [payerShare, donorShare] of [[5, 3], [3, 5], [5, 5], [0, 5]])
    for (const redirect of [false, true]) {
      void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 native auction ${payerShare}+${donorShare}: ${redirect ? 'Bank two' : 'full Emperor income'}, one purchase and original next lot`, () => {
        const f = createBureaucratE1AuctionFixture({ advanced, payerShare, donorShare });
        assert.equal(seat(f.beforeAction, f.payer).spice, seat(f.beforePledge, f.payer).spice);
        assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - donorShare);
        assert.equal(f.beforeAction.aid[f.donor].amount, donorShare);
        assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
        const paid = payBureaucratE1Auction(f);
        assert.equal(paid.currentAuctionSale?.winner, f.payer);
        assert.equal(paid.currentAuctionSale?.amount, f.amount);
        assert.equal(paid.currentAuctionSale?.seller, null);
        assertAuctionCosts(f, paid);
        const pending = allowE1Responses(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.equal(pending.decision?.player, f.trainer);
        assert.deepEqual(counters(pending), counters(paid));
        assert.deepEqual(hand(pending, f.payer), hand(paid, f.payer));
        const done = allowE1Responses(chooseBureaucratE1Payment(pending, redirect));
        assertAuctionOutcome(f, done, redirect ? 2 : 0);
        assert.deepEqual(counters(done), counters(pending));
        assert.equal(done.bureaucratPayments?.pending, undefined);
        rejectUnchanged(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
        rejectUnchanged(done, f.payer, f.action);
      });
    }

for (const advanced of [false, true])
  for (const [primary, pledge] of [[5, 3], [3, 5], [5, 5], [0, 5]])
    for (const redirect of [false, true]) {
      void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 native shipment ${primary}+${pledge}: ${redirect ? 'Bank two' : 'full Guild income'}, army commitment and Movement continuation`, () => {
        const f = createBureaucratE1ShipmentFixture({ advanced, primary, pledge });
        assert.equal(f.game.turn, 2);
        assert.equal(f.game.phase, 5);
        assert.equal(f.game.active, f.payer);
        assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - pledge);
        assert.equal(f.beforeAction.aid[f.donor].amount, pledge);
        assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
        const { game: paid, declared } = declareBureaucratE1Shipment(f);
        if (advanced) {
          assert.equal(declared.decision?.kind, 'guildShipment');
          assert.equal(declared.decision?.player, f.guild);
          assert.deepEqual(counters(declared), counters(f.beforeAction));
          assert.deepEqual(seat(declared, f.payer).hand, seat(f.beforeAction, f.payer).hand);
        }
        const pending = allowE1Responses(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.equal(pending.decision?.player, f.trainer);
        assert.deepEqual(counters(pending), counters(paid));
        const done = allowE1Responses(chooseBureaucratE1Payment(pending, redirect));
        assert.equal(seat(done, f.guild).spice, seat(f.beforePledge, f.guild).spice + f.amount - (redirect ? 2 : 0));
        for (const id of [f.payer, f.donor, f.trainer, f.emperor]) {
          assert.equal(seat(done, id).spice, seat(paid, id).spice);
          assert.equal(seat(done, id).bribes, seat(paid, id).bribes);
        }
        assert.equal(done.bureaucratPayments?.used.length ?? 0, redirect ? 1 : 0);
        assertShipmentCosts(f, done);
        assert.deepEqual(counters(done), counters(paid));
        assert.equal(done.phase, 5);
        assert.equal(done.active, f.payer);
        rejectUnchanged(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
        const ended = applyAction(structuredClone(done), f.payer, { type: 'endMovement' });
        assert.notEqual(ended.active, f.payer);
        assert.deepEqual(counters(ended), counters(done));
      });
    }

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 native receipts never pool sub-five shares`, () => {
    const auction = createBureaucratE1AuctionFixture({ advanced, payerShare: 3, donorShare: 3 });
    const auctionDone = allowE1Responses(payBureaucratE1Auction(auction));
    assert.notEqual(auctionDone.decision?.kind, 'bureaucratPayment');
    assert.equal(auctionDone.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(seat(auctionDone, auction.emperor).spice, seat(auction.beforePledge, auction.emperor).spice + 6);
    assertAuctionOutcome(auction, auctionDone, 0);
    const shipment = createBureaucratE1ShipmentFixture({ advanced, primary: 3, pledge: 3 });
    const shipmentDone = allowE1Responses(declareBureaucratE1Shipment(shipment).paid);
    assert.notEqual(shipmentDone.decision?.kind, 'bureaucratPayment');
    assert.equal(shipmentDone.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(seat(shipmentDone, shipment.guild).spice, seat(shipment.beforePledge, shipment.guild).spice + 6);
    assertShipmentCosts(shipment, shipmentDone);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 trainer and payee contributions cannot qualify or mask a real payer`, () => {
    for (const donor of ['atreides', 'emperor']) {
      const allowed = createBureaucratE1AuctionFixture({ advanced, payerShare: 5, donorShare: 5, donor });
      assert.equal(seat(allowed.alliance, allowed.payer).ally, donor);
      assert.equal(seat(allowed.alliance, donor).ally, allowed.payer);
      const pending = allowE1Responses(payBureaucratE1Auction(allowed));
      assert.equal(pending.decision?.kind, 'bureaucratPayment');
      assert.equal(pending.bureaucratPayments?.pending?.source.payer, allowed.payer);
      assertAuctionOutcome(allowed, allowE1Responses(chooseBureaucratE1Payment(pending, true)), 2);
      const masked = createBureaucratE1AuctionFixture({ advanced, payerShare: 3, donorShare: 5, donor });
      const done = allowE1Responses(payBureaucratE1Auction(masked));
      assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    }
    {
      const allowed = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 5, donor: 'atreides' });
      const pending = allowE1Responses(declareBureaucratE1Shipment(allowed).paid);
      assert.equal(pending.decision?.kind, 'bureaucratPayment');
      assert.equal(pending.bureaucratPayments?.pending?.source.payer, allowed.payer);
      assertShipmentCosts(allowed, allowE1Responses(chooseBureaucratE1Payment(pending, true)));
      const masked = createBureaucratE1ShipmentFixture({ advanced, primary: 3, pledge: 5, donor: 'atreides' });
      const done = allowE1Responses(declareBureaucratE1Shipment(masked).paid);
      assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    }
    // A Guild ally is charged the half price and its own shipment leg is zero,
    // so the payee can never contribute a qualifying share to its own receipt.
    const payee = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 5, donor: 'guild' });
    const payeeDone = allowE1Responses(declareBureaucratE1Shipment(payee).paid);
    assert.notEqual(payeeDone.decision?.kind, 'bureaucratPayment');
    assert.equal(seat(payeeDone, payee.payer).spice, seat(payee.beforePledge, payee.payer).spice);
    assert.equal(seat(payeeDone, payee.guild).spice, seat(payee.beforePledge, payee.guild).spice - 5);
    assert.deepEqual(seat(payeeDone, payee.payer).forces,
      { ...seat(payee.beforePledge, payee.payer).forces, [`${payee.target}:${payee.sector}`]: payee.amount });
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 pending invoices expose only the public gross and payee`, () => {
    const primary = createBureaucratE1AuctionFixture({ advanced, payerShare: 5, donorShare: 3 });
    const donorFunded = createBureaucratE1AuctionFixture({ advanced, payerShare: 3, donorShare: 5 });
    const left = allowE1Responses(payBureaucratE1Auction(primary));
    const right = allowE1Responses(payBureaucratE1Auction(donorFunded));
    assert.equal(left.bureaucratPayments?.pending?.source.payer, primary.payer);
    assert.equal(right.bureaucratPayments?.pending?.source.payer, donorFunded.donor);
    for (const viewer of [primary.trainer, primary.guild, primary.emperor]) {
      const invoice = viewGame(left, viewer).bureaucrat.pending!;
      const other = viewGame(right, viewer).bureaucrat.pending!;
      assert.equal(invoice.payer, null);
      assert.equal(invoice.payee, primary.emperor);
      assert.equal(invoice.amount, 8);
      assert.equal(invoice.kind, 'auction');
      assert.equal(invoice.redirect, 2);
      assert.equal(invoice.owner, primary.trainer);
      assert.equal('contributions' in invoice, false);
      assert.equal('signature' in invoice, false);
      assert.equal(other.amount, 8);
      assert.equal('contributions' in other, false);
    }
    const shipment = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 5 });
    const pending = allowE1Responses(declareBureaucratE1Shipment(shipment).paid);
    for (const viewer of pending.players) {
      const invoice = viewGame(pending, viewer.id).bureaucrat.pending!;
      assert.equal(invoice.payer, null);
      assert.equal(invoice.payee, shipment.guild);
      assert.equal(invoice.amount, 10);
      assert.equal(invoice.kind, 'shipment');
      assert.equal(invoice.owner, shipment.trainer);
      assert.equal('contributions' in invoice, false);
      assert.equal('signature' in invoice, false);
      assert.equal('bureaucratPayments' in viewGame(pending, viewer.id), false);
      assert.equal('bureaucratUseEvents' in viewGame(pending, viewer.id), false);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E1 pending choices reject cross-actor and stale input unchanged`, () => {
    const auction = createBureaucratE1AuctionFixture({ advanced, payerShare: 5, donorShare: 5 });
    const auctionPending = allowE1Responses(payBureaucratE1Auction(auction));
    rejectUnchanged(auctionPending, auction.emperor, { type: 'decision', event: auctionPending.bureaucratPaymentEvent, redirect: true });
    rejectUnchanged(auctionPending, auction.trainer, { type: 'decision', event: 'stale-auction-invoice', redirect: true });
    rejectUnchanged(auctionPending, auction.payer, auction.action);
    assertAuctionOutcome(auction, allowE1Responses(chooseBureaucratE1Payment(auctionPending)), 2);
    const shipment = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 5 });
    const shipmentPending = allowE1Responses(declareBureaucratE1Shipment(shipment).paid);
    rejectUnchanged(shipmentPending, shipment.donor, { type: 'decision', event: shipmentPending.bureaucratPaymentEvent, redirect: true });
    rejectUnchanged(shipmentPending, shipment.trainer, { type: 'decision', event: 'stale-shipment-invoice', redirect: true });
    rejectUnchanged(shipmentPending, shipment.payer, { type: 'endMovement' });
    rejectUnchanged(shipmentPending, shipment.donor, { type: 'pledgeAid', amount: 1 });
    assertShipmentCosts(shipment, allowE1Responses(chooseBureaucratE1Payment(shipmentPending)));
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} four minimal owner bot choices settle the paired private-funded receipt and resume Movement`, () => {
    for (const bot of DIFFICULTIES) {
      const f = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 5 });
      const pending = allowE1Responses(declareBureaucratE1Shipment(f).paid);
      const view = viewGame(pending, f.trainer);
      view.players.find(p => p.id === f.trainer)!.bot = bot;
      const actions = botActions(view);
      assert.equal(actions.length, 1);
      const after = applyAction(structuredClone(pending), f.trainer, actions[0]);
      assert.equal(seat(after, f.guild).spice, seat(f.beforePledge, f.guild).spice + f.amount - 2);
      assert.equal(after.bureaucratPayments?.used.length, 1);
      assert.deepEqual(counters(after), counters(pending));
      for (const id of [f.payer, f.donor, f.trainer, f.emperor]) assert.equal(seat(after, id).spice, seat(pending, id).spice);
      assert.equal(after.phase, 5);
      assert.equal(after.active, f.payer);
      const ended = applyAction(structuredClone(after), f.payer, { type: 'endMovement' });
      assert.notEqual(ended.active, f.payer);
      assert.deepEqual(counters(ended), counters(after));
      rejectUnchanged(ended, f.trainer, actions[0]);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} one physical Bureaucrat use per native phase survives a decline and renews after Mentat`, () => {
    for (const redirect of [false, true]) {
      const f = createBureaucratE1ShipmentFixture({ advanced, primary: 5, pledge: 3 });
      const pending = allowE1Responses(declareBureaucratE1Shipment(f).paid);
      const settled = allowE1Responses(chooseBureaucratE1Payment(pending, redirect));
      const following = applyAction(structuredClone(settled), f.emperor, { type: 'bribe', target: f.guild, amount: 5 });
      assert.equal(seat(following, f.emperor).spice, 5);
      assert.deepEqual(counters(following), counters(settled));
      let used: Game;
      if (redirect) {
        assert.notEqual(following.decision?.kind, 'bureaucratPayment');
        assert.equal(seat(following, f.guild).bribes, seat(settled, f.guild).bribes + 5);
        used = following;
      } else {
        assert.equal(following.decision?.kind, 'bureaucratPayment');
        rejectUnchanged(following, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
        used = allowE1Responses(chooseBureaucratE1Payment(following, true));
        assert.equal(seat(used, f.guild).bribes, seat(settled, f.guild).bribes + 3);
        assert.equal(seat(used, f.guild).spice, seat(settled, f.guild).spice);
      }
      assert.equal(used.bureaucratPayments?.used.length, 1);
      const ended = applyAction(used, f.payer, { type: 'endMovement' });
      const next = advancePairedIxNexusSkills(ended, (state) => state.turn === 3 && state.phase === 1 &&
        !state.phaseOpening && !state.response && !state.decision);
      assert.equal(viewGame(next, f.trainer).bureaucrat.usedThisPhase, false);
      const payment = applyAction(next, f.emperor, { type: 'bribe', target: f.guild, amount: 5 });
      assert.equal(payment.decision?.kind, 'bureaucratPayment');
      const renewed = allowE1Responses(chooseBureaucratE1Payment(payment, true));
      assert.equal(renewed.bureaucratPayments?.used.length, 2);
      assert.deepEqual(renewed.bureaucratPayments!.used.map(use => ({ turn: use.turn, phase: use.phase })),
        [{ turn: 2, phase: 5 }, { turn: 3, phase: 1 }]);
      assert.equal(viewGame(renewed, f.trainer).bureaucrat.usedThisPhase, true);
      assert.deepEqual(counters(renewed), counters(next));
    }
  });
}

void test('paired E1 single-payer bribe now reaches the same opened mode gate', () => {
  const base = createBureaucratE1FundingBase({});
  const bribed = applyAction(structuredClone(base.game), 'emperor', { type: 'bribe', target: 'guild', amount: 5 });
  assert.equal(bribed.decision?.kind, 'bureaucratPayment');
  assert.equal(bribed.bureaucratPayments?.pending?.source.kind, 'bribe');
  assert.equal(bribed.bureaucratPayments?.pending?.source.payer, 'emperor');
  assert.equal(bribed.bureaucratPayments?.pending?.source.payee, 'guild');
  assert.equal(bribed.bureaucratPayments?.pending?.source.amount, 5);
  assert.equal(seat(bribed, 'emperor').spice, 5);
  const done = allowE1Responses(chooseBureaucratE1Payment(bribed, true));
  assert.equal(seat(done, 'guild').bribes, 3);
  assert.equal(seat(done, 'guild').spice, seat(base.game, 'guild').spice);
  assert.equal(done.bureaucratPayments?.used.length, 1);
});

void test('paired E1 paid Tleilaxu revival income offers Bureaucrat at phase four and redirects exactly two', () => {
  const f = createBureaucratE1RevivalFixture({});
  assert.equal(f.game.turn, 3);
  assert.equal(f.game.phase, 4);
  const before = structuredClone(f.game);
  const pending = payBureaucratE1Revival(f);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(pending.decision?.player, f.trainer);
  const source = pending.bureaucratPayments!.pending!.source;
  assert.equal(source.kind, 'revival');
  assert.equal(source.phase, 4);
  assert.equal(source.payer, f.payer);
  assert.equal(source.payee, f.tleilaxu);
  assert.equal(source.amount, 6);
  assert.equal(source.privateFunding, undefined);
  assert.equal(seat(pending, f.payer).spice, seat(before, f.payer).spice - 6);
  assert.equal(viewGame(pending, f.payer).bureaucrat.pending?.amount, 6);
  assert.equal(viewGame(pending, f.payer).bureaucrat.pending?.payer, f.payer);
  assert.equal(viewGame(pending, 'ixians').bureaucrat.pending, null);
  const done = allowE1Responses(chooseBureaucratE1Payment(pending, true));
  assert.equal(seat(done, f.payer).spice, seat(before, f.payer).spice - 6);
  assert.equal(seat(done, f.tleilaxu).spice, seat(before, f.tleilaxu).spice + 5);
  assert.equal(done.bureaucratPayments?.used.length, 1);
  assert.equal(done.response, null);
  assert.equal(done.decision, null);
  rejectUnchanged(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
});

void test('paired E1 below-five paid revival and a Karama-canceled native revival window create no offer', () => {
  const small = createBureaucratE1RevivalFixture({ amount: 3 });
  const smallBefore = structuredClone(small.game);
  const smallDone = payBureaucratE1Revival(small);
  assert.notEqual(smallDone.decision?.kind, 'bureaucratPayment');
  assert.equal(smallDone.bureaucratPayments?.pending, undefined);
  assert.equal(seat(smallDone, small.payer).spice, seat(smallBefore, small.payer).spice - 2);
  assert.equal(seat(smallDone, small.tleilaxu).spice, seat(smallBefore, small.tleilaxu).spice + 3);
  const canceled = createBureaucratE1RevivalFixture({ counter: true });
  const canceledBefore = structuredClone(canceled.game);
  assert.ok(canceled.counterCard && canceled.staging.some(line => line.includes('swap original unplayed')));
  const held = reviveBureaucratE1(canceled);
  assert.equal(held.response?.kind, 'revivalLimit');
  assert.equal(held.response?.owner, canceled.tleilaxu);
  const done = allowE1Responses(applyAction(held, canceled.trainer, { type: 'card', card: canceled.counterCard!, mode: 'cancel' }));
  assert.notEqual(done.decision?.kind, 'bureaucratPayment');
  assert.equal(done.bureaucratPayments?.pending, undefined);
  assert.equal(seat(done, canceled.payer).spice, seat(canceledBefore, canceled.payer).spice);
  assert.equal(seat(done, canceled.tleilaxu).spice, seat(canceledBefore, canceled.tleilaxu).spice);
  assert.equal(done.discard.filter(card => card.id === canceled.counterCard).length, 1);
});

void test('paired E1 Nexus Guild route: Guild Cunning is the Guild\'s own card and a Guild-authored shipment has no third-party payer', () => {
  const base = createBureaucratE1FundingBase({});
  assert.ok(base.worm.nexusCards!.cards!.deck.includes('guild'));
  assert.equal(base.alliance.players.find(p => p.id === base.guild)!.ally, null);
  const game = advancePairedIxNexusSkills(structuredClone(base.game),
    (state) => state.phase === 5 && state.active === base.guild &&
      !state.phaseOpening && !state.response && !state.decision);
  const before = structuredClone(game);
  const target = 'habbanya_ridge_sietch';
  const sector = territory(target).sectors[0];
  assert.ok(game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(target))));
  let paid = applyAction(game, base.guild, { type: 'ship', territory: target, sector, amount: 5, elite: 0, allyPayment: 0 });
  if (paid.decision?.kind === 'guildShipment')
    paid = applyAction(paid, paid.decision.player, { type: 'decision', allow: true });
  paid = allowE1Responses(paid);
  assert.notEqual(paid.decision?.kind, 'bureaucratPayment');
  assert.equal(paid.bureaucratPayments?.pending, undefined);
  assert.equal(seat(paid, base.guild).spice, seat(before, base.guild).spice - 3);
  assert.equal(seat(paid, base.guild).reserves, seat(before, base.guild).reserves - 5);
  assert.deepEqual(seat(paid, base.guild).forces,
    { ...seat(before, base.guild).forces, [`${target}:${sector}`]: 5 });
});
