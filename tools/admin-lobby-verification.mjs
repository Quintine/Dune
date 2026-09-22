// Dedicated QA lobby only. Administrator configuration never returns a seat cookie.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyLobbyConfiguration(request, adminCookie, report) {
  try {
    const created = await request('/api/rooms', { name: 'Admin lobby QA ' + Date.now(), faction: 'atreides', advanced: false, expansions: [] });
    assert.equal(created.status, 201);
    const code = created.data.code, path = '/api/rooms/' + code, url = '/api/admin/rooms/' + code + '/lobby';
    report.lobbyRoom = code;
    const hostCookie = created.cookie;
    const joined = await request(path, { type: 'join', name: 'Lobby host assignment QA', faction: 'fremen' });
    assert.equal(joined.status, 200);
    const secondCookie = joined.cookie, secondId = joined.data.me;
    assert.equal((await request(url)).status, 401);
    assert.equal((await request(url, undefined, hostCookie)).status, 401);
    let current = await request(url, undefined, adminCookie);
    assert.equal(current.status, 200); assert.equal(current.rawCookie, null);
    assert.equal(current.data.editable, true);
    assert.deepEqual(Object.keys(current.data).sort(), ['advanced', 'blockedReason', 'code', 'control', 'editable', 'host', 'players', 'status', 'strongholdCards', 'techTokens', 'version']);
    for (const player of current.data.players) assert.deepEqual(Object.keys(player).sort(), ['bot', 'faction', 'hostEligible', 'id', 'name', 'position', 'ready']);
    const makeInput = action => ({ operationId: randomUUID(), expectedVersion: current.data.version, action, reason: 'Dedicated lobby configuration acceptance' });
    const firstInput = makeInput({ type: 'rules', advanced: true });
    for (const denied of [await request(url, firstInput, adminCookie, 'https://foreign.invalid'), await request(url, firstInput, adminCookie, undefined, randomUUID())]) {
      assert.ok([401, 403].includes(denied.status)); assert.equal(denied.rawCookie, null);
    }
    async function apply(input) {
      const result = await request(url, input, adminCookie);
      assert.equal(result.status, 200); assert.equal(result.rawCookie, null);
      assert.deepEqual(Object.keys(result.data).sort(), ['appliedVersion', 'lobby', 'operationId', 'replayed']);
      assert.equal(result.data.operationId, input.operationId); assert.equal(result.data.appliedVersion, input.expectedVersion + 1);
      current = { data: result.data.lobby };
      return result;
    }
    await apply(firstInput); assert.equal(current.data.advanced, true);
    await apply(makeInput({ type: 'techTokens', enabled: true }));
    await apply(makeInput({ type: 'strongholdCards', enabled: true }));
    await apply(makeInput({ type: 'addBot', faction: 'guild', difficulty: 'Easy' }));
    const botId = current.data.players.find(player => player.bot).id;
    await apply(makeInput({ type: 'configureBot', target: botId, faction: 'emperor', difficulty: 'Hard', position: 5 }));
    assert.equal(current.data.players.find(player => player.id === botId).faction, 'emperor');
    assert.equal(current.data.players.find(player => player.id === botId).position, 5);
    await apply(makeInput({ type: 'removeBot', target: botId }));
    assert.equal(current.data.players.length, 2);
    await apply(makeInput({ type: 'rules', advanced: false })); assert.equal(current.data.strongholdCards, false);
    await apply(makeInput({ type: 'techTokens', enabled: false }));
    const stale = await request(url, { ...firstInput, operationId: randomUUID() }, adminCookie);
    assert.equal(stale.status, 409); assert.equal(stale.rawCookie, null);
    report.checks.push('Neutral admin rules/modules and AI add/configure/remove persist; public-only projection, origin/account/host denial and stale version rejection');

    for (const cookie of [hostCookie, secondCookie]) {
      const player = await request(path, undefined, cookie);
      const ready = await request(path, { version: player.data.version, action: { type: 'ready' } }, cookie);
      assert.equal(ready.status, 200);
    }
    current = await request(url, undefined, adminCookie);
    const assignment = makeInput({ type: 'assignHost', target: secondId });
    await apply(assignment); assert.equal(current.data.host, secondId);
    assert.ok(current.data.players.every(player => !player.ready));
    const afterAssignment = (await request(path, undefined, hostCookie)).data;
    assert.notEqual(afterAssignment.me, secondId); assert.equal(afterAssignment.host, secondId);
    assert.equal((await request(path, undefined, secondCookie)).data.me, secondId);
    const noSeat = await request(path, undefined, adminCookie);
    assert.ok([401, 409].includes(noSeat.status));
    assert.equal(noSeat.rawCookie, null);
    for (const field of ['players', 'me', 'hand', 'state']) assert.ok(!Object.hasOwn(noSeat.data, field));
    const oldHostChange = await request(path, { version: afterAssignment.version, action: { type: 'rules', advanced: true } }, hostCookie);
    assert.notEqual(oldHostChange.status, 200);
    report.checks.push('Existing human host assignment clears readiness, preserves both seat cookies and grants no administrator private-seat access');

    for (const cookie of [hostCookie, secondCookie]) {
      const player = await request(path, undefined, cookie);
      assert.equal((await request(path, { version: player.data.version, action: { type: 'ready' } }, cookie)).status, 200);
    }
    const beforeStart = (await request(path, undefined, secondCookie)).data;
    const started = await request(path, { version: beforeStart.version, action: { type: 'start' } }, secondCookie);
    assert.equal(started.status, 200); assert.notEqual(started.data.status, 'lobby');
    const replay = await apply(assignment); assert.equal(replay.data.replayed, true); assert.equal(current.data.editable, false);
    assert.equal(current.data.host, secondId);
    assert.deepEqual((await request(path, undefined, secondCookie)).data, started.data);
    const denied = await request(url, makeInput({ type: 'rules', advanced: true }), adminCookie);
    assert.equal(denied.status, 409); assert.equal(denied.rawCookie, null);
    assert.deepEqual((await request(path, undefined, secondCookie)).data, started.data);
    report.checks.push('New host starts a real saved game; exact pre-start assignment retry confirms without resetting its started continuation');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.lobbyFailure = 'Administrator lobby configuration acceptance failed; dedicated QA room remains saved.';
    report.lobbyFailureLocation = error instanceof Error ? error.stack?.split('\n').find(line => line.trim().startsWith('at ') && line.includes('admin-lobby-verification.mjs'))?.trim() : undefined;
    throw error;
  }
}
