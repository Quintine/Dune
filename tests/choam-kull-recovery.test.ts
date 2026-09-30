import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type * as Rooms from '../db/rooms';
import { viewGame, type Action, type Game, type GameView } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import { choamKullGame, kullShipmentAttempt, takeKullCard } from './fixture-choam-kull';

const clock = { now: () => 10000, sleep: async () => {} };
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
const credentials = (sqlite: DatabaseSync) => ({
  seats: sqlite.prepare('SELECT * FROM seats ORDER BY token_hash').all(),
  entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY operation_hash').all(),
  keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code, player_id').all(),
  recoveries: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code, player_id, operation_hash').all(),
});

function inventory(g: Game) {
  return [...g.deck, ...g.discard, ...(g.richeseCache ?? []), ...g.players.flatMap(p => p.hand)]
    .map(card => card.id).sort();
}

async function persisted(prepare?: (g: Game) => void) {
  const store = unitStore();
  try {
    const created = await store.rooms.createRoom('Kull SQLite QA', 'choam', true, ['choam', 'ix']);
    const code = created.view.code;
    const joined = [
      await store.rooms.joinRoom(code, 'Emperor', 'emperor'),
      await store.rooms.joinRoom(code, 'Bene Gesserit', 'beneGesserit'),
      await store.rooms.joinRoom(code, 'Harkonnen', 'harkonnen'),
    ];
    const tokens = [created.token, ...joined.map(seat => seat.token!)];
    const auths = await Promise.all(tokens.map(token => store.restart().authenticate(code, token)));
    const current = await store.rooms.readRoom(code);
    const initial = choamKullGame({ seatIds: auths.map(auth => auth.playerId) });
    initial.code = code;
    initial.host = auths[0].playerId;
    initial.version = current.version;
    prepare?.(initial);
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(initial), initial.version, code, current.version).changes, 1);
    store.writes.length = 0;
    return { ...store, code, tokens, auths, initial,
      originalCredentials: credentials(store.sqlite), originalCards: inventory(initial) };
  } catch (error) {
    store.sqlite.close();
    throw error;
  }
}
type Fixture = {
  rooms: typeof Rooms;
  restart: () => typeof Rooms;
  sqlite: DatabaseSync;
  hooks: { beforeWrite?: () => Promise<void>; beforeStatement?: (sql: string) => Promise<void> };
  writes: { expected: number; changes: number }[];
  code: string;
  tokens: string[];
  auths: Rooms.SeatAuth[];
  initial: Game;
  originalCredentials: { seats: unknown[]; entries: unknown[]; keys: unknown[]; recoveries: unknown[] };
  originalCards: string[];
};

async function act(f: Fixture, g: Game, actor: string, action: Action) {
  const rooms = f.restart();
  const auth = f.auths.find(auth => auth.playerId === actor)!;
  await rooms.act(f.code, auth, g.version, action, clock);
  return rooms.readRoom(f.code);
}

async function restored(f: Fixture, g: Game) {
  const rooms = f.restart();
  const views: GameView[] = [];
  for (let index = 0; index < f.tokens.length; index++) {
    const auth = await rooms.authenticate(f.code, f.tokens[index]);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, auth.playerId));
    if (g.pendingKull) {
      assert.equal('pendingKull' in view, false, 'saved intent and suspended controls are not a projection');
      assert.equal(JSON.stringify(view).includes(JSON.stringify(g.pendingKull.signature)), false);
    }
    assert.deepEqual(view.players.find(p => p.id === auth.playerId)!.hand, player(g, auth.playerId).hand);
    for (const other of view.players.filter(p => p.id !== auth.playerId)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
    views.push(view);
  }
  assert.deepEqual(credentials(f.sqlite), f.originalCredentials);
  assert.deepEqual(inventory(g), f.originalCards);
  assert.equal(new Set(inventory(g)).size, f.originalCards.length);
  return views;
}

async function rejected(f: Fixture, g: Game, actor: string, action: Action, version = g.version) {
  const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
  const attemptedStatements: string[] = [];
  f.hooks.beforeStatement = async sql => { attemptedStatements.push(sql); };
  try {
    await assert.rejects(f.restart().act(f.code, f.auths.find(auth => auth.playerId === actor)!,
      version, action, clock));
  } finally { delete f.hooks.beforeStatement; }
  assert.deepEqual(attemptedStatements, [], 'rejected game actions must not attempt SQL writes');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
  assert.deepEqual(credentials(f.sqlite), f.originalCredentials);
}

async function stationary(f: Fixture, g: Game) {
  const before = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code);
  const writes = f.writes.length;
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.code), before);
  assert.equal(f.writes.length, writes);
  await restored(f, g);
}

