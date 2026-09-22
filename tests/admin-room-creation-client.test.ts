import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAdminRoomCreation, completeAdminRoomCreation, newAdminRoomCreationRequest, readAdminRoomCreation, saveAdminRoomCreation, validAdminRoomCreationResult } from '../lib/admin-room-creation-client';
import type { AdminRoomCreationResult } from '../lib/admin-room-creation';

const fields = () => ({ name: ' Host QA ', faction: 'atreides' as const, advanced: true, techTokens: true, strongholdCards: true,
  bots: [{ faction: 'fremen' as const, difficulty: 'Easy' as const }, { faction: 'guild' as const, difficulty: 'Hard' as const }], reason: ' Dedicated QA lobby ' });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const receipt = (operationId: string): AdminRoomCreationResult => ({ operationId, code: 'ABCD2345', hostId: crypto.randomUUID(), replayed: true, hostAccess: true });

void test('creation retry preserves one exact private host proof and roster order in its original administrator scope', () => {
  const tab = storage(), input = newAdminRoomCreationRequest(fields());
  assert.equal(input.name, 'Host QA'); assert.equal(input.reason, 'Dedicated QA lobby');
  assert.match(input.sessionToken, /^[0-9a-f]{64}$/);
  saveAdminRoomCreation(tab, 'operator-a', input);
  assert.deepEqual(readAdminRoomCreation(tab, 'operator-a'), { kind: 'pending', input });
  assert.equal(readAdminRoomCreation(tab, 'operator-b'), null);
  assert.throws(() => saveAdminRoomCreation(tab, 'operator-a', newAdminRoomCreationRequest(fields())), /Resolve the saved/);
  assert.throws(() => saveAdminRoomCreation(tab, 'operator-a', { ...input, bots: [...input.bots].reverse() }), /Resolve the saved/);
  saveAdminRoomCreation(tab, 'operator-a', input);
  assert.deepEqual(readAdminRoomCreation(tab, 'operator-a'), { kind: 'pending', input });
});

void test('only a matching valid receipt replaces the private retry proof with safe completed-room metadata', () => {
  const tab = storage(), input = newAdminRoomCreationRequest(fields());
  saveAdminRoomCreation(tab, 'a', input);
  assert.throws(() => completeAdminRoomCreation(tab, 'a', input, receipt(crypto.randomUUID())), /did not confirm/);
  assert.equal(readAdminRoomCreation(tab, 'a')?.kind, 'pending');
  const result = receipt(input.operationId);
  completeAdminRoomCreation(tab, 'a', input, result);
  assert.deepEqual(readAdminRoomCreation(tab, 'a'), { kind: 'completed', result });
  const raw = [...tab.values.values()].join('');
  assert.equal(raw.includes(input.sessionToken), false);
  assert.equal(raw.includes(input.reason), false);
  assert.throws(() => saveAdminRoomCreation(tab, 'a', newAdminRoomCreationRequest(fields())), /Resolve the saved/);
  clearAdminRoomCreation(tab, 'a');
  assert.equal(readAdminRoomCreation(tab, 'a'), null);
});

void test('unavailable, corrupt or replaced tab storage never silently authorizes a different creation', () => {
  const tab = storage(), input = newAdminRoomCreationRequest(fields());
  assert.throws(() => saveAdminRoomCreation({ ...tab, setItem() {} }, 'a', input), /could not be saved/);
  saveAdminRoomCreation(tab, 'a', input);
  const key = [...tab.values.keys()][0];
  tab.values.set(key, '{broken');
  assert.throws(() => readAdminRoomCreation(tab, 'a'), /unreadable/);
  assert.throws(() => saveAdminRoomCreation(tab, 'a', input), /unreadable/);
  assert.equal(tab.values.get(key), '{broken');
  tab.values.set(key, JSON.stringify({ kind: 'pending', input: newAdminRoomCreationRequest(fields()) }));
  assert.throws(() => completeAdminRoomCreation(tab, 'a', input, receipt(input.operationId)), /record changed/);
});

void test('revoked host receipts remain readable without claiming access and malformed/secret-bearing results cannot clear proof', () => {
  const result = { ...receipt(crypto.randomUUID()), hostAccess: false };
  assert.equal(validAdminRoomCreationResult(result), true);
  for (const invalid of [null, [], { ...result, hostAccess: undefined }, { ...result, code: result.code + '\n' }, { ...result, hostId: 'not-an-id' }, { ...result, sessionToken: 'private' }])
    assert.equal(validAdminRoomCreationResult(invalid), false);
  assert.throws(() => newAdminRoomCreationRequest({ ...fields(), strongholdCards: true, advanced: false }));
  assert.throws(() => newAdminRoomCreationRequest({ ...fields(), bots: [{ faction: 'atreides', difficulty: 'Easy' }] }));
});
