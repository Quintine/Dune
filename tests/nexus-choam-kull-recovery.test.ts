import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { viewGame, type Action, type Game, type GameView } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { createNexusChoamKullFixture, createNexusKullNativeParent,
  createNexusKullNestedParent, createNexusKullAuctionParent } from './fixture-nexus-choam-kull';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
/** Malformed or forged client payloads used only to prove rejection; never valid actions. */
const forged = (payload: object): Action => payload as Action;
const player = (g: Game, id: string) => {
  const found = g.players.find(p => p.id === id);
  assert.ok(found, `missing seated identity ${id}`);
  return found;
};
/** Offer-stage contract of the shared Nexus Kull fixture, named for authenticated SQL setup. */
type NexusChoamKullOptions = Parameters<typeof createNexusChoamKullFixture>[0];
type NexusChoamKullGame = ReturnType<typeof createNexusChoamKullFixture>;
type CredentialRows = {
  seats: Record<string, SQLOutputValue>[];
  entries: Record<string, SQLOutputValue>[];
  keys: Record<string, SQLOutputValue>[];
  recoveries: Record<string, SQLOutputValue>[];
};

function physical(g: Game) {
  const ids = [
    ...g.deck, ...g.discard, ...(g.richeseCache ?? []),
    ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'physical Treachery custody stays unique');
  return ids;
}
function nexusInventory(g: Game) {
  const cards = g.nexusCards?.cards;
  assert.ok(cards, 'the Nexus Kull table owns its physical Nexus inventory');
  validateNexusCards(cards, g.players);
  assert.deepEqual([
    ...cards.deck, ...cards.discard,
    ...Object.values(cards.hands).filter(card => card !== null),
  ].sort(), [...NEXUS_FACTIONS].sort());
}
function credentials(sqlite: DatabaseSync): CredentialRows {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    recoveries: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}

async function persisted(t: test.TestContext, options: NexusChoamKullOptions = {},
  create?: (seatIds: string[]) => NexusChoamKullGame): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Nexus Kull SQL', 'choam', options.advanced ?? true, ['choam', 'ix']);
  const code = made.view.code;
  const tokens = [made.token];
  tokens.push((await store.rooms.joinRoom(code, 'Actor', options.actorFaction ?? (options.bg ? 'beneGesserit' : 'emperor'))).token!);
  tokens.push((await store.rooms.joinRoom(code, 'Other', 'harkonnen')).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId);
  const madeGame: NexusChoamKullGame = create ? create(ids) : createNexusChoamKullFixture({ ...options, seatIds: ids });
  const initial = madeGame.game;
  initial.code = code;
  initial.host = auths[0].playerId;
  initial.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) => assert.equal(
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code).changes, 1);
  save(initial);
  const unrelated = await store.rooms.createRoom('Unrelated preserved room', 'atreides', false, []);
  const unrelatedRow = store.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(unrelated.view.code);
  const credentialRows = credentials(store.sqlite);
  const stock = physical(initial);
  nexusInventory(initial);
  store.writes.length = 0;
  return {
    ...store, ...madeGame, initial, code, tokens, auths, save, stock, credentialRows,
    unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token, unrelatedRow,
  };
}
interface Fixture extends NexusChoamKullGame {
  rooms: typeof Rooms;
  restart: () => typeof Rooms;
  sqlite: DatabaseSync;
  hooks: { beforeWrite?: () => Promise<void>; beforeStatement?: (sql: string) => Promise<void> };
  writes: { expected: number; changes: number }[];
  initial: Game;
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(g: Game): void;
  stock: string[];
  credentialRows: CredentialRows;
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: Record<string, SQLOutputValue> | undefined;
}

