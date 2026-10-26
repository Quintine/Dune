import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { quoteHomeworldPaymentIncome } from '../game/homeworld-payment-income';
import type { OccupiedPercentageReceipt } from '../game/homeworld-occupied-percentage';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { assertClassicHomeworldSkillsCustody } from './fixture-homeworld-classic-skills';
import {
  advanceHomeworldBanker, allocateHomeworldBankerPercentage, allowHomeworldBankerIncome,
  cancelHomeworldBankerIncome, chooseHomeworldBankerBureaucrat, createHomeworldBankerFixture,
  declareHomeworldBankerInvoice, holdHomeworldBankerKarama, homeworldBankerCards,
  homeworldBankerClean, homeworldBankerPlayer, homeworldBankerShipment, homeworldBankerWallets,
  settleHomeworldBankerInvoice, type HomeworldBankerFixture,
} from './fixture-homeworld-banker-income';

function addedSources(before: Game, after: Game) {
  const sources = after.spiceBankerIncome!.sources;
  return sources.slice(before.spiceBankerIncome!.sources.length);
}
function addedLegs(before: Game, after: Game) {
  return addedSources(before, after).flatMap(row => row.source.bankLegs.map(leg => ({ ...leg })));
}
function addedGrants(before: Game, after: Game) {
  return addedSources(before, after).filter(row => row.grant !== null);
}
function deferred(game: Game, owner: string) {
  return viewGame(game, owner).spiceBankerIncome!.deferred.find(row => row.owner === owner)?.amount ?? 0;
}
function receipt(game: Game) {
  return game.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
}
/** The frozen receipt keeps its original producer proof; read it only after the
 * discriminant is checked. */
function guildShippingSource(row: OccupiedPercentageReceipt) {
  const source = row.source;
  if (source.kind !== 'guild-shipping') throw new Error('Expected the original Guild shipping source.');
  return source;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected action must leave the immutable state unchanged.');
}
/** The payer and the pledged ally pay their original shares exactly once; only
 * the receipt's bank/settled shares leave or re-enter seated wallets. */
function expectWallets(f: HomeworldBankerFixture, done: Game, nativeShare: number, occupiedShare = 0) {
  const expected = homeworldBankerWallets(f.beforePledge);
  expected[f.payer] -= f.payerShare;
  expected[f.ally] -= f.allyShare;
  if (nativeShare) expected[f.payee] += nativeShare;
  if (occupiedShare) expected[f.occupier!] += occupiedShare;
  assert.deepEqual(homeworldBankerWallets(done), expected);
  assert.equal(done.aid[f.ally]?.amount ?? 0, 0, 'The pledge is spent once.');
  assert.deepEqual(homeworldBankerCards(done), f.physical);
  assertClassicHomeworldSkillsCustody(done);
}

void test('fresh classic Homeworld Banker admission keeps the original board, fourteen skills and separate owners', () => {
  const f = createHomeworldBankerFixture();
  assert.equal(f.initial.spiceBankerIncomePreview, true);
  assert.equal(f.initial.homeworldOccupationPreview, true);
  assert.equal(f.initial.pendingHomeworldOccupiedIncome, null);
  assert.deepEqual(f.initial.homeworldOccupiedIncomeHistory, []);
  assert.ok(f.initial.homeworldOccupiedPercentageLedger,
    'Ordinary fresh World Skills admission supplies its original occupation ledger.');
  assert.deepEqual(f.initial.homeworldOccupiedPercentageLedger.receipts, []);
  assert.ok(f.initial.spiceBankerIncome, 'The fresh Homeworld Banker game owns the real income ledger.');
  assert.equal(f.initial.status, 'setup');
  assert.equal(f.setup.status, 'playing');
  const banker = f.setup.leaderSkills!.assignments.find(assignment => assignment.skill === 'spice-banker')!;
  assert.equal(banker.owner, f.trainer);
  assert.equal(banker.leader, f.leader);
  assert.equal(homeworldBankerPlayer(f.setup, f.trainer).leaders.find(leader => leader.id === f.leader)!.dead, false);
  assert.notEqual(f.bureaucrat, f.trainer);
  assert.notEqual(f.bureaucrat, f.payer);
  assert.notEqual(f.bureaucrat, f.payee);
  assert.notEqual(f.trainer, f.payee);
  assert.equal(homeworldBankerPlayer(f.setup, f.bureaucrat).faction, 'fremen');
  assert.equal(homeworldBankerPlayer(f.setup, f.payee).reserves, 15, 'Junction starts with the native fifteen.');
  assert.equal(homeworldBankerPlayer(f.setup, f.payee).forces['tueks_sietch:5'], 5);
  assert.equal(homeworldBankerPlayer(f.setup, f.bureaucrat).forces['sietch_tabr:14'], 10,
    'The Fremen star placement is a real setup action.');
  assert.ok(f.setup.players.every(player => !Object.keys(player.forces).some(key => key.startsWith('polar_sink'))));
  assert.deepEqual(homeworldBankerCards(f.setup), homeworldBankerCards(f.initial), 'No physical card was dealt or lost.');
  assertClassicHomeworldSkillsCustody(f.setup);
});

