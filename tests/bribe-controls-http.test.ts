// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView };
}

void test('bribe HTTP payment is atomic, rejects duplicate/stale writes and restores owner-only budgets', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Bribe HTTP payer', faction: 'atreides', advanced: false, expansions: [],
  });
  assert.equal(host.status, 201); assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const peer = await request(path, undefined, { type: 'join', name: 'Bribe HTTP recipient', faction: 'harkonnen' });
  assert.equal(peer.status, 200); assert.ok(peer.cookie);
  let view = peer.data;
  async function act(cookie: string, action: object) {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200); view = next.data;
  }
  await act(host.cookie, { type: 'ready' });
  await act(peer.cookie, { type: 'ready' });
  await act(host.cookie, { type: 'start' });
  const own = view.players.find(p => p.id === host.data.me)!;
  await act(host.cookie, { type: 'traitor', leader: own.traitorChoices![0] });
  assert.equal(view.status, 'playing');
  assert.equal(view.bribeOptions.available, 10);
  const version = view.version;
  const action = { type: 'bribe', target: peer.data.me, amount: 4 };
  const replies = await Promise.all([
    request(path, host.cookie, { version, action }), request(path, host.cookie, { version, action }),
  ]);
  assert.equal(replies.filter(reply => reply.status === 200).length, 1);
  assert.equal(replies.filter(reply => reply.status >= 400).length, 1);
  for (const [cookie, id, available, incoming] of [
    [host.cookie, host.data.me, 6, 0], [peer.cookie, peer.data.me, 10, 4],
  ] as const) {
    const restored = await request(path, cookie);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.version, version + 1);
    assert.equal(restored.data.me, id);
    assert.equal(restored.data.bribeOptions.available, available);
    assert.equal(restored.data.bribeOptions.incoming, incoming);
    for (const rival of restored.data.players.filter(p => p.id !== id)) {
      assert.equal(rival.spice, undefined); assert.equal(rival.bribes, undefined);
      assert.equal(rival.hand, undefined); assert.equal(rival.traitors, undefined);
    }
  }
  assert.ok((await request(path, host.cookie, { version: version + 1, action: { ...action, amount: 7 } })).status >= 400);
  assert.equal((await request(path, host.cookie)).data.version, version + 1);
});