const row = (f: Fixture) => f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.code);
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.credentialRows, 'consumer credential rows are never rewritten');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.unrelatedCode),
    f.unrelatedRow, 'an unrelated room is never touched');
}
function inventory(f: Fixture, g: Game) {
  assert.deepEqual(physical(g), f.stock, 'the full physical Treachery inventory is conserved');
  nexusInventory(g);
  protectedRows(f);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0, `no credential for ${id}`);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  // Authorization is the credential's values, not its realm, prototype or brand.
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, g: Game, id: string, action: Action) {
  const rooms = f.restart();
  await rooms.act(f.code, await authenticate(f, id), g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f);
  const writes = f.writes.length;
  const views: GameView[] = [];
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    assert.equal(auth.playerId, f.auths[index].playerId);
    assert.equal(auth.tokenHash, f.auths[index].tokenHash);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(plain(view), plain(viewGame(g, auth.playerId)));
    assert.equal(view.nexusKullPreview, true);
    for (const key of ['pendingKull', 'pendingChoamWorthless', 'nexusChoamHistory', 'nexusChoamLast'])
      assert.equal(Object.hasOwn(view, key), false, 'intent, receipt and cursor stay private');
    for (const rival of view.players.filter(p => p.id !== auth.playerId)) {
      assert.equal(Object.hasOwn(rival, 'hand'), false);
      assert.equal(Object.hasOwn(rival, 'spice'), false);
    }
    views.push(view);
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before, 'refresh or recovery cannot acknowledge a human opportunity');
  assert.equal(f.writes.length, writes);
  inventory(f, g);
  return views;
}
async function stationary(f: Fixture, g: Game) {
  const before = row(f);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  assert.equal(f.writes.length, writes);
  await restored(f, g);
}
async function rejected(f: Fixture, g: Game, id: string, action: Action, version = g.version) {
  const before = row(f);
  const attempted: string[] = [];
  f.hooks.beforeStatement = async sql => { attempted.push(sql); };
  try {
    await assert.rejects(f.restart().act(f.code, await authenticate(f, id), version, action, clock));
  } finally { delete f.hooks.beforeStatement; }
  assert.deepEqual(attempted, [], 'a rejected Kull choice must not attempt a room write');
  assert.deepEqual(row(f), before);
  protectedRows(f);
}
async function settle(f: Fixture, g: Game) {
  for (let step = 0; g.response && step < 16; step++) {
    const response = g.response;
    const responder = g.players.find(p => !response.passed.includes(p.id));
    assert.ok(responder, 'an open response retains an unpassed real seat');
    g = await act(f, g, responder.id, { type: 'passResponse' });
    await restored(f, g);
  }
  assert.equal(g.response, null);
  return g;
}
async function race(f: Fixture, g: Game, id: string, first: Action, second: Action) {
  f.writes.length = 0;
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  const auth = await authenticate(f, id);
  let results: PromiseSettledResult<unknown>[];
  try {
    // Both competitors park at the version fence, then commit independently.
    results = await Promise.allSettled([
      f.rooms.act(f.code, auth, g.version, first, clock).finally(release),
      f.restart().act(f.code, auth, g.version, second, clock).finally(release),
    ]);
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(arrivals, 2, 'both competitors reached the version fence');
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, g.version + 1, 'exactly one competitor commits');
  await restored(f, done);
  return done;
}

