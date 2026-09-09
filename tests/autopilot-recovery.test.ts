// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import type { GameView } from '../game/engine';

// Real HTTP fixtures only: three human base seats, with two holding setup open.
// The final case observes paced background setup through GET, then retakes control.
// Full delegated completion uses trusted fake-clock production persistence in paced-games.test.ts.
const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const secret = () => randomBytes(32).toString('hex');
type Seat = { id: string; cookie: string };
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
    // The development server may reject an Origin before the JSON route runs.
    parsed = { error: raw };
  }
  return {
    status: response.status,
    data: parsed as GameView & {
      view: GameView;
      error?: string;
      replayed?: boolean;
      recoveryConfigured?: boolean;
    },
    cookie: response.headers.get('set-cookie'),
    cache: response.headers.get('cache-control'),
  };
}
function seat(result: Awaited<ReturnType<typeof request>>): Seat {
  assert.ok(result.cookie, 'Entry must issue a seat cookie');
  return { id: result.data.me, cookie: result.cookie.split(';')[0] };
}
const own = (view: GameView) => {
  const player = view.players.find((p) => p.id === view.me);
  assert.ok(player);
  return player;
};
const action = (
  path: string,
  view: GameView,
  owner: Seat,
  command: Record<string, unknown>,
) => request(path, { version: view.version, action: command }, owner.cookie);
async function fixture() {
  const created = await request('/api/rooms', {
    name: 'Autopilot HTTP audit A',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(created.status, 201);
  const path = `/api/rooms/${created.data.code}`;
  const a = seat(created);
  const joinedB = await request(path, {
    type: 'join',
    name: 'Autopilot HTTP audit B',
    faction: 'emperor',
  });
  assert.equal(joinedB.status, 200);
  const b = seat(joinedB);
  const joinedC = await request(path, {
    type: 'join',
    name: 'Autopilot HTTP audit C',
    faction: 'guild',
  });
  assert.equal(joinedC.status, 200);
  const c = seat(joinedC);
  let view = joinedC.data;
  for (const owner of [a, b, c]) {
    const ready = await action(path, view, owner, { type: 'ready' });
    assert.equal(ready.status, 200);
    view = ready.data;
  }
  const started = await action(path, view, a, { type: 'start' });
  assert.equal(started.status, 200);
  assert.equal(started.data.status, 'setup');
  assert.equal(started.data.players.length, 3);
  assert.ok(started.data.players.every((p) => !p.bot && !p.autopilot));
  return { path, a, b, c, view: started.data };
}
const enable = (f: Awaited<ReturnType<typeof fixture>>, difficulty = 'Hard') =>
  action(f.path, f.view, f.a, { type: 'setAutopilot', difficulty });
function assertPrivate(view: GameView) {
  assert.ok(Array.isArray(own(view).hand));
  assert.equal(own(view).hand!.length, view.status === 'setup' ? 0 : 1);
  if (view.status === 'setup') assert.equal(view.setupStage, 'traitors');
  for (const p of view.players.filter((p) => p.id !== view.me)) {
    for (const key of ['hand', 'traitors', 'traitorChoices', 'spice'])
      assert.equal(key in p, false, `Another seat exposed ${key}`);
  }
  for (const key of ['deck', 'spiceDeck', 'tokenHash', 'recoverySecret'])
    assert.equal(key in view, false, `Private root field exposed: ${key}`);
}

async function waitForBotPause(path: string, owner: Seat) {
  const deadline = Date.now() + 10_000;
  let result = await request(path, undefined, owner.cookie);
  while (result.data.botsPending && Date.now() < deadline) {
    await pause(100);
    result = await request(path, undefined, owner.cookie);
  }
  assert.equal(result.status, 200);
  assert.equal(
    result.data.botsPending,
    false,
    'Expected the server to stop at remaining human setup decisions',
  );
  return result;
}

void test('autopilot HTTP: authentication, cross-origin and target injection reject without changing the room', async () => {
  const f = await fixture();
  const body = {
    version: f.view.version,
    action: { type: 'setAutopilot', difficulty: 'Hard' },
  };
  assert.equal((await request(f.path, body)).status, 409);
  assert.equal(
    (await request(f.path, body, `dune_${f.view.code}=${secret()}`)).status,
    409,
  );
  assert.equal(
    (await request(f.path, body, f.a.cookie, 'https://invalid.example')).status,
    403,
  );
  for (const targetField of ['target', 'playerId', 'player', 'id']) {
    const rejected = await action(f.path, f.view, f.b, {
      ...body.action,
      [targetField]: f.a.id,
    });
    assert.equal(rejected.status, 409);
    assert.match(rejected.data.error ?? '', /only for your own seat/i);
  }
  for (const difficulty of ['Impossible', '', false, 0]) {
    const rejected = await action(f.path, f.view, f.a, {
      type: 'setAutopilot',
      difficulty,
    });
    assert.equal(rejected.status, 409);
  }
  const refreshed = await request(f.path, undefined, f.a.cookie);
  assert.equal(refreshed.status, 200);
  assert.deepEqual(refreshed.data, f.view);
});

void test('autopilot HTTP: mode is public, setup is paced, and private cards survive refresh', async () => {
  const f = await fixture();
  const before = own(f.view);
  const enabled = await enable(f);
  assert.equal(enabled.status, 200);
  assert.equal(enabled.data.status, 'setup');
  assert.equal(enabled.data.version, f.view.version + 1);
  assert.equal(own(enabled.data).autopilot, 'Hard');
  assert.equal(own(enabled.data).bot, undefined);
  assert.deepEqual(own(enabled.data).hand, before.hand);
  assert.equal(
    own(enabled.data).traitors!.length,
    0,
    'Opt-in must not execute an immediate AI action',
  );
  assert.ok(enabled.data.botNextActionAt);
  const settled = await waitForBotPause(f.path, f.a);
  assert.equal(own(settled.data).traitors!.length, 1);
  assert.equal(own(settled.data).traitorChoices!.length, 0);
  assert.ok(settled.data.version > enabled.data.version);
  for (const owner of [f.a, f.b, f.c]) {
    const refreshed = await request(f.path, undefined, owner.cookie);
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.cache, 'no-store');
    assert.equal(refreshed.data.me, owner.id);
    assert.equal(refreshed.data.status, 'setup');
    assert.equal(refreshed.data.version, settled.data.version);
    assert.equal(
      refreshed.data.players.find((p) => p.id === f.a.id)!.autopilot,
      'Hard',
    );
    assertPrivate(refreshed.data);
    if (owner.id === f.a.id) assert.deepEqual(refreshed.data, settled.data);
    else {
      assert.equal(own(refreshed.data).traitorChoices!.length, 4);
      assert.equal(own(refreshed.data).traitors!.length, 0);
    }
  }
  const back = await action(f.path, settled.data, f.a, {
    type: 'setAutopilot',
    difficulty: null,
  });
  assert.equal(back.status, 200);
  for (const owner of [f.b, f.c]) {
    const current = await request(f.path, undefined, owner.cookie);
    assert.equal(current.status, 200);
    const chosen = await action(f.path, current.data, owner, {
      type: 'traitor',
      leader: own(current.data).traitorChoices![0],
    });
    assert.equal(chosen.status, 200);
  }
  for (const owner of [f.a, f.b, f.c]) {
    const dealt = await request(f.path, undefined, owner.cookie);
    assert.equal(dealt.status, 200);
    assert.equal(dealt.data.status, 'playing');
    assertPrivate(dealt.data);
    const refreshed = await request(f.path, undefined, owner.cookie);
    assert.equal(refreshed.status, 200);
    assert.deepEqual(refreshed.data, dealt.data);
  }
});

void test('autopilot HTTP: owner game decisions are blocked while advancement and take-back remain available', async () => {
  const f = await fixture();
  const enabled = await enable(f, 'Medium');
  assert.equal(enabled.status, 200);
  const rejected = await action(f.path, enabled.data, f.a, {
    type: 'traitor',
    leader: own(f.view).traitorChoices![0],
  });
  assert.equal(rejected.status, 409);
  assert.match(rejected.data.error ?? '', /take back control/i);
  const unchanged = await request(f.path, undefined, f.a.cookie);
  assert.deepEqual(unchanged.data, enabled.data);
  const advanced = await action(f.path, unchanged.data, f.a, {
    type: 'advanceBots',
  });
  assert.equal(advanced.status, 200);
  assert.equal(advanced.data.status, 'setup');
  const back = await action(f.path, advanced.data, f.a, {
    type: 'setAutopilot',
    difficulty: null,
  });
  assert.equal(back.status, 200);
  assert.equal(own(back.data).autopilot, undefined);
  assert.equal(own(back.data).bot, undefined);
  assert.deepEqual(own(back.data).hand, own(f.view).hand);
  assert.equal(back.data.status, 'setup');
});

void test('autopilot HTTP: competing mode writes commit once and stale take-back cannot override the winner', async () => {
  const f = await fixture();
  const raced = await Promise.all([enable(f, 'Easy'), enable(f, 'Brutal')]);
  assert.deepEqual(
    raced.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  const winner = raced.find((r) => r.status === 200)!;
  assert.equal(winner.data.version, f.view.version + 1);
  const stale = await action(f.path, f.view, f.a, {
    type: 'setAutopilot',
    difficulty: null,
  });
  assert.equal(stale.status, 409);
  const refreshed = await waitForBotPause(f.path, f.a);
  assert.equal(refreshed.status, 200);
  assert.equal(own(refreshed.data).autopilot, own(winner.data).autopilot);
  assert.ok(refreshed.data.version > winner.data.version);
  assert.equal(own(refreshed.data).traitors!.length, 1);
  assert.equal(refreshed.data.status, 'setup');
});

void test('autopilot HTTP: recovery rotates credentials while delegated; recovered owner takes back and submits a human storm dial', async () => {
  const f = await fixture();
  const queued = await enable(f);
  assert.equal(queued.status, 200);
  const enabled = await waitForBotPause(f.path, f.a);
  const recoverySecret = secret();
  const configured = await request(
    f.path + '/control',
    {
      type: 'setRecoveryKey',
      version: enabled.data.version,
      recoverySecret,
    },
    f.a.cookie,
  );
  assert.equal(configured.status, 200);
  assert.equal(configured.data.recoveryConfigured, true);
  assert.equal(own(configured.data.view).autopilot, 'Hard');
  const newSessionToken = secret();
  const body = {
    type: 'recoverSeat',
    playerId: f.a.id,
    recoverySecret,
    operationId: randomUUID(),
    newSessionToken,
  };
  const recovered = await request(f.path + '/control', body);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.replayed, false);
  assert.equal(recovered.cache, 'no-store');
  assert.ok(recovered.cookie?.includes('HttpOnly'));
  assert.ok(recovered.cookie?.includes('SameSite=Strict'));
  assert.ok(recovered.cookie?.includes(`Path=${f.path}`));
  const recoveredSeat = {
    id: f.a.id,
    cookie: recovered.cookie!.split(';')[0],
  };
  assert.equal(recoveredSeat.cookie === f.a.cookie, false);
  assert.deepEqual(
    { ...recovered.data.view, version: 0 },
    { ...configured.data.view, version: 0 },
  );
  assert.equal(recovered.data.view.version, configured.data.view.version + 1);
  const replay = await request(f.path + '/control', body);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.cookie === recovered.cookie, true);
  assert.deepEqual(replay.data.view, recovered.data.view);
  assert.equal((await request(f.path, undefined, f.a.cookie)).status, 409);
  const staleOwner = await action(f.path, recovered.data.view, f.a, {
    type: 'setAutopilot',
    difficulty: null,
  });
  assert.equal(staleOwner.status, 409);
  const refreshed = await request(f.path, undefined, recoveredSeat.cookie);
  assert.equal(refreshed.status, 200);
  assert.deepEqual(refreshed.data, recovered.data.view);
  for (const view of [
    refreshed.data,
    (await request(f.path, undefined, f.b.cookie)).data,
  ]) {
    assertPrivate(view);
    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes(recoverySecret), false);
    assert.equal(serialized.includes(newSessionToken), false);
  }
  const back = await action(f.path, refreshed.data, recoveredSeat, {
    type: 'setAutopilot',
    difficulty: null,
  });
  assert.equal(back.status, 200);
  assert.equal(own(back.data).autopilot, undefined);
  assert.equal(back.data.me, f.a.id);
  assert.deepEqual(own(back.data).hand, own(f.view).hand);
  // Finish only the two held human choices, then prove restored gameplay authority.
  for (const owner of [f.b, f.c]) {
    const current = await request(f.path, undefined, owner.cookie);
    const chosen = await action(f.path, current.data, owner, {
      type: 'traitor',
      leader: own(current.data).traitorChoices![0],
    });
    assert.equal(chosen.status, 200);
  }
  const playing = await request(f.path, undefined, recoveredSeat.cookie);
  assert.equal(playing.data.status, 'playing');
  assert.equal(playing.data.phase, 0);
  assertPrivate(playing.data);
  assert.ok(playing.data.stormDialers.includes(f.a.id));
  const dialed = await action(f.path, playing.data, recoveredSeat, {
    type: 'stormDial',
    amount: 0,
  });
  assert.equal(dialed.status, 200);
  assert.ok(dialed.data.stormSubmitted.includes(f.a.id));
  assert.equal(own(dialed.data).autopilot, undefined);
  assertPrivate(dialed.data);
  assert.deepEqual(own(dialed.data).hand, own(playing.data).hand);
  const reconnected = await request(f.path, undefined, recoveredSeat.cookie);
  assert.equal(reconnected.status, 200);
  assert.deepEqual(reconnected.data, dialed.data);
});

