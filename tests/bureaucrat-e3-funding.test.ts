import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advancePairedE3Nexus, quietPairedE3NexusChoice, pairedE3NexusClean,
  pairedE3NexusInventory } from './fixture-paired-e3-nexus-modules';
import {
  allowE3Responses, bureaucratE3PhysicalCards, chooseBureaucratE3Payment,
  createBureaucratE3AuctionFixture, createBureaucratE3ShipmentFixture,
  declareBureaucratE3Shipment, payBureaucratE3Auction,
  type BureaucratE3AuctionFixture, type BureaucratE3ShipmentFixture,
} from './fixture-bureaucrat-e3-funding';

const seat = (game: Game, id: string) => game.players.find((p) => p.id === id)!;
/** Real worm-alliance partners whose contributions cannot qualify. */
const ALLIANCE = { trainer: 'atreides', auctionPayee: 'emperor' } as const;
const counters = (game: Game) => game.players.map((p) => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, elites: p.elites }));
const hand = (game: Game, id: string) => seat(game, id).hand.map((card) => card.id);

function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Full declared shares leave the payer wallet before any Bureaucrat choice. */
function assertAuctionCosts(f: BureaucratE3AuctionFixture, game: Game): void {
  assert.equal(seat(game, f.payer).spice, seat(f.beforePledge, f.payer).spice - f.payerShare);
  assert.equal(game.aid[f.donor]?.amount ?? 0, 0);
  assert.deepEqual(bureaucratE3PhysicalCards(game), f.physical);
}

function assertAuctionOutcome(f: BureaucratE3AuctionFixture, done: Game, diverted: number): void {
  assertAuctionCosts(f, done);
  const donorLeg = f.donor === f.payee ? f.donorShare : 0;
  assert.equal(seat(done, f.payee).spice,
    seat(f.beforePledge, f.payee).spice - donorLeg + f.amount - diverted);
  assert.equal(seat(done, f.donor).spice,
    seat(f.beforePledge, f.donor).spice - f.donorShare + (f.donor === f.payee ? f.amount - diverted : 0));
  assert.deepEqual(hand(done, f.payer), [...hand(f.beforeAction, f.payer), f.card]);
  assert.equal(done.currentAuctionSale, null);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, diverted ? 1 : 0);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, diverted === 2);
  assert.equal(done.auction!.index, f.beforeAction.auction!.index + 1);
}

function assertShipmentCosts(f: BureaucratE3ShipmentFixture, game: Game): void {
  assert.equal(seat(game, f.payer).spice, seat(f.beforePledge, f.payer).spice - f.primary);
  assert.equal(seat(game, f.donor).spice, seat(f.beforePledge, f.donor).spice - f.donorAmount);
  assert.equal(game.aid[f.donor]?.amount ?? 0, 0);
  assert.equal(seat(game, f.payer).reserves, seat(f.beforePledge, f.payer).reserves - f.amount);
  assert.deepEqual(seat(game, f.payer).forces,
    { ...seat(f.beforePledge, f.payer).forces, [`${f.target}:17`]: f.amount });
  assert.equal(seat(game, f.payer).shipped, true);
  for (const id of f.game.players.map((p) => p.id).filter((id) => id !== f.payer)) {
    assert.deepEqual(seat(game, id).forces, seat(f.beforePledge, id).forces);
    assert.equal(seat(game, id).reserves, seat(f.beforePledge, id).reserves);
  }
  assert.deepEqual(bureaucratE3PhysicalCards(game), f.physical);
}

