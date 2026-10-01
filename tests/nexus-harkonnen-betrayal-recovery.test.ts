import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { shuffle, viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { startPrototypeRoom } from '../tools/prototype-room';
import { unitStore } from './fixture-nexus-room-store';
import {
  createHarkonnenNexusBetrayalFixture,
  nextHarkonnenBetrayalNativeStep,
  type HarkonnenBetrayalFixture,
  type HarkonnenBetrayalFixtureOptions as Options,
} from './fixture-nexus-harkonnen-betrayal';

type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends HarkonnenBetrayalFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void>; afterStatement?: (sql: string) => Promise<void> };
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(game: Game): void;
  protectedRows: Record<string, SqlRow[]>;
  unrelatedCode: string;
  unrelatedToken: string;
  stock: string[];
  traitorStock: string[];
  setup: Game;
  initial: Game;
}
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Compare durable records, including credentials, lifecycle and recovery resources,
 * rather than treating an attempted SQL update as a committed game action. */
function records(sqlite: DatabaseSync, excludedRoom?: string) {
  const result: Record<string, SqlRow[]> = {};
  for (const row of sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    assert.equal(typeof row.name, 'string');
    const table = String(row.name).replaceAll('"', '""');
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    result[String(row.name)] = rows.filter(value => !(row.name === 'rooms' && value.code === excludedRoom));
  }
  return result;
}
function physical(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'native Treachery cards have one physical custodian');
  return ids;
}
function traitors(game: Game) {
  const ids = [...(game.traitorReserve ?? []), ...game.players.flatMap(player => [...player.traitors, ...player.traitorChoices])].sort();
  assert.equal(new Set(ids).size, ids.length, 'each original physical Traitor Card has exactly one custodian');
  return ids;
}
function player(game: Game, id: string) {
  const value = game.players.find(player => player.id === id);
  assert.ok(value);
  return value;
}
function inventory(f: Fixture, game: Game) {
  assert.deepEqual(physical(game), f.stock);
  assert.equal(f.stock.length, 33);
  assert.deepEqual(traitors(game), f.traitorStock);
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  assert.deepEqual([...game.nexusCards.cards.deck, ...game.nexusCards.cards.discard,
    ...Object.values(game.nexusCards.cards.hands).filter(face => face !== null)].sort(), [...NEXUS_FACTIONS].sort());
  assert.deepEqual(records(f.sqlite, f.code), f.protectedRows);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, game: Game, id: string, action: Action) {
  await f.restart().act(f.code, await authenticate(f, id), game.version, action, clock);
  // The room API treats this native wake-up as read-only; its persisted worker
  // performs any genuine pending discard continuation through the normal CAS.
  if (action.type === 'advanceBots') await f.restart().continueRoomAutomatic(f.code, clock);
  return f.restart().readRoom(f.code);
}
async function nativeCounters(f: Fixture, initial: Game) {
  let game = initial;
  for (let step = 0; game.response && step < 20; step++) {
    const responder = game.players.find(player => !game.response!.passed.includes(player.id));
    assert.ok(responder);
    game = await act(f, game, responder.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}
async function openGate(f: Fixture, beforeCall: Game) {
  let game = await act(f, beforeCall, f.provider, f.callAction);
  if (f.remote) {
    if (game.response) {
      assert.equal(game.response.kind, 'harkonnenTraitor');
      assert.equal(viewGame(game, f.holder).nexusHarkonnenBetrayalReaction, null);
    } else {
      assert.equal(game.pendingNexusHarkonnenBetrayal!.source.nativeWindow, 'harkonnenTraitor');
      assert.equal(game.pendingNexusHarkonnenBetrayal!.source.nativeRequired.length, 0,
        'Only a real counter-free native call may reach Nexus automatically.');
    }
  }
  game = await nativeCounters(f, game);
  assert.ok(game.pendingNexusHarkonnenBetrayal);
  assert.equal(viewGame(game, f.holder).nexusHarkonnenBetrayalReaction!.event, f.event);
  return game;
}
async function fixture(t: test.TestContext, options: Options & { counterKind?: 'printed' | 'BG Worthless' } = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Native Harkonnen recovery', 'harkonnen', options.advanced ?? true, []);
  const code = made.view.code;
  const tokens = [made.token];
  // BG's original prediction keeps the CLI-produced setup genuinely undealt;
  // the fixture then consumes that native setup with its scoped deterministic RNG.
  const factions = options.counterKind === 'printed' ? ['atreides', 'emperor'] as const
    : ['atreides', 'emperor', 'beneGesserit'] as const;
  for (const faction of factions) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    assert.ok(joined.token);
    tokens.push(joined.token);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  let admitted = await store.rooms.readRoom(code);
  for (const auth of auths) {
    await store.rooms.act(code, auth, admitted.version, { type: 'ready' }, clock);
    admitted = await store.rooms.readRoom(code);
  }
  // Main recovery scenarios continue the exact CLI-produced undealt setup.
  // Counter scenarios retain the authenticated fresh lobby so the native fixture
  // can conserve and order its first actual deal; no started custody is redealt.
  if (!options.counterKind) startPrototypeRoom(store.sqlite, code, admitted.version, 'harkonnen-betrayal');
  const setup = await store.rooms.readRoom(code);
  const native = createHarkonnenNexusBetrayalFixture({ advanced: options.advanced, remote: options.remote,
    receiverCount: options.receiverCount, face: options.face, initial: setup });
  assert.equal(native.beforeCall.code, code);
  assert.equal(native.beforeCall.host, admitted.host);
  assert.equal(native.beforeCall.advanced, admitted.advanced);
  assert.deepEqual(native.beforeCall.expansions, []);
  assert.deepEqual(native.beforeCall.playerPositions, admitted.playerPositions);
  assert.deepEqual(native.beforeCall.players.map(player => [player.id, player.name, player.faction]),
    admitted.players.map(player => [player.id, player.name, player.faction]));
  const save = (game: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(game), game.version, code).changes, 1);
  };
  save(native.beforeCall);
  const unrelated = await store.rooms.createRoom('Unrelated preserved lobby', 'guild', false, []);
  const f: Fixture = { ...store, ...native, code, tokens, auths, save,
    protectedRows: records(store.sqlite, code), unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token,
    stock: physical(native.beforeCall), traitorStock: traitors(native.beforeCall), initial: native.beforeCall, setup };
  f.initial = await openGate(f, native.beforeCall);
  return f;
}
async function rejected(f: Fixture, game: Game, auth: SeatAuth, action: Action, version = game.version) {
  const before = records(f.sqlite);
  await assert.rejects(f.restart().act(f.code, auth, version, action, clock));
  assert.deepEqual(records(f.sqlite), before, 'rejection changes no durable game, credential or resource record');
}
async function restored(f: Fixture, game: Game) {
  const before = records(f.sqlite);
  assert.deepEqual(plain(await f.restart().readRoom(f.code)), plain(game));
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(plain(view), plain(viewGame(game, auth.playerId)));
    for (const key of ['pendingNexusHarkonnenBetrayal', 'nexusHarkonnenBetrayalCursor', 'nexusHarkonnenBetrayalHistory',
      'pendingNexusHarkonnenReplacement', 'nexusHarkonnenReplacementHistory', 'traitorReserve'])
      assert.equal(Object.hasOwn(view, key), false, `${key} stays private`);
    for (const rival of view.players.filter(player => player.id !== auth.playerId))
      for (const key of ['hand', 'traitors', 'spice']) assert.equal(Object.hasOwn(rival, key), false);
    const reaction = view.nexusHarkonnenBetrayalReaction;
    if (reaction) {
      assert.deepEqual(Object.keys(reaction).sort(), ['event', 'provider', 'beneficiary', 'target', 'leader', 'identity', 'canPass', 'hasPassed', 'canUse', 'blocked'].sort());
      assert.equal(reaction.provider, f.provider);
      assert.equal(reaction.beneficiary, f.beneficiary);
      assert.equal(reaction.target, f.target);
      assert.equal(reaction.identity, f.identity, 'only the genuine public declaration is revealed');
      if (!f.required.includes(auth.playerId)) {
        assert.equal(reaction.canPass, false);
        assert.equal(reaction.canUse, false);
        assert.equal(reaction.blocked, null);
      }
    }
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(records(f.sqlite), before, 'refresh/recovery never consumes a pending response or redraws a finished replacement');
  inventory(f, game);
}
async function closeGate(f: Fixture, initial: Game, used: boolean) {
  if (used) return act(f, initial, f.holder, { type: 'nexusHarkonnenBetrayalUse', event: f.event });
  let game = initial;
  for (const id of f.required) game = await act(f, game, id, { type: 'nexusHarkonnenBetrayalPass', event: f.event });
  return game;
}
function settled(f: Fixture, game: Game, used: boolean) {
  assert.equal(game.pendingNexusHarkonnenBetrayal ?? null, null);
  assert.equal(viewGame(game, f.holder).nexusHarkonnenBetrayalReaction, null);
  const history = game.nexusHarkonnenBetrayalHistory!;
  assert.equal(history.length, (f.initial.nexusHarkonnenBetrayalHistory?.length ?? 0) + 1);
  const receipt = history.at(-1)!;
  assert.deepEqual(receipt.source, f.initial.pendingNexusHarkonnenBetrayal!.source);
  assert.equal(receipt.outcome, used ? 'use' : 'pass');
  assert.equal(receipt.holder, used ? f.holder : null);
  assert.equal(game.nexusHarkonnenBetrayalCursor!.sequence, f.initial.nexusHarkonnenBetrayalCursor!.sequence + 1);
  assert.equal(game.nexusCards!.cards!.hands[f.holder], used ? null : f.initial.nexusCards!.cards!.hands[f.holder]);
  assert.deepEqual(game.nexusCards!.cards!.discard, [...f.initial.nexusCards!.cards!.discard, ...(used ? ['harkonnen'] : [])]);
  assert.deepEqual(player(game, f.provider).traitors, used
    ? player(f.initial, f.provider).traitors.filter(identity => identity !== f.identity)
    : player(f.initial, f.provider).traitors);
  if (used) {
    assert.deepEqual([...(game.traitorReserve ?? [])].sort(), [...(f.initial.traitorReserve ?? []), f.identity].sort());
    assert.equal(player(game, f.provider).revealedTraitors?.includes(f.identity) ?? false, false);
    assert.equal(game.pendingNexusHarkonnenReplacement!.status, 'due');
    assert.equal(game.pendingNexusHarkonnenReplacement!.identity, f.identity);
    assert.equal(game.pendingNexusHarkonnenReplacement!.provider, f.provider);
    assert.equal(game.pendingNexusHarkonnenReplacement!.turn, f.initial.turn);
    assert.equal(game.pendingNexusHarkonnenReplacement!.drawn, null);
    assert.equal(game.battle?.traitorCalls[f.provider], false, 'the original call is canceled, not replayed');
  } else {
    assert.equal(game.pendingNexusHarkonnenReplacement ?? null, null);
    assert.deepEqual(game.traitorReserve, f.initial.traitorReserve);
  }
  inventory(f, game);
}
async function mentat(f: Fixture, initial: Game, raceRecovery = false) {
  let game = initial;
  for (let step = 0; game.phase !== 8 && step < 80; step++) {
    const next = nextHarkonnenBetrayalNativeStep(game);
    const before = game;
    if (raceRecovery) {
      await Promise.all([act(f, before, next.actor, next.action),
        f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
      game = await f.restart().readRoom(f.code);
    } else game = await act(f, before, next.actor, next.action);
  }
  assert.equal(game.phase, 8, 'actual battle resolution, Collection and native readiness reach Mentat');
  assert.equal(game.turn, initial.turn);
  assert.equal(game.battle, null);
  return game;
}

for (const advanced of [false, true]) for (const remote of [false, true]) for (const used of [false, true]) {
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} ${remote ? 'allied' : 'personal'} Harkonnen ${used ? 'Use' : 'all-pass'} continues the original battle and actual Mentat once`, async t => {
    const f = await fixture(t, { advanced, remote });
    await restored(f, f.initial);
    const done = await closeGate(f, f.initial, used);
    settled(f, done, used);
    await restored(f, done);
    const expectedDraw = done.traitorReserve?.[0];
    const previousHeld = [...player(done, f.provider).traitors];
    const pause = await mentat(f, done, true);
    assert.equal(pause.pendingNexusHarkonnenReplacement ?? null, null);
    if (used) {
      const drawn = pause.nexusHarkonnenReplacementHistory!.at(-1)!;
      assert.equal(drawn.status, 'drawn');
      assert.equal(drawn.event, f.event);
      assert.equal(drawn.drawn, expectedDraw);
      assert.deepEqual(player(pause, f.provider).traitors, [...previousHeld, expectedDraw]);
      assert.deepEqual(pause.traitorReserve, done.traitorReserve!.slice(1));
      assert.equal(pause.nexusHarkonnenReplacementHistory!.length, (done.nexusHarkonnenReplacementHistory?.length ?? 0) + 1);
    } else {
      assert.deepEqual(pause.nexusHarkonnenReplacementHistory, done.nexusHarkonnenReplacementHistory);
      assert.deepEqual(player(pause, f.provider).traitors, previousHeld);
    }
    await restored(f, pause);
    for (const type of ['nexusHarkonnenBetrayalUse', 'nexusHarkonnenBetrayalPass'] as const)
      await rejected(f, pause, await authenticate(f, f.holder), { type, event: f.event });
  });
}

void test('SQLite lost successful Use response restores the exact committed shuffle and cannot spend or schedule twice', async t => {
  const f = await fixture(t, { remote: true });
  let lost = false;
  f.hooks.afterStatement = async sql => {
    if (sql.startsWith('UPDATE rooms SET state') && !lost) { lost = true; throw new Error('lost response after committed CAS'); }
  };
  try {
    await assert.rejects(f.restart().act(f.code, await authenticate(f, f.holder), f.initial.version,
      { type: 'nexusHarkonnenBetrayalUse', event: f.event }, clock), /lost response/);
  } finally { delete f.hooks.afterStatement; }
  const committed = await f.restart().readRoom(f.code);
  assert.equal(committed.version, f.initial.version + 1);
  settled(f, committed, true);
  await restored(f, committed);
  await rejected(f, committed, await authenticate(f, f.holder), { type: 'nexusHarkonnenBetrayalUse', event: f.event }, f.initial.version);
  await rejected(f, committed, await authenticate(f, f.holder), { type: 'nexusHarkonnenBetrayalUse', event: f.event });
});

void test('SQLite actor credentials, revoked sessions and event-only selectors fence private state without durable changes', async t => {
  const f = await fixture(t);
  const holder = await authenticate(f, f.holder);
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  const use: Action = { type: 'nexusHarkonnenBetrayalUse', event: f.event };
  const before = records(f.sqlite);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  await assert.rejects(f.restart().readSeatView(f.code, { playerId: f.holder, tokenHash: foreign.tokenHash }));
  assert.deepEqual(records(f.sqlite), before);
  for (const auth of [foreign, { playerId: f.holder, tokenHash: foreign.tokenHash }, await authenticate(f, f.provider)])
    await rejected(f, f.initial, auth, use);
  await rejected(f, f.initial, holder, use, f.initial.version - 1);
  for (const extra of [{ actor: f.provider }, { player: f.provider }, { provider: f.provider }, { holder: f.holder },
    { identity: f.identity }, { leader: f.identity }, { target: f.target }, { card: 'harkonnen' }, { event: `${f.event}:stale` }, { replacement: f.identity }])
    for (const type of ['nexusHarkonnenBetrayalUse', 'nexusHarkonnenBetrayalPass'] as const)
      await rejected(f, f.initial, holder, { ...use, type, ...extra } as Action);
  for (const action of [f.callAction, { type: 'passResponse' }, { type: 'ready' }, { type: 'traitorCall', call: false }, { type: 'nexusCard', choice: 'replace' }])
    await rejected(f, f.initial, await authenticate(f, f.provider), action as Action);
  f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.holder);
  f.protectedRows = records(f.sqlite, f.code);
  await assert.rejects(f.restart().readSeatView(f.code, holder));
  await rejected(f, f.initial, holder, use);
});

void test('SQLite neutral rival acknowledgments are identical for genuine relevant and irrelevant natural Nexus draws', async t => {
  const f = await fixture(t);
  const irrelevantFixture = createHarkonnenNexusBetrayalFixture({ initial: f.setup, face: 'richese' });
  const other: Fixture = { ...f, ...irrelevantFixture };
  f.save(irrelevantFixture.beforeCall);
  const irrelevant = await openGate(other, irrelevantFixture.beforeCall);
  other.initial = irrelevant;
  for (const auth of f.auths) {
    const original = viewGame(f.initial, auth.playerId);
    const changed = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    if (auth.playerId !== f.holder) {
      const originalReaction = original.nexusHarkonnenBetrayalReaction!;
      const changedReaction = changed.nexusHarkonnenBetrayalReaction!;
      assert.deepEqual({ ...changedReaction, event: null }, { ...originalReaction, event: null });
      assert.deepEqual(changed.players.map(player => [player.id, player.revealedTraitors]),
        original.players.map(player => [player.id, player.revealedTraitors]));
      assert.deepEqual(changed.nexusCards, original.nexusCards);
    }
    else {
      assert.equal(changed.nexusHarkonnenBetrayalReaction!.canPass, true);
      assert.equal(changed.nexusHarkonnenBetrayalReaction!.canUse, false);
    }
  }
  await restored(other, irrelevant);
  await rejected(other, irrelevant, await authenticate(other, other.holder), { type: 'nexusHarkonnenBetrayalUse', event: other.event });
  const done = await closeGate(other, irrelevant, false);
  assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
  assert.deepEqual(done.nexusCards!.cards!.discard, irrelevant.nexusCards!.cards!.discard);
  inventory(f, done);
});

void test('SQLite two public receivers restore partial Pass, retain private faces and reject duplicate/stale acknowledgement', async t => {
  const f = await fixture(t, { receiverCount: 2 });
  assert.equal(f.required.length, 2);
  const firstId = f.required.find(id => id !== f.holder)!;
  const first = await act(f, f.initial, firstId, { type: 'nexusHarkonnenBetrayalPass', event: f.event });
  assert.deepEqual(first.pendingNexusHarkonnenBetrayal!.passed, [firstId]);
  assert.equal(viewGame(first, firstId).nexusHarkonnenBetrayalReaction!.hasPassed, true);
  assert.equal(viewGame(first, f.holder).active, f.holder);
  assert.deepEqual(first.nexusCards!.cards, f.initial.nexusCards!.cards);
  assert.deepEqual(first.nexusHarkonnenBetrayalHistory, f.initial.nexusHarkonnenBetrayalHistory);
  await restored(f, first);
  await rejected(f, first, await authenticate(f, firstId), { type: 'nexusHarkonnenBetrayalPass', event: f.event });
  await rejected(f, first, await authenticate(f, f.holder), { type: 'nexusHarkonnenBetrayalUse', event: f.event }, f.initial.version);
  const done = await closeGate(f, first, true);
  settled(f, done, true);
});

for (const race of ['use/pass', 'use/use', 'two passes'] as const) {
  void test(`SQLite concurrent ${race} commits one source transition and restores the losing actor's fresh continuation`, async t => {
    const f = await fixture(t, { receiverCount: race === 'two passes' ? 2 : 1 });
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const ids = race === 'two passes' ? f.required : [f.holder, f.holder];
    const auths = await Promise.all(ids.map(id => authenticate(f, id)));
    const types = race === 'two passes' ? ['nexusHarkonnenBetrayalPass', 'nexusHarkonnenBetrayalPass'] as const
      : race === 'use/use' ? ['nexusHarkonnenBetrayalUse', 'nexusHarkonnenBetrayalUse'] as const
      : ['nexusHarkonnenBetrayalUse', 'nexusHarkonnenBetrayalPass'] as const;
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled(auths.map((auth, index) => f.restart().act(f.code, auth, f.initial.version,
        { type: types[index], event: f.event }, clock).finally(release)));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    let done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    if (race === 'two passes') {
      const winner = results.findIndex(result => result.status === 'fulfilled');
      assert.deepEqual(done.pendingNexusHarkonnenBetrayal!.passed, [ids[winner]]);
      await restored(f, done);
      await rejected(f, done, auths[winner], { type: 'nexusHarkonnenBetrayalPass', event: f.event });
      done = await act(f, done, ids[1 - winner], { type: 'nexusHarkonnenBetrayalPass', event: f.event });
      settled(f, done, false);
    } else settled(f, done, race === 'use/use' || results[0].status === 'fulfilled');
    await restored(f, done);
  });
}

