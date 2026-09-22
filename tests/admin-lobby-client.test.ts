import test from 'node:test';
import assert from 'node:assert/strict';
import { adminLobbyConfirmation, adminLobbyResponse, clearAdminLobbyRequest, newAdminLobbyRequest, readAdminLobbyRequest, saveAdminLobbyRequest } from '../lib/admin-lobby-client';
import type { AdminLobbyView } from '../lib/admin-lobby-configuration';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';

const view = (): AdminLobbyView => ({ code: 'ABCD2345', version: 4, status: 'lobby', editable: true, blockedReason: null, host: 'host',
  advanced: false, techTokens: false, strongholdCards: false, control: { ...DEFAULT_ROOM_CONTROL },
  players: [{ id: 'host', name: 'Host', faction: 'atreides', bot: null, position: 1, ready: false, hostEligible: true }] });
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

void test('lobby retry preserves exact action/version/reason across refresh and isolates administrator and room', () => {
  const tab = storage(), input = newAdminLobbyRequest(view(), { type: 'rules', advanced: true }, '  QA preview  ');
  saveAdminLobbyRequest(tab, 'a', view().code, input);
  assert.deepEqual(readAdminLobbyRequest(tab, 'a', view().code), input);
  assert.equal(input.expectedVersion, 4); assert.equal(input.reason, 'QA preview');
  assert.equal(readAdminLobbyRequest(tab, 'b', view().code), null);
  assert.equal(readAdminLobbyRequest(tab, 'a', 'DIFF2345'), null);
  for (const change of [{ expectedVersion: 5 }, { reason: 'Different' }, { action: { type: 'rules' as const, advanced: false } }])
    assert.throws(() => saveAdminLobbyRequest(tab, 'a', view().code, { ...input, ...change }), /Resolve the saved/);
  saveAdminLobbyRequest(tab, 'a', view().code, input);
  clearAdminLobbyRequest(tab, 'a', view().code);
  assert.equal(readAdminLobbyRequest(tab, 'a', view().code), null);
});

void test('corrupt/unwritable retry storage fails closed without replacing its original record', () => {
  const tab = storage(), input = newAdminLobbyRequest(view(), { type: 'assignHost', target: 'human' }, 'QA');
  assert.throws(() => saveAdminLobbyRequest({ ...tab, setItem() {} }, 'a', view().code, input), /Nothing was sent/);
  saveAdminLobbyRequest(tab, 'a', view().code, input);
  const key = [...tab.values.keys()][0];
  tab.values.set(key, '{broken');
  assert.throws(() => readAdminLobbyRequest(tab, 'a', view().code), /unreadable/);
  assert.throws(() => saveAdminLobbyRequest(tab, 'a', view().code, input), /unreadable/);
  assert.equal(tab.values.get(key), '{broken');
  assert.throws(() => clearAdminLobbyRequest({ ...tab, removeItem() {} }, 'a', view().code), /could not be cleared/);
  clearAdminLobbyRequest(tab, 'a', view().code);
  assert.throws(() => newAdminLobbyRequest(view(), { type: 'rules', advanced: true }, ' '));
});

void test('confirmation binds exact operation and applied version while accepting current started/paused public state', () => {
  const lobby = view(), input = newAdminLobbyRequest(lobby, { type: 'rules', advanced: true }, 'QA');
  const current = { ...lobby, version: 9, status: 'playing' as const, editable: false, blockedReason: 'Already started', control: { ...lobby.control, paused: true } };
  const receipt = { operationId: input.operationId, appliedVersion: 5, replayed: true, lobby: current };
  assert.deepEqual(adminLobbyConfirmation(receipt, lobby.code, input), receipt);
  for (const invalid of [{ ...receipt, operationId: crypto.randomUUID() }, { ...receipt, appliedVersion: 6 },
    { ...receipt, lobby: { ...current, version: 4 } }, { ...receipt, lobby: { ...current, code: 'DIFF2345' } },
    { ...receipt, sessionToken: 'secret' }, { ...receipt, replayed: undefined }])
    assert.throws(() => adminLobbyConfirmation(invalid, lobby.code, input));
});

void test('lobby response accepts unreadable room diagnostics but rejects private fields at every projection level', () => {
  const lobby = view();
  assert.deepEqual(adminLobbyResponse(lobby, lobby.code), lobby);
  assert.doesNotThrow(() => adminLobbyResponse({ ...lobby, status: 'unreadable', editable: false, blockedReason: 'Needs inspection', host: null, players: [] }, lobby.code));
  for (const invalid of [{ ...lobby, hand: [] }, { ...lobby, players: [{ ...lobby.players[0], traitors: [] }] },
    { ...lobby, control: { ...lobby.control, reason: 'Private audit' } }, { ...lobby, players: [{ ...lobby.players[0], position: 7 }] }])
    assert.throws(() => adminLobbyResponse(invalid, lobby.code));
});
