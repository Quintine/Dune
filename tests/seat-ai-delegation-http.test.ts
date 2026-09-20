// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import type { GameView } from '../game/engine';
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
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: 'Non-JSON response' };
  }
  return {
    status: response.status,
    data: data as GameView & {
      view: GameView;
      replayed?: boolean;
      error?: string;
    },
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    cache: response.headers.get('cache-control'),
  };
}
async function fixture() {
  const a = await request('/api/rooms', {
    name: 'AI permission owner',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(a.status, 201);
  assert.ok(a.cookie);
  const path = `/api/rooms/${a.data.code}`;
  const b = await request(path, {
    type: 'join',
    name: 'AI permission delegate',
    faction: 'emperor',
  });
  const c = await request(path, {
    type: 'join',
    name: 'AI permission observer',
    faction: 'guild',
  });
  assert.equal(b.status, 200);
  assert.ok(b.cookie);
  assert.equal(c.status, 200);
  assert.ok(c.cookie);
  let view = c.data;
  for (const player of [a, b, c]) {
    const ready = await request(
      path,
      { version: view.version, action: { type: 'ready' } },
      player.cookie,
    );
    assert.equal(ready.status, 200);
    view = ready.data;
  }
  const started = await request(
    path,
    { version: view.version, action: { type: 'start' } },
    a.cookie,
  );
  assert.equal(started.status, 200);
  assert.equal(started.data.status, 'setup');
  return { a, b, c, path, view: started.data };
}
function privateView(view: GameView, ownId: string) {
  assert.equal(view.me, ownId);
  assert.ok(view.players.find((player) => player.id === ownId)?.traitorChoices);
  for (const player of view.players.filter((player) => player.id !== ownId))
    for (const key of ['hand', 'traitors', 'traitorChoices', 'spice'])
      assert.equal(key in player, false, `Other seat exposed ${key}`);
  for (const secret of [
    'ownerSessionHash',
    'delegateSessionHash',
    'owner_session_hash',
    'delegate_session_hash',
    'tokenHash',
  ])
    assert.equal(JSON.stringify(view).includes(secret), false);
}

void test('AI permission HTTP restricts creation/use/revoke to consented identities and rejects injection without mutation', async () => {
  const f = await fixture(),
    control = f.path + '/control';
  const grant = {
    type: 'setSeatAiDelegate',
    version: f.view.version,
    grantId: crypto.randomUUID(),
    delegateId: f.b.data.me,
    difficulty: 'Hard',
  };
  assert.equal((await request(control, grant)).status, 409);
  assert.equal(
    (await request(control, grant, f.a.cookie, 'https://other.invalid')).status,
    403,
  );
  for (const body of [
    { ...grant, ownerId: f.c.data.me },
    { ...grant, delegateId: f.a.data.me },
    { ...grant, difficulty: 'Invalid' },
  ])
    assert.ok((await request(control, body, f.a.cookie)).status >= 400);
  assert.equal(
    (await request(f.path, undefined, f.a.cookie)).data.version,
    f.view.version,
  );
  const made = await request(control, grant, f.a.cookie);
  assert.equal(made.status, 200);
  assert.equal(made.cache, 'no-store');
  assert.equal(made.data.view.seatAiDelegations?.[0].grantId, grant.grantId);
  const replay = await request(control, grant, f.a.cookie);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  const other = await request(f.path, undefined, f.c.cookie);
  assert.equal(other.data.seatAiDelegations, undefined);
  const read = await request(f.path, undefined, f.b.cookie);
  assert.equal(read.data.seatAiDelegations?.[0].grantId, grant.grantId);
  privateView(read.data, f.b.data.me);
  const activate = {
    type: 'useSeatAiDelegate',
    version: read.data.version,
    ownerId: f.a.data.me,
    grantId: grant.grantId,
  };
  for (const [body, cookie] of [
    [activate, f.c.cookie],
    [{ ...activate, difficulty: 'Brutal' }, f.b.cookie],
    [
      {
        type: 'revokeSeatAiDelegate',
        version: read.data.version,
        grantId: grant.grantId,
      },
      f.b.cookie,
    ],
  ] as const)
    assert.ok((await request(control, body, cookie)).status >= 400);
  assert.equal(
    (await request(f.path, undefined, f.a.cookie)).data.version,
    read.data.version,
  );
});

void test('AI permission HTTP starts only the chosen profile, resumes paced work, preserves ownership and cannot reactivate after takeback', async () => {
  const f = await fixture(),
    control = f.path + '/control';
  const grant = {
    type: 'setSeatAiDelegate',
    version: f.view.version,
    grantId: crypto.randomUUID(),
    delegateId: f.b.data.me,
    difficulty: 'Medium',
  };
  const made = await request(control, grant, f.a.cookie);
  assert.equal(made.status, 200);
  const activate = {
    type: 'useSeatAiDelegate',
    version: made.data.view.version,
    ownerId: f.a.data.me,
    grantId: grant.grantId,
  };
  const used = await request(control, activate, f.b.cookie);
  assert.equal(used.status, 200);
  assert.equal(used.cookie, undefined);
  assert.equal(used.cache, 'no-store');
  privateView(used.data.view, f.b.data.me);
  assert.equal(
    used.data.view.players.find((player) => player.id === f.a.data.me)
      ?.autopilot,
    'Medium',
  );
  assert.ok(
    used.data.view.seatAiDelegations?.find(
      (entry) => entry.grantId === grant.grantId,
    )?.usedAt,
  );
  const deadline = Date.now() + 10_000;
  let own = await request(f.path, undefined, f.a.cookie);
  while (own.data.botsPending && Date.now() < deadline) {
    await pause(150);
    own = await request(f.path, undefined, f.a.cookie);
  }
  assert.equal(own.status, 200);
  assert.equal(own.data.me, f.a.data.me);
  assert.equal(own.data.botsPending, false);
  assert.ok(
    own.data.version > used.data.view.version,
    'Server continuation should advance the AI setup choice.',
  );
  const back = await request(
    f.path,
    {
      version: own.data.version,
      action: { type: 'setAutopilot', difficulty: null },
    },
    f.a.cookie,
  );
  assert.equal(back.status, 200);
  assert.equal(
    back.data.players.find((player) => player.id === f.a.data.me)?.autopilot,
    undefined,
  );
  // Both exact lost-response retry and newly versioned reuse must remain harmless.
  for (const version of [activate.version, back.data.version]) {
    const retry = await request(control, { ...activate, version }, f.b.cookie);
    assert.ok([200, 409].includes(retry.status));
    const current = await request(f.path, undefined, f.a.cookie);
    assert.equal(current.data.version, back.data.version);
    assert.equal(
      current.data.players.find((player) => player.id === f.a.data.me)
        ?.autopilot,
      undefined,
    );
  }
});
