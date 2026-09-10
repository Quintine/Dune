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
  nexusRicheseFixture,
  nexusRicheseRequest,
  nexusRicheseInventory,
  type NexusRicheseFixtureOptions,
} from './fixture-nexus-richese';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(options: NexusRicheseFixtureOptions = {}) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Richese SQL',
    options.ownerFaction ?? 'atreides',
    options.advanced ?? true,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((a) => a.playerId) as [string, string, string];
  const f = nexusRicheseFixture({
    guild: true,
    advanced: true,
    karama: true,
    ...options,
    seatIds: ids,
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
async function act(f: Fixture, seat: number, action: Action) {
  const g = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[seat], g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const v = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(v, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(v, 'nexusRicheseHistory'), false);
    if (i !== 0) assert.equal(v.nexusRichese, null);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusRicheseInventory(g);
}
async function compete(f: Fixture, version: number, actions: Action[]) {
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
  const results = await Promise.allSettled(
    actions.map((action) =>
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

void test('SQLite competing Richese declarations spend one Nexus and restore one actual pending shipment after a lost acknowledgment', async () => {
  const f = await fixture({ spice: 1 });
  try {
    const unrelated = await f.rooms.createRoom(
      'Unrelated saved table',
      'atreides',
      false,
      [],
    );
    const otherBefore = f.sqlite
      .prepare('SELECT state,version FROM rooms WHERE code = ?')
      .get(unrelated.view.code);
    await compete(f, f.g.version, [
      nexusRicheseRequest(f, 5),
      nexusRicheseRequest(f, 4),
    ]);
    const pending = await f.restart().readRoom(f.code),
      amount = pending.pendingShipment!.amount;
    assert.ok(amount === 4 || amount === 5);
    assert.equal(pending.pendingShipment!.cost, 1);
    assert.equal(pending.players[0].reserves, 20);
    assert.equal(pending.players[0].spice, 1);
    assert.equal(
      pending.nexusCards!.cards!.discard.filter((c) => c === 'richese').length,
      1,
    );
    await restored(f, pending);
    const done = await act(f, 1, { type: 'decision', allow: true });
    assert.equal(done.players[0].reserves, 20 - amount);
    assert.equal(done.players[0].forces['arrakeen:10'], amount);
    assert.equal(done.players[0].spice, 0);
    assert.equal(done.players[1].spice, 21);
    await restored(f, done);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(f.code, f.auths[0], done.version, nexusRicheseRequest(f), clock),
    );
    assert.deepEqual(row(f), before);
    assert.deepEqual(
      f.sqlite
        .prepare('SELECT state,version FROM rooms WHERE code = ?')
        .get(unrelated.view.code),
      otherBefore,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite Guild special stop preserves physical reserves and payment while keeping Richese Nexus spent across reload', async () => {
  const f = await fixture({ spice: 1 });
  try {
    await act(f, 0, nexusRicheseRequest(f));
    const stopped = await act(f, 1, {
      type: 'card',
      mode: 'special',
      card: f.karama,
    });
    assert.equal(stopped.players[0].reserves, 20);
    assert.equal(stopped.players[0].spice, 1);
    assert.equal(stopped.players[0].forces['arrakeen:10'], undefined);
    assert.equal(stopped.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(stopped.discard.filter((c) => c.id === f.karama).length, 1);
    await restored(f, stopped);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[1],
          stopped.version,
          { type: 'card', mode: 'special', card: f.karama },
          clock,
        ),
    );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite rejects changed Richese paid intent and missing saved source without projection, normalization or action writes', async () => {
  const f = await fixture({ spice: 1 });
  try {
    const pending = await act(f, 0, nexusRicheseRequest(f));
    for (const edit of [
      (g: Game) => {
        delete g.nexusRicheseHistory;
      },
      (g: Game) => {
        delete g.pendingShipment!.nexusEvent;
      },
      (g: Game) => {
        delete g.nexusRicheseLast;
      },
      (g: Game) => {
        g.nexusRicheseHistory![0].signature = 'changed';
      },
      (g: Game) => {
        if (g.decision?.kind === 'guildShipment') g.decision.amount = 4;
      },
      (g: Game) => {
        if (g.decision?.kind === 'guildShipment')
          g.decision.player = f.observer;
      },
      (g: Game) => {
        g.pendingShipment!.amount = 4;
      },
      (g: Game) => {
        g.pendingShipment!.cost = 0;
      },
      (g: Game) => {
        g.pendingShipment!.territory = 'carthag';
        g.pendingShipment!.sector = 11;
      },
      (g: Game) => {
        g.decision = null;
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
      // A waiting human shipment does not require automatic room recovery; the
      // room adapter may return before dispatching the rejecting normalizer.
      await Promise.allSettled([rooms.continueRoomAutomatic(f.code, clock)]);
      await assert.rejects(
        rooms.act(
          f.code,
          f.auths[1],
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

void test('SQLite typed Kaitain and Salusa shipment settles exactly once after a saved Guild interception', async () => {
  const f = await fixture({
    ownerFaction: 'emperor',
    homeworlds: true,
    spice: 1,
  });
  try {
    const request = {
      ...nexusRicheseRequest(f),
      elite: 2,
      homeworldSources: {
        'homeworld:emperor': { normal: 3, elite: 0 },
        'homeworld:emperor:salusa': { normal: 0, elite: 2 },
      },
    };
    const pending = await act(f, 0, request);
    await restored(f, pending);
    const changed = structuredClone(pending);
    changed.pendingShipment!.elite = 1;
    changed.pendingShipment!.homeworldSources!['homeworld:emperor'].normal = 4;
    changed.pendingShipment!.homeworldSources![
      'homeworld:emperor:salusa'
    ].elite = 1;
    f.save(changed);
    f.writes.length = 0;
    const corruptRow = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, auth));
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[1],
          changed.version,
          { type: 'decision', allow: true },
          clock,
        ),
    );
    assert.deepEqual(row(f), corruptRow);
    assert.equal(f.writes.length, 0);
    f.save(pending);
    const done = await act(f, 1, { type: 'decision', allow: true });
    assert.equal(done.players[0].reserves, 15);
    assert.equal(done.players[0].elites!.forces['arrakeen:10'], 2);
    assert.equal(done.homeworlds!.custody!.salusa!.elite, 3);
    assert.equal(done.players[0].spice, 0);
    await restored(f, done);
    assert.equal(
      done.nexusCards!.cards!.discard.filter((c) => c === 'richese').length,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('SQLite restores a committed five-force shipment awaiting BG accompaniment without replaying its payment or arrival', async () => {
  const f = await fixture({ opponentFaction: 'beneGesserit', spice: 1 });
  try {
    const arrived = await act(f, 0, nexusRicheseRequest(f));
    assert.equal(arrived.decision?.kind, 'advisor');
    assert.equal(arrived.players[0].spice, 0);
    assert.equal(arrived.players[0].forces['arrakeen:10'], 5);
    await restored(f, arrived);
    const done = await act(f, 1, {
      type: 'decision',
      accept: true,
      accompany: true,
    });
    assert.equal(done.players[0].reserves, 15);
    assert.equal(done.players[0].forces['arrakeen:10'], 5);
    assert.equal(done.players[0].spice, 0);
    assert.equal(done.players[1].forces['arrakeen:10'], 1);
    assert.equal(done.players[1].reserves, 19);
    await restored(f, done);
    const before = row(f);
    await assert.rejects(
      f
        .restart()
        .act(
          f.code,
          f.auths[1],
          done.version,
          { type: 'decision', accept: true },
          clock,
        ),
    );
    assert.deepEqual(row(f), before);
  } finally {
    f.sqlite.close();
  }
});