void test('high Junction keeps the whole prep invoice, then the native tariff banks its own gross once', () => {
  const f = createHomeworldBankerFixture();
  assert.equal(f.prepReceipt.source.kind, 'guild-shipping');
  assert.equal(f.prepReceipt.source.native, f.payee);
  assert.equal(f.prepReceipt.source.amount, 4);
  assert.equal(f.prepReceipt.nativeLow, false);
  assert.equal(f.prepReceipt.nativeRetained, 4);
  assert.equal(f.prepReceipt.occupiedAmount, 0);
  assert.equal(f.prepReceipt.bankRetained, 0, 'A high-population invoice leaves no Bank remainder.');
  assert.equal(f.prepReceipt.status, 'settled');
  assert.equal(f.prepaid.spiceBankerIncome!.sources.length, 0, 'No Bank payment existed before the native tariff.');
  // The Guild's own fifteen-force tariff is a real Bank payment of its gross cost.
  const tariff = f.junctionEmpty.spiceBankerIncome!.sources.at(-1)!;
  assert.deepEqual(tariff.source.bankLegs, [{ payer: f.payee, amount: 8 }]);
  assert.equal(tariff.source.kind, 'shipment');
  assert.equal(tariff.grant?.owner, f.trainer);
  assert.equal(homeworldBankerPlayer(f.junctionEmpty, f.payee).forces['habbanya_ridge_sietch:17'], 15);
  // Junction is genuinely low, and the vacated stronghold is a real move.
  assert.equal(quoteHomeworldPaymentIncome(f.junctionEmpty, f.payee, 'shipment', 8).low, true);
  assert.equal(homeworldBankerPlayer(f.junctionEmpty, f.payee).reserves, 0);
  assert.ok(f.actions.some(step => step.action.type === 'move' && step.actor === f.payee),
    'The real Guild movement that vacates Tuek’s Sietch stays in the trace.');
  assert.equal(homeworldBankerPlayer(f.vacated, f.payee).forces[`pasty_mesa:${f.vacateSector}`], 5);
  assert.ok(f.vacated.players.every(player =>
    !Object.keys(player.forces).some(key => key.startsWith('tueks_sietch'))));
});

void test('the low unoccupied eight-spice invoice pays each original leg once and stays below the Bank boundary', () => {
  const f = createHomeworldBankerFixture();
  const declared = declareHomeworldBankerInvoice(f);
  assert.equal(homeworldBankerPlayer(declared, f.payer).spice,
    homeworldBankerPlayer(f.beforePledge, f.payer).spice - f.payerShare);
  assert.equal(homeworldBankerPlayer(declared, f.ally).spice,
    homeworldBankerPlayer(f.beforePledge, f.ally).spice - f.allyShare);
  assert.equal(declared.decision?.kind, 'bureaucratPayment',
    'The real income window resolves through its original pass queue into the private Bureaucrat offer.');
  assert.equal(homeworldBankerPlayer(declared, f.payee).spice, homeworldBankerPlayer(f.beforePledge, f.payee).spice);
  const done = settleHomeworldBankerInvoice(f, declared);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.amount, f.gross);
  assert.equal(source.nativeIncome, 'received');
  assert.deepEqual(source.payment.contributions, f.contributions);
  assert.equal(row.nativeLow, true);
  assert.equal(row.nativeRetained, 4);
  assert.equal(row.occupiedAmount, 0);
  assert.equal(row.bankRetained, 4);
  assert.equal(row.entitlement, null, 'No occupation exists, so no percentage allocation opens.');
  assert.equal(row.status, 'settled');
  // The final Bank legs keep distinct payers and no leg reaches four spice.
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.payer, amount: 3 }, { payer: f.ally, amount: 1 }]);
  assert.equal(addedGrants(f.game, done).length, 0, 'A three-spice primary leg never qualifies.');
  assert.equal(deferred(done, f.trainer), deferred(f.game, f.trainer));
  expectWallets(f, done, 4);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
  assert.equal(viewGame(done, f.bureaucrat).bureaucrat.usedThisPhase, false);
  assert.equal(addedSources(f.game, done).length, 1, 'The invoice records its own single receipt.');
  reject(declared, f.payer, f.action);
});

