import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BankerIncomeError,
  commitBankerIncome,
  commitBankerIncomeCollection,
  createBankerIncomeState,
  projectBankerIncome,
  quoteBankerIncome,
  quoteBankerIncomeCollection,
  validateBankerIncomeSource,
  validateBankerIncomeState,
  type BankerIncomeAuthority,
  type BankerIncomeCollectionAuthority,
  type BankerIncomeContext,
  type BankerIncomeReceipt,
  type BankerIncomeState,
} from '../game/spice-banker-income';

function context(turn = 1, phase = 3, owner = 'a'): BankerIncomeContext {
  return {
    turn, phase,
    players: [
      { id: 'a', leaders: [{ id: 'emperor-0', dead: false }] },
      { id: 'b', leaders: [{ id: 'guild-0', dead: false }] },
      { id: 'c', leaders: [{ id: 'atreides-0', dead: false }] },
    ],
    assignments: [{ skill: 'spice-banker', leader: owner === 'a' ? 'emperor-0' : 'guild-0', owner }],
  };
}
function source(ctx: BankerIncomeContext, event = 'paid-auction', amount = 4, payer = 'b'): BankerIncomeAuthority {
  return {
    event, kind: 'auction', turn: ctx.turn, phase: ctx.phase,
    bankLegs: amount === 0 ? [] : [{ payer, amount }],
    trainer: {
      assignment: { ...ctx.assignments[0] }, faceUp: true, captured: false,
      selected: false, resolved: true, survived: true,
    },
  };
}
function earn(state: BankerIncomeState, ctx: BankerIncomeContext, authority: BankerIncomeAuthority): BankerIncomeState {
  const quote = quoteBankerIncome(state, ctx, authority);
  return commitBankerIncome(state, ctx, authority, quote.receipt);
}
function immutableReject(state: BankerIncomeState, action: () => unknown): void {
  const before = JSON.stringify(state);
  assert.throws(action, BankerIncomeError);
  assert.equal(JSON.stringify(state), before);
}
const opening: BankerIncomeCollectionAuthority = { event: 'native-mentat-1', turn: 1, phase: 8 };

