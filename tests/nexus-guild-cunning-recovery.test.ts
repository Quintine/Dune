import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import {
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import {
  nexusGuildCunningFixture,
  originalGuildCunningTurn,
  nexusGuildCunningRequest,
  nexusGuildCunningInventory,
  holdGuildCunningCard,
  nexusGuildCunningAllianceFixture,
} from './fixture-nexus-guild-cunning';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(
  hajr = false,
  originalMove = true,
  selfStop = false,
  homeworlds = false,
  alliance = false,
) {
  const store = unitStore(),
    made = await store.rooms.createRoom(
      'Guild Cunning SQL',
      'guild',
      false,
      [],
    ),
    code = made.view.code,
    tokens = [made.token];
  for (const faction of ['harkonnen', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
      tokens.map((t) => store.rooms.authenticate(code, t)),
    ),
    ids = auths.map((a) => a.playerId) as [string, string, string];
  const f = alliance
    ? nexusGuildCunningAllianceFixture(ids)
    : nexusGuildCunningFixture({
        seatIds: ids,
        karama: true,
        advanced: selfStop,
        homeworlds,
      });
  if (alliance) f.karama = holdGuildCunningCard(f.g, f.target, 'karama').id;
  const ownKarama = selfStop
    ? holdGuildCunningCard(f.g, f.owner, 'karama').id
    : undefined;
  const card = hajr ? holdGuildCunningCard(f.g, f.owner, 'hajr').id : undefined;
  f.g = originalGuildCunningTurn(f, originalMove);
  f.g.code = code;
  f.g.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) =>
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
  save(f.g);
  store.writes.length = 0;
  return {
    ...store,
    ...f,
    code,
    tokens,
    auths,
    ids,
    save,
    hajr: card,
    ownKarama,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
async function act(f: Fixture, seat: number, action: Action) {
  const g = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[seat], g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, t] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, t),
      v = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(v, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(v, 'nexusGuildCunningHistory'), false);
    if (i !== 0) assert.equal(v.nexusGuildCunning, null);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusGuildCunningInventory(g);
}
async function compete(f: Fixture, version: number, action: Action) {
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
      f.restart().act(f.code, f.auths[0], version, action, clock),
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
}

void test('SQLite restores the real second-arrival Moritani alliance reply and continues the spent Guild Nexus through Hajr once', async () => {
  const f = await fixture(true, true, false, false, true);
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    let g = await f.restart().readRoom(f.code);
    while (g.response) {
      const voter = g.players.find(
        (p) => !g.response!.passed.includes(p.id),
      )!.id;
      g = await act(f, f.ids.indexOf(voter), { type: 'passResponse' });
    }
    g = await act(f, 0, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    });
    assert.equal(g.pendingTerrorEntry?.stage, 'offer');
    g = await act(f, 1, { type: 'decision', alliance: true });
    while (g.response) {
      const voter = g.players.find(
        (p) => !g.response!.passed.includes(p.id),
      )!.id;
      g = await act(f, f.ids.indexOf(voter), { type: 'passResponse' });
    }
    await restored(f, g);
    const spice = g.players[0].spice,
      reserves = g.players[0].reserves;
    const accepted = await act(f, 0, { type: 'decision', accept: true });
    assert.equal(accepted.players[0].ally, f.target);
    assert.equal(accepted.players[1].ally, f.owner);
    assert.equal(accepted.players[0].spice, spice);
    assert.equal(accepted.players[0].reserves, reserves);
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
    await act(f, 0, { type: 'card', card: f.hajr });
    let done = await act(f, 0, {
      type: 'move',
      from: 'carthag:11',
      territory: 'hagga_basin',
      sector: 12,
      amount: 3,
    });
    assert.equal(done.players[0].forces['hagga_basin:12'], 8);
    assert.equal(done.players[0].spice, spice);
    assert.equal(done.players[0].reserves, reserves);
    if (done.active === f.owner)
      done = await act(f, 0, { type: 'endMovement' });
    assert.notEqual(done.active, f.owner);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite restores self-stopped second Guild shipment with no second cost or arrival and only one Hajr movement', async () => {
  const f = await fixture(true, false, true);
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    await act(f, 1, { type: 'passResponse' });
    const pending = await act(f, 0, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    });
    assert.equal(pending.decision?.kind, 'guildShipment');
    await restored(f, pending);
    const stopped = await act(f, 0, {
      type: 'card',
      mode: 'special',
      card: f.ownKarama,
    });
    assert.equal(
      stopped.nexusGuildCunningHistory!.at(-1)!.shipment!.stage,
      'stopped',
    );
    assert.equal(stopped.players[0].spice, 17);
    assert.equal(stopped.players[0].reserves, 15);
    assert.equal(stopped.players[0].forces['carthag:11'], undefined);
    assert.equal(
      stopped.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
      1,
    );
    await restored(f, stopped);
    const move: Action = {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
    };
    const before = row(f);
    await assert.rejects(
      f.restart().act(f.code, f.auths[0], stopped.version, move, clock),
    );
    assert.deepEqual(row(f), before);
    await act(f, 0, { type: 'card', card: f.hajr });
    const done = await act(f, 0, move);
    assert.equal(done.players[0].spice, 17);
    assert.equal(done.players[0].reserves, 15);
    assert.equal(done.players[0].forces['hagga_basin:12'], 5);
    assert.equal(done.discard.filter((c) => c.id === f.ownKarama).length, 1);
    await restored(f, done);
    const completed = row(f);
    await assert.rejects(
      f.restart().act(
        f.code,
        f.auths[0],
        done.version,
        {
          type: 'move',
          from: 'hagga_basin:12',
          territory: 'arsunt',
          sector: 12,
          amount: 5,
        },
        clock,
      ),
    );
    assert.deepEqual(row(f), completed);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite rejects lost or changed second-shipment source, paid frame and Guild interception with zero writes', async () => {
  const f = await fixture(false, true, true, true);
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    await act(f, 1, { type: 'passResponse' });
    const pending = await act(f, 0, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
      homeworldSources: { 'homeworld:guild': { normal: 3, elite: 0 } },
    });
    assert.equal(pending.decision?.kind, 'guildShipment');
    await restored(f, pending);
    for (const edit of [
      (g: Game) => {
        delete g.pendingShipment!.guildNexusEvent;
      },
      (g: Game) => {
        g.pendingShipment!.guildNexusEvent = 'other';
      },
      (g: Game) => {
        g.pendingShipment!.amount = 2;
      },
      (g: Game) => {
        g.pendingShipment!.cost = 1;
      },
      (g: Game) => {
        g.pendingShipment!.homeworldSources!['homeworld:guild'].normal = 2;
      },
      (g: Game) => {
        g.pendingShipment!.territory = 'arrakeen';
        g.pendingShipment!.sector = 10;
      },
      (g: Game) => {
        g.nexusGuildCunningHistory!.at(-1)!.shipment = {
          kind: 'reserve',
          stage: 'pending',
          frame: '{}',
        };
      },
      (g: Game) => {
        g.decision = null;
      },
      (g: Game) => {
        if (g.decision?.kind === 'guildShipment') g.decision.amount = 2;
      },
      (g: Game) => {
        if (g.decision?.kind === 'guildShipment') g.decision.shipper = f.target;
      },
    ]) {
      const bad = structuredClone(pending);
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
          { type: 'decision', allow: true },
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
void test('SQLite restores the first Guild turn and lost Cunning declaration then commits exactly one raced second shipment', async () => {
  const f = await fixture();
  try {
    const other = await f.rooms.createRoom(
        'Unrelated original room',
        'atreides',
        false,
        [],
      ),
      otherBefore = f.sqlite
        .prepare('SELECT state,version FROM rooms WHERE code = ?')
        .get(other.view.code);
    const pending = await act(f, 0, nexusGuildCunningRequest(f));
    await restored(f, pending);
    assert.equal(pending.players[0].spice, 17);
    assert.equal(pending.players[0].moved, 1);
    assert.equal(pending.players[0].forces['hagga_basin:12'], 5);
    const allowed = await act(f, 1, { type: 'passResponse' });
    await restored(f, allowed);
    f.writes.length = 0;
    const shipment: Action = {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    };
    await compete(f, allowed.version, shipment);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].spice, 15);
    assert.equal(done.players[0].reserves, 12);
    assert.equal(done.players[0].forces['carthag:11'], 3);
    assert.equal(done.players[0].moved, 1);
    assert.equal(
      done.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
      1,
    );
    await restored(f, done);
    const before = row(f);
    await assert.rejects(
      f.restart().act(f.code, f.auths[0], done.version, shipment, clock),
    );
    assert.deepEqual(row(f), before);
    assert.deepEqual(
      f.sqlite
        .prepare('SELECT state,version FROM rooms WHERE code = ?')
        .get(other.view.code),
      otherBefore,
    );
  } finally {
    f.sqlite.close();
  }
});
void test('SQLite canceled Guild Cunning preserves the already moved army and first payment without granting another turn', async () => {
  const f = await fixture();
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    const canceled = await act(f, 1, {
      type: 'card',
      mode: 'cancel',
      card: f.karama,
    });
    assert.equal(canceled.players[0].spice, 17);
    assert.equal(canceled.players[0].reserves, 15);
    assert.equal(canceled.players[0].forces['hagga_basin:12'], 5);
    assert.equal(canceled.players[0].moved, 1);
    assert.equal(canceled.movementRemaining!.includes(f.owner), false);
    assert.equal(canceled.discard.filter((c) => c.id === f.karama).length, 1);
    await restored(f, canceled);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[0],
          canceled.version,
          nexusGuildCunningRequest(f),
          clock,
        ),
    );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});
