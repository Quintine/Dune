import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import { moritaniAssassinateSignature } from '../game/moritani-assassinate';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  assassinationGame,
  stageAssassinationBattle,
  resolveAssassinationBattle,
  assassinationActions,
  assassinationPhysical,
} from './moritani-assassinate-fixture';

const clock: RoomsClock = { now: () => 42000, sleep: async () => {} };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const rows = (db: DatabaseSync) =>
  db.prepare('SELECT state,version FROM rooms ORDER BY code').all();

async function fixture(t: test.TestContext, dead = false, truth = false) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    'Assassinate recovery',
    'moritani',
    true,
    ['ecaz'],
  );
  const code = made.view.code,
    tokens = [
      made.token,
      (await store.rooms.joinRoom(code, 'Guild', 'guild')).token!,
    ];
  const auths = await Promise.all(
      tokens.map((token) => store.rooms.authenticate(code, token)),
    ),
    ids = auths.map((a) => a.playerId);
  let g = stageAssassinationBattle(assassinationGame(ids), 'guild-1', dead);
  let truthCard: string | undefined;
  if (truth) {
    const card = [...g.deck, ...g.players.flatMap((p) => p.hand)].find(
      (c) => c.effect === 'truthtrance',
    )!;
    g.deck = g.deck.filter((c) => c.id !== card.id);
    for (const p of g.players) p.hand = p.hand.filter((c) => c.id !== card.id);
    g.players[0].hand.push(card);
    truthCard = card.id;
  }
  g = resolveAssassinationBattle(g);
  assert.equal(g.phase, 6);
  assert.equal(g.decision?.kind, 'moritaniAssassinate');
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  const receipt = g.moritaniAssassinate!.opportunities.at(-1)!;
  return {
    ...store,
    code,
    tokens,
    auths,
    ids,
    g,
    truthCard,
    action: { type: 'decision', event: receipt.event, card: 'guild-1' },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function restored(f: Fixture, expected: Game) {
  const before = rows(f.sqlite);
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, token),
      view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(expected, f.ids[index]));
    assert.equal('moritaniAssassinatePreview' in view, false);
    assert.equal('moritaniAssassinateResume' in view, false);
    for (const rival of view.players.filter((p) => p.id !== f.ids[index])) {
      assert.equal('traitors' in rival, false);
      assert.equal('hand' in rival, false);
      assert.equal('spice' in rival, false);
    }
    if (index === 1)
      assert.deepEqual(view.moritaniAssassinate?.pending?.cards ?? [], []);
    for (const record of view.moritaniAssassinate?.history ?? []) {
      assert.equal('signature' in record, false);
      assert.equal('replacement' in record, false);
    }
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(rows(f.sqlite), before);
}
async function act(
  f: Fixture,
  index: number,
  action: Action,
  version?: number,
) {
  const rooms = f.restart(),
    auth = await rooms.authenticate(f.code, f.tokens[index]),
    g = await rooms.readRoom(f.code);
  await rooms.act(f.code, auth, version ?? g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function actualMentat(f: Fixture, state: Game) {
  let g = state;
  for (let n = 0; g.phase !== 8 && n < 30; n++) {
    const candidates = g.players.flatMap((p, index) =>
      assassinationActions(g, p.id).map((action) => ({ index, action })),
    );
    const next =
      candidates.find((c) => c.action.type === 'ready') ?? candidates[0];
    assert.ok(
      next,
      `Actual saved continuation must progress from phase ${g.phase}`,
    );
    g = await act(f, next.index, next.action);
  }
  assert.equal(g.phase, 8);
  return g;
}

void test('saved live and already-dead Assassinate reveals settle once, keep the physical traitor until actual Mentat and draw one private replacement', async (t) => {
  for (const dead of [false, true]) {
    const f = await fixture(t, dead),
      initial = clone(f.g),
      physical = assassinationPhysical(initial);
    const target = initial.players[1].leaders.find((l) => l.id === 'guild-1')!,
      bounty = dead ? 0 : target.strength;
    const seats = f.sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();
    await restored(f, initial);
    const before = rows(f.sqlite);
    await assert.rejects(act(f, 1, f.action));
    await assert.rejects(act(f, 0, { ...f.action, event: 'old' }));
    await assert.rejects(act(f, 0, { ...f.action, card: 'guild-0' }));
    await assert.rejects(
      act(f, 0, f.action, initial.version - 1),
      /table changed/,
    );
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, 0);
    const revealed = await act(f, 0, f.action, initial.version),
      receipt = revealed.moritaniAssassinate!.opportunities.at(-1)!;
    assert.equal(revealed.version, initial.version + 1);
    assert.equal(revealed.phase, 7);
    assert.equal(revealed.decision, null);
    assert.equal(revealed.moritaniAssassinateResume, undefined);
    assert.equal(receipt.stage, 'revealed');
    assert.equal(receipt.bounty, bounty);
    assert.equal(receipt.replacement, null);
    assert.equal(revealed.players[0].spice, initial.players[0].spice + bounty);
    const afterTarget = revealed.players[1].leaders.find(
      (l) => l.id === target.id,
    )!;
    assert.equal(afterTarget.dead, true);
    assert.equal(afterTarget.deaths, target.deaths + Number(!dead));
    assert.deepEqual(
      revealed.players[1].leaders.filter((l) => l.id !== target.id),
      initial.players[1].leaders.filter((l) => l.id !== target.id),
    );
    assert.deepEqual(revealed.players[0].traitors, initial.players[0].traitors);
    assert.deepEqual(revealed.traitorReserve, initial.traitorReserve);
    assert.deepEqual(assassinationPhysical(revealed), physical);
    await restored(f, revealed);
    const settled = rows(f.sqlite),
      writes = f.writes.length;
    await assert.rejects(act(f, 0, f.action, initial.version), /table changed/);
    await assert.rejects(act(f, 0, f.action, revealed.version));
    assert.deepEqual(rows(f.sqlite), settled);
    assert.equal(f.writes.length, writes);
    const replacement = revealed.traitorReserve![0],
      mentat = await actualMentat(f, revealed),
      done = mentat.moritaniAssassinate!.opportunities.at(-1)!;
    assert.equal(done.stage, 'replaced');
    assert.equal(done.replacement, replacement);
    assert.deepEqual(mentat.traitorReserve, revealed.traitorReserve!.slice(1));
    assert.deepEqual(mentat.players[0].traitors, [
      ...revealed.players[0].traitors.filter((c) => c !== 'guild-1'),
      replacement,
    ]);
    assert.equal(
      mentat.players.flatMap((p) => p.traitors).includes('guild-1'),
      false,
    );
    assert.equal(mentat.traitorReserve!.includes('guild-1'), false);
    assert.equal(
      mentat.moritaniAssassinate!.opportunities.filter(
        (r) => r.stage === 'replaced' && r.card === 'guild-1',
      ).length,
      1,
    );
    assert.deepEqual(assassinationPhysical(mentat), physical);
    await restored(f, mentat);
    const saved = rows(f.sqlite);
    await assert.rejects(act(f, 0, f.action));
    assert.deepEqual(rows(f.sqlite), saved);
    assert.deepEqual(
      f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
    assert.ok(f.writes.every((w) => w.changes === 1));
  }
});

void test('concurrent identical Assassinate reveals commit only one death, bounty and delayed replacement', async (t) => {
  const f = await fixture(t),
    target = f.g.players[1].leaders.find((l) => l.id === 'guild-1')!;
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
  let results: PromiseSettledResult<unknown>[];
  try {
    results = await Promise.allSettled(
      [0, 1].map(() => act(f, 0, f.action, f.g.version)),
    );
  } finally {
    clearTimeout(timer);
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const g = await f.restart().readRoom(f.code);
  assert.equal(g.version, f.g.version + 1);
  assert.equal(g.players[0].spice, f.g.players[0].spice + target.strength);
  assert.equal(
    g.players[1].leaders.find((l) => l.id === target.id)!.deaths,
    target.deaths + 1,
  );
  assert.equal(g.moritaniAssassinate!.opportunities.length, 1);
  const mentat = await actualMentat(f, g);
  assert.equal(mentat.traitorReserve!.length, f.g.traitorReserve!.length - 1);
  assert.equal(mentat.moritaniAssassinate!.opportunities[0].stage, 'replaced');
  assert.deepEqual(assassinationPhysical(mentat), assassinationPhysical(f.g));
  await restored(f, mentat);
});

void test('a real Truthtrance interruption restores the same private Assassinate choice and original battle cleanup', async (t) => {
  const f = await fixture(t, false, true),
    resume = clone(f.g.moritaniAssassinateResume),
    physical = assassinationPhysical(f.g);
  let g = await act(f, 0, { type: 'card', card: f.truthCard });
  assert.equal(g.truthtrance?.stage, 'priority');
  await restored(f, g);
  while (g.truthtrance?.stage === 'priority') {
    const p = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = await act(f, f.ids.indexOf(p.id), { type: 'truthPass' });
  }
  g = await act(f, 0, {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: f.ids[1],
      fact: { kind: 'spice', compare: 'gte', value: 0 },
    },
  });
  await restored(f, g);
  assert.deepEqual(g.moritaniAssassinateResume, resume);
  const pending = rows(f.sqlite);
  await assert.rejects(act(f, 0, f.action));
  assert.deepEqual(rows(f.sqlite), pending);
  g = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.truthtrance, null);
  assert.equal(g.decision?.kind, 'moritaniAssassinate');
  assert.deepEqual(g.moritaniAssassinateResume, resume);
  assert.equal(g.discard.filter((c) => c.id === f.truthCard).length, 1);
  assert.deepEqual(assassinationPhysical(g), physical);
  await restored(f, g);
  g = await act(f, 0, {
    type: 'decision',
    event: f.action.event,
    decline: true,
  });
  assert.equal(g.phase, 7);
  assert.equal(g.moritaniAssassinate!.opportunities[0].stage, 'declined');
  assert.deepEqual(g.players[0].traitors, f.g.players[0].traitors);
  assert.deepEqual(g.traitorReserve, f.g.traitorReserve);
  const mentat = await actualMentat(f, g);
  assert.deepEqual(mentat.traitorReserve, f.g.traitorReserve);
  assert.deepEqual(assassinationPhysical(mentat), physical);
  await restored(f, mentat);
});

void test('damaged saved Assassinate cleanup, receipt, obligation or decision rejects reads and actions without SQLite repair', async (t) => {
  const f = await fixture(t);
  for (const damage of [
    (g: Game) => {
      delete g.moritaniAssassinateResume;
    },
    (g: Game) => {
      g.moritaniAssassinateResume!.signature = 'changed';
    },
    (g: Game) => {
      const r = g.moritaniAssassinateResume!;
      r.continuation.winner = f.ids[0];
      r.signature = JSON.stringify(r.continuation);
    },
    (g: Game) => {
      const r = g.moritaniAssassinateResume!;
      r.continuation.territory = 'carthag';
      r.signature = JSON.stringify(r.continuation);
    },
    (g: Game) => {
      const r = g.moritaniAssassinateResume!;
      r.continuation.combatants = [f.ids[0]];
      r.signature = JSON.stringify(r.continuation);
    },
    (g: Game) => {
      const r = g.moritaniAssassinateResume!;
      r.continuation.cards = [g.deck[0].id];
      r.signature = JSON.stringify(r.continuation);
    },
    (g: Game) => {
      const r = g.moritaniAssassinateResume!;
      r.continuation.casualties!.options[0].normal = 1;
      r.signature = JSON.stringify(r.continuation);
    },
    (g: Game) => {
      g.moritaniAssassinate!.opportunities[0].card = 'guild-1';
    },
    (g: Game) => {
      const r = g.moritaniAssassinate!.opportunities[0];
      r.opposingLeader = 'guild-2';
      r.signature = moritaniAssassinateSignature(r);
    },
    (g: Game) => {
      delete g.lastBattleContext!.moritaniAssassinate;
    },
    (g: Game) => {
      delete g.lastBattleContext!.moritaniAssassinate!.continuation;
    },
    (g: Game) => {
      delete g.moritaniAssassinateCallEvents;
    },
    (g: Game) => {
      g.decision = null;
    },
  ]) {
    const g = clone(f.g);
    damage(g);
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(g), f.code);
    const before = rows(f.sqlite),
      writes = f.writes.length;
    for (const token of f.tokens) {
      const rooms = f.restart(),
        auth = await rooms.authenticate(f.code, token);
      await assert.rejects(rooms.readSeatView(f.code, auth), /assassinat/i);
    }
    await assert.rejects(act(f, 0, f.action), /assassinat/i);
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, writes);
  }
});