for (const advanced of [false, true])
  for (const fuel of ['karama', 'weapon', 'worthless'] as const)
    void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} Nexus Kull spends its exact held ${fuel} fuel and the physical CHOAM Nexus once, then bans the interrupted Karama`, async t => {
      const f = await persisted(t, { advanced, fuel });
      const { choam, actor, event, original, fuel: fuelCard, counter } = f;
      assert.equal(f.initial.pendingKull?.stage, 'offer');
      assert.equal(f.initial.pendingKull?.event, event);
      assert.equal(player(f.initial, actor).hand.some(card => card.id === original), true);
      assert.equal(f.initial.nexusCards!.cards!.hands[choam], 'choam');
      assert.equal(player(f.initial, choam).hand.some(card => card.id === fuelCard), true);
      // Canonical base plus Ix holds two Karama: one original and one counter at most.
      const heldCounter = counter !== null;
      if (heldCounter) assert.notEqual(counter, original);

      const views = await restored(f, f.initial);
      const reaction = views[0].kullReaction;
      assert.ok(reaction);
      assert.deepEqual({ event: reaction.event, player: reaction.player, target: reaction.target, intent: reaction.intent },
        { event, player: choam, target: actor, intent: 'shipment' });
      assert.deepEqual(reaction.plays.map(play => ({ source: play.source, effect: play.effect, card: play.card.id, event: play.event, blocked: play.blocked })),
        [{ source: 'nexus', effect: 'kull', card: fuelCard, event, blocked: null }]);
      assert.equal(reaction.canDecline, true);
      for (const view of views.slice(1))
        assert.deepEqual(view.kullReaction,
          { event, player: choam, target: actor, intent: 'shipment', plays: [], canDecline: false, blocked: null });
      await stationary(f, f.initial);

      const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuelCard });
      assert.equal(declared.version, f.initial.version + 1);
      const nexusEvent = JSON.stringify(['nexusChoam', declared.turn, declared.phase, choam, fuelCard, 'kull']);
      // Without a distinguishable held Karama nobody can prevent it, so the
      // real window resolves inside the accepted declaration instead.
      assert.equal(declared.response === null, !heldCounter);
      if (heldCounter) {
        assert.equal(declared.pendingKull?.stage, 'counter');
        assert.deepEqual(declared.pendingKull?.selection, { source: 'nexus', card: fuelCard, nexusEvent });
        assert.deepEqual(declared.pendingChoamWorthless, {
          owner: choam, card: fuelCard, effect: 'kull', target: actor, revival: false, nexusEvent,
        });
        assert.equal(declared.response?.kind, 'choamWorthless');
        assert.equal(declared.response?.intent, 'Kull Wahad');
        assert.equal(declared.response?.owner, choam);
        assert.equal(declared.response?.recipient, actor);
        assert.equal(player(declared, choam).hand.some(card => card.id === fuelCard), true,
          'the declared fuel is only retained while the response is pending');
        assert.equal(player(declared, actor).hand.some(card => card.id === original), true,
          'the interrupted card stays reserved rather than spent');
        assert.equal(declared.discard.some(card => card.id === original), false);
        assert.equal(declared.nexusChoamHistory?.length, 1);
        assert.equal(declared.nexusChoamHistory![0].stage, 'pending');
        assert.deepEqual(declared.nexusChoamLast, { event: nexusEvent, stage: 'pending' });
        await restored(f, declared);
        await stationary(f, declared);
      }
      assert.equal(declared.nexusCards!.cards!.hands[choam], null);
      assert.deepEqual(declared.nexusCards!.cards!.discard.filter(face => face === 'choam'), ['choam'],
        'the declared Nexus is spent on acceptance');
      assert.equal(declared.nexusChoamHistory![0].receipt.card, fuelCard);
      assert.equal(declared.nexusChoamHistory![0].receipt.effect, 'kull');
      assert.equal(declared.nexusChoamHistory![0].receipt.owner, choam);

      const done = heldCounter ? await settle(f, declared) : declared;
      assert.equal(done.pendingKull ?? null, null);
      assert.equal(done.pendingChoamWorthless ?? null, null);
      assert.equal(done.response, null);
      assert.equal(done.discard.filter(card => card.id === fuelCard).length, 1, 'the chosen fuel is discarded exactly once');
      assert.equal(player(done, choam).hand.some(card => card.id === fuelCard), false);
      assert.equal(done.discard.some(card => card.id === original), false, 'the interrupted card is not discarded');
      assert.equal(player(done, actor).hand.filter(card => card.id === original).length, 1);
      assert.deepEqual(done.nexusCards!.cards!.discard.filter(face => face === 'choam'), ['choam'],
        'the Nexus is not returned or double spent');
      assert.equal(done.nexusChoamHistory?.length, 1);
      assert.equal(done.nexusChoamHistory![0].stage, 'complete');
      assert.deepEqual(done.nexusChoamLast, { event: nexusEvent, stage: 'complete' });
      assert.deepEqual((done.kullRestrictions ?? []).filter(rule => rule.player === actor),
        [{ player: actor, turn: done.turn, phase: done.phase }]);
      assert.ok(viewGame(done, actor).karamaBlocked, 'the stamped phase ban is publicly visible');
      assert.equal(viewGame(done, choam).kullReaction, null);
      await restored(f, done);

      await rejected(f, done, choam, { type: 'kullDecision', event, source: 'nexus', card: fuelCard });
      await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
      await rejected(f, done, actor, { type: 'card', mode: 'shipment', card: original, target: actor });
      await stationary(f, done);
    });

for (const advanced of [false, true])
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} distinct held Karama prevents the declared Nexus Kull, retains the fuel and leaves the spent Nexus spent while resuming the original attempt once`, async t => {
    const f = await persisted(t, { advanced });
    const { choam, actor, other, event, original, fuel, counter } = f;
    assert.ok(counter && other);
    const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
    const views = await restored(f, declared);
    assert.deepEqual(views[2].responseControls?.cancelCards, [counter],
      'only the physically distinct held Karama may prevent the declaration');
    assert.equal(views[2].responseControls?.hasPassed, false);
    assert.equal((views[1].responseControls?.cancelCards ?? []).includes(original), false,
      'the reserved original cannot pay for its own prevention');
    assert.equal(views[0].responseControls?.cancelCards.length, 0);
    assert.equal(views[1].players.find(p => p.id === choam)?.hand, undefined, 'the declared fuel stays private to CHOAM');
    assert.equal(views[1].kullReaction ?? null, null);
    await stationary(f, declared);

    await rejected(f, declared, actor, { type: 'card', mode: 'cancel', card: original });
    await rejected(f, declared, choam, { type: 'card', mode: 'cancel', card: fuel });
    await rejected(f, declared, other, { type: 'card', mode: 'cancel', card: `${counter}-stale` });

    const done = await race(f, declared, other,
      { type: 'card', mode: 'cancel', card: counter },
      { type: 'card', mode: 'cancel', card: counter });
    assert.equal(done.response ?? null, null);
    assert.equal(done.pendingKull ?? null, null);
    assert.equal(done.karamaShipping?.card, original, 'the interrupted shipment resumes exactly once');
    assert.equal(done.karamaShipping?.owner, actor);
    assert.equal(done.discard.filter(card => card.id === original).length, 1);
    assert.equal(done.discard.filter(card => card.id === counter).length, 1);
    assert.equal(player(done, choam).hand.some(card => card.id === fuel), true,
      'a prevented declaration retains its declared fuel');
    assert.deepEqual(done.nexusCards!.cards!.discard.filter(face => face === 'choam'), ['choam'],
      'a canceled declaration leaves the accepted Nexus spend spent');
    assert.equal(done.nexusChoamHistory?.length, 1);
    assert.equal(done.nexusChoamHistory![0].stage, 'canceled');
    assert.equal(done.nexusChoamLast?.stage, 'canceled');
    assert.deepEqual(done.kullRestrictions ?? [], [], 'a prevented declaration bans no Karama phase');
    await restored(f, done);

    await rejected(f, done, other, { type: 'card', mode: 'cancel', card: counter });
    await rejected(f, done, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
    await rejected(f, done, actor, { type: 'card', mode: 'shipment', card: original, target: actor });
    await stationary(f, done);
  });

