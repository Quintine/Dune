import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import {
  nexusEmperorSecretAllyFixture,
  emperorNexusPhysical,
} from './nexus-emperor-secret-ally-fixture';
import { viewGame, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const rows = (db: DatabaseSync) =>
  db.prepare('SELECT state,version FROM rooms ORDER BY code').all();

async function fixture(
  t: test.TestContext,
  advanced: boolean,
  owner: 'p' | 'q',
) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    'Emperor Nexus recovery',
    'fremen',
    advanced,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId) as [string, string, string];
  const f = nexusEmperorSecretAllyFixture({
    advanced,
    owner,
    seatIds: ids,
    eliteTanks: owner === 'p' ? 2 : 0,
  });
  f.g.code = code;
  f.g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(f.g), f.g.version, code);
  store.writes.length = 0;
  return {
    ...store,
    ...f,
    code,
    tokens,
    auths,
    ids,
    ownerIndex: owner === 'p' ? 0 : 1,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function restored(f: Fixture, expected: Game) {
  const before = rows(f.sqlite);
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(expected, f.ids[index]));
    assert.equal('nexusEmperorSecretHistory' in view, false);
    assert.equal('nexusEmperorSecretEvents' in view, false);
    if (index !== f.ownerIndex) assert.equal(view.nexusEmperorSecretAlly, null);
    for (const rival of view.players.filter(
      (player) => player.id !== f.ids[index],
    )) {
      assert.equal('hand' in rival, false);
      assert.equal('spice' in rival, false);
    }
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(rows(f.sqlite), before);
}

void test('private Emperor revival survives SQLite restart and lost-response replay with exactly one physical return', async (t) => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced, advanced ? 'p' : 'q');
    const initial = f.g,
      owner = initial.players.find((player) => player.id === f.owner)!;
    const seats = f.sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();
    await restored(f, initial);
    const unchanged = rows(f.sqlite);
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[(f.ownerIndex + 1) % 3],
        initial.version,
        f.action,
        clock,
      ),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[f.ownerIndex],
        initial.version,
        { ...f.action, event: 'old' },
        clock,
      ),
    );
    await assert.rejects(
      f.rooms.act(
        f.code,
        f.auths[f.ownerIndex],
        initial.version,
        { ...f.action, amount: 2 },
        clock,
      ),
    );
    assert.deepEqual(rows(f.sqlite), unchanged);
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, f.tokens[f.ownerIndex]);
    await rooms.act(f.code, auth, initial.version, f.action, clock);
    const done = await f.restart().readRoom(f.code);
    const actual = done.players.find((player) => player.id === f.owner)!;
    assert.equal(done.version, initial.version + 1);
    assert.equal(actual.reserves, owner.reserves + 3);
    assert.equal(actual.tanks, owner.tanks - 3);
    assert.equal(actual.spice, owner.spice);
    assert.equal(actual.revived, owner.revived);
    assert.equal(actual.freeForcesRevived, owner.freeForcesRevived);
    assert.deepEqual(actual.hand, owner.hand);
    assert.deepEqual(actual.leaders, owner.leaders);
    assert.deepEqual(emperorNexusPhysical(done), emperorNexusPhysical(initial));
    assert.equal(done.nexusEmperorSecretHistory!.length, 1);
    assert.equal(done.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(
      done.nexusCards!.cards!.discard.filter((card) => card === 'emperor')
        .length,
      1,
    );
    if (advanced)
      assert.equal(actual.elites!.revived, owner.elites!.revived + 1);
    await restored(f, done);
    const saved = rows(f.sqlite);
    await assert.rejects(
      f.restart().act(f.code, auth, initial.version, f.action, clock),
      /table changed/,
    );
    await assert.rejects(
      f.restart().act(f.code, auth, done.version, f.action, clock),
    );
    assert.deepEqual(rows(f.sqlite), saved);
    assert.deepEqual(
      f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes),
      [1],
    );
  }
});

void test('competing normal/elite Emperor Nexus choices commit only one return and one discarded card', async (t) => {
  const f = await fixture(t, true, 'p');
  let arrivals = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  const timer = setTimeout(release, 2000);
  let outcomes: PromiseSettledResult<unknown>[];
  try {
    outcomes = await Promise.allSettled(
      [0, 1].map((elite) =>
        f
          .restart()
          .act(f.code, f.auths[0], f.g.version, { ...f.action, elite }, clock),
      ),
    );
  } finally {
    clearTimeout(timer);
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const done = await f.restart().readRoom(f.code),
    owner = done.players[0];
  assert.equal(done.version, f.g.version + 1);
  assert.equal(owner.reserves, f.g.players[0].reserves + 3);
  assert.equal(owner.tanks, f.g.players[0].tanks - 3);
  assert.ok(owner.elites!.revived === 0 || owner.elites!.revived === 1);
  assert.equal(done.nexusEmperorSecretHistory!.length, 1);
  assert.deepEqual(emperorNexusPhysical(done), emperorNexusPhysical(f.g));
  assert.deepEqual(
    f.writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
  await restored(f, done);
});
