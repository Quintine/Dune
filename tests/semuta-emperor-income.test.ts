import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import {
  createSemutaEmperorIncomeFixture, nextSemutaEmperorIncomeStep,
  reactSemutaEmperorIncome, semutaEmperorIncomeCards,
  type SemutaEmperorIncomeKind,
} from './fixture-semuta-emperor-income';

for (const kind of ['emperorIncome', 'richesePurchaseIncome'] as SemutaEmperorIncomeKind[]) {
  for (const claim of [false, true]) void test(
    `Semuta ${claim ? 'claims' : 'passes'} the foreign Karama canceling native ${kind} without repeating its paid source`, () => {
      const f = createSemutaEmperorIncomeFixture(kind);
      const originalBuyer = semutaEmperorPlayer(f.beforePayment, f.buyer);
      const originalOwner = semutaEmperorPlayer(f.beforePayment, f.owner);
      assert.equal(semutaEmperorPlayer(f.game, f.buyer).spice, originalBuyer.spice - f.amount);
      assert.equal(semutaEmperorPlayer(f.game, f.owner).spice, originalOwner.spice);
      assert.equal(semutaEmperorPlayer(f.game, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(semutaEmperorPlayer(f.game, f.holder).hand.length, 4);
      const wallets = f.game.players.map(player => ({ id: player.id, spice: player.spice }));
      const pending = applyAction(f.game, f.canceler, f.cancel);
      const cost = pending.pendingTreacheryDiscard!;
      assert.ok(cost, 'The actual paid income cancellation must first offer its printed Karama cost');
      assert.equal(cost.batch.cause, `karama:${kind}`);
      assert.deepEqual(cost.batch.entries, [{ card: f.karamaCard, discardedBy: f.canceler, publicFace: true }]);
      assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true,
        'A genuine full hand can exchange Semuta for the foreign cancellation cost');
      assert.deepEqual(viewGame(pending, f.holder).semutaReaction!.candidates, []);
      assert.equal(semutaEmperorPlayer(pending, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.deepEqual(pending.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
      if (kind === 'emperorIncome') {
        assert.equal(pending.auction!.index, f.game.auction!.index, 'The original next lot must wait for Semuta');
        assert.equal(pending.currentAuctionSale!.winner, f.buyer);
      } else {
        assert.equal(pending.richeseCache!.some(card => card.id === f.acquired), false);
        assert.equal(pending.discard.filter(card => card.id === f.special).length, 1);
        assert.equal(cost.batch.entries.some(entry => entry.card.id === f.special), false,
          'Richese never claims its own separately spent activation');
        assert.equal(semutaEmperorPlayer(pending, f.buyer).specialKaramaUsed, true);
      }
      const done = reactSemutaEmperorIncome(pending, f, claim);
      assert.equal(done.resolvedTreacheryDiscardSequence, cost.sequence);
      assert.deepEqual(done.players.map(player => ({ id: player.id, spice: player.spice })), wallets,
        'No refund, repeated debit or canceled Emperor credit occurs');
      assert.equal(semutaEmperorPlayer(done, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
      assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!claim));
      assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
      assert.deepEqual(semutaEmperorIncomeCards(done), f.originalCards);
      assert.throws(() => applyAction(done, f.canceler, f.cancel));
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: cost.batch.event }));
      if (kind === 'emperorIncome') {
        assert.equal(done.auction!.index, f.game.auction!.index + 1);
        assert.deepEqual(done.auction!.cards.map(card => card.id), f.game.auction!.cards.map(card => card.id));
        assert.equal(done.response!.kind, 'atreidesAuction');
        assert.equal(done.response!.owner, 'a', 'Original Atreides inspection owns the next paid-auction suffix');
        let resumed = done;
        while (resumed.response?.kind === 'atreidesAuction') {
          const player = resumed.players.find(seat => !resumed.response!.passed.includes(seat.id))!;
          resumed = applyAction(resumed, player.id, { type: 'passResponse' });
        }
        assert.equal(resumed.auction!.index, done.auction!.index, 'Inspection must not advance a second lot');
        const bidder = resumed.auction!.active;
        resumed = applyAction(resumed, bidder, { type: 'bid', amount: 1 });
        assert.equal(resumed.auction!.bidder, bidder, 'The original next lot is usable by its actual active bidder');
        assert.equal(resumed.auction!.index, done.auction!.index);
        assert.deepEqual(resumed.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
      } else {
        assert.deepEqual(done.decision, f.beforePayment.decision,
          'The native Richese declaration, including its original owner, is restored');
        assert.equal(done.richeseCache!.length, f.beforePayment.richeseCache!.length - 1);
        assert.equal(done.discard.filter(card => card.id === f.special).length, 1);
        const next = nextSemutaEmperorIncomeStep(done);
        assert.equal(next.actor, f.buyer);
        assert.throws(() => applyAction(done, f.owner, next.action), 'Emperor cannot answer the original Richese decision');
        const resumed = applyAction(done, next.actor, next.action);
        assert.equal(resumed.decision!.kind, 'richeseCache');
        assert.equal(resumed.decision!.player, f.buyer,
          'Native declaration opens its actual cache choice, after automatic uncanceled acknowledgements');
        assert.deepEqual(resumed.players.map(player => ({ id: player.id, spice: player.spice })), wallets);
        assert.equal(semutaEmperorPlayer(resumed, f.buyer).hand.filter(card => card.id === f.acquired).length, 1);
        assert.throws(() => applyAction(resumed, next.actor, next.action), 'Declaration is not replayable');
      }
    },
  );
}

for (const claim of [false, true]) void test(
  `a real paid-auction winner spends its newly purchased Karama and Semuta ${claim ? 'claims' : 'passes'} that same physical card`, () => {
    const f = createSemutaEmperorIncomeFixture('emperorIncome', { acquiredKarama: true });
    assert.equal(f.acquired, f.karama);
    assert.equal(semutaEmperorPlayer(f.game, f.buyer).spice,
      semutaEmperorPlayer(f.beforePayment, f.buyer).spice - 1);
    const pending = applyAction(f.game, f.canceler, f.cancel);
    assert.ok(pending.pendingTreacheryDiscard);
    assert.equal(pending.pendingTreacheryDiscard.batch.entries[0].discardedBy, f.buyer);
    assert.equal(semutaEmperorPlayer(pending, f.buyer).hand.some(card => card.id === f.acquired), false);
    const done = reactSemutaEmperorIncome(pending, f, claim);
    assert.equal(semutaEmperorPlayer(done, f.buyer).spice, semutaEmperorPlayer(f.game, f.buyer).spice,
      'Buying then spending the card does not refund its paid auction');
    assert.equal(semutaEmperorPlayer(done, f.owner).spice, semutaEmperorPlayer(f.beforePayment, f.owner).spice);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.acquired), claim);
    assert.equal(done.discard.filter(card => card.id === f.acquired).length, Number(!claim));
    assert.equal(done.auction!.index, f.game.auction!.index + 1);
    assert.equal(done.response!.kind, 'atreidesAuction');
    assert.deepEqual(semutaEmperorIncomeCards(done), f.originalCards);
  },
);