void test('SQLite declining the offered Nexus Kull spends neither fuel nor Nexus and resumes the exact original attempt once', async t => {
  const f = await persisted(t);
  const { choam, actor, event, original, fuel } = f;
  await restored(f, f.initial);
  const done = await act(f, f.initial, choam, { type: 'kullDecision', event, decline: true });
  assert.equal(done.response ?? null, null);
  assert.equal(done.pendingKull ?? null, null);
  assert.equal(done.nexusChoamHistory ?? null, null);
  assert.equal(done.nexusChoamLast ?? null, null);
  assert.equal(done.nexusCards!.cards!.hands[choam], 'choam', 'a declined offer spends no Nexus');
  assert.equal(done.nexusCards!.cards!.discard.includes('choam'), false);
  assert.equal(player(done, choam).hand.some(card => card.id === fuel), true);
  assert.equal(done.discard.some(card => card.id === fuel), false, 'a declined offer discards no fuel');
  assert.equal(done.karamaShipping?.card, original, 'the interrupted shipment resumes exactly once');
  assert.equal(done.discard.filter(card => card.id === original).length, 1);
  assert.deepEqual(done.kullRestrictions ?? [], []);
  await restored(f, done);

  await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
  await rejected(f, done, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await rejected(f, done, actor, { type: 'card', mode: 'shipment', card: original, target: actor });
  await stationary(f, done);
});

void test('SQLite a successful Nexus Kull intercepts the BG Worthless substitution before conversion and keeps every attempted physical card', async t => {
  const f = await persisted(t, { bg: true });
  const { choam, actor, event, original, fuel } = f;
  assert.equal(f.initial.pendingKull?.form, 'substitution');
  assert.equal(f.initial.pendingKarama ?? null, null);
  assert.equal(player(f.initial, actor).hand.some(card => card.id === original), true);
  const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  assert.equal(declared.pendingKarama ?? null, null, 'the Kull counter window precedes BG conversion');
  assert.equal(player(declared, actor).hand.some(card => card.id === original), true);
  assert.equal(declared.discard.some(card => card.id === original), false);
  await restored(f, declared);

  const done = await settle(f, declared);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.karamaShipping ?? null, null);
  assert.deepEqual(player(done, actor).hand, player(f.initial, actor).hand,
    'the intercepted BG Worthless card is never converted or discarded');
  assert.equal(done.discard.some(card => card.id === original), false);
  assert.equal(done.discard.filter(card => card.id === fuel).length, 1);
  assert.deepEqual(done.nexusCards!.cards!.discard.filter(face => face === 'choam'), ['choam']);
  assert.equal(done.nexusChoamLast?.stage, 'complete');
  await restored(f, done);
  await stationary(f, done);
  await rejected(f, done, actor, { type: 'card', mode: 'shipment', card: original, target: actor });
});

void test('SQLite declining the offered Nexus Kull resumes the real BG conversion and shipment without repeated disposal', async t => {
  const f = await persisted(t, { bg: true });
  const { choam, actor, event, original, fuel } = f;
  const declined = await act(f, f.initial, choam, { type: 'kullDecision', event, decline: true });
  assert.equal(declined.pendingKull ?? null, null);
  assert.equal(declined.nexusCards!.cards!.discard.includes('choam'), false, 'a declined offer spends no Nexus');
  assert.equal(declined.response?.kind, 'worthlessKarama');
  assert.ok(declined.pendingKarama, 'declining resumes the real Worthless conversion');
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
  assert.equal(player(declined, actor).hand.some(card => card.id === original), false);
  await restored(f, declined);

  const done = await settle(f, declined);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.karamaShipping?.card, original);
  assert.equal(done.karamaShipping?.owner, actor);
  assert.equal(done.discard.filter(card => card.id === original).length, 1, 'the conversion disposes the card only once');
  assert.equal(done.nexusCards!.cards!.discard.includes('choam'), false);
  assert.equal(done.nexusChoamHistory ?? null, null);
  await restored(f, done);

  await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
  await rejected(f, done, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await stationary(f, done);
});

void test('SQLite stale, foreign, malformed and replayed Nexus Kull choices reject before writes and preserve real credentials', async t => {
  const f = await persisted(t);
  const { choam, actor, other, event, original, fuel } = f;
  assert.ok(other);
  const before = row(f);
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  assert.deepEqual(row(f), before);
  assert.equal(f.writes.length, 0);
  protectedRows(f);

  await rejected(f, f.initial, actor, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await rejected(f, f.initial, other, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await rejected(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel }, f.initial.version - 1);
  await rejected(f, f.initial, choam, { type: 'kullDecision', event: `${event}-stale`, source: 'nexus', card: fuel });
  await rejected(f, f.initial, choam, { type: 'kullDecision', event, decline: true }, f.initial.version - 1);
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, card: fuel }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, source: 'printed', card: fuel }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, source: 'nexus', card: original }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, source: 'nexus', card: `${fuel}-forged` }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, source: 'nexus', card: fuel, target: other }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, source: 'nexus', card: fuel, effect: 'kulon' }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, decline: true, card: fuel }));
  await rejected(f, f.initial, choam, forged({ type: 'kullDecision', event, decline: true, source: 'nexus' }));
  await rejected(f, f.initial, actor, { type: 'card', mode: 'special', card: original, amount: 2 });

  const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await restored(f, declared);
  await rejected(f, declared, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await rejected(f, declared, choam, { type: 'kullDecision', event, decline: true });
  await rejected(f, declared, other, forged({ type: 'card', mode: 'cancel', card: original }));
});