for (const advanced of [false, true])
  for (const [payerShare, donorShare] of [[5, 3], [3, 5], [5, 5], [0, 5]])
    for (const redirect of [false, true]) {
      void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 native auction ${payerShare}+${donorShare}: ${redirect ? 'Bank two' : 'full Emperor income'}, one purchase and original next lot`, () => {
        const f = createBureaucratE3AuctionFixture({ advanced, payerShare, donorShare });
        assert.equal(seat(f.beforeAction, f.payer).spice, seat(f.beforePledge, f.payer).spice);
        assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - donorShare);
        assert.equal(f.beforeAction.aid[f.donor].amount, donorShare);
        assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
        const paid = payBureaucratE3Auction(f);
        assert.equal(paid.currentAuctionSale?.winner, f.payer);
        assert.equal(paid.currentAuctionSale?.amount, f.amount);
        assert.equal(paid.currentAuctionSale?.seller, null);
        assertAuctionCosts(f, paid);
        assert.equal(seat(paid, f.donor).spice, seat(f.beforePledge, f.donor).spice - donorShare);
        const pending = allowE3Responses(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.equal(pending.decision?.player, f.trainer);
        assert.deepEqual(counters(pending), counters(paid));
        assert.deepEqual(hand(pending, f.payer), hand(paid, f.payer));
        const done = allowE3Responses(chooseBureaucratE3Payment(pending, redirect));
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
      void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 native shipment ${primary}+${pledge}: ${redirect ? 'Bank two' : 'full Guild income'}, army commitment and Movement continuation`, () => {
        const f = createBureaucratE3ShipmentFixture({ advanced, primary, pledge });
        assert.equal(f.game.turn, 2);
        assert.equal(f.game.phase, 5);
        assert.equal(f.game.active, f.payer);
        assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - pledge);
        assert.equal(f.beforeAction.aid[f.donor].amount, pledge);
        assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
        const { game: paid, declared } = declareBureaucratE3Shipment(f);
        if (advanced) {
          assert.equal(declared.decision?.kind, 'guildShipment');
          assert.equal(declared.decision?.player, f.guild);
          assert.deepEqual(counters(declared), counters(f.beforeAction));
          assert.deepEqual(seat(declared, f.payer).hand, seat(f.beforeAction, f.payer).hand);
        }
        assertShipmentCosts(f, paid);
        const pending = allowE3Responses(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.equal(pending.decision?.player, f.trainer);
        assert.deepEqual(counters(pending), counters(paid));
        assert.deepEqual(hand(pending, f.payer), hand(paid, f.payer));
        const done = allowE3Responses(chooseBureaucratE3Payment(pending, redirect));
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
  void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 native receipts never pool sub-five shares`, () => {
    const auction = createBureaucratE3AuctionFixture({ advanced, payerShare: 3, donorShare: 3 });
    const auctionDone = allowE3Responses(payBureaucratE3Auction(auction));
    assert.notEqual(auctionDone.decision?.kind, 'bureaucratPayment');
    assert.equal(auctionDone.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(seat(auctionDone, auction.emperor).spice, seat(auction.beforePledge, auction.emperor).spice + 6);
    assertAuctionOutcome(auction, auctionDone, 0);
    const shipment = createBureaucratE3ShipmentFixture({ advanced, primary: 3, pledge: 3 });
    const shipmentDone = allowE3Responses(declareBureaucratE3Shipment(shipment).paid);
    assert.notEqual(shipmentDone.decision?.kind, 'bureaucratPayment');
    assert.equal(shipmentDone.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(seat(shipmentDone, shipment.guild).spice, seat(shipment.beforePledge, shipment.guild).spice + 6);
    assertShipmentCosts(shipment, shipmentDone);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} original Emperor Karama cancels the gross paired auction income to Bank without a Bureaucrat use`, () => {
    const f = createBureaucratE3AuctionFixture({ advanced, payerShare: 5, donorShare: 5, counter: true });
    assert.ok(f.staging.some((line) => line.includes('swap original unplayed')));
    const paid = payBureaucratE3Auction(f);
    assert.equal(paid.response?.kind, 'emperorIncome');
    assert.equal(paid.response?.owner, f.emperor);
    assert.equal(viewGame(paid, f.trainer).responseControls?.cancelCards.includes(f.counterCard!), true);
    assertAuctionCosts(f, paid);
    const done = allowE3Responses(applyAction(paid, f.trainer, { type: 'card', card: f.counterCard!, mode: 'cancel' }));
    assert.equal(seat(done, f.emperor).spice, seat(f.beforeAction, f.emperor).spice);
    assert.deepEqual(hand(done, f.payer), [...hand(f.beforeAction, f.payer), f.card]);
    assert.equal(done.discard.filter((card) => card.id === f.counterCard).length, 1);
    assert.equal(done.players.some((p) => p.hand.some((card) => card.id === f.counterCard)), false);
    assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    assert.equal(viewGame(done, f.trainer).bureaucrat.pending, null);
    assert.equal(done.auction!.index, f.beforeAction.auction!.index + 1);
    assertAuctionCosts(f, done);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 pending invoices expose only the public gross and payee`, () => {
    const primary = createBureaucratE3AuctionFixture({ advanced, payerShare: 5, donorShare: 3 });
    const donor = createBureaucratE3AuctionFixture({ advanced, payerShare: 3, donorShare: 5 });
    const left = allowE3Responses(payBureaucratE3Auction(primary));
    const right = allowE3Responses(payBureaucratE3Auction(donor));
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
    const shipment = createBureaucratE3ShipmentFixture({ advanced, primary: 5, pledge: 5 });
    const pending = allowE3Responses(declareBureaucratE3Shipment(shipment).paid);
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

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 trainer and payee contributions cannot qualify or mask a real payer`, () => {
    for (const donor of [ALLIANCE.trainer, ALLIANCE.auctionPayee]) {
      const allowed = createBureaucratE3AuctionFixture({ advanced, payerShare: 5, donorShare: 5, donor });
      assert.equal(allowed.worm.phase, 1);
      assert.equal(allowed.worm.nexus, true);
      assert.ok(allowed.worm.players.every((p) => p.ally === null));
      assert.equal(seat(allowed.alliance, allowed.payer).ally, allowed.donor);
      assert.equal(seat(allowed.alliance, allowed.donor).ally, allowed.payer);
      assert.equal(allowed.actions.filter((step) => step.action.type === 'alliance').length, 2);
      const pending = allowE3Responses(payBureaucratE3Auction(allowed));
      assert.equal(pending.decision?.kind, 'bureaucratPayment');
      assertAuctionOutcome(allowed, allowE3Responses(chooseBureaucratE3Payment(pending, true)), 2);
      const masked = createBureaucratE3AuctionFixture({ advanced, payerShare: 3, donorShare: 5, donor });
      const done = allowE3Responses(payBureaucratE3Auction(masked));
      assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    }
    {
      const allowed = createBureaucratE3ShipmentFixture({ advanced, primary: 5, pledge: 5, partner: ALLIANCE.trainer });
      const pending = allowE3Responses(declareBureaucratE3Shipment(allowed).paid);
      assert.equal(pending.decision?.kind, 'bureaucratPayment');
      assertShipmentCosts(allowed, allowE3Responses(chooseBureaucratE3Payment(pending, true)));
      const masked = createBureaucratE3ShipmentFixture({ advanced, primary: 3, pledge: 5, partner: ALLIANCE.trainer });
      const done = allowE3Responses(declareBureaucratE3Shipment(masked).paid);
      assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} paired E3 pending choices reject cross-actor and stale input unchanged`, () => {
    const auction = createBureaucratE3AuctionFixture({ advanced, payerShare: 5, donorShare: 5 });
    const auctionPending = allowE3Responses(payBureaucratE3Auction(auction));
    rejectUnchanged(auctionPending, auction.emperor, { type: 'decision', event: auctionPending.bureaucratPaymentEvent, redirect: true });
    rejectUnchanged(auctionPending, auction.trainer, { type: 'decision', event: 'stale-auction-invoice', redirect: true });
    rejectUnchanged(auctionPending, auction.payer, auction.action);
    assertAuctionOutcome(auction, allowE3Responses(chooseBureaucratE3Payment(auctionPending)), 2);
    const shipment = createBureaucratE3ShipmentFixture({ advanced, primary: 5, pledge: 5 });
    const shipmentPending = allowE3Responses(declareBureaucratE3Shipment(shipment).paid);
    rejectUnchanged(shipmentPending, shipment.donor, { type: 'decision', event: shipmentPending.bureaucratPaymentEvent, redirect: true });
    rejectUnchanged(shipmentPending, shipment.trainer, { type: 'decision', event: 'stale-shipment-invoice', redirect: true });
    rejectUnchanged(shipmentPending, shipment.payer, { type: 'endMovement' });
    rejectUnchanged(shipmentPending, shipment.donor, { type: 'pledgeAid', amount: 1 });
    assertShipmentCosts(shipment, allowE3Responses(chooseBureaucratE3Payment(shipmentPending)));
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} four minimal owner bot choices settle the paired private-funded receipt and resume Movement`, () => {
    for (const bot of DIFFICULTIES) {
      const f = createBureaucratE3ShipmentFixture({ advanced, primary: 5, pledge: 5 });
      const pending = allowE3Responses(declareBureaucratE3Shipment(f).paid);
      const view = viewGame(pending, f.trainer);
      view.players.find((p) => p.id === f.trainer)!.bot = bot;
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
      const f = createBureaucratE3ShipmentFixture({ advanced, primary: 5, pledge: 3 });
      const pending = allowE3Responses(declareBureaucratE3Shipment(f).paid);
      const settled = allowE3Responses(chooseBureaucratE3Payment(pending, redirect));
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
        used = allowE3Responses(chooseBureaucratE3Payment(following, true));
        assert.equal(seat(used, f.guild).bribes, seat(settled, f.guild).bribes + 3);
        assert.equal(seat(used, f.guild).spice, seat(settled, f.guild).spice);
      }
      assert.equal(used.bureaucratPayments?.used.length, 1);
      const ended = applyAction(used, f.payer, { type: 'endMovement' });
      const next = advancePairedE3Nexus(ended, (state) => state.turn === 3 && state.phase === 1 &&
        pairedE3NexusClean(state), undefined, quietPairedE3NexusChoice);
      assert.equal(viewGame(next, f.trainer).bureaucrat.usedThisPhase, false);
      const payment = applyAction(next, f.emperor, { type: 'bribe', target: f.guild, amount: 5 });
      assert.equal(payment.decision?.kind, 'bureaucratPayment');
      const renewed = allowE3Responses(chooseBureaucratE3Payment(payment, true));
      assert.equal(renewed.bureaucratPayments?.used.length, 2);
      assert.deepEqual(renewed.bureaucratPayments!.used.map((use) => ({ turn: use.turn, phase: use.phase })),
        [{ turn: 2, phase: 5 }, { turn: 3, phase: 1 }]);
      assert.equal(viewGame(renewed, f.trainer).bureaucrat.usedThisPhase, true);
      assert.deepEqual(counters(renewed), counters(next));
    }
  });
}

void test('Basic no-Nexus E3 allied nonstronghold shipment pays ten for five physical forces; native cancellation precedes one Bank diversion', () => {
  const f = createBureaucratE3ShipmentFixture({
    nexus: false, primary: 5, pledge: 5, target: 'habbanya_erg', counter: true,
  });
  assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - 5);
  assert.equal(f.beforeAction.aid[f.donor].amount, 5);
  assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
  const { paid } = declareBureaucratE3Shipment(f);
  assert.equal(paid.response?.kind, 'guildIncome');
  assert.equal(paid.response?.amount, 10);
  assert.equal(viewGame(paid, f.trainer).responseControls?.cancelCards.includes(f.counterCard!), true);
  assertShipmentCosts(f, paid);
  assert.equal(seat(paid, f.payer).forces[`${f.target}:17`], 5);
  const canceled = allowE3Responses(applyAction(structuredClone(paid), f.trainer,
    { type: 'card', card: f.counterCard!, mode: 'cancel' }));
  assert.equal(seat(canceled, f.guild).spice, seat(f.beforePledge, f.guild).spice);
  assert.equal(canceled.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(viewGame(canceled, f.trainer).bureaucrat.pending, null);
  assert.notEqual(canceled.decision?.kind, 'bureaucratPayment');
  assert.equal(canceled.discard.filter((card) => card.id === f.counterCard).length, 1);
  assertShipmentCosts(f, canceled);
  assert.equal(canceled.phase, 5);
  assert.equal(canceled.active, f.payer);

  const pending = allowE3Responses(structuredClone(paid));
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(pending.decision?.player, f.trainer);
  for (const viewer of [f.trainer, f.emperor]) {
    const invoice = viewGame(pending, viewer).bureaucrat.pending!;
    assert.equal(invoice.payer, null);
    assert.equal(invoice.amount, 10);
    assert.equal(invoice.payee, f.guild);
    assert.equal('contributions' in invoice, false);
    assert.equal('signature' in invoice, false);
  }
  const done = allowE3Responses(chooseBureaucratE3Payment(pending));
  assertShipmentCosts(f, done);
  assert.equal(seat(done, f.guild).spice, seat(f.beforePledge, f.guild).spice + 8);
  assert.equal(done.bureaucratPayments?.used.length, 1);
  assert.deepEqual(hand(done, f.trainer), hand(f.beforeAction, f.trainer));
  assert.equal(done.decision, null);
  assert.equal(done.phase, 5);
  assert.equal(done.active, f.payer);
  pairedE3NexusInventory(done);
  const moved = applyAction(structuredClone(done), f.payer, { type: 'endMovement' });
  assert.equal(moved.active, null);
  assert.equal(moved.phase, 7);
  assert.equal(moved.decision, null);
  assert.deepEqual(counters(moved), counters(done));
});

void test('Advanced no-Nexus E3 auction with an unused selected CHOAM deck qualifies the donor alone and resumes the original lot after native allowance', () => {
  const f = createBureaucratE3AuctionFixture({
    advanced: true, nexus: false, families: ['choam'], payerShare: 3, donorShare: 5, counter: true,
  });
  assert.equal(f.worm.nexus, true);
  assert.ok(f.worm.players.every((p) => p.ally === null));
  assert.equal(seat(f.alliance, f.payer).ally, f.donor);
  assert.equal(seat(f.alliance, f.donor).ally, f.payer);
  assert.equal(seat(f.beforeAction, f.donor).spice, seat(f.beforePledge, f.donor).spice - 5);
  assert.equal(f.beforeAction.aid[f.donor].amount, 5);
  const paid = payBureaucratE3Auction(f);
  assert.equal(paid.response?.kind, 'emperorIncome');
  assert.equal(viewGame(paid, f.trainer).responseControls?.cancelCards.includes(f.counterCard!), true);
  assertAuctionCosts(f, paid);
  const canceled = allowE3Responses(applyAction(structuredClone(paid), f.trainer,
    { type: 'card', card: f.counterCard!, mode: 'cancel' }));
  assert.equal(seat(canceled, f.emperor).spice, seat(f.beforePledge, f.emperor).spice);
  assert.equal(canceled.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(viewGame(canceled, f.trainer).bureaucrat.pending, null);
  assert.notEqual(canceled.decision?.kind, 'bureaucratPayment');
  assert.equal(canceled.discard.filter((card) => card.id === f.counterCard).length, 1);
  assertAuctionCosts(f, canceled);
  assert.deepEqual(hand(canceled, f.payer), [...hand(f.beforeAction, f.payer), f.card]);
  assert.equal(canceled.currentAuctionSale, null);
  assert.equal(canceled.auction!.index, f.beforeAction.auction!.index + 1);

  const pending = allowE3Responses(structuredClone(paid));
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  for (const viewer of [f.trainer, f.guild]) {
    const invoice = viewGame(pending, viewer).bureaucrat.pending!;
    assert.equal(invoice.payer, null);
    assert.equal(invoice.amount, 8);
    assert.equal(invoice.payee, f.emperor);
    assert.equal('contributions' in invoice, false);
    assert.equal('signature' in invoice, false);
  }
  const done = allowE3Responses(chooseBureaucratE3Payment(pending));
  assertAuctionOutcome(f, done, 2);
  assert.deepEqual(counters(done), counters(f.beforeAction));
  assert.deepEqual(hand(done, f.trainer), hand(f.beforeAction, f.trainer));
  assert.equal(done.auction!.active, canceled.auction!.active);
  assert.equal(done.auction!.cards[done.auction!.index].id, canceled.auction!.cards[canceled.auction!.index].id);
  pairedE3NexusInventory(done);
});

void test('No-Nexus E3 actual auction shares neither pool sub-five amounts nor qualify the trainer or native payee', () => {
  for (const [donor, payerShare, donorShare] of [
    ['moritani', 4, 4], [ALLIANCE.trainer, 3, 5], [ALLIANCE.auctionPayee, 3, 5],
  ] as const) {
    const f = createBureaucratE3AuctionFixture({ nexus: false, donor, payerShare, donorShare });
    const done = allowE3Responses(payBureaucratE3Auction(f));
    assert.notEqual(done.decision?.kind, 'bureaucratPayment');
    assert.equal(viewGame(done, f.trainer).bureaucrat.pending, null);
    assertAuctionOutcome(f, done, 0);
    assert.deepEqual(counters(done), counters(f.beforeAction));
  }
});
