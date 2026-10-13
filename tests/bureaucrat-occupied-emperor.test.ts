import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { homeworldFundingCards } from './fixture-bureaucrat-homeworld-funding';
import { assertClassicHomeworldSkillsCustody } from './fixture-homeworld-classic-skills';
import {
  advanceOccupiedEmperor, allocateOccupiedEmperor as allocate,
  allowOccupiedEmperorResponses as allow, chooseOccupiedEmperor as choose,
  createOccupiedEmperorFixture as fixture, occupiedEmperorClean,
  occupiedEmperorPlayer as player, occupiedEmperorWallets as wallets,
  payOccupiedEmperor as pay, type OccupiedEmperorFixture,
} from './fixture-bureaucrat-occupied-emperor';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

/** Full debit evidence precedes either skill or occupation allocation. */
function assertPaid(f: OccupiedEmperorFixture, paid: Game): void {
  const expected = wallets(f.beforePledge);
  expected[f.payer] -= f.payerShare; expected[f.donor] -= f.donorShare;
  assert.deepEqual(wallets(paid), expected);
  assert.equal(paid.currentAuctionSale!.amount, f.gross);
  assert.deepEqual(paid.currentAuctionSale!.occupiedContributions,
    [{ payer: f.payer, amount: f.payerShare }, ...(f.donorShare ? [{ payer: f.donor, amount: f.donorShare }] : [])]);
  assert.equal(paid.aid[f.donor]?.amount ?? 0, 0);
}

function assertOutcome(f: OccupiedEmperorFixture, allocation: Game, done: Game,
  diverted: 0 | 2, canceled = false, ownAmount?: number): void {
  const pending = allocation.pendingHomeworldOccupiedPercentage!;
  const source = pending.source;
  assert.ok(source.kind === 'emperor-treachery');
  const grossAfterBank = f.gross - diverted;
  const native = canceled ? 0 : Math.ceil(grossAfterBank / 2), occupied = Math.floor(grossAfterBank / 2);
  const own = ownAmount ?? occupied;
  assert.equal(source.amount, grossAfterBank); assert.equal(source.payment.paid, f.gross);
  assert.deepEqual(source.payment.contributions,
    [{ payer: f.payer, amount: f.payerShare }, ...(f.donorShare ? [{ payer: f.donor, amount: f.donorShare }] : [])]);
  if (diverted) assert.equal(source.payment.bankDiversion, 2);
  else assert.equal(Object.hasOwn(source.payment, 'bankDiversion'), false);
  assert.equal(source.nativeIncome, canceled ? 'karama-canceled' : 'received');
  const expected = wallets(f.beforePledge);
  expected[f.payer] -= f.payerShare; expected[f.donor] -= f.donorShare;
  expected[f.payee] += native; expected[f.occupier] += own;
  const receipt = done.homeworldOccupiedPercentageLedger!.receipts.find(r => r.source.event === source.event)!;
  if (occupied - own) expected[receipt.entitlement!.ally!] += occupied - own;
  assert.deepEqual(wallets(done), expected);
  assert.equal(receipt.nativeRetained, native); assert.equal(receipt.occupiedAmount, occupied);
  assert.equal(receipt.status, 'settled'); assert.equal(receipt.ownAmount, own);
  assert.deepEqual(receipt.credits, [{ player: f.occupier, amount: own },
    ...(occupied - own ? [{ player: receipt.entitlement!.ally!, amount: occupied - own }] : [])]);
  assert.equal(Object.values(wallets(f.beforePledge)).reduce((a, b) => a + b, 0) -
    Object.values(wallets(done)).reduce((a, b) => a + b, 0), canceled ? Math.ceil(f.gross / 2) : diverted);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, diverted ? 1 : 0);
  assert.deepEqual(player(done, f.payer).hand.map(c => c.id),
    [...player(f.beforeAction, f.payer).hand.map(c => c.id), f.lot, f.bonus]);
  assert.equal(done.auction!.index, f.beforeAction.auction!.index + 1);
  assert.equal(done.currentAuctionSale, null); assert.equal(done.pendingHomeworldOccupiedPercentage, null);
  assert.deepEqual(homeworldFundingCards(done), f.physical);
  assert.deepEqual(done.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites })),
    f.beforePledge.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites })));
  assert.deepEqual(done.homeworlds!.custody, f.beforePledge.homeworlds!.custody);
  assertClassicHomeworldSkillsCustody(done);
}