void test('SQLite competing decline and Nexus declaration of one saved Kull offer commit exactly one original outcome', async t => {
  const f = await persisted(t);
  const { choam, actor, event, original, fuel } = f;
  await restored(f, f.initial);
  const done = await race(f, f.initial, choam,
    { type: 'kullDecision', event, decline: true },
    { type: 'kullDecision', event, source: 'nexus', card: fuel });
  const declared = done.nexusChoamHistory !== undefined;
  if (declared) {
    assert.equal(done.pendingKull?.stage, 'counter');
    assert.deepEqual(done.pendingKull?.selection,
      { source: 'nexus', card: fuel, nexusEvent: done.nexusChoamLast!.event });
    assert.equal(done.response?.kind, 'choamWorthless');
    assert.equal(player(done, choam).hand.some(card => card.id === fuel), true);
    assert.deepEqual(done.nexusCards!.cards!.discard.filter(face => face === 'choam'), ['choam']);
    assert.equal(done.nexusChoamLast?.stage, 'pending');
  } else {
    assert.equal(done.pendingKull ?? null, null);
    assert.equal(done.pendingChoamWorthless ?? null, null);
    assert.equal(done.karamaShipping?.card, original);
    assert.equal(done.nexusCards!.cards!.hands[choam], 'choam');
    assert.equal(done.nexusCards!.cards!.discard.includes('choam'), false);
    assert.equal(done.nexusChoamLast ?? null, null);
  }
  assert.equal(done.discard.some(card => card.id === original), !declared);
  // A declaration reserves the original in hand; a decline resumes and spends it.
  assert.equal(player(done, actor).hand.some(card => card.id === original), declared);
  await restored(f, done);
  await stationary(f, done);
});

void test('SQLite corrupt or orphaned saved Nexus Kull offers reject all-seat disclosure and settlement before writes', async t => {
  const f = await persisted(t);
  const { choam, actor, other, event, original, fuel } = f;
  assert.ok(other);
  const mutations: { name: string; change(this: void, g: Game): void }[] = [
    { name: 'forged opportunity signature', change: g => { g.pendingKull!.signature = 'forged'; } },
    { name: 'detached opportunity event', change: g => { g.pendingKull!.event += ':stale'; } },
    { name: 'unknown original card', change: g => { g.pendingKull!.card = g.deck[0].id; } },
    { name: 'foreign interrupted owner', change: g => { g.pendingKull!.owner = other; } },
    { name: 'foreign reacting faction', change: g => { g.pendingKull!.player = other; } },
    { name: 'changed opportunity turn', change: g => { g.pendingKull!.turn++; } },
    { name: 'wrong printed form', change: g => { g.pendingKull!.form = 'substitution'; } },
    { name: 'lost sequence', change: g => { g.kullSequence = 0; } },
    { name: 'disabled preview', change: g => { g.kullPreview = false; } },
    { name: 'duplicated original custody', change: g => { g.deck.push(structuredClone(player(g, actor).hand[0])); } },
    { name: 'relocated original custody', change: g => {
      const owner = player(g, actor);
      const index = owner.hand.findIndex(card => card.id === original);
      assert.ok(index >= 0);
      g.deck.push(...owner.hand.splice(index, 1));
    } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(f.initial);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const saved = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
    await rejected(f, corrupt, choam, { type: 'kullDecision', event: corrupt.pendingKull?.event ?? event, decline: true });
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
    await rejected(f, corrupt, actor, { type: 'card', mode: 'shipment', card: original, target: actor });
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(row(f), saved, name);
    assert.equal(f.writes.length, 0, name);
    protectedRows(f);
  }
});

void test('SQLite corrupt or orphaned saved Nexus Kull declarations, receipts and cursors reject all-seat disclosure and settlement before writes', async t => {
  const f = await persisted(t);
  const { choam, actor, other, event, fuel, counter } = f;
  assert.ok(counter && other);
  const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await restored(f, declared);
  const mutations: { name: string; change(this: void, g: Game): void }[] = [
    { name: 'orphaned declaration without its frame', change: g => { delete g.pendingKull; } },
    { name: 'undeclared selection', change: g => { delete g.pendingKull!.selection; } },
    { name: 'forged counter signature', change: g => { g.pendingKull!.signature += 'x'; } },
    { name: 'detached receipt event', change: g => { delete g.pendingChoamWorthless!.nexusEvent; } },
    { name: 'changed declared card', change: g => { g.pendingChoamWorthless!.card = g.deck[0].id; } },
    { name: 'foreign declaration owner', change: g => { g.pendingChoamWorthless!.owner = other; } },
    { name: 'lost declaration', change: g => { delete g.pendingChoamWorthless; } },
    { name: 'premature completion', change: g => { g.nexusChoamHistory![0].stage = 'complete'; } },
    { name: 'lost history with a saved cursor', change: g => { delete g.nexusChoamHistory; } },
    { name: 'changed receipt card', change: g => { g.nexusChoamHistory![0].receipt.card = g.deck[0].id; } },
    { name: 'forged receipt signature', change: g => { g.nexusChoamHistory![0].signature = 'forged'; } },
    { name: 'changed Nexus turn', change: g => { g.turn++; } },
    { name: 'relocated declared fuel custody', change: g => {
      const owner = player(g, choam);
      const index = owner.hand.findIndex(card => card.id === fuel);
      assert.ok(index >= 0);
      g.deck.push(...owner.hand.splice(index, 1));
    } },
    { name: 'disabled Nexus preview', change: g => { g.nexusKullPreview = false; } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(declared);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const saved = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, decline: true });
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
    await rejected(f, corrupt, other, { type: 'card', mode: 'cancel', card: counter });
    await rejected(f, corrupt, actor, { type: 'passResponse' });
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(row(f), saved, name);
    assert.equal(f.writes.length, 0, name);
    protectedRows(f);
  }
});