void test('the private Bureaucrat diversion combines with the same payer’s remainder and pays at the real Mentat', () => {
  const f = createHomeworldBankerFixture();
  const declared = declareHomeworldBankerInvoice(f);
  const pending = allowHomeworldBankerIncome(declared);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  assert.equal(pending.decision?.player, f.bureaucrat);
  for (const viewer of pending.players) {
    const view = viewGame(pending, viewer.id), invoice = view.bureaucrat.pending!;
    assert.equal(invoice.payer, null, 'Allied funding stays private.');
    assert.equal(invoice.payee, f.payee);
    assert.equal(invoice.owner, f.bureaucrat);
    assert.equal(invoice.amount, f.gross);
    assert.equal(invoice.homeworldAllocation, true);
    for (const field of ['contributions', 'shares', 'qualifyingPayer', 'signature', 'source', 'privateFunding'])
      assert.equal(field in invoice, false, `${field} is private funding evidence, not a public invoice`);
  }
  reject(pending, f.payer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
  reject(pending, f.bureaucrat, { type: 'decision', event: 'expired-bureaucrat-event', redirect: true });
  const redirected = chooseHomeworldBankerBureaucrat(pending, true);
  assert.equal(redirected.bureaucratPayments?.used.length, 1);
  assert.equal(viewGame(redirected, f.bureaucrat).bureaucrat.usedThisPhase, true);
  assert.notEqual(redirected.decision?.kind, 'homeworldOccupiedPercentage',
    'An unoccupied world opens no percentage allocation.');
  const done = settleHomeworldBankerInvoice(f, declared, true);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.amount, f.gross - 2);
  assert.equal(source.payment.paid, f.gross);
  assert.equal(source.payment.bankDiversion, 2);
  assert.deepEqual(source.payment.contributions, f.contributions);
  assert.equal(row.nativeRetained, 3);
  assert.equal(row.occupiedAmount, 0);
  assert.equal(row.bankRetained, 3);
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.payer, amount: 4 }, { payer: f.ally, amount: 1 }],
    'The original two spice join that payer’s own Bank remainder, and never the ally’s leg.');
  const grants = addedGrants(f.game, done);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].grant?.owner, f.trainer);
  assert.equal(deferred(done, f.trainer), deferred(f.game, f.trainer) + 1);
  assert.equal(homeworldBankerPlayer(done, f.trainer).spice,
    homeworldBankerPlayer(f.beforePledge, f.trainer).spice, 'The grant stays in front of the shield.');
  expectWallets(f, done, 3);
  assert.equal(done.bureaucratPayments?.used.length, 1);
  // Only the real Mentat Pause collects the deferred spice.
  const atCollection = advanceHomeworldBanker(done, state => state.phase === 7 && homeworldBankerClean(state));
  const beforeMentat = homeworldBankerPlayer(atCollection, f.trainer).spice;
  const mentat = advanceHomeworldBanker(atCollection, state => state.phase === 8);
  assert.equal(homeworldBankerPlayer(mentat, f.trainer).spice, beforeMentat + 1);
  assert.deepEqual(mentat.spiceBankerIncome!.collections.at(-1)?.credits, [{ owner: f.trainer, amount: 1 }]);
  assert.deepEqual(viewGame(mentat, f.trainer).spiceBankerIncome!.deferred, []);
  assertClassicHomeworldSkillsCustody(mentat);
});