void test('Basic native paid auction empties original Kaitain with a real twenty-counter shipment and qualifies a one-counter Guild invasion', () => {
  const f = fixture();
  assert.equal(f.setup.homeworldOccupationPreview, true);
  assert.equal(f.setup.leaderSkills!.deck.length + f.setup.leaderSkills!.assignments.length, 14);
  assert.equal(f.setup.leaderSkills!.assignments.find(a => a.skill === 'bureaucrat')!.owner, f.trainer);
  assert.equal(player(f.fundedEmperor, f.payee).spice, 20);
  assert.equal(player(f.emptyKaitain, f.payee).spice, 0);
  assert.equal(player(f.emptyKaitain, f.payee).reserves, 0);
  assert.equal(Object.values(player(f.emptyKaitain, f.payee).forces).reduce((a, b) => a + b, 0), 20);
  assert.equal(f.occupied.homeworlds!.custody!.visitors['homeworld:emperor'][f.occupier].normal, 1);
  const authority = quoteStableHomeworldOccupation(f.occupied, 'kaitain');
  assert.equal(authority.blocked, null); assert.equal(authority.entitlement!.occupier, f.occupier);
  assert.equal(player(f.alliance, f.payer).ally, f.donor);
  assert.equal(player(f.alliance, f.donor).ally, f.payer);
  for (const boundary of [f.setup, f.emptyKaitain, f.occupied, f.beforeAction]) assertClassicHomeworldSkillsCustody(boundary);
});

