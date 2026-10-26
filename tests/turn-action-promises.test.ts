import assert from 'node:assert/strict';
import test from 'node:test';
import { battlePowerOf, type BattlePowerClaim, type BattlePowerDeclaration } from '../game/battle-power-question';
import { WINDOW_CARD_EFFECTS, type WindowCardEffect } from '../game/window-card-play';
import { PRINTED_CARD_EFFECTS, type PrintedCardEffect } from '../game/printed-card-play';
import {
  compileMixedActionExpression,
  type MixedActionExpression,
} from '../game/mixed-action-question';
import {
  TURN_ACTION_MAX_DEPTH,
  TURN_ACTION_MAX_LEAVES,
  TurnActionError,
  closeTurnActionBidding,
  closeTurnActionCombat,
  closeTurnActionBattlePower,
  closeTurnActionWindowCardPlay,
  closeTurnActionPayments,
  closeTurnActionRevival,
  closeTurnActionTransport,
  finishTurnActionTurn,
  liveTurnActionPromises,
  parseTurnActionLeaf,
  recordTurnActionBid,
  recordTurnActionCardPlay,
  recordTurnActionBattlePower,
  recordTurnActionWindowCardPlay,
  recordTurnActionPlan,
  recordTurnActionTraitor,
  recordTurnActionMovement,
  recordTurnActionPayment,
  recordTurnActionShipment,
  recordTurnActionRevival,
  settleTurnActionAlliance,
  turnActionBranches,
  turnActionHasPayments,
  turnActionValue,
  validateTurnActionPromises,
  type TurnActionBranchLeaf,
  type TurnActionLeaf,
  type TurnActionPromise,
  type TurnActionPlanValue,
} from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
const seats = ['respondent', 'asker', 'recipient', 'other', 'second-recipient'];
const travel = (kind: 'ship' | 'move', territory = 'carthag', minimum = 3): Expression =>
  ({ kind: 'action', action: { kind, territory, minimum } });
const pay = (recipient = 'recipient', minimum = 3): Expression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
const bid = (minimum = 3, lot = 1): Expression => ({ kind: 'action', action: { kind: 'bid', lot, minimum } });
const forces = (minimum = 3, counter: 'total' | 'normal' | 'elite' = 'total'): Expression =>
  ({ kind: 'action', action: { kind: 'forces', counter, minimum } });
const leader = (leader = 'atreides-0'): Expression => ({ kind: 'action', action: { kind: 'leader', leader } });
const alliance = (partner = 'recipient'): Expression => ({ kind: 'action', action: { kind: 'alliance', partner } });
const plan = (claim: TurnActionPlanValue['claim'] = { kind: 'dial', compare: 'gte', value: 2 }, battle = 'battle:1'): Expression =>
  ({ kind: 'action', action: { kind: 'battlePlan', battle, territory: 'carthag', claim } });
const call = (call = true, battle = 'battle:1'): Expression =>
  ({ kind: 'action', action: { kind: 'traitorCall', battle, territory: 'carthag', call } });
const card = (effect: PrintedCardEffect = 'hajr'): Expression => ({ kind: 'action', action: { kind: 'cardPlay', effect } });
const power = (claim: BattlePowerClaim = { kind: 'voice', use: true }): Expression =>
  ({ kind: 'action', action: { kind: 'battlePower', battle: 'battle:1', territory: 'carthag', claim } });
const windowSource = (effect: WindowCardEffect) => effect === 'karamaShipment'
  ? JSON.stringify(['karamaShipment', 1, 'recipient', 'original']) : effect === 'karamaAuction' ? 'ordinary-auction:1:1' :
  effect === 'amal' ? 'phase-opening:1:2' : effect === 'thumper' ? 'first-spice-reveal:1' :
    effect === 'harvester' ? 'spice-blow:1' : 'storm:1';
const windowCard = (effect: WindowCardEffect = 'weather', source = windowSource(effect)): Expression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect, source } });
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
function prepared(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  return { ...promise(mixed, answer, id), preparation: {
    bid: { lot: 1, source: 'original-lot:1', maximum: 0, closed: false },
    revival: { total: 0, normal: 0, elite: 0, leaders: [], closed: false },
  } };
}
function nexus(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  return { ...promise(mixed, answer, id), alliance: { source: 'nexus:1', partner: null, closed: false } };
}
function combat(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  return { ...promise(mixed, answer, id), combat: { event: 'battle:1', territory: 'carthag',
    plan: { closed: false, values: null }, traitor: { beneficiary: 'respondent', target: 'other',
      leader: 'other-0', closed: false, call: null } } };
}
const dial = (value = true): TurnActionPlanValue => ({ claim: { kind: 'dial', compare: 'gte', value: 2 }, value });
function cards(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  const row: TurnActionPromise = { ...promise(mixed, answer, id), cardPlays: {
    hajr: { played: false, closed: false }, ghola: { played: false, closed: false },
  } };
  const visit = (node: Expression): void => {
    if (node.kind === 'action' && node.action.kind === 'cardPlay' &&
      node.action.effect !== 'hajr' && node.action.effect !== 'ghola')
      row.cardPlays![node.action.effect] = { played: false, closed: false };
    else if (node.kind !== 'action' && node.kind !== 'fact') node.terms.forEach(visit);
  };
  visit(mixed);
  return row;
}
function powers(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  const row: TurnActionPromise = { ...promise(mixed, answer, id), combat: { event: 'battle:1', territory: 'carthag',
    plan: null, traitor: null, powers: { voice: null, prescience: null } } };
  const visit = (node: Expression): void => {
    if (node.kind === 'action' && node.action.kind === 'battlePower')
      row.combat!.powers![battlePowerOf(node.action.claim)] = { beneficiary: 'respondent', target: 'other', closed: false, values: null };
    else if (node.kind !== 'action' && node.kind !== 'fact') node.terms.forEach(visit);
  };
  visit(mixed);
  return row;
}
function windowed(mixed: Expression, answer = true, id = 'turn-action:1'): TurnActionPromise {
  const row: TurnActionPromise = { ...promise(mixed, answer, id), windowCards: {} };
  const visit = (node: Expression): void => {
    if (node.kind === 'action' && node.action.kind === 'windowCardPlay')
      row.windowCards![node.action.effect] = { source: node.action.source, played: false, closed: false };
    else if (node.kind !== 'action' && node.kind !== 'fact') node.terms.forEach(visit);
  };
  visit(mixed);
  return row;
}

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

void test('new preparation leaves reuse strict native bid and typed Revival parsers without changing old rows', () => {
  for (const leaf of [{ kind: 'bid', lot: 1, minimum: Number.MAX_SAFE_INTEGER },
    { kind: 'forces', counter: 'elite', minimum: 20 }, { kind: 'leader', leader: 'atreides-0' }]) {
    assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
    assert.notEqual(parseTurnActionLeaf(leaf), leaf);
  }
  for (const leaf of [{ kind: 'bid', lot: 0, minimum: 1 }, { kind: 'bid', lot: 1, minimum: 0 },
    { kind: 'bid', lot: 1, minimum: 1, source: 'hidden' }, { kind: 'bid', lot: 1, minimum: 1, progress: 0 },
    { kind: 'forces', counter: 'normal', minimum: 21 }, { kind: 'forces', counter: 'other', minimum: 1 },
    { kind: 'forces', counter: 'normal', minimum: 1, amount: 1 },
    { kind: 'leader', leader: '' }, { kind: 'leader', leader: 'atreides-0', answer: true }])
    assert.throws(() => parseTurnActionLeaf(leaf), TurnActionError);
  const old = promise(group('and', pay(), travel('move')));
  validateTurnActionPromises([old], seats);
  assert.equal('preparation' in recordTurnActionPayment([old], 'respondent', 1, payment())[0], false);
  for (const mixed of [bid(), forces(), leader()])
    assert.throws(() => turnActionValue(promise(mixed)), TurnActionError);
  const folded = prepared(group('or', fact(), bid()));
  delete folded.preparation;
  assert.throws(() => turnActionValue(folded), TurnActionError, 'Folded original bid leaves still retain their physical source');
});

void test('bid progress retains a maximum accepted declaration from one future original lot and answer interval', () => {
  const original = prepared(group('and', bid(7), pay()));
  const once = recordTurnActionBid([original], 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 3 });
  const twice = recordTurnActionBid(once, 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 5 });
  assert.equal(twice[0].preparation!.bid!.maximum, 5);
  assert.equal(turnActionValue(twice[0]), false, 'Three and five never combine into an eight-spice bid');
  assert.deepEqual(branches(twice[0]), [[{ kind: 'bid', lot: 1, source: 'original-lot:1', minimum: 7, answer: true }, signedPay()]]);
  for (const event of [{ lot: 1, source: 'other-lot', amount: 9 }, { lot: 2, source: 'original-lot:1', amount: 9 },
    { lot: 1, source: 'original-lot:1', amount: 4 }])
    assert.equal(recordTurnActionBid(twice, 'respondent', 1, event)[0], twice[0]);
  const fresh = prepared(group('and', bid(7), pay()), true, 'turn-action:2');
  const combined = recordTurnActionBid([twice[0], fresh], 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 4 });
  assert.equal(combined[0].preparation!.bid!.maximum, 5);
  assert.equal(combined[1].preparation!.bid!.maximum, 4);
  const accepted = recordTurnActionBid(combined, 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 7 });
  assert.deepEqual(branches(accepted[0]), [[signedPay()]]);
  assert.equal(original.preparation!.bid!.maximum, 0);
  assert.equal(recordTurnActionBid(accepted, 'other', 1, { lot: 1, source: 'original-lot:1', amount: 20 })[0], accepted[0]);
  assert.equal(recordTurnActionBid(accepted, 'respondent', 2, { lot: 1, source: 'original-lot:1', amount: 20 })[0], accepted[0]);
});

void test('ordinary Revival accumulates typed physical returns and records each personal leader identity once', () => {
  const original = prepared(group('and', forces(5), forces(3, 'normal'), forces(2, 'elite'), leader(), pay()));
  const once = recordTurnActionRevival([original], 'respondent', 1, { kind: 'forces', amount: 3, elite: 1 });
  assert.deepEqual(once[0].preparation!.revival, { total: 3, normal: 2, elite: 1, leaders: [], closed: false });
  assert.deepEqual(branches(once[0]), [[
    { kind: 'forces', counter: 'total', minimum: 5, progress: 3, answer: true },
    { kind: 'forces', counter: 'normal', minimum: 3, progress: 2, answer: true },
    { kind: 'forces', counter: 'elite', minimum: 2, progress: 1, answer: true },
    { kind: 'leader', leader: 'atreides-0', answer: true }, signedPay(),
  ]]);
  const twice = recordTurnActionRevival(once, 'respondent', 1, { kind: 'forces', amount: 2, elite: 1 });
  const returned = recordTurnActionRevival(twice, 'respondent', 1, { kind: 'leader', leader: 'atreides-0' });
  assert.deepEqual(returned[0].preparation!.revival, { total: 5, normal: 3, elite: 2, leaders: ['atreides-0'], closed: false });
  assert.equal(recordTurnActionRevival(returned, 'respondent', 1, { kind: 'leader', leader: 'atreides-0' })[0], returned[0]);
  assert.deepEqual(branches(returned[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(returned, 'respondent', 1, payment())[0].fulfilled, true);
  assert.equal(original.preparation!.revival!.total, 0);
  const fresh = prepared(group('and', forces(5), pay()), true, 'turn-action:2');
  const intervals = recordTurnActionRevival([returned[0], fresh], 'respondent', 1, { kind: 'forces', amount: 1, elite: 0 });
  assert.equal(intervals[0].preparation!.revival!.total, 6);
  assert.equal(intervals[1].preparation!.revival!.total, 1);
});

void test('cross-preparation whole No uses De Morgan and rejects the actual event completing its aggregate', () => {
  const original = prepared(group('and', bid(4), group('or', forces(2), leader())), false);
  assert.deepEqual(branches(original), [[{ kind: 'bid', lot: 1, source: 'original-lot:1', minimum: 4, answer: false }],
    [{ kind: 'forces', counter: 'total', minimum: 2, progress: 0, answer: false },
      { kind: 'leader', leader: 'atreides-0', answer: false }]]);
  const accepted = recordTurnActionBid([original], 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 4 });
  const before = structuredClone(accepted);
  assert.throws(() => recordTurnActionRevival(accepted, 'respondent', 1, { kind: 'forces', amount: 2, elite: 0 }), TurnActionError);
  assert.throws(() => recordTurnActionRevival(accepted, 'respondent', 1, { kind: 'leader', leader: 'atreides-0' }), TurnActionError);
  assert.deepEqual(accepted, before);
  const orNo = prepared(group('or', bid(4), leader()), false);
  assert.throws(() => recordTurnActionBid([orNo], 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 4 }), TurnActionError);
  assert.throws(() => recordTurnActionRevival([orNo], 'respondent', 1, { kind: 'leader', leader: 'atreides-0' }), TurnActionError);
});