void test('SQLite completed Nexus Kull history stays intrinsic after later physical card movement but not after deleted or corrupted evidence', async t => {
  const f = await persisted(t);
  const { choam, actor, event, original, fuel } = f;
  const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  const done = await settle(f, declared);
  assert.equal(done.nexusChoamLast?.stage, 'complete');
  const nexusEvent = done.nexusChoamLast!.event;

  const later = structuredClone(done);
  const fuelIndex = later.discard.findIndex(card => card.id === fuel);
  assert.ok(fuelIndex >= 0);
  later.deck.push(...later.discard.splice(fuelIndex, 1));
  const cards = later.nexusCards!.cards!;
  const nexusIndex = cards.discard.indexOf('choam');
  assert.ok(nexusIndex >= 0);
  cards.deck.push(...cards.discard.splice(nexusIndex, 1));
  f.save(later);
  f.writes.length = 0;
  const views = await restored(f, later);
  assert.equal(views[0].kullReaction ?? null, null, 'a settled opportunity is never reopened by recycling');
  assert.ok(views[1].karamaBlocked, 'the stamped phase ban survives the later card movement');
  assert.equal(later.nexusChoamHistory!.length, 1, 'history never duplicates an event');
  assert.equal(later.nexusChoamHistory![0].stage, 'complete');
  assert.deepEqual(later.nexusChoamLast, { event: nexusEvent, stage: 'complete' });
  assert.equal(later.deck.filter(card => card.id === fuel).length, 1,
    'later recycling moves the spent fuel but cannot invalidate the intrinsic receipt');
  await rejected(f, later, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  await rejected(f, later, choam, { type: 'kullDecision', event, decline: true });
  await rejected(f, later, actor, { type: 'card', mode: 'shipment', card: original, target: actor });

  for (const change of [
    (g: Game) => { delete g.nexusChoamHistory; },
    (g: Game) => { g.nexusChoamHistory![0].stage = 'pending'; },
    (g: Game) => { g.nexusChoamHistory![0].receipt.card = g.deck[0].id; },
    (g: Game) => { g.nexusChoamLast!.event += ':stale'; },
    (g: Game) => { delete g.nexusChoamLast; },
  ]) {
    const corrupt = structuredClone(later);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const saved = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
    assert.deepEqual(row(f), saved);
    assert.equal(f.writes.length, 0);
    protectedRows(f);
  }
});

void test('SQLite a new Nexus-profile printed counter without a selection is corrupt, not a pre-upgrade save', async t => {
  const f = await persisted(t);
  const { choam, actor, event } = f;
  const beforeDeclaration = structuredClone(f.initial);
  const cost = beforeDeclaration.deck.find(card => card.id === 'ix-kull-wahad')!;
  assert.ok(cost);
  beforeDeclaration.deck.splice(beforeDeclaration.deck.indexOf(cost), 1);
  player(beforeDeclaration, choam).hand.push(cost);
  f.save(beforeDeclaration);
  const declared = await act(f, beforeDeclaration, choam,
    { type: 'kullDecision', event, source: 'printed', card: cost.id });
  const corrupt = structuredClone(declared);
  const signature: Record<string, unknown> = JSON.parse(corrupt.pendingKull!.signature);
  delete signature.selection;
  delete corrupt.pendingKull!.selection;
  corrupt.pendingKull!.signature = JSON.stringify(signature);
  f.save(corrupt);
  f.writes.length = 0;
  const before = row(f);
  for (const auth of f.auths)
    await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
  await rejected(f, corrupt, actor, { type: 'passResponse' });
  await rejected(f, corrupt, choam, { type: 'kullDecision', event, source: 'printed', card: cost.id });
  await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(row(f), before);
  assert.equal(f.writes.length, 0);
  inventory(f, corrupt);
});

void test('SQLite independently invented or altered Treachery descriptors never become Nexus Kull fuel', async t => {
  const f = await persisted(t, { fuel: 'weapon' });
  const { choam, event, fuel } = f;
  const mutations: { name: string; change(this: void, g: Game): string }[] = [
    { name: 'invented unique identifier', change: g => {
      const card = player(g, choam).hand.find(card => card.id === fuel)!;
      card.id = 'counterfeit-unique-treachery';
      return card.id;
    } },
    { name: 'altered canonical name', change: g => {
      player(g, choam).hand.find(card => card.id === fuel)!.name = 'Invented Hunter Seeker';
      return fuel;
    } },
    { name: 'altered canonical kind', change: g => {
      player(g, choam).hand.find(card => card.id === fuel)!.kind = 'worthless';
      return fuel;
    } },
    { name: 'altered canonical effect', change: g => {
      player(g, choam).hand.find(card => card.id === fuel)!.effect = 'karama';
      return fuel;
    } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(f.initial);
    const id = change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const before = row(f);
    const view = await f.restart().readSeatView(f.code, await authenticate(f, choam));
    assert.equal(view.kullReaction?.plays.some(play => play.card.id === id), false, name);
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, source: 'nexus', card: id });
    assert.deepEqual(row(f), before, name);
    assert.equal(f.writes.length, 0, name);
    protectedRows(f);
  }
});

