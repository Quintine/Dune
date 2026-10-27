import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMixedActionExpression, type MixedActionExpression } from '../game/mixed-action-question';
import {
  TurnActionError,
  parseTurnActionLeaf,
  recordTurnActionShipment,
  turnActionBranches,
  turnActionValue,
  validateTurnActionPromises,
  type TurnActionLeaf,
  type TurnActionPromise,
} from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
const ship = (sector?: number, minimum = 3, territory = 'wind_pass'): Expression => ({
  kind: 'action', action: { kind: 'ship', territory, minimum, ...(sector === undefined ? {} : { sector }) },
});
const group = (kind: 'and' | 'or', ...terms: Expression[]): Expression => ({ kind, terms });
function promise(mixed: Expression, answer = true): TurnActionPromise {
  return {
    turn: 1, mixed, event: 'whole:1', player: 'p', asker: 'a', answer,
    compiled: compileMixedActionExpression(mixed, () => 'yes', answer),
    shipment: { pending: true, event: null }, progress: [], payments: [],
    transportClosed: false, paymentClosed: false, fulfilled: false, released: false,
  };
}

void test('whole shipment atoms preserve exact printed sectors and reject invalid ones', () => {
  assert.deepEqual(parseTurnActionLeaf({ kind: 'ship', territory: 'wind_pass', minimum: 3, sector: 15 }),
    { kind: 'ship', territory: 'wind_pass', minimum: 3, sector: 15 });
  for (const input of [
    { kind: 'ship', territory: 'wind_pass', minimum: 3, sector: 4 },
    { kind: 'ship', territory: 'wind_pass', minimum: 3, sector: 15.5 },
    { kind: 'move', territory: 'wind_pass', minimum: 3, sector: 15 },
    { kind: 'ship', territory: 'wind_pass', minimum: 3, sector: null },
  ]) assert.throws(() => parseTurnActionLeaf(input), TurnActionError);
});

void test('one actual matching sector fulfills the signed Yes or rejects the signed No', () => {
  const exact = promise(ship(15));
  const [done] = recordTurnActionShipment([exact], 'p', 1, { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.deepEqual(done.shipment.event, { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.equal(done.fulfilled, true);
  assert.equal(turnActionValue(done), true);
  validateTurnActionPromises([done], ['p', 'a']);
  assert.throws(() => recordTurnActionShipment([promise(ship(15), false)], 'p', 1,
    { territory: 'wind_pass', sector: 15, amount: 3 }), TurnActionError);
  const [other] = recordTurnActionShipment([promise(ship(15), false)], 'p', 1,
    { territory: 'wind_pass', sector: 14, amount: 3 });
  assert.equal(other.fulfilled, true);
  assert.equal(turnActionValue(other), false);
  const [unknown] = recordTurnActionShipment([promise(ship(15), false)], 'p', 1,
    { territory: 'wind_pass', amount: 3 });
  assert.equal(turnActionValue(unknown), false);
});

void test('sector and territory-wide atom identity remain distinct across AND and OR', () => {
  const broad = ship(), exact14 = ship(14), exact15 = ship(15);
  const alternatives = promise(group('or', broad, exact14));
  validateTurnActionPromises([alternatives], ['p', 'a']);
  const branches = [...turnActionBranches(alternatives)];
  assert.equal(branches.length, 2);
  assert.ok(branches.some(row => row.some(leaf => leaf.kind === 'ship' && leaf.sector === undefined)));
  assert.ok(branches.some(row => row.some(leaf => leaf.kind === 'ship' && leaf.sector === 14)));
  assert.deepEqual([...turnActionBranches(promise(group('and', exact14, exact15)))], []);
  assert.equal([...turnActionBranches(promise(group('and', broad, exact14)))].length, 1);
  const [done] = recordTurnActionShipment([alternatives], 'p', 1, { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.equal(done.fulfilled, true);
});

void test('mixed exact and broad receipts retain one real event without changing legacy bytes', () => {
  const legacy = promise(ship());
  const [legacyDone] = recordTurnActionShipment([legacy], 'p', 1, { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.deepEqual(legacyDone.shipment.event, { territory: 'wind_pass', amount: 3 });
  assert.equal(JSON.stringify(legacyDone.shipment.event), '{"territory":"wind_pass","amount":3}');
  validateTurnActionPromises([legacyDone], ['p', 'a']);
  const row = promise(group('or', ship(), ship(14)));
  const [done] = recordTurnActionShipment([row], 'p', 1, { territory: 'wind_pass', sector: 15, amount: 3 });
  assert.deepEqual(done.shipment.event, { territory: 'wind_pass', amount: 3, sector: 15 });
  validateTurnActionPromises([done], ['p', 'a']);
  assert.throws(() => recordTurnActionShipment([promise(ship(14))], 'p', 1,
    { territory: 'wind_pass', sector: 19, amount: 3 }), TurnActionError);
});