void test('Bidding and Revival close independently while transport closure preserves both preparation alternatives', () => {
  const original = prepared(group('or', bid(), forces(), pay()));
  const transport = closeTurnActionTransport([original], 'respondent', 1);
  assert.equal(transport[0].preparation!.bid!.closed, false);
  assert.equal(transport[0].preparation!.revival!.closed, false);
  const wrong = closeTurnActionBidding(transport, 1, 'other-lot');
  assert.equal(wrong[0], transport[0]);
  assert.equal(closeTurnActionBidding(transport, 1, 'original-lot:1', 'other')[0], transport[0]);
  const bidding = closeTurnActionBidding(transport, 1, 'original-lot:1', 'respondent');
  assert.equal(bidding[0].preparation!.bid!.closed, true);
  assert.equal(bidding[0].preparation!.revival!.closed, false);
  const revival = closeTurnActionRevival(bidding, 'respondent', 1);
  assert.deepEqual(branches(revival[0]), [[signedPay()]]);
  assert.equal(revival[0].released, false);
  assert.equal(recordTurnActionBid(revival, 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 20 })[0], revival[0]);
  assert.equal(recordTurnActionRevival(revival, 'respondent', 1, { kind: 'forces', amount: 20, elite: 0 })[0], revival[0]);
  const no = prepared(group('and', bid(), leader()), false);
  const bidClosed = closeTurnActionBidding([no], 1, 'original-lot:1');
  assert.equal(bidClosed[0].fulfilled, false);
  assert.equal(closeTurnActionRevival(bidClosed, 'respondent', 1)[0].fulfilled, true);
  const paidOnlyClosed = { ...original, transportClosed: true, paymentClosed: true,
    shipment: { pending: false, event: null } };
  validateTurnActionPromises([paidOnlyClosed], seats);
});

void test('same-source bid and force bounds merge strongest thresholds without combining distinct typed counters', () => {
  const mixed = group('and', bid(3), bid(5), forces(2, 'normal'), forces(4, 'normal'), forces(1, 'elite'), leader(), leader());
  assert.deepEqual(branches(prepared(mixed)), [[
    { kind: 'bid', lot: 1, source: 'original-lot:1', minimum: 5, answer: true },
    { kind: 'forces', counter: 'normal', minimum: 4, progress: 0, answer: true },
    { kind: 'forces', counter: 'elite', minimum: 1, progress: 0, answer: true },
    { kind: 'leader', leader: 'atreides-0', answer: true },
  ]]);
  const no = prepared(group('or', bid(3), bid(5), forces(2), forces(4)), false);
  assert.deepEqual(branches(no), [[
    { kind: 'bid', lot: 1, source: 'original-lot:1', minimum: 3, answer: false },
    { kind: 'forces', counter: 'total', minimum: 2, progress: 0, answer: false },
  ]]);
});

void test('full expiry closes every preparation stage while terminal rows preserve their original progress and deadlines', () => {
  const original = prepared(group('and', bid(), forces(), leader(), pay()));
  const no = prepared(group('and', bid(), forces(), leader(), pay()), false, 'turn-action:2');
  const finished = finishTurnActionTurn([original, no], 'respondent', 1);
  assert.equal(finished[0].released, true);
  assert.equal(finished[1].fulfilled, true);
  for (const row of finished) {
    assert.equal(row.preparation!.bid!.closed, true);
    assert.equal(row.preparation!.revival!.closed, true);
  }
  for (const transform of [
    (rows: TurnActionPromise[]) => recordTurnActionBid(rows, 'respondent', 1, { lot: 1, source: 'original-lot:1', amount: 20 }),
    (rows: TurnActionPromise[]) => recordTurnActionRevival(rows, 'respondent', 1, { kind: 'forces', amount: 20, elite: 0 }),
    (rows: TurnActionPromise[]) => closeTurnActionBidding(rows, 1, 'original-lot:1'),
    (rows: TurnActionPromise[]) => closeTurnActionRevival(rows, 'respondent', 1),
  ]) assert.ok(transform(finished).every((row, index) => row === finished[index]));
  validateTurnActionPromises(finished, seats);
});

void test('preparation metadata and actual events reject foreign sources, mismatched stages and impossible typed totals', () => {
  const original = prepared(group('and', bid(), forces(), leader()));
  for (const preparation of [undefined, null, {}, { bid: null, revival: null },
    { ...original.preparation, hidden: true },
    { ...original.preparation, bid: { ...original.preparation!.bid!, lot: 2 } },
    { ...original.preparation, bid: { ...original.preparation!.bid!, source: '' } },
    { ...original.preparation, bid: { ...original.preparation!.bid!, maximum: -1 } },
    { ...original.preparation, bid: { ...original.preparation!.bid!, maximum: Number.MAX_SAFE_INTEGER + 1 } },
    { ...original.preparation, revival: { ...original.preparation!.revival!, total: 2, normal: 1 } },
    { ...original.preparation, revival: { ...original.preparation!.revival!, leaders: ['atreides-0', 'atreides-0'] } },
    { ...original.preparation, revival: { ...original.preparation!.revival!, closed: 'yes' } }])
    assert.throws(() => turnActionValue({ ...original, preparation } as TurnActionPromise), TurnActionError);
  assert.throws(() => turnActionValue(prepared(group('or', bid(1, 1), bid(1, 2)))), TurnActionError);
  for (const invalid of [{ lot: 0, source: 'original-lot:1', amount: 1 }, { lot: 1, source: '', amount: 1 },
    { lot: 1, source: 'original-lot:1', amount: 0 }, { lot: 1, source: 'original-lot:1', amount: 1, answer: true }])
    assert.throws(() => recordTurnActionBid([original], 'respondent', 1, invalid), TurnActionError);
  for (const invalid of [{ kind: 'forces', amount: 2, elite: 3 }, { kind: 'forces', amount: 21, elite: 0 },
    { kind: 'forces', amount: 2, elite: 0, source: 'ghola' }, { kind: 'leader', leader: 'atreides-0', card: 'ghola' }])
    assert.throws(() => recordTurnActionRevival([original], 'respondent', 1, invalid as never), TurnActionError);
  const full = { ...original, preparation: { ...original.preparation!,
    revival: { total: 20, normal: 20, elite: 0, leaders: [], closed: false } } };
  const before = structuredClone(full);
  assert.throws(() => recordTurnActionRevival([full], 'respondent', 1, { kind: 'forces', amount: 1, elite: 0 }), TurnActionError);
  assert.deepEqual(full, before);
});

void test('final-alliance leaves use exact public partner fields and require a private original Nexus stage', () => {
  const leaf = { kind: 'alliance', partner: 'recipient' };
  assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
  assert.notEqual(parseTurnActionLeaf(leaf), leaf);
  for (const invalid of [{ ...leaf, partner: '' }, { ...leaf, partner: ' recipient' },
    { ...leaf, source: 'nexus:1' }, { ...leaf, closed: true }, { ...leaf, answer: true },
    { ...leaf, turn: 1 }, { ...leaf, minimum: 1 }])
    assert.throws(() => parseTurnActionLeaf(invalid), TurnActionError);
  assert.throws(() => turnActionValue(promise(alliance())), TurnActionError);
  const folded = promise(group('or', fact(), alliance()));
  assert.equal(folded.compiled.kind, 'constant');
  assert.throws(() => turnActionValue(folded), TurnActionError, 'Original alliance clauses require their source even after folding');
  validateTurnActionPromises([nexus(group('and', alliance(), pay()))], seats);
  validateTurnActionPromises([{ ...prepared(group('and', bid(), forces())),
    alliance: { source: 'nexus:1', partner: null, closed: false } }], seats);
  assert.equal('alliance' in closeTurnActionTransport([promise(pay())], 'respondent', 1)[0], false);
});

void test('open final membership remains unresolved and lazy branches retain whole AND OR and No meaning', () => {
  const original = nexus(group('or', alliance(), pay()));
  assert.equal(turnActionValue(original), false);
  assert.deepEqual(branches(original), [[{ kind: 'alliance', partner: 'recipient', source: 'nexus:1', answer: true }], [signedPay()]]);
  assert.deepEqual(branches(nexus(group('and', alliance(), pay()), false)), [
    [{ kind: 'alliance', partner: 'recipient', source: 'nexus:1', answer: false }],
    [signedPay('recipient', 3, 0, false)],
  ]);
  assert.deepEqual(branches(nexus(group('or', alliance(), pay()), false)), [[
    { kind: 'alliance', partner: 'recipient', source: 'nexus:1', answer: false }, signedPay('recipient', 3, 0, false),
  ]]);
  assert.deepEqual(branches(nexus(group('and', alliance(), alliance()))), [[
    { kind: 'alliance', partner: 'recipient', source: 'nexus:1', answer: true },
  ]]);
  assert.deepEqual(branches(nexus(group('and', alliance(), alliance('other')))), [],
    'One final source has only one final partner');
  assert.deepEqual(branches(nexus(group('or', alliance(), alliance('other')))), [
    [{ kind: 'alliance', partner: 'recipient', source: 'nexus:1', answer: true }],
    [{ kind: 'alliance', partner: 'other', source: 'nexus:1', answer: true }],
  ]);
});

