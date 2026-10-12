import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { semutaEmperorIncomeCards } from './fixture-semuta-emperor-income';
import {
  createSemutaHomeworldEmperorIncomeFixture, nextSemutaHomeworldEmperorIncomeStep,
  reactSemutaHomeworldEmperorIncome, semutaHomeworldEmperorForceTotals,
  type SemutaHomeworldEmperorIncomeFixture, type SemutaHomeworldEmperorIncomeKind,
} from './fixture-semuta-homeworld-emperor-income';

const configurations: { kind: SemutaHomeworldEmperorIncomeKind; advanced: boolean; occupied: boolean }[] = [
  { kind: 'emperorIncome', advanced: false, occupied: false },
  { kind: 'emperorIncome', advanced: true, occupied: false },
  { kind: 'emperorIncome', advanced: true, occupied: true },
  { kind: 'richesePurchaseIncome', advanced: true, occupied: false },
  { kind: 'richesePurchaseIncome', advanced: true, occupied: true },
];

/** Consume the original suffix, not a forwarded or reconstructed source. */
function exerciseOriginalIncomeSuffix(game: Game, fixture: SemutaHomeworldEmperorIncomeFixture): Game {
  const wallets = game.players.map(player => ({ id: player.id, spice: player.spice }));
  if (fixture.kind === 'emperorIncome') {
    assert.equal(game.auction!.index, fixture.game.auction!.index + 1);
    assert.deepEqual(game.auction!.cards.map(card => card.id), fixture.game.auction!.cards.map(card => card.id));
    assert.equal(game.response?.kind, 'atreidesAuction');
    assert.equal(game.response!.owner, 'a');
    for (let n = 0; game.response?.kind === 'atreidesAuction' && n < game.players.length; n++) {
      const next = nextSemutaHomeworldEmperorIncomeStep(game);
      game = applyAction(game, next.actor, next.action);
    }
    assert.equal(game.auction!.index, fixture.game.auction!.index + 1);
    const bidder = game.auction!.active;
    game = applyAction(game, bidder, { type: 'bid', amount: 1 });
    assert.equal(game.auction!.bidder, bidder);
    assert.equal(game.auction!.index, fixture.game.auction!.index + 1);
  } else {
    assert.deepEqual(game.decision, fixture.beforePayment.decision);
    assert.equal(game.decision!.player, fixture.buyer);
    assert.equal(game.richeseCache!.length, fixture.beforePayment.richeseCache!.length - 1);
    assert.equal(semutaEmperorPlayer(game, fixture.buyer).specialKaramaUsed, true);
    assert.equal(game.discard.filter(card => card.id === fixture.special).length, 1);
    const next = nextSemutaHomeworldEmperorIncomeStep(game);
    assert.equal(next.actor, fixture.buyer);
    assert.throws(() => applyAction(game, fixture.owner, next.action));
    game = applyAction(game, next.actor, next.action);
    // An uncanceled-income baseline still holds its Karama and can answer the
    // original Richese declaration response. Follow that real queue first.
    for (let n = 0; game.response?.kind === 'richeseAuction' && n < game.players.length; n++) {
      const response = nextSemutaHomeworldEmperorIncomeStep(game);
      game = applyAction(game, response.actor, response.action);
    }
    assert.equal(game.decision?.kind, 'richeseCache');
    assert.equal(game.decision!.player, fixture.buyer);
    assert.throws(() => applyAction(game, next.actor, next.action), 'The source declaration cannot replay');
  }
  assert.deepEqual(game.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
  return game;
}

for (const config of configurations) {
  for (const claim of [false, true]) void test(
    `Homeworld ${config.advanced ? 'Advanced' : 'Basic'} ${config.occupied ? 'occupied' : 'clean low'} ${config.kind}: Semuta ${claim ? 'claims' : 'passes'} before native denial and original allocation`, () => {
      const f = createSemutaHomeworldEmperorIncomeFixture(config.kind, config);
      assert.equal(semutaEmperorPlayer(f.game, f.buyer).spice,
        semutaEmperorPlayer(f.beforePayment, f.buyer).spice - f.amount);
      assert.equal(semutaEmperorPlayer(f.game, f.owner).spice,
        semutaEmperorPlayer(f.beforePayment, f.owner).spice);
      assert.equal(semutaEmperorPlayer(f.game, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(semutaEmperorPlayer(f.game, f.holder).hand.length, 4);
      if (config.occupied) {
        assert.ok(f.occupied);
        const originalAuthority = quoteStableHomeworldOccupation(f.occupied!, 'kaitain').entitlement!;
        assert.equal(originalAuthority.occupier, f.allocationOwner);
        assert.equal(originalAuthority.ally, f.allocationAlly);
        assert.equal(quoteStableHomeworldOccupation(f.game, 'kaitain').entitlement!.qualification,
          originalAuthority.qualification, 'The original invasion epoch still owns this later source');
        assert.equal(semutaEmperorPlayer(f.game, f.owner).reserves,
          semutaEmperorPlayer(f.game, f.owner).elites!.reserves,
          'Salusa elites are included in reserves; Kaitain has no invented extra elite stock');
      }
      const wallets = f.game.players.map(player => ({ id: player.id, spice: player.spice }));
      const forces = semutaHomeworldEmperorForceTotals(f.game);
      const receiptCount = f.game.homeworldOccupiedPercentageLedger!.receipts.length;
      const pending = applyAction(f.game, f.canceler, f.cancel);
      const cost = pending.pendingTreacheryDiscard;
      assert.ok(cost, 'The real printed income-cancellation cost must pause for Semuta');
      assert.equal(cost.batch.cause, `karama:${f.kind}`);
      assert.deepEqual(cost.batch.entries, [{ card: f.karamaCard, discardedBy: f.canceler, publicFace: true }]);
      assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true);
      assert.deepEqual(viewGame(pending, f.holder).semutaReaction!.candidates, []);
      assert.equal(pending.homeworldOccupiedPercentageLedger!.receipts.length, receiptCount);
      assert.deepEqual(pending.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
      assert.equal(semutaEmperorPlayer(pending, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.throws(() => applyAction(pending, f.buyer, { type: 'bid', amount: 1 }));
      assert.throws(() => applyAction(pending, f.owner,
        { type: 'decision', event: cost.batch.event, ownAmount: f.occupiedAmount }));
      if (f.kind === 'emperorIncome') {
        assert.equal(pending.auction!.index, f.game.auction!.index);
        assert.equal(pending.currentAuctionSale!.winner, f.buyer);
      } else {
        assert.notEqual(f.special, f.karama);
        assert.equal(pending.richeseCache!.some(card => card.id === f.acquired), false);
        assert.equal(pending.discard.filter(card => card.id === f.special).length, 1);
        assert.equal(cost.batch.entries.some(entry => entry.card.id === f.special), false);
        assert.equal(semutaEmperorPlayer(pending, f.buyer).specialKaramaUsed, true);
      }
      let done = reactSemutaHomeworldEmperorIncome(pending, f.holder, claim);
      assert.equal(done.resolvedTreacheryDiscardSequence, cost.sequence);
      assert.deepEqual(done.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
      assert.equal(semutaEmperorPlayer(done, f.owner).spice,
        semutaEmperorPlayer(f.beforePayment, f.owner).spice, 'Native canceled credit is zero');
      assert.equal(semutaEmperorPlayer(done, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
      assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!claim));
      assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
      assert.throws(() => applyAction(done, f.canceler, f.cancel));
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: cost.batch.event }));
      const receipt = done.homeworldOccupiedPercentageLedger!.receipts[receiptCount];
      assert.ok(receipt);
      assert.equal(receipt.nativeRetained, 0);
      assert.equal(receipt.source.kind, 'emperor-treachery');
      if (receipt.source.kind !== 'emperor-treachery') throw new Error('Wrong native source');
      assert.equal(receipt.source.nativeIncome, 'karama-canceled');
      assert.equal(receipt.source.amount, f.amount);
      assert.equal(receipt.source.payment.paid, f.amount);
      assert.deepEqual(receipt.source.payment.contributions, [{ payer: f.buyer, amount: f.amount }]);
      assert.equal(receipt.source.payment.recipient, f.owner);
      assert.equal(receipt.occupiedAmount, f.occupiedAmount);
      assert.equal(receipt.bankRetained, f.amount - f.occupiedAmount);
      if (config.occupied) {
        const allocation = viewGame(done, f.allocationOwner!).homeworldOccupiedPercentage!;
        assert.equal(done.decision!.kind, 'homeworldOccupiedPercentage');
        assert.equal(done.decision!.player, f.allocationOwner);
        assert.equal(allocation.owner, 'g');
        assert.equal(allocation.ally, 'a');
        assert.equal(allocation.amount, f.occupiedAmount);
        assert.equal(allocation.minOwnAmount, 0);
        assert.equal(allocation.maxOwnAmount, f.occupiedAmount);
        assert.equal(allocation.blocked, null);
        assert.deepEqual(receipt.entitlement, quoteStableHomeworldOccupation(f.game, 'kaitain').entitlement);
        assert.equal(done.pendingHomeworldOccupiedPercentage!.suffix.kind,
          f.kind === 'emperorIncome' ? 'auctionBonus' : 'richesePurchase');
        const action = { type: 'decision', event: allocation.event, ownAmount: claim ? 0 : f.occupiedAmount };
        assert.throws(() => applyAction(done, f.allocationAlly!, action), 'Only the original occupier chooses');
        assert.throws(() => applyAction(done, f.owner, action));
        assert.throws(() => applyAction(done, f.allocationOwner!, { ...action, event: 'stale-allocation' }));
        assert.throws(() => applyAction(done, f.allocationOwner!, { ...action, ownAmount: f.occupiedAmount + 1 }));
        const receiver = claim ? f.allocationAlly! : f.allocationOwner!;
        done = applyAction(done, f.allocationOwner!, action);
        for (const player of done.players) assert.equal(player.spice,
          wallets.find(row => row.id === player.id)!.spice + (player.id === receiver ? f.occupiedAmount : 0));
        const settled = done.homeworldOccupiedPercentageLedger!.receipts[receiptCount];
        assert.equal(settled.status, 'settled');
        assert.deepEqual(settled.source, receipt.source);
        assert.deepEqual(settled.entitlement, receipt.entitlement);
        assert.deepEqual(settled.credits, [{ player: receiver, amount: f.occupiedAmount }]);
        assert.throws(() => applyAction(done, f.allocationOwner!, action), 'The printed share is available once');
      } else {
        assert.equal(receipt.status, 'settled');
        assert.equal(receipt.entitlement, null);
        assert.deepEqual(receipt.credits, []);
      }
      done = exerciseOriginalIncomeSuffix(done, f);
      assert.deepEqual(semutaEmperorIncomeCards(done), f.originalCards);
      assert.deepEqual(semutaHomeworldEmperorForceTotals(done), forces);
    },
  );
}

for (const config of configurations) void test(
  `uncanceled ${config.advanced ? 'Advanced' : 'Basic'} ${config.occupied ? 'occupied' : 'clean low'} ${config.kind} retains original ceil native income`, () => {
    const f = createSemutaHomeworldEmperorIncomeFixture(config.kind, config);
    const native = semutaEmperorPlayer(f.game, f.owner).spice;
    const buyer = semutaEmperorPlayer(f.game, f.buyer).spice;
    let done = f.game;
    for (let n = 0; done.response?.kind === f.kind && n < done.players.length; n++) {
      const next = nextSemutaHomeworldEmperorIncomeStep(done);
      done = applyAction(done, next.actor, next.action);
    }
    assert.notEqual(done.response?.kind, f.kind);
    assert.equal(semutaEmperorPlayer(done, f.owner).spice, native + f.nativeIncome);
    assert.equal(semutaEmperorPlayer(done, f.buyer).spice, buyer);
    if (config.occupied) {
      const allocation = viewGame(done, f.allocationOwner!).homeworldOccupiedPercentage!;
      assert.equal(allocation.amount, f.occupiedAmount);
      done = applyAction(done, allocation.owner, { type: 'decision', event: allocation.event, ownAmount: f.occupiedAmount });
    }
    exerciseOriginalIncomeSuffix(done, f);
  },
);

for (const kind of ['emperorIncome', 'richesePurchaseIncome'] as const) void test(
  `a legal full-hand Easy bot completes occupied ${kind} cost before original owner allocation`, () => {
    const f = createSemutaHomeworldEmperorIncomeFixture(kind, { occupied: true });
    const pending = applyAction(f.game, f.canceler, f.cancel);
    const view = viewGame(pending, f.holder);
    view.players.find(player => player.id === f.holder)!.bot = 'Easy';
    const action = botActions(view)[0];
    assert.ok(action);
    assert.equal(action.type, 'semutaCommit');
    let done = applyAction(pending, f.holder, action);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), true);
    assert.equal(done.decision!.player, f.allocationOwner);
    const ownerView = viewGame(done, f.allocationOwner!);
    const ownerBalance = semutaEmperorPlayer(done, f.allocationOwner!).spice;
    const allyBalance = semutaEmperorPlayer(done, f.allocationAlly!).spice;
    ownerView.players.find(player => player.id === f.allocationOwner)!.bot = 'Easy';
    const allocationAction = botActions(ownerView)[0];
    assert.ok(allocationAction);
    done = applyAction(done, f.allocationOwner!, allocationAction);
    assert.equal(semutaEmperorPlayer(done, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice);
    const ownerCredit = semutaEmperorPlayer(done, f.allocationOwner!).spice - ownerBalance;
    const allyCredit = semutaEmperorPlayer(done, f.allocationAlly!).spice - allyBalance;
    assert.ok(ownerCredit >= 0 && allyCredit >= 0);
    assert.equal(ownerCredit + allyCredit, f.occupiedAmount,
      'A legal bot allocates the original printed share without pinning its strategy');
    assert.equal(done.homeworldOccupiedPercentageLedger!.receipts.at(-1)!.status, 'settled');
    exerciseOriginalIncomeSuffix(done, f);
  },
);

for (const claim of [false, true]) void test(
  `occupied Kaitain newly purchased original Karama is its own foreign cost, Semuta ${claim ? 'claims' : 'passes'}`, () => {
    const f = createSemutaHomeworldEmperorIncomeFixture('emperorIncome', { occupied: true, acquiredKarama: true });
    assert.equal(f.acquired, f.karama);
    const pending = applyAction(f.game, f.canceler, f.cancel);
    assert.ok(pending.pendingTreacheryDiscard);
    assert.equal(pending.pendingTreacheryDiscard.batch.entries[0].card.id, f.acquired);
    assert.equal(pending.pendingTreacheryDiscard.batch.entries[0].discardedBy, f.buyer);
    assert.equal(semutaEmperorPlayer(pending, f.buyer).hand.some(card => card.id === f.acquired), false);
    let done = reactSemutaHomeworldEmperorIncome(pending, f.holder, claim);
    assert.equal(semutaEmperorPlayer(done, f.buyer).spice,
      semutaEmperorPlayer(f.beforePayment, f.buyer).spice - 5, 'Buying then spending never refunds the source');
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.acquired), claim);
    assert.equal(done.discard.filter(card => card.id === f.acquired).length, Number(!claim));
    const allocation = viewGame(done, f.allocationOwner!).homeworldOccupiedPercentage!;
    assert.equal(allocation.amount, 2);
    done = applyAction(done, allocation.owner, { type: 'decision', event: allocation.event, ownAmount: 2 });
    assert.equal(semutaEmperorPlayer(done, f.owner).spice, semutaEmperorPlayer(f.beforePayment, f.owner).spice);
    exerciseOriginalIncomeSuffix(done, f);
    assert.deepEqual(semutaEmperorIncomeCards(done), f.originalCards);
  },
);
