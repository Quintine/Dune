import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type * as Rooms from '../db/rooms';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import { viewGame, type Action } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 45000, sleep: async () => {} };

async function room(t: test.TestContext, ecazFirst: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const created = await store.rooms.createRoom('Ecaz', 'ecaz', false, ['ecaz']);
  const code = created.view.code;
  const moritani = await store.rooms.joinRoom(code, 'Moritani', 'moritani');
  const entrant = await store.rooms.joinRoom(code, 'Entrant', 'harkonnen');
  const tokens = [created.token, moritani.token!, entrant.token!];
  const auth = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const [ec, m, incoming] = auth.map((seat) => seat.playerId);
  const g = await store.rooms.readRoom(code);
  Object.assign(g, {
    status: 'playing', phase: 5, turn: 3, storm: 18, active: incoming,
    order: ecazFirst ? [ec, m, incoming] : [m, ec, incoming], deck: baseDeck(),
  });
  g.movementRemaining = [...g.order];
  for (const player of g.players)
    Object.assign(player, { hand: [], spice: 20, forces: {}, reserves: 20, shipped: false, moved: 0 });
  const ambassadors = createAmbassadors(() => 0.2);
  const emperor = ambassadors.tokens.find((token) => token.effect === 'emperor')!;
  ambassadors.cohort = [emperor.id, ...ambassadors.tokens
    .filter((token) => token.effect !== 'ecaz' && token.id !== emperor.id)
    .slice(0, 4).map((token) => token.id)];
  for (const token of ambassadors.tokens) {
    token.zone = token.effect === 'ecaz' || ambassadors.cohort.includes(token.id) ? 'supply' : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(ambassadors, emperor.id, {
    turn: 2, availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  const terror = createTerrorState(() => 0.2);
  const robbery = terror.tokens.find((token) => token.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(terror, robbery.id, 'arrakeen', 2);
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  const ship: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 };
  const offered = await store.rooms.act(code, auth[2], g.version, ship, clock);
  assert.deepEqual(offered.arrivalOverlap, {
    first: ecazFirst ? 'ambassador' : 'terror',
    active: ecazFirst ? 'ambassador' : 'terror',
    entrant: incoming, territory: 'arrakeen',
  });
  store.writes.length = 0;
  return { ...store, code, tokens, auth, ids: { ec, m, incoming }, ship, emperor: emperor.id, robbery: robbery.id };
}
interface Fixture {
  sqlite: DatabaseSync;
  restart: () => typeof Rooms;
  code: string;
  tokens: string[];
  auth: SeatAuth[];
  ids: { ec: string; m: string; incoming: string };
  ship: Action;
  emperor: string;
  robbery: string;
  writes: { expected: number; changes: number }[];
}
const rows = (f: { sqlite: DatabaseSync }) => f.sqlite.prepare('SELECT state, version FROM rooms ORDER BY code').all();

async function saved(f: Fixture) {
  const g = await f.restart().readRoom(f.code);
  const before = rows(f);
  for (let index = 0; index < f.tokens.length; index++) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, f.tokens[index]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, auth.playerId));
    assert.equal('pendingArrivalOverlap' in view, false);
    assert.equal('pendingTerrorEntry' in view, false);
    assert.equal('kind' in view.moritaniTerror!.tokens.find((token) => token.id === f.robbery)!, index === 1 ||
      g.moritaniTerror!.tokens.find((token) => token.id === f.robbery)!.status === 'removed');
    assert.equal(JSON.stringify(view.arrivalOverlap).includes(f.robbery), false);
    assert.equal(JSON.stringify(view.arrivalOverlap).includes(g.pendingArrivalOverlap?.signature ?? 'unavailable'), false);
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(rows(f), before);
  return g;
}

for (const ecazFirst of [true, false]) {
  void test(`SQLite CAS restores ${ecazFirst ? 'Ecaz-first' : 'Moritani-first'} two-stage arrival without replaying shipment`, async (t) => {
    const f = await room(t, ecazFirst);
    let g = await saved(f);
    const version = g.version;
    const signature = g.pendingArrivalOverlap!.signature;
    const wrongOwner = ecazFirst ? 1 : 0;
    const firstOwner = ecazFirst ? 0 : 1;
    const first: Action = ecazFirst
      ? { type: 'decision', event: g.pendingAmbassador!.event, trigger: true, beneficiary: f.ids.ec }
      : { type: 'decision', reveal: true };
    const before = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auth[wrongOwner], version, first, clock));
    await assert.rejects(f.restart().act(f.code, f.auth[firstOwner], version - 1, first, clock), /table changed/);
    assert.deepEqual(rows(f), before);
    assert.equal(f.writes.length, 0);
    await f.restart().act(f.code, f.auth[firstOwner], version, first, clock);
    g = await saved(f);
    assert.equal(g.pendingArrivalOverlap!.signature, signature);
    assert.equal(g.pendingArrivalOverlap!.entrant, f.ids.incoming);
    assert.equal(g.players[2].forces['arrakeen:10'], 2);
    assert.equal(g.players[2].reserves, 18);
    assert.equal(g.players[2].spice, 18);
    if (!ecazFirst) {
      assert.equal(g.pendingTerrorEntry?.stage, 'robbery');
      await f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', choice: 'spice' }, clock);
      g = await saved(f);
      assert.equal(g.pendingArrivalOverlap?.stage, 'second');
      assert.equal(g.decision?.kind, 'ecazAmbassador');
    } else {
      assert.equal(g.pendingArrivalOverlap?.stage, 'second');
      assert.equal(g.decision?.kind, 'moritaniTerror');
    }
    const prior = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auth[firstOwner], g.version, first, clock));
    assert.deepEqual(rows(f), prior);
    if (ecazFirst) {
      await f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', reveal: true }, clock);
      g = await saved(f);
      assert.equal(g.pendingTerrorEntry?.entrant, f.ids.incoming);
      await f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', choice: 'spice' }, clock);
    } else {
      await f.restart().act(f.code, f.auth[0], g.version, {
        type: 'decision', event: g.pendingAmbassador!.event, trigger: true, beneficiary: f.ids.ec,
      }, clock);
    }
    g = await saved(f);
    assert.equal(g.pendingArrivalOverlap ?? null, null);
    assert.equal(g.pendingAmbassador ?? null, null);
    assert.equal(g.pendingTerrorEntry ?? null, null);
    assert.equal(g.decision, null);
    assert.equal(g.players[2].spice, 9);
    assert.equal(g.players[1].spice, 29);
    assert.equal(g.players[0].spice, 25);
    assert.equal(g.players[2].forces['arrakeen:10'], 2);
    assert.equal(g.ecazAmbassadors!.tokens.find((token) => token.id === f.emperor)!.zone, 'used');
    assert.equal(g.moritaniTerror!.tokens.find((token) => token.id === f.robbery)!.status, 'removed');
    const finished = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auth[2], g.version, f.ship, clock));
    await assert.rejects(f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', choice: 'spice' }, clock));
    assert.deepEqual(rows(f), finished);
  });
}

