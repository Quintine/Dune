import test from 'node:test';
import assert from 'node:assert/strict';
import { adminClosureConfirmation, adminClosureResponse, clearAdminClosureRequest, newAdminClosureRequest, readAdminClosureRequest, saveAdminClosureRequest } from '../lib/admin-closure-client';
import { retainAdminRoomRequest } from '../lib/admin-room-control-client';
import { ClientRequestError } from '../lib/client-request';
import type { AdminClosureView } from '../lib/admin-closure';

const view = (): AdminClosureView => ({ code: 'ABCD2345', version: 7, closed: false, removed: false, revision: 2, closedAt: null, updatedAt: null, paused: false, joinLocked: true });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

void test('closure retry preserves exact intent/version/revision/reason across refresh and isolates account and room', () => {
  const tab = storage(), room = view(), input = newAdminClosureRequest(room, true, '  QA closure  ');
  saveAdminClosureRequest(tab, 'a', room.code, input);
  assert.deepEqual(readAdminClosureRequest(tab, 'a', room.code), input);
  assert.equal(input.expectedVersion, 7); assert.equal(input.expectedRevision, 2); assert.equal(input.reason, 'QA closure');
  assert.equal(readAdminClosureRequest(tab, 'b', room.code), null);
  assert.equal(readAdminClosureRequest(tab, 'a', 'DIFF2345'), null);
  for (const change of [{ operationId: crypto.randomUUID() }, { expectedVersion: 8 }, { expectedRevision: 3 }, { reason: 'Different' }, { closed: false }])
    assert.throws(() => saveAdminClosureRequest(tab, 'a', room.code, { ...input, ...change }), /Resolve the saved/);
  saveAdminClosureRequest(tab, 'a', room.code, input);
  clearAdminClosureRequest(tab, 'a', room.code);
  assert.equal(readAdminClosureRequest(tab, 'a', room.code), null);
  const reopen = newAdminClosureRequest({ ...room, closed: true, version: 8, revision: 3 }, false, 'Restore');
  saveAdminClosureRequest(tab, 'a', room.code, reopen);
  assert.deepEqual(readAdminClosureRequest(tab, 'a', room.code), reopen);
});

void test('corrupt or unwritable closure retry storage fails closed and never replaces the saved record', () => {
  const tab = storage(), room = view(), input = newAdminClosureRequest(room, true, 'QA');
  assert.throws(() => saveAdminClosureRequest({ ...tab, setItem() {} }, 'a', room.code, input), /Nothing was sent/);
  saveAdminClosureRequest(tab, 'a', room.code, input);
  const key = [...tab.values.keys()][0];
  for (const raw of ['{broken', JSON.stringify({ ...input, sessionToken: 'secret' }), JSON.stringify({ ...input, expectedRevision: -1 }), ' '.repeat(2049)]) {
    tab.values.set(key, raw);
    assert.throws(() => readAdminClosureRequest(tab, 'a', room.code), /unreadable/);
    assert.throws(() => saveAdminClosureRequest(tab, 'a', room.code, input), /unreadable/);
    assert.equal(tab.values.get(key), raw);
  }
  assert.throws(() => clearAdminClosureRequest({ ...tab, removeItem() {} }, 'a', room.code), /could not be cleared/);
  clearAdminClosureRequest(tab, 'a', room.code);
  for (const reason of [' ', 'a'.repeat(301), 'two\nlines', 'bad\u007freason'])
    assert.throws(() => newAdminClosureRequest(room, true, reason));
  assert.throws(() => newAdminClosureRequest(room, false, 'No change'));
  assert.throws(() => newAdminClosureRequest({ ...room, removed: true }, true, 'Removed'), /Restore/);
  assert.throws(() => newAdminClosureRequest({ ...room, revision: Number.MAX_SAFE_INTEGER }, true, 'Overflow'));
});

void test('confirmation binds exact operation and both applied versions while replay accepts later current availability', () => {
  const room = view(), input = newAdminClosureRequest(room, true, 'QA');
  const current = { ...room, version: 12, revision: 4, closed: false, removed: false, closedAt: 100, updatedAt: 200, paused: true };
  const receipt = { operationId: input.operationId, appliedVersion: 8, appliedRevision: 3, replayed: true, room: current };
  assert.deepEqual(adminClosureConfirmation(receipt, room.code, input), receipt);
  const fresh = { ...receipt, replayed: false, room: { ...room, version: 8, revision: 3, closed: true, closedAt: 100, updatedAt: 100 } };
  assert.deepEqual(adminClosureConfirmation(fresh, room.code, input), fresh);
  for (const invalid of [{ ...receipt, operationId: crypto.randomUUID() }, { ...receipt, appliedVersion: 9 }, { ...receipt, appliedRevision: 4 },
    { ...receipt, room: { ...current, version: 7 } }, { ...receipt, room: { ...current, revision: 2 } },
    { ...receipt, room: { ...current, code: 'DIFF2345' } }, { ...receipt, sessionToken: 'secret' }, { ...receipt, replayed: undefined }])
    assert.throws(() => adminClosureConfirmation(invalid, room.code, input));
});

void test('room availability projection excludes private data and rejects malformed metadata', () => {
  const room = view();
  assert.deepEqual(adminClosureResponse(room, room.code), room);
  assert.doesNotThrow(() => adminClosureResponse({ ...room, closed: true, closedAt: 100, updatedAt: 100 }, room.code));
  for (const invalid of [null, [], { ...room, state: {} }, { ...room, reason: 'Private audit' }, { ...room, seats: [] },
    { ...room, version: 1.5 }, { ...room, revision: -1 }, { ...room, code: 'bad code' }, { ...room, closed: 'true' },
    { ...room, closedAt: -1 }, { ...room, closedAt: Number.MAX_SAFE_INTEGER }, { ...room, updatedAt: '100' },
    { ...room, paused: undefined }, { ...room, joinLocked: null }])
    assert.throws(() => adminClosureResponse(invalid, room.code));
});

void test('uncertain closure and changed-access responses keep the exact saved request', () => {
  const tab = storage(), room = view(), input = newAdminClosureRequest(room, true, 'QA');
  saveAdminClosureRequest(tab, 'a', room.code, input);
  for (const error of [new ClientRequestError('Offline', 'network'), new ClientRequestError('Timeout', 'timeout'),
    new ClientRequestError('Unreadable', 'invalid-response', 200), ...[401, 403, 408, 500, 502, 503].map(status => new ClientRequestError('Unavailable', 'http', status)), new Error('Wrong confirmation')]) {
    if (!retainAdminRoomRequest(error)) clearAdminClosureRequest(tab, 'a', room.code);
    assert.deepEqual(readAdminClosureRequest(tab, 'a', room.code), input);
  }
  for (const status of [400, 404, 409, 422]) assert.equal(retainAdminRoomRequest(new ClientRequestError('Rejected', 'http', status)), false);
});