async function passes(f: Fixture, initial: Game) {
  let g = initial;
  for (let step = 0; g.response && step < 16; step++) {
    const responder = g.players.find(p => !g.response!.passed.includes(p.id));
    assert.ok(responder, 'an unresolved response must retain a real seat');
    g = await act(f, g, responder.id, { type: 'passResponse' });
    await restored(f, g);
  }
  assert.equal(g.response, null);
  return g;
}

async function compete(f: Fixture, g: Game, actor: string, action: Action) {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const priorWrites = f.writes.length;
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  const auth = f.auths.find(auth => auth.playerId === actor)!;
  try {
    const outcomes = await Promise.allSettled([
      f.rooms.act(f.code, auth, g.version, action, clock),
      f.restart().act(f.code, auth, g.version, action, clock),
    ]);
    assert.equal(arrivals, 2);
    assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1);
    assert.deepEqual(f.writes.slice(priorWrites).map(write => write.changes).sort((a, b) => a - b), [0, 1]);
  } finally { delete f.hooks.beforeWrite; }
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, g.version + 1);
  await restored(f, done);
  return done;
}

async function offer(f: Fixture, initial: Game, actor: string, action: Action, expectedCards = ['ix-kull-wahad']) {
  const g = await act(f, initial, actor, action);
  const views = await restored(f, g);
  const reaction = views[0].kullReaction;
  assert.ok(reaction);
  assert.equal(reaction.player, f.auths[0].playerId);
  assert.equal(reaction.target, actor);
  assert.equal(reaction.canDecline, true);
  assert.deepEqual(reaction.cards.map(card => card.id), expectedCards);
  const publicFields = { event: reaction.event, player: reaction.player, target: reaction.target,
    intent: reaction.intent, cards: [], canDecline: false, blocked: null };
  for (const view of views.slice(1)) assert.deepEqual(view.kullReaction, publicFields);
  assert.deepEqual(g.players, initial.players, 'the public offer must precede every card, revival, income and once-use cost');
  assert.deepEqual(g.discard, initial.discard);
  await stationary(f, g);
  return { g, event: reaction.event };
}

void test('persisted Kull offer and racing decline revive Emperor forces exactly once after restart', async () => {
  const f = await persisted(g => {
    g.phase = 4;
    g.active = null;
    player(g, g.players[1].id).tanks = 4;
    player(g, g.players[1].id).reserves -= 4;
  });
  try {
    const emperor = f.auths[1].playerId;
    const card = player(f.initial, emperor).hand.find(card => card.effect === 'karama')!;
    const original = { type: 'card', mode: 'special', card: card.id, amount: 2 };
    const { g, event } = await offer(f, f.initial, emperor, original);
    const decline = { type: 'kullDecision', event, decline: true };
    await rejected(f, g, emperor, decline);
    await rejected(f, g, f.auths[0].playerId, { ...decline, event: `${event}-obsolete` });
    await rejected(f, g, f.auths[0].playerId, { type: 'kullDecision', event, card: card.id });
    await rejected(f, g, f.auths[0].playerId, { type: 'kullDecision', event, decline: 'yes' });
    await rejected(f, g, f.auths[0].playerId, decline, g.version - 1);
    const done = await compete(f, g, f.auths[0].playerId, decline);
    assert.equal(player(done, emperor).tanks, 2);
    assert.equal(player(done, emperor).reserves, player(f.initial, emperor).reserves + 2);
    assert.equal(player(done, emperor).specialKaramaUsed, true);
    assert.equal(done.discard.filter(held => held.id === card.id).length, 1);
    assert.equal(player(done, f.auths[0].playerId).hand.filter(held => held.id === 'ix-kull-wahad').length, 1);
    assert.equal(viewGame(done, emperor).kullReaction, null);
    await rejected(f, done, f.auths[0].playerId, decline);
    await rejected(f, done, emperor, original);
    await stationary(f, done);
  } finally { f.sqlite.close(); }
});

