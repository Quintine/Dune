import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDiscussionConfirmation, adminDiscussionResponse, clearAdminDiscussionRequest, newAdminDiscussionRequest, readAdminDiscussionRequest, saveAdminDiscussionRequest } from '../lib/admin-discussion-client';
import type { AdminDiscussionView } from '../lib/admin-discussion';

const view = (): AdminDiscussionView => ({ code: 'SEATQAAB', version: 7, status: 'playing', closed: false, removed: false, archived: false,
  editable: true, blockedReason: null, players: [{ id: 'owner', name: 'QA Owner', faction: 'atreides', control: 'human', muted: false, revision: 2 }] });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
void test('participant retry stores exact intent before dispatch, survives refresh, and isolates room/account', () => {
  const tab = storage(), room = view(), input = newAdminDiscussionRequest(room, 'owner', true, '  QA support  ');
  assert.equal(input.reason, 'QA support');
  saveAdminDiscussionRequest(tab, 'admin', room.code, input);
  assert.deepEqual(readAdminDiscussionRequest(tab, 'admin', room.code), input);
  assert.equal(readAdminDiscussionRequest(tab, 'other', room.code), null);
  assert.equal(readAdminDiscussionRequest(tab, 'admin', 'OTHERQAA'), null);
  for (const change of [{ operationId: crypto.randomUUID() }, { expectedVersion: 8 }, { expectedRevision: 3 }, { target: 'other' }, { muted: false }, { reason: 'Different' }])
    assert.throws(() => saveAdminDiscussionRequest(tab, 'admin', room.code, { ...input, ...change }), /Resolve the saved/);
  saveAdminDiscussionRequest(tab, 'admin', room.code, input);
  clearAdminDiscussionRequest(tab, 'admin', room.code); assert.equal(readAdminDiscussionRequest(tab, 'admin', room.code), null);
});
void test('bad participant retry storage cannot lose or overwrite unresolved intent', () => {
  const tab = storage(), room = view(), input = newAdminDiscussionRequest(room, 'owner', true, 'QA');
  assert.throws(() => saveAdminDiscussionRequest({ ...tab, setItem() {} }, 'admin', room.code, input), /Nothing was sent/);
  saveAdminDiscussionRequest(tab, 'admin', room.code, input);
  const key = [...tab.values.keys()][0];
  for (const raw of ['{broken', JSON.stringify({ ...input, token: 'not accepted' }), ' '.repeat(2049), JSON.stringify({ ...input, expectedRevision: -1 })]) {
    tab.values.set(key, raw);
    assert.throws(() => readAdminDiscussionRequest(tab, 'admin', room.code), /unreadable/);
    assert.throws(() => saveAdminDiscussionRequest(tab, 'admin', room.code, input), /unreadable/);
    assert.equal(tab.values.get(key), raw);
  }
  assert.throws(() => clearAdminDiscussionRequest({ ...tab, removeItem() {} }, 'admin', room.code), /could not be cleared/);
  clearAdminDiscussionRequest(tab, 'admin', room.code);
  for (const reason of [' ', 'a'.repeat(301), 'two\nlines', 'control\u007f']) assert.throws(() => newAdminDiscussionRequest(room, 'owner', true, reason));
  assert.throws(() => newAdminDiscussionRequest({ ...room, editable: false, blockedReason: 'Pause first' }, 'owner', true, 'QA'), /Pause first/);
  assert.throws(() => newAdminDiscussionRequest(room, 'absent', true, 'QA'), /human participant/);
});
void test('participant confirmation binds original operation/version but accepts later human unmute', () => {
  const room = view(), input = newAdminDiscussionRequest(room, 'owner', true, 'QA');
  const result = { operationId: input.operationId, appliedRevision: 3, replayed: true, room: { ...room, version: 10, players: [{ ...room.players[0], revision: 4 }] } };
  assert.deepEqual(adminDiscussionConfirmation(result, room.code, input), result);
  for (const bad of [{ ...result, operationId: crypto.randomUUID() }, { ...result, appliedRevision: 4 }, { ...result, replayed: 'yes' },
    { ...result, room: { ...room, version: 7 } }, { ...result, token: 'unexpected' }]) assert.throws(() => adminDiscussionConfirmation(bad, room.code, input));
});
void test('participant responses reject unexpected private fields and malformed operational values', () => {
  const room = view(); assert.deepEqual(adminDiscussionResponse(room, room.code), room);
  for (const bad of [null, [], { ...room, state: {} }, { ...room, auditReason: 'private' }, { ...room, code: 'bad' },
    { ...room, version: -1 }, { ...room, removed: 'yes' }, { ...room, players: [{ ...room.players[0], revision: 1.2 }] },
    { ...room, players: [{ ...room.players[0], hand: [] }] }, { ...room, players: [{ ...room.players[0], muted: 'yes' }] }])
    assert.throws(() => adminDiscussionResponse(bad, room.code));
});
