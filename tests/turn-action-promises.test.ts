import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileMixedActionExpression,
  type MixedActionExpression,
} from '../game/mixed-action-question';
import {
  TURN_ACTION_MAX_DEPTH,
  TURN_ACTION_MAX_LEAVES,
  TurnActionError,
  closeTurnActionTransport,
  finishTurnActionTurn,
  liveTurnActionPromises,
  parseTurnActionLeaf,
  recordTurnActionMovement,
  recordTurnActionPayment,
  recordTurnActionShipment,
  turnActionBranches,
  turnActionHasPayments,
  turnActionValue,
  validateTurnActionPromises,
  type TurnActionBranchLeaf,
  type TurnActionLeaf,
  type TurnActionPromise,
} from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
const seats = ['respondent', 'asker', 'recipient', 'other', 'second-recipient'];
const travel = (kind: 'ship' | 'move', territory = 'carthag', minimum = 3): Expression =>
  ({ kind: 'action', action: { kind, territory, minimum } });
const pay = (recipient = 'recipient', minimum = 3): Expression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
const fact = (): Expression => ({ kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 5 } });
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
const signedTravel = (kind: 'ship' | 'move', territory = 'carthag', minimum = 3,
  answer = true): TurnActionBranchLeaf => ({ kind, territory, minimum, answer });
const signedPay = (recipient = 'recipient', minimum = 3, progress = 0,
  answer = true): TurnActionBranchLeaf => ({ kind: 'payment', recipient, minimum, progress, answer });
const event = (territory = 'carthag', amount = 3) => ({ territory, amount });
const payment = (recipient = 'recipient', amount = 3) => ({ recipient, amount });
function promise(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  return {
    turn: 1, mixed, event: id, player: 'respondent', asker: 'asker', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer),
    shipment: { pending: true, event: null }, progress: [], payments: [],
    transportClosed: false, paymentClosed: false, fulfilled: false, released: false,
  };
}
const branches = (record: TurnActionPromise) => [...turnActionBranches(record)];

void test('turn-action leaves retain exact native fields, safe payment minima and no payment twenty-force cap', () => {
  for (const kind of ['ship', 'move'] as const) {
    const leaf = { kind, territory: 'carthag', minimum: 3 };
    assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
    assert.notEqual(parseTurnActionLeaf(leaf), leaf);
    for (const invalid of [{ ...leaf, minimum: 0 }, { ...leaf, minimum: 21 },
      { ...leaf, territory: 'not-a-territory' }, { ...leaf, amount: 3 },
      { ...leaf, answer: true }, { ...leaf, recipient: 'recipient' }])
      assert.throws(() => parseTurnActionLeaf(invalid), TurnActionError);
  }
  for (const minimum of [1, 21, 1001, Number.MAX_SAFE_INTEGER]) {
    const leaf = { kind: 'payment', recipient: 'recipient', minimum };
    assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
    assert.notEqual(parseTurnActionLeaf(leaf), leaf);
  }
  const leaf = { kind: 'payment', recipient: 'recipient', minimum: 3 };
  for (const invalid of [null, [], {}, { ...leaf, kind: 'gift' }, { ...leaf, recipient: '' },
    { ...leaf, recipient: ' recipient' }, { ...leaf, progress: 0 }, { ...leaf, turn: 1 },
    { ...leaf, territory: 'carthag' }, { ...leaf, answer: true },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '3'].map(minimum => ({ ...leaf, minimum }))])
    assert.throws(() => parseTurnActionLeaf(invalid), TurnActionError);
});

