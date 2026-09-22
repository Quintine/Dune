// Mutations are confined to the new QA room; archiving never edits saved game content.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export async function verifyRoomArchive(request, adminCookie, report) {
  let code, path, adminPath, failure;
  async function transition(kind, flag, value, saved) {
    const current = await request(adminPath + '/' + kind, undefined, adminCookie); assert.equal(current.status, 200);
    const input = saved ?? { operationId: randomUUID(), expectedVersion: current.data.version, expectedRevision: current.data.revision, [flag]: value, reason: 'Dedicated archive acceptance' };
    const response = await request(adminPath + '/' + kind, input, adminCookie);
    assert.equal(response.status, 200); assert.equal(response.rawCookie, null);
    assert.equal(response.data.operationId, input.operationId);
    assert.equal(response.data.appliedVersion, input.expectedVersion + 1); assert.equal(response.data.appliedRevision, input.expectedRevision + 1);
    return { ...response.data, input };
  }
  try {
    const creation = { operationId: randomUUID(), sessionToken: randomBytes(32).toString('hex'), name: 'Archive QA ' + Date.now(), faction: 'atreides', advanced: false,
      techTokens: false, strongholdCards: false, bots: [], reason: 'Dedicated archive acceptance' };
    const made = await request('/api/admin/rooms', creation, adminCookie); assert.equal(made.status, 200);
    code = made.data.code; report.archiveRoom = code; path = '/api/rooms/' + code; adminPath = '/api/admin/rooms/' + code;
    const host = made.cookie;
    const joined = await request(path, { type: 'join', name: 'Archive participant QA', faction: 'emperor' }); assert.equal(joined.status, 200);
    for (const cookie of [host, joined.cookie]) {
      const current = await request(path, undefined, cookie);
      assert.equal((await request(path, { version: current.data.version, action: { type: 'ready' } }, cookie)).status, 200);
    }
    const ready = await request(path, undefined, host);
    assert.equal((await request(path, { version: ready.data.version, action: { type: 'start' } }, host)).status, 200);
    const message = { id: randomUUID(), recipientId: null, text: 'Archive continuity QA' };
    assert.equal((await request(path + '/messages', message, host)).status, 200);
    const initial = await request(adminPath + '/archive', undefined, adminCookie); assert.equal(initial.status, 200);
    const early = { operationId: randomUUID(), expectedVersion: initial.data.version, expectedRevision: initial.data.revision, archived: true, reason: 'Reject archive of open room' };
    assert.equal((await request(adminPath + '/archive', early, adminCookie)).status, 409);
    const close = await transition('closure', 'closed', true);
    const before = (await request(path, undefined, host)).data, history = (await request(path + '/messages', undefined, host)).data;
    const input = { ...early, operationId: randomUUID(), expectedVersion: before.version };
    for (const denied of [await request(adminPath + '/archive', input, host), await request(adminPath + '/archive', input, adminCookie, 'https://foreign.invalid'), await request(adminPath + '/archive', input, adminCookie, undefined, randomUUID())]) {
      assert.ok([401, 403].includes(denied.status)); assert.equal(denied.rawCookie, null);
    }
    const archived = await transition('archive', 'archived', true, input); assert.equal(archived.room.archived, true); assert.equal(archived.room.closed, true);
    assert.equal((await transition('archive', 'archived', true, input)).replayed, true);
    assert.equal((await request('/api/admin/rooms?q=' + code, undefined, adminCookie)).data.total, 0);
    const directory = await request('/api/admin/rooms?archive=archived&q=' + code, undefined, adminCookie);
    assert.equal(directory.status, 200); assert.equal(directory.data.total, 1); assert.equal(directory.data.rooms[0].archived, true);
    const view = await request(path, undefined, host); assert.equal(view.status, 200);
    assert.deepEqual({ ...view.data, version: before.version }, before);
    assert.equal((await request(path, undefined, joined.cookie)).data.me, joined.data.me);
    assert.deepEqual((await request(path + '/messages', undefined, host)).data, history);
    assert.equal((await request(path + '/messages', message, host)).data.replayed, true);
    report.checks.push('Archive requires a closed room and live administrator authority; exact replay, archive filters and private saved table/history remain intact');
    const closure = await request(adminPath + '/closure', undefined, adminCookie);
    assert.equal(closure.data.archived, true);
    assert.equal((await request(adminPath + '/closure', { ...close.input, operationId: randomUUID(), expectedVersion: view.data.version, expectedRevision: closure.data.revision, closed: false }, adminCookie)).status, 409);
    const removed = await transition('removal', 'removed', true); assert.equal(removed.room.archived, true); assert.equal(removed.room.closed, true);
    assert.equal((await request('/api/admin/rooms?removal=all&q=' + code, undefined, adminCookie)).data.total, 0);
    assert.equal((await request('/api/admin/rooms?removal=all&archive=all&q=' + code, undefined, adminCookie)).data.total, 1);
    assert.equal((await transition('archive', 'archived', true, input)).replayed, true);
    const unavailable = await request(adminPath + '/archive', undefined, adminCookie);
    assert.equal((await request(adminPath + '/archive', { ...input, operationId: randomUUID(), expectedVersion: unavailable.data.version, expectedRevision: unavailable.data.revision, archived: false }, adminCookie)).status, 409);
    const restored = await transition('removal', 'removed', false); assert.equal(restored.room.archived, true); assert.equal(restored.room.closed, true);
    assert.deepEqual({ ...(await request(path, undefined, host)).data, version: before.version }, before);
    report.checks.push('Archived rooms cannot reopen; removal and restoration retain archive/closure, with explicit combined filters and confirmable prior archive receipts');
    const unarchived = await transition('archive', 'archived', false); assert.equal(unarchived.room.archived, false); assert.equal(unarchived.room.closed, true);
    assert.equal((await request('/api/admin/rooms?q=' + code, undefined, adminCookie)).data.total, 1);
    assert.deepEqual({ ...(await request(path, undefined, host)).data, version: before.version }, before);
    const reopened = await transition('closure', 'closed', false); assert.equal(reopened.room.closed, false);
    const after = (await request(path, undefined, host)).data;
    const replay = await transition('archive', 'archived', true, input); assert.equal(replay.replayed, true); assert.equal(replay.room.closed, false); assert.equal(replay.room.archived, false);
    assert.deepEqual((await request(path, undefined, host)).data, after);
    assert.deepEqual((await request(path + '/messages', undefined, host)).data, history);
    report.checks.push('Unarchive returns the directory entry but leaves play closed; separate reopening restores the same table and old archive receipts cannot rearchive it');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.archiveFailure = 'Archive acceptance failed; the dedicated QA room is retained.';
    report.archiveFailureLocation = error instanceof Error ? error.stack?.split('\n').find(line => line.trim().startsWith('at ') && line.includes('admin-archive-verification.mjs'))?.trim() : undefined;
    failure = error;
  } finally {
    if (code) try {
      const removed = await request(adminPath + '/removal', undefined, adminCookie); assert.equal(removed.status, 200);
      if (removed.data.removed) await transition('removal', 'removed', false);
      const archive = await request(adminPath + '/archive', undefined, adminCookie); assert.equal(archive.status, 200);
      if (archive.data.archived) await transition('archive', 'archived', false);
      const closed = await request(adminPath + '/closure', undefined, adminCookie); assert.equal(closed.status, 200);
      if (closed.data.closed) await transition('closure', 'closed', false);
    } catch (error) { report.archiveCleanupFailure = { message: 'Dedicated QA unarchive/reopening could not be confirmed.', request: report.lastRequest }; failure ??= error; }
  }
  if (failure) throw failure;
}
