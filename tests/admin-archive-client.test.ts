import test from 'node:test';
import assert from 'node:assert/strict';
import { adminArchiveConfirmation, adminArchiveResponse, clearAdminArchiveRequest, newAdminArchiveRequest, readAdminArchiveRequest, saveAdminArchiveRequest } from '../lib/admin-archive-client';
import { retainAdminRoomRequest } from '../lib/admin-room-control-client';
import { ClientRequestError } from '../lib/client-request';
import type { AdminArchiveView } from '../lib/admin-archive';

const view = (): AdminArchiveView => ({ code: 'ABCD2345', version: 7, archived: false, closed: true, removed: false, revision: 2, archivedAt: null, updatedAt: null, paused: false, joinLocked: true });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

void test('archive retry preserves exact intent/version/revision/reason across refresh and isolates account and room', () => {
  const tab = storage(), room = view(), input = newAdminArchiveRequest(room, true, '  QA archive  ');
  saveAdminArchiveRequest(tab, 'a', room.code, input);
  assert.deepEqual(readAdminArchiveRequest(tab, 'a', room.code), input);
  assert.equal(input.expectedVersion, 7); assert.equal(input.expectedRevision, 2); assert.equal(input.reason, 'QA archive');
  assert.equal(readAdminArchiveRequest(tab, 'b', room.code), null);
  assert.equal(readAdminArchiveRequest(tab, 'a', 'DIFF2345'), null);
  for (const change of [{ operationId: crypto.randomUUID() }, { expectedVersion: 8 }, { expectedRevision: 3 }, { reason: 'Different' }, { archived: false }])
    assert.throws(() => saveAdminArchiveRequest(tab, 'a', room.code, { ...input, ...change }), /Resolve the saved/);
  saveAdminArchiveRequest(tab, 'a', room.code, input);
  clearAdminArchiveRequest(tab, 'a', room.code);
  assert.equal(readAdminArchiveRequest(tab, 'a', room.code), null);
  const reopen = newAdminArchiveRequest({ ...room, archived: true, version: 8, revision: 3 }, false, 'Restore');
  saveAdminArchiveRequest(tab, 'a', room.code, reopen);
  assert.deepEqual(readAdminArchiveRequest(tab, 'a', room.code), reopen);
});

void test('corrupt or unwritable archive retry storage fails closed and never replaces the saved record', () => {
  const tab = storage(), room = view(), input = newAdminArchiveRequest(room, true, 'QA');
  assert.throws(() => saveAdminArchiveRequest({ ...tab, setItem() {} }, 'a', room.code, input), /Nothing was sent/);
  saveAdminArchiveRequest(tab, 'a', room.code, input);
  const key = [...tab.values.keys()][0];
  for (const raw of ['{broken', JSON.stringify({ ...input, sessionToken: 'secret' }), JSON.stringify({ ...input, expectedRevision: -1 }), ' '.repeat(2049)]) {
    tab.values.set(key, raw);
    assert.throws(() => readAdminArchiveRequest(tab, 'a', room.code), /unreadable/);
    assert.throws(() => saveAdminArchiveRequest(tab, 'a', room.code, input), /unreadable/);
    assert.equal(tab.values.get(key), raw);
  }
  assert.throws(() => clearAdminArchiveRequest({ ...tab, removeItem() {} }, 'a', room.code), /could not be cleared/);
  clearAdminArchiveRequest(tab, 'a', room.code);
  for (const reason of [' ', 'a'.repeat(301), 'two\nlines', 'bad\u007freason'])
    assert.throws(() => newAdminArchiveRequest(room, true, reason));
  assert.throws(() => newAdminArchiveRequest(room, false, 'No change'));
  assert.throws(() => newAdminArchiveRequest({ ...room, removed: true }, true, 'Removed'), /Restore/);
  assert.throws(() => newAdminArchiveRequest({ ...room, closed: false }, true, 'Open'), /Close/);
  assert.throws(() => newAdminArchiveRequest({ ...room, revision: Number.MAX_SAFE_INTEGER }, true, 'Overflow'));
});

void test('confirmation binds exact operation and both applied versions while replay accepts later current availability', () => {
  const room = view(), input = newAdminArchiveRequest(room, true, 'QA');
  const current = { ...room, version: 12, revision: 4, archived: false, closed: true, removed: false, archivedAt: 100, updatedAt: 200, paused: true };
  const receipt = { operationId: input.operationId, appliedVersion: 8, appliedRevision: 3, replayed: true, room: current };
  assert.deepEqual(adminArchiveConfirmation(receipt, room.code, input), receipt);
  const fresh = { ...receipt, replayed: false, room: { ...room, version: 8, revision: 3, archived: true, archivedAt: 100, updatedAt: 100 } };
  assert.deepEqual(adminArchiveConfirmation(fresh, room.code, input), fresh);
  for (const invalid of [{ ...receipt, operationId: crypto.randomUUID() }, { ...receipt, appliedVersion: 9 }, { ...receipt, appliedRevision: 4 },
    { ...receipt, room: { ...current, version: 7 } }, { ...receipt, room: { ...current, revision: 2 } },
    { ...receipt, room: { ...current, code: 'DIFF2345' } }, { ...receipt, sessionToken: 'secret' }, { ...receipt, replayed: undefined }])
    assert.throws(() => adminArchiveConfirmation(invalid, room.code, input));
});

void test('room availability projection excludes private data and rejects malformed metadata', () => {
  const room = view();
  assert.deepEqual(adminArchiveResponse(room, room.code), room);
  assert.doesNotThrow(() => adminArchiveResponse({ ...room, archived: true, archivedAt: 100, updatedAt: 100 }, room.code));
  for (const invalid of [null, [], { ...room, state: {} }, { ...room, reason: 'Private audit' }, { ...room, seats: [] },
    { ...room, version: 1.5 }, { ...room, revision: -1 }, { ...room, code: 'bad code' }, { ...room, archived: 'true' },
    { ...room, archivedAt: -1 }, { ...room, archivedAt: Number.MAX_SAFE_INTEGER }, { ...room, updatedAt: '100' },
    { ...room, closed: undefined }, { ...room, removed: 1 }, { ...room, paused: undefined }, { ...room, joinLocked: null }])
    assert.throws(() => adminArchiveResponse(invalid, room.code));
});

void test('uncertain archive and changed-access responses keep the exact saved request', () => {
  const tab = storage(), room = view(), input = newAdminArchiveRequest(room, true, 'QA');
  saveAdminArchiveRequest(tab, 'a', room.code, input);
  for (const error of [new ClientRequestError('Offline', 'network'), new ClientRequestError('Timeout', 'timeout'),
    new ClientRequestError('Unreadable', 'invalid-response', 200), ...[401, 403, 408, 500, 502, 503].map(status => new ClientRequestError('Unavailable', 'http', status)), new Error('Wrong confirmation')]) {
    if (!retainAdminRoomRequest(error)) clearAdminArchiveRequest(tab, 'a', room.code);
    assert.deepEqual(readAdminArchiveRequest(tab, 'a', room.code), input);
  }
  for (const status of [400, 404, 409, 422]) assert.equal(retainAdminRoomRequest(new ClientRequestError('Rejected', 'http', status)), false);
});