void test('one whole AND requires actual shipment, physical movement and ordinary payment while OR retains choices', () => {
  const and = promise(group('and', travel('ship'), travel('move', 'arrakeen', 2), pay()));
  const or = promise(group('or', travel('ship'), travel('move', 'arrakeen', 2), pay()), true, 'turn-action:2');
  assert.deepEqual(branches(and), [[signedTravel('ship'), signedTravel('move', 'arrakeen', 2), signedPay()]]);
  assert.deepEqual(branches(or), [[signedTravel('ship')], [signedTravel('move', 'arrakeen', 2)], [signedPay()]]);
  const shipped = recordTurnActionShipment([and, or], 'respondent', 1, event());
  assert.equal(shipped[0].fulfilled, false);
  assert.equal(shipped[1].fulfilled, true);
  assert.deepEqual(branches(shipped[0]), [[signedTravel('move', 'arrakeen', 2), signedPay()]]);
  const moved = recordTurnActionMovement(shipped, 'respondent', 1, event('arrakeen', 2));
  assert.equal(moved[0].fulfilled, false);
  assert.deepEqual(branches(moved[0]), [[signedPay()]]);
  const paid = recordTurnActionPayment(moved, 'respondent', 1, payment());
  assert.equal(paid[0].fulfilled, true);
  assert.equal(turnActionValue(paid[0]), true);
  assert.deepEqual(branches(paid[0]), [[]]);
  assert.equal(liveTurnActionPromises(paid, 'respondent', 1).length, 0);
  assert.equal(paid[1], shipped[1], 'A terminal alternative never receives later movement or payments');
  assert.deepEqual(and.progress, []);
  assert.deepEqual(and.payments, []);
  assert.equal(and.shipment.pending, true);
  validateTurnActionPromises(paid, seats);
});