void test('exact Nexus closure snapshots final membership once and preserves later payment alternatives', () => {
  const original = nexus(group('and', alliance(), pay()));
  assert.equal(settleTurnActionAlliance([original], 1, 'other-nexus', { respondent: 'recipient' })[0], original);
  assert.equal(settleTurnActionAlliance([original], 2, 'nexus:1', { respondent: 'recipient' })[0], original);
  const closed = settleTurnActionAlliance([original], 1, 'nexus:1', { respondent: 'recipient' });
  assert.deepEqual(closed[0].alliance, { source: 'nexus:1', partner: 'recipient', closed: true });
  assert.equal(closed[0].fulfilled, false);
  assert.deepEqual(branches(closed[0]), [[signedPay()]]);
  assert.equal(settleTurnActionAlliance(closed, 1, 'nexus:1', { respondent: 'other' })[0], closed[0]);
  assert.equal(recordTurnActionPayment(closed, 'respondent', 1, payment())[0].fulfilled, true);
  assert.deepEqual(original.alliance, { source: 'nexus:1', partner: null, closed: false });
  const alternative = settleTurnActionAlliance([nexus(group('or', alliance(), pay()))], 1, 'nexus:1', { respondent: null });
  assert.equal(alternative[0].fulfilled, false);
  assert.equal(alternative[0].released, false);
  assert.deepEqual(branches(alternative[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(alternative, 'respondent', 1, payment())[0].fulfilled, true);
  validateTurnActionPromises(alternative, seats);
});

void test('a whole No made true by final membership releases while later actual payments still reject live No violations', () => {
  const no = nexus(alliance(), false);
  const conflict = settleTurnActionAlliance([no], 1, 'nexus:1', { respondent: 'recipient' });
  assert.equal(conflict[0].released, true);
  assert.equal(conflict[0].fulfilled, false);
  assert.equal(turnActionValue(conflict[0]), true);
  validateTurnActionPromises(conflict, seats);
  const beforePayment = nexus(group('and', alliance(), pay()), false);
  const matching = settleTurnActionAlliance([beforePayment], 1, 'nexus:1', { respondent: 'recipient' });
  assert.equal(matching[0].released, false);
  assert.equal(matching[0].fulfilled, false);
  assert.deepEqual(branches(matching[0]), [[signedPay('recipient', 3, 0, false)]]);
  assert.throws(() => recordTurnActionPayment(matching, 'respondent', 1, payment()), TurnActionError);
  const paidFirst = recordTurnActionPayment([beforePayment], 'respondent', 1, payment());
  assert.equal(paidFirst[0].released, false);
  const conflictAfterPayment = settleTurnActionAlliance(paidFirst, 1, 'nexus:1', { respondent: 'recipient' });
  assert.equal(conflictAfterPayment[0].released, true);
  const nonmatching = settleTurnActionAlliance([beforePayment], 1, 'nexus:1', { respondent: null });
  assert.equal(nonmatching[0].fulfilled, false, 'Whole No still waits for its remaining payment opportunity');
  const finished = finishTurnActionTurn(nonmatching, 'respondent', 1);
  assert.equal(finished[0].fulfilled, true);
  const plainNo = settleTurnActionAlliance([no], 1, 'nexus:1', { respondent: 'other' });
  assert.equal(plainNo[0].fulfilled, true);
  assert.equal(plainNo[0].released, false);
});

void test('expiry releases an unresolved original Nexus without inventing membership and preserves every terminal row', () => {
  const originals = [nexus(alliance()), nexus(alliance(), false, 'turn-action:2')];
  const finished = finishTurnActionTurn(originals, 'respondent', 1);
  for (const record of finished) {
    assert.equal(record.released, true);
    assert.equal(record.fulfilled, false);
    assert.deepEqual(record.alliance, { source: 'nexus:1', partner: null, closed: false });
  }
  const paid = recordTurnActionPayment([nexus(group('or', alliance(), pay()), true, 'turn-action:3')],
    'respondent', 1, payment())[0];
  assert.equal(paid.fulfilled, true);
  assert.equal(finishTurnActionTurn([paid], 'respondent', 1)[0], paid);
  const terminal = [...finished, paid];
  assert.ok(settleTurnActionAlliance(terminal, 1, 'nexus:1', { respondent: 'recipient' })
    .every((row, index) => row === terminal[index]));
  assert.ok(recordTurnActionPayment(terminal, 'respondent', 1, payment())
    .every((row, index) => row === terminal[index]));
  validateTurnActionPromises(terminal, seats);
});

void test('final-membership stages reject temporary pairs, extra metadata, missing snapshot players and foreign partner clauses', () => {
  const original = nexus(group('and', alliance(), pay()));
  for (const stage of [undefined, null, {}, { source: '', partner: null, closed: false },
    { source: 'nexus:1', partner: 'recipient', closed: false }, { source: 'nexus:1', partner: 'respondent', closed: true },
    { source: 'nexus:1', partner: null, closed: 'yes' }, { source: 'nexus:1', partner: null, closed: false, offers: {} }])
    assert.throws(() => turnActionValue({ ...original, alliance: stage } as TurnActionPromise), TurnActionError);
  assert.throws(() => settleTurnActionAlliance([original], 1, 'nexus:1', {}), TurnActionError);
  assert.throws(() => settleTurnActionAlliance([original], 1, 'nexus:1', { respondent: 'respondent' }), TurnActionError);
  for (const partner of ['missing', 'respondent'])
    assert.throws(() => validateTurnActionPromises([nexus(alliance(partner))], seats), TurnActionError);
  const foreignSnapshot = { ...original, alliance: { source: 'nexus:1', partner: 'missing', closed: true } };
  assert.throws(() => validateTurnActionPromises([foreignSnapshot], seats), TurnActionError);
  const foreignCompiled = { ...original, compiled: { kind: 'action', action: { kind: 'alliance', partner: 'other' } } };
  assert.throws(() => turnActionValue(foreignCompiled as TurnActionPromise), TurnActionError);
});

void test('combat leaves accept only one original native plan atom or actual declaration in the original battle', () => {
  const claims: TurnActionPlanValue['claim'][] = [{ kind: 'dial', compare: 'eq', value: 1.5 },
    { kind: 'support', compare: 'gte', value: 2 }, { kind: 'weapon', name: null },
    { kind: 'defense', name: null }, { kind: 'leader', leader: 'structural-leader-id' }, { kind: 'kwisatz', use: false }];
  for (const claim of claims) {
    const leaf = { kind: 'battlePlan', battle: 'battle:1', territory: 'carthag', claim };
    assert.deepEqual(parseTurnActionLeaf(leaf), leaf);
    assert.notEqual(parseTurnActionLeaf(leaf), leaf);
  }
  for (const choice of [true, false]) assert.deepEqual(parseTurnActionLeaf({ kind: 'traitorCall', battle: 'battle:1',
    territory: 'carthag', call: choice }), { kind: 'traitorCall', battle: 'battle:1', territory: 'carthag', call: choice });
  const original = { kind: 'battlePlan', battle: 'battle:1', territory: 'carthag', claim: dial().claim };
  for (const leaf of [{ ...original, battle: '' }, { ...original, territory: '' }, { ...original, answer: true },
    { ...original, claim: { kind: 'and', terms: [dial().claim, dial().claim] } },
    { ...original, claim: { kind: 'dial', compare: 'eq', value: 1.25 } },
    { ...original, claim: { kind: 'leader', leader: ' untrimmed' } },
    { kind: 'traitorCall', battle: 'battle:1', territory: 'carthag', call: 'yes' },
    { kind: 'traitorCall', battle: 'battle:1', territory: 'carthag', call: true, canReveal: true }])
    assert.throws(() => parseTurnActionLeaf(leaf), TurnActionError);
  for (const mixed of [plan(), call(), group('or', fact(), plan()), group('or', fact(), call())])
    assert.throws(() => turnActionValue(promise(mixed)), TurnActionError);
});

void test('combat whole AND OR and No branches retain original plan atoms and actual declaration polarity', () => {
  const planLeaf = { kind: 'battlePlan', battle: 'battle:1', territory: 'carthag', claim: dial().claim, answer: true };
  const traitorLeaf = { kind: 'traitorCall', battle: 'battle:1', territory: 'carthag', call: true, answer: true,
    beneficiary: 'respondent', target: 'other', leader: 'other-0' };
  assert.deepEqual(branches(combat(group('and', plan(), call(), pay()))), [[planLeaf, traitorLeaf, signedPay()]]);
  assert.deepEqual(branches(combat(group('or', plan(), call(), pay()))), [[planLeaf], [traitorLeaf], [signedPay()]]);
  assert.deepEqual(branches(combat(group('and', plan(), call()), false)), [
    [{ ...planLeaf, answer: false }], [{ ...traitorLeaf, answer: false }],
  ]);
  assert.deepEqual(branches(combat(group('or', call(true), call(false)), false)), [],
    'No declaration satisfies No to the OR of actual Reveal and actual Decline');
  assert.deepEqual(branches(combat(group('and', call(true), call(false)))), [],
    'One original native declaration cannot both Reveal and Decline');
  assert.deepEqual(branches(combat(group('and', plan(), plan()))), [[planLeaf]]);
});

void test('one actual plan receipt projects exact original predicates into distinct answer intervals and then permits later payment', () => {
  const weapon: TurnActionPlanValue = { claim: { kind: 'weapon', name: null }, value: true };
  const first = combat(group('and', plan(), pay()));
  const second = combat(group('and', plan(weapon.claim), plan(weapon.claim), pay()), true, 'turn-action:2');
  const rows = recordTurnActionPlan([first, second], 'respondent', 1, 'battle:1', 'carthag', [dial(), weapon]);
  assert.deepEqual(rows[0].combat!.plan, { closed: true, values: [dial()] });
  assert.deepEqual(rows[1].combat!.plan, { closed: true, values: [weapon] });
  assert.deepEqual(branches(rows[0]), [[signedPay()]]);
  assert.equal(rows[0].fulfilled, false);
  assert.equal(recordTurnActionPayment(rows, 'respondent', 1, payment())[0].fulfilled, true);
  const fresh = combat(group('and', plan(), pay()), true, 'turn-action:3');
  assert.equal(fresh.combat!.plan!.values, null);
  assert.equal(recordTurnActionPlan(rows, 'respondent', 1, 'battle:1', 'carthag', [dial(false), weapon])[0], rows[0]);
  assert.equal(recordTurnActionPlan([fresh], 'respondent', 1, 'other-battle', 'carthag', [dial()])[0], fresh);
  assert.equal(recordTurnActionPlan([fresh], 'respondent', 1, 'battle:1', 'arrakeen', [dial()])[0], fresh);
  assert.equal(recordTurnActionPlan([fresh], 'respondent', 2, 'battle:1', 'carthag', [dial()])[0], fresh);
  assert.equal(recordTurnActionPlan([fresh], 'other', 1, 'battle:1', 'carthag', [dial()])[0], fresh);
  assert.equal(first.combat!.plan!.values, null);
  validateTurnActionPromises(rows, seats);
});

void test('actual plan and declaration events reject whole No violations atomically and retain dynamic alternatives', () => {
  const no = combat(group('and', plan(), call()), false);
  const planned = recordTurnActionPlan([no], 'respondent', 1, 'battle:1', 'carthag', [dial()]);
  const before = structuredClone(planned);
  assert.throws(() => recordTurnActionTraitor(planned, 'respondent', 1, 'battle:1', 'carthag', true), TurnActionError);
  assert.deepEqual(planned, before);
  const declined = recordTurnActionTraitor(planned, 'respondent', 1, 'battle:1', 'carthag', false);
  assert.equal(declined[0].fulfilled, true);
  const yes = combat(group('and', plan(), pay()), true, 'turn-action:2');
  const planNo = combat(plan(), false, 'turn-action:3');
  assert.throws(() => recordTurnActionPlan([yes, planNo], 'respondent', 1, 'battle:1', 'carthag', [dial()]), TurnActionError);
  assert.equal(yes.combat!.plan!.values, null);
  const declineNo = combat(call(false), false);
  assert.throws(() => recordTurnActionTraitor([declineNo], 'respondent', 1, 'battle:1', 'carthag', false), TurnActionError);
  const revealed = recordTurnActionTraitor([combat(group('and', call(), pay()))], 'respondent', 1, 'battle:1', 'carthag', true);
  assert.equal(revealed[0].combat!.traitor!.call, true);
  assert.equal(recordTurnActionTraitor(revealed, 'respondent', 1, 'battle:1', 'carthag', false)[0], revealed[0],
    'Later prevention/effect handling cannot retract the original declaration');
});

void test('combat closure without a receipt makes every plan and both declaration predicates false', () => {
  const zero = plan({ kind: 'dial', compare: 'eq', value: 0 });
  const yes = combat(group('or', zero, call(false)));
  const no = combat(group('or', zero, call(false)), false, 'turn-action:2');
  const closed = closeTurnActionCombat([yes, no], 1, 'battle:1');
  assert.equal(turnActionValue(closed[0]), false);
  assert.deepEqual(closed[0].combat!.plan, { closed: true, values: null });
  assert.equal(closed[0].combat!.traitor!.closed, true);
  assert.equal(closed[0].combat!.traitor!.call, null);
  assert.equal(closed[0].fulfilled, false);
  assert.equal(closed[1].fulfilled, true);
  assert.equal(closeTurnActionCombat([yes], 1, 'other-battle')[0], yes);
  const finished = finishTurnActionTurn(closed, 'respondent', 1);
  assert.equal(finished[0].released, true);
  const received = recordTurnActionPlan([combat(group('and', plan(), pay()))], 'respondent', 1, 'battle:1', 'carthag', [dial()]);
  const preserved = closeTurnActionCombat(received, 1, 'battle:1');
  assert.deepEqual(preserved[0].combat!.plan, { closed: true, values: [dial()] });
  assert.deepEqual(branches(preserved[0]), [[signedPay()]]);
});

void test('combat expiry releases unresolved original stages without inventing a plan or declaration and preserves terminal rows', () => {
  const yes = combat(plan()), no = combat(call(false), false, 'turn-action:2');
  const expired = finishTurnActionTurn([yes, no], 'respondent', 1);
  for (const row of expired) {
    assert.equal(row.released, true);
    assert.equal(row.fulfilled, false);
    assert.deepEqual(row.combat, yes.combat);
  }
  const terminal = recordTurnActionPlan([combat(plan(), true, 'turn-action:3')], 'respondent', 1, 'battle:1', 'carthag', [dial()])[0];
  assert.equal(terminal.fulfilled, true);
  assert.equal(finishTurnActionTurn([terminal], 'respondent', 1)[0], terminal);
  for (const transform of [
    (rows: TurnActionPromise[]) => closeTurnActionCombat(rows, 1, 'battle:1'),
    (rows: TurnActionPromise[]) => recordTurnActionPlan(rows, 'respondent', 1, 'battle:1', 'carthag', [dial()]),
    (rows: TurnActionPromise[]) => recordTurnActionTraitor(rows, 'respondent', 1, 'battle:1', 'carthag', true),
  ]) assert.ok(transform([...expired, terminal]).every((row, index) => row === [...expired, terminal][index]));
  validateTurnActionPromises([...expired, terminal], seats);
});

void test('combat metadata rejects missing original stages, mismatched source, premature values and incomplete or foreign receipts', () => {
  const original = combat(group('and', plan(), call(), pay()));
  const stage = original.combat!;
  for (const value of [undefined, null, {}, { ...stage, event: 'other-battle' }, { ...stage, territory: 'arrakeen' },
    { ...stage, plan: null }, { ...stage, traitor: null }, { ...stage, canReveal: true },
    { ...stage, plan: { closed: false, values: [dial()] } },
    { ...stage, plan: { closed: true, values: [] } },
    { ...stage, plan: { closed: true, values: [dial(), dial()] } },
    { ...stage, plan: { closed: true, values: [{ claim: { kind: 'weapon', name: null }, value: true }] } },
    { ...stage, traitor: { ...stage.traitor!, call: false } },
    { ...stage, traitor: { ...stage.traitor!, beneficiary: 'other', target: 'other' } }])
    assert.throws(() => turnActionValue({ ...original, combat: value } as TurnActionPromise), TurnActionError);
  assert.throws(() => recordTurnActionPlan([original], 'respondent', 1, 'battle:1', 'carthag', []), TurnActionError);
  assert.throws(() => recordTurnActionPlan([original], 'respondent', 1, 'battle:1', 'carthag', [dial(), dial()]), TurnActionError);
  assert.throws(() => recordTurnActionPlan([original], 'respondent', 1, 'battle:1', 'carthag',
    [{ ...dial(), value: 'yes' }] as never), TurnActionError);
  assert.throws(() => recordTurnActionTraitor([original], 'respondent', 1, 'battle:1', 'carthag', null as never), TurnActionError);
  const foreign = { ...original, combat: { ...stage, traitor: { ...stage.traitor!, target: 'missing' } } };
  assert.throws(() => validateTurnActionPromises([foreign], seats), TurnActionError);
});

void test('combat clauses share the outer logical budget and can coexist with strict earlier optional stages', () => {
  const sixteen = combat(group('or', ...Array.from({ length: 16 }, () => plan())));
  assert.doesNotThrow(() => turnActionValue(sixteen));
  assert.throws(() => turnActionValue(combat(group('or', ...Array.from({ length: 17 }, () => plan())))), TurnActionError);
  const mixed = group('and', plan(), call(), bid(), forces(), alliance(), pay());
  const row = { ...prepared(mixed), alliance: { source: 'nexus:1', partner: null, closed: false }, combat: combat(mixed).combat };
  validateTurnActionPromises([row], seats);
  const old = prepared(group('and', bid(), forces(), pay()));
  assert.equal('combat' in closeTurnActionCombat([old], 1, 'battle:1')[0], false);
});

void test('native off-board combat locations retain exact event and location bindings without widening travel destinations', () => {
  const territory = 'homeworld:guild';
  const mixed: Expression = { kind: 'and', terms: [
    { kind: 'action', action: { kind: 'battlePlan', battle: 'battle:1', territory, claim: dial().claim } },
    { kind: 'action', action: { kind: 'traitorCall', battle: 'battle:1', territory, call: false } },
    pay(),
  ] };
  const original = combat(mixed);
  original.combat!.territory = territory;
  validateTurnActionPromises([original], seats);
  assert.equal(recordTurnActionPlan([original], 'respondent', 1, 'other-battle', territory, [dial()])[0], original);
  assert.equal(recordTurnActionPlan([original], 'respondent', 1, 'battle:1', 'homeworld:emperor', [dial()])[0], original);
  const planned = recordTurnActionPlan([original], 'respondent', 1, 'battle:1', territory, [dial()]);
  assert.equal(recordTurnActionTraitor(planned, 'respondent', 1, 'other-battle', territory, false)[0], planned[0]);
  assert.equal(recordTurnActionTraitor(planned, 'respondent', 1, 'battle:1', 'homeworld:emperor', false)[0], planned[0]);
  const declared = recordTurnActionTraitor(planned, 'respondent', 1, 'battle:1', territory, false);
  assert.deepEqual(branches(declared[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(declared, 'respondent', 1, payment())[0].fulfilled, true);
  assert.equal(closeTurnActionCombat([original], 1, 'other-battle')[0], original);
  assert.equal(closeTurnActionCombat([original], 1, 'battle:1')[0].combat!.plan!.closed, true);
  for (const kind of ['ship', 'move'])
    assert.throws(() => parseTurnActionLeaf({ kind, territory, minimum: 1 }), TurnActionError);
});

void test('printed card-play leaves contain only the printed effect and every raw clause retains its own stage', () => {
  for (const effect of PRINTED_CARD_EFFECTS) {
    const original = { kind: 'cardPlay', effect };
    assert.deepEqual(parseTurnActionLeaf(original), original);
    assert.notEqual(parseTurnActionLeaf(original), original);
    for (const invalid of [{ ...original, card: 'physical-card' }, { ...original, played: true },
      { ...original, minimum: 1 }, { ...original, printed: true }, { ...original, answer: true }])
      assert.throws(() => parseTurnActionLeaf(invalid), TurnActionError);
    assert.throws(() => turnActionValue(promise(card(effect))), TurnActionError);
    assert.throws(() => turnActionValue(promise(group('or', fact(), card(effect)))), TurnActionError,
      'Compiler folding never removes the original raw interval requirement');
  }
  for (const effect of ['', 'Hajr', 'karama', 'thumper', 'semutaDrug', null])
    assert.throws(() => parseTurnActionLeaf({ kind: 'cardPlay', effect }), TurnActionError);
  validateTurnActionPromises([cards(group('and', card(), card('ghola')))], seats);
});

void test('whole printed-card AND and OR retain dynamic alternatives and settle only actual future printed-role plays', () => {
  const hajr = { kind: 'cardPlay', effect: 'hajr', answer: true };
  const ghola = { kind: 'cardPlay', effect: 'ghola', answer: true };
  const and = cards(group('and', card(), card('ghola'), pay()));
  const or = cards(group('or', card(), card('ghola')), true, 'turn-action:2');
  assert.deepEqual(branches(and), [[hajr, ghola, signedPay()]]);
  assert.deepEqual(branches(or), [[hajr], [ghola]]);
  const played = recordTurnActionCardPlay([and, or], 'respondent', 1, 'hajr');
  assert.equal(played[0].fulfilled, false);
  assert.equal(played[1].fulfilled, true);
  assert.deepEqual(branches(played[0]), [[ghola, signedPay()]]);
  const gholaPlayed = recordTurnActionCardPlay(played, 'respondent', 1, 'ghola');
  assert.equal(gholaPlayed[0].fulfilled, false);
  assert.deepEqual(branches(gholaPlayed[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(gholaPlayed, 'respondent', 1, payment())[0].fulfilled, true);
  assert.equal(gholaPlayed[1], played[1]);
  assert.equal(and.cardPlays!.hajr!.played, false);
  assert.equal(recordTurnActionCardPlay([or], 'respondent', 1, 'ghola')[0].fulfilled, true);
});

void test('whole card-play No applies De Morgan and rejects the actual accepted play completing its aggregate', () => {
  const andNo = cards(group('and', card(), card('ghola')), false);
  assert.deepEqual(branches(andNo), [[{ kind: 'cardPlay', effect: 'hajr', answer: false }],
    [{ kind: 'cardPlay', effect: 'ghola', answer: false }]]);
  const one = recordTurnActionCardPlay([andNo], 'respondent', 1, 'hajr');
  assert.deepEqual(branches(one[0]), [[{ kind: 'cardPlay', effect: 'ghola', answer: false }]]);
  const before = structuredClone(one);
  assert.throws(() => recordTurnActionCardPlay(one, 'respondent', 1, 'ghola'), TurnActionError);
  assert.deepEqual(one, before);
  const orNo = cards(group('or', card(), card('ghola')), false);
  assert.deepEqual(branches(orNo), [[{ kind: 'cardPlay', effect: 'hajr', answer: false },
    { kind: 'cardPlay', effect: 'ghola', answer: false }]]);
  for (const effect of ['hajr', 'ghola'] as const)
    assert.throws(() => recordTurnActionCardPlay([orNo], 'respondent', 1, effect), TurnActionError);
  assert.deepEqual(branches(cards(group('and', card(), card()))), [[{ kind: 'cardPlay', effect: 'hajr', answer: true }]]);
});

void test('earlier card receipts do not satisfy a later answer and genuine replay updates only matching live intervals', () => {
  const mixed = group('and', card(), pay());
  const old = cards(mixed);
  const played = recordTurnActionCardPlay([old], 'respondent', 1, 'hajr')[0];
  const fresh = cards(mixed, true, 'turn-action:2');
  const other = { ...cards(mixed, true, 'turn-action:3'), player: 'other' };
  const laterTurn = { ...cards(mixed, true, 'turn-action:4'), turn: 2 };
  assert.equal(turnActionValue(fresh), false);
  assert.equal(fresh.cardPlays!.hajr!.played, false);
  const replay = recordTurnActionCardPlay([played, fresh, other, laterTurn], 'respondent', 1, 'hajr');
  assert.equal(replay[0], played, 'One boolean receipt never counts or duplicates a later replay');
  assert.equal(replay[1].cardPlays!.hajr!.played, true);
  assert.equal(replay[2], other);
  assert.equal(replay[3], laterTurn);
  assert.equal(old.cardPlays!.hajr!.played, false);
  assert.equal(fresh.cardPlays!.hajr!.played, false);
});

void test('actual transport closure closes Hajr while Ghola and ordinary payment alternatives retain their own deadline', () => {
  const original = cards(group('or', card(), card('ghola'), pay()));
  const closed = closeTurnActionTransport([original], 'respondent', 1);
  assert.deepEqual(closed[0].cardPlays, { hajr: { played: false, closed: true }, ghola: { played: false, closed: false } });
  assert.deepEqual(branches(closed[0]), [[{ kind: 'cardPlay', effect: 'ghola', answer: true }], [signedPay()]]);
  assert.equal(recordTurnActionCardPlay(closed, 'respondent', 1, 'hajr')[0], closed[0]);
  assert.equal(recordTurnActionCardPlay(closed, 'respondent', 1, 'ghola')[0].fulfilled, true);
  assert.equal(recordTurnActionPayment(closed, 'respondent', 1, payment())[0].fulfilled, true);
  const no = cards(group('and', card(), card('ghola')), false);
  const noClosed = closeTurnActionTransport([no], 'respondent', 1);
  assert.equal(noClosed[0].fulfilled, false, 'Whole No waits for its remaining relevant native family');
  const gholaPlayed = recordTurnActionCardPlay(noClosed, 'respondent', 1, 'ghola');
  assert.equal(gholaPlayed[0].fulfilled, false);
  assert.equal(finishTurnActionTurn(gholaPlayed, 'respondent', 1)[0].fulfilled, true);
  assert.equal(closeTurnActionTransport([cards(card(), false)], 'respondent', 1)[0].fulfilled, true);
  validateTurnActionPromises(closed, seats);
});

void test('full-turn closure settles absence, releases unmet Yes and leaves terminal card receipts immutable', () => {
  const no = cards(card('ghola'), false);
  const yes = cards(card('ghola'), true, 'turn-action:2');
  const fulfilled = recordTurnActionCardPlay([cards(card(), true, 'turn-action:3')], 'respondent', 1, 'hajr')[0];
  const finished = finishTurnActionTurn([no, yes, fulfilled], 'respondent', 1);
  assert.equal(finished[0].fulfilled, true);
  assert.equal(finished[1].released, true);
  assert.equal(finished[2], fulfilled);
  assert.deepEqual(finished[0].cardPlays, { hajr: { played: false, closed: true }, ghola: { played: false, closed: true } });
  for (const transform of [
    (rows: TurnActionPromise[]) => recordTurnActionCardPlay(rows, 'respondent', 1, 'hajr'),
    (rows: TurnActionPromise[]) => recordTurnActionCardPlay(rows, 'respondent', 1, 'ghola'),
    (rows: TurnActionPromise[]) => closeTurnActionTransport(rows, 'respondent', 1),
    (rows: TurnActionPromise[]) => finishTurnActionTurn(rows, 'respondent', 1),
  ]) assert.ok(transform(finished).every((row, index) => row === finished[index]));
  validateTurnActionPromises(finished, seats);
});

void test('strict printed-card stages preserve old rows and reject metadata, missing effects and foreign compiled clauses', () => {
  const original = cards(group('and', card(), card('ghola')));
  for (const cardPlays of [undefined, null, {}, { hajr: null, ghola: null },
    { hajr: { played: false, closed: false } },
    { ...original.cardPlays, card: 'physical-card' },
    { ...original.cardPlays, hajr: { played: 1, closed: false } },
    { ...original.cardPlays, ghola: { played: false, closed: 'yes' } },
    { ...original.cardPlays, hajr: { played: false, closed: false, count: 1 } }])
    assert.throws(() => turnActionValue({ ...original, cardPlays } as TurnActionPromise), TurnActionError);
  const old = promise(pay());
  assert.equal('cardPlays' in recordTurnActionCardPlay([old], 'respondent', 1, 'hajr')[0], false);
  assert.equal('cardPlays' in closeTurnActionTransport([old], 'respondent', 1)[0], false);
  assert.equal('cardPlays' in finishTurnActionTurn([old], 'respondent', 1)[0], false);
  const optional = { ...prepared(group('and', bid(), forces())), cardPlays: { hajr: null, ghola: null } };
  validateTurnActionPromises([optional], seats);
  const foreign = { ...cards(card()), compiled: { kind: 'action', action: { kind: 'cardPlay', effect: 'ghola' } } };
  assert.throws(() => turnActionValue(foreign as TurnActionPromise), TurnActionError);
  assert.throws(() => recordTurnActionCardPlay([original], 'respondent', 1, 'karama' as never), TurnActionError);
});

void test('card-play events reject all affected No violations atomically and share the outer logical budget', () => {
  const yes = cards(group('and', card(), pay()));
  const no = cards(card(), false, 'turn-action:2');
  const before = structuredClone([yes, no]);
  assert.throws(() => recordTurnActionCardPlay([yes, no], 'respondent', 1, 'hajr'), TurnActionError);
  assert.deepEqual([yes, no], before);
  assert.doesNotThrow(() => turnActionValue(cards(group('or', ...Array.from({ length: 16 }, () => card())))));
  assert.throws(() => turnActionValue(cards(group('or', ...Array.from({ length: 17 }, () => card())))), TurnActionError);
});

void test('payment expiry preserves a later Ghola OR alternative while an AND still requires its missing payment', () => {
  const or = cards(group('or', card('ghola'), pay()));
  const and = cards(group('and', card('ghola'), pay()), true, 'turn-action:2');
  const closed = closeTurnActionPayments([or, and], 'respondent', 1);
  for (const row of closed) {
    assert.equal(row.paymentClosed, true);
    assert.equal(row.transportClosed, false);
    assert.deepEqual(row.shipment, { pending: true, event: null });
    assert.deepEqual(row.cardPlays, or.cardPlays);
    assert.equal(row.cardPlays!.ghola!.closed, false);
    assert.equal(row.fulfilled, false);
    assert.equal(row.released, false);
  }
  assert.deepEqual(branches(closed[0]), [[{ kind: 'cardPlay', effect: 'ghola', answer: true }]]);
  assert.deepEqual(branches(closed[1]), []);
  assert.ok(recordTurnActionPayment(closed, 'respondent', 1, payment()).every((row, index) => row === closed[index]));
  const laterGhola = recordTurnActionCardPlay(closed, 'respondent', 1, 'ghola');
  assert.equal(laterGhola[0].fulfilled, true);
  assert.equal(laterGhola[1].fulfilled, false);
  assert.equal(finishTurnActionTurn(laterGhola, 'respondent', 1)[1].released, true);
  const expiredTooEarly = finishTurnActionTurn([or], 'respondent', 1)[0];
  assert.equal(expiredTooEarly.released, true);
  assert.equal(expiredTooEarly.cardPlays!.ghola!.closed, true);
  assert.equal(closeTurnActionPayments(laterGhola, 'respondent', 1)[0], laterGhola[0], 'Terminal rows remain identical');
  assert.equal(closeTurnActionPayments(closed, 'respondent', 1)[1], closed[1], 'Repeated payment closure retains the same row');
  assert.equal(or.paymentClosed, false);
  validateTurnActionPromises(closed, seats);
});

void test('payment-only closure keeps whole No binding through later Ghola and validates its untouched native stage', () => {
  const orNo = cards(group('or', card('ghola'), pay()), false);
  const andNo = cards(group('and', card('ghola'), pay()), false, 'turn-action:2');
  const closed = closeTurnActionPayments([orNo, andNo], 'respondent', 1);
  assert.equal(closed[0].fulfilled, false);
  assert.equal(closed[1].fulfilled, false);
  assert.deepEqual(branches(closed[0]), [[{ kind: 'cardPlay', effect: 'ghola', answer: false }]]);
  assert.throws(() => recordTurnActionCardPlay([closed[0]], 'respondent', 1, 'ghola'), TurnActionError);
  const played = recordTurnActionCardPlay([closed[1]], 'respondent', 1, 'ghola');
  assert.equal(played[0].fulfilled, false);
  assert.equal(finishTurnActionTurn(played, 'respondent', 1)[0].fulfilled, true);
  const paymentOnlyNo = closeTurnActionPayments([promise(pay(), false)], 'respondent', 1)[0];
  assert.equal(paymentOnlyNo.fulfilled, true);
  const other = { ...orNo, player: 'other' }, nextTurn = { ...orNo, turn: 2 };
  assert.equal(closeTurnActionPayments([other], 'respondent', 1)[0], other);
  assert.equal(closeTurnActionPayments([nextTurn], 'respondent', 1)[0], nextTurn);
  const malformed = { ...orNo, cardPlays: { hajr: null, ghola: { played: false, closed: 'yes' } } };
  assert.throws(() => closeTurnActionPayments([malformed as unknown as TurnActionPromise], 'respondent', 1), TurnActionError);
  validateTurnActionPromises(closed, seats);
});

void test('battle-power raw atoms and folded alternatives require exact original per-power stages', () => {
  const original = { kind: 'battlePower', battle: 'battle:1', territory: 'carthag', claim: { kind: 'voice', use: true } };
  assert.deepEqual(parseTurnActionLeaf(original), original);
  for (const value of [{ ...original, owner: 'respondent' }, { ...original, answer: true }, { ...original, battle: '' },
    { ...original, claim: { kind: 'prescienceField', field: 'dial', value: 4 } }])
    assert.throws(() => parseTurnActionLeaf(value), TurnActionError);
  assert.throws(() => turnActionValue(promise(power())), TurnActionError);
  assert.throws(() => turnActionValue(promise(group('or', fact(), power()))), TurnActionError);
  const old = combat(plan());
  validateTurnActionPromises([old], seats);
  assert.equal('powers' in closeTurnActionCombat([old], 1, 'battle:1')[0].combat!, false);
});

void test('whole power AND keeps exact native source context and one declaration evaluates all original predicates', () => {
  const command: BattlePowerClaim = { kind: 'voiceCommand', cardType: 'projectile', must: true };
  const row = powers(group('and', power(), power(command), pay()));
  assert.deepEqual(branches(row), [[
    { kind: 'battlePower', battle: 'battle:1', territory: 'carthag', claim: { kind: 'voice', use: true },
      owner: 'respondent', beneficiary: 'respondent', target: 'other', answer: true },
    { kind: 'battlePower', battle: 'battle:1', territory: 'carthag', claim: command,
      owner: 'respondent', beneficiary: 'respondent', target: 'other', answer: true }, signedPay(),
  ]]);
  const declared = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'voice', use: true, cardType: 'projectile', must: true });
  assert.deepEqual(declared[0].combat!.powers!.voice!.values, [
    { claim: { kind: 'voice', use: true }, value: true }, { claim: command, value: true },
  ]);
  assert.deepEqual(branches(declared[0]), [[signedPay()]]);
  assert.equal(declared[0].fulfilled, false);
  assert.equal(recordTurnActionPayment(declared, 'respondent', 1, payment())[0].fulfilled, true);
  assert.equal(row.combat!.powers!.voice!.values, null);
});

void test('whole OR retains actual Voice and Prescience alternatives without storing a selected route', () => {
  const mixed = group('or', power({ kind: 'voiceCommand', cardType: 'poison', must: false }),
    power({ kind: 'prescienceField', field: 'weapon' }));
  const row = powers(mixed);
  assert.equal(branches(row).length, 2);
  const voice = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'voice', use: true, cardType: 'poison', must: false });
  assert.equal(voice[0].fulfilled, true);
  const prescience = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'prescience', use: true, field: 'weapon' });
  assert.equal(prescience[0].fulfilled, true);
  assert.deepEqual(prescience[0].mixed, mixed);
  const otherVoice = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'voice', use: true, cardType: 'projectile', must: true });
  assert.equal(otherVoice[0].fulfilled, false);
  assert.equal(branches(otherVoice[0]).length, 1);
});

