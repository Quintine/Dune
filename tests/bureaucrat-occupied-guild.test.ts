import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import type { OccupiedPercentageReceipt } from '../game/homeworld-occupied-percentage';
import { assertClassicHomeworldSkillsCustody } from './fixture-homeworld-classic-skills';
import {
  allocateOccupiedGuild, allowOccupiedGuildIncome, cancelOccupiedGuildIncome, chooseOccupiedGuild,
  createOccupiedGuildFixture, declareOccupiedGuild, occupiedGuildArmies, occupiedGuildCards,
  occupiedGuildClean, occupiedGuildPlayer, occupiedGuildWallets, advanceOccupiedGuild,
  type OccupiedGuildFixture,
} from './fixture-bureaucrat-occupied-guild';

const wallets = occupiedGuildWallets;
const armies = occupiedGuildArmies;

/** The frozen receipt keeps its original producer proof; read it only after the
 * discriminant is checked. */
function guildShippingSource(receipt: OccupiedPercentageReceipt) {
  const source = receipt.source;
  if (source.kind !== 'guild-shipping') throw new Error('Expected the original Guild shipping source.');
  return source;
}

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Exact wallet conservation: the payer and the pledged ally pay their original
 * shares once, the native keeps its half, the occupier takes the other half and
 * only the ruled diversion (or the canceled native half) leaves for the Bank. */
function outcome(f: OccupiedGuildFixture, done: Game, diverted: number, canceled = false): void {
  const expected = wallets(f.beforePledge);
  expected[f.payer] -= f.payerShare;
  expected[f.donor] -= f.donorShare;
  const amount = canceled ? f.gross : f.gross - diverted;
  if (!canceled) expected[f.payee] += Math.ceil(amount / 2);
  expected[f.occupier] += Math.floor(amount / 2);
  assert.deepEqual(wallets(done), expected);
  const before = Object.values(wallets(f.beforePledge)).reduce((a, b) => a + b, 0);
  const after = Object.values(wallets(done)).reduce((a, b) => a + b, 0);
  assert.equal(before - after, canceled ? Math.floor(amount / 2) : diverted,
    'Only the ruled diversion or the canceled native half leaves the seated wallets for the Bank');
  assert.equal(done.aid[f.donor]?.amount ?? 0, 0);
  assert.deepEqual(occupiedGuildCards(done), f.physical);
  assertClassicHomeworldSkillsCustody(done);
}

