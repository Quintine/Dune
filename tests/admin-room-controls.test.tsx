import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { newAdminRoomRequest, readAdminRoomRequest, saveAdminRoomRequest, clearAdminRoomRequest, retainAdminRoomRequest } from '../lib/admin-room-control-client';
import { ClientRequestError } from '../lib/client-request';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { RoomControlNotice } from '../components/room-control-notice';
import { SeatAutopilot } from '../components/seat-autopilot';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

void test('room administration saves the exact request before retry and isolates accounts and rooms', () => {
  const tab = storage();
  const input = newAdminRoomRequest({ ...DEFAULT_ROOM_CONTROL, revision: 7 }, true, true, '  QA pause  ');
  saveAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA', input);
  const restored = readAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA');
  assert.deepEqual(restored, input);
  assert.equal(restored?.expectedRevision, 7);
  assert.equal(restored?.reason, 'QA pause');
  assert.equal(readAdminRoomRequest(tab, 'owner-b', 'ROOMAAAA'), null);
  assert.equal(readAdminRoomRequest(tab, 'owner-a', 'ROOMBBBB'), null);
  const conflicting = newAdminRoomRequest({ ...DEFAULT_ROOM_CONTROL, revision: 8 }, false, true, 'Different intent');
  assert.throws(() => saveAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA', conflicting), /Resolve the saved/);
  assert.deepEqual(readAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA'), input);
  saveAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA', restored!);
  clearAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA');
  assert.equal(readAdminRoomRequest(tab, 'owner-a', 'ROOMAAAA'), null);
});

void test('storage failure and corrupt saved operations cannot silently become new requests', () => {
  const tab = storage();
  const input = newAdminRoomRequest(DEFAULT_ROOM_CONTROL, true, false, 'QA');
  assert.throws(() => saveAdminRoomRequest({ ...tab, setItem() {} }, 'a', 'ROOMAAAA', input), /Nothing was sent/);
  saveAdminRoomRequest(tab, 'a', 'ROOMAAAA', input);
  const key = [...tab.values.keys()][0];
  tab.values.set(key, '{broken');
  assert.throws(() => readAdminRoomRequest(tab, 'a', 'ROOMAAAA'), /unreadable/);
  assert.throws(() => saveAdminRoomRequest(tab, 'a', 'ROOMAAAA', input), /unreadable/);
  assert.equal(tab.values.get(key), '{broken');
  clearAdminRoomRequest(tab, 'a', 'ROOMAAAA');
  assert.equal(tab.values.size, 0);
  assert.throws(() => newAdminRoomRequest(DEFAULT_ROOM_CONTROL, true, false, '   '));
});

void test('expired or switched administrator access retains an earlier uncertain operation for its original account', () => {
  for (const status of [401, 403, 502]) assert.equal(retainAdminRoomRequest(new ClientRequestError('Denied now', 'http', status)), true);
  assert.equal(retainAdminRoomRequest(new ClientRequestError('Stale settings', 'http', 409)), false);
  assert.equal(retainAdminRoomRequest(new ClientRequestError('Bad request', 'http', 400)), false);
});

void test('public pause and joining-lock notices explain retained actions without disclosing admin metadata', () => {
  const control = { ...DEFAULT_ROOM_CONTROL, paused: true, joinLocked: true, reason: 'PRIVATE_REASON', actor: 'PRIVATE_ACTOR' };
  const html = renderToStaticMarkup(<RoomControlNotice control={control} />);
  assert.match(html, /Player decisions and automatic play are paused/);
  assert.match(html, /Existing players can reconnect and recover/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /PRIVATE_/);
  assert.equal(renderToStaticMarkup(<RoomControlNotice control={DEFAULT_ROOM_CONTROL} />), '');
});

void test('pause removes AI-start controls but preserves the current owner’s takeback button', () => {
  const game = createGame('ROOMAAAA', newPlayer('a', 'Owner', 'atreides'));
  game.status = 'setup';
  const view: GameView = { ...viewGame(game, 'a'), roomControl: { ...DEFAULT_ROOM_CONTROL, paused: true } };
  const render = () => renderToStaticMarkup(<SeatAutopilot game={view} act={() => {}} busy={false} />);
  assert.doesNotMatch(render(), /Start autopilot/);
  assert.match(render(), /enabled after an administrator resumes/);
  view.players[0].autopilot = 'Medium';
  const html = render();
  assert.match(html, /AI decisions are paused/);
  assert.match(html, /Take back control/);
  assert.doesNotMatch(html, /disabled=""/);
});