void test('explicit power Decline differs from absent opportunity and preserves requested-field semantics', () => {
  const mixed = group('or', power({ kind: 'prescience', use: false }), pay());
  const row = powers(mixed);
  const declined = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag', { power: 'prescience', use: false });
  assert.equal(declined[0].fulfilled, true);
  assert.deepEqual(declined[0].combat!.powers!.prescience!.values,
    [{ claim: { kind: 'prescience', use: false }, value: true }]);
  const absent = closeTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag', 'prescience');
  assert.equal(absent[0].fulfilled, false);
  assert.equal(absent[0].combat!.powers!.prescience!.values, null);
  assert.deepEqual(branches(absent[0]), [[signedPay()]]);
  const field = powers(group('and', power({ kind: 'prescienceField', field: 'dial' }), pay()));
  const requested = recordTurnActionBattlePower([field], 'respondent', 1, 'battle:1', 'carthag', { power: 'prescience', use: true, field: 'dial' });
  assert.deepEqual(branches(requested[0]), [[signedPay()]]);
});

void test('whole power No applies De Morgan and actual declarations or later payments reject aggregate violations atomically', () => {
  const no = powers(group('and', power(), pay()), false);
  assert.equal(branches(no).length, 2);
  const declaration: BattlePowerDeclaration = { power: 'voice', use: true, cardType: 'shield', must: false };
  const declared = recordTurnActionBattlePower([no], 'respondent', 1, 'battle:1', 'carthag', declaration);
  assert.deepEqual(branches(declared[0]), [[signedPay('recipient', 3, 0, false)]]);
  const before = structuredClone(declared);
  assert.throws(() => recordTurnActionPayment(declared, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(declared, before);
  const paid = recordTurnActionPayment([no], 'respondent', 1, payment());
  assert.throws(() => recordTurnActionBattlePower(paid, 'respondent', 1, 'battle:1', 'carthag', declaration), TurnActionError);
  const yes = powers(group('and', power(), pay()), true, 'turn-action:2');
  const plainNo = powers(power(), false, 'turn-action:3');
  assert.throws(() => recordTurnActionBattlePower([yes, plainNo], 'respondent', 1, 'battle:1', 'carthag', declaration), TurnActionError);
  assert.equal(yes.combat!.powers!.voice!.values, null);
  assert.equal(plainNo.combat!.powers!.voice!.values, null);
});

void test('closing one power preserves the open plan, Traitor and other power rather than expiring the entire battle', () => {
  const row = powers(group('or', power(), power({ kind: 'prescience', use: true }), plan(), call(), pay()));
  row.combat!.plan = { closed: false, values: null };
  row.combat!.traitor = { beneficiary: 'respondent', target: 'other', leader: 'other-0', closed: false, call: null };
  const closed = closeTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag', 'voice')[0];
  assert.deepEqual(closed.combat!.powers!.voice, { beneficiary: 'respondent', target: 'other', closed: true, values: null });
  assert.equal(closed.combat!.powers!.prescience, row.combat!.powers!.prescience);
  assert.equal(closed.combat!.plan, row.combat!.plan);
  assert.equal(closed.combat!.traitor, row.combat!.traitor);
  assert.equal(branches(closed).length, 4);
  const allClosed = closeTurnActionCombat([closed], 1, 'battle:1')[0];
  assert.equal(allClosed.combat!.powers!.prescience!.closed, true);
  assert.equal(allClosed.combat!.plan!.closed, true);
  assert.equal(allClosed.combat!.traitor!.closed, true);
  assert.deepEqual(branches(allClosed), [[signedPay()]]);
});

void test('original power source and owner bind receipts once before any later prevention or alternative declaration', () => {
  const row = powers(group('and', power(), pay()));
  const declaration: BattlePowerDeclaration = { power: 'voice', use: true, cardType: 'projectile', must: true };
  for (const [player, turn, event, territory] of [['other', 1, 'battle:1', 'carthag'], ['respondent', 2, 'battle:1', 'carthag'],
    ['respondent', 1, 'other-battle', 'carthag'], ['respondent', 1, 'battle:1', 'homeworld:guild']] as const)
    assert.equal(recordTurnActionBattlePower([row], player, turn, event, territory, declaration)[0], row);
  const actual = recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag', declaration)[0];
  assert.equal(recordTurnActionBattlePower([actual], 'respondent', 1, 'battle:1', 'carthag', { power: 'voice', use: false })[0], actual);
  assert.equal(closeTurnActionBattlePower([actual], 'respondent', 1, 'battle:1', 'carthag', 'voice')[0], actual);
  const expired = closeTurnActionCombat([actual], 1, 'battle:1')[0];
  assert.deepEqual(expired.combat!.powers!.voice!.values, actual.combat!.powers!.voice!.values);
  const fresh = powers(group('and', power(), pay()), true, 'turn-action:2');
  assert.equal(fresh.combat!.powers!.voice!.values, null);
  validateTurnActionPromises([actual], seats);
});

void test('unresolved power expiry releases without inventing Decline while terminal and actual receipts remain immutable', () => {
  const pending = powers(power({ kind: 'voice', use: false }));
  const expired = finishTurnActionTurn([pending], 'respondent', 1)[0];
  assert.equal(expired.released, true);
  assert.equal(expired.combat!.powers!.voice!.closed, false);
  assert.equal(expired.combat!.powers!.voice!.values, null);
  const no = powers(power(), false, 'turn-action:2');
  const closedNo = closeTurnActionBattlePower([no], 'respondent', 1, 'battle:1', 'carthag', 'voice')[0];
  assert.equal(closedNo.fulfilled, true);
  const used = recordTurnActionBattlePower([powers(power(), true, 'turn-action:3')], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'voice', use: true, cardType: 'poison', must: false })[0];
  const terminal = [expired, closedNo, used];
  for (const transform of [
    (rows: TurnActionPromise[]) => closeTurnActionCombat(rows, 1, 'battle:1'),
    (rows: TurnActionPromise[]) => closeTurnActionBattlePower(rows, 'respondent', 1, 'battle:1', 'carthag', 'voice'),
    (rows: TurnActionPromise[]) => recordTurnActionBattlePower(rows, 'respondent', 1, 'battle:1', 'carthag', { power: 'voice', use: false }),
  ]) assert.ok(transform(terminal).every((record, index) => record === terminal[index]));
  validateTurnActionPromises(terminal, seats);
});

void test('native power stages reject premature, incomplete, duplicate and wrong-power predicate receipts', () => {
  const row = powers(group('and', power(), pay()));
  const stage = row.combat!.powers!.voice!;
  for (const powerStages of [undefined, null, {}, { voice: null, prescience: null },
    { ...row.combat!.powers, hidden: true },
    { ...row.combat!.powers, voice: { ...stage, values: [{ claim: { kind: 'voice', use: true }, value: true }] } },
    { ...row.combat!.powers, voice: { ...stage, closed: true, values: [] } },
    { ...row.combat!.powers, voice: { ...stage, closed: true, values: [
      { claim: { kind: 'voice', use: true }, value: true }, { claim: { kind: 'voice', use: true }, value: true }] } },
    { ...row.combat!.powers, voice: { ...stage, closed: true, values: [{ claim: { kind: 'prescience', use: true }, value: true }] } },
    { ...row.combat!.powers, voice: { ...stage, beneficiary: 'other' } },
    { ...row.combat!.powers, voice: { ...stage, closed: 'yes' } }])
    assert.throws(() => turnActionValue({ ...row, combat: { ...row.combat!, powers: powerStages } } as TurnActionPromise), TurnActionError);
  const foreign = { ...row, combat: { ...row.combat!, powers: { ...row.combat!.powers!, voice: { ...stage, target: 'missing' } } } };
  assert.throws(() => validateTurnActionPromises([foreign], seats), TurnActionError);
  assert.throws(() => recordTurnActionBattlePower([row], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'prescience', use: true, field: 'weapon', value: 'Lasgun' } as never), TurnActionError);
});

