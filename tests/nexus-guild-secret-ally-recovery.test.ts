import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import {
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import {
  nexusGuildSecretAllyFixture,
  nexusGuildSecretAllyInventory,
  nexusGuildSecretAllyRequest,
  nexusGuildSecretAllianceFixture,
} from './fixture-nexus-guild-secret-ally';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(homeworlds = false, alliance = false) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Guild Secret Ally SQL',
    'emperor',
    true,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['harkonnen', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((t) => store.rooms.authenticate(code, t)),
  );
  const ids = auths.map((a) => a.playerId) as [string, string, string];
  const f = alliance
    ? nexusGuildSecretAllianceFixture(ids)
    : nexusGuildSecretAllyFixture({
        seatIds: ids,
        ownerFaction: 'emperor',
        advanced: true,
        homeworlds,
      });
  f.g.code = code;
  f.g.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(f.g);
  store.writes.length = 0;
  return { ...store, ...f, code, tokens, auths, ids, save };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token),
      v = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(v, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(v, 'nexusGuildSecretHistory'), false);
    if (i !== 0) assert.equal(v.nexusGuildSecretAlly, null);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusGuildSecretAllyInventory(g);
}
async function act(f: Fixture, action: Action, seat = 0) {
  const g = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[seat], g.version, action, clock);
  return f.restart().readRoom(f.code);
}

void test('SQLite saves the genuine post-shipment Moritani alliance reply and cannot replay its shipment when accepting', async () => {
  const f = await fixture(false, true);
  try {
    let g = await act(f, nexusGuildSecretAllyRequest(f.g, f.owner));
    assert.equal(g.pendingTerrorEntry?.stage, 'offer');
    const spice = g.players[0].spice,
      reserves = g.players[0].reserves;
    g = await act(f, { type: 'decision', alliance: true }, 1);
    while (g.response)
      g = await act(
        f,
        { type: 'passResponse' },
        f.ids.indexOf(
          g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        ),
      );
    await restored(f, g);
    const accepted = await act(f, { type: 'decision', accept: true });
    assert.equal(accepted.players[0].ally, f.target);
    assert.equal(accepted.players[1].ally, f.owner);
    assert.equal(accepted.players[0].spice, spice);
    assert.equal(accepted.players[0].reserves, reserves);
    assert.equal(accepted.nexusGuildSecretHistory!.length, 1);
    await restored(f, accepted);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[0],
          accepted.version,
          { type: 'decision', accept: true },
          clock,
        ),
    );
    assert.deepEqual(row(f), before);
    const moved = await act(f, {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
    });
    assert.equal(moved.players[0].spice, spice);
    assert.equal(moved.players[0].reserves, reserves);
    assert.equal(moved.players[0].forces['hagga_basin:12'], 5);
    await restored(f, moved);
    const ended = await act(f, { type: 'endMovement' });
    assert.notEqual(ended.active, f.owner);
    await restored(f, ended);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite racing Guild Secret Ally commits one paid typed shipment and lost acknowledgment cannot repeat it', async () => {
  for (const homeworlds of [false, true]) {
    const f = await fixture(homeworlds);
    try {
      const other = await f.rooms.createRoom(
        'Unrelated SQL room',
        'atreides',
        false,
        [],
      );
      const otherRow = () =>
        f.sqlite
          .prepare('SELECT state,version FROM rooms WHERE code = ?')
          .get(other.view.code);
      const unrelated = otherRow();
      const action = nexusGuildSecretAllyRequest(
        f.g,
        f.owner,
        homeworlds
          ? {
              type: 'homeworldShip',
              event: viewGame(f.g, f.owner).homeworldShipment!.event,
              destination: 'homeworld:harkonnen',
              sources: {
                'homeworld:emperor': { normal: 3, elite: 0 },
                'homeworld:emperor:salusa': { normal: 0, elite: 2 },
              },
            }
          : {
              type: 'ship',
              territory: 'arrakeen',
              sector: 10,
              amount: 5,
              elite: 2,
            },
      );
      let arrivals = 0,
        release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      f.hooks.beforeWrite = async () => {
        if (++arrivals === 2) release();
        await gate;
      };
      const timer = setTimeout(release, 2000);
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          f.restart().act(f.code, f.auths[0], f.g.version, action, clock),
        ),
      );
      clearTimeout(timer);
      delete f.hooks.beforeWrite;
      assert.equal(arrivals, 2);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.deepEqual(
        f.writes.map((w) => w.changes).sort((a, b) => a - b),
        [0, 1],
      );
      const done = await f.restart().readRoom(f.code);
      assert.equal(done.players[0].spice, 17);
      assert.equal(done.players[0].reserves, 15);
      assert.equal(done.players[0].elites!.reserves, 3);
      assert.equal(done.nexusGuildSecretHistory!.length, 1);
      assert.equal(
        done.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
        1,
      );
      if (homeworlds)
        assert.deepEqual(
          done.homeworlds!.custody!.visitors['homeworld:harkonnen'][f.owner],
          { normal: 3, elite: 2 },
        );
      else assert.equal(done.players[0].elites!.forces['arrakeen:10'], 2);
      await restored(f, done);
      const before = row(f);
      await assert.rejects(
        f.restart().act(f.code, f.auths[0], done.version, action, clock),
      );
      assert.deepEqual(row(f), before);
      assert.deepEqual(otherRow(), unrelated);
    } finally {
      f.sqlite.close();
    }
  }
});