void test('SQLite late Hajr restores one extra move after the second shipment without replaying either shipment', async () => {
  const f = await fixture(true);
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    await act(f, 1, { type: 'passResponse' });
    const shipped = await act(f, 0, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 3,
    });
    await restored(f, shipped);
    const extra = await act(f, 0, { type: 'card', card: f.hajr });
    await restored(f, extra);
    const done = await act(f, 0, {
      type: 'move',
      from: 'carthag:11',
      territory: 'hagga_basin',
      sector: 12,
      amount: 3,
    });
    assert.equal(done.players[0].spice, 15);
    assert.equal(done.players[0].reserves, 12);
    assert.equal(done.players[0].forces['hagga_basin:12'], 8);
    assert.equal(done.players[0].moved, 2);
    assert.equal(done.discard.filter((c) => c.id === f.hajr).length, 1);
    await restored(f, done);
  } finally {
    f.sqlite.close();
  }
});
void test('SQLite changed Guild Cunning history or original movement proof cannot project, normalize or write a continuation', async () => {
  const f = await fixture();
  try {
    const pending = await act(f, 0, nexusGuildCunningRequest(f));
    for (const edit of [
      (g: Game) => {
        delete g.nexusGuildCunningHistory;
      },
      (g: Game) => {
        g.nexusGuildCunningHistory![0].signature = 'changed';
      },
      (g: Game) => {
        g.response = null;
      },
      (g: Game) => {
        g.players[0].moved = 0;
      },
      (g: Game) => {
        g.players[0].shipped = false;
      },
      (g: Game) => {
        g.response!.owner = f.target;
      },
    ]) {
      const bad = structuredClone(pending);
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
          f.auths[1],
          bad.version,
          { type: 'passResponse' },
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

void test('SQLite restores a declined second shipment and races exactly one Hajr move after the original movement was declined', async () => {
  const f = await fixture(true, false);
  try {
    await act(f, 0, nexusGuildCunningRequest(f));
    const allowed = await act(f, 1, { type: 'passResponse' });
    const skip: Action = {
      type: 'nexusGuildSkipShipment',
      event: viewGame(allowed, f.owner).nexusGuildCunning!.active!.event,
    };
    const skipped = await act(f, 0, skip);
    assert.equal(skipped.players[0].spice, 17);
    assert.equal(skipped.players[0].reserves, 15);
    assert.equal(skipped.players[0].moved, 0);
    assert.equal(skipped.players[0].shipped, true);
    await restored(f, skipped);
    const move: Action = {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
    };
    const before = row(f);
    for (const action of [move, skip])
      await assert.rejects(
        f.restart().act(f.code, f.auths[0], skipped.version, action, clock),
      );
    assert.deepEqual(row(f), before);
    const extra = await act(f, 0, { type: 'card', card: f.hajr });
    await restored(f, extra);
    f.writes.length = 0;
    await compete(f, extra.version, move);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.players[0].forces['hagga_basin:12'], 5);
    assert.equal(done.players[0].spice, 17);
    assert.equal(done.players[0].reserves, 15);
    assert.equal(done.discard.filter((c) => c.id === f.hajr).length, 1);
    await restored(f, done);
    const completed = row(f);
    await assert.rejects(
      f.restart().act(
        f.code,
        f.auths[0],
        done.version,
        {
          type: 'move',
          from: 'hagga_basin:12',
          territory: 'arsunt',
          sector: 12,
          amount: 5,
        },
        clock,
      ),
    );
    assert.deepEqual(row(f), completed);
  } finally {
    f.sqlite.close();
  }
});