void test('SQLite invented or altered canonical selected fuel cannot project or settle a restored Nexus Kull declaration', async t => {
  const f = await persisted(t, { fuel: 'weapon' });
  const { choam, actor, other, event, fuel, counter } = f;
  assert.ok(other && counter);
  const declared = await act(f, f.initial, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
  const mutations: { name: string; change(this: void, g: Game): void }[] = [
    { name: 'invented unique identifier', change: g => {
      // Deliberate forged evidence keeps all event/cursor references aligned so
      // independent physical admission, rather than a detached receipt, rejects it.
      Object.assign(g, JSON.parse(JSON.stringify(g).replaceAll(fuel, 'counterfeit-unique-treachery')));
    } },
    { name: 'name', change: g => { player(g, choam).hand.find(card => card.id === fuel)!.name += ' forged'; } },
    { name: 'kind', change: g => { player(g, choam).hand.find(card => card.id === fuel)!.kind = 'worthless'; } },
    { name: 'effect', change: g => { player(g, choam).hand.find(card => card.id === fuel)!.effect = 'karama'; } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(declared);
    change(corrupt);
    f.save(corrupt);
    f.writes.length = 0;
    const before = row(f);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
    await rejected(f, corrupt, actor, { type: 'passResponse' });
    await rejected(f, corrupt, other, { type: 'card', mode: 'cancel', card: counter });
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(row(f), before, name);
    assert.equal(f.writes.length, 0, name);
    const expected = name === 'invented unique identifier'
      ? f.stock.map(id => id === fuel ? 'counterfeit-unique-treachery' : id).sort() : f.stock;
    assert.deepEqual(physical(corrupt), expected);
    nexusInventory(corrupt);
    protectedRows(f);
  }
});

for (const outcome of ['success', 'prevention', 'decline'] as const)
  void test(`SQLite native Atreides Nexus inspection survives a real suspended Kull ${outcome} and resumes its exact continuation after restart`, async t => {
    let native!: NexusChoamKullGame & { reactor: string; reaction: string };
    const f = await persisted(t, { actorFaction: 'atreides', fuel: 'weapon' }, ids => {
      native = createNexusKullNativeParent('inspection', ids);
      return native;
    });
    const { choam, actor, fuel } = f;
    const { reactor, reaction } = native;
    const parentResponse = plain(f.initial.response);
    const parentInspection = plain(f.initial.battle!.nexusInspection);
    const firstAnswer = plain(f.initial.battle!.prescience);
    assert.equal(parentResponse?.kind, 'nexusPrescience');
    await restored(f, f.initial);
    const offered = await act(f, f.initial, reactor, { type: 'card', mode: 'cancel', card: reaction });
    const event = offered.pendingKull!.event;
    assert.deepEqual(offered.pendingKull!.resume.response, parentResponse);
    const offerViews = await restored(f, offered);
    assert.equal(offerViews[0].kullReaction?.event, event);
    let done: Game;
    if (outcome === 'decline') {
      done = await act(f, offered, choam, { type: 'kullDecision', event, decline: true });
    } else {
      const declared = await act(f, offered, choam, { type: 'kullDecision', event, source: 'nexus', card: fuel });
      assert.deepEqual(declared.pendingKull!.resume.response, parentResponse);
      assert.deepEqual(declared.battle!.nexusInspection, parentInspection);
      assert.deepEqual(declared.battle!.prescience, firstAnswer);
      await restored(f, declared);
      await stationary(f, declared);
      if (outcome === 'prevention') {
        done = await act(f, declared, actor, { type: 'card', mode: 'cancel', card: f.original });
      } else {
        done = await settle(f, declared);
        assert.equal(player(done, reactor).hand.some(card => card.id === reaction), true);
        assert.equal(done.discard.filter(card => card.id === fuel).length, 1);
        assert.equal(done.nexusChoamLast?.stage, 'complete');
        assert.equal(done.battle!.nexusInspection?.stage, 'answer');
        done = await act(f, done, reactor, { type: 'nexusPrescienceAnswer', event: done.battle!.event, value: null });
        assert.deepEqual(done.battle!.nexusInspection?.answers, [null]);
      }
    }
    if (outcome !== 'success') {
      assert.equal(done.battle!.nexusInspection?.stage, 'canceled');
      assert.equal(done.discard.filter(card => card.id === reaction).length, 1);
      assert.equal(player(done, choam).hand.some(card => card.id === fuel), true);
      assert.equal(done.discard.some(card => card.id === fuel), false);
      if (outcome === 'prevention') {
        assert.equal(done.discard.filter(card => card.id === f.original).length, 1);
        assert.equal(done.nexusChoamLast?.stage, 'canceled');
      } else {
        assert.equal(done.nexusCards!.cards!.hands[choam], 'choam');
        assert.equal(done.nexusChoamLast ?? null, null);
      }
    }
    assert.equal(done.pendingKull ?? null, null);
    assert.deepEqual(done.battle!.prescience, firstAnswer);
    assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'atreides').length, 1);
    await restored(f, done);
    await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
    inventory(f, done);
  });

