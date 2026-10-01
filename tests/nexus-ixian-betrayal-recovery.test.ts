import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  createIxianNexusBetrayalFixture,
  type IxianBetrayalFixture,
  type IxianBetrayalFixtureOptions as Options,
} from './fixture-nexus-ixian-betrayal';
type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends IxianBetrayalFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  writes: { expected: number; changes: number }[];
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(game: Game): void;
  protectedCredentials: { seats: SqlRow[]; entries: SqlRow[]; keys: SqlRow[]; receipts: SqlRow[] };
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: SqlRow | undefined;
  stock: string[];
  initial: Game;
}
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function credentials(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    receipts: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}
function totalChanges(sqlite: DatabaseSync) {
  const value = sqlite.prepare('SELECT total_changes() AS changes').get()?.changes;
  assert.equal(typeof value, 'number');
  return value;
}
function physical(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'one physical custodian per native Treachery card');
  return ids;
}
async function fixture(t: test.TestContext, options: Options & { bgCounter?: true } = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Native Ixian recovery', 'ixians', options.advanced ?? true, ['ix']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of options.receiverCount === 2 ? ['atreides', 'emperor', 'guild'] as const
    : options.bgCounter ? ['atreides', 'beneGesserit'] as const : ['atreides', 'emperor'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    assert.ok(joined.token);
    tokens.push(joined.token);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const admitted = await store.rooms.readRoom(code);
  const native = createIxianNexusBetrayalFixture({ ...options, initial: admitted });
  const parent = native.beforeNativeAttempt;
  assert.equal(parent.code, admitted.code);
  assert.equal(parent.host, admitted.host);
  assert.equal(parent.advanced, admitted.advanced);
  assert.deepEqual(parent.expansions, admitted.expansions);
  assert.deepEqual(parent.playerPositions, admitted.playerPositions);
  assert.deepEqual(parent.players.map(p => [p.id, p.name, p.faction]), admitted.players.map(p => [p.id, p.name, p.faction]));
  const save = (game: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code).changes, 1);
  };
  save(parent);
  const unrelated = await store.rooms.createRoom('Unrelated preserved lobby', 'guild', false, []);
  const protectedCredentials = credentials(store.sqlite);
  const unrelatedRow = store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(unrelated.view.code);
  const f: Fixture = { ...store, ...native, code, tokens, auths, save,
    protectedCredentials, unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token,
    unrelatedRow, stock: physical(parent), initial: parent };
  f.initial = await openGate(f, parent);
  assert.equal(viewGame(f.initial, native.holder).nexusIxianBetrayalReaction?.event, native.event);
  store.writes.length = 0;
  return f;
}
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.protectedCredentials);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.unrelatedCode), f.unrelatedRow);
}
function inventory(f: Fixture, game: Game) {
  assert.deepEqual(physical(game), f.stock);
  assert.equal(f.stock.length, 47);
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  assert.deepEqual([...game.nexusCards.cards.deck, ...game.nexusCards.cards.discard,
    ...Object.values(game.nexusCards.cards.hands).filter(face => face !== null)].sort(), [...NEXUS_FACTIONS].sort());
  protectedRows(f);
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
  return f.restart().readRoom(f.code);
}
function unchangedHistory(f: Fixture, game: Game) {
  assert.deepEqual(game.nexusIxianBetrayalHistory, f.beforeNativeAttempt.nexusIxianBetrayalHistory);
  assert.deepEqual(game.nexusIxianBetrayalCursor, f.beforeNativeAttempt.nexusIxianBetrayalCursor);
}
function closedHistory(f: Fixture, game: Game, used: boolean, gate = f.initial) {
  const prior = f.beforeNativeAttempt.nexusIxianBetrayalHistory!;
  const cursor = f.beforeNativeAttempt.nexusIxianBetrayalCursor!;
  const history = game.nexusIxianBetrayalHistory!;
  assert.equal(history.length, prior.length + 1);
  assert.deepEqual(history.slice(0, prior.length), prior);
  const receipt = history[prior.length];
  assert.deepEqual(receipt.source, gate.pendingNexusIxianBetrayal!.source);
  assert.equal(receipt.source.event, f.event);
  assert.equal(receipt.source.sequence, cursor.sequence);
  assert.equal(receipt.outcome, used ? 'use' : 'pass');
  assert.equal(receipt.holder, used ? f.holder : null);
  assert.equal(receipt.previous, cursor.signature);
  assert.equal(game.nexusIxianBetrayalCursor!.sequence, cursor.sequence + 1);
  assert.notEqual(game.nexusIxianBetrayalCursor!.signature, cursor.signature);
}
async function openGate(f: Fixture, parent: Game) {
  let game = await act(f, parent, f.actor, f.declarationAction);
  assert.ok(game.response, 'the original native Karama counter window opens first');
  assert.equal(viewGame(game, f.holder).nexusIxianBetrayalReaction, null);
  for (let step = 0; game.response && step < 20; step++) {
    const responder = game.players.find(p => !game.response!.passed.includes(p.id));
    assert.ok(responder);
    game = await act(f, game, responder.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  unchangedHistory(f, game);
  assert.ok(viewGame(game, f.holder).nexusIxianBetrayalReaction);
  return game;
}
async function rejected(f: Fixture, game: Game, auth: SeatAuth, action: Action, version = game.version) {
  const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
  const changes = totalChanges(f.sqlite);
  await assert.rejects(f.restart().act(f.code, auth, version, action, clock));
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
  assert.equal(totalChanges(f.sqlite), changes, 'rejected action writes no durable resource table');
  protectedRows(f);
}
async function restored(f: Fixture, game: Game) {
  const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
  const changes = totalChanges(f.sqlite);
  assert.deepEqual(plain(await f.restart().readRoom(f.code)), plain(game));
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(plain(view), plain(viewGame(game, auth.playerId)));
    assert.equal(view.nexusIxianBetrayalPreview, true);
    for (const key of ['pendingNexusIxianBetrayal', 'nexusIxianBetrayalHistory', 'nexusIxianBetrayalCursor'])
      assert.equal(Object.hasOwn(view, key), false);
    for (const rival of view.players.filter(p => p.id !== auth.playerId))
      for (const key of ['hand', 'traitors', 'spice']) assert.equal(Object.hasOwn(rival, key), false);
    const reaction = view.nexusIxianBetrayalReaction;
    if (reaction) {
      assert.deepEqual(Object.keys(reaction).sort(), ['event', 'kind', 'provider', 'canPass', 'hasPassed', 'canUse', 'blocked'].sort());
      assert.equal(reaction.event, f.event);
      assert.equal(reaction.kind, f.kind);
      assert.equal(reaction.provider, f.provider);
      if (!f.required.includes(auth.playerId)) {
        assert.equal(reaction.canPass, false);
        assert.equal(reaction.canUse, false);
        assert.equal(reaction.blocked, null);
      }
    }
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
  assert.equal(totalChanges(f.sqlite), changes, 'refresh cannot autoallow or consume the original attempt');
  inventory(f, game);
}
async function closeGate(f: Fixture, game: Game, used: boolean) {
  if (used) return act(f, game, f.holder, { type: 'nexusIxianBetrayalUse', event: f.event });
  let next = game;
  for (const id of f.required)
    next = await act(f, next, id, { type: 'nexusIxianBetrayalPass', event: f.event });
  return next;
}
function settled(f: Fixture, game: Game, used: boolean) {
  assert.equal(game.pendingNexusIxianBetrayal ?? null, null);
  assert.equal(viewGame(game, f.holder).nexusIxianBetrayalReaction, null);
  assert.equal(game.nexusCards!.cards!.hands[f.holder], used ? null : f.initial.nexusCards!.cards!.hands[f.holder]);
  assert.deepEqual(game.nexusCards!.cards!.discard,
    [...f.initial.nexusCards!.cards!.discard, ...(used ? ['ixians'] : [])]);
  assert.deepEqual(game.players.map(p => [p.id, p.spice, p.reserves, p.forces]),
    f.initial.players.map(p => [p.id, p.spice, p.reserves, p.forces]), 'Nexus costs no spice or forces');
  assert.deepEqual(game.discard, f.initial.discard, 'no Treachery card pays this reaction');
  const native = game.players.find(p => p.id === f.provider)!;
  const previous = f.initial.players.find(p => p.id === f.provider)!;
  if (f.kind === 'bidding') {
    assert.equal(game.deck.length, f.initial.deck.length - f.nativeCount - Number(!used));
    assert.equal(game.ixAuction?.cards.length ?? 0, used ? 0 : f.nativeCount + 1);
    assert.equal(game.auction?.cards.length ?? 0, used ? f.nativeCount : 0);
    assert.deepEqual(native.hand, previous.hand);
  } else {
    assert.ok(f.selected);
    assert.equal(game.pendingIxTechnology ?? null, null);
    assert.equal(game.ixTechnologyTurn, game.turn, 'the accepted once-per-turn attempt remains spent');
    assert.equal(game.auction!.index, f.initial.auction!.index);
    assert.equal(game.auction!.bid, f.initial.auction!.bid);
    assert.equal(game.auction!.bidder, f.initial.auction!.bidder);
    const originalLot = f.initial.auction!.cards[f.initial.auction!.index];
    assert.equal(native.hand.some(card => card.id === f.selected!.id), used);
    assert.equal(native.hand.some(card => card.id === originalLot.id), !used);
    assert.equal(game.auction!.cards[game.auction!.index].id, used ? originalLot.id : f.selected.id);
    assert.equal(game.deck.length, f.initial.deck.length);
  }
  closedHistory(f, game, used);
  inventory(f, game);
}

for (const [kind, advanced] of [['bidding', false], ['bidding', true], ['technology', true]] as const) {
  for (const used of [false, true]) {
    void test(`SQLite actual ${advanced ? 'Advanced' : 'Basic'} native ${kind} ${used ? 'prevent' : 'allow'} restores and resumes once`, async t => {
      const f = await fixture(t, { kind, advanced });
      await restored(f, f.initial);
      const done = await closeGate(f, f.initial, used);
      assert.equal(done.version, f.initial.version + 1);
      settled(f, done, used);
      await restored(f, done);
      for (const type of ['nexusIxianBetrayalPass', 'nexusIxianBetrayalUse'] as const)
        await rejected(f, done, await authenticate(f, f.holder), { type, event: f.event });
    });
  }
}

for (const kind of ['bidding', 'technology'] as const) {
  void test(`SQLite ${kind} stale, foreign, wrong role, unknown fields and revoked credentials cost nothing`, async t => {
    const f = await fixture(t, { kind });
    const holder = await authenticate(f, f.holder);
    const provider = await authenticate(f, f.provider);
    const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
    const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
    const changes = totalChanges(f.sqlite);
    await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
    await assert.rejects(f.restart().readSeatView(f.code, foreign));
    await assert.rejects(f.restart().readSeatView(f.code, { playerId: f.holder, tokenHash: foreign.tokenHash }));
    assert.equal(totalChanges(f.sqlite), changes);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
    const use: Action = { type: 'nexusIxianBetrayalUse', event: f.event };
    await rejected(f, f.initial, holder, use, f.initial.version - 1);
    await rejected(f, f.initial, foreign, use);
    await rejected(f, f.initial, provider, use);
    await rejected(f, f.initial, provider, { type: 'nexusIxianBetrayalPass', event: f.event });
    for (const action of [{ ...use, event: `${f.event}:expired` }, { ...use, kind },
      { ...use, provider: f.provider }, { ...use, card: f.initial.deck[0].id }, { ...use, price: 0 }])
      await rejected(f, f.initial, holder, action as Action);
    for (const action of [
      { type: 'passBid' }, { type: 'passResponse' }, { type: 'ready' },
      { type: 'decision', card: f.initial.players.find(p => p.id === f.provider)!.hand[0].id },
    ])
      await rejected(f, f.initial, provider, action as Action);
    await restored(f, f.initial);
    f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.holder);
    f.protectedCredentials = credentials(f.sqlite);
    const changesAfterRevocation = totalChanges(f.sqlite);
    await assert.rejects(f.restart().authenticate(f.code, f.tokens[f.auths.findIndex(auth => auth.playerId === f.holder)]));
    assert.equal(totalChanges(f.sqlite), changesAfterRevocation);
    await assert.rejects(f.restart().readSeatView(f.code, holder));
    await rejected(f, f.initial, holder, use);
    await rejected(f, f.initial, holder, { type: 'nexusIxianBetrayalPass', event: f.event });
  });

  void test(`SQLite competing ${kind} Pass/Use commits one native continuation`, async t => {
    const f = await fixture(t, { kind });
    assert.equal(f.required.length, 1);
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    let results: PromiseSettledResult<unknown>[];
    try {
      const auth = await authenticate(f, f.holder);
      results = await Promise.allSettled(['nexusIxianBetrayalPass', 'nexusIxianBetrayalUse'].map(type =>
        f.restart().act(f.code, auth, f.initial.version, { type, event: f.event } as Action, clock).finally(release)));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.initial.version + 1);
    settled(f, done, results[1].status === 'fulfilled');
    await restored(f, done);
  });

  void test(`SQLite ${kind} revocation at final CAS preserves the pending native source`, async t => {
    const f = await fixture(t, { kind });
    const auth = await authenticate(f, f.holder);
    const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
    const changes = totalChanges(f.sqlite);
    let revoked = false;
    f.hooks.beforeWrite = async () => {
      assert.equal(revoked, false);
      revoked = true;
      f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.holder);
      f.protectedCredentials = credentials(f.sqlite);
    };
    try {
      await assert.rejects(f.restart().act(f.code, auth, f.initial.version,
        { type: 'nexusIxianBetrayalUse', event: f.event }, clock));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(revoked, true);
    assert.equal(totalChanges(f.sqlite), Number(changes) + 1, 'only explicit revocation is durable');
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
    inventory(f, await f.restart().readRoom(f.code));
    await assert.rejects(f.restart().readSeatView(f.code, auth));
  });
}

for (const kind of ['bidding', 'technology'] as const) {
  void test(`SQLite original ${kind} printed Karama preempts Nexus without spending its face or opening a gate`, async t => {
    const f = await fixture(t, { kind });
    f.save(f.beforeNativeAttempt);
    const declared = await act(f, f.beforeNativeAttempt, f.actor, f.declarationAction);
    const counter = declared.players.find(p => p.id !== f.provider && p.hand.some(card => card.effect === 'karama'));
    assert.ok(counter);
    const karama = counter.hand.find(card => card.effect === 'karama')!;
    let game = await act(f, declared, counter.id, { type: 'card', mode: 'cancel', card: karama.id });
    for (let step = 0; game.response && step < 20; step++) {
      const responder = game.players.find(p => !game.response!.passed.includes(p.id));
      assert.ok(responder);
      game = await act(f, game, responder.id, { type: 'passResponse' });
    }
    assert.equal(viewGame(game, f.holder).nexusIxianBetrayalReaction, null);
    unchangedHistory(f, game);
    assert.deepEqual(game.nexusCards!.cards, f.beforeNativeAttempt.nexusCards!.cards);
    assert.equal(game.discard.filter(card => card.id === karama.id).length, 1);
    if (kind === 'bidding') {
      assert.equal(game.deck.length, declared.deck.length - f.nativeCount);
      assert.equal(game.ixAuction ?? null, null);
      assert.equal(game.auction!.cards.length, f.nativeCount);
    } else {
      assert.equal(game.ixTechnologyTurn, game.turn);
      assert.equal(game.pendingIxTechnology ?? null, null);
      assert.deepEqual(game.players.find(p => p.id === f.provider)!.hand,
        declared.players.find(p => p.id === f.provider)!.hand);
      assert.equal(game.auction!.cards[game.auction!.index].id, declared.auction!.cards[declared.auction!.index].id);
    }
    await restored(f, game);
  });

  void test(`SQLite ${kind} relevant and irrelevant owned faces expose identical rival acknowledgments`, async t => {
    const f = await fixture(t, { kind });
    // Vary only owned physical custody before the original native declaration.
    // Do not re-sign an already authorized source or manufacture another hand.
    const parent = structuredClone(f.beforeNativeAttempt);
    const cards = parent.nexusCards!.cards!;
    const index = cards.deck.indexOf('richese');
    assert.ok(index >= 0);
    assert.equal(cards.hands[f.holder], 'ixians');
    cards.hands[f.holder] = 'richese';
    cards.deck[index] = 'ixians';
    f.save(parent);
    const irrelevant = await openGate(f, parent);
    assert.equal(viewGame(irrelevant, f.holder).nexusIxianBetrayalReaction!.event, f.event);
    await restored(f, irrelevant);
    for (const auth of f.auths) {
      const original = viewGame(f.initial, auth.playerId);
      const changed = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
      if (auth.playerId !== f.holder) assert.deepEqual(plain(changed), plain(original));
      else {
        assert.equal(changed.nexusIxianBetrayalReaction!.canPass, true);
        assert.equal(changed.nexusIxianBetrayalReaction!.canUse, false);
      }
    }
    await rejected(f, irrelevant, await authenticate(f, f.holder), { type: 'nexusIxianBetrayalUse', event: f.event });
    const done = await closeGate(f, irrelevant, false);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.deepEqual(done.nexusCards!.cards!.discard, irrelevant.nexusCards!.cards!.discard);
    closedHistory(f, done, false, irrelevant);
    await restored(f, done);
  });

  void test(`SQLite ${kind} pending source, native custody, cursor and profile corruption never heals or writes`, async t => {
    const f = await fixture(t, { kind });
    const changes: { name: string; change: (game: Game) => void }[] = [
      { name: 'missing source', change: game => { delete game.pendingNexusIxianBetrayal; } },
      { name: 'missing cursor', change: game => { delete game.nexusIxianBetrayalCursor; } },
      { name: 'missing history', change: game => { delete game.nexusIxianBetrayalHistory; } },
      { name: 'cursor sequence', change: game => { game.nexusIxianBetrayalCursor!.sequence++; } },
      { name: 'parent link', change: game => { game.pendingNexusIxianBetrayal!.source.parent += ':forged'; } },
      { name: 'native source', change: game => { game.pendingNexusIxianBetrayal!.source.nativeContext += ':forged'; } },
      { name: 'native provider', change: game => { game.pendingNexusIxianBetrayal!.source.provider = f.holder; } },
      { name: 'native kind', change: game => { game.pendingNexusIxianBetrayal!.source.kind = kind === 'bidding' ? 'technology' : 'bidding'; } },
      { name: 'missing native passes', change: game => { game.pendingNexusIxianBetrayal!.source.nativePassed = []; } },
      { name: 'native continuation', change: game => { game.pendingNexusIxianBetrayal!.continuation.owner = f.holder; } },
      { name: 'required membership', change: game => { game.pendingNexusIxianBetrayal!.required = [f.provider]; } },
      { name: 'invented pass', change: game => { game.pendingNexusIxianBetrayal!.passed = [f.provider]; } },
      { name: 'lost profile', change: game => { delete game.nexusIxianBetrayalPreview; } },
      { name: 'native roster', change: game => { game.players.find(p => p.id === f.provider)!.faction = 'guild'; } },
      { name: 'foreign expansion', change: game => { game.expansions.push('choam'); } },
      { name: 'wrong phase', change: game => { game.phase++; } },
      { name: 'wrong turn', change: game => { game.turn++; } },
      { name: 'duplicate Nx stock', change: game => { game.nexusCards!.cards!.deck.push('ixians'); } },
      { name: 'missing Treachery stock', change: game => { game.deck.pop(); } },
      { name: 'canonical Treachery face', change: game => { game.deck[0].name += ' forged'; } },
      ...(kind === 'technology' ? [
        { name: 'accepted native attempt', change: (game: Game) => { delete game.ixTechnologyTurn; } },
        { name: 'selected native card', change: (game: Game) => { game.pendingIxTechnology!.card = game.deck[0].id; } },
      ] : [{ name: 'native draw count', change: (game: Game) => { game.ixAuction!.count++; } }]),
    ];
    for (const { name, change } of changes) {
      const corrupt = structuredClone(f.initial);
      change(corrupt);
      f.save(corrupt);
      const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
      const writes = totalChanges(f.sqlite);
      const original = plain(corrupt);
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
      for (const type of ['nexusIxianBetrayalPass', 'nexusIxianBetrayalUse'] as const)
        await rejected(f, corrupt, await authenticate(f, f.holder), { type, event: f.event });
      await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
      assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before, name);
      assert.equal(totalChanges(f.sqlite), writes, name);
      assert.deepEqual(corrupt, original);
      protectedRows(f);
    }
  });

  void test(`SQLite ${kind} two genuine unallied receivers restore partial pass and reject replay`, async t => {
    const f = await fixture(t, { kind, receiverCount: 2 });
    assert.equal(f.initial.players.length, 4);
    assert.equal(f.required.length, 2);
    const irrelevant = f.required.find(id => id !== f.holder)!;
    const first = await act(f, f.initial, irrelevant, { type: 'nexusIxianBetrayalPass', event: f.event });
    assert.ok(first.pendingNexusIxianBetrayal);
    assert.equal(viewGame(first, irrelevant).nexusIxianBetrayalReaction!.hasPassed, true);
    unchangedHistory(f, first);
    assert.deepEqual(first.nexusCards!.cards, f.initial.nexusCards!.cards);
    await restored(f, first);
    await rejected(f, first, await authenticate(f, irrelevant), { type: 'nexusIxianBetrayalPass', event: f.event });
    const done = await act(f, first, f.holder, { type: 'nexusIxianBetrayalUse', event: f.event });
    settled(f, done, true);
    await restored(f, done);
  });

  for (const used of [false, true]) {
    void test(`SQLite ${kind} ${used ? 'use' : 'pass'} history survives later physical recycling and rejects corrupted links`, async t => {
      const f = await fixture(t, { kind });
      const done = await closeGate(f, f.initial, used);
      settled(f, done, used);
      await restored(f, done);
      const later = structuredClone(done);
      if (used) {
        const cards = later.nexusCards!.cards!;
        const index = cards.discard.indexOf('ixians');
        assert.ok(index >= 0);
        cards.deck.push(...cards.discard.splice(index, 1));
      }
      // Preserve physical custody while representing later native card circulation.
      const card = later.deck.pop()!;
      later.discard.push(card);
      f.save(later);
      await restored(f, later);
      assert.deepEqual(later.nexusIxianBetrayalHistory, done.nexusIxianBetrayalHistory);
      assert.deepEqual(later.nexusIxianBetrayalCursor, done.nexusIxianBetrayalCursor);
      for (const type of ['nexusIxianBetrayalPass', 'nexusIxianBetrayalUse'] as const)
        await rejected(f, later, await authenticate(f, f.holder), { type, event: f.event });
      for (const change of [
        (game: Game) => { game.nexusIxianBetrayalHistory = []; },
        (game: Game) => { delete game.nexusIxianBetrayalCursor; },
        (game: Game) => { game.nexusIxianBetrayalCursor!.signature += ':forged'; },
        ...done.nexusIxianBetrayalHistory!.flatMap((_receipt, index) => [
          (game: Game) => { game.nexusIxianBetrayalHistory![index].signature += ':forged'; },
          (game: Game) => { game.nexusIxianBetrayalHistory![index].source.parent += ':forged'; },
          (game: Game) => { game.nexusIxianBetrayalHistory![index].source.nativeContext += ':forged'; },
        ]),
      ]) {
        const corrupt = structuredClone(later);
        change(corrupt);
        f.save(corrupt);
        const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
        const writes = totalChanges(f.sqlite);
        for (const auth of f.auths)
          await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
        await rejected(f, corrupt, await authenticate(f, f.holder), { type: 'nexusIxianBetrayalUse', event: f.event });
        await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
        assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
        assert.equal(totalChanges(f.sqlite), writes);
      }
    });
  }
}