async function corruptRejected(f: Fixture, corrupt: Game, name: string) {
  f.save(corrupt);
  const before = records(f.sqlite);
  const original = plain(corrupt);
  for (const auth of f.auths)
    await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
  for (const type of ['nexusHarkonnenBetrayalPass', 'nexusHarkonnenBetrayalUse'] as const)
    await rejected(f, corrupt, await authenticate(f, f.holder), { type, event: f.event });
  await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(records(f.sqlite), before, `${name}: read/action/normalize never repairs or consumes corrupt saves`);
  assert.deepEqual(corrupt, original);
}

for (const remote of [false, true]) {
  void test(`SQLite ${remote ? 'allied' : 'personal'} committed source and physical custody corruption is immutable across authenticated read/action/recovery`, async t => {
    const f = await fixture(t, remote ? { remote: true, counterKind: 'printed' } : { remote: false });
    if (remote) assert.ok(f.initial.pendingNexusHarkonnenBetrayal!.source.nativePassed.length,
      'The lost-pass mutation requires an actual completed native counter window.');
    const alterations: { name: string; change: (game: Game) => void }[] = [
      { name: 'missing gate', change: game => { delete game.pendingNexusHarkonnenBetrayal; } },
      { name: 'missing cursor', change: game => { delete game.nexusHarkonnenBetrayalCursor; } },
      { name: 'missing history', change: game => { delete game.nexusHarkonnenBetrayalHistory; } },
      { name: 'cursor sequence', change: game => { game.nexusHarkonnenBetrayalCursor!.sequence++; } },
      { name: 'source parent', change: game => { game.pendingNexusHarkonnenBetrayal!.source.parent += ':forged'; } },
      { name: 'native counter context', change: game => { game.pendingNexusHarkonnenBetrayal!.source.nativeContext += ':forged'; } },
      { name: 'native window', change: game => { game.pendingNexusHarkonnenBetrayal!.source.nativeWindow = remote ? 'direct' : 'harkonnenTraitor'; } },
      { name: 'source provider', change: game => { game.pendingNexusHarkonnenBetrayal!.source.provider = f.holder; } },
      { name: 'matched identity', change: game => { game.pendingNexusHarkonnenBetrayal!.source.declaration.identity = game.traitorReserve![0]; } },
      { name: 'battle event', change: game => { game.battle!.event += ':forged'; } },
      { name: 'beneficiary role', change: game => { game.pendingNexusHarkonnenBetrayal!.source.declaration.beneficiary = f.holder; } },
      { name: 'required membership', change: game => { game.pendingNexusHarkonnenBetrayal!.required = [f.provider]; } },
      { name: 'invented pass', change: game => { game.pendingNexusHarkonnenBetrayal!.passed = [f.provider]; } },
      { name: 'public declaration', change: game => { game.battle!.traitorDeclarations![f.provider].signature += ':forged'; } },
      { name: 'missing called physical traitor', change: game => {
        player(game, f.provider).traitors = player(game, f.provider).traitors.filter(identity => identity !== f.identity);
        game.traitorReserve!.push(f.identity);
      } },
      { name: 'duplicate Traitor identity', change: game => { game.traitorReserve!.push(f.identity); } },
      { name: 'missing Traitor identity', change: game => { game.traitorReserve!.pop(); } },
      { name: 'duplicate Nexus', change: game => { game.nexusCards!.cards!.deck.push('harkonnen'); } },
      { name: 'mutated committed Nexus face', change: game => {
        const cards = game.nexusCards!.cards!;
        const index = cards.deck.indexOf('richese');
        assert.ok(index >= 0);
        cards.hands[f.holder] = 'richese';
        cards.deck[index] = 'harkonnen';
      } },
      { name: 'missing base Treachery', change: game => { game.deck.pop(); } },
      { name: 'canonical Treachery face', change: game => { game.deck[0].name += ' forged'; } },
      { name: 'lost preview boundary', change: game => { delete game.nexusHarkonnenBetrayalPreview; } },
      { name: 'native faction changed', change: game => { player(game, f.provider).faction = 'guild'; } },
      { name: 'foreign expansion', change: game => { game.expansions.push('ix'); } },
      { name: 'wrong phase', change: game => { game.phase++; } },
      { name: 'wrong turn', change: game => { game.turn++; } },
      ...(remote ? [{ name: 'lost original counter passes', change: (game: Game) => {
        game.pendingNexusHarkonnenBetrayal!.source.nativePassed = [];
      } }] : []),
    ];
    for (const { name, change } of alterations) {
      const corrupt = structuredClone(f.initial);
      change(corrupt);
      await corruptRejected(f, corrupt, name);
    }
  });
}

