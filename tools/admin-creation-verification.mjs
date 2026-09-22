// Create a dedicated QA lobby; never inspect or mutate an existing human room.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export async function verifyRoomCreation(request, adminCookie, report) {
  const secret = () => randomBytes(32).toString('hex');
  const input = { operationId: randomUUID(), sessionToken: secret(), name: 'Admin creation QA ' + Date.now(), faction: 'atreides', advanced: true,
    techTokens: true, strongholdCards: true, bots: [{ faction: 'fremen', difficulty: 'Easy' }, { faction: 'guild', difficulty: 'Hard' }], reason: 'Dedicated admin room creation acceptance' };
  try {
    const mismatched = await request('/api/admin/rooms', input, adminCookie, undefined, randomUUID());
    assert.equal(mismatched.status, 401); assert.equal(mismatched.rawCookie, null);
    const invalid = await request('/api/admin/rooms', { ...input, advanced: false }, adminCookie);
    assert.equal(invalid.status, 400); assert.equal(invalid.rawCookie, null);
    const made = await request('/api/admin/rooms', input, adminCookie);
    assert.equal(made.status, 200);
    assert.deepEqual(Object.keys(made.data).sort(), ['code', 'hostAccess', 'hostId', 'operationId', 'replayed']);
    assert.equal(made.data.operationId, input.operationId); assert.equal(made.data.replayed, false); assert.equal(made.data.hostAccess, true);
    const code = made.data.code, path = '/api/rooms/' + code, host = made.cookie;
    report.creationRoom = code;
    for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Path=/api/rooms/' + code]) assert.ok(made.rawCookie.includes(attribute));
    const first = await request(path, undefined, host);
    assert.equal(first.status, 200); assert.equal(first.data.me, made.data.hostId); assert.equal(first.data.host, made.data.hostId);
    assert.equal(first.data.status, 'lobby'); assert.equal(first.data.advanced, true);
    assert.ok(first.data.techTokens); assert.ok(first.data.strongholdCards); assert.equal(first.data.players.length, 3);
    assert.equal(first.data.players.find(player => player.id === first.data.me).ready, false);
    assert.deepEqual(first.data.players.filter(player => player.bot).map(player => [player.faction, player.bot]), input.bots.map(bot => [bot.faction, bot.difficulty]));
    const ready = await request(path, { version: first.data.version, action: { type: 'ready' } }, host);
    assert.equal(ready.status, 200);
    const replay = await request('/api/admin/rooms', input, adminCookie);
    assert.equal(replay.status, 200); assert.equal(replay.data.replayed, true); assert.equal(replay.data.code, code); assert.equal(replay.cookie, host);
    assert.deepEqual((await request(path, undefined, host)).data, ready.data, 'Creation retry must not reset configured or readied lobby');
    const directory = await request('/api/admin/rooms?q=' + encodeURIComponent(input.name), undefined, adminCookie);
    assert.equal(directory.status, 200); assert.equal(directory.data.total, 1);
    const joined = await request(path, { type: 'join', name: 'Creation invited human QA', faction: 'emperor' });
    assert.equal(joined.status, 200); assert.equal(joined.data.players.length, 4);
    report.checks.push('Admin creation preserves supported rules and ordered AI seats; exact retry finds one lobby and invitations admit a human');

    const current = (await request(path, undefined, host)).data;
    const offer = { offerId: randomUUID(), handoverSecret: secret() };
    const offered = await request(path + '/control', { type: 'createSeatHandover', version: current.version, ...offer }, host);
    assert.equal(offered.status, 200);
    const claimed = await request(path + '/control', { type: 'claimSeatHandover', playerId: current.me, ...offer, operationId: randomUUID(), newSessionToken: secret() });
    assert.equal(claimed.status, 200);
    const transferred = await request(path, undefined, claimed.cookie);
    assert.equal(transferred.status, 200); assert.equal(transferred.data.me, current.me); assert.equal(transferred.data.host, current.me);
    const afterTransfer = await request('/api/admin/rooms', input, adminCookie);
    assert.equal(afterTransfer.status, 200); assert.equal(afterTransfer.data.code, code);
    assert.equal(afterTransfer.data.replayed, true); assert.equal(afterTransfer.data.hostAccess, false); assert.equal(afterTransfer.rawCookie, null);
    assert.notEqual((await request(path, undefined, host)).status, 200);
    assert.deepEqual((await request(path, undefined, claimed.cookie)).data, transferred.data);
    report.checks.push('Voluntary host handover preserves lobby; later admin creation retry cannot revive old private-seat access');
  } catch (error) {
    report.failureRequest ??= report.lastRequest;
    report.creationFailure = 'Administrator room creation acceptance failed; the dedicated lobby remains saved.';
    throw error;
  }
}