void test('power predicates deduplicate only exact original clauses and retain the shared sixteen-leaf limit', () => {
  const repeated = powers(group('and', power(), power(), pay()));
  assert.equal(branches(repeated)[0].length, 2);
  const actual = recordTurnActionBattlePower([repeated], 'respondent', 1, 'battle:1', 'carthag',
    { power: 'voice', use: true, cardType: 'shield', must: true });
  assert.equal(actual[0].combat!.powers!.voice!.values!.length, 1);
  assert.doesNotThrow(() => turnActionValue(powers(group('or', ...Array.from({ length: 16 }, () => power())))));
  assert.throws(() => turnActionValue(powers(group('or', ...Array.from({ length: 17 }, () => power())))), TurnActionError);
});

void test('window-card raw leaves name only a printed role and exact original source, including folded clauses', () => {
  for (const effect of WINDOW_CARD_EFFECTS) {
    const original = { kind: 'windowCardPlay', effect, source: windowSource(effect) };
    assert.deepEqual(parseTurnActionLeaf(original), original);
    assert.notEqual(parseTurnActionLeaf(original), original);
    for (const invalid of [{ ...original, source: '' }, { ...original, card: 'physical-id' }, { ...original, amount: 12 },
      { ...original, distance: 4 }, { ...original, answer: true }, { ...original, played: true }])
      assert.throws(() => parseTurnActionLeaf(invalid), TurnActionError);
    assert.throws(() => turnActionValue(promise(windowCard(effect))), TurnActionError);
    assert.throws(() => turnActionValue(promise(group('or', fact(), windowCard(effect)))), TurnActionError);
  }
  for (const effect of ['hajr', 'ghola', 'karama', 'Weather Control', null])
    assert.throws(() => parseTurnActionLeaf({ kind: 'windowCardPlay', effect, source: 'storm:1' }), TurnActionError);
});