void test('SQLite exact successful Use obligation restores before Mentat, privately draws once and rejects corrupted late provenance', async t => {
  const f = await fixture(t, { remote: true });
  const due = await closeGate(f, f.initial, true);
  await restored(f, due);
  const pending = due.pendingNexusHarkonnenReplacement!;
  const dueAlterations: { name: string; change: (game: Game) => void }[] = [
    { name: 'missing obligation', change: game => { game.pendingNexusHarkonnenReplacement = null; } },
    { name: 'replacement wrong provider', change: game => { game.pendingNexusHarkonnenReplacement!.provider = f.holder; } },
    { name: 'replacement wrong turn', change: game => { game.pendingNexusHarkonnenReplacement!.turn++; } },
    { name: 'replacement wrong identity', change: game => { game.pendingNexusHarkonnenReplacement!.identity = game.traitorReserve!.find(identity => identity !== f.identity)!; } },
    { name: 'replacement receipt link', change: game => { game.pendingNexusHarkonnenReplacement!.receipt += ':forged'; } },
    { name: 'premature replacement', change: game => {
      game.pendingNexusHarkonnenReplacement!.status = 'drawn';
      game.pendingNexusHarkonnenReplacement!.drawn = game.traitorReserve![0];
    } },
    { name: 'closed history link', change: game => { game.nexusHarkonnenBetrayalHistory!.at(-1)!.previous += ':forged'; } },
    { name: 'closed declaration source', change: game => { game.nexusHarkonnenBetrayalHistory!.at(-1)!.source.nativeContext += ':forged'; } },
  ];
  for (const { name, change } of dueAlterations) {
    const corrupt = structuredClone(due);
    change(corrupt);
    await corruptRejected(f, corrupt, name);
  }
  f.save(due);
  let game = due;
  for (let count = 0; game.phase !== 7 && count < 80; count++) {
    const step = nextHarkonnenBetrayalNativeStep(game);
    game = await act(f, game, step.actor, step.action);
  }
  assert.equal(game.phase, 7, 'the original battle reaches actual Collection without changing the due obligation');
  await restored(f, game);
  assert.deepEqual(game.pendingNexusHarkonnenReplacement, pending);
  const pause = await mentat(f, game, true);
  assert.equal(pause.pendingNexusHarkonnenReplacement, null);
  const drawn = pause.nexusHarkonnenReplacementHistory!.at(-1)!;
  assert.equal(drawn.receipt, pending.receipt);
  assert.equal(drawn.drawn, game.traitorReserve![0]);
  const providerView = await f.restart().readSeatView(f.code, await authenticate(f, f.provider));
  assert.deepEqual(providerView.players.find(player => player.id === f.provider)!.traitors, player(pause, f.provider).traitors);
  for (const auth of f.auths.filter(auth => auth.playerId !== f.provider)) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.equal(Object.hasOwn(view.players.find(player => player.id === f.provider)!, 'traitors'), false);
    assert.equal(Object.hasOwn(view, 'nexusHarkonnenReplacementHistory'), false);
  }
  await restored(f, pause);
  for (const change of [
    (game: Game) => { game.nexusHarkonnenReplacementHistory = []; },
    (game: Game) => { game.nexusHarkonnenReplacementHistory!.push(structuredClone(drawn)); },
    (game: Game) => { game.nexusHarkonnenReplacementHistory!.at(-1)!.drawn = 'unknown-physical-identity'; },
    (game: Game) => { game.nexusHarkonnenReplacementHistory!.at(-1)!.receipt += ':forged'; },
    (game: Game) => { game.pendingNexusHarkonnenReplacement = structuredClone(pending); },
    (game: Game) => { game.nexusHarkonnenBetrayalHistory = []; },
    (game: Game) => { game.nexusHarkonnenBetrayalCursor!.signature += ':forged'; },
  ]) {
    const corrupt = structuredClone(pause);
    change(corrupt);
    await corruptRejected(f, corrupt, 'completed replacement provenance');
  }
});