const ride: Action = {
  type: 'decision', accept: true, territory: 'arrakeen', sector: 10,
  forces: { 'imperial_basin:10': 2 },
};

/** A phase-one Fremen ride into the shared stronghold, with a second ride still queued. */
async function wormRoom(t: test.TestContext, advanced: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const created = await store.rooms.createRoom('Ecaz', 'ecaz', advanced, ['ecaz']);
  const code = created.view.code;
  const moritani = await store.rooms.joinRoom(code, 'Moritani', 'moritani');
  const rider = await store.rooms.joinRoom(code, 'Rider', 'fremen');
  const tokens = [created.token, moritani.token!, rider.token!];
  const auth = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const [ec, m, incoming] = auth.map((seat) => seat.playerId);
  const g = await store.rooms.readRoom(code);
  Object.assign(g, {
    status: 'playing', phase: 1, turn: 3, storm: 18, active: null,
    order: [m, ec, incoming], deck: baseDeck(),
  });
  g.movementRemaining = [...g.order];
  for (const player of g.players)
    Object.assign(player, { hand: [], spice: 20, forces: {}, reserves: 20, shipped: false, moved: 0 });
  g.players[2].forces = { 'imperial_basin:10': 3, 'hagga_basin:12': 1 };
  g.players[2].reserves = 16;
  const ambassadors = createAmbassadors(() => 0.2);
  const emperor = ambassadors.tokens.find((token) => token.effect === 'emperor')!;
  ambassadors.cohort = [emperor.id, ...ambassadors.tokens
    .filter((token) => token.effect !== 'ecaz' && token.id !== emperor.id)
    .slice(0, 4).map((token) => token.id)];
  for (const token of ambassadors.tokens) {
    token.zone = token.effect === 'ecaz' || ambassadors.cohort.includes(token.id) ? 'supply' : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(ambassadors, emperor.id, {
    turn: 2, availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  const terror = createTerrorState(() => 0.2);
  const robbery = terror.tokens.find((token) => token.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(terror, robbery.id, 'arrakeen', 2);
  g.decision = { kind: 'wormRide', player: incoming, territory: 'imperial_basin' };
  g.wormRides = ['hagga_basin'];
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  return {
    ...store, code, tokens, auth, ids: { ec, m, incoming },
    robbery: robbery.id, emperor: emperor.id,
  };
}

for (const advanced of [false, true]) {
  void test(`SQLite CAS restores a ${advanced ? 'Advanced' : 'Basic'} Fremen worm ride through both arrival reactions`, async (t) => {
    const f = await wormRoom(t, advanced);
    const read = async () => f.restart().readRoom(f.code);
    let g = await read();
    const version = g.version;
    const rideOffered = await f.restart().act(f.code, f.auth[2], version, ride, clock);
    assert.equal('pendingArrivalOverlap' in rideOffered, false);
    g = await read();
    assert.equal(g.pendingArrivalOverlap?.resume, 'wormRide');
    assert.equal(g.pendingArrivalOverlap?.cause, 'wormRide');
    assert.equal(g.pendingArrivalOverlap?.first, 'terror');
    assert.equal(g.pendingTerrorEntry?.cause, 'wormRide');
    assert.equal(g.pendingTerrorEntry?.resume, 'none');
    assert.deepEqual(g.wormRides, ['hagga_basin']);
    assert.equal(g.players[2].forces['arrakeen:10'], 2);
    const spiceAfterRide = g.players[2].spice;
    const views = await Promise.all(f.tokens.map(async (token) => {
      const rooms = f.restart();
      const auth = await rooms.authenticate(f.code, token);
      const view = await rooms.readSeatView(f.code, auth);
      assert.deepEqual(view, viewGame(await read(), auth.playerId));
      assert.equal('pendingArrivalOverlap' in view, false);
      assert.equal('pendingTerrorEntry' in view, false);
      return view;
    }));
    assert.deepEqual(views[0].arrivalOverlap, {
      first: 'terror', active: 'terror', entrant: f.ids.incoming, territory: 'arrakeen',
    });
    for (const index of [0, 1, 2]) {
      const token = views[index].moritaniTerror!.tokens.find(
        (candidate) => candidate.id === f.robbery,
      )!;
      assert.equal('kind' in token, index === 1);
      assert.equal('terrorEntry' in views[index], true);
      assert.equal('kind' in (views[index].terrorEntry ?? {}), index === 1);
    }
    const before = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auth[2], g.version, ride, clock));
    assert.deepEqual(rows(f), before);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.deepEqual(rows(f), before);
    g = await read();
    await f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', reveal: true }, clock);
    g = await read();
    assert.equal(g.pendingTerrorEntry?.stage, 'robbery');
    await f.restart().act(f.code, f.auth[1], g.version, { type: 'decision', choice: 'spice' }, clock);
    g = await read();
    assert.equal(g.pendingTerrorEntry, null);
    assert.equal(g.pendingArrivalOverlap?.stage, 'second');
    assert.equal(g.decision?.kind, 'ecazAmbassador');
    await f.restart().act(f.code, f.auth[0], g.version, {
      type: 'decision', event: g.pendingAmbassador!.event, decline: true,
    }, clock);
    g = await read();
    assert.equal(g.pendingArrivalOverlap, null);
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.pendingTerrorEntry, null);
    assert.deepEqual(g.wormRides, []);
    assert.deepEqual(g.decision, {
      kind: 'wormRide', player: f.ids.incoming, territory: 'hagga_basin',
    });
    assert.equal(g.players[2].forces['arrakeen:10'], 2);
    assert.equal(g.players[2].forces['imperial_basin:10'], 1);
    const stolen = spiceAfterRide - g.players[2].spice;
    assert.equal(stolen, 10, 'Robbery takes spice once');
    assert.equal(g.players[1].spice, 30, 'Moritani keeps the stolen spice exactly once');
    assert.equal(g.moritaniTerror!.tokens.find((token) => token.kind === 'robbery')!.status, 'removed');
    assert.equal(g.ecazAmbassadors!.tokens.find((token) => token.effect === 'emperor')!.zone, 'placed');
  });
}