void test('another payer must actually pay at least four in one final BANK leg; gain is additional deferred one', () => {
  const ctx = context();
  for (const [payer, amount, expected] of [['b', 3, 0], ['b', 4, 1], ['b', 19, 1], ['a', 4, 0], ['b', 0, 0]] as const) {
    const initial = createBankerIncomeState(ctx);
    const authority = source(ctx, `${payer}-${amount}`, amount, payer);
    const before = JSON.stringify({ initial, authority, ctx });
    const quoted = quoteBankerIncome(initial, ctx, authority);
    assert.equal(JSON.stringify({ initial, authority, ctx }), before);
    assert.equal(quoted.receipt.grant?.amount ?? 0, expected);
    assert.deepEqual(projectBankerIncome(quoted.next, ctx), {
      deferred: expected ? [{ owner: 'a', amount: 1 }] : [],
      usedThisPhase: expected ? ['a'] : [],
    });
    assert.deepEqual(quoted.receipt.source.bankLegs, authority.bankLegs);
    assert.deepEqual(commitBankerIncome(initial, ctx, authority, quoted.receipt), quoted.next);
  }
});
void test('separate native payments and different donor payers never aggregate to a threshold', () => {
  const ctx = context();
  let state = createBankerIncomeState(ctx);
  for (const event of ['first-two', 'second-two']) state = earn(state, ctx, source(ctx, event, 2));
  const split = source(ctx, 'different-payers');
  split.bankLegs = [{ payer: 'b', amount: 2 }, { payer: 'c', amount: 2 }];
  state = earn(state, ctx, split);
  assert.deepEqual(projectBankerIncome(state, ctx).deferred, []);
  const ownAndDonor = source(ctx, 'own-plus-donor');
  ownAndDonor.bankLegs = [{ payer: 'a', amount: 8 }, { payer: 'c', amount: 4 }];
  state = earn(state, ctx, ownAndDonor);
  assert.deepEqual(projectBankerIncome(state, ctx).deferred, [{ owner: 'a', amount: 1 }]);
  const duplicate = source(ctx, 'duplicate-donor');
  duplicate.bankLegs = [{ payer: 'b', amount: 2 }, { payer: 'b', amount: 2 }];
  immutableReject(state, () => quoteBankerIncome(state, ctx, duplicate));
});
void test('physical card once-phase stamp survives death, absence, capture and same-phase reassignment', () => {
  const ctx = context();
  let state = earn(createBankerIncomeState(ctx), ctx, source(ctx));
  const dead = context();
  dead.players[0].leaders[0].dead = true;
  dead.assignments = [];
  const unavailable = { ...source(ctx, 'no-card'), trainer: null };
  state = earn(state, dead, unavailable);
  assert.deepEqual(projectBankerIncome(state, dead), { deferred: [{ owner: 'a', amount: 1 }], usedThisPhase: ['a'] });
  const transferred = context(1, 3, 'b');
  state = earn(state, transferred, source(transferred, 'reassigned-this-phase', 6, 'c'));
  assert.equal(state.sources[2].grant, null);
  assert.deepEqual(projectBankerIncome(state, transferred).usedThisPhase, ['a']);
  const nextPhase = context(1, 4, 'b');
  const revival = { ...source(nextPhase, 'next-phase', 4, 'c'), kind: 'leader-revival' as const };
  state = earn(state, nextPhase, revival);
  assert.deepEqual(projectBankerIncome(state, nextPhase), {
    deferred: [{ owner: 'a', amount: 1 }, { owner: 'b', amount: 1 }], usedThisPhase: ['b'],
  });
  const nextTurn = context(2, 3, 'b');
  state = earn(state, nextTurn, source(nextTurn, 'next-turn', 4, 'c'));
  assert.deepEqual(projectBankerIncome(state, nextTurn).deferred, [{ owner: 'a', amount: 1 }, { owner: 'b', amount: 2 }]);
});
void test('fresh eligibility requires actual native living assignment and not a captive normal band', () => {
  const ctx = context();
  const state = createBankerIncomeState(ctx);
  const dead = context();
  dead.players[0].leaders[0].dead = true;
  immutableReject(state, () => quoteBankerIncome(state, dead, source(ctx)));
  const absent = context();
  absent.assignments = [];
  immutableReject(state, () => quoteBankerIncome(state, absent, source(ctx)));
  const foreign = source(ctx);
  foreign.trainer!.assignment.leader = 'guild-0';
  immutableReject(state, () => quoteBankerIncome(state, ctx, foreign));
  const captured = context();
  captured.players[0].leaders[0].capturedBy = 'b';
  const captive = source(captured);
  captive.trainer!.captured = true;
  const quoted = quoteBankerIncome(state, captured, captive);
  assert.equal(quoted.receipt.grant, null);
  captive.trainer!.captured = false;
  immutableReject(state, () => quoteBankerIncome(state, captured, captive));
});
void test('concealed battle trainer needs actual revealed selection and resolved survival, not private plan timing', () => {
  const ctx = context(1, 6);
  for (const [faceUp, selected, resolved, survived, expected] of [
    [true, false, true, true, 1],
    [true, false, false, true, 0],
    [true, false, true, false, 0],
    [false, false, true, true, 0],
    [false, true, false, true, 0],
    [false, true, true, false, 0],
    [false, true, true, true, 1],
  ] as const) {
    const authority = { ...source(ctx, 'resolved-support'), kind: 'battle-support' as const };
    Object.assign(authority.trainer!, { faceUp, selected, resolved, survived });
    const quote = quoteBankerIncome(createBankerIncomeState(ctx), ctx, authority);
    assert.equal(quote.receipt.grant?.amount ?? 0, expected);
  }
  const impossible = { ...source(ctx), kind: 'battle-support' as const };
  impossible.trainer!.selected = true;
  assert.throws(() => validateBankerIncomeSource(ctx, impossible), BankerIncomeError);
});
void test('all named native producer kinds are phase-bound and empty bank settlement never triggers', () => {
  const kinds = [
    ['auction', 3], ['shipment', 5], ['force-revival', 4], ['leader-revival', 4],
    ['kh-revival', 4], ['emperor-extra-revival', 4], ['battle-support', 6],
  ] as const;
  for (const [kind, phase] of kinds) {
    const ctx = context(1, phase);
    const authority = { ...source(ctx, `native-${kind}`), kind };
    assert.equal(quoteBankerIncome(createBankerIncomeState(ctx), ctx, authority).receipt.grant?.amount, 1);
    authority.bankLegs = [];
    assert.equal(quoteBankerIncome(createBankerIncomeState(ctx), ctx, authority).receipt.grant, null);
    authority.phase = phase === 3 ? 4 : 3;
    assert.throws(() => validateBankerIncomeSource(ctx, authority), BankerIncomeError);
  }
});
void test('native Mentat atomically collects every original-owner grant once despite trainer/card changes', () => {
  const ctx = context();
  let state = earn(createBankerIncomeState(ctx), ctx, source(ctx));
  const revivalContext = context(1, 4, 'b');
  state = earn(state, revivalContext, { ...source(revivalContext, 'revival', 4, 'c'), kind: 'force-revival' });
  const mentat = context(1, 8);
  mentat.players[0].leaders[0].dead = true;
  mentat.players[1].leaders[0].capturedBy = 'c';
  mentat.assignments = [];
  const before = JSON.stringify(state);
  assert.deepEqual(projectBankerIncome(state, mentat).deferred, [{ owner: 'a', amount: 1 }, { owner: 'b', amount: 1 }]);
  const quoted = quoteBankerIncomeCollection(state, mentat, opening);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(quoted.credits, [{ owner: 'a', amount: 1 }, { owner: 'b', amount: 1 }]);
  assert.deepEqual(quoted.collection.grants, [1, 2]);
  state = commitBankerIncomeCollection(state, mentat, opening, quoted.collection);
  assert.deepEqual(projectBankerIncome(state, mentat), { deferred: [], usedThisPhase: [] });
  immutableReject(state, () => quoteBankerIncomeCollection(state, mentat, opening));
  immutableReject(state, () => quoteBankerIncomeCollection(state, mentat, { ...opening, event: 'different-opening-id' }));
  const later = context(2, 3, 'b');
  later.players[0].leaders[0].capturedBy = 'b';
  assert.deepEqual(projectBankerIncome(JSON.parse(JSON.stringify(state)) as BankerIncomeState, later), { deferred: [], usedThisPhase: [] });
  state = earn(state, later, source(later, 'new-turn-payment', 4, 'c'));
  const second = { event: 'native-mentat-2', turn: 2, phase: 8 as const };
  const nextOpening = quoteBankerIncomeCollection(state, context(2, 8, 'b'), second);
  assert.deepEqual(nextOpening.credits, [{ owner: 'b', amount: 1 }]);
});
void test('collection cannot happen early, change owner/amount, omit pending grants, or commit an old head', () => {
  const ctx = context();
  const state = earn(createBankerIncomeState(ctx), ctx, source(ctx));
  immutableReject(state, () => quoteBankerIncomeCollection(state, ctx, opening));
  const mentat = context(1, 8);
  const quote = quoteBankerIncomeCollection(state, mentat, opening);
  for (const corrupt of [
    { ...quote.collection, grants: [] },
    { ...quote.collection, credits: [{ owner: 'b', amount: 1 }] },
    { ...quote.collection, credits: [{ owner: 'a', amount: 2 }] },
    { ...quote.collection, event: 'foreign-opening' },
    { ...quote.collection, previous: '0000000000000000' },
  ]) immutableReject(state, () => commitBankerIncomeCollection(state, mentat, opening, corrupt));
  const fresh = { ...source(context(1, 4), 'extra-revival'), kind: 'leader-revival' as const };
  const advanced = earn(state, context(1, 4), fresh);
  immutableReject(advanced, () => commitBankerIncomeCollection(advanced, mentat, opening, quote.collection));
});
void test('native authority is independent of stored receipt, and committed source cannot be replayed', () => {
  const ctx = context();
  const state = createBankerIncomeState(ctx);
  const authority = source(ctx);
  const quote = quoteBankerIncome(state, ctx, authority);
  const changedAuthority = source(ctx, authority.event, 3);
  immutableReject(state, () => commitBankerIncome(state, ctx, changedAuthority, quote.receipt));
  const changedReceipt = structuredClone(quote.receipt);
  changedReceipt.source.bankLegs[0].amount = 5;
  immutableReject(state, () => commitBankerIncome(state, ctx, authority, changedReceipt));
  const committed = commitBankerIncome(state, ctx, authority, quote.receipt);
  immutableReject(committed, () => commitBankerIncome(committed, ctx, authority, quote.receipt));
  immutableReject(committed, () => quoteBankerIncome(committed, context(2, 3), authority));
  quote.receipt.source.bankLegs[0].amount = 90;
  authority.bankLegs[0].amount = 100;
  assert.equal(committed.sources[0].source.bankLegs[0].amount, 4);
});
void test('malformed payments, foreign payers, extra fields and unsupported sources reject without mutation', () => {
  const ctx = context();
  const state = createBankerIncomeState(ctx);
  const valid = source(ctx);
  const invalid: unknown[] = [null, {}, { ...valid, kind: 'gift' }, { ...valid, recipient: 'bank' },
    { ...valid, turn: 0 }, { ...valid, turn: 2 }, { ...valid, event: '' },
    ...[-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1].map((amount) =>
      ({ ...valid, bankLegs: [{ payer: 'b', amount }] })),
    { ...valid, bankLegs: [{ payer: 'bank', amount: 4 }] },
    { ...valid, bankLegs: [{ payer: 'b', amount: 4, wallet: 99 }] },
    { ...valid, trainer: { ...valid.trainer, survived: 'yes' } },
  ];
  for (const value of invalid) immutableReject(state, () => quoteBankerIncome(state, ctx, value as BankerIncomeAuthority));
});
void test('strict historical signatures, grant entitlement, cursor and collection custody reject corrupted JSON', () => {
  const ctx = context();
  const earned = earn(createBankerIncomeState(ctx), ctx, source(ctx));
  const mentat = context(1, 8);
  const collected = quoteBankerIncomeCollection(earned, mentat, opening).next;
  const changedPayer = structuredClone(earned);
  changedPayer.sources[0].source.bankLegs[0].payer = 'a';
  const changedOwner = structuredClone(earned);
  changedOwner.sources[0].grant!.owner = 'b';
  const alteredSource = structuredClone(earned);
  alteredSource.sources[0].source.bankLegs[0].amount = 3;
  const duplicateSource = structuredClone(earned);
  duplicateSource.sources.push(structuredClone(duplicateSource.sources[0]));
  duplicateSource.cursor++;
  const alteredCollection = structuredClone(collected);
  alteredCollection.collections[0].credits[0].owner = 'b';
  const missingCollection = structuredClone(collected);
  missingCollection.collections[0].grants = [];
  const invalid: unknown[] = [null, { ...earned, extra: true }, { ...earned, head: '0000000000000000' },
    { ...earned, signature: '0000000000000000' }, { ...earned, cursor: 0 },
    { ...earned, seats: ['a', 'b', 'foreign'] }, changedPayer, changedOwner, alteredSource,
    duplicateSource, alteredCollection, missingCollection,
    { ...earned, sources: [{ ...earned.sources[0], grant: { ...earned.sources[0].grant, amount: 2 } }] },
    { ...earned, sources: [{ ...earned.sources[0], extra: true }] },
  ];
  for (const value of invalid) assert.throws(() => validateBankerIncomeState(value as BankerIncomeState, mentat), BankerIncomeError);
});
void test('public projection exposes only shield custody and used owner, never exact hidden source/trainer/payment', () => {
  const ctx = context();
  const authority = source(ctx, 'private-native-event-id', 17, 'c');
  const state = earn(createBankerIncomeState(ctx), ctx, authority);
  const before = JSON.stringify(state);
  const publicView = projectBankerIncome(state, ctx);
  assert.deepEqual(publicView, { deferred: [{ owner: 'a', amount: 1 }], usedThisPhase: ['a'] });
  publicView.deferred[0].amount = 90;
  publicView.usedThisPhase[0] = 'b';
  assert.equal(JSON.stringify(state), before);
  const receipt: BankerIncomeReceipt = state.sources[0];
  assert.equal(receipt.source.bankLegs[0].amount, 17);
  assert.equal(receipt.grant!.owner, 'a');
});