void test('SQLite Use shuffles the exact retired physical identity and permits its genuine same-card Mentat redraw once', async t => {
  const f = await fixture(t);
  const sourceReserve = [...f.initial.traitorReserve!, f.identity];
  let quoteIndex = 0;
  const expected = shuffle(sourceReserve, () => quoteIndex++ === 0 ? 0 : 0xffffffff / 4294967296);
  assert.equal(expected[0], f.identity, 'deterministic real shuffle places the retired identity at the actual deck top');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'getRandomValues');
  let randomIndex = 0;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      assert.ok(array instanceof Uint32Array);
      for (let index = 0; index < array.length; index++) array[index] = randomIndex++ === 0 ? 0 : 0xffffffff;
      return array;
    },
  });
  let due: Game;
  try {
    due = await closeGate(f, f.initial, true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis.crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  }
  assert.deepEqual(due.traitorReserve, expected, 'Use performs the native shuffle on reserve plus exactly the called physical card');
  assert.deepEqual(player(due, f.provider).traitors, player(f.initial, f.provider).traitors.filter(identity => identity !== f.identity));
  await restored(f, due);
  const pause = await mentat(f, due, true);
  assert.equal(pause.nexusHarkonnenReplacementHistory!.at(-1)!.drawn, f.identity);
  assert.equal(player(pause, f.provider).traitors.filter(identity => identity === f.identity).length, 1);
  assert.deepEqual(pause.traitorReserve, expected.slice(1));
  assert.equal(player(pause, f.provider).revealedTraitors?.includes(f.identity) ?? false, false,
    'a private replacement does not turn the historically declared card into current public ownership');
  await restored(f, pause);
});