void test('a Karama cancellation banks the whole low invoice and only the five-spice primary leg qualifies', () => {
  const f = createHomeworldBankerFixture();
  const karama = holdHomeworldBankerKarama(f);
  const declared = declareHomeworldBankerInvoice(f);
  assert.equal(declared.response?.kind, 'guildIncome');
  reject(declared, f.payee, { type: 'card', mode: 'cancel', card: karama });
  reject(declared, f.ally, { type: 'card', mode: 'cancel', card: karama });
  const done = cancelHomeworldBankerIncome(f, declared);
  assert.equal(done.response, null);
  assert.equal(done.decision, null);
  assert.equal(done.discard.filter(card => card.id === karama).length, 1);
  assert.equal(done.bureaucratPayments?.pending, undefined);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.nativeIncome, 'karama-canceled');
  assert.equal(source.amount, f.gross);
  assert.equal(row.nativeRetained, 0);
  assert.equal(row.occupiedAmount, 0);
  assert.equal(row.bankRetained, f.gross, 'Canceled ordinary income leaves all remaining cash in the Bank.');
  assert.deepEqual(addedLegs(f.game, done), f.contributions);
  const grants = addedGrants(f.game, done);
  assert.equal(grants.length, 1);
  assert.equal(deferred(done, f.trainer), deferred(f.game, f.trainer) + 1);
  expectWallets(f, done, 0);
  assert.equal(homeworldBankerPlayer(done, f.payee).spice, homeworldBankerPlayer(f.beforePledge, f.payee).spice,
    'A canceled income credits the native nothing.');
});

void test('an occupied low Junction pays only the occupier’s allocated share as player income', () => {
  const f = createHomeworldBankerFixture({ occupied: true });
  assert.ok(f.occupied);
  const authority = quoteStableHomeworldOccupation(f.occupied!, 'junction');
  assert.equal(authority.blocked, null);
  assert.equal(authority.entitlement?.occupier, f.occupier);
  assert.deepEqual(f.occupied!.homeworlds!.custody!.visitors['homeworld:guild'], { [f.occupier!]: { normal: 1, elite: 0 } });
  const done = settleHomeworldBankerInvoice(f, declareHomeworldBankerInvoice(f));
  const row = receipt(done);
  assert.equal(row.source.amount, f.gross);
  assert.equal(row.nativeRetained, 4);
  assert.equal(row.occupiedAmount, 4);
  assert.equal(row.bankRetained, 0);
  assert.equal(row.ownAmount, 4);
  assert.deepEqual(row.credits, [{ player: f.occupier, amount: 4 }]);
  assert.equal(row.entitlement?.occupier, f.occupier);
  assert.deepEqual(addedSources(f.game, done), [],
    'Occupier cash is player income; an occupied invoice leaves the Bank nothing to award.');
  assert.equal(deferred(done, f.trainer), deferred(f.game, f.trainer));
  expectWallets(f, done, 4, 4);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
});

void test('an occupied invoice with a private diversion banks exactly the diversion and grants nothing', () => {
  const f = createHomeworldBankerFixture({ occupied: true });
  const declared = declareHomeworldBankerInvoice(f);
  const pending = allowHomeworldBankerIncome(declared);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  const redirected = chooseHomeworldBankerBureaucrat(pending, true);
  assert.equal(redirected.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(redirected.decision?.player, f.occupier);
  const offer = viewGame(redirected, f.occupier!).homeworldOccupiedPercentage!;
  assert.equal(offer.world, 'homeworld:guild');
  assert.equal(offer.amount, 3);
  assert.equal(offer.ally, null);
  reject(redirected, f.payee, { type: 'decision', event: offer.event, ownAmount: offer.maxOwnAmount });
  reject(redirected, f.occupier!, { type: 'decision', event: 'stale-percentage-event', ownAmount: 0 });
  reject(redirected, f.occupier!, { type: 'decision', event: offer.event, ownAmount: 0 });
  const done = allocateHomeworldBankerPercentage(redirected);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.amount, f.gross - 2);
  assert.equal(source.payment.bankDiversion, 2);
  assert.equal(row.nativeRetained, 3);
  assert.equal(row.occupiedAmount, 3);
  assert.equal(row.bankRetained, 0, 'The diversion is taken before the occupied split.');
  assert.deepEqual(row.credits, [{ player: f.occupier, amount: 3 }]);
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.payer, amount: 2 }],
    'Only the two-spice diversion reaches the Bank, and never pooled with the ally.');
  assert.equal(addedGrants(f.game, done).length, 0, 'Two spice alone never reaches the printed boundary.');
  assert.equal(deferred(done, f.trainer), deferred(f.game, f.trainer));
  expectWallets(f, done, 3, 3);
});