void test('persisted Kull success races the final pass, retains printed Karama and blocks its phase activation', async () => {
  const f = await persisted();
  try {
    const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const original = kullShipmentAttempt(f.initial, emperor);
    const { g: offered, event } = await offer(f, f.initial, emperor, original);
    let g = await act(f, offered, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.equal(g.karamaShipping, null);
    assert.equal(g.discard.some(card => card.id === original.card), false);
    await restored(f, g);
    await stationary(f, g);
    for (let step = 0; step < 4; step++) {
      const eligible = g.players.filter(p => {
        const controls = viewGame(g, p.id).responseControls;
        return controls && !controls.hasPassed && controls.cancelCards.length > 0;
      });
      assert.ok(eligible.length > 0, 'the final-pass race must reach an unresolved legal counter seat');
      if (eligible.length === 1) break;
      g = await act(f, g, eligible[0].id, { type: 'passResponse' });
    }
    const finalSeat = g.players.find(p => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    })!;
    const done = await compete(f, g, finalSeat.id, { type: 'passResponse' });
    assert.equal(done.response, null);
    assert.equal(viewGame(done, emperor).kullReaction, null);
    assert.equal(done.karamaShipping, null);
    assert.equal(done.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
    assert.equal(player(done, emperor).hand.filter(card => card.id === original.card).length, 1);
    assert.equal(player(done, emperor).spice, player(f.initial, emperor).spice);
    await rejected(f, done, emperor, original);
    await rejected(f, done, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    await stationary(f, done);
  } finally { f.sqlite.close(); }
});

void test('a distinct held Karama counters persisted Kull and resumes the original shipment only once', async () => {
  const f = await persisted(g => {
    const distinct = player(g, g.players[3].id).hand.find(card => card.effect === 'karama')!;
    player(g, g.players[1].id).hand.push(takeKullCard(g, distinct.id));
  });
  try {
    const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const original = kullShipmentAttempt(f.initial, emperor);
    const distinct = player(f.initial, emperor).hand.find(card => card.effect === 'karama' && card.id !== original.card)!;
    const { g: offered, event } = await offer(f, f.initial, emperor, original);
    const g = await act(f, offered, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    const views = await restored(f, g);
    assert.deepEqual(views[1].responseControls?.cancelCards, [distinct.id]);
    assert.equal(views[1].responseControls?.cancelCards.includes(String(original.card)), false);
    await rejected(f, g, emperor, { type: 'card', mode: 'cancel', card: original.card });
    const counter = { type: 'card', mode: 'cancel', card: distinct.id };
    const done = await compete(f, g, emperor, counter);
    assert.deepEqual(done.karamaShipping, { player: emperor, owner: emperor, card: original.card });
    assert.equal(done.response, null);
    assert.equal(done.discard.filter(card => card.id === original.card).length, 1);
    assert.equal(done.discard.filter(card => card.id === distinct.id).length, 1);
    assert.equal(player(done, choam).hand.filter(card => card.id === 'ix-kull-wahad').length, 1);
    assert.equal(done.discard.some(card => card.id === 'ix-kull-wahad'), false);
    assert.equal(viewGame(done, emperor).kullReaction, null);
    await rejected(f, done, emperor, counter);
    await rejected(f, done, choam, { type: 'kullDecision', event, decline: true });
    await stationary(f, done);
  } finally { f.sqlite.close(); }
});

void test('Kull intercepts persisted BG substitution before conversion and retains every attempted physical card', async () => {
  const f = await persisted(g => {
    const extra = g.deck.find(card => card.kind === 'worthless')!;
    player(g, g.players[2].id).hand.push(takeKullCard(g, extra.id));
  });
  try {
    const bg = f.auths[2].playerId, emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const worthless = player(f.initial, bg).hand.filter(card => card.kind === 'worthless');
    assert.equal(worthless.length, 2);
    const original = { type: 'card', mode: 'shipment', card: worthless[0].id, target: emperor };
    const { g: offered, event } = await offer(f, f.initial, bg, original);
    assert.equal(offered.pendingKarama, null);
    let g = await act(f, offered, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.equal(g.pendingKarama, null);
    assert.equal(player(g, bg).hand.some(card => card.id === worthless[0].id), true);
    await restored(f, g);
    await stationary(f, g);
    g = await passes(f, g);
    assert.equal(g.karamaShipping, null);
    assert.deepEqual(player(g, bg).hand, player(f.initial, bg).hand);
    assert.equal(g.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
    assert.equal(g.discard.some(card => card.id === worthless[0].id), false);
    await rejected(f, g, bg, original);
    await rejected(f, g, bg, { ...original, card: worthless[1].id });
    await stationary(f, g);
  } finally { f.sqlite.close(); }
});

void test('declining persisted Kull resumes the real BG conversion and shipment without repeated disposal', async () => {
  const f = await persisted();
  try {
    const bg = f.auths[2].playerId, emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const worthless = player(f.initial, bg).hand.find(card => card.kind === 'worthless')!;
    const original = { type: 'card', mode: 'shipment', card: worthless.id, target: emperor };
    const { g: offered, event } = await offer(f, f.initial, bg, original);
    const decline = { type: 'kullDecision', event, decline: true };
    let g = await act(f, offered, choam, decline);
    assert.equal(g.response?.kind, 'worthlessKarama');
    assert.ok(g.pendingKarama);
    assert.equal(g.karamaShipping, null);
    assert.equal(g.discard.filter(card => card.id === worthless.id).length, 1);
    assert.equal(player(g, bg).hand.some(card => card.id === worthless.id), false);
    await restored(f, g);
    await stationary(f, g);
    g = await passes(f, g);
    assert.deepEqual(g.karamaShipping, { player: emperor, owner: bg, card: worthless.id });
    assert.equal(g.pendingKarama, null);
    assert.equal(g.discard.filter(card => card.id === worthless.id).length, 1);
    assert.equal(player(g, choam).hand.filter(card => card.id === 'ix-kull-wahad').length, 1);
    await rejected(f, g, choam, decline);
    await rejected(f, g, bg, original);
    await stationary(f, g);
  } finally { f.sqlite.close(); }
});

void test('successful persisted Kull prevents Emperor revival before forces or its special once-use are spent', async () => {
  const f = await persisted(g => {
    g.phase = 4;
    g.active = null;
    player(g, g.players[1].id).tanks = 4;
    player(g, g.players[1].id).reserves -= 4;
  });
  try {
    const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const karama = player(f.initial, emperor).hand.find(card => card.effect === 'karama')!;
    const original = { type: 'card', mode: 'special', card: karama.id, amount: 2 };
    const { g: offered, event } = await offer(f, f.initial, emperor, original);
    const declared = await act(f, offered, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    await restored(f, declared);
    const done = await passes(f, declared);
    assert.deepEqual(player(done, emperor), player(f.initial, emperor));
    assert.equal(player(done, emperor).specialKaramaUsed ?? false, false);
    assert.equal(done.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
    assert.equal(done.discard.some(card => card.id === karama.id), false);
    await rejected(f, done, emperor, original);
    await stationary(f, done);
  } finally { f.sqlite.close(); }
});

void test('a Kull-free saved CHOAM hand still receives the neutral private offer and can decline the real attempt', async () => {
  const f = await persisted(g => { g.deck.push(takeKullCard(g, 'ix-kull-wahad')); });
  try {
    const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const original = kullShipmentAttempt(f.initial, emperor);
    await rejected(f, f.initial, emperor, { type: 'card', mode: 'special', card: original.card, amount: 2 });
    const { g, event } = await offer(f, f.initial, emperor, original, []);
    await rejected(f, g, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    const done = await act(f, g, choam, { type: 'kullDecision', event, decline: true });
    assert.deepEqual(done.karamaShipping, { player: emperor, owner: emperor, card: original.card });
    assert.equal(done.discard.filter(card => card.id === original.card).length, 1);
    assert.equal(done.discard.some(card => card.id === 'ix-kull-wahad'), false);
    await stationary(f, done);
  } finally { f.sqlite.close(); }
});

void test('corrupt saved Kull intent ownership cannot execute or write after a room-module restart', async () => {
  const f = await persisted();
  try {
    const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
    const { g, event } = await offer(f, f.initial, emperor, kullShipmentAttempt(f.initial, emperor));
    assert.ok(g.pendingKull);
    const corrupt = structuredClone(g);
    corrupt.pendingKull!.owner = f.auths[2].playerId;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=? WHERE code=? AND version=?')
      .run(JSON.stringify(corrupt), f.code, g.version).changes, 1);
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, decline: true });
    await rejected(f, corrupt, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
    await assert.rejects(f.restart().readSeatView(f.code, f.auths[0]));
    assert.deepEqual(credentials(f.sqlite), f.originalCredentials);
  } finally { f.sqlite.close(); }
});

void test('orphaned saved Kull counters cannot be projected or commit a partial pass', async () => {
  for (const conversion of [false, true]) {
    const f = await persisted();
    try {
      const emperor = f.auths[1].playerId, choam = f.auths[0].playerId;
      const { g, event } = await offer(f, f.initial, emperor, kullShipmentAttempt(f.initial, emperor));
      let counter = await act(f, g, choam, { type: 'kullDecision', event, card: 'ix-kull-wahad' });
      if (conversion) {
        const bg = f.auths[2].playerId;
        counter = await act(f, counter, bg, {
          type: 'card', mode: 'cancel', card: player(counter, bg).hand[0].id,
        });
      }
      const corrupt = structuredClone(counter);
      delete corrupt.pendingKull;
      assert.equal(f.sqlite.prepare('UPDATE rooms SET state=? WHERE code=? AND version=?')
        .run(JSON.stringify(corrupt), f.code, counter.version).changes, 1);
      await rejected(f, corrupt, f.auths[3].playerId, { type: 'passResponse' });
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code, auth), /lost its interrupted Karama frame/);
      assert.deepEqual(credentials(f.sqlite), f.originalCredentials);
    } finally { f.sqlite.close(); }
  }
});
