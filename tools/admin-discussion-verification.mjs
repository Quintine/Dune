// Creates its own QA room; never accepts an existing game for moderation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyDiscussionModeration(request, adminCookie, report) {
  const made = await request('/api/rooms', { name: 'Discussion moderation QA', faction: 'atreides', advanced: false, expansions: [] });
  assert.equal(made.status, 201);
  const code = made.data.code, host = made.cookie, path = '/api/rooms/' + code, adminPath = '/api/admin/rooms/' + code + '/discussion';
  report.discussionRoom = code;
  const joined = await request(path, { type: 'join', name: 'Discussion guest QA', faction: 'emperor' });
  assert.equal(joined.status, 200);
  const guest = joined.cookie, messages = path + '/messages';
  const prior = { id: randomUUID(), recipientId: joined.data.me, text: 'QA message before mute' };
  assert.equal((await request(messages, prior, host)).status, 200);
  const before = (await request(path, undefined, host)).data;
  const initial = await request(adminPath, undefined, adminCookie); assert.equal(initial.status, 200);
  const input = { operationId: randomUUID(), expectedVersion: initial.data.version, expectedRevision: 0, target: made.data.me, muted: true, reason: 'Discussion moderation QA' };
  for (const denied of [
    await request(adminPath, input, host), await request(adminPath, input, adminCookie, 'https://foreign.invalid'),
    await request(adminPath, input, adminCookie, undefined, randomUUID()),
  ]) { assert.ok([401,403].includes(denied.status)); assert.equal(denied.rawCookie, null); }
  const muted = await request(adminPath, input, adminCookie);
  assert.equal(muted.status, 200); assert.equal(muted.rawCookie, null); assert.equal(muted.data.replayed, false);
  assert.equal(muted.data.appliedRevision, 1); assert.equal(muted.data.room.version, initial.data.version);
  assert.deepEqual(Object.keys(muted.data.room.players[0]).sort(), ['control','faction','id','muted','name','revision']);
  assert.deepEqual((await request(path, undefined, host)).data, before);
  for (const recipientId of [null, joined.data.me]) {
    const denied = await request(messages, { id: randomUUID(), recipientId, text: 'Must be blocked' }, host);
    assert.equal(denied.status, 409); assert.equal(denied.data.code, 'SEAT_DISCUSSION_MUTED');
  }
  const own = await request(messages + '?recipient=' + joined.data.me, undefined, host);
  assert.equal(own.status, 200); assert.equal(own.data.muted, true); assert.equal(own.data.messages[0].id, prior.id);
  assert.equal((await request(messages, undefined, guest)).data.muted, false);
  const retry = await request(messages, prior, host); assert.equal(retry.status, 200); assert.equal(retry.data.replayed, true);
  assert.equal((await request(messages, { id: randomUUID(), recipientId: made.data.me, text: 'QA incoming message while muted' }, guest)).status, 200);
  report.checks.push('Discussion moderation enforces live admin/account/origin authority, own-only mute status, new-send barrier and exact committed message retry without game changes');
  const undo = { ...input, operationId: randomUUID(), expectedRevision: 1, muted: false };
  assert.equal((await request(adminPath, undo, adminCookie)).status, 200);
  const old = await request(adminPath, input, adminCookie);
  assert.equal(old.status, 200); assert.equal(old.data.replayed, true);
  assert.equal(old.data.room.players.find(player => player.id === input.target).muted, false);
  assert.equal((await request(messages, undefined, host)).data.muted, false);
  assert.deepEqual((await request(path, undefined, host)).data, before);
  report.checks.push('Unmute restores sending availability; replaying an old admin request cannot mute again and preserves both human seats');
}
