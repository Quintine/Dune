// All mutations use a newly created QA room. Never accepts an existing human room.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function verifyParticipantAi(request, adminCookie, report) {
  const made = await request('/api/rooms', { name: 'Participant AI acceptance QA', faction: 'atreides', advanced: false, expansions: [] });
  assert.equal(made.status, 201);
  const code = made.data.code, host = made.cookie, path = '/api/rooms/' + code, adminPath = '/api/admin/rooms/' + code;
  report.participantAiRoom = code;
  const joined = await request(path, { type: 'join', name: 'Participant AI guest QA', faction: 'emperor' });
  assert.equal(joined.status, 200);
  const guest = joined.cookie;
  async function action(cookie, action) {
    const view = await request(path, undefined, cookie); assert.equal(view.status, 200);
    return request(path, { version: view.data.version, action }, cookie);
  }
  async function pause(paused) {
    const current = await request(adminPath + '/control', undefined, adminCookie); assert.equal(current.status, 200);
    const result = await request(adminPath + '/control', { operationId: randomUUID(), expectedRevision: current.data.revision, paused, joinLocked: false, reason: 'Participant AI acceptance QA' }, adminCookie);
    assert.equal(result.status, 200);
  }
  let failure;
  try {
    for (const cookie of [host, guest]) assert.equal((await action(cookie, { type: 'ready' })).status, 200);
    assert.equal((await action(host, { type: 'start' })).status, 200);
    const running = await request(adminPath + '/seat-ai', undefined, adminCookie); assert.equal(running.status, 200);
    assert.equal(running.data.editable, false);
    const early = { operationId: randomUUID(), expectedVersion: running.data.version, expectedControlRevision: running.data.controlRevision, target: made.data.me, difficulty: 'Easy', reason: 'Participant AI acceptance QA' };
    assert.equal((await request(adminPath + '/seat-ai', early, adminCookie)).status, 409);
    await pause(true);
    const ready = await request(adminPath + '/seat-ai', undefined, adminCookie); assert.equal(ready.status, 200); assert.equal(ready.data.editable, true);
    const input = { ...early, operationId: randomUUID(), expectedVersion: ready.data.version, expectedControlRevision: ready.data.controlRevision };
    for (const denied of [
      await request(adminPath + '/seat-ai', input, host),
      await request(adminPath + '/seat-ai', input, adminCookie, 'https://foreign.invalid'),
      await request(adminPath + '/seat-ai', input, adminCookie, undefined, randomUUID()),
    ]) { assert.ok([401, 403].includes(denied.status)); assert.equal(denied.rawCookie, null); }
    const before = (await request(path, undefined, host)).data;
    const changed = await request(adminPath + '/seat-ai', input, adminCookie);
    assert.equal(changed.status, 200); assert.equal(changed.rawCookie, null); assert.equal(changed.data.replayed, false);
    assert.equal(changed.data.appliedVersion, input.expectedVersion + 1); assert.equal(changed.data.room.paused, true);
    assert.deepEqual(Object.keys(changed.data.room.players[0]).sort(), ['control','difficulty','eligible','faction','id','name']);
    const frozen = (await request(path, undefined, host)).data;
    assert.equal(frozen.me, before.me); assert.equal(frozen.roomControl.paused, true);
    assert.deepEqual(frozen.players, before.players.map(player => player.id === frozen.me ? { ...player, autopilot: 'Easy' } : player));
    assert.equal((await request(path, undefined, guest)).data.me, joined.data.me);
    await delay(2200);
    assert.deepEqual((await request(path, undefined, host)).data, frozen, 'Paused AI must not advance');
    const replay = await request(adminPath + '/seat-ai', input, adminCookie); assert.equal(replay.status, 200); assert.equal(replay.data.replayed, true);
    assert.deepEqual((await request(path, undefined, host)).data, frozen);
    report.checks.push('Participant AI requires paused room and live authority; enable preserves private seats and cannot advance paused play or duplicate its operation');
    const takeback = await action(host, { type: 'setAutopilot', difficulty: null }); assert.equal(takeback.status, 200);
    assert.equal(takeback.data.players.find(player => player.id === takeback.data.me).autopilot, undefined);
    assert.equal(takeback.data.roomControl.paused, true);
    const afterTakeback = await request(adminPath + '/seat-ai', input, adminCookie); assert.equal(afterTakeback.status, 200); assert.equal(afterTakeback.data.replayed, true);
    assert.deepEqual((await request(path, undefined, host)).data, takeback.data);
    await pause(false);
    const resumed = (await request(path, undefined, host)).data;
    assert.equal(resumed.roomControl.paused, false);
    assert.equal((await request(adminPath + '/seat-ai', input, adminCookie)).data.replayed, true);
    assert.deepEqual((await request(path, undefined, host)).data, resumed);
    report.checks.push('Human takeback works while paused; exact participant retry after takeback and resume cannot re-enable AI');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.participantAiFailure = 'Participant AI acceptance failed before cleanup.';
    failure = error;
  } finally {
    try {
      const view = await request(path, undefined, host); assert.equal(view.status, 200);
      if (view.data.players.find(player => player.id === view.data.me)?.autopilot)
        assert.equal((await action(host, { type: 'setAutopilot', difficulty: null })).status, 200);
      const current = await request(adminPath + '/control', undefined, adminCookie); assert.equal(current.status, 200);
      if (current.data.paused) await pause(false);
    } catch (error) {
      report.participantAiCleanupFailure = { message: 'The QA room cleanup could not be confirmed.', request: report.lastRequest };
      failure ??= error;
    }
  }
  if (failure) throw failure;
}
