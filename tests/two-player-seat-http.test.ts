// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const receipt = () => ({ operationId: randomUUID(), sessionToken: randomBytes(32).toString('hex') });
type Wire = { code: string; me: string; version: number; players: { id: string; ready: boolean; hand?: unknown[] }[]; error?: string; entryReceipt?: { operationId: string; replayed: boolean } };
async function request(path: string, body?: unknown, cookie?: string, selected?: string) {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(selected ? { 'X-Dune-Seat': selected } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json() as Wire, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

void test('two-person controlled seat creation, retry and selected credentials remain isolated', async () => {
  const host = await request('/api/rooms', { name: 'Two person host', faction: 'atreides', advanced: false, expansions: [], entry: receipt() });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, { version: host.data.version, action: { type: 'twoPlayerMode', enabled: true } }, host.cookie, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const attempt = { type: 'addControlledFaction', version: enabled.data.version, name: 'Host second faction', faction: 'harkonnen', entry: receipt() };
  const added = await request(path, attempt, host.cookie, host.data.me);
  assert.equal(added.status, 200, JSON.stringify(added.data));
  assert.ok(added.cookie?.startsWith(`dune_${host.data.code}_${added.data.me}=`));
  assert.notEqual(added.data.me, host.data.me);
  assert.equal(added.data.players.length, 2);
  assert.deepEqual(added.data.entryReceipt, { operationId: attempt.entry.operationId, replayed: false });
  assert.ok(!JSON.stringify(added.data).includes(attempt.entry.sessionToken));
  const both = `${host.cookie}; ${added.cookie}`;
  const retry = await request(path, attempt, both, host.data.me);
  assert.equal(retry.status, 200, JSON.stringify(retry.data));
  assert.equal(retry.cookie, added.cookie);
  assert.equal(retry.data.me, added.data.me);
  assert.deepEqual(retry.data.entryReceipt, { operationId: attempt.entry.operationId, replayed: true });
  const altered = await request(path, { ...attempt, version: attempt.version + 1 }, both, host.data.me);
  assert.equal(altered.status, 409);
  assert.equal(altered.cookie, undefined);
  for (const id of [host.data.me, added.data.me]) {
    const view = await request(path, undefined, both, id);
    assert.equal(view.status, 200, JSON.stringify(view.data));
    assert.equal(view.data.me, id);
    const talk = await request(`${path}/messages`, undefined, both, id);
    assert.equal(talk.status, 200, JSON.stringify(talk.data));
  }
  const missing = await request(path, undefined, host.cookie, added.data.me);
  assert.equal(missing.status, 409);
  const forged = await request(path, undefined, both, randomUUID());
  assert.equal(forged.status, 409);
  const defaultSeat = await request(path, undefined, both);
  assert.equal(defaultSeat.data.me, host.data.me);
  const stranger = await request(path, { type: 'join', name: 'Other person', faction: 'emperor', entry: receipt() });
  assert.equal(stranger.status, 200, JSON.stringify(stranger.data));
  assert.ok(stranger.cookie);
  const stolenReceipt = await request(path, attempt, stranger.cookie, stranger.data.me);
  assert.equal(stolenReceipt.status, 409);
  assert.equal(stolenReceipt.cookie, undefined);
  const wrongSeat = await request(`${path}/control`, { type: 'setRecoveryKey', version: stranger.data.version, recoverySecret: randomBytes(32).toString('hex') }, host.cookie, added.data.me);
  assert.equal(wrongSeat.status, 409);
  const secondAttempt = { type: 'addControlledFaction', version: stranger.data.version, name: 'Other second faction', faction: 'fremen', entry: receipt() };
  const second = await request(path, secondAttempt, stranger.cookie, stranger.data.me);
  assert.equal(second.status, 200, JSON.stringify(second.data));
  assert.ok(second.cookie?.startsWith(`dune_${host.data.code}_${second.data.me}=`));
  const otherCookies = `${stranger.cookie}; ${second.cookie}`;
  const seats = [
    { id: host.data.me, cookie: both },
    { id: added.data.me, cookie: both },
    { id: stranger.data.me, cookie: otherCookies },
    { id: second.data.me, cookie: otherCookies },
  ];
  const crossController = await request(path, undefined, both, second.data.me);
  assert.equal(crossController.status, 409);
  const reverseCrossController = await request(path, undefined, otherCookies, added.data.me);
  assert.equal(reverseCrossController.status, 409);
  let latest = second.data;
  for (const seat of seats) {
    const view = await request(path, undefined, seat.cookie, seat.id);
    assert.equal(view.status, 200, JSON.stringify(view.data));
    assert.equal(view.data.me, seat.id);
    for (const player of view.data.players)
      assert.equal(Object.hasOwn(player, 'hand'), player.id === seat.id);
    const ready = await request(path, { version: latest.version, action: { type: 'ready' } }, seat.cookie, seat.id);
    assert.equal(ready.status, 200, JSON.stringify(ready.data));
    assert.equal(ready.data.me, seat.id);
    latest = ready.data;
  }
});

void test('recovering a scoped seat replaces its stale cookie without requiring a selector', async () => {
  const host = await request('/api/rooms', { name: 'Recovery host', faction: 'atreides', advanced: false, expansions: [], entry: receipt() });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, { version: host.data.version, action: { type: 'twoPlayerMode', enabled: true } }, host.cookie, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const added = await request(path, { type: 'addControlledFaction', version: enabled.data.version, name: 'Recovery second', faction: 'harkonnen', entry: receipt() }, host.cookie, host.data.me);
  assert.equal(added.status, 200, JSON.stringify(added.data));
  assert.ok(added.cookie);
  const recoverySecret = randomBytes(32).toString('hex');
  const setup = await request(`${path}/control`, { type: 'setRecoveryKey', version: added.data.version, recoverySecret }, added.cookie, added.data.me);
  assert.equal(setup.status, 200, JSON.stringify(setup.data));
  // Another browser recovers first, making the original scoped cookie stale.
  const initial = await request(`${path}/control`, { type: 'recoverSeat', playerId: added.data.me, recoverySecret, operationId: randomUUID(), newSessionToken: randomBytes(32).toString('hex') });
  assert.equal(initial.status, 200, JSON.stringify(initial.data));
  const stale = await request(path, undefined, added.cookie, added.data.me);
  assert.equal(stale.status, 409);
  const attempt = { type: 'recoverSeat', playerId: added.data.me, recoverySecret, operationId: randomUUID(), newSessionToken: randomBytes(32).toString('hex') };
  const recovered = await request(`${path}/control`, attempt, added.cookie);
  assert.equal(recovered.status, 200, JSON.stringify(recovered.data));
  assert.ok(recovered.cookie?.startsWith(`dune_${host.data.code}_${added.data.me}=`));
  const view = await request(path, undefined, recovered.cookie, added.data.me);
  assert.equal(view.status, 200, JSON.stringify(view.data));
  assert.equal(view.data.me, added.data.me);
  const retry = await request(`${path}/control`, attempt, added.cookie);
  assert.equal(retry.status, 200, JSON.stringify(retry.data));
  assert.equal(retry.cookie, recovered.cookie);
});
