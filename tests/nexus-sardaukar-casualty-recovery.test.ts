import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import {
  nexusSardaukarFixture,
  nexusSardaukarInventory,
  beginNexusSardaukar,
  allowNexusSardaukar,
  prepareSardaukarBattle,
} from './fixture-nexus-sardaukar';

const clock = { now: () => 10000, sleep: async () => {} };
const choice = (index: number) => ({ type: 'decision', choice: index });

function resolvedVictory(): Game {
  let g = prepareSardaukarBattle(
    allowNexusSardaukar(beginNexusSardaukar(nexusSardaukarFixture())),
  );
  const [owner, opponent] = g.players;
  const leader = [...owner.leaders].sort((a, b) => b.strength - a.strength)[0];
  const opposing = [...opponent.leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0];
  g = applyAction(g, owner.id, {
    type: 'battlePlan',
    dial: 6,
    support: 3,
    leader: leader.id,
  });
  g = applyAction(g, opponent.id, {
    type: 'battlePlan',
    dial: 0,
    leader: opposing.id,
  });
  for (const id of [owner.id, opponent.id])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  assert.equal(g.battle, null);
  assert.equal(g.decision?.kind, 'battleLosses');
  assert.deepEqual(
    g.decision.options.map((loss) => [loss.normal, loss.elite]),
    [
      [3, 0],
      [4, 0],
      [5, 0],
    ],
  );
  nexusSardaukarInventory(g);
  return g;
}

async function fixture() {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Sardaukar casualties',
    'emperor',
    true,
    [],
  );
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  // Bind disposable authentication seats to already-final fixture identities;
  // no game identity or signed source history is rewritten after setup.
  for (const [index, token] of tokens.entries()) {
    const auth = await store.rooms.authenticate(code, token);
    store.sqlite
      .prepare(
        'UPDATE seats SET player_id = ? WHERE room_code = ? AND player_id = ?',
      )
      .run(['p', 'q', 'r'][index], code, auth.playerId);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const initial = resolvedVictory();
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, auths, initial };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);

async function restored(f: Fixture, g: Game) {
  const before = row(f);
  assert.deepEqual(normalizeAutomaticGame(structuredClone(g)), g);
  for (const auth of f.auths) {
    const projected = await f.restart().readSeatView(f.code, auth);
    assert.deepEqual(projected, viewGame(g, auth.playerId));
    assert.doesNotMatch(
      JSON.stringify(projected),
      /nexusSardaukarHistory|nexusSardaukarCasualties/,
    );
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusSardaukarInventory(g);
}

void test('SQLite restores each committed Emperor casualty choice before and after ordinary-counter settlement', async () => {
  for (const [index, losses] of [3, 4, 5].entries()) {
    const f = await fixture();
    try {
      await restored(f, f.initial);
      await f
        .restart()
        .act(f.code, f.auths[0], f.initial.version, choice(index), clock);
      const done = await f.restart().readRoom(f.code);
      assert.equal(done.players[0].tanks, losses);
      assert.equal(done.players[0].forces['pasty_mesa:5'], 7 - losses);
      assert.equal(done.players[0].elites!.tanks, 0);
      assert.equal(done.players[0].elites!.reserves, 5);
      assert.equal(
        done.nexusSardaukarHistory![0].casualties!.outcome,
        'complete',
      );
      await restored(f, done);
      const before = row(f);
      await assert.rejects(
        f.restart().act(f.code, f.auths[0], done.version, choice(index), clock),
      );
      assert.deepEqual(row(f), before);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('SQLite competing different legal casualty allocations settle one physical group exactly once', async () => {
  const f = await fixture();
  try {
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.hooks.beforeWrite = async () => {
      if (++arrived === 2) release();
      await gate;
    };
    const attempts = await Promise.allSettled(
      [0, 2].map((index) =>
        f
          .restart()
          .act(f.code, f.auths[0], f.initial.version, choice(index), clock),
      ),
    );
    delete f.hooks.beforeWrite;
    assert.equal(
      attempts.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    assert.ok([3, 5].includes(done.players[0].tanks));
    await restored(f, done);
    const before = row(f);
    await assert.rejects(
      f.restart().act(f.code, f.auths[0], f.initial.version, choice(0), clock),
    );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite edited winner costs, effective roles or missing casualty proof reject every read and action without writes', async () => {
  const f = await fixture();
  try {
    const edits: [string, (g: Game) => void][] = [
      [
        'available but illegal normal loss',
        (g) => {
          if (g.decision?.kind === 'battleLosses')
            g.decision.options[0].normal = 6;
        },
      ],
      [
        'support allocation',
        (g) => {
          if (g.decision?.kind === 'battleLosses')
            g.decision.options[0].paidNormal = 0;
        },
      ],
      [
        'effective temporary role',
        (g) => {
          delete g.nexusSardaukarHistory![0].casualties!.forces.temporaryElite;
        },
      ],
      [
        'forged completion',
        (g) => {
          g.nexusSardaukarHistory![0].casualties!.outcome = 'complete';
        },
      ],
      [
        'missing choice',
        (g) => {
          g.decision = null;
        },
      ],
      [
        'missing casualty receipt',
        (g) => {
          delete g.nexusSardaukarHistory![0].casualties;
        },
      ],
      [
        'missing independent battle marker',
        (g) => {
          delete g.lastBattleContext!.nexusSardaukarCasualties;
        },
      ],
      [
        'missing history',
        (g) => {
          delete g.nexusSardaukarHistory;
        },
      ],
      [
        'missing history and latest outcome',
        (g) => {
          delete g.nexusSardaukarHistory;
          delete g.nexusSardaukarLast;
        },
      ],
    ];
    for (const [label, edit] of edits) {
      const bad = structuredClone(f.initial);
      edit(bad);
      const snapshot = JSON.stringify(bad);
      for (const auth of f.auths)
        assert.throws(() => viewGame(bad, auth.playerId), /./, label);
      assert.throws(() => normalizeAutomaticGame(bad), /./, label);
      assert.throws(() => applyAction(bad, 'p', choice(0)), /./, label);
      assert.equal(JSON.stringify(bad), snapshot, label);
      f.sqlite
        .prepare('UPDATE rooms SET state = ? WHERE code = ?')
        .run(snapshot, f.code);
      f.writes.length = 0;
      const before = row(f);
      for (const auth of f.auths)
        await assert.rejects(
          f.restart().readSeatView(f.code, auth),
          /./,
          label,
        );
      await assert.rejects(
        f.restart().act(f.code, f.auths[0], bad.version, choice(0), clock),
        /./,
        label,
      );
      await f
        .restart()
        .continueRoomAutomatic(f.code, clock)
        .catch(() => {});
      assert.deepEqual(row(f), before, label);
      assert.equal(f.writes.length, 0, label);
    }
  } finally {
    f.sqlite.close();
  }
});
