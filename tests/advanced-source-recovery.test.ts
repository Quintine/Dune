import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game, type GameView } from '../game/engine';
import { stormCardDistance, isStormCardDistance } from '../game/storm-cards';
import { createStormSource } from '../game/discovery-storm';
import type { FactionId } from '../game/catalog';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { splitLocation, territory } from '../game/board';
import { unitStore } from './fixture-nexus-room-store';
import { createAdvancedSourceFixture, createRecordedAdvancedSourceFixture, advanceToForecast, advanceToNextStorm,
  type AdvancedSourceFixtureOptions as Options, type AdvancedSourceFixture } from './fixture-advanced-source';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends AdvancedSourceFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  initial: Game;
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(g: Game): void;
  credentialRows: { seats: SqlRow[]; entries: SqlRow[]; keys: SqlRow[]; recoveries: SqlRow[] };
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: SqlRow | undefined;
  stock: string[];
  forces: { id: string; total: number; elite: number }[];
}
function player(g: Game, id: string) {
  const p = g.players.find(seat => seat.id === id);
  assert.ok(p, `missing native seat ${id}`);
  return p;
}
function credentials(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    recoveries: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}
function forceStock(g: Game) {
  return g.players.map(p => ({ id: p.id,
    total: p.reserves + p.tanks + Object.values(p.forces).reduce((n, amount) => n + amount, 0),
    elite: p.elites ? p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((n, amount) => n + amount, 0) : 0 }));
}
function cardStock(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? [])].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'each physical Treachery card has one custodian');
  return ids;
}
function receiptFaces(g: { log: readonly { component?: unknown }[] }) {
  return g.log.flatMap(entry => {
    const distance = stormCardDistance(entry.component);
    return distance === null ? [] : [distance];
  });
}
async function fixture(t: test.TestContext, options: Options = {}, recorded?: Game): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const factions: FactionId[] = recorded ? recorded.players.map(p => p.faction) :
    options.alliance === 'ecaz' ? ['ecaz', 'fremen', 'atreides'] :
    options.alliance === 'ownAdvisors' || options.alliance === 'allyAdvisors' ? ['atreides', 'beneGesserit', 'fremen'] :
    options.alliance === 'firstEnding' || options.alliance === 'laterEnding' || options.alliance === 'newThisTurn' ?
      ['atreides', 'emperor', 'guild'] : options.alliance ? ['atreides', 'fremen', 'guild'] : ['atreides', 'emperor'];
  if (!options.alliance && options.fremen) factions.push('fremen');
  const made = await store.rooms.createRoom('Advanced source recovery', factions[0], options.advanced ?? true,
    options.alliance === 'ecaz' ? ['ecaz'] : []);
  const code = made.view.code, tokens = [made.token];
  for (const faction of factions.slice(1)) tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  let auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  if (recorded) {
    // Bind isolated credentials to the already native saved IDs, never rewrite
    // the captured Game's identity or its historical source.
    for (const [index, auth] of auths.entries())
      assert.equal(store.sqlite.prepare('UPDATE seats SET player_id = ? WHERE room_code = ? AND token_hash = ?')
        .run(recorded.players[index].id, code, auth.tokenHash).changes, 1);
    auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  }
  const native = recorded ? createRecordedAdvancedSourceFixture(recorded) :
    createAdvancedSourceFixture({ ...options, seatIds: auths.map(auth => auth.playerId) });
  const initial = native.game;
  assert.deepEqual(initial.players.map(p => p.faction), factions, 'authenticated seats match the native constructor roster');
  initial.code = code;
  initial.host = auths[0].playerId;
  initial.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code).changes, 1);
  };
  save(initial);
  const unrelated = await store.rooms.createRoom('Unrelated preserved room', 'harkonnen', false, []);
  return { ...store, ...native, initial, code, tokens, auths, save,
    credentialRows: credentials(store.sqlite), unrelatedCode: unrelated.view.code,
    unrelatedToken: unrelated.token,
    unrelatedRow: store.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(unrelated.view.code),
    stock: cardStock(initial), forces: forceStock(initial) };
}
const row = (f: Fixture) => f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.code);
function totalChanges(f: Fixture) {
  const n = f.sqlite.prepare('SELECT total_changes() AS changes').get()?.changes;
  assert.equal(typeof n, 'number');
  return n as number;
}
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.credentialRows);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.unrelatedCode), f.unrelatedRow);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, g: Game, id: string, action: Action) {
  const changes = totalChanges(f);
  await f.restart().act(f.code, await authenticate(f, id), g.version, action, clock);
  assert.equal(totalChanges(f), changes + 1, 'one authenticated native action commits one room row');
  protectedRows(f);
  return f.restart().readRoom(f.code);
}
async function rejected(f: Fixture, g: Game, auth: SeatAuth, action: Action, version = g.version) {
  const before = row(f), changes = totalChanges(f);
  await assert.rejects(f.restart().act(f.code, auth, version, action, clock));
  assert.deepEqual(row(f), before);
  assert.equal(totalChanges(f), changes, 'rejected action writes no durable table');
  protectedRows(f);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f), changes = totalChanges(f), original = plain(g);
  assert.deepEqual(plain(await f.restart().readRoom(f.code)), original);
  assert.deepEqual(plain(normalizeAutomaticGame(g)), original);
  const views: GameView[] = [];
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(plain(view), plain(viewGame(g, auth.playerId)));
    for (const key of ['stormMovementSource', 'stormResolution', 'stormCard', 'stormCardKnown', 'stormDials'])
      assert.equal(Object.hasOwn(view, key), false, `${key} stays outside the public projection`);
    for (const rival of view.players.filter(p => p.id !== auth.playerId))
      for (const key of ['hand', 'traitors', 'spice']) assert.equal(Object.hasOwn(rival, key), false);
    views.push(view);
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(plain(g), original, 'read and normalize leave their caller-owned input immutable');
  assert.deepEqual(row(f), before);
  assert.equal(totalChanges(f), changes, 'restart, reads and idle recovery perform no durable writes');
  assert.deepEqual(cardStock(g), f.stock);
  protectedRows(f);
  return views;
}
async function readyStorm(f: Fixture, state: Game) {
  let g = state;
  for (const id of state.players.map(p => p.id)) g = await act(f, g, id, { type: 'ready' });
  return g;
}