void test('a replacement receipt cannot point to a card still in reserve or conceal a transfer to the opponent even when the global traitor census is unchanged', async (t) => {
  const f = await fixture(t),
    revealed = await act(f, 0, f.action),
    mentat = await actualMentat(f, revealed);
  const physical = assassinationPhysical(mentat);
  for (const damage of [
    (g: Game) => {
      const r = g.moritaniAssassinate!.opportunities[0];
      r.replacement = g.traitorReserve![0];
      r.signature = moritaniAssassinateSignature(r);
      g.lastBattleContext!.moritaniAssassinate!.signature = r.signature;
    },
    (g: Game) => {
      const card = g.moritaniAssassinate!.opportunities[0].replacement!,
        index = g.players[0].traitors.indexOf(card);
      assert.ok(index >= 0);
      g.players[0].traitors[index] = g.players[1].traitors[0];
      g.players[1].traitors[0] = card;
    },
  ]) {
    const g = clone(mentat);
    damage(g);
    assert.deepEqual(assassinationPhysical(g), physical);
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(g), f.code);
    const before = rows(f.sqlite),
      writes = f.writes.length;
    for (const token of f.tokens) {
      const rooms = f.restart(),
        auth = await rooms.authenticate(f.code, token);
      await assert.rejects(rooms.readSeatView(f.code, auth), /replacement/i);
    }
    await assert.rejects(act(f, 0, { type: 'ready' }), /replacement/i);
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, writes);
  }
});