for (const kind of ['bidding', 'technology'] as const) {
  void test(`SQLite Advanced BG conversion counters the actual ${kind} attempt before Nexus`, async t => {
    const f = await fixture(t, { kind, advanced: true, bgCounter: true });
    f.save(f.beforeNativeAttempt);
    const declared = await act(f, f.beforeNativeAttempt, f.actor, f.declarationAction);
    const counter = declared.players.find(p => p.faction === 'beneGesserit')!;
    const card = counter.hand.find(value => value.effect !== 'karama');
    assert.ok(card, 'genuine initial BG Treachery card fuels its native conversion');
    let game = await act(f, declared, counter.id, { type: 'card', mode: 'cancel', card: card.id });
    for (let step = 0; game.response && step < 20; step++) {
      const responder = game.players.find(p => !game.response!.passed.includes(p.id));
      assert.ok(responder);
      game = await act(f, game, responder.id, { type: 'passResponse' });
    }
    assert.deepEqual(game.nexusCards!.cards, f.beforeNativeAttempt.nexusCards!.cards);
    unchangedHistory(f, game);
    assert.equal(viewGame(game, f.holder).nexusIxianBetrayalReaction, null);
    assert.equal(game.discard.filter(value => value.id === card.id).length, 1);
    if (kind === 'bidding') {
      assert.equal(game.deck.length, declared.deck.length - f.nativeCount);
      assert.equal(game.auction!.cards.length, f.nativeCount);
      assert.equal(game.ixAuction ?? null, null);
    } else {
      assert.equal(game.ixTechnologyTurn, game.turn);
      assert.equal(game.pendingIxTechnology ?? null, null);
      assert.deepEqual(game.players.find(p => p.id === f.provider)!.hand,
        declared.players.find(p => p.id === f.provider)!.hand);
      assert.deepEqual(game.auction!.cards, declared.auction!.cards);
    }
    await restored(f, game);
  });
}

