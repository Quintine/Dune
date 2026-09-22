import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRemovalConfirmation, adminRemovalResponse, clearAdminRemovalRequest, newAdminRemovalRequest, readAdminRemovalRequest, saveAdminRemovalRequest } from '../lib/admin-removal-client';
import { retainAdminRoomRequest } from '../lib/admin-room-control-client';
import { ClientRequestError } from '../lib/client-request';
import type { AdminRemovalView } from '../lib/admin-removal';

const view = (): AdminRemovalView => ({ code: 'ABCD2345', version: 7, removed: false, revision: 2, removedAt: null, updatedAt: null, paused: false, joinLocked: true });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

void test('removal retry preserves exact intent/version/revision/reason across refresh and isolates account and room', () => {
  const tab = storage(), room = view(), input = newAdminRemovalRequest(room, true, '  QA removal  ');
  saveAdminRemovalRequest(tab, 'a', room.code, input);
  assert.deepEqual(readAdminRemovalRequest(tab, 'a', room.code), input);
  assert.equal(input.expectedVersion, 7); assert.equal(input.expectedRevision, 2); assert.equal(input.reason, 'QA removal');
  assert.equal(readAdminRemovalRequest(tab, 'b', room.code), null);
  assert.equal(readAdminRemovalRequest(tab, 'a', 'DIFF2345'), null);
  for (const change of [{ operationId: crypto.randomUUID() }, { expectedVersion: 8 }, { expectedRevision: 3 }, { reason: 'Different' }, { removed: false }])
    assert.throws(() => saveAdminRemovalRequest(tab, 'a', room.code, { ...input, ...change }), /Resolve the saved/);
  saveAdminRemovalRequest(tab, 'a', room.code, input);
  clearAdminRemovalRequest(tab, 'a', room.code);
  assert.equal(readAdminRemovalRequest(tab, 'a', room.code), null);
  const restore = newAdminRemovalRequest({ ...room, removed: true, version: 8, revision: 3 }, false, 'Restore');
  saveAdminRemovalRequest(tab, 'a', room.code, restore);
  assert.deepEqual(readAdminRemovalRequest(tab, 'a', room.code), restore);
});

void test('corrupt or unwritable removal retry storage fails closed and never replaces the saved record', () => {
  const tab = storage(), room = view(), input = newAdminRemovalRequest(room, true, 'QA');
  assert.throws(() => saveAdminRemovalRequest({ ...tab, setItem() {} }, 'a', room.code, input), /Nothing was sent/);
  saveAdminRemovalRequest(tab, 'a', room.code, input);
  const key = [...tab.values.keys()][0];
  for (const raw of ['{broken', JSON.stringify({ ...input, sessionToken: 'secret' }), JSON.stringify({ ...input, expectedRevision: -1 }), ' '.repeat(2049)]) {
    tab.values.set(key, raw);
    assert.throws(() => readAdminRemovalRequest(tab, 'a', room.code), /unreadable/);
    assert.throws(() => saveAdminRemovalRequest(tab, 'a', room.code, input), /unreadable/);
    assert.equal(tab.values.get(key), raw);
  }
  assert.throws(() => clearAdminRemovalRequest({ ...tab, removeItem() {} }, 'a', room.code), /could not be cleared/);
  clearAdminRemovalRequest(tab, 'a', room.code);
  for (const reason of [' ', 'a'.repeat(301), 'two\nlines', 'bad\u007freason'])
    assert.throws(() => newAdminRemovalRequest(room, true, reason));
  assert.throws(() => newAdminRemovalRequest(room, false, 'No change'));
  assert.throws(() => newAdminRemovalRequest({ ...room, revision: Number.MAX_SAFE_INTEGER }, true, 'Overflow'));
});

void test('confirmation binds exact operation and both applied versions while replay accepts later current availability', () => {
  const room = view(), input = newAdminRemovalRequest(room, true, 'QA');
  const current = { ...room, version: 12, revision: 4, removed: false, removedAt: 100, updatedAt: 200, paused: true };
  const receipt = { operationId: input.operationId, appliedVersion: 8, appliedRevision: 3, replayed: true, room: current };
  assert.deepEqual(adminRemovalConfirmation(receipt, room.code, input), receipt);
  const fresh = { ...receipt, replayed: false, room: { ...room, version: 8, revision: 3, removed: true, removedAt: 100, updatedAt: 100 } };
  assert.deepEqual(adminRemovalConfirmation(fresh, room.code, input), fresh);
  for (const invalid of [{ ...receipt, operationId: crypto.randomUUID() }, { ...receipt, appliedVersion: 9 }, { ...receipt, appliedRevision: 4 },
    { ...receipt, room: { ...current, version: 7 } }, { ...receipt, room: { ...current, revision: 2 } },
    { ...receipt, room: { ...current, code: 'DIFF2345' } }, { ...receipt, sessionToken: 'secret' }, { ...receipt, replayed: undefined }])
    assert.throws(() => adminRemovalConfirmation(invalid, room.code, input));
});

void test('room availability projection excludes private data and rejects malformed metadata', () => {
  const room = view();
  assert.deepEqual(adminRemovalResponse(room, room.code), room);
  assert.doesNotThrow(() => adminRemovalResponse({ ...room, removed: true, removedAt: 100, updatedAt: 100 }, room.code));
  for (const invalid of [null, [], { ...room, state: {} }, { ...room, reason: 'Private audit' }, { ...room, seats: [] },
    { ...room, version: 1.5 }, { ...room, revision: -1 }, { ...room, code: 'bad code' }, { ...room, removed: 'true' },
    { ...room, removedAt: -1 }, { ...room, removedAt: Number.MAX_SAFE_INTEGER }, { ...room, updatedAt: '100' },
    { ...room, paused: undefined }, { ...room, joinLocked: null }])
    assert.throws(() => adminRemovalResponse(invalid, room.code));
});

void test('uncertain removal and changed-access responses keep the exact saved request', () => {
  const tab = storage(), room = view(), input = newAdminRemovalRequest(room, true, 'QA');
  saveAdminRemovalRequest(tab, 'a', room.code, input);
  for (const error of [new ClientRequestError('Offline', 'network'), new ClientRequestError('Timeout', 'timeout'),
    new ClientRequestError('Unreadable', 'invalid-response', 200), ...[401, 403, 408, 500, 502, 503].map(status => new ClientRequestError('Unavailable', 'http', status)), new Error('Wrong confirmation')]) {
    if (!retainAdminRoomRequest(error)) clearAdminRemovalRequest(tab, 'a', room.code);
    assert.deepEqual(readAdminRemovalRequest(tab, 'a', room.code), input);
  }
  for (const status of [400, 404, 409, 422]) assert.equal(retainAdminRoomRequest(new ClientRequestError('Rejected', 'http', status)), false);
});

void test('removal projections and exact receipts retain only the explicit archived flag', () => {
  const room = view(), input = newAdminRemovalRequest(room, true, 'QA');
  assert.deepEqual(adminRemovalResponse({ ...room, archived: true }, room.code), { ...room, archived: true });
  for (const archived of [false, undefined, null, 1, 'true'])
    assert.throws(() => adminRemovalResponse({ ...room, archived }, room.code));
  const receipt = { operationId: input.operationId, appliedVersion: 8, appliedRevision: 3, replayed: true, room: { ...room, version: 12, revision: 4, archived: true } };
  assert.deepEqual(adminRemovalConfirmation(receipt, room.code, input), receipt);
});
