// Close/reopen only the room this verifier creates; existing games are never selected.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export async function verifyRoomClosure(request, adminCookie, report) {
  const secret = () => randomBytes(32).toString('hex');
  let code, path, url, controls, failure;
  async function closure(closed, saved) {
    const current = await request(url, undefined, adminCookie); assert.equal(current.status, 200);
    const input = saved ?? { operationId: randomUUID(), expectedVersion: current.data.version, expectedRevision: current.data.revision, closed, reason: 'Dedicated close and reopen acceptance' };
    const response = await request(url, input, adminCookie);
    assert.equal(response.status, 200); assert.equal(response.rawCookie, null);
    assert.equal(response.data.operationId, input.operationId);
    assert.equal(response.data.appliedVersion, input.expectedVersion + 1); assert.equal(response.data.appliedRevision, input.expectedRevision + 1);
    return { ...response.data, input };
  }
  async function control(paused, joinLocked) {
    const current = await request(controls, undefined, adminCookie); assert.equal(current.status, 200);
    return request(controls, { operationId: randomUUID(), expectedRevision: current.data.revision, paused, joinLocked, reason: 'Dedicated closure QA flags' }, adminCookie);
  }
  try {
    const creation = { operationId: randomUUID(), sessionToken: secret(), name: 'Closure QA ' + Date.now(), faction: 'atreides', advanced: false,
      techTokens: false, strongholdCards: false, bots: [], reason: 'Dedicated closure acceptance' };
    const made = await request('/api/admin/rooms', creation, adminCookie); assert.equal(made.status, 200);
    code = made.data.code; report.closureRoom = code; path = '/api/rooms/' + code; url = '/api/admin/rooms/' + code + '/closure'; controls = '/api/admin/rooms/' + code + '/control';
    const oldHost = made.cookie;
    const joined = await request(path, { type: 'join', name: 'Closure participant QA', faction: 'emperor' }); assert.equal(joined.status, 200);
    const guest = joined.cookie;
    const original = await request(path, undefined, oldHost), recoverySecret = secret();
    assert.equal((await request(path + '/control', { type: 'setRecoveryKey', version: original.data.version, recoverySecret }, oldHost)).status, 200);
    const recovery = { type: 'recoverSeat', playerId: made.data.hostId, recoverySecret, operationId: randomUUID(), newSessionToken: secret() };
    const recovered = await request(path + '/control', recovery); assert.equal(recovered.status, 200);
    const host = recovered.cookie, message = { id: randomUUID(), recipientId: null, text: 'Dedicated closure continuity QA' };
    assert.equal((await request(path + '/messages', message, host)).status, 200);
    for (const cookie of [host, guest]) {
      const current = await request(path, undefined, cookie);
      assert.equal((await request(path, { version: current.data.version, action: { type: 'ready' } }, cookie)).status, 200);
    }
    const ready = await request(path, undefined, host);
    assert.equal((await request(path, { version: ready.data.version, action: { type: 'start' } }, host)).status, 200);
    assert.equal((await control(true, true)).status, 200);
    const before = (await request(path, undefined, host)).data, history = (await request(path + '/messages', undefined, host)).data;
    const metadata = await request(url, undefined, adminCookie);
    const input = { operationId: randomUUID(), expectedVersion: metadata.data.version, expectedRevision: metadata.data.revision, closed: true, reason: 'Dedicated closure acceptance' };
    for (const denied of [await request(url, input, host), await request(url, input, adminCookie, 'https://foreign.invalid'), await request(url, input, adminCookie, undefined, randomUUID())]) {
      assert.ok([401, 403].includes(denied.status)); assert.equal(denied.rawCookie, null);
    }
    const closed = await closure(true, input); assert.equal(closed.room.closed, true);
    assert.equal((await closure(true, input)).replayed, true);
    const directory = await request('/api/admin/rooms?availability=closed&q=' + code, undefined, adminCookie);
    assert.equal(directory.status, 200); assert.equal(directory.data.total, 1); assert.equal(directory.data.rooms[0].control.closed, true);
    assert.equal((await request('/api/admin/rooms?availability=running&q=' + code, undefined, adminCookie)).data.total, 0);
    const view = await request(path, undefined, host); assert.equal(view.status, 200);
    assert.deepEqual({ ...view.data, version: before.version, roomControl: before.roomControl }, before);
    assert.equal(view.data.roomControl.closed, true);
    assert.deepEqual((await request(path + '/messages', undefined, host)).data, history);
    assert.equal((await request(path, undefined, guest)).data.me, joined.data.me);
    assert.equal((await request(path + '/messages', message, host)).data.replayed, true);
    const receipt = await request(path + '/control', recovery); assert.equal(receipt.status, 200); assert.equal(receipt.data.replayed, true); assert.equal(receipt.cookie, host);
    assert.notEqual((await request(path, undefined, oldHost)).status, 200);
    report.checks.push('Closure is authorized and exactly replayable; closed room and private table/history remain readable; prior message/recovery receipts cannot rotate again');
    for (const blocked of [await request(path, { type: 'join', name: 'Blocked closure QA', faction: 'guild' }),
      await request(path, { version: view.data.version, action: { type: 'advanceBots' } }, host),
      await request(path, { version: view.data.version, action: { type: 'setAutopilot', difficulty: null } }, host),
      await request(path + '/messages', { ...message, id: randomUUID() }, host),
      await request(path + '/control', { type: 'setRecoveryKey', version: view.data.version, recoverySecret: secret() }, host)]) {
      assert.equal(blocked.status, 409); assert.equal(blocked.data.code, 'ROOM_CLOSED'); assert.equal(blocked.rawCookie, null);
      assert.deepEqual(Object.keys(blocked.data).sort(), ['code', 'error']);
    }
    assert.equal((await control(false, false)).status, 409);
    assert.equal((await request('/api/admin/rooms/' + code + '/lobby', undefined, adminCookie)).data.editable, false);
    assert.deepEqual((await request(path, undefined, host)).data, view.data);
    report.checks.push('Closed room blocks joins, game/AI/takeback, fresh messages, recovery keys and admin lobby/pause changes without changing the saved table');
    const reopened = await closure(false); assert.equal(reopened.room.closed, false); assert.equal(reopened.room.paused, true); assert.equal(reopened.room.joinLocked, true);
    const after = (await request(path, undefined, host)).data;
    assert.deepEqual({ ...after, version: before.version }, before);
    const old = await closure(true, input); assert.equal(old.replayed, true); assert.equal(old.room.closed, false);
    assert.deepEqual((await request(path, undefined, host)).data, after);
    assert.equal((await request(path + '/messages', undefined, host)).data.messages.length, history.messages.length);
    report.checks.push('Reopening preserves the full pending game, pause/join settings, discussion and current seat ownership; old close receipts cannot close it again');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.closureFailure = 'Close/reopen acceptance failed; the dedicated QA room is retained.';
    report.closureFailureLocation = error instanceof Error ? error.stack?.split('\n').find(line => line.trim().startsWith('at ') && line.includes('admin-closure-verification.mjs'))?.trim() : undefined;
    failure = error;
  } finally {
    if (code) try {
      const current = await request(url, undefined, adminCookie); assert.equal(current.status, 200);
      if (current.data.closed) await closure(false);
      const flags = await request(controls, undefined, adminCookie); assert.equal(flags.status, 200);
      if (flags.data.paused || flags.data.joinLocked) assert.equal((await control(false, false)).status, 200);
    } catch (error) { report.closureCleanupFailure = { message: 'Dedicated QA reopening could not be confirmed.', request: report.lastRequest }; failure ??= error; }
  }
  if (failure) throw failure;
}