for (const kind of ['bidding', 'technology'] as const) {
  void test(`SQLite ${kind} racing two receiver passes retains the first acknowledgment and resumes only after a fresh second CAS`, async t => {
    const f = await fixture(t, { kind, receiverCount: 2 });
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const auths = await Promise.all(f.required.map(id => authenticate(f, id)));
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled(auths.map(auth =>
        f.restart().act(f.code, auth, f.initial.version,
          { type: 'nexusIxianBetrayalPass', event: f.event }, clock).finally(release)));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const first = await f.restart().readRoom(f.code);
    const winner = f.required[results.findIndex(result => result.status === 'fulfilled')];
    const loser = f.required[results.findIndex(result => result.status === 'rejected')];
    assert.deepEqual(first.pendingNexusIxianBetrayal!.passed, [winner]);
    assert.equal(first.version, f.initial.version + 1);
    unchangedHistory(f, first);
    assert.deepEqual(first.nexusCards!.cards, f.initial.nexusCards!.cards);
    await restored(f, first);
    await rejected(f, first, await authenticate(f, winner), { type: 'nexusIxianBetrayalPass', event: f.event });
    const done = await act(f, first, loser, { type: 'nexusIxianBetrayalPass', event: f.event });
    assert.equal(done.version, f.initial.version + 2);
    settled(f, done, false);
    await restored(f, done);
  });
}