for (const advanced of [false, true]) {
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} first Storm preserves actual private dials across authenticated restart`, async t => {
    const f = await fixture(t, { advanced, storm: 'first' });
    let g = f.initial;
    assert.equal(g.turn, 1);
    assert.equal(g.stormDialers.length, 2);
    assert.equal(g.stormPending, null);
    await restored(f, g);
    const [first, second] = g.stormDialers;
    g = await act(f, g, first, { type: 'stormDial', amount: 2 });
    for (const view of await restored(f, g)) {
      assert.equal(view.stormRevealed, null);
      assert.deepEqual(view.stormSubmitted, [first]);
      assert.equal(view.stormForecast, null);
    }
    await rejected(f, g, await authenticate(f, first), { type: 'stormDial', amount: 3 });
    await rejected(f, g, await authenticate(f, second), { type: 'stormDial', amount: 0 }, f.initial.version);
    g = await act(f, g, second, { type: 'stormDial', amount: 0 });
    assert.equal(g.stormPending, 2);
    assert.equal(g.stormMovementSource?.kind, 'dials');
    assert.equal(g.stormMovementSource?.distance, 2);
    for (const view of await restored(f, g)) assert.deepEqual(view.stormRevealed, { [first]: 2, [second]: 0 });
    const origin = g.storm;
    g = await readyStorm(f, g);
    assert.equal(g.storm, ((origin + 1) % 18) + 1);
    assert.equal(g.phase, 1);
    assert.equal(g.stormPending, null);
    assert.deepEqual(receiptFaces(g), []);
    await restored(f, g);
  });
}

void test('SQLite subsequent Advanced Storm without Fremen reveals one canonical public card and traverses its saved distance once', async t => {
  const f = await fixture(t, { storm: 'next' });
  let g = f.initial;
  assert.equal(g.turn, 2);
  assert.equal(g.players.some(p => p.faction === 'fremen'), false);
  assert.deepEqual(g.stormDialers, []);
  assert.equal(g.stormCard, null, 'no absent faction receives a held private forecast');
  assert.equal(g.stormCardKnown, false);
  const face = g.stormPending;
  assert.ok(isStormCardDistance(face));
  assert.equal(g.stormMovementSource?.kind, 'card');
  assert.equal(g.stormMovementSource?.distance, face);
  assert.deepEqual(receiptFaces(g), [face]);
  for (const view of await restored(f, g)) {
    assert.deepEqual(view.stormDialers, []);
    assert.equal(view.stormRevealed, null);
    assert.equal(view.stormForecast, null);
    assert.equal(view.stormPending, face);
    assert.deepEqual(receiptFaces(view), [face]);
  }
  for (const auth of f.auths) await rejected(f, g, auth, { type: 'stormDial', amount: 0 });
  const origin = g.storm;
  g = await act(f, g, g.players[0].id, { type: 'ready' });
  await restored(f, g);
  assert.equal(g.stormPending, face);
  assert.deepEqual(receiptFaces(g), [face]);
  await rejected(f, g, f.auths[0], { type: 'ready' });
  for (const p of g.players.slice(1)) g = await act(f, g, p.id, { type: 'ready' });
  assert.equal(g.storm, ((origin + face - 1) % 18) + 1);
  assert.equal(g.stormPending, null);
  assert.equal(g.phase, 1);
  assert.notEqual(g.response?.kind, 'stormPeek', 'there is no absent-Fremen forecast response or extra confirmation');
  assert.equal(g.stormCard, null);
  assert.equal(g.stormCardKnown, false);
  assert.deepEqual(receiptFaces(g), [face]);
  await restored(f, g);
  await rejected(f, g, f.auths[0], { type: 'ready' }, f.initial.version);
});

void test('SQLite subsequent Basic Storm without Fremen retains its native wheel protocol', async t => {
  const f = await fixture(t, { advanced: false, storm: 'next' });
  let g = f.initial;
  assert.equal(g.turn, 2);
  assert.equal(g.stormPending, null);
  assert.equal(g.stormDialers.length, 2);
  assert.deepEqual(receiptFaces(g), []);
  await restored(f, g);
  for (const [index, id] of g.stormDialers.entries()) g = await act(f, g, id, { type: 'stormDial', amount: index + 1 });
  assert.equal(g.stormPending, 3);
  assert.equal(g.stormMovementSource?.kind, 'dials');
  await restored(f, g);
  const origin = g.storm;
  g = await readyStorm(f, g);
  assert.equal(g.storm, ((origin + 2) % 18) + 1);
  assert.deepEqual(receiptFaces(g), []);
  await restored(f, g);
});

void test('SQLite genuinely recorded Advanced wheel opening survives current restart, seals its original dials once and cuts over only on the next turn', async t => {
  // Synthetic native capture generated from exact 8a56299155d0f12c8c4678bfbe5913be71fea5bb:
  // createGame Advanced Atreides/Emperor, actual readiness/start and setup,
  // then legal first-turn phase actions through the original next-Storm opener.
  const captured = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/advanced-recorded-storm-8a.json',
    import.meta.url)), 'utf8')) as Game;
  const original = plain(captured);
  const f = await fixture(t, {}, captured);
  assert.deepEqual(captured, original, 'the stored native capture remains caller-owned and immutable');
  let g = f.initial;
  assert.equal(g.advanced, true);
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 0);
  assert.equal(g.players.some(p => p.faction === 'fremen'), false);
  assert.equal(g.players.find(p => p.faction === 'emperor')?.elites?.reserves, 5,
    'the historical setup is genuinely Advanced, not a changed Basic flag');
  assert.deepEqual(g.players, captured.players);
  assert.deepEqual(g.stormDialers, captured.stormDialers);
  assert.equal(g.stormPending, null);
  assert.equal(g.stormMovementSource, undefined);
  await restored(f, g);
  const [first, second] = g.stormDialers;
  g = await act(f, g, first, { type: 'stormDial', amount: 3 });
  await restored(f, g);
  assert.deepEqual(g.stormDialers, captured.stormDialers);
  assert.deepEqual(g.stormDials, { [first]: 3 });
  assert.equal(g.stormPending, null);
  await rejected(f, g, await authenticate(f, first), { type: 'stormDial', amount: 1 });
  await rejected(f, g, await authenticate(f, second), { type: 'stormDial', amount: 1 }, f.initial.version);
  g = await act(f, g, second, { type: 'stormDial', amount: 1 });
  assert.equal(g.stormPending, 4);
  assert.equal(g.stormMovementSource?.kind, 'dials');
  assert.equal(g.stormMovementSource?.distance, 4);
  for (const view of await restored(f, g)) {
    assert.deepEqual(view.stormRevealed, { [first]: 3, [second]: 1 });
    assert.equal(view.stormForecast, null);
    assert.deepEqual(receiptFaces(view), []);
  }
  const origin = g.storm;
  g = await act(f, g, first, { type: 'ready' });
  await restored(f, g);
  g = await race(f, g, second, { type: 'ready' });
  assert.equal(g.storm, ((origin + 3) % 18) + 1);
  assert.equal(g.phase, 1);
  assert.deepEqual(receiptFaces(g), []);
  await restored(f, g);
  await rejected(f, g, await authenticate(f, second), { type: 'ready' }, g.version - 1);
  g = advanceToNextStorm(g);
  f.save(g);
  assert.equal(g.turn, 3);
  assert.deepEqual(g.stormDialers, []);
  assert.equal(g.stormMovementSource?.kind, 'card');
  assert.ok(isStormCardDistance(g.stormPending));
  assert.deepEqual(receiptFaces(g), [g.stormPending]);
  for (const view of await restored(f, g)) {
    assert.equal(view.stormRevealed, null);
    assert.equal(view.stormForecast, null);
  }
});

for (const cancel of [false, true]) {
  void test(`SQLite native Fremen forecast remains private after ${cancel ? 'a genuine Karama counter' : 'all responses pass'} and supplies the next public card`, async t => {
    const f = await fixture(t, { fremen: true, storm: 'first', karama: true });
    let g = advanceToForecast(f.initial);
    f.save(g);
    assert.equal(g.response?.kind, 'stormPeek');
    const face = g.stormCard;
    assert.ok(isStormCardDistance(face));
    const fremen = g.players.find(p => p.faction === 'fremen')!;
    const counter = g.players.find(p => p.faction !== 'fremen' && p.hand.some(c => c.effect === 'karama'));
    assert.ok(counter, 'the native constructor genuinely dealt a counter even when it will pass');
    const card = counter.hand.find(c => c.effect === 'karama')!;
    assert.ok(viewGame(g, counter.id).responseControls?.cancelCards.includes(card.id));
    assert.deepEqual(forceStock(g), f.forces);
    for (const view of await restored(f, g)) assert.equal(view.stormForecast, null);
    if (cancel) {
      g = await act(f, g, counter.id, { type: 'card', card: card.id, mode: 'cancel' });
    } else {
      while (g.response) {
        const responder = g.players.find(p => !g.response!.passed.includes(p.id));
        assert.ok(responder);
        g = await act(f, g, responder.id, { type: 'passResponse' });
      }
    }
    assert.equal(g.stormCard, face, 'a counter hides knowledge without replacing the physical upcoming card');
    assert.equal(player(g, counter.id).hand.some(c => c.id === card.id), !cancel);
    assert.equal(g.discard.filter(c => c.id === card.id).length, cancel ? 1 : 0);
    assert.deepEqual(forceStock(g), f.forces);
    for (const view of await restored(f, g)) {
      assert.equal(view.stormForecast, !cancel && view.me === fremen.id ? face : null);
      assert.deepEqual(receiptFaces(view), []);
    }
    g = advanceToNextStorm(g);
    f.save(g);
    assert.equal(g.stormPending, face);
    assert.deepEqual(g.stormDialers, []);
    assert.equal(g.stormCard, null);
    assert.deepEqual(forceStock(g), f.forces);
    for (const view of await restored(f, g)) {
      assert.equal(view.stormForecast, null);
      assert.deepEqual(receiptFaces(view), [face]);
    }
  });
}

async function race(f: Fixture, g: Game, id: string, action: Action) {
  const auth = await authenticate(f, id), changes = totalChanges(f);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  try {
    const results = await Promise.allSettled([0, 1].map(() =>
      f.restart().act(f.code, auth, g.version, action, clock).finally(release)));
    assert.equal(arrivals, 2, 'both native submissions reach the SQLite version fence');
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(totalChanges(f), changes + 1, 'only the CAS winner changes any durable row');
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, g.version + 1);
  protectedRows(f);
  return done;
}

void test('SQLite competing final Advanced card confirmations commit the saved distance once', async t => {
  const f = await fixture(t, { storm: 'next' });
  let g = f.initial;
  const origin = g.storm, face = g.stormPending;
  assert.ok(isStormCardDistance(face));
  for (const p of g.players.slice(0, -1)) g = await act(f, g, p.id, { type: 'ready' });
  await restored(f, g);
  const actor = g.players[g.players.length - 1].id;
  g = await race(f, g, actor, { type: 'ready' });
  assert.equal(g.storm, ((origin + face - 1) % 18) + 1);
  assert.equal(g.phase, 1);
  assert.deepEqual(receiptFaces(g), [face]);
  await restored(f, g);
  await rejected(f, g, await authenticate(f, actor), { type: 'ready' }, g.version - 1);
});

function custody(g: Game, id: string) {
  const p = player(g, id);
  return { forces: p.forces, elites: p.elites ?? null, advisors: p.advisors ?? null,
    reserves: p.reserves, tanks: p.tanks, noField: p.noField ?? null, hand: p.hand };
}
function lossCounts(g: Game, id: string, territories: readonly string[]) {
  const p = player(g, id);
  return {
    total: Object.entries(p.forces).reduce((n, [key, amount]) =>
      n + (territories.includes(splitLocation(key).territory) ? amount : 0), 0),
    elite: Object.entries(p.elites?.forces ?? {}).reduce((n, [key, amount]) =>
      n + (territories.includes(splitLocation(key).territory) ? amount : 0), 0),
  };
}
for (const alliance of ['firstEnding', 'laterEnding'] as const) {
  void test(`SQLite Advanced ${alliance} newly allied ending sends only that player's shared group to Tanks once through CAS`, async t => {
    const f = await fixture(t, { alliance });
    const before = f.initial, actor = player(before, f.actor);
    assert.equal(before.phase, 5);
    assert.equal(before.active, actor.id);
    assert.ok(f.ally);
    assert.equal(actor.ally, f.ally);
    assert.equal(actor.allySinceTurn, before.turn, 'newly formed alliances receive the same mandatory ending consequence');
    assert.ok(before.movementRemaining?.includes(f.ally), 'the ally has not reached its own ending yet');
    assert.equal(before.order.indexOf(actor.id), alliance === 'firstEnding' ? 0 : 1,
      'the later scenario genuinely follows a completed nonallied seat');
    if (alliance === 'laterEnding') {
      assert.ok(f.other);
      assert.equal(before.movementRemaining?.includes(f.other), false);
    }
    const losses = lossCounts(before, actor.id, f.lossTerritories);
    assert.ok(losses.total > 0, 'genuine native actions placed a shared fighter group');
    assert.equal(actor.faction, 'emperor');
    assert.equal(losses.elite, 1, 'the genuine paid shipment exercises elite classification within the physical loss');
    const otherCustody = before.players.filter(p => p.id !== actor.id).map(p => [p.id, plain(custody(before, p.id))]);
    const beforeTanks = actor.tanks, beforeEliteTanks = actor.elites?.tanks ?? 0;
    const outside = Object.fromEntries(Object.entries(actor.forces).filter(([key]) =>
      !f.lossTerritories.includes(splitLocation(key).territory)));
    const views = await restored(f, before);
    for (const view of views) assert.deepEqual(view.advancedAllySeparation,
      view.me === actor.id ? { territories: f.lossTerritories.map(id => territory(id).name) } : null);
    if (alliance === 'firstEnding') {
      const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
      await rejected(f, before, { playerId: actor.id, tokenHash: foreign.tokenHash }, { type: 'endMovement' });
      await rejected(f, before, await authenticate(f, f.ally), { type: 'endMovement' });
    }
    const done = await race(f, before, actor.id, { type: 'endMovement' });
    const ended = player(done, actor.id);
    assert.equal(ended.tanks, beforeTanks + losses.total);
    assert.equal(ended.elites?.tanks ?? 0, beforeEliteTanks + losses.elite);
    assert.deepEqual(lossCounts(done, actor.id, f.lossTerritories), { total: 0, elite: 0 });
    assert.deepEqual(Object.fromEntries(Object.entries(ended.forces).filter(([key]) =>
      !f.lossTerritories.includes(splitLocation(key).territory))), outside);
    for (const [id, expected] of otherCustody) assert.deepEqual(custody(done, id as string), expected);
    assert.deepEqual(forceStock(done), f.forces, 'casualties conserve physical and elite inventory');
    assert.deepEqual(cardStock(done), f.stock);
    await restored(f, done);
    await rejected(f, done, await authenticate(f, actor.id), { type: 'endMovement' });
    await rejected(f, done, await authenticate(f, actor.id), { type: 'endMovement' }, before.version);
    assert.equal(player(await f.restart().readRoom(f.code), actor.id).tanks, beforeTanks + losses.total);
  });
}