void test('SQLite lost final Collection response restores the original actual Mentat draw without replaying battle or phase effects', async t => {
  const f = await fixture(t, { remote: true });
  const due = await closeGate(f, f.initial, true);
  let lost = false;
  f.hooks.afterStatement = async sql => {
    if (!sql.startsWith('UPDATE rooms SET state')) return;
    const saved = await f.restart().readRoom(f.code);
    if (saved.phase === 8 && !lost) { lost = true; throw new Error('lost final Collection response'); }
  };
  try {
    await assert.rejects(mentat(f, due), /lost final Collection response/);
  } finally { delete f.hooks.afterStatement; }
  assert.equal(lost, true);
  const pause = await f.restart().readRoom(f.code);
  assert.equal(pause.phase, 8);
  assert.equal(pause.turn, due.turn);
  assert.equal(pause.battle, null);
  assert.equal(pause.pendingNexusHarkonnenReplacement, null);
  assert.equal(pause.nexusHarkonnenReplacementHistory!.at(-1)!.drawn, due.traitorReserve![0]);
  assert.deepEqual(player(pause, f.provider).traitors, [...player(due, f.provider).traitors, due.traitorReserve![0]]);
  assert.deepEqual(pause.traitorReserve, due.traitorReserve!.slice(1));
  await restored(f, pause);
});