void test('an occupied cancellation banks the native half only and leaves three/one below the boundary', () => {
  const f = createHomeworldBankerFixture({ occupied: true });
  holdHomeworldBankerKarama(f);
  const declared = declareHomeworldBankerInvoice(f);
  const canceled = cancelHomeworldBankerIncome(f, declared);
  assert.equal(canceled.response, null);
  assert.equal(canceled.bureaucratPayments?.pending, undefined);
  assert.equal(canceled.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(canceled.decision?.player, f.occupier);
  const done = allocateHomeworldBankerPercentage(canceled);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.nativeIncome, 'karama-canceled');
  assert.equal(source.amount, f.gross);
  assert.equal(row.nativeRetained, 0);
  assert.equal(row.occupiedAmount, 4, 'The canceled native half does not cancel the printed occupied share.');
  assert.equal(row.bankRetained, 4);
  assert.deepEqual(row.credits, [{ player: f.occupier, amount: 4 }]);
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.payer, amount: 3 }, { payer: f.ally, amount: 1 }]);
  assert.equal(addedGrants(f.game, done).length, 0, 'A final three-spice leg never qualifies.');
  assert.equal(homeworldBankerPlayer(done, f.payee).spice, homeworldBankerPlayer(f.beforePledge, f.payee).spice);
  expectWallets(f, done, 0, 4);
});

for (const [payerShare, expected] of [
  [5, [{ payer: 'payer', amount: 3 }, { payer: 'ally', amount: 3 }]],
  [6, [{ payer: 'payer', amount: 4 }, { payer: 'ally', amount: 2 }]],
] as const) {
  void test(`the odd eleven-spice stronghold invoice orders its extra Bank unit on the declared primary first (${payerShare}+${11 - payerShare})`, () => {
    const f = createHomeworldBankerFixture({ occupied: true, stronghold: true, payerShare });
    assert.equal(f.gross, 11);
    assert.equal(f.allyShare, 11 - payerShare);
    assert.equal(f.target, 'tueks_sietch');
    const reserves = homeworldBankerPlayer(f.game, f.payer).reserves;
    const karama = holdHomeworldBankerKarama(f);
    const declared = declareHomeworldBankerInvoice(f);
    const canceled = cancelHomeworldBankerIncome(f, declared);
    assert.equal(canceled.decision?.kind, 'homeworldOccupiedPercentage');
    const done = allocateHomeworldBankerPercentage(canceled);
    const row = receipt(done), source = guildShippingSource(row);
    assert.equal(source.amount, 11);
    assert.equal(source.nativeIncome, 'karama-canceled');
    assert.equal(row.nativeRetained, 0);
    assert.equal(row.occupiedAmount, 5);
    assert.equal(row.bankRetained, 6);
    assert.deepEqual(addedLegs(f.game, done), expected.map(leg => ({
      payer: leg.payer === 'payer' ? f.payer : f.ally, amount: leg.amount,
    })));
    const grants = addedGrants(f.game, done);
    assert.equal(grants.length, payerShare === 5 ? 0 : 1,
      'Only a final four-spice primary leg reaches the printed boundary.');
    assert.equal(homeworldBankerPlayer(done, f.payer).reserves, reserves - 11);
    assert.equal(homeworldBankerPlayer(done, f.payer).forces['tueks_sietch:5'], 11);
    assert.equal(done.discard.filter(card => card.id === karama).length, 1);
    expectWallets(f, done, 0, 5);
  });
}