void test('whole No negates the entire AND/OR tree and actual actions may change its remaining branch', () => {
  const andNo = promise(group('and', travel('ship'), group('or', travel('move', 'arrakeen', 2), pay())), false);
  assert.deepEqual(branches(andNo), [[signedTravel('ship', 'carthag', 3, false)],
    [signedTravel('move', 'arrakeen', 2, false), signedPay('recipient', 3, 0, false)]]);
  const shipped = recordTurnActionShipment([andNo], 'respondent', 1, event());
  assert.deepEqual(branches(shipped[0]), [[signedTravel('move', 'arrakeen', 2, false),
    signedPay('recipient', 3, 0, false)]]);
  const before = structuredClone(shipped);
  assert.throws(() => recordTurnActionMovement(shipped, 'respondent', 1, event('arrakeen', 2)), TurnActionError);
  assert.throws(() => recordTurnActionPayment(shipped, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(shipped, before);
  const orNo = promise(group('or', travel('ship'), pay()), false);
  assert.deepEqual(branches(orNo), [[signedTravel('ship', 'carthag', 3, false),
    signedPay('recipient', 3, 0, false)]]);
  assert.throws(() => recordTurnActionShipment([orNo], 'respondent', 1, event()), TurnActionError);
  assert.throws(() => recordTurnActionPayment([orNo], 'respondent', 1, payment()), TurnActionError);
  const skipped = recordTurnActionShipment([andNo], 'respondent', 1, null);
  assert.ok(branches(skipped[0]).some(branch => branch.length === 0));
  assert.equal(skipped[0].fulfilled, false, 'Other relevant opportunities remain open even with a decisive absent shipment');
  const paid = recordTurnActionPayment(skipped, 'respondent', 1, payment());
  assert.equal(paid[0].fulfilled, false);
  assert.equal(finishTurnActionTurn(paid, 'respondent', 1)[0].fulfilled, true);
});

void test('payment progress sums actual payer events while movement progress retains only one maximum group', () => {
  const original = promise(group('and', travel('move', 'carthag', 5), pay('recipient', 5)));
  const moved = recordTurnActionMovement([original], 'respondent', 1, event('carthag', 3));
  const movedAgain = recordTurnActionMovement(moved, 'respondent', 1, event('carthag', 3));
  assert.equal(movedAgain[0], moved[0]);
  assert.deepEqual(movedAgain[0].progress, [{ territory: 'carthag', maximum: 3 }]);
  const paid = recordTurnActionPayment(movedAgain, 'respondent', 1, payment('recipient', 3));
  const paidAgain = recordTurnActionPayment(paid, 'respondent', 1, payment('recipient', 2));
  assert.deepEqual(paidAgain[0].payments, [payment('recipient', 5)]);
  assert.equal(turnActionValue(paidAgain[0]), false);
  assert.deepEqual(branches(paidAgain[0]), [[signedTravel('move', 'carthag', 5)]]);
  assert.equal(recordTurnActionMovement(paidAgain, 'respondent', 1, event('carthag', 5))[0].fulfilled, true);
  assert.equal(recordTurnActionMovement(paidAgain, 'respondent', 1, event('arrakeen', 20))[0], paidAgain[0]);
  assert.equal(recordTurnActionPayment(paidAgain, 'respondent', 1, payment('other', 20))[0], paidAgain[0]);
});

void test('answer intervals retain separate payment receipts, movement maxima and one shared original shipment', () => {
  const mixed = group('and', group('or', travel('ship', 'carthag', 5), travel('move', 'arrakeen', 5)), pay('recipient', 7));
  const old = promise(mixed);
  const once = recordTurnActionPayment([old], 'respondent', 1, payment('recipient', 3));
  const shipped = recordTurnActionShipment(once, 'respondent', 1, event('carthag', 4));
  const moved = recordTurnActionMovement(shipped, 'respondent', 1, event('arrakeen', 4));
  const fresh = promise(mixed, true, 'turn-action:2');
  fresh.shipment.pending = false;
  const otherPlayer = { ...promise(mixed, true, 'turn-action:3'), player: 'other' };
  const otherTurn = { ...promise(mixed, true, 'turn-action:4'), turn: 2 };
  const list = [moved[0], fresh, otherPlayer, otherTurn];
  const paid = recordTurnActionPayment(list, 'respondent', 1, payment('recipient', 2));
  assert.deepEqual(paid[0].payments, [payment('recipient', 5)]);
  assert.deepEqual(paid[1].payments, [payment('recipient', 2)]);
  assert.deepEqual(branches(paid[0]), [[signedTravel('move', 'arrakeen', 5), signedPay('recipient', 7, 5)]]);
  assert.deepEqual(branches(paid[1]), [[signedTravel('move', 'arrakeen', 5), signedPay('recipient', 7, 2)]]);
  const again = recordTurnActionShipment(paid, 'respondent', 1, event('arrakeen', 20));
  assert.equal(again[0].shipment.event?.amount, 4);
  assert.equal(again[1].shipment.event, null);
  assert.equal(again[2], otherPlayer);
  assert.equal(again[3], otherTurn);
  const small = recordTurnActionMovement(again, 'respondent', 1, event('arrakeen', 2));
  assert.deepEqual(small[0].progress, [{ territory: 'arrakeen', maximum: 4 }]);
  assert.deepEqual(small[1].progress, [{ territory: 'arrakeen', maximum: 2 }]);
});

void test('signed DNF merges only same-kind bounds within a record and prunes incompatible positive shipment destinations', () => {
  const same = promise(group('and', travel('ship', 'carthag', 2), travel('ship', 'carthag', 5),
    travel('move', 'carthag', 3), travel('move', 'carthag', 4), pay('recipient', 3), pay('recipient', 6)));
  const partial = recordTurnActionPayment([same], 'respondent', 1, payment('recipient', 2));
  assert.deepEqual(branches(partial[0]), [[signedTravel('ship', 'carthag', 5), signedTravel('move', 'carthag', 4),
    signedPay('recipient', 6, 2)]]);
  const no = promise(group('or', pay('recipient', 3), pay('recipient', 6), travel('move', 'carthag', 2),
    travel('move', 'carthag', 5)), false);
  assert.deepEqual(branches(no), [[signedPay('recipient', 3, 0, false), signedTravel('move', 'carthag', 2, false)]]);
  const impossible = promise(group('and', travel('ship'), travel('ship', 'arrakeen'), pay()));
  assert.deepEqual(branches(impossible), []);
  const choices = promise(group('and', group('or', travel('ship'), pay()),
    group('or', travel('ship', 'arrakeen', 2), travel('move', 'arrakeen', 4))));
  assert.deepEqual(branches(choices), [
    [signedTravel('ship'), signedTravel('move', 'arrakeen', 4)],
    [signedPay(), signedTravel('ship', 'arrakeen', 2)],
    [signedPay(), signedTravel('move', 'arrakeen', 4)],
  ]);
});

void test('transport closure preserves actual shipment and unfinished Yes payment alternatives without inventing a release', () => {
  const original = promise(group('and', travel('ship'), group('or', travel('move', 'arrakeen', 2), pay())));
  const shipped = recordTurnActionShipment([original], 'respondent', 1, event());
  const closed = closeTurnActionTransport(shipped, 'respondent', 1);
  assert.equal(closed[0].transportClosed, true);
  assert.equal(closed[0].paymentClosed, false);
  assert.deepEqual(closed[0].shipment, { pending: false, event: event() });
  assert.deepEqual(branches(closed[0]), [[signedPay()]]);
  assert.equal(closed[0].fulfilled, false);
  assert.equal(closed[0].released, false);
  validateTurnActionPromises(closed, seats);
  assert.equal(recordTurnActionMovement(closed, 'respondent', 1, event('arrakeen', 2))[0], closed[0]);
  assert.equal(recordTurnActionPayment(closed, 'respondent', 1, payment())[0].fulfilled, true);
  const impossible = closeTurnActionTransport([promise(travel('move'))], 'respondent', 1);
  assert.deepEqual(branches(impossible[0]), []);
  assert.equal(impossible[0].released, false, 'Native closure preflight decides whether the respondent may close');
  validateTurnActionPromises(impossible, seats);
});

void test('whole No remains binding after transport closes through a later ordinary payment window', () => {
  const original = promise(group('or', travel('move'), pay('recipient', 5)), false);
  const closed = closeTurnActionTransport([original], 'respondent', 1);
  assert.equal(closed[0].fulfilled, false);
  assert.deepEqual(branches(closed[0]), [[signedPay('recipient', 5, 0, false)]]);
  const partial = recordTurnActionPayment(closed, 'respondent', 1, payment('recipient', 4));
  assert.equal(partial[0].fulfilled, false);
  assert.deepEqual(branches(partial[0]), [[signedPay('recipient', 5, 4, false)]]);
  assert.throws(() => recordTurnActionPayment(partial, 'respondent', 1, payment('recipient', 1)), TurnActionError);
  validateTurnActionPromises(partial, seats);
  const finished = finishTurnActionTurn(partial, 'respondent', 1);
  assert.equal(finished[0].fulfilled, true);
  assert.equal(finished[0].paymentClosed, true);
  assert.equal(finished[0].released, false);
  validateTurnActionPromises(finished, seats);
  const transportOnly = closeTurnActionTransport([promise(travel('move'), false)], 'respondent', 1);
  assert.equal(transportOnly[0].fulfilled, true);
  const shipmentOnly = recordTurnActionShipment([promise(travel('ship'), false)], 'respondent', 1, null);
  assert.equal(shipmentOnly[0].fulfilled, true);
});

void test('closed payment opportunities fold false while achieved payments fold true in remaining transport branches', () => {
  const mixed = group('or', travel('move'), pay());
  const closedPayment = { ...promise(mixed), paymentClosed: true };
  assert.deepEqual(branches(closedPayment), [[signedTravel('move')]]);
  assert.equal(recordTurnActionPayment([closedPayment], 'respondent', 1, payment())[0], closedPayment);
  const achievedPayment = { ...promise(group('and', travel('move'), pay())), payments: [payment()] };
  assert.deepEqual(branches(achievedPayment), [[signedTravel('move')]]);
  const impossible = { ...promise(pay()), paymentClosed: true };
  assert.deepEqual(branches(impossible), []);
  validateTurnActionPromises([closedPayment], seats);
});

void test('actual turn expiry fulfills the aggregate answer or releases it and terminal rows never update', () => {
  const yes = promise(group('and', travel('ship'), pay()));
  const no = promise(group('and', travel('ship'), pay()), false, 'turn-action:2');
  const externallyReleased = { ...promise(pay(), true, 'turn-action:3'), released: true };
  const fulfilled = recordTurnActionPayment([promise(pay(), true, 'turn-action:4')], 'respondent', 1, payment())[0];
  const finished = finishTurnActionTurn([yes, no, externallyReleased, fulfilled], 'respondent', 1);
  assert.equal(finished[0].released, true);
  assert.equal(finished[0].fulfilled, false);
  assert.equal(finished[1].fulfilled, true);
  assert.equal(finished[1].released, false);
  assert.equal(finished[2], externallyReleased);
  assert.equal(finished[3], fulfilled);
  for (const record of finished.slice(0, 2)) {
    assert.equal(record.transportClosed, true);
    assert.equal(record.paymentClosed, true);
    assert.equal(record.shipment.pending, false);
  }
  for (const transform of [
    (list: TurnActionPromise[]) => recordTurnActionShipment(list, 'respondent', 1, event()),
    (list: TurnActionPromise[]) => recordTurnActionMovement(list, 'respondent', 1, event()),
    (list: TurnActionPromise[]) => recordTurnActionPayment(list, 'respondent', 1, payment()),
    (list: TurnActionPromise[]) => closeTurnActionTransport(list, 'respondent', 1),
    (list: TurnActionPromise[]) => finishTurnActionTurn(list, 'respondent', 1),
  ]) assert.ok(transform(finished).every((record, index) => record === finished[index]));
  validateTurnActionPromises(finished, seats);
});

void test('frozen known and unknown facts retain whole-answer constants and original payment scope', () => {
  for (const answer of [true, false]) {
    for (const factAnswer of ['yes', 'no', 'unknown'] as const) {
      for (const kind of ['and', 'or'] as const) {
        const mixed = group(kind, fact(), pay());
        const record = promise(mixed, answer);
        record.compiled = compileMixedActionExpression(mixed, () => factAnswer, answer);
        assert.deepEqual(record.mixed, mixed);
        assert.equal(turnActionHasPayments(record), true);
        if (record.compiled.kind === 'constant') {
          assert.equal(turnActionValue(record), record.compiled.value);
          assert.deepEqual(branches(record), record.compiled.value === answer ? [[]] : []);
          if (record.compiled.value === answer) {
            record.fulfilled = true;
            validateTurnActionPromises([record], seats);
          }
        } else assert.deepEqual(branches(record), [[signedPay('recipient', 3, 0, answer)]]);
      }
    }
  }
  assert.equal(turnActionHasPayments(promise(travel('move'))), false);
});

void test('original and private turn-action expressions enforce sixteen total leaves and four group levels', () => {
  assert.equal(TURN_ACTION_MAX_LEAVES, 16);
  assert.equal(TURN_ACTION_MAX_DEPTH, 4);
  const sixteen = group('and', ...Array.from({ length: 16 }, () => pay()));
  assert.doesNotThrow(() => turnActionValue(promise(sixteen)));
  const nested = (depth: number): Expression => depth === 0 ? pay() : group('or', travel('move'), nested(depth - 1));
  assert.doesNotThrow(() => turnActionValue(promise(nested(4))));
  for (const mixed of [nested(5), group('or', ...Array.from({ length: 17 }, () => pay())),
    group('and', group('or', ...Array.from({ length: 9 }, () => pay())),
      group('or', ...Array.from({ length: 8 }, () => travel('move'))))])
    assert.throws(() => turnActionValue(promise(mixed)), TurnActionError);
  const manyFacts: Expression = { kind: 'fact', fact: { kind: 'and', terms: Array.from({ length: 16 }, () =>
    ({ kind: 'spice', compare: 'gte', value: 5 })) } };
  assert.throws(() => turnActionValue(promise(group('and', manyFacts, pay()))), TurnActionError,
    'The fact wrapper shares the original logical budget');
  const original = promise(pay());
  const compiled = { kind: 'and', terms: Array.from({ length: 17 }, () => original.compiled) };
  assert.throws(() => turnActionValue({ ...original, compiled } as TurnActionPromise), TurnActionError);
  const nestedPrivate = (depth: number): TurnActionPromise['compiled'] => depth === 0 ? original.compiled :
    { kind: 'or', terms: [{ kind: 'constant', value: true }, nestedPrivate(depth - 1)] };
  assert.throws(() => turnActionValue({ ...original, compiled: nestedPrivate(5) }), TurnActionError,
    'A decisive private constant cannot skip an over-depth later clause');
});

void test('safe payment accumulation is immutable and rejects overflow even in a nonselected alternative', () => {
  const original = promise(group('or', pay('recipient', Number.MAX_SAFE_INTEGER), travel('move')));
  const partial = recordTurnActionPayment([original], 'respondent', 1,
    payment('recipient', Number.MAX_SAFE_INTEGER - 1));
  const before = structuredClone(partial);
  assert.throws(() => recordTurnActionPayment(partial, 'respondent', 1, payment('recipient', 2)), TurnActionError);
  assert.deepEqual(partial, before);
  const ordinary = promise(group('and', pay('recipient', 5), travel('move')), true, 'turn-action:2');
  const list = [ordinary, partial[0]];
  assert.throws(() => recordTurnActionPayment(list, 'respondent', 1, payment('recipient', 2)), TurnActionError);
  assert.deepEqual(ordinary.payments, []);
  const complete = recordTurnActionPayment(partial, 'respondent', 1, payment('recipient', 1));
  assert.equal(complete[0].fulfilled, true);
  assert.deepEqual(complete[0].payments, [payment('recipient', Number.MAX_SAFE_INTEGER)]);
});

void test('stored rows reject missing or extra metadata, foreign private leaves and malformed native receipts', () => {
  const original = promise(group('and', travel('ship'), travel('move'), pay()));
  validateTurnActionPromises([original], seats);
  const corruptions: unknown[] = [
    { ...original, turn: 0 }, { ...original, event: '' }, { ...original, player: ' respondent' },
    { ...original, order: 1 }, { ...original, answer: 'yes' }, { ...original, fulfilled: undefined },
    { ...original, paymentClosed: undefined }, { ...original, transportClosed: 'yes' },
    { ...original, fulfilled: true, released: true },
    { ...original, shipment: { pending: true, event: event() } },
    { ...original, shipment: { pending: false, event: { ...event(), elite: 1 } } },
    { ...original, shipment: { pending: true, event: null }, transportClosed: true },
    { ...original, progress: [{ territory: 'carthag', maximum: 21 }] },
    { ...original, progress: [{ territory: 'arrakeen', maximum: 3 }] },
    { ...original, progress: [{ territory: 'carthag', maximum: 3, amount: 3 }] },
    { ...original, progress: [{ territory: 'carthag', maximum: 1 }, { territory: 'carthag', maximum: 2 }] },
    { ...original, payments: [payment('other')] },
    { ...original, payments: [payment(), payment()] },
    { ...original, payments: [payment('recipient', Number.MAX_SAFE_INTEGER + 1)] },
    { ...original, payments: [{ ...payment(), received: true }] },
    { ...original, compiled: { kind: 'constant', value: 'unknown' } },
    { ...original, compiled: { kind: 'constant', value: true, answer: true } },
    { ...original, compiled: { kind: 'action', action: { kind: 'payment', recipient: 'other', minimum: 3 } } },
    { ...original, compiled: { kind: 'action', action: { kind: 'move', territory: 'carthag', minimum: 4 } } },
    { ...original, compiled: { kind: 'and', terms: [] } },
    { ...original, mixed: { kind: 'constant', value: true } },
    { ...original, mixed: { kind: 'action', action: { kind: 'payment', recipient: 'recipient', minimum: 3, progress: 0 } } },
    { ...original, mixed: fact() },
  ];
  for (const field of Object.keys(original)) {
    const missing: Record<string, unknown> = { ...original };
    delete missing[field];
    corruptions.push(missing);
  }
  for (const corrupted of corruptions)
    assert.throws(() => turnActionValue(corrupted as TurnActionPromise), TurnActionError);
  for (const corrupted of [{ ...original, asker: 'respondent' }, { ...original, player: 'missing' },
    { ...original, fulfilled: true }, { ...original, mixed: pay('missing'), compiled: promise(pay('missing')).compiled },
    { ...original, mixed: pay('respondent'), compiled: promise(pay('respondent')).compiled },
    { ...original, answer: false, shipment: { pending: false, event: event() },
      progress: [{ territory: 'carthag', maximum: 3 }], payments: [payment()] },
    { ...original, answer: false, fulfilled: true }])
    assert.throws(() => validateTurnActionPromises([corrupted], seats), TurnActionError);
  assert.throws(() => validateTurnActionPromises([original, original], seats), TurnActionError);
  for (const invalid of [{ ...event(), amount: 21 }, { ...event(), amount: -1 },
    { ...event(), amount: 2.5 }, { ...event(), amount: '3' },
    { ...event(), territory: 'missing' }, { ...event(), elite: 1 }]) {
    assert.throws(() => recordTurnActionMovement([original], 'respondent', 1, invalid as never), TurnActionError);
    assert.throws(() => recordTurnActionShipment([original], 'respondent', 1, invalid as never), TurnActionError);
  }
  for (const invalid of [{ ...payment(), amount: 0 }, { ...payment(), amount: -1 },
    { ...payment(), amount: 1.5 }, { ...payment(), amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...payment(), recipient: '' }, { ...payment(), received: true }])
    assert.throws(() => recordTurnActionPayment([original], 'respondent', 1, invalid as never), TurnActionError);
});
