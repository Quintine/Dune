import test from 'node:test';
import type { GameView } from '../game/engine';
import assert from 'node:assert/strict';
const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, body?: unknown, cookie?: string) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await r.json()) as GameView & { error?: string };
  return {
    status: r.status,
    data,
    cookie: r.headers.get('set-cookie')?.split(';')[0] ?? cookie,
  };
}
// Each response decision belongs to its authenticated viewer. Public response
// projections intentionally do not disclose which other seats already allowed it.
async function allowResponses(path: string, seats: { cookie?: string }[]) {
  let game = (await request(path, undefined, seats[0].cookie)).data;
  for (let steps = 0; game.response && steps < 64; steps++) {
    let submitted = false;
    for (const seat of seats) {
      const read = await request(path, undefined, seat.cookie);
      assert.equal(read.status, 200, JSON.stringify(read.data));
      game = read.data;
      if (!game.response) return game; // Already completed by authoritative normalization.
      assert.ok(game.response.passed.every((id) => id === game.me));
      const controls = game.responseControls;
      assert.ok(controls, 'A pending response supplies private controls.');
      const ownHand = game.players.find((p) => p.id === game.me)!.hand!;
      assert.ok(
        controls.cancelCards.every((id) =>
          ownHand.some((card) => card.id === id),
        ),
      );
      if (!controls.cancelCards.length || controls.hasPassed) continue;
      const result = await request(
        path,
        {
          version: game.version,
          action: { type: 'passResponse' },
        },
        seat.cookie,
      );
      assert.equal(result.status, 200, JSON.stringify(result.data));
      game = result.data;
      submitted = true;
      break;
    }
    if (!submitted) {
      const refreshed = await request(path, undefined, seats[0].cookie);
      assert.equal(refreshed.status, 200, JSON.stringify(refreshed.data));
      game = refreshed.data;
      assert.equal(
        game.response,
        null,
        'A response with no remaining eligible viewer must settle automatically.',
      );
    }
  }
  assert.equal(game.response, null, 'Response chain must terminate.');
  return game;
}
void test('two independent seats, reconnect, private state and concurrent updates', async () => {
  const a = await request('/api/rooms', {
    name: 'Integration Atreides',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.ok(a.cookie);
  const path = `/api/rooms/${a.data.code}`;
  const b = await request(path, {
    type: 'join',
    name: 'Integration Harkonnen',
    faction: 'harkonnen',
  });
  assert.equal(b.status, 200, JSON.stringify(b.data));
  assert.notEqual(a.cookie, b.cookie);
  const stranger = await request(path);
  assert.equal(stranger.status, 409);
  const impersonator = await request(
    path,
    { version: 1, action: { type: 'ready' } },
    'dune_invalid=bad',
  );
  assert.equal(impersonator.status, 409);
  let read = await request(path, undefined, a.cookie);
  assert.equal(read.data.players.length, 2);
  const concurrent = await Promise.all([
    request(
      path,
      { version: read.data.version, action: { type: 'ready' } },
      a.cookie,
    ),
    request(
      path,
      { version: read.data.version, action: { type: 'ready' } },
      b.cookie,
    ),
  ]);
  assert.deepEqual(
    concurrent.map((x) => x.status).sort((a, b) => a - b),
    [200, 409],
  );
  for (const seat of [a, b]) {
    read = await request(path, undefined, seat.cookie);
    if (!read.data.players.find((p) => p.id === read.data.me)!.ready) {
      const next = await request(
        path,
        { version: read.data.version, action: { type: 'ready' } },
        seat.cookie,
      );
      assert.equal(next.status, 200);
    }
  }
  read = await request(path, undefined, a.cookie);
  const start = await request(
    path,
    { version: read.data.version, action: { type: 'start' } },
    a.cookie,
  );
  assert.equal(start.status, 200, JSON.stringify(start.data));
  assert.equal(start.data.status, 'setup');
  const own = start.data.players.find((p) => p.id === start.data.me),
    other = start.data.players.find((p) => p.id !== start.data.me);
  assert.equal(start.data.setupStage, 'traitors');
  assert.equal(own!.hand!.length, 0);
  assert.equal(other!.hand, undefined);
  assert.equal(other!.spice, undefined);
  assert.equal(other!.traitors, undefined);
  assert.equal('deck' in start.data, false);
  const resumed = await request(path, undefined, b.cookie);
  assert.equal(
    resumed.data.players.find((p) => p.id === resumed.data.me)!.hand!.length,
    0,
  );
  const chosen = await request(
    path,
    {
      version: resumed.data.version,
      action: { type: 'traitor', leader: own!.traitorChoices![0] },
    },
    a.cookie,
  );
  assert.equal(chosen.status, 200);
  assert.equal(chosen.data.status, 'playing');
  assert.equal(
    chosen.data.players.find((p) => p.id === a.data.me)!.hand!.length,
    1,
  );
  for (const seat of [a, b]) {
    const dealt = await request(path, undefined, seat.cookie);
    assert.equal(dealt.status, 200);
    assert.equal(
      dealt.data.players.find((p) => p.id === dealt.data.me)!.hand!.length,
      seat === a ? 1 : 2,
    );
    for (const p of dealt.data.players.filter((p) => p.id !== dealt.data.me)) {
      assert.equal(p.hand, undefined);
      assert.equal(p.traitors, undefined);
      assert.equal(p.spice, undefined);
    }
    const refreshed = await request(path, undefined, seat.cookie);
    assert.equal(refreshed.status, 200);
    assert.deepEqual(refreshed.data, dealt.data);
  }
  const invalid = await request(
    path,
    {
      version: chosen.data.version,
      action: { type: 'ship', amount: -5, territory: 'arrakeen', sector: 10 },
    },
    a.cookie,
  );
  assert.equal(invalid.status, 409);
  const after = await request(path, undefined, a.cookie);
  assert.equal(after.data.version, chosen.data.version);

  let game = after.data;
  const play = async (id: string, action: object) => {
    const seat = id === a.data.me ? a : b;
    const result = await request(
      path,
      { version: game.version, action },
      seat.cookie,
    );
    assert.equal(result.status, 200, JSON.stringify(result.data));
    game = result.data;
  };
  for (const id of game.stormDialers)
    await play(id, { type: 'stormDial', amount: 0 });
  for (let steps = 0; game.phase !== 5 && steps < 60; steps++) {
    if (game.response) game = await allowResponses(path, [a, b]);
    else if (game.phase === 3)
      await play(game.auction!.active, { type: 'passBid' });
    else
      await play(game.players.find((p) => !game.ready.includes(p.id))!.id, {
        type: 'ready',
      });
  }
  assert.equal(game.phase, 5);
  game = await allowResponses(path, [a, b]);
  while (game.phase === 5) {
    const id = game.active!;
    if (id === b.data.me)
      await play(id, {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      });
    await play(id, { type: 'endMovement' });
  }
  assert.equal(game.phase, 6);
  await play(game.active!, {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: game.active === a.data.me ? b.data.me : a.data.me,
  });
  assert.equal(game.battle!.preparation!.owner, a.data.me);
  await play(a.data.me, { type: 'prescience', field: 'dial' });
  game = await allowResponses(path, [a, b]);
  await play(b.data.me, { type: 'prescienceAnswer', value: 0 });
  const foresight = await request(path, undefined, a.cookie);
  assert.equal(foresight.data.battle!.insight!.value, 0);
  assert.deepEqual(foresight.data.battle!.plans, {});
  const changedElement = await request(
    path,
    {
      version: game.version,
      action: { type: 'battlePlan', dial: 1, leader: 'harkonnen-0' },
    },
    b.cookie,
  );
  assert.equal(changedElement.status, 409);
  await play(b.data.me, { type: 'battlePlan', dial: 0, leader: 'harkonnen-0' });
  const privatePlan = await request(path, undefined, a.cookie);
  assert.equal(privatePlan.data.battle!.plans[b.data.me], undefined);
  await play(a.data.me, { type: 'battlePlan', dial: 0, leader: 'atreides-0' });
  assert.equal(game.battle!.revealed, true);
  await play(a.data.me, { type: 'traitorCall', call: false });
  await play(b.data.me, { type: 'traitorCall', call: false });
  assert.equal(game.battle, null);
  assert.equal(game.phase, 7);
});

void test('six seats complete setup and share an authoritative BG reaction across reconnects', async () => {
  const factions = [
    'atreides',
    'harkonnen',
    'emperor',
    'fremen',
    'guild',
    'beneGesserit',
  ];
  const seats = [
    await request('/api/rooms', {
      name: 'Six-seat Atreides',
      faction: factions[0],
      advanced: false,
      expansions: [],
    }),
  ];
  assert.equal(seats[0].status, 201);
  const path = `/api/rooms/${seats[0].data.code}`;
  for (const faction of factions.slice(1)) {
    const seat = await request(path, {
      type: 'join',
      name: `Six-seat ${faction}`,
      faction,
    });
    assert.equal(seat.status, 200, JSON.stringify(seat.data));
    seats.push(seat);
  }
  assert.equal(new Set(seats.map((s) => s.cookie)).size, 6);
  let game = (await request(path, undefined, seats[0].cookie)).data;
  const play = async (id: string, action: object) => {
    const seat = seats.find((s) => s.data.me === id)!;
    const response = await request(
      path,
      { version: game.version, action },
      seat.cookie,
    );
    assert.equal(response.status, 200, JSON.stringify(response.data));
    game = response.data;
    return game;
  };
  for (const seat of seats) await play(seat.data.me, { type: 'ready' });
  await play(seats[0].data.me, { type: 'start' });
  assert.equal(game.setupStage, 'prediction');
  for (const seat of seats) {
    const read = await request(path, undefined, seat.cookie);
    assert.equal(read.status, 200);
    const me = read.data.players.find((p) => p.id === read.data.me)!;
    assert.deepEqual(me.hand, []);
    assert.deepEqual(me.traitors, []);
    assert.deepEqual(me.traitorChoices, []);
  }
  await play(seats[5].data.me, {
    type: 'predict',
    faction: 'atreides',
    turn: 3,
  });
  for (const seat of seats) {
    const read = await request(path, undefined, seat.cookie);
    const me = read.data.players.find((p) => p.id === read.data.me)!;
    if (me.traitorChoices?.length)
      await play(me.id, { type: 'traitor', leader: me.traitorChoices[0] });
  }
  assert.equal(game.setupStage, 'forces');
  await play(seats[3].data.me, {
    type: 'fremenSetup',
    placements: {
      sietch_tabr: 10,
      false_wall_south: 0,
      false_wall_west: 0,
    },
  });
  assert.equal(game.status, 'playing');
  for (const id of game.stormDialers)
    await play(id, { type: 'stormDial', amount: 0 });
  for (let steps = 0; game.phase !== 5 && steps < 80; steps++) {
    if (game.response) game = await allowResponses(path, seats);
    else if (game.phase === 3)
      await play(game.auction!.active, { type: 'passBid' });
    else
      await play(game.players.find((p) => !game.ready.includes(p.id))!.id, {
        type: 'ready',
      });
  }
  assert.equal(game.phase, 5);
  game = await allowResponses(path, seats);
  for (let step = 0; step < 6; step++) {
    const active = game.players.find((p) => p.id === game.active)!;
    if (!['fremen', 'beneGesserit'].includes(active.faction)) break;
    await play(active.id, { type: 'endMovement' });
  }
  const shipper = game.active!;
  await play(shipper, {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(game.decision?.kind, 'advisor');
  game = await allowResponses(path, seats);
  const bg = seats.find(
    (s) =>
      s.data.players.find((p) => p.id === s.data.me)?.faction ===
      'beneGesserit',
  )!;
  const reconnected = await request(path, undefined, bg.cookie);
  assert.equal(reconnected.data.decision?.player, bg.data.me);
  assert.equal(
    reconnected.data.players.find((p) => p.id === shipper)!.hand,
    undefined,
  );
  const wrong = await request(
    path,
    { version: game.version, action: { type: 'decision', accept: true } },
    seats.find((s) => s.data.me === shipper)!.cookie,
  );
  assert.equal(wrong.status, 409);
  const concurrent = await Promise.all(
    [true, false].map((accept) =>
      request(
        path,
        { version: game.version, action: { type: 'decision', accept } },
        bg.cookie,
      ),
    ),
  );
  assert.deepEqual(
    concurrent.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  game = concurrent.find((r) => r.status === 200)!.data;
  assert.equal(game.decision, null);
  game = await allowResponses(path, seats);
  await play(shipper, { type: 'endMovement' });
  const readers = await Promise.all(
    seats.map((s) => request(path, undefined, s.cookie)),
  );
  assert.ok(
    readers.every(
      (r) => r.data.version === game.version && r.data.decision === null,
    ),
  );
  assert.ok(
    readers.every((r) =>
      r.data.players.every(
        (p) =>
          p.id === r.data.me ||
          (p.hand === undefined &&
            p.spice === undefined &&
            p.traitors === undefined),
      ),
    ),
  );
});

for (const techEnabled of [false, true])
  void test(`host adds AI seats; paced ${techEnabled ? 'tech-token' : 'base'} setup progresses through HTTP without exposing bot secrets`, async () => {
    const seat = await request('/api/rooms', {
      name: 'Human host',
      faction: 'atreides',
      advanced: false,
      expansions: [],
    });
    assert.equal(seat.status, 201);
    const path = `/api/rooms/${seat.data.code}`;
    let game = seat.data;
    const play = async (action: object) => {
      const result = await request(
        path,
        { version: game.version, action },
        seat.cookie,
      );
      assert.equal(result.status, 200, JSON.stringify(result.data));
      game = result.data;
      for (const p of game.players.filter((p) => p.bot)) {
        assert.equal(p.hand, undefined);
        assert.equal(p.traitors, undefined);
        assert.equal(p.spice, undefined);
      }
    };
    for (const [faction, difficulty] of [
      ['harkonnen', 'Easy'],
      ['fremen', 'Medium'],
      ['emperor', 'Hard'],
      ['guild', 'Brutal'],
      ['beneGesserit', 'Hard'],
    ])
      await play({ type: 'addBot', faction, difficulty });
    assert.equal(game.players.length, 6);
    if (techEnabled) {
      await play({ type: 'techTokens', enabled: true });
      const reconnected = await request(path, undefined, seat.cookie);
      assert.deepEqual(reconnected.data.techTokens, game.techTokens);
      assert.equal(game.players.find((p) => p.id === game.me)!.ready, false);
    }
    await play({ type: 'ready' });
    await play({ type: 'start' });
    const queued = game;
    assert.equal(queued.botsPending, true);
    assert.ok(queued.botNextActionAt! > 0);
    const deadline = Date.now() + 10_000;
    while (game.version === queued.version && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const next = await request(path, undefined, seat.cookie);
      assert.equal(next.status, 200);
      game = next.data;
    }
    assert.ok(
      game.version > queued.version,
      'Native AI must progress via the paced server worker',
    );
    assert.equal(game.players.filter((p) => p.bot).length, 5);
    for (const p of game.players.filter((p) => p.bot)) {
      assert.equal(p.hand, undefined);
      assert.equal(p.traitors, undefined);
      assert.equal(p.spice, undefined);
    }
    if (techEnabled) assert.deepEqual(game.techTokens, queued.techTokens);
    // Full base/tech completion now runs against this same production room module
    // with a trusted fake clock in paced-games.test.ts. No HTTP fast mode exists.
  });

void test('player circles persist across reconnect and competing seat choices cannot share a circle', async () => {
  const a = await request('/api/rooms', {
    name: 'Circle host',
    faction: 'atreides',
    advanced: false,
    expansions: [],
  });
  assert.equal(a.status, 201);
  const path = `/api/rooms/${a.data.code}`;
  const b = await request(path, {
    type: 'join',
    name: 'Circle guest',
    faction: 'harkonnen',
  });
  assert.equal(b.status, 200);
  let current = await request(path, undefined, a.cookie);
  const seats = [a, b];
  assert.deepEqual(current.data.playerPositions, {
    [a.data.me]: 1,
    [b.data.me]: 2,
  });
  const conflict = await Promise.all(
    seats.map((seat) =>
      request(
        path,
        {
          version: current.data.version,
          action: { type: 'seatPosition', position: 6 },
        },
        seat.cookie,
      ),
    ),
  );
  assert.deepEqual(
    conflict.map((result) => result.status).sort((a, b) => a - b),
    [200, 409],
  );
  const winnerIndex = conflict.findIndex((result) => result.status === 200);
  const winner = seats[winnerIndex];
  const loser = seats[1 - winnerIndex];
  current = await request(path, undefined, loser.cookie);
  assert.equal(current.data.playerPositions[winner.data.me], 6);
  assert.equal(new Set(Object.values(current.data.playerPositions)).size, 2);
  const stored = structuredClone(current.data.playerPositions);
  const occupied = await request(
    path,
    {
      version: current.data.version,
      action: { type: 'seatPosition', position: 6 },
    },
    loser.cookie,
  );
  assert.equal(occupied.status, 409);
  const forged = await request(
    path,
    {
      version: current.data.version,
      action: { type: 'seatPosition', position: 5, target: winner.data.me },
    },
    loser.cookie,
  );
  assert.equal(forged.status, 409);
  const recovered = await request(path, undefined, winner.cookie);
  assert.equal(recovered.data.version, current.data.version);
  assert.deepEqual(recovered.data.playerPositions, stored);
  assert.equal('deck' in recovered.data, false);
  assert.equal('discard' in recovered.data, false);
  assert.equal(
    recovered.data.players.find((p) => p.id === loser.data.me)?.hand,
    undefined,
  );
});