void test('the stronghold diversion selects the first eligible contribution in declared order', () => {
  const f = createHomeworldBankerFixture({ occupied: true, stronghold: true, payerShare: 5 });
  assert.deepEqual(f.contributions, [{ payer: f.payer, amount: 5 }, { payer: f.ally, amount: 6 }]);
  const declared = declareHomeworldBankerInvoice(f);
  const pending = allowHomeworldBankerIncome(declared);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  const done = settleHomeworldBankerInvoice(f, declared, true);
  const row = receipt(done), source = guildShippingSource(row);
  assert.equal(source.amount, 9);
  assert.equal(source.payment.bankDiversion, 2);
  assert.equal(row.occupiedAmount, 4);
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.payer, amount: 2 }],
    'The first eligible contribution is the declared primary payer, not the larger ally.');
  assert.equal(addedGrants(f.game, done).length, 0);
  expectWallets(f, done, 5, 4);
});

void test('a below-five primary leaves the private diversion to the ally contribution', () => {
  const f = createHomeworldBankerFixture({ occupied: true, stronghold: true, payerShare: 4 });
  const declared = declareHomeworldBankerInvoice(f);
  const pending = allowHomeworldBankerIncome(declared);
  assert.equal(pending.decision?.kind, 'bureaucratPayment');
  const done = settleHomeworldBankerInvoice(f, declared, true);
  const row = receipt(done);
  assert.equal(row.source.amount, 9);
  assert.equal(row.occupiedAmount, 4);
  assert.deepEqual(addedLegs(f.game, done), [{ payer: f.ally, amount: 2 }],
    'The first contribution of at least five spice is the ally’s.');
  assert.equal(addedGrants(f.game, done).length, 0);
  expectWallets(f, done, 5, 4);
});

void test('a second qualifying Bank payment in the same phase adds no further grant', () => {
  const f = createHomeworldBankerFixture({ payerShare: 6 });
  const karama = holdHomeworldBankerKarama(f);
  const declared = declareHomeworldBankerInvoice(f);
  const canceled = cancelHomeworldBankerIncome(f, declared);
  assert.equal(addedGrants(f.game, canceled).length, 1);
  const granted = deferred(canceled, f.trainer);
  const second = advanceHomeworldBanker(canceled, state => state.turn === 3 && state.phase === 5 &&
    state.active === f.ally && homeworldBankerClean(state));
  const payment = homeworldBankerShipment(second, f.ally, 'tueks_sietch', 8);
  const settled = advanceHomeworldBanker(applyAction(second, f.ally, payment), homeworldBankerClean);
  const added = addedSources(canceled, settled);
  assert.equal(added.length, 1, 'The second real payment still records its own Bank legs.');
  assert.deepEqual(added[0].source.bankLegs, [{ payer: f.ally, amount: 4 }]);
  assert.equal(added[0].grant, null, 'The physical skill already earned this phase.');
  assert.equal(deferred(settled, f.trainer), granted);
  assert.equal(viewGame(settled, f.trainer).spiceBankerIncome!.usedThisPhase.includes(f.trainer), true);
  assert.equal(canceled.discard.filter(card => card.id === karama).length, 1);
});

void test('a below-threshold Bank remainder creates no Banker payment at all', () => {
  const f = createHomeworldBankerFixture();
  const done = settleHomeworldBankerInvoice(f, declareHomeworldBankerInvoice(f));
  const second = advanceHomeworldBanker(done, state => state.turn === 3 && state.phase === 5 &&
    state.active === f.ally && homeworldBankerClean(state));
  const payment = homeworldBankerShipment(second, f.ally, 'tueks_sietch', 2);
  const settled = advanceHomeworldBanker(applyAction(second, f.ally, payment), homeworldBankerClean);
  const added = addedSources(done, settled);
  assert.deepEqual(added.flatMap(row => row.source.bankLegs), [{ payer: f.ally, amount: 1 }],
    'The true one-spice Bank remainder is recorded without any grant.');
  assert.equal(added.every(row => row.grant === null), true);
  assert.equal(deferred(settled, f.trainer), deferred(done, f.trainer));
  const row = receipt(settled);
  assert.equal(row.source.amount, 2);
  assert.equal(row.nativeRetained, 1);
  assert.equal(row.bankRetained, 1);
});