void test(
  'autopilot HTTP: all delegated humans progress at persisted intervals through GET recovery, then can take back control',
  { timeout: 20_000 },
  async (t) => {
    const f = await fixture();
    let view = f.view;
    for (const [owner, difficulty] of [
      [f.a, 'Hard'],
      [f.b, 'Medium'],
      [f.c, 'Brutal'],
    ] as const) {
      const result = await action(f.path, view, owner, {
        type: 'setAutopilot',
        difficulty,
      });
      assert.equal(result.status, 200);
      view = result.data;
    }
    const startingVersion = view.version;
    let due = view.botNextActionAt!;
    assert.ok(due);
    let transitions = 0;
    const deadline = Date.now() + 12_000;
    while (view.status === 'setup' && Date.now() < deadline) {
      await pause(100);
      const read = await request(f.path, undefined, f.a.cookie);
      assert.equal(read.status, 200);
      assertPrivate(read.data);
      assert.ok(read.data.version >= view.version);
      if (read.data.botNextActionAt && read.data.botNextActionAt > due) {
        assert.ok(
          read.data.botNextActionAt - due >= 1500,
          'The server may not shorten the persisted AI interval',
        );
        due = read.data.botNextActionAt;
        transitions++;
      }
      view = read.data;
    }
    assert.equal(view.status, 'playing');
    assert.ok(view.version >= startingVersion + 3);
    assert.ok(transitions >= 2);
    for (const owner of [f.a, f.b, f.c]) {
      let accepted = false;
      for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
        const latest = await request(f.path, undefined, owner.cookie);
        const back = await action(f.path, latest.data, owner, {
          type: 'setAutopilot',
          difficulty: null,
        });
        if (back.status === 409) continue;
        assert.equal(back.status, 200);
        assert.equal(own(back.data).autopilot, undefined);
        accepted = true;
      }
      assert.ok(accepted, 'A human owner must be able to retake control');
    }
    const stopped = await request(f.path, undefined, f.a.cookie);
    assert.equal(stopped.data.botsPending, false);
    assert.equal(stopped.data.botNextActionAt, null);
    assert.ok(stopped.data.players.every((p) => !p.bot && !p.autopilot));
    t.diagnostic(
      `${transitions} visible paced AI steps; full delegated-game completion uses trusted fake-clock production persistence in paced-games.test.ts.`,
    );
  },
);