for (const kind of ['emperorIncome', 'richesePurchaseIncome'] as SemutaEmperorIncomeKind[]) void test(
  `a legal Easy bot completes the full-hand native ${kind} Semuta cost and returns its original controls`, () => {
    const f = createSemutaEmperorIncomeFixture(kind);
    const pending = applyAction(f.game, f.canceler, f.cancel);
    const view = viewGame(pending, f.holder);
    view.players.find(player => player.id === f.holder)!.bot = 'Easy';
    const action = botActions(view)[0];
    assert.ok(action);
    assert.equal(action.type, 'semutaCommit');
    const done = applyAction(pending, f.holder, action);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), true);
    assert.equal(semutaEmperorPlayer(done, f.buyer).spice, semutaEmperorPlayer(f.game, f.buyer).spice);
    assert.equal(semutaEmperorPlayer(done, f.owner).spice, semutaEmperorPlayer(f.beforePayment, f.owner).spice);
    if (kind === 'emperorIncome') {
      assert.equal(done.auction!.index, f.game.auction!.index + 1);
      assert.equal(done.response!.owner, 'a');
    } else {
      assert.deepEqual(done.decision, f.beforePayment.decision);
      assert.equal(semutaEmperorPlayer(done, f.buyer).specialKaramaUsed, true);
    }
  },
);