for (const redirect of [true, false]) void test(`occupied gross8 ${redirect ? 'diverts before splitting to Emperor3/Guild3/Bank2' : 'declines to Emperor4/Guild4'} and delivers the original lot/bonus once`, () => {
  const f = fixture(), paid = pay(f); assertPaid(f, paid);
  const pending = allow(paid);
  assert.equal(pending.decision?.kind, 'bureaucratPayment'); assert.equal(pending.decision!.player, f.trainer);
  const allocation = choose(pending, redirect);
  assert.equal(allocation.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(allocation.decision!.player, f.occupier);
  assert.equal(player(allocation, f.payee).spice - player(f.beforePledge, f.payee).spice, redirect ? 3 : 4);
  assert.equal(player(allocation, f.occupier).spice, player(f.beforePledge, f.occupier).spice - 3);
  const done = allocate(allocation); assertOutcome(f, allocation, done, redirect ? 2 : 0);
  reject(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
  reject(done, f.occupier, { type: 'decision', event: allocation.pendingHomeworldOccupiedPercentage!.source.event, ownAmount: redirect ? 3 : 4 });
});

void test('original occupied sharing suffix legally credits the reciprocal ally directly after gross-minus-two', () => {
  const f = fixture(), allocation = choose(allow(pay(f)), true);
  assert.equal(viewGame(allocation, f.occupier).homeworldOccupiedPercentage!.ally, f.payer);
  const done = allocate(allocation, 1); assertOutcome(f, allocation, done, 2, false, 1);
  reject(allocation, f.payer, { type: 'decision', event: allocation.pendingHomeworldOccupiedPercentage!.source.event, ownAmount: 1 });
  reject(allocation, f.occupier, { type: 'decision', event: 'stale-occupied-source', ownAmount: 1 });
});

void test('actual 3+5 qualifies on the donor; actual 4+4 cannot pool two sub-five debits', () => {
  const eligible = fixture({ payerShare: 3, donorShare: 5 }), paid = pay(eligible); assertPaid(eligible, paid);
  const pending = allow(paid); assert.equal(pending.decision?.kind, 'bureaucratPayment');
  const allocation = choose(pending, true); assertOutcome(eligible, allocation, allocate(allocation), 2);
  const pooled = fixture({ payerShare: 4, donorShare: 4 }), pooledPaid = pay(pooled); assertPaid(pooled, pooledPaid);
  const direct = allow(pooledPaid); assert.equal(direct.decision?.kind, 'homeworldOccupiedPercentage');
  assertOutcome(pooled, direct, allocate(direct), 0);
});

for (const donor of ['atreides', 'emperor'] as const) void test(`occupied funding excludes ${donor === 'atreides' ? 'trainer' : 'native recipient'} share without masking the independent qualified buyer`, () => {
  const excluded = fixture({ donor, payerShare: 3, donorShare: 5 }), paid = pay(excluded); assertPaid(excluded, paid);
  const allocation = allow(paid); assert.equal(allocation.decision?.kind, 'homeworldOccupiedPercentage');
  assertOutcome(excluded, allocation, allocate(allocation), 0);
  const eligible = fixture({ donor, payerShare: 5, donorShare: 5 }), eligiblePaid = pay(eligible); assertPaid(eligible, eligiblePaid);
  const pending = allow(eligiblePaid); assert.equal(pending.decision?.kind, 'bureaucratPayment');
  const redirected = choose(pending, true); assertOutcome(eligible, redirected, allocate(redirected), 2);
});

void test('native Karama cancellation preserves occupied4, retains full paid8 and never offers or spends Bureaucrat', () => {
  const f = fixture(), paid = pay(f); assertPaid(f, paid);
  assert.equal(paid.response?.kind, 'emperorIncome');
  assert.ok(viewGame(paid, f.trainer).responseControls!.cancelCards.includes(f.karama));
  const allocation = allow(applyAction(paid, f.trainer, { type: 'card', mode: 'cancel', card: f.karama }));
  assert.equal(allocation.decision?.kind, 'homeworldOccupiedPercentage');
  const done = allocate(allocation); assertOutcome(f, allocation, done, 0, true);
  assert.equal(done.discard.filter(c => c.id === f.karama).length, 1);
  assert.ok(!player(done, f.trainer).hand.some(c => c.id === f.karama));
  reject(done, f.trainer, { type: 'card', mode: 'cancel', card: f.karama });
});

void test('occupied gross8 invoice keeps private payer evidence private, rejects stale/wrong actors, and all four minimal owner bots settle real money', () => {
  const f = fixture(), pending = allow(pay(f));
  for (const viewer of pending.players) {
    const invoice = viewGame(pending, viewer.id).bureaucrat.pending!;
    assert.equal(invoice.amount, 8); assert.equal(invoice.payer, null); assert.equal(invoice.payee, f.payee);
    for (const key of ['contributions', 'shares', 'qualifyingPayer', 'privateFunding', 'signature', 'source'])
      assert.equal(key in invoice, false);
  }
  reject(pending, f.payer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
  reject(pending, f.trainer, { type: 'decision', event: 'stale-bureaucrat-source', redirect: true });
  reject(pending, f.donor, { type: 'pledgeAid', amount: 1 });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, f.trainer); view.players.find(p => p.id === f.trainer)!.bot = difficulty;
    const actions = botActions(view); assert.equal(actions.length, 1);
    const allocation = applyAction(pending, f.trainer, actions[0]);
    assert.equal(allocation.decision?.kind, 'homeworldOccupiedPercentage');
    assertOutcome(f, allocation, allocate(allocation), 2);
  }
});

void test('redirect spends only one phase use; decline leaves it for the next actual funded lot and each physical bonus occurs once', () => {
  for (const firstRedirect of [true, false]) {
    const f = fixture(), firstPending = allow(pay(f)), firstAllocation = choose(firstPending, firstRedirect);
    const first = allocate(firstAllocation); assertOutcome(f, firstAllocation, first, firstRedirect ? 2 : 0);
    let next = advanceOccupiedEmperor(first, g => !!g.auction && g.auction.active === f.payer && occupiedEmperorClean(g));
    const beforePledge = structuredClone(next);
    next = applyAction(next, f.donor, { type: 'pledgeAid', amount: 5 });
    const second: OccupiedEmperorFixture = { ...f, game: next, beforePledge, beforeAction: structuredClone(next),
      payerShare: 0, donorShare: 5, gross: 5, action: { type: 'bid', amount: 5, allyPayment: 5 },
      lot: next.auction!.cards[next.auction!.index].id, bonus: next.deck[0].id };
    const paid = pay(second); assertPaid(second, paid);
    let allocation = allow(paid);
    if (firstRedirect) assert.equal(allocation.decision?.kind, 'homeworldOccupiedPercentage');
    else {
      assert.equal(allocation.decision?.kind, 'bureaucratPayment');
      reject(allocation, f.trainer, { type: 'decision', event: firstPending.bureaucratPaymentEvent, redirect: true });
      allocation = choose(allocation, true);
    }
    const done = allocate(allocation);
    const expected = wallets(beforePledge); expected[f.donor] -= 5;
    expected[f.payee] += firstRedirect ? 3 : 2; expected[f.occupier] += firstRedirect ? 2 : 1;
    assert.deepEqual(wallets(done), expected);
    assert.equal(done.bureaucratPayments!.used.length, 1);
    assert.deepEqual(player(done, f.payer).hand.map(c => c.id),
      [...player(first, f.payer).hand.map(c => c.id), second.lot, second.bonus]);
    assert.equal(done.auction!.index, first.auction!.index + 1);
    assert.deepEqual(homeworldFundingCards(done), f.physical);
    assertClassicHomeworldSkillsCustody(done);
  }
});
