import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSeatAiConfirmation, adminSeatAiResponse, clearAdminSeatAiRequest, newAdminSeatAiRequest, readAdminSeatAiRequest, saveAdminSeatAiRequest } from '../lib/admin-seat-ai-client';
import type { AdminSeatAiView } from '../lib/admin-seat-ai';

const view = (): AdminSeatAiView => ({ code: 'SEATQAAB', version: 7, controlRevision: 2, status: 'playing', paused: true, closed: false, removed: false, archived: false,
  editable: true, blockedReason: null, players: [{ id: 'owner', name: 'QA Owner', faction: 'atreides', control: 'human', difficulty: null, eligible: true }] });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
void test('participant retry stores exact intent before dispatch, survives refresh, and isolates room/account', () => {
  const tab = storage(), room = view(), input = newAdminSeatAiRequest(room, 'owner', 'Hard', '  QA support  ');
  assert.equal(input.reason, 'QA support');
  saveAdminSeatAiRequest(tab, 'admin', room.code, input);
  assert.deepEqual(readAdminSeatAiRequest(tab, 'admin', room.code), input);
  assert.equal(readAdminSeatAiRequest(tab, 'other', room.code), null);
  assert.equal(readAdminSeatAiRequest(tab, 'admin', 'OTHERQAA'), null);
  for (const change of [{ operationId: crypto.randomUUID() }, { expectedVersion: 8 }, { expectedControlRevision: 3 }, { target: 'other' }, { difficulty: 'Easy' as const }, { reason: 'Different' }])
    assert.throws(() => saveAdminSeatAiRequest(tab, 'admin', room.code, { ...input, ...change }), /Resolve the saved/);
  saveAdminSeatAiRequest(tab, 'admin', room.code, input);
  clearAdminSeatAiRequest(tab, 'admin', room.code); assert.equal(readAdminSeatAiRequest(tab, 'admin', room.code), null);
});
void test('bad participant retry storage cannot lose or overwrite unresolved intent', () => {
  const tab = storage(), room = view(), input = newAdminSeatAiRequest(room, 'owner', 'Easy', 'QA');
  assert.throws(() => saveAdminSeatAiRequest({ ...tab, setItem() {} }, 'admin', room.code, input), /Nothing was sent/);
  saveAdminSeatAiRequest(tab, 'admin', room.code, input);
  const key = [...tab.values.keys()][0];
  for (const raw of ['{broken', JSON.stringify({ ...input, token: 'not accepted' }), ' '.repeat(2049), JSON.stringify({ ...input, expectedControlRevision: -1 })]) {
    tab.values.set(key, raw);
    assert.throws(() => readAdminSeatAiRequest(tab, 'admin', room.code), /unreadable/);
    assert.throws(() => saveAdminSeatAiRequest(tab, 'admin', room.code, input), /unreadable/);
    assert.equal(tab.values.get(key), raw);
  }
  assert.throws(() => clearAdminSeatAiRequest({ ...tab, removeItem() {} }, 'admin', room.code), /could not be cleared/);
  clearAdminSeatAiRequest(tab, 'admin', room.code);
  for (const reason of [' ', 'a'.repeat(301), 'two\nlines', 'control\u007f']) assert.throws(() => newAdminSeatAiRequest(room, 'owner', 'Easy', reason));
  assert.throws(() => newAdminSeatAiRequest({ ...room, editable: false, blockedReason: 'Pause first' }, 'owner', 'Easy', 'QA'), /Pause first/);
  assert.throws(() => newAdminSeatAiRequest(room, 'absent', 'Easy', 'QA'), /eligible/);
});
void test('participant confirmation binds original operation/version but accepts later human takeback', () => {
  const room = view(), input = newAdminSeatAiRequest(room, 'owner', 'Hard', 'QA');
  const result = { operationId: input.operationId, appliedVersion: 8, replayed: true, room: { ...room, version: 10, paused: false, editable: false, blockedReason: 'Pause first' } };
  assert.deepEqual(adminSeatAiConfirmation(result, room.code, input), result);
  for (const bad of [{ ...result, operationId: crypto.randomUUID() }, { ...result, appliedVersion: 9 }, { ...result, replayed: 'yes' },
    { ...result, room: { ...room, version: 7 } }, { ...result, token: 'unexpected' }]) assert.throws(() => adminSeatAiConfirmation(bad, room.code, input));
});
void test('participant responses reject unexpected private fields and malformed operational values', () => {
  const room = view(); assert.deepEqual(adminSeatAiResponse(room, room.code), room);
  for (const bad of [null, [], { ...room, state: {} }, { ...room, auditReason: 'private' }, { ...room, code: 'bad' },
    { ...room, version: -1 }, { ...room, paused: 'yes' }, { ...room, controlRevision: 1.2 },
    { ...room, players: [{ ...room.players[0], hand: [] }] }, { ...room, players: [{ ...room.players[0], difficulty: 'Impossible' }] }])
    assert.throws(() => adminSeatAiResponse(bad, room.code));
});