void test('whole window-card AND and OR keep dynamic printed-play alternatives with no effect amount', () => {
  const weather = { kind: 'windowCardPlay', effect: 'weather', source: 'storm:1', answer: true };
  const atomics = { kind: 'windowCardPlay', effect: 'atomics', source: 'storm:1', answer: true };
  const and = windowed(group('and', windowCard(), windowCard('atomics'), pay()));
  const or = windowed(group('or', windowCard(), windowCard('atomics')), true, 'turn-action:2');
  assert.deepEqual(branches(and), [[weather, atomics, signedPay()]]);
  assert.deepEqual(branches(or), [[weather], [atomics]]);
  const played = recordTurnActionWindowCardPlay([and, or], 'respondent', 1, 'weather', 'storm:1');
  assert.deepEqual(branches(played[0]), [[atomics, signedPay()]]);
  assert.equal(played[1].fulfilled, true);
  const both = recordTurnActionWindowCardPlay(played, 'respondent', 1, 'atomics', 'storm:1');
  assert.equal(both[0].fulfilled, false);
  assert.deepEqual(branches(both[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(both, 'respondent', 1, payment())[0].fulfilled, true);
  assert.equal(and.windowCards!.weather!.played, false);
});

void test('whole window-card No negates the aggregate and actual plays or later payments reject atomically', () => {
  const no = windowed(group('and', windowCard(), windowCard('atomics')), false);
  assert.deepEqual(branches(no), [[{ kind: 'windowCardPlay', effect: 'weather', source: 'storm:1', answer: false }],
    [{ kind: 'windowCardPlay', effect: 'atomics', source: 'storm:1', answer: false }]]);
  const weather = recordTurnActionWindowCardPlay([no], 'respondent', 1, 'weather', 'storm:1');
  const before = structuredClone(weather);
  assert.throws(() => recordTurnActionWindowCardPlay(weather, 'respondent', 1, 'atomics', 'storm:1'), TurnActionError);
  assert.deepEqual(weather, before);
  const orNo = windowed(group('or', windowCard(), windowCard('atomics')), false);
  assert.throws(() => recordTurnActionWindowCardPlay([orNo], 'respondent', 1, 'weather', 'storm:1'), TurnActionError);
  const paidNo = windowed(group('and', windowCard(), pay()), false);
  const declared = recordTurnActionWindowCardPlay([paidNo], 'respondent', 1, 'weather', 'storm:1');
  assert.throws(() => recordTurnActionPayment(declared, 'respondent', 1, payment()), TurnActionError);
  const yes = windowed(group('and', windowCard(), pay()), true, 'turn-action:2');
  assert.throws(() => recordTurnActionWindowCardPlay([yes, orNo], 'respondent', 1, 'weather', 'storm:1'), TurnActionError);
  assert.equal(yes.windowCards!.weather!.played, false);
});

void test('exact player turn effect and source binding preserves separate original-window answer intervals', () => {
  const mixed = group('and', windowCard('harvester'), pay());
  const original = windowed(mixed);
  for (const [player, turn, effect, source] of [
    ['other', 1, 'harvester', 'spice-blow:1'], ['respondent', 2, 'harvester', 'spice-blow:1'],
    ['respondent', 1, 'weather', 'spice-blow:1'], ['respondent', 1, 'harvester', 'spice-blow:2'],
  ] as const) {
    assert.equal(recordTurnActionWindowCardPlay([original], player, turn, effect, source)[0], original);
    assert.equal(closeTurnActionWindowCardPlay([original], player, turn, effect, source)[0], original);
  }
  const played = recordTurnActionWindowCardPlay([original], 'respondent', 1, 'harvester', 'spice-blow:1')[0];
  const fresh = windowed(mixed, true, 'turn-action:2');
  assert.equal(fresh.windowCards!.harvester!.played, false);
  const replay = recordTurnActionWindowCardPlay([played, fresh], 'respondent', 1, 'harvester', 'spice-blow:1');
  assert.equal(replay[0], played);
  assert.equal(replay[1].windowCards!.harvester!.played, true);
  assert.equal(recordTurnActionWindowCardPlay(replay, 'respondent', 1, 'harvester', 'spice-blow:1')[1], replay[1]);
});

void test('closing one native window records absence only there and retains other window and later payment alternatives', () => {
  const original = windowed(group('or', windowCard(), windowCard('atomics'), pay()));
  const closed = closeTurnActionWindowCardPlay([original], 'respondent', 1, 'weather', 'storm:1');
  assert.deepEqual(closed[0].windowCards!.weather, { source: 'storm:1', played: false, closed: true });
  assert.equal(closed[0].windowCards!.atomics, original.windowCards!.atomics);
  assert.equal(closed[0].paymentClosed, false);
  assert.equal(branches(closed[0]).length, 2);
  assert.equal(recordTurnActionWindowCardPlay(closed, 'respondent', 1, 'weather', 'storm:1')[0], closed[0]);
  assert.equal(recordTurnActionWindowCardPlay(closed, 'respondent', 1, 'atomics', 'storm:1')[0].fulfilled, true);
  const all = closeTurnActionWindowCardPlay(closed, 'respondent', 1, 'atomics', 'storm:1');
  assert.deepEqual(branches(all[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(all, 'respondent', 1, payment())[0].fulfilled, true);
  const played = recordTurnActionWindowCardPlay([original], 'respondent', 1, 'weather', 'storm:1')[0];
  assert.equal(played.fulfilled, true);
  assert.equal(closeTurnActionWindowCardPlay([played], 'respondent', 1, 'weather', 'storm:1')[0], played);
});

void test('full-turn expiry closes remaining window stages while payment or transport closure preserves their real deadline', () => {
  const no = windowed(windowCard('harvester'), false);
  assert.equal(closeTurnActionPayments([no], 'respondent', 1)[0].windowCards!.harvester, no.windowCards!.harvester);
  assert.equal(closeTurnActionTransport([no], 'respondent', 1)[0].windowCards!.harvester, no.windowCards!.harvester);
  const finished = finishTurnActionTurn([no], 'respondent', 1)[0];
  assert.equal(finished.fulfilled, true);
  assert.deepEqual(finished.windowCards!.harvester, { source: 'spice-blow:1', played: false, closed: true });
  const yes = windowed(windowCard(), true, 'turn-action:2');
  assert.equal(finishTurnActionTurn([yes], 'respondent', 1)[0].released, true);
  const terminal = [finished, finishTurnActionTurn([yes], 'respondent', 1)[0]];
  for (const transform of [
    (rows: TurnActionPromise[]) => recordTurnActionWindowCardPlay(rows, 'respondent', 1, 'harvester', 'spice-blow:1'),
    (rows: TurnActionPromise[]) => closeTurnActionWindowCardPlay(rows, 'respondent', 1, 'weather', 'storm:1'),
    (rows: TurnActionPromise[]) => finishTurnActionTurn(rows, 'respondent', 1),
  ]) assert.ok(transform(terminal).every((row, index) => row === terminal[index]));
  validateTurnActionPromises(terminal, seats);
});

void test('strict window stages contain only exact raw named effects and sources without extra counters or physical IDs', () => {
  const original = windowed(group('and', windowCard(), pay()));
  const stage = original.windowCards!.weather!;
  for (const windowCards of [undefined, null, {}, { weather: null }, { weather: { ...stage, source: 'storm:2' } },
    { weather: { ...stage, played: 1 } }, { weather: { ...stage, closed: 'yes' } }, { weather: { ...stage, count: 1 } },
    { weather: stage, atomics: { source: 'storm:1', played: false, closed: false } }, { weather: stage, ghola: stage }])
    assert.throws(() => turnActionValue({ ...original, windowCards } as TurnActionPromise), TurnActionError);
  assert.throws(() => turnActionValue(windowed(group('or', windowCard(), windowCard('weather', 'storm:2')))), TurnActionError);
  const old = cards(group('and', card(), pay()));
  assert.equal('windowCards' in recordTurnActionWindowCardPlay([old], 'respondent', 1, 'weather', 'storm:1')[0], false);
  assert.equal('windowCards' in finishTurnActionTurn([old], 'respondent', 1)[0], false);
  assert.throws(() => recordTurnActionWindowCardPlay([original], 'respondent', 1, 'hajr' as never, 'storm:1'), TurnActionError);
  assert.throws(() => closeTurnActionWindowCardPlay([original], 'respondent', 1, 'weather', ''), TurnActionError);
});

void test('window-card clauses deduplicate only their exact original source and share the sixteen-leaf budget', () => {
  const repeated = windowed(group('and', windowCard(), windowCard(), pay()));
  assert.equal(branches(repeated)[0].length, 2);
  assert.doesNotThrow(() => turnActionValue(windowed(group('or', ...Array.from({ length: 16 }, () => windowCard())))));
  assert.throws(() => turnActionValue(windowed(group('or', ...Array.from({ length: 17 }, () => windowCard())))), TurnActionError);
  const foreign = { ...windowed(windowCard()), compiled: { kind: 'action', action: {
    kind: 'windowCardPlay', effect: 'weather', source: 'storm:2',
  } } };
  assert.throws(() => turnActionValue(foreign as TurnActionPromise), TurnActionError);
});

void test('printed auction Karama receipt is separate from the bid and preserves their joint payment remainder', () => {
  const original = { ...windowed(group('and', windowCard('karamaAuction'), bid(5), pay())), preparation: {
    bid: { lot: 1, source: 'private-original-lot:1', maximum: 0, closed: false }, revival: null,
  } };
  const signed = { kind: 'windowCardPlay', effect: 'karamaAuction', source: 'ordinary-auction:1:1', answer: true };
  const bidPlaced = recordTurnActionBid([original], 'respondent', 1, { lot: 1, source: 'private-original-lot:1', amount: 5 });
  assert.deepEqual(branches(bidPlaced[0]), [[signed, signedPay()]]);
  assert.equal(bidPlaced[0].windowCards!.karamaAuction!.played, false);
  const rolePlayed = recordTurnActionWindowCardPlay(bidPlaced, 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1');
  assert.deepEqual(branches(rolePlayed[0]), [[signedPay()]]);
  const complete = recordTurnActionPayment(rolePlayed, 'respondent', 1, payment());
  assert.equal(complete[0].fulfilled, true);
  assert.equal(original.windowCards!.karamaAuction!.played, false);
  validateTurnActionPromises(complete, seats);
});

void test('auction Karama replay receipts affect only future answers for the exact original player turn and lot', () => {
  const original = windowed(group('and', windowCard('karamaAuction'), pay()));
  for (const [player, turn, source] of [['other', 1, 'ordinary-auction:1:1'],
    ['respondent', 2, 'ordinary-auction:1:1'], ['respondent', 1, 'ordinary-auction:1:2']] as const) {
    assert.equal(recordTurnActionWindowCardPlay([original], player, turn, 'karamaAuction', source)[0], original);
    assert.equal(closeTurnActionWindowCardPlay([original], player, turn, 'karamaAuction', source)[0], original);
  }
  const played = recordTurnActionWindowCardPlay([original], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0];
  const fresh = windowed(windowCard('karamaAuction'), true, 'turn-action:2');
  const replay = recordTurnActionWindowCardPlay([played, fresh], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1');
  assert.equal(replay[0], played);
  assert.equal(replay[1].fulfilled, true);
  assert.equal(fresh.windowCards!.karamaAuction!.played, false);
  const closed = closeTurnActionWindowCardPlay([original], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0];
  assert.equal(recordTurnActionWindowCardPlay([closed], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0], closed);
});

void test('whole No retains its auction Karama cap until source close and rejects a later correlated payment atomically', () => {
  const no = windowed(windowCard('karamaAuction'), false);
  assert.throws(() => recordTurnActionWindowCardPlay([no], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1'), TurnActionError);
  assert.equal(no.windowCards!.karamaAuction!.played, false);
  assert.equal(closeTurnActionWindowCardPlay([no], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:2')[0], no);
  assert.equal(closeTurnActionPayments([no], 'respondent', 1)[0].fulfilled, false);
  const closed = closeTurnActionWindowCardPlay([no], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0];
  assert.equal(closed.fulfilled, true);
  assert.equal(recordTurnActionWindowCardPlay([closed], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0], closed);
  const correlated = windowed(group('and', windowCard('karamaAuction'), pay()), false, 'turn-action:2');
  const played = recordTurnActionWindowCardPlay([correlated], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1');
  assert.equal(played[0].fulfilled, false);
  assert.equal(recordTurnActionWindowCardPlay(played, 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1')[0], played[0]);
  assert.throws(() => recordTurnActionPayment(played, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(played[0].payments, []);
  validateTurnActionPromises([closed], seats);
});

void test('closing the auction role preserves a later payment alternative and full expiry includes the new stage', () => {
  const alternative = windowed(group('or', windowCard('karamaAuction'), pay()));
  const closed = closeTurnActionWindowCardPlay([alternative], 'respondent', 1, 'karamaAuction', 'ordinary-auction:1:1');
  assert.deepEqual(branches(closed[0]), [[signedPay()]]);
  assert.equal(closed[0].paymentClosed, false);
  assert.equal(recordTurnActionPayment(closed, 'respondent', 1, payment())[0].fulfilled, true);
  const no = windowed(windowCard('karamaAuction'), false, 'turn-action:2');
  const finished = finishTurnActionTurn([no], 'respondent', 1)[0];
  assert.deepEqual(finished.windowCards!.karamaAuction, { source: 'ordinary-auction:1:1', played: false, closed: true });
  assert.equal(finished.fulfilled, true);
  validateTurnActionPromises([finished], seats);
  const wrongStage = { ...alternative, windowCards: { karamaAuction: { source: 'ordinary-auction:1:2', played: false, closed: false } } };
  assert.throws(() => turnActionValue(wrongStage), TurnActionError);
  assert.throws(() => turnActionValue(windowed(group('or', windowCard('karamaAuction'),
    windowCard('karamaAuction', 'ordinary-auction:1:2')))), TurnActionError);
});

void test('shipment-price receipt records the actual printed grant without requiring use and keeps whole transport correlation', () => {
  const source = windowSource('karamaShipment');
  const grantOnly = windowed(windowCard('karamaShipment'));
  const joint = windowed(group('and', windowCard('karamaShipment'), travel('ship'), pay()), true, 'turn-action:2');
  const granted = recordTurnActionWindowCardPlay([grantOnly, joint], 'respondent', 1, 'karamaShipment', source);
  assert.equal(granted[0].fulfilled, true, 'The accepted price grant counts even if its beneficiary never ships');
  assert.deepEqual(branches(granted[1]), [[signedTravel('ship'), signedPay()]]);
  const shipped = recordTurnActionShipment(granted, 'respondent', 1, event());
  assert.deepEqual(branches(shipped[1]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(shipped, 'respondent', 1, payment())[1].fulfilled, true);
  assert.equal(joint.windowCards!.karamaShipment!.played, false);
  validateTurnActionPromises(granted, seats);
});

void test('shipment-price No remains attached to its original recipient while another recipient has a compatible live interval', () => {
  const first = windowSource('karamaShipment');
  const later = JSON.stringify(['karamaShipment', 1, 'other', 'original']);
  const no = windowed(windowCard('karamaShipment', first), false);
  const yes = windowed(group('or', windowCard('karamaShipment', later), pay()), true, 'turn-action:2');
  const granted = recordTurnActionWindowCardPlay([no, yes], 'respondent', 1, 'karamaShipment', later);
  assert.equal(granted[0], no);
  assert.equal(granted[1].fulfilled, true);
  assert.throws(() => recordTurnActionWindowCardPlay(granted, 'respondent', 1, 'karamaShipment', first), TurnActionError);
  assert.equal(no.windowCards!.karamaShipment!.played, false);
  const cunning = JSON.stringify(['karamaShipment', 1, 'recipient', 'cunning', 'cunning:1']);
  assert.equal(recordTurnActionWindowCardPlay(granted, 'respondent', 1, 'karamaShipment', cunning)[0], no);
  assert.equal(closeTurnActionWindowCardPlay(granted, 'respondent', 1, 'karamaShipment', later)[0], no);
  const closed = closeTurnActionWindowCardPlay(granted, 'respondent', 1, 'karamaShipment', first);
  assert.equal(closed[0].fulfilled, true);
  assert.equal(closed[1], granted[1]);
  validateTurnActionPromises(closed, seats);
});

void test('closing a shipment-price opportunity retains actual play and later whole payment alternatives through turn expiry', () => {
  const source = windowSource('karamaShipment');
  const yes = windowed(group('and', windowCard('karamaShipment'), pay()));
  const no = windowed(group('and', windowCard('karamaShipment'), pay()), false, 'turn-action:2');
  const granted = recordTurnActionWindowCardPlay([yes, no], 'respondent', 1, 'karamaShipment', source);
  const closed = closeTurnActionWindowCardPlay(granted, 'respondent', 1, 'karamaShipment', source);
  assert.deepEqual(closed[0].windowCards!.karamaShipment, { source, played: true, closed: true });
  assert.deepEqual(branches(closed[0]), [[signedPay()]]);
  assert.equal(closed[1].fulfilled, false);
  assert.throws(() => recordTurnActionPayment(closed, 'respondent', 1, payment()), TurnActionError);
  assert.equal(recordTurnActionPayment([closed[0]], 'respondent', 1, payment())[0].fulfilled, true);
  const alternative = windowed(group('or', windowCard('karamaShipment'), pay()), true, 'turn-action:3');
  const absent = closeTurnActionWindowCardPlay([alternative], 'respondent', 1, 'karamaShipment', source);
  assert.deepEqual(branches(absent[0]), [[signedPay()]]);
  const expired = finishTurnActionTurn([no], 'respondent', 1)[0];
  assert.equal(expired.fulfilled, true);
  assert.deepEqual(expired.windowCards!.karamaShipment, { source, played: false, closed: true });
  validateTurnActionPromises([expired], seats);
});

void test('Thumper receipt means accepted printed play after this answer and carries no worm result or chosen destination', () => {
  const original = windowed(windowCard('thumper'));
  const leaf = { kind: 'windowCardPlay', effect: 'thumper', source: 'first-spice-reveal:1' };
  for (const extra of [{ worm: true }, { territory: 'carthag' }, { suppressed: true }, { card: 'physical-thumper' }])
    assert.throws(() => parseTurnActionLeaf({ ...leaf, ...extra }), TurnActionError);
  const played = recordTurnActionWindowCardPlay([original], 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0];
  assert.equal(played.fulfilled, true, 'No worm effect or successful outcome is part of the receipt');
  assert.equal(original.windowCards!.thumper!.played, false);
  const fresh = windowed(windowCard('thumper'), true, 'turn-action:2');
  assert.equal(fresh.windowCards!.thumper!.played, false);
  assert.equal(closeTurnActionWindowCardPlay([fresh], 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0].fulfilled, false);
  assert.equal(recordTurnActionWindowCardPlay([played], 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0], played);
  validateTurnActionPromises([played], seats);
});

void test('Thumper No binds only the exact actor turn and original first reveal until actual source closure', () => {
  const no = windowed(windowCard('thumper'), false);
  for (const [player, turn, source] of [['other', 1, 'first-spice-reveal:1'],
    ['respondent', 2, 'first-spice-reveal:1'], ['respondent', 1, 'first-spice-reveal:2']] as const) {
    assert.equal(recordTurnActionWindowCardPlay([no], player, turn, 'thumper', source)[0], no);
    assert.equal(closeTurnActionWindowCardPlay([no], player, turn, 'thumper', source)[0], no);
  }
  assert.equal(closeTurnActionPayments([no], 'respondent', 1)[0].fulfilled, false);
  assert.throws(() => recordTurnActionWindowCardPlay([no], 'respondent', 1, 'thumper', 'first-spice-reveal:1'), TurnActionError);
  assert.equal(no.windowCards!.thumper!.played, false);
  const closed = closeTurnActionWindowCardPlay([no], 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0];
  assert.equal(closed.fulfilled, true);
  assert.equal(recordTurnActionWindowCardPlay([closed], 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0], closed);
  validateTurnActionPromises([closed], seats);
});

void test('Thumper whole AND No and OR Yes retain their later payment correlation after first-reveal closure', () => {
  const no = windowed(group('and', windowCard('thumper'), pay()), false);
  const granted = recordTurnActionWindowCardPlay([no], 'respondent', 1, 'thumper', 'first-spice-reveal:1');
  const closed = closeTurnActionWindowCardPlay(granted, 'respondent', 1, 'thumper', 'first-spice-reveal:1');
  assert.equal(closed[0].fulfilled, false);
  assert.deepEqual(branches(closed[0]), [[signedPay('recipient', 3, 0, false)]]);
  assert.throws(() => recordTurnActionPayment(closed, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(closed[0].payments, []);
  const expiry = finishTurnActionTurn(closed, 'respondent', 1)[0];
  assert.equal(expiry.fulfilled, true);
  const alternative = windowed(group('or', windowCard('thumper'), pay()), true, 'turn-action:2');
  const absent = closeTurnActionWindowCardPlay([alternative], 'respondent', 1, 'thumper', 'first-spice-reveal:1');
  assert.deepEqual(branches(absent[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(absent, 'respondent', 1, payment())[0].fulfilled, true);
  const and = windowed(group('and', windowCard('thumper'), pay()), true, 'turn-action:3');
  const paid = recordTurnActionPayment([and], 'respondent', 1, payment());
  assert.equal(paid[0].fulfilled, false);
  assert.equal(recordTurnActionWindowCardPlay(paid, 'respondent', 1, 'thumper', 'first-spice-reveal:1')[0].fulfilled, true);
  validateTurnActionPromises([expiry], seats);
});

void test('Amal No caps actual printed cost in only the original answer interval and preserves whole No payment correlation', () => {
  const source = windowSource('amal'), no = windowed(windowCard('amal'), false);
  for (const [player, turn, opening] of [['other', 1, source], ['respondent', 2, source],
    ['respondent', 1, 'phase-opening:1:3']] as const) {
    assert.equal(recordTurnActionWindowCardPlay([no], player, turn, 'amal', opening)[0], no);
    assert.equal(closeTurnActionWindowCardPlay([no], player, turn, 'amal', opening)[0], no);
  }
  assert.throws(() => recordTurnActionWindowCardPlay([no], 'respondent', 1, 'amal', source), TurnActionError);
  assert.equal(no.windowCards!.amal!.played, false);
  const closed = closeTurnActionWindowCardPlay([no], 'respondent', 1, 'amal', source)[0];
  assert.equal(closed.fulfilled, true);
  assert.equal(recordTurnActionWindowCardPlay([closed], 'respondent', 1, 'amal', source)[0], closed);
  const wholeNo = windowed(group('and', windowCard('amal'), pay()), false, 'turn-action:2');
  const played = recordTurnActionWindowCardPlay([wholeNo], 'respondent', 1, 'amal', source);
  assert.equal(played[0].fulfilled, false);
  const later = closeTurnActionWindowCardPlay(played, 'respondent', 1, 'amal', source);
  assert.deepEqual(branches(later[0]), [[signedPay('recipient', 3, 0, false)]]);
  assert.throws(() => recordTurnActionPayment(later, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(later[0].payments, []);
  assert.equal(finishTurnActionTurn(later, 'respondent', 1)[0].fulfilled, true);
  validateTurnActionPromises([closed], seats);
});

void test('Amal whole AND and OR keep printed receipt and later payment alternatives without storing a halving choice', () => {
  const source = windowSource('amal');
  const and = windowed(group('and', windowCard('amal'), pay()));
  const or = windowed(group('or', windowCard('amal'), pay()), true, 'turn-action:2');
  for (const extra of [{ amount: 3 }, { target: 'recipient' }, { half: 2 }, { card: 'physical-amal' }])
    assert.throws(() => parseTurnActionLeaf({ kind: 'windowCardPlay', effect: 'amal', source, ...extra }), TurnActionError);
  const played = recordTurnActionWindowCardPlay([and, or], 'respondent', 1, 'amal', source);
  assert.deepEqual(branches(played[0]), [[signedPay()]]);
  assert.equal(played[1].fulfilled, true);
  const closed = closeTurnActionWindowCardPlay(played, 'respondent', 1, 'amal', source);
  assert.equal(closed[1], played[1]);
  assert.equal(recordTurnActionPayment(closed, 'respondent', 1, payment())[0].fulfilled, true);
  const missed = closeTurnActionWindowCardPlay([or], 'respondent', 1, 'amal', source);
  assert.deepEqual(branches(missed[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(missed, 'respondent', 1, payment())[0].fulfilled, true);
  const no = windowed(windowCard('amal'), false, 'turn-action:3');
  const expired = finishTurnActionTurn([no], 'respondent', 1)[0];
  assert.deepEqual(expired.windowCards!.amal, { source, played: false, closed: true });
  assert.equal(expired.fulfilled, true);
  validateTurnActionPromises([expired], seats);
});

void test('Box AND and OR branches count only an actual future printed activation in each answer interval', () => {
  const original = cards(group('and', card('nullentropyBox'), card('ghola'), pay()));
  const alternative = cards(group('or', card('nullentropyBox'), pay()), true, 'turn-action:2');
  const signed = { kind: 'cardPlay', effect: 'nullentropyBox', answer: true };
  assert.deepEqual(branches(original), [[signed, { kind: 'cardPlay', effect: 'ghola', answer: true }, signedPay()]]);
  for (const [player, turn] of [['other', 1], ['respondent', 2]] as const)
    assert.equal(recordTurnActionCardPlay([original], player, turn, 'nullentropyBox')[0], original);
  const used = recordTurnActionCardPlay([original, alternative], 'respondent', 1, 'nullentropyBox');
  assert.deepEqual(branches(used[0]), [[{ kind: 'cardPlay', effect: 'ghola', answer: true }, signedPay()]]);
  assert.equal(used[1].fulfilled, true);
  const fresh = cards(card('nullentropyBox'), true, 'turn-action:3');
  assert.equal(fresh.cardPlays!.nullentropyBox!.played, false, 'An earlier accepted play or later recovery is not a future receipt');
  const replay = recordTurnActionCardPlay([used[0], fresh], 'respondent', 1, 'nullentropyBox');
  assert.equal(replay[0], used[0]);
  assert.equal(replay[1].fulfilled, true);
  assert.equal(original.cardPlays!.nullentropyBox!.played, false);
  const ghola = recordTurnActionCardPlay([used[0]], 'respondent', 1, 'ghola');
  assert.equal(recordTurnActionPayment(ghola, 'respondent', 1, payment())[0].fulfilled, true);
  validateTurnActionPromises(used, seats);
});

void test('Box No remains binding through transport and payment closure and settles only at the turn deadline', () => {
  const no = cards(card('nullentropyBox'), false);
  const moved = closeTurnActionTransport([no], 'respondent', 1);
  assert.deepEqual(moved[0].cardPlays!.nullentropyBox, { played: false, closed: false });
  const unpaid = closeTurnActionPayments(moved, 'respondent', 1);
  assert.equal(unpaid[0].fulfilled, false);
  assert.throws(() => recordTurnActionCardPlay(unpaid, 'respondent', 1, 'nullentropyBox'), TurnActionError);
  assert.equal(unpaid[0].cardPlays!.nullentropyBox!.played, false);
  const expired = finishTurnActionTurn(unpaid, 'respondent', 1)[0];
  assert.equal(expired.fulfilled, true);
  assert.deepEqual(expired.cardPlays!.nullentropyBox, { played: false, closed: true });
  assert.equal(recordTurnActionCardPlay([expired], 'respondent', 1, 'nullentropyBox')[0], expired);
  const wholeNo = cards(group('and', card('nullentropyBox'), pay()), false, 'turn-action:2');
  const used = recordTurnActionCardPlay([wholeNo], 'respondent', 1, 'nullentropyBox');
  assert.throws(() => recordTurnActionPayment(used, 'respondent', 1, payment()), TurnActionError);
  assert.deepEqual(used[0].payments, []);
  const yes = cards(card('nullentropyBox'), true, 'turn-action:3');
  assert.equal(finishTurnActionTurn([yes], 'respondent', 1)[0].released, true);
  validateTurnActionPromises([expired], seats);
});

void test('optional Box stage preserves legacy bytes and strict raw folded metadata without recording a selected card', () => {
  const old = cards(card('ghola'), false);
  const before = JSON.stringify(old);
  const unchanged = recordTurnActionCardPlay([old], 'respondent', 1, 'nullentropyBox')[0];
  assert.equal(unchanged, old);
  assert.equal(JSON.stringify(unchanged), before);
  assert.equal(Object.hasOwn(closeTurnActionTransport([old], 'respondent', 1)[0].cardPlays!, 'nullentropyBox'), false);
  assert.equal(Object.hasOwn(finishTurnActionTurn([old], 'respondent', 1)[0].cardPlays!, 'nullentropyBox'), false);
  const row = cards(group('or', fact(), card('nullentropyBox')));
  const stage = row.cardPlays!.nullentropyBox!;
  for (const value of [undefined, null, { ...stage, selected: 'physical-recovered-card' },
    { ...stage, cost: 2 }, { ...stage, played: 1 }, { ...stage, closed: 'yes' }])
    assert.throws(() => turnActionValue({ ...row, cardPlays: { hajr: null, ghola: null,
      nullentropyBox: value } } as unknown as TurnActionPromise), TurnActionError);
  assert.throws(() => turnActionValue({ ...row, cardPlays: { hajr: null, ghola: null } }), TurnActionError);
  const optional = { ...old, cardPlays: { ...old.cardPlays!, nullentropyBox: null } };
  validateTurnActionPromises([optional], seats);
  for (const extra of [{ selected: 'Shield' }, { card: 'physical-box' }, { minimum: 2 }, { recipient: 'other' }])
    assert.throws(() => parseTurnActionLeaf({ kind: 'cardPlay', effect: 'nullentropyBox', ...extra }), TurnActionError);
});

void test('each optional printed stage subset preserves legacy and Box bytes while rejecting unknown choice metadata', () => {
  const base = cards(card('ghola'), false);
  const optional = ['nullentropyBox', 'distrans', 'juiceOfSapho'] as const;
  for (let mask = 0; mask < 8; mask++) {
    const cardPlays = { ...base.cardPlays! };
    optional.forEach((effect, index) => { if (mask & (1 << index)) cardPlays[effect] = null; });
    const row = { ...base, cardPlays }, before = JSON.stringify(row);
    validateTurnActionPromises([row], seats);
    assert.equal(recordTurnActionCardPlay([row], 'respondent', 1, 'distrans')[0], row);
    assert.equal(JSON.stringify(row), before);
    const closed = finishTurnActionTurn([row], 'respondent', 1)[0];
    assert.deepEqual(Object.keys(closed.cardPlays!).sort(), Object.keys(cardPlays).sort());
  }
  for (const effect of ['distrans', 'juiceOfSapho'] as const) {
    const row = cards(card(effect)), stage = row.cardPlays![effect]!;
    for (const extra of [{ recipient: 'other' }, { give: 'private-card' }, { scope: 'movement' }, { mode: 'last' }, { outcome: true }]) {
      assert.throws(() => parseTurnActionLeaf({ kind: 'cardPlay', effect, ...extra }), TurnActionError);
      const invalid = { ...row, cardPlays: { ...row.cardPlays!, [effect]: { ...stage, ...extra } } };
      assert.throws(() => turnActionValue(invalid), TurnActionError);
    }
  }
  const unsupported = { ...base, cardPlays: { ...base.cardPlays!, semutaDrug: null } } as TurnActionPromise;
  assert.throws(() => turnActionValue(unsupported), TurnActionError);
});

void test('Distrans and Sapho whole alternatives share only actual later native receipts without selecting a transfer or mode', () => {
  const joint = cards(group('and', card('distrans'), card('juiceOfSapho'), pay()));
  const alternative = cards(group('or', card('distrans'), card('juiceOfSapho')), true, 'turn-action:2');
  assert.deepEqual(branches(joint), [[{ kind: 'cardPlay', effect: 'distrans', answer: true },
    { kind: 'cardPlay', effect: 'juiceOfSapho', answer: true }, signedPay()]]);
  assert.equal(recordTurnActionCardPlay([joint], 'other', 1, 'distrans')[0], joint);
  assert.equal(recordTurnActionCardPlay([joint], 'respondent', 2, 'distrans')[0], joint);
  const transferred = recordTurnActionCardPlay([joint, alternative], 'respondent', 1, 'distrans');
  assert.equal(transferred[1].fulfilled, true);
  assert.deepEqual(branches(transferred[0]), [[{ kind: 'cardPlay', effect: 'juiceOfSapho', answer: true }, signedPay()]]);
  const used = recordTurnActionCardPlay(transferred, 'respondent', 1, 'juiceOfSapho');
  assert.deepEqual(branches(used[0]), [[signedPay()]]);
  assert.equal(recordTurnActionPayment(used, 'respondent', 1, payment())[0].fulfilled, true);
  const fresh = cards(card('distrans'), true, 'turn-action:3');
  assert.equal(fresh.cardPlays!.distrans!.played, false);
  const replay = recordTurnActionCardPlay([used[0], fresh], 'respondent', 1, 'distrans');
  assert.equal(replay[0], used[0]);
  assert.equal(replay[1].fulfilled, true);
  assert.equal(joint.cardPlays!.distrans!.played, false);
  validateTurnActionPromises(used, seats);
});

void test('Distrans and Sapho No retain turn deadlines through Movement and payment closure and fail atomically on actual use', () => {
  for (const effect of ['distrans', 'juiceOfSapho'] as const) {
    const yes = cards(group('and', card(effect), pay()));
    const no = cards(card(effect), false, 'turn-action:2');
    const before = structuredClone([yes, no]);
    assert.throws(() => recordTurnActionCardPlay([yes, no], 'respondent', 1, effect), TurnActionError);
    assert.deepEqual([yes, no], before);
    const transport = closeTurnActionTransport([no], 'respondent', 1);
    const closedPayments = closeTurnActionPayments(transport, 'respondent', 1);
    assert.deepEqual(closedPayments[0].cardPlays![effect], { played: false, closed: false });
    assert.equal(closedPayments[0].fulfilled, false);
    const expired = finishTurnActionTurn(closedPayments, 'respondent', 1)[0];
    assert.equal(expired.fulfilled, true);
    assert.deepEqual(expired.cardPlays![effect], { played: false, closed: true });
    assert.equal(recordTurnActionCardPlay([expired], 'respondent', 1, effect)[0], expired);
    assert.equal(finishTurnActionTurn([yes], 'respondent', 1)[0].released, true);
    const wholeNo = cards(group('and', card(effect), pay()), false, 'turn-action:3');
    const used = recordTurnActionCardPlay([wholeNo], 'respondent', 1, effect);
    assert.throws(() => recordTurnActionPayment(used, 'respondent', 1, payment()), TurnActionError);
    assert.deepEqual(used[0].payments, []);
    validateTurnActionPromises([expired], seats);
  }
});