void test('SQLite a suspended native CHOAM Karama fuel is never offered to cancel a nested BG Kull counter', async t => {
  let nested!: NexusChoamKullGame & { printed: string; bgCounter: string; nexusEvent: string };
  const f = await persisted(t, { bg: true, fuel: 'karama' }, ids => {
    nested = createNexusKullNestedParent(ids);
    return nested;
  });
  const { choam, actor, original, fuel } = f;
  const retainedFuel = plain(player(f.initial, choam).hand.find(card => card.id === fuel));
  const parent = plain(f.initial.pendingChoamWorthless);
  await restored(f, f.initial);
  const offered = await act(f, f.initial, actor, { type: 'card', mode: 'cancel', card: original });
  const event = offered.pendingKull!.event;
  const declared = await act(f, offered, choam,
    { type: 'kullDecision', event, source: 'printed', card: nested.printed });
  assert.deepEqual(declared.pendingKull!.worthless, parent);
  await restored(f, declared);
  const converted = await act(f, declared, actor, { type: 'card', mode: 'cancel', card: nested.bgCounter });
  assert.equal(converted.response?.kind, 'worthlessKarama');
  assert.equal(converted.pendingKarama?.use.kind, 'cancel');
  const views = await restored(f, converted);
  assert.equal(views[0].responseControls?.cancelCards.includes(fuel), false);
  assert.equal(views[0].responseControls?.cancelCards.includes(nested.printed), false);
  assert.deepEqual(player(converted, choam).hand.find(card => card.id === fuel), retainedFuel);
  await rejected(f, converted, choam, { type: 'card', mode: 'cancel', card: fuel });
  await stationary(f, converted);
  const done = await settle(f, converted);
  assert.equal(done.pendingKull ?? null, null);
  assert.equal(done.pendingKarama ?? null, null);
  assert.equal(done.pendingChoamWorthless ?? null, null);
  assert.equal(done.nexusChoamLast?.event, nested.nexusEvent);
  assert.equal(done.nexusChoamLast?.stage, 'canceled');
  assert.deepEqual(player(done, choam).hand.find(card => card.id === fuel), retainedFuel);
  assert.equal(done.discard.some(card => card.id === fuel), false);
  assert.equal(player(done, choam).hand.filter(card => card.id === nested.printed).length, 1);
  assert.equal(done.discard.filter(card => card.id === nested.bgCounter).length, 1);
  assert.equal(done.discard.filter(card => card.id === original).length, 1);
  assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'choam').length, 1);
  await restored(f, done);
  await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
});

for (const source of ['printed', 'nexus'] as const)
  void test(`SQLite ${source} Kull keeps CHOAM's last winning-payment Karama reserved and the original auction payable after restart`, async t => {
    let auction!: NexusChoamKullGame & { payment: string; printed: string; reactor: string; reaction: string; lot: string };
    const f = await persisted(t, { fuel: 'weapon' }, ids => {
      auction = createNexusKullAuctionParent(ids);
      return auction;
    });
    const { choam, actor, fuel } = f;
    const { payment, reactor, reaction, lot, printed } = auction;
    assert.equal(f.initial.decision?.kind, 'auctionPayment');
    assert.equal(f.initial.auction?.bidder, choam);
    assert.equal(f.initial.auction?.bid, 2);
    assert.equal(player(f.initial, choam).spice, 1);
    await restored(f, f.initial);
    const offered = await act(f, f.initial, reactor,
      { type: 'card', mode: 'special', card: reaction, target: actor, amount: 1 });
    const event = offered.pendingKull!.event;
    const views = await restored(f, offered);
    assert.equal(views[0].kullReaction?.plays.some(play => play.card.id === payment), false);
    assert.ok(views[0].kullReaction?.plays.some(play => play.source === 'printed' && play.card.id === printed));
    assert.ok(views[0].kullReaction?.plays.some(play => play.source === 'nexus' && play.card.id === fuel));
    await rejected(f, offered, choam, { type: 'kullDecision', event, source: 'nexus', card: payment });
    const cost = source === 'printed' ? printed : fuel;
    const declared = await act(f, offered, choam, { type: 'kullDecision', event, source, card: cost });
    await restored(f, declared);
    await stationary(f, declared);
    const prevented = await settle(f, declared);
    assert.deepEqual(prevented.decision, { kind: 'auctionPayment', player: choam });
    assert.equal(prevented.auction?.bid, 2);
    assert.equal(prevented.auction?.cards[prevented.auction.index].id, lot);
    assert.equal(player(prevented, choam).spice, 1);
    assert.equal(player(prevented, choam).hand.filter(card => card.id === payment).length, 1);
    assert.equal(player(prevented, reactor).hand.filter(card => card.id === reaction).length, 1);
    assert.equal(prevented.discard.filter(card => card.id === cost).length, 1);
    const paid = await act(f, prevented, choam, { type: 'decision', karama: true });
    const done = await settle(f, paid);
    assert.notEqual(done.decision?.kind, 'auctionPayment');
    assert.equal(player(done, choam).hand.filter(card => card.id === lot).length, 1);
    assert.equal(done.discard.filter(card => card.id === payment).length, 1);
    assert.equal(done.discard.filter(card => card.id === cost).length, 1);
    assert.equal(player(done, choam).spice, 1);
    assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'choam').length, source === 'nexus' ? 1 : 0);
    await restored(f, done);
    await rejected(f, done, choam, { type: 'kullDecision', event, source, card: cost });
    inventory(f, done);
  });