for (const counterKind of ['printed', 'BG Worthless'] as const) {
  void test(`SQLite actual allied Harkonnen ${counterKind} counter preempts the Nexus acknowledgement and preserves its face`, async t => {
    const f = await fixture(t, { remote: true, advanced: true, counterKind });
    f.save(f.beforeCall);
    const declared = await act(f, f.beforeCall, f.provider, f.callAction);
    assert.ok(declared.response);
    assert.equal(viewGame(declared, f.holder).nexusHarkonnenBetrayalReaction, null);
    const counter = counterKind === 'printed'
      ? declared.players.find(player => player.id !== f.provider && player.hand.some(card => card.effect === 'karama'))
      : declared.players.find(player => player.faction === 'beneGesserit');
    assert.ok(counter);
    const card = counter.hand.find(card => counterKind === 'printed' ? card.effect === 'karama' : card.kind === 'worthless');
    assert.ok(card, 'the conserved actual native deal supplies the counter card');
    const canceled = await act(f, declared, counter.id, { type: 'card', mode: 'cancel', card: card.id });
    const done = await nativeCounters(f, canceled);
    assert.equal(done.pendingNexusHarkonnenBetrayal ?? null, null);
    assert.equal(done.pendingNexusHarkonnenReplacement ?? null, null);
    assert.equal(viewGame(done, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.deepEqual(done.nexusHarkonnenBetrayalHistory, f.beforeCall.nexusHarkonnenBetrayalHistory);
    assert.deepEqual(done.nexusHarkonnenBetrayalCursor, f.beforeCall.nexusHarkonnenBetrayalCursor);
    assert.deepEqual(done.nexusCards!.cards, f.beforeCall.nexusCards!.cards);
    assert.deepEqual(player(done, f.provider).traitors, player(f.beforeCall, f.provider).traitors);
    assert.equal(done.discard.filter(value => value.id === card.id).length, 1);
    await restored(f, done);
  });
}

void test('SQLite credential revocation at the final Use fence cannot commit a source, shuffle or replacement', async t => {
  const f = await fixture(t);
  const auth = await authenticate(f, f.holder);
  const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
  let revoked = false;
  f.hooks.beforeWrite = async () => {
    assert.equal(revoked, false);
    revoked = true;
    f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.holder);
    f.protectedRows = records(f.sqlite, f.code);
  };
  try {
    await assert.rejects(f.restart().act(f.code, auth, f.initial.version, { type: 'nexusHarkonnenBetrayalUse', event: f.event }, clock));
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(revoked, true);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
  inventory(f, await f.restart().readRoom(f.code));
  await assert.rejects(f.restart().readSeatView(f.code, auth));
});

void test('SQLite every credential keeps independent own autopilot control while the original Harkonnen source remains pending', async t => {
  const f = await fixture(t, { receiverCount: 2 });
  let game = f.initial;
  for (const auth of f.auths) {
    const previous = game;
    game = await act(f, game, auth.playerId, { type: 'setAutopilot', difficulty: 'Easy' });
    assert.equal(player(game, auth.playerId).autopilot, 'Easy');
    assert.deepEqual(game.pendingNexusHarkonnenBetrayal, previous.pendingNexusHarkonnenBetrayal);
    assert.deepEqual(game.nexusCards!.cards, previous.nexusCards!.cards);
    assert.deepEqual(game.traitorReserve, previous.traitorReserve);
    game = await act(f, game, auth.playerId, { type: 'setAutopilot', difficulty: null });
    assert.equal(player(game, auth.playerId).autopilot ?? null, null);
    assert.deepEqual(game.pendingNexusHarkonnenBetrayal, f.initial.pendingNexusHarkonnenBetrayal);
  }
  await restored(f, game);
});