void test('SQLite saved Guild Secret Ally completion preserves native movement and does not reread held Nexus identity', async () => {
  const f = await fixture();
  try {
    const shipped = await act(
      f,
      nexusGuildSecretAllyRequest(f.g, f.owner, {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 5,
        elite: 2,
      }),
    );
    await restored(f, shipped);
    const moved = await act(f, {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
      elite: 2,
    });
    assert.equal(moved.players[0].spice, 17);
    assert.equal(moved.players[0].reserves, 15);
    assert.equal(moved.players[0].elites!.forces['hagga_basin:12'], 2);
    assert.equal(moved.players[0].moved, 1);
    await restored(f, moved);
    const ended = await act(f, { type: 'endMovement' });
    assert.notEqual(ended.active, f.owner);
    await restored(f, ended);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite damaged Guild Secret Ally terminal route proofs reject all projections and actions without writes', async () => {
  const f = await fixture(true);
  try {
    const done = await act(
      f,
      nexusGuildSecretAllyRequest(f.g, f.owner, {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 5,
        elite: 2,
        homeworldSources: {
          'homeworld:emperor': { normal: 3, elite: 0 },
          'homeworld:emperor:salusa': { normal: 0, elite: 2 },
        },
      }),
    );
    const editFrame = (
      g: Game,
      edit: (frame: Record<string, unknown>) => void,
    ) => {
      const record = g.nexusGuildSecretHistory![0];
      const frame = JSON.parse(record.frame) as Record<string, unknown>;
      edit(frame);
      record.frame = JSON.stringify(frame);
    };
    for (const edit of [
      (g: Game) => {
        delete g.nexusGuildSecretHistory;
      },
      (g: Game) => {
        delete g.nexusGuildSecretLast;
      },
      (g: Game) => {
        g.nexusGuildSecretHistory![0].signature = 'changed';
      },
      (g: Game) =>
        editFrame(g, (frame) => {
          delete frame.guildSecretEvent;
        }),
      (g: Game) =>
        editFrame(g, (frame) => {
          frame.amount = 4;
        }),
      (g: Game) =>
        editFrame(g, (frame) => {
          frame.cost = 1;
        }),
      (g: Game) =>
        editFrame(g, (frame) => {
          frame.elite = 1;
        }),
      (g: Game) =>
        editFrame(g, (frame) => {
          frame.homeworldSources = {
            'homeworld:emperor': { normal: 5, elite: 0 },
          };
        }),
    ]) {
      const bad = structuredClone(done);
      edit(bad);
      f.save(bad);
      f.writes.length = 0;
      const before = row(f),
        rooms = f.restart();
      for (const auth of f.auths)
        await assert.rejects(rooms.readSeatView(f.code, auth));
      assert.throws(() => normalizeAutomaticGame(bad));
      await Promise.allSettled([rooms.continueRoomAutomatic(f.code, clock)]);
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[0],
          bad.version,
          { type: 'endMovement' },
          clock,
        ),
      );
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally {
    f.sqlite.close();
  }
});