void test('native Guild occupation redirects two of a foreign shipping payment to the Bank after the full payer and ally debits', () => {
  const f = createOccupiedGuildFixture();
  assert.equal(f.payerShare + f.donorShare, 8);
  assert.equal(quoteStableHomeworldOccupation(f.junctionEmpty, 'junction').entitlement, null);
  const authority = quoteStableHomeworldOccupation(f.occupied, 'junction');
  assert.equal(authority.blocked, null);
  assert.equal(authority.entitlement?.occupier, f.occupier);
  assert.equal(authority.entitlement?.native, f.payee);
  assert.deepEqual(f.occupied.homeworlds!.custody!.visitors['homeworld:guild'],
    { harkonnen: { normal: 1, elite: 0 } });
  assert.equal(occupiedGuildPlayer(f.junctionEmpty, f.payee).reserves, 0);
  const declared = declareOccupiedGuild(f);
  assert.equal(declared.response?.kind, 'guildIncome');
  assert.equal(declared.response?.amount, f.gross);
  assert.equal(occupiedGuildPlayer(declared, f.payer).spice,
    occupiedGuildPlayer(f.beforePledge, f.payer).spice - f.payerShare);
  assert.equal(occupiedGuildPlayer(declared, f.donor).spice,
    occupiedGuildPlayer(f.beforePledge, f.donor).spice - f.donorShare);
  assert.equal(occupiedGuildPlayer(declared, f.payee).spice, occupiedGuildPlayer(f.beforePledge, f.payee).spice);
  assert.deepEqual(occupiedGuildPlayer(declared, f.payer).forces, {
    ...occupiedGuildPlayer(f.beforePledge, f.payer).forces,
    [`${f.territory}:${f.sector}`]: f.gross / 2,
  });
  assert.equal(occupiedGuildPlayer(declared, f.payer).reserves,
    occupiedGuildPlayer(f.beforePledge, f.payer).reserves - f.gross / 2);
  assert.equal(occupiedGuildPlayer(declared, f.payer).shipped, true);
  for (const other of declared.players.filter(player => player.id !== f.payer)) {
    assert.deepEqual(other.forces, occupiedGuildPlayer(f.beforePledge, other.id).forces);
    assert.equal(other.reserves, occupiedGuildPlayer(f.beforePledge, other.id).reserves);
  }
  const pending = allowOccupiedGuildIncome(declared);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(pending.decision?.player, f.trainer);
  for (const viewer of pending.players) {
    const view = viewGame(pending, viewer.id), invoice = view.bureaucrat.pending!;
    assert.equal(invoice.payer, null);
    assert.equal(invoice.payee, f.payee);
    assert.equal(invoice.owner, f.trainer);
    assert.equal(invoice.amount, f.gross);
    assert.equal(invoice.homeworldAllocation, true);
    assert.equal(view.bureaucrat.usedThisPhase, false);
    for (const field of ['contributions', 'shares', 'qualifyingPayer', 'signature', 'source', 'privateFunding'])
      assert.equal(field in invoice, false, `${field} is private funding evidence, not a public invoice`);
    assert.equal('homeworldOccupiedPercentageLedger' in view, false);
  }
  reject(pending, f.donor, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
  reject(pending, f.trainer, { type: 'decision', event: 'expired-bureaucrat-event', redirect: true });
  reject(pending, f.payer, { type: 'endMovement' });
  const redirected = chooseOccupiedGuild(pending, true);
  assert.equal(redirected.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(redirected.decision?.player, f.occupier);
  assert.equal(occupiedGuildPlayer(redirected, f.payee).spice,
    occupiedGuildPlayer(f.beforePledge, f.payee).spice + 3);
  const offer = viewGame(redirected, f.occupier).homeworldOccupiedPercentage!;
  assert.equal(offer.world, 'homeworld:guild');
  assert.equal(offer.name, 'Junction');
  assert.equal(offer.owner, f.occupier);
  assert.equal(offer.ally, f.donor);
  assert.equal(offer.amount, 3);
  assert.equal(offer.minOwnAmount, 0);
  assert.equal(offer.maxOwnAmount, 3);
  assert.equal(offer.blocked, null);
  const done = allocateOccupiedGuild(redirected);
  const receipt = done.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
  const source = guildShippingSource(receipt);
  assert.equal(source.nativeIncome, 'received');
  assert.equal(source.native, f.payee);
  assert.equal(source.amount, 6);
  assert.equal(source.payment.recipient, f.payee);
  assert.ok(source.payment.id.length > 0);
  assert.ok(source.payment.binding.length > 0);
  assert.equal(source.payment.paid, 8, 'the receipt keeps the original paid amount');
  assert.equal(source.payment.bankDiversion, 2);
  assert.deepEqual(source.payment.contributions, [
    { payer: f.payer, amount: 6 }, { payer: f.donor, amount: 2 },
  ]);
  assert.equal(receipt.status, 'settled');
  assert.equal(receipt.nativeRetained, 3);
  assert.equal(receipt.occupiedAmount, 3);
  assert.equal(receipt.bankRetained, 0);
  assert.equal(receipt.ownAmount, 3);
  assert.deepEqual(receipt.credits, [{ player: f.occupier, amount: 3 }]);
  assert.equal(receipt.entitlement?.occupier, f.occupier);
  assert.equal(receipt.entitlement?.ally, f.donor);
  assert.equal(occupiedGuildPlayer(done, f.payer).forces[`${f.territory}:${f.sector}`], f.gross / 2);
  assert.equal(occupiedGuildPlayer(done, f.payer).reserves,
    occupiedGuildPlayer(f.beforePledge, f.payer).reserves - f.gross / 2);
  assert.equal(occupiedGuildPlayer(done, f.payer).shipped, true);
  assert.deepEqual(armies(done), armies(declared),
    'The ruled diversion never rewrites the committed force shipment');
  assert.equal(done.bureaucratPayments?.used.length, 1);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, true);
  outcome(f, done, 2);
  assert.notEqual(applyAction(done, done.active!, { type: 'endMovement' }).active, f.payer);
});

void test('the same occupied shipping payment declined keeps four with the native Guild and four with the occupier', () => {
  const f = createOccupiedGuildFixture();
  const decline = allocateOccupiedGuild(chooseOccupiedGuild(allowOccupiedGuildIncome(declareOccupiedGuild(f)), false));
  const receipt = decline.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
  assert.equal(receipt.source.amount, 8);
  assert.equal(receipt.nativeRetained, 4);
  assert.equal(receipt.occupiedAmount, 4);
  assert.equal(receipt.bankRetained, 0);
  assert.equal(receipt.ownAmount, 4);
  assert.deepEqual(receipt.credits, [{ player: f.occupier, amount: 4 }]);
  assert.equal(decline.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(viewGame(decline, f.trainer).bureaucrat.usedThisPhase, false);
  outcome(f, decline, 0);
});

void test('an original Karama cancellation removes the offer and banks the native half while the occupied half still settles', () => {
  const f = createOccupiedGuildFixture();
  const paid = declareOccupiedGuild(f);
  const canceled = cancelOccupiedGuildIncome(f, paid);
  assert.equal(canceled.response, null);
  assert.equal(canceled.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(canceled.bureaucratPayments?.pending, undefined);
  assert.equal(canceled.discard.filter(card => card.id === f.karama).length, 1);
  reject(canceled, f.payee, { type: 'card', mode: 'cancel', card: f.karama });
  const done = allocateOccupiedGuild(canceled);
  const receipt = done.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
  const source = guildShippingSource(receipt);
  assert.equal(source.nativeIncome, 'karama-canceled');
  assert.equal(source.amount, 8);
  assert.equal(source.payment.paid, 8);
  assert.equal(source.payment.bankDiversion, undefined);
  assert.deepEqual(source.payment.contributions, [
    { payer: f.payer, amount: 6 }, { payer: f.donor, amount: 2 },
  ]);
  assert.equal(receipt.nativeRetained, 0);
  assert.equal(receipt.occupiedAmount, 4);
  assert.equal(receipt.bankRetained, 4);
  assert.deepEqual(receipt.credits, [{ player: f.occupier, amount: 4 }]);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(occupiedGuildPlayer(done, f.payee).spice, occupiedGuildPlayer(f.beforePledge, f.payee).spice);
  outcome(f, done, 0, true);
});

void test('occupied Junction refuses two odd contributions and sub-five splits obtain no offer', () => {
  for (const [payerShare, donorShare] of [[5, 3], [3, 5], [5, 5]]) {
    const rejected = createOccupiedGuildFixture({ payerShare, donorShare, donor: 'atreides' });
    assert.equal(rejected.gross, payerShare + donorShare);
    reject(rejected.game, rejected.payer, rejected.action);
  }
  const subFive = createOccupiedGuildFixture({ payerShare: 2, donorShare: 2 });
  const settled = allocateOccupiedGuild(allowOccupiedGuildIncome(declareOccupiedGuild(subFive)));
  assert.equal(settled.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(settled.homeworldOccupiedPercentageLedger!.receipts.at(-1)!.occupiedAmount, 2);
  assert.equal(settled.homeworldOccupiedPercentageLedger!.receipts.at(-1)!.nativeRetained, 2);
  outcome(subFive, settled, 0);
});

void test('a single payer and a fully pledged ally both settle the occupied Junction payment once', () => {
  const single = createOccupiedGuildFixture({ payerShare: 8, donorShare: 0 });
  const singleDone = allocateOccupiedGuild(chooseOccupiedGuild(
    allowOccupiedGuildIncome(declareOccupiedGuild(single)), true));
  assert.equal(singleDone.bureaucratPayments?.used.length, 1);
  assert.equal(singleDone.homeworldOccupiedPercentageLedger!.receipts.at(-1)!.source.amount, 6);
  outcome(single, singleDone, 2);
  const pledged = createOccupiedGuildFixture({
    payer: 'emperor', donor: 'harkonnen', occupier: 'harkonnen', payerShare: 0, donorShare: 8,
  });
  const declared = declareOccupiedGuild(pledged);
  assert.equal(occupiedGuildPlayer(declared, pledged.payer).spice,
    occupiedGuildPlayer(pledged.beforePledge, pledged.payer).spice,
    'The payer contributes nothing of its own spice');
  const pledgedDone = allocateOccupiedGuild(chooseOccupiedGuild(
    allowOccupiedGuildIncome(declared), true));
  assert.equal(pledgedDone.bureaucratPayments?.used.length, 1);
  outcome(pledged, pledgedDone, 2);
});

void test('the Bureaucrat use is once per phase and a later genuine payment in a new phase renews it', () => {
  for (const redirect of [false, true]) {
    const f = createOccupiedGuildFixture();
    const settled = allocateOccupiedGuild(chooseOccupiedGuild(
      allowOccupiedGuildIncome(declareOccupiedGuild(f)), redirect));
    const following = applyAction(settled, f.payer, { type: 'bribe', target: f.payee, amount: 5 });
    let used: Game;
    if (redirect) {
      assert.notEqual(following.decision?.kind, 'bureaucratPayment');
      assert.equal(occupiedGuildPlayer(following, f.payee).bribes,
        occupiedGuildPlayer(settled, f.payee).bribes + 5);
      used = following;
    } else {
      assert.equal(following.decision?.kind, 'bureaucratPayment');
      used = chooseOccupiedGuild(following, true);
      assert.equal(occupiedGuildPlayer(used, f.payee).bribes,
        occupiedGuildPlayer(settled, f.payee).bribes + 3);
    }
    assert.equal(used.bureaucratPayments!.used.length, 1);
    const ended = applyAction(used, f.payer, { type: 'endMovement' });
    const next = advanceOccupiedGuild(ended, g => g.turn === 3 && g.phase === 1 && occupiedGuildClean(g));
    assert.equal(viewGame(next, f.trainer).bureaucrat.usedThisPhase, false);
    const renewed = chooseOccupiedGuild(applyAction(next, f.payer,
      { type: 'bribe', target: f.payee, amount: 5 }), true);
    assert.equal(renewed.bureaucratPayments!.used.length, 2);
    assert.deepEqual(renewed.bureaucratPayments!.used.map(use => [use.turn, use.phase]), [[2, 5], [3, 1]]);
    assert.equal(viewGame(renewed, f.trainer).bureaucrat.usedThisPhase, true);
    assertClassicHomeworldSkillsCustody(renewed);
  }
});

void test('every owner bot resolves the occupied Junction offer and the native payment stays in real custody', () => {
  const f = createOccupiedGuildFixture();
  const pending = allowOccupiedGuildIncome(declareOccupiedGuild(f));
  for (const bot of DIFFICULTIES) {
    const view = viewGame(pending, f.trainer);
    view.players.find(p => p.id === f.trainer)!.bot = bot;
    const actions = botActions(view);
    assert.equal(actions.length, 1, `${bot} has exactly one legal Bureaucrat choice`);
    const done = allocateOccupiedGuild(applyAction(pending, f.trainer, actions[0]));
    assert.equal(done.bureaucratPayments?.used.length, 1);
    assert.equal(done.homeworldOccupationPreview, true);
    assert.equal(done.homeworlds!.custody!.visitors['homeworld:guild'][f.occupier].normal, 1);
    outcome(f, done, 2);
  }
});

for (const redirect of [false, true]) void test(`Advanced occupied Guild ${redirect ? 'diversion' : 'allowance'} follows actual flexible timing without replaying a past phase`, () => {
  const f = createOccupiedGuildFixture({ advanced: true });
  assert.ok(f.beforePledge.turn > f.occupied.turn);
  const paid = declareOccupiedGuild(f);
  const pending = allowOccupiedGuildIncome(paid);
  const done = allocateOccupiedGuild(chooseOccupiedGuild(pending, redirect));
  outcome(f, done, redirect ? 2 : 0);
  assert.deepEqual(armies(done), armies(paid));
  const receipt = done.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
  assert.equal(receipt.nativeRetained, redirect ? 3 : 4);
  assert.equal(receipt.occupiedAmount, redirect ? 3 : 4);
  assert.equal(guildShippingSource(receipt).payment.paid, 8);
  assert.deepEqual(guildShippingSource(receipt).payment.contributions,
    [{payer:f.payer,amount:6},{payer:f.donor,amount:2}]);
  assert.equal(quoteStableHomeworldOccupation(done, 'junction').entitlement!.qualification,
    quoteStableHomeworldOccupation(f.occupied, 'junction').entitlement!.qualification);
});