void test('SQLite native dealt Hajr retires without an early alliance casualty and the subsequent real ending loses the group once', async t => {
  const f = await fixture(t, { alliance: 'firstEnding', hajr: true });
  let g = f.initial;
  const actor = player(g, f.actor), card = actor.hand.find(c => c.effect === 'hajr');
  assert.ok(card, 'the actual native starting deal supplies Hajr to the ending actor');
  assert.ok(f.ally);
  const losses = lossCounts(g, actor.id, f.lossTerritories);
  assert.ok(losses.total > 0);
  const beforeForces = plain(actor.forces), beforeElite = plain(actor.elites), allyCustody = plain(custody(g, f.ally));
  g = await act(f, g, actor.id, { type: 'card', card: card.id });
  assert.equal(player(g, actor.id).tanks, actor.tanks);
  assert.deepEqual(player(g, actor.id).forces, beforeForces);
  assert.deepEqual(player(g, actor.id).elites, beforeElite);
  assert.equal(player(g, actor.id).hand.some(c => c.id === card.id), false);
  assert.equal(g.discard.filter(c => c.id === card.id).length, 1);
  assert.equal(g.hajr.includes(actor.id), true);
  await restored(f, g);
  g = await race(f, g, actor.id, { type: 'endMovement' });
  assert.equal(player(g, actor.id).tanks, actor.tanks + losses.total);
  assert.deepEqual(lossCounts(g, actor.id, f.lossTerritories), { total: 0, elite: 0 });
  assert.deepEqual(custody(g, f.ally), allyCustody);
  assert.equal(g.discard.filter(c => c.id === card.id).length, 1);
  assert.deepEqual(forceStock(g), f.forces);
  await restored(f, g);
  await rejected(f, g, await authenticate(f, actor.id), { type: 'card', card: card.id });
  await rejected(f, g, await authenticate(f, actor.id), { type: 'endMovement' });
});

