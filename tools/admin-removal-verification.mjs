// Reversible removal of one newly created QA room; never accepts an existing room.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export async function verifyRoomRemoval(request, adminCookie, report) {
  const secret = () => randomBytes(32).toString('hex');
  let code, path, url, controls;
  async function removal(removed, saved) {
    const current = await request(url, undefined, adminCookie); assert.equal(current.status, 200);
    const input = saved ?? { operationId: randomUUID(), expectedVersion: current.data.version, expectedRevision: current.data.revision, removed, reason: 'Dedicated recoverable removal acceptance' };
    const result = await request(url, input, adminCookie);
    assert.equal(result.status, 200); assert.equal(result.rawCookie, null);
    assert.deepEqual(Object.keys(result.data).sort(), ['appliedRevision', 'appliedVersion', 'operationId', 'replayed', 'room']);
    assert.equal(result.data.operationId, input.operationId);
    assert.equal(result.data.appliedVersion, input.expectedVersion + 1); assert.equal(result.data.appliedRevision, input.expectedRevision + 1);
    return { ...result.data, input };
  }
  async function control(paused, joinLocked) {
    const current = await request(controls, undefined, adminCookie); assert.equal(current.status, 200);
    return request(controls, { operationId: randomUUID(), expectedRevision: current.data.revision, paused, joinLocked, reason: 'Dedicated removal QA room availability' }, adminCookie);
  }
  let failure;
  try {
    const creation = { operationId: randomUUID(), sessionToken: secret(), name: 'Removal QA ' + Date.now(), faction: 'atreides', advanced: false,
      techTokens: false, strongholdCards: false, bots: [{ faction: 'harkonnen', difficulty: 'Easy' }], reason: 'Dedicated removal and restoration acceptance' };
    const made = await request('/api/admin/rooms', creation, adminCookie); assert.equal(made.status, 200);
    code = made.data.code; report.removalRoom = code; path = '/api/rooms/' + code; url = '/api/admin/rooms/' + code + '/removal'; controls = '/api/admin/rooms/' + code + '/control';
    const oldHostCookie = made.cookie;
    const joined = await request(path, { type: 'join', name: 'Removal participant QA', faction: 'emperor' }); assert.equal(joined.status, 200);
    const guest = joined.cookie;
    const hostBefore = await request(path, undefined, oldHostCookie);
    const recoverySecret = secret();
    assert.equal((await request(path + '/control', { type: 'setRecoveryKey', version: hostBefore.data.version, recoverySecret }, oldHostCookie)).status, 200);
    const recovery = { type: 'recoverSeat', playerId: made.data.hostId, recoverySecret, operationId: randomUUID(), newSessionToken: secret() };
    const recovered = await request(path + '/control', recovery); assert.equal(recovered.status, 200);
    const host = recovered.cookie;
    const message = { id: randomUUID(), recipientId: null, text: 'Dedicated removal continuity QA' };
    assert.equal((await request(path + '/messages', message, host)).status, 200);
    for (const cookie of [host, guest]) {
      const current = await request(path, undefined, cookie);
      assert.equal((await request(path, { version: current.data.version, action: { type: 'ready' } }, cookie)).status, 200);
    }
    const ready = await request(path, undefined, host);
    assert.equal((await request(path, { version: ready.data.version, action: { type: 'start' } }, host)).status, 200);
    assert.equal((await control(true, true)).status, 200);
    const before = (await request(path, undefined, host)).data;
    const beforeTalk = (await request(path + '/messages', undefined, host)).data;
    const metadata = await request(url, undefined, adminCookie);
    const attempt = { operationId: randomUUID(), expectedVersion: metadata.data.version, expectedRevision: metadata.data.revision, removed: true, reason: 'Dedicated recoverable removal acceptance' };
    for (const denied of [await request(url, attempt, host), await request(url, attempt, adminCookie, 'https://foreign.invalid'), await request(url, attempt, adminCookie, undefined, randomUUID())]) {
      assert.ok([401, 403].includes(denied.status)); assert.equal(denied.rawCookie, null);
    }
    const removed = await removal(true, attempt); assert.equal(removed.room.removed, true);
    const replay = await removal(true, attempt); assert.equal(replay.replayed, true); assert.equal(replay.room.revision, removed.room.revision);
    assert.equal((await request('/api/admin/rooms?q=' + code, undefined, adminCookie)).data.total, 0);
    const directory = await request('/api/admin/rooms?removal=removed&q=' + code, undefined, adminCookie);
    assert.equal(directory.status, 200); assert.equal(directory.data.total, 1); assert.equal(directory.data.rooms[0].removed, true);
    report.checks.push('Removal is live-authorized and exactly replayable; removed QA room is hidden by default and searchable for restoration');

    for (const blocked of [await request(path, undefined, host), await request(path), await request(path, { version: before.version, action: { type: 'advanceBots' } }, host),
      await request(path, { type: 'join', name: 'Blocked removed QA', faction: 'guild' }), await request(path + '/messages', undefined, host),
      await request(path + '/messages', message, host), await request(path + '/control', recovery)]) {
      assert.equal(blocked.status, 410); assert.equal(blocked.data.code, 'ROOM_REMOVED'); assert.equal(blocked.rawCookie, null);
      assert.deepEqual(Object.keys(blocked.data).sort(), ['code', 'error']);
    }
    const inaccessibleCreation = await request('/api/admin/rooms', creation, adminCookie);
    assert.equal(inaccessibleCreation.status, 200); assert.equal(inaccessibleCreation.data.roomRemoved, true);
    assert.equal(inaccessibleCreation.data.hostAccess, false); assert.equal(inaccessibleCreation.rawCookie, null);
    assert.equal((await control(false, false)).status, 409);
    const lobby = await request('/api/admin/rooms/' + code + '/lobby', undefined, adminCookie);
    assert.equal(lobby.status, 200); assert.equal(lobby.data.editable, false);
    assert.equal((await request(url, undefined, adminCookie)).data.version, removed.room.version);
    report.checks.push('Removed room denies player/invitation/AI/seat/message access with a typed non-private response; creation retry retains temporary-removal proof');

    const restored = await removal(false); assert.equal(restored.room.removed, false); assert.equal(restored.room.paused, true); assert.equal(restored.room.joinLocked, true);
    const after = (await request(path, undefined, host)).data;
    assert.deepEqual({ ...after, version: before.version }, before);
    assert.deepEqual((await request(path + '/messages', undefined, host)).data, beforeTalk);
    const guestView = await request(path, undefined, guest); assert.equal(guestView.status, 200); assert.equal(guestView.data.me, joined.data.me);
    assert.notEqual((await request(path, undefined, oldHostCookie)).status, 200);
    const receipt = await request(path + '/control', recovery); assert.equal(receipt.status, 200); assert.equal(receipt.data.replayed, true); assert.equal(receipt.cookie, host);
    assert.deepEqual((await request(path, undefined, host)).data, after);
    const oldRemoval = await removal(true, attempt); assert.equal(oldRemoval.replayed, true); assert.equal(oldRemoval.room.removed, false);
    assert.deepEqual((await request(path, undefined, host)).data, after);
    assert.equal((await request('/api/admin/rooms?q=' + code, undefined, adminCookie)).data.total, 1);
    report.checks.push('Restoration preserves the complete paused game, discussion and both saved seats; revoked host cookie stays denied and old recovery/removal receipts cannot reapply');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.removalFailure = 'Recoverable removal acceptance failed; the dedicated room is retained.';
    report.removalFailureLocation = error instanceof Error ? error.stack?.split('\n').find(line => line.trim().startsWith('at ') && line.includes('admin-removal-verification.mjs'))?.trim() : undefined;
    failure = error;
  } finally {
    if (code) try {
      const current = await request(url, undefined, adminCookie); assert.equal(current.status, 200);
      if (current.data.removed) await removal(false);
      const flags = await request(controls, undefined, adminCookie); assert.equal(flags.status, 200);
      if (flags.data.paused || flags.data.joinLocked) assert.equal((await control(false, false)).status, 200);
    } catch (error) { report.removalCleanupFailure = { message: 'Dedicated QA restoration could not be confirmed.', request: report.lastRequest }; failure ??= error; }
  }
  if (failure) throw failure;
}
