// Dedicated QA rooms only. Never operate on a room supplied by the caller.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function verifyRoomLifecycle(request, adminCookie, report) {
  const made = await request('/api/rooms', { name: 'Lifecycle acceptance QA', faction: 'atreides', advanced: false, expansions: [] });
  assert.equal(made.status, 201);
  const code = made.data.code, host = made.cookie;
  report.lifecycleRoom = code;
  const path = '/api/rooms/' + code, controls = '/api/admin/rooms/' + code + '/control';
  const joinBody = { type: 'join', name: 'Lifecycle participant QA', faction: 'emperor', entry: { operationId: randomUUID(), sessionToken: randomBytes(32).toString('hex') } };
  const joined = await request(path, joinBody);
  assert.equal(joined.status, 200);
  const guest = joined.cookie;
  async function control(paused, joinLocked, saved) {
    const latest = await request(controls, undefined, adminCookie);
    assert.equal(latest.status, 200);
    const body = saved ?? { operationId: randomUUID(), expectedRevision: latest.data.revision, paused, joinLocked, reason: 'Dedicated lifecycle acceptance QA' };
    const result = await request(controls, body, adminCookie);
    assert.equal(result.status, 200);
    return { ...result.data, body };
  }
  async function action(cookie, input) {
    const view = await request(path, undefined, cookie);
    assert.equal(view.status, 200);
    return request(path, { version: view.data.version, action: input }, cookie);
  }
  let failure;
  try {
    const mismatched = await request(controls, { operationId: randomUUID(), expectedRevision: 0, paused: true, joinLocked: true, reason: 'Stale administrator QA' }, adminCookie, undefined, randomUUID());
    assert.equal(mismatched.status, 401);
    assert.equal((await request(controls, undefined, adminCookie)).data.revision, 0);
    const locked = await control(false, true);
    const replay = await control(false, true, locked.body);
    assert.equal(replay.replayed, true); assert.equal(replay.revision, locked.revision);
    const denial = await request(controls, { ...locked.body, operationId: randomUUID(), expectedRevision: locked.revision }, host);
    assert.equal(denial.status, 401);
    const retriedJoin = await request(path, joinBody);
    assert.equal(retriedJoin.status, 200); assert.equal(retriedJoin.data.entryReceipt.replayed, true);
    assert.equal(retriedJoin.data.me, joined.data.me);
    const blockedJoin = await request(path, { type: 'join', name: 'Blocked lifecycle QA', faction: 'fremen' });
    assert.equal(blockedJoin.status, 409); assert.equal(blockedJoin.data.code, 'ROOM_JOIN_LOCKED');
    assert.equal((await request(path, undefined, guest)).status, 200);
    report.checks.push('Joining lock rejects new seats while preserving completed join retries and current seats');

    await control(false, false);
    assert.equal((await action(host, { type: 'addBot', faction: 'harkonnen', difficulty: 'Medium' })).status, 200);
    assert.equal((await action(host, { type: 'ready' })).status, 200);
    assert.equal((await action(guest, { type: 'ready' })).status, 200);
    assert.equal((await action(host, { type: 'start' })).status, 200);
    assert.equal((await action(host, { type: 'setAutopilot', difficulty: 'Medium' })).status, 200);
    await control(true, true);
    const frozen = (await request(path, undefined, host)).data;
    assert.equal(frozen.roomControl.paused, true);
    const blockedAction = await action(host, { type: 'setAutopilot', difficulty: 'Hard' });
    assert.equal(blockedAction.status, 409); assert.match(blockedAction.data.error, /paused/i);
    await delay(2200);
    assert.deepEqual((await request(path, undefined, host)).data, frozen, 'Polling must not advance paused AI or automatic work');
    const takeback = await action(host, { type: 'setAutopilot', difficulty: null });
    assert.equal(takeback.status, 200);
    assert.equal(takeback.data.players.find(p => p.id === takeback.data.me).autopilot, undefined);
    assert.equal(takeback.data.roomControl.paused, true);
    await delay(1700);
    assert.deepEqual((await request(path, undefined, host)).data, takeback.data, 'The native AI remains paused after human takeback');
    report.checks.push('Paused player actions and AI remain frozen; human owner can take back control');

    const resumed = await control(false, false);
    assert.equal(resumed.paused, false);
    assert.equal((await action(host, { type: 'setAutopilot', difficulty: 'Medium' })).status, 200);
    assert.equal((await action(host, { type: 'setAutopilot', difficulty: null })).status, 200);
    const after = (await request(path, undefined, guest)).data;
    assert.equal(after.me, joined.data.me);
    assert.equal(after.roomControl.paused, false);
    assert.equal(after.players.length, 3);
    report.checks.push('Resume preserves player seats and permits new authoritative decisions');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.lifecycleFailure = 'Room lifecycle acceptance failed before cleanup.';
    failure = error;
  } finally {
    // A failed QA run must not leave its new room administratively paused.
    try {
      const current = await request(controls, undefined, adminCookie);
      assert.equal(current.status, 200);
      if (current.data.paused || current.data.joinLocked) await control(false, false);
      const view = await request(path, undefined, host);
      assert.equal(view.status, 200);
      if (view.data.players.find(p => p.id === view.data.me)?.autopilot)
        assert.equal((await action(host, { type: 'setAutopilot', difficulty: null })).status, 200);
    } catch (error) {
      report.lifecycleCleanupFailure = { message: 'The QA room cleanup could not be confirmed.', request: report.lastRequest };
      failure ??= error;
    }
  }
  if (failure) throw failure;
}