for (const advanced of [false, true]) {
  for (const alliance of ['ownAdvisors', 'allyAdvisors', 'ecaz', 'polar'] as const) {
    if (!advanced && (alliance === 'ownAdvisors' || alliance === 'allyAdvisors')) continue;
    void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} ${alliance} retains both allied groups on genuine native ending`, async t => {
      const f = await fixture(t, { advanced, alliance });
      const before = f.initial;
      assert.equal(before.active, f.actor);
      assert.ok(f.ally);
      const shared = alliance === 'polar' ? 'polar_sink' : alliance === 'ecaz' ? 'imperial_basin' : 'arrakeen';
      assert.ok(lossCounts(before, f.actor, [shared]).total > 0);
      assert.ok(lossCounts(before, f.ally, [shared]).total > 0, 'the exception is exercised with actual co-present groups');
      if (alliance === 'ownAdvisors' || alliance === 'allyAdvisors') {
        const advisor = player(before, alliance === 'ownAdvisors' ? f.actor : f.ally);
        assert.equal(advisor.faction, 'beneGesserit');
        assert.ok(advisor.advisors?.[shared], 'actual BG advisor classification, not merely a BG faction');
      }
      const occupants = before.players.map(p => [p.id, plain(custody(before, p.id))]);
      for (const view of await restored(f, before)) assert.equal(view.advancedAllySeparation, null);
      const done = await act(f, before, f.actor, { type: 'endMovement' });
      for (const [id, expected] of occupants) assert.deepEqual(custody(done, id as string), expected);
      assert.deepEqual(forceStock(done), f.forces);
      await restored(f, done);
      await rejected(f, done, await authenticate(f, f.actor), { type: 'endMovement' }, before.version);
    });
  }
}

void test('SQLite Basic newly allied native movement retains the same-turn fighter group without an Advanced warning', async t => {
  const f = await fixture(t, { advanced: false, alliance: 'newThisTurn' });
  const actor = player(f.initial, f.actor);
  assert.equal(actor.allySinceTurn, f.initial.turn);
  assert.ok(lossCounts(f.initial, f.actor, f.lossTerritories).total > 0);
  assert.ok(f.ally && lossCounts(f.initial, f.ally, f.lossTerritories).total > 0);
  const before = plain(custody(f.initial, f.actor));
  for (const view of await restored(f, f.initial)) assert.equal(view.advancedAllySeparation, null);
  const done = await act(f, f.initial, f.actor, { type: 'endMovement' });
  assert.deepEqual(custody(done, f.actor), before);
  await restored(f, done);
});

void test('SQLite Basic old alliance loses only the later ending player after the native earlier ally has retained its group', async t => {
  const f = await fixture(t, { advanced: false, alliance: 'laterEnding' });
  const before = f.initial, actor = player(before, f.actor);
  assert.ok(f.ally);
  assert.ok((actor.allySinceTurn ?? before.turn) < before.turn);
  assert.equal(before.movementRemaining?.includes(f.ally), false);
  const losses = lossCounts(before, actor.id, f.lossTerritories);
  assert.ok(losses.total > 0);
  assert.ok(lossCounts(before, f.ally, f.lossTerritories).total > 0, 'the earlier ending ally genuinely retained its shared group');
  const earlierCustody = plain(custody(before, f.ally));
  await restored(f, before);
  const done = await race(f, before, actor.id, { type: 'endMovement' });
  assert.equal(player(done, actor.id).tanks, actor.tanks + losses.total);
  assert.deepEqual(lossCounts(done, actor.id, f.lossTerritories), { total: 0, elite: 0 });
  assert.deepEqual(custody(done, f.ally), earlierCustody);
  assert.deepEqual(forceStock(done), f.forces);
  await restored(f, done);
  await rejected(f, done, await authenticate(f, actor.id), { type: 'endMovement' });
});

void test('SQLite saved Advanced source actions reject foreign, forged-seat and stale credentials without changing unrelated rows', async t => {
  const f = await fixture(t, { storm: 'next' });
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  const before = row(f), changes = totalChanges(f);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  const forged = { playerId: f.auths[0].playerId, tokenHash: foreign.tokenHash };
  await assert.rejects(f.restart().readSeatView(f.code, forged));
  assert.equal(totalChanges(f), changes);
  assert.deepEqual(row(f), before);
  await rejected(f, f.initial, foreign, { type: 'ready' });
  await rejected(f, f.initial, forged, { type: 'ready' });
  await rejected(f, f.initial, f.auths[0], { type: 'ready' }, f.initial.version - 1);
  await restored(f, f.initial);
});

for (const corrupt of [
  { name: 'altered source distance', change: (g: Game) => { g.stormMovementSource!.distance++; } },
  { name: 're-signed source from another turn', change: (g: Game) => {
    g.stormMovementSource = createStormSource(g.turn - 1, 'card', g.stormPending!);
  } },
  { name: 'orphaned pending distance', change: (g: Game) => { g.stormPending = g.stormPending === 6 ? 5 : 6; } },
  { name: 'lost original source', change: (g: Game) => { delete g.stormMovementSource; } },
  { name: 're-signed noncanonical card face', change: (g: Game) => {
    g.stormPending = 7;
    g.stormMovementSource = createStormSource(g.turn, 'card', 7);
  } },
] as const) {
  void test(`SQLite Advanced ${corrupt.name} rejects projection, normalization and action immutably with no durable writes`, async t => {
    const f = await fixture(t, { storm: 'next' });
    const broken = plain(f.initial);
    corrupt.change(broken);
    f.save(broken);
    const original = plain(broken), before = row(f), changes = totalChanges(f);
    assert.deepEqual(await f.restart().readRoom(f.code), original, 'raw restart preserves the corrupted record for rejection, not repair');
    for (const auth of f.auths) {
      assert.throws(() => viewGame(broken, auth.playerId));
      await assert.rejects(f.restart().readSeatView(f.code, auth));
    }
    assert.throws(() => normalizeAutomaticGame(broken));
    assert.throws(() => applyAction(broken, f.actor, { type: 'ready' }));
    await rejected(f, broken, await authenticate(f, f.actor), { type: 'ready' });
    assert.deepEqual(plain(broken), original);
    assert.deepEqual(row(f), before);
    assert.equal(totalChanges(f), changes);
    protectedRows(f);
  });
}
