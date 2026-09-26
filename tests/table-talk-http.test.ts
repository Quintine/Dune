// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameView } from '../game/engine';
import type { TalkPage } from '../lib/table-talk';
const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(
  path: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { error: 'Non-JSON response' };
  }
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: parsed as GameView &
      TalkPage & {
        view: GameView;
        id: string;
        replayed: boolean;
        error?: string;
      },
  };
}
async function fixture() {
  const a = await request('/api/rooms', {
    name: 'Discussion QA sender',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(a.status, 201);
  assert.ok(a.cookie);
  const path = `/api/rooms/${a.data.code}`;
  const b = await request(path, {
    type: 'join',
    name: 'Discussion QA recipient',
    faction: 'emperor',
  });
  const c = await request(path, {
    type: 'join',
    name: 'Discussion QA observer',
    faction: 'guild',
  });
  assert.equal(b.status, 200);
  assert.ok(b.cookie);
  assert.equal(c.status, 200);
  assert.ok(c.cookie);
  let view = c.data;
  for (const seat of [a, b, c]) {
    const result = await request(
      path,
      { version: view.version, action: { type: 'ready' } },
      seat.cookie,
    );
    assert.equal(result.status, 200);
    view = result.data;
  }
  const started = await request(
    path,
    { version: view.version, action: { type: 'start' } },
    a.cookie,
  );
  assert.equal(started.status, 200);
  const me = started.data.players.find((p) => p.id === a.data.me)!;
  const sealed = await request(
    path,
    {
      version: started.data.version,
      action: { type: 'traitor', leader: me.traitorChoices![0] },
    },
    a.cookie,
  );
  assert.equal(sealed.status, 200);
  return { a, b, c, path, version: sealed.data.version };
}
void test('discussion HTTP preserves sealed setup and room version; public and direct channels enforce audience and origin', async () => {
  const f = await fixture(),
    endpoint = f.path + '/messages';
  const before = (await request(f.path, undefined, f.a.cookie)).data;
  const direct = {
    id: crypto.randomUUID(),
    recipientId: f.b.data.me,
    text: 'Private QA offer only for the recipient.',
  };
  assert.equal((await request(endpoint, direct)).status, 409);
  assert.equal(
    (await request(endpoint, direct, f.a.cookie, 'https://foreign.invalid'))
      .status,
    403,
  );
  const sent = await request(endpoint, direct, f.a.cookie);
  assert.equal(sent.status, 200);
  assert.equal(sent.cache, 'no-store');
  assert.equal(sent.data.id, direct.id);
  const recipient = await request(
    endpoint + `?recipient=${f.a.data.me}`,
    undefined,
    f.b.cookie,
  );
  assert.equal(recipient.status, 200);
  assert.equal(recipient.cache, 'no-store');
  assert.deepEqual(
    recipient.data.messages.map((m) => m.text),
    [direct.text],
  );
  const outsider = await request(
    endpoint + `?recipient=${f.a.data.me}`,
    undefined,
    f.c.cookie,
  );
  assert.deepEqual(outsider.data, { messages: [], before: null, muted: false });
  assert.deepEqual(
    (await request(endpoint + `?before=${direct.id}`, undefined, f.c.cookie))
      .data,
    { messages: [], before: null, muted: false },
  );
  const publicText = {
    id: crypto.randomUUID(),
    recipientId: null,
    text: 'Public QA discussion <script>literal only</script>.',
  };
  assert.equal((await request(endpoint, publicText, f.b.cookie)).status, 200);
  for (const seat of [f.a, f.b, f.c]) {
    const read = await request(endpoint, undefined, seat.cookie);
    assert.deepEqual(
      read.data.messages.map((m) => m.text),
      [publicText.text],
    );
    assert.equal(JSON.stringify(read.data).includes(direct.text), false);
    assert.equal(JSON.stringify(read.data).includes('session_hash'), false);
    assert.equal(JSON.stringify(read.data).includes('sequence'), false);
  }
  assert.deepEqual((await request(f.path, undefined, f.a.cookie)).data, before);
  for (const body of [
    { ...direct, senderId: f.c.data.me },
    { ...direct, recipientId: f.a.data.me },
    { ...direct, text: 'x'.repeat(1001) },
  ])
    assert.ok((await request(endpoint, body, f.a.cookie)).status >= 400);
  assert.equal(
    (await request(endpoint + '?recipient=invalid', undefined, f.a.cookie))
      .status,
    400,
  );
  assert.equal(
    (await request(endpoint + '?unknown=1', undefined, f.a.cookie)).status,
    400,
  );
});
void test('discussion HTTP retries save once and seat recovery inherits conversation while fencing old cookies', async () => {
  const f = await fixture(),
    endpoint = f.path + '/messages';
  const input = {
    id: crypto.randomUUID(),
    recipientId: f.b.data.me,
    text: 'Saved before recovery; exact retries do not duplicate.',
  };
  const result = await Promise.all([
    request(endpoint, input, f.a.cookie),
    request(endpoint, input, f.a.cookie),
  ]);
  assert.ok(result.every((r) => r.status === 200));
  assert.deepEqual(
    result.map((r) => r.data.replayed).sort((a, b) => Number(a) - Number(b)),
    [false, true],
  );
  assert.equal(
    (await request(endpoint, { ...input, text: 'Changed receipt' }, f.a.cookie))
      .status,
    409,
  );
  const recoverySecret = 'a7'.repeat(32);
  const key = await request(
    f.path + '/control',
    { type: 'setRecoveryKey', version: f.version, recoverySecret },
    f.a.cookie,
  );
  assert.equal(key.status, 200);
  const recovered = await request(f.path + '/control', {
    type: 'recoverSeat',
    playerId: f.a.data.me,
    recoverySecret,
    operationId: crypto.randomUUID(),
    newSessionToken:
      crypto.randomUUID().replaceAll('-', '') +
      crypto.randomUUID().replaceAll('-', ''),
  });
  assert.equal(recovered.status, 200);
  assert.ok(recovered.cookie);
  assert.equal((await request(endpoint, undefined, f.a.cookie)).status, 409);
  assert.equal((await request(endpoint, input, f.a.cookie)).status, 409);
  const restored = await request(
    endpoint + `?recipient=${f.b.data.me}`,
    undefined,
    recovered.cookie,
  );
  assert.equal(restored.status, 200);
  assert.deepEqual(
    restored.data.messages.map((m) => m.id),
    [input.id],
  );
  assert.equal((await request(endpoint, input, recovered.cookie)).status, 409);
  assert.deepEqual(
    (
      await request(
        endpoint + `?recipient=${f.a.data.me}`,
        undefined,
        f.c.cookie,
      )
    ).data,
    { messages: [], before: null, muted: false },
  );
});
