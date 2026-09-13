import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { TruthFact } from '../game/truthtrance';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  knowledgeGame,
  knownForecastGame,
  askKnowledge,
  knowledgePhysical,
} from './truthtrance-knowledge-fixture';

const clock: RoomsClock = { now: () => 23000, sleep: async () => {} };
const rows = (db: DatabaseSync) =>
  db.prepare('SELECT state,version FROM rooms ORDER BY code').all();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const secrets = (g: Game) => ({
  predictions: g.players.map((p) => ({
    id: p.id,
    prediction: p.prediction ?? null,
  })),
  stormDials: g.stormDials,
  stormDialers: g.stormDialers,
  stormCard: g.stormCard,
  stormCardKnown: g.stormCardKnown,
  response: g.response,
  phase: g.phase,
  turn: g.turn,
});

async function fixture(
  t: test.TestContext,
  advanced: boolean,
  prepare: (ids: string[]) => Game,
) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    'Private knowledge recovery',
    'guild',
    advanced,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['beneGesserit', 'fremen', 'atreides'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = auths.map((auth) => auth.playerId),
    g = prepare(ids);
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, g };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function restored(f: Fixture, expected: Game) {
  const before = rows(f.sqlite);
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(expected, f.ids[index]));
    for (const rival of view.players.filter((p) => p.id !== f.ids[index])) {
      assert.equal('hand' in rival, false);
      assert.equal('spice' in rival, false);
      assert.equal('prediction' in rival, false);
    }
    if (expected.truthtrance?.question?.target !== f.ids[index])
      assert.equal(view.truthAnswer, null);
    if (index !== 2) assert.equal(view.stormForecast, null);
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
    auth = await rooms.authenticate(f.code, f.tokens[index]);
  const current = await rooms.readRoom(f.code);
  await rooms.act(f.code, auth, version ?? current.version, action, clock);
  return f.restart().readRoom(f.code);
}
function oneCardSpent(initial: Game, done: Game) {
  const card = initial.truthtrance!.queue[0].card,
    owner = initial.truthtrance!.queue[0].player;
  assert.equal(done.discard.filter((c) => c.id === card).length, 1);
  for (const p of done.players)
    assert.equal(
      p.hand.some((c) => c.id === card),
      false,
    );
  assert.deepEqual(
    done.players.find((p) => p.id === owner)!.hand,
    initial.players
      .find((p) => p.id === owner)!
      .hand.filter((c) => c.id !== card),
  );
  assert.deepEqual(knowledgePhysical(done), knowledgePhysical(initial));
  assert.equal(done.truthtrance, null);
}

void test('saved BG AND/OR prediction questions restore privately and consume one physical Truthtrance only after an authenticated truthful answer', async (t) => {
  for (const advanced of [false, true])
    for (const kind of ['and', 'or'] as const) {
      const fact: TruthFact = {
        kind,
        terms: [
          { kind: 'prediction', field: 'faction', faction: 'guild' },
          { kind: 'prediction', field: 'turn', compare: 'eq', value: 3 },
        ],
      };
      const expected = kind === 'and' ? 'no' : 'yes';
      const f = await fixture(t, advanced, (ids) =>
        askKnowledge(knowledgeGame(advanced, ids), ids[1], fact),
      );
      await restored(f, f.g);
      const immutable = rows(f.sqlite),
        seats = f.sqlite
          .prepare('SELECT * FROM seats ORDER BY player_id')
          .all();
      await assert.rejects(
        act(f, 3, { type: 'truthAnswer', answer: expected }),
      );
      await assert.rejects(
        act(f, 1, {
          type: 'truthAnswer',
          answer: expected === 'yes' ? 'no' : 'yes',
        }),
        /truthfully/,
      );
      await assert.rejects(
        act(f, 1, { type: 'truthAnswer', answer: 'unknown' }),
        /truthfully/,
      );
      await assert.rejects(
        act(f, 1, { type: 'truthAnswer', answer: expected }, f.g.version - 1),
        /table changed/,
      );
      assert.deepEqual(rows(f.sqlite), immutable);
      assert.equal(f.writes.length, 0);
      const done = await act(
        f,
        1,
        { type: 'truthAnswer', answer: expected },
        f.g.version,
      );
      assert.equal(done.version, f.g.version + 1);
      assert.equal(done.truthHistory!.at(-1)!.answer, expected);
      assert.deepEqual(secrets(done), secrets(f.g));
      oneCardSpent(f.g, done);
      await restored(f, done);
      const saved = rows(f.sqlite);
      await assert.rejects(
        act(f, 1, { type: 'truthAnswer', answer: expected }, f.g.version),
        /table changed/,
      );
      await assert.rejects(
        act(f, 1, { type: 'truthAnswer', answer: expected }, done.version),
      );
      assert.deepEqual(rows(f.sqlite), saved);
      assert.deepEqual(
        f.writes.map((w) => w.changes),
        [1],
      );
      assert.deepEqual(
        f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
        seats,
      );
    }
});

void test('saved current storm-dial and known Fremen forecast facts answer without changing the committed value or exposing it to other seats', async (t) => {
  for (const forecast of [false, true]) {
    const f = await fixture(t, forecast, (ids) => {
      let g = forecast ? knownForecastGame(ids) : knowledgeGame(false, ids);
      const target = forecast
        ? ids[2]
        : g.stormDialers.find((id) => id !== ids[0])!;
      if (!forecast)
        g = applyAction(g, target, { type: 'stormDial', amount: 0 });
      return askKnowledge(g, target, {
        kind: forecast ? 'stormForecast' : 'stormDial',
        compare: 'eq',
        value: forecast ? g.stormCard! : 0,
      });
    });
    const target = f.g.truthtrance!.question!.target,
      index = f.ids.indexOf(target);
    assert.equal(viewGame(f.g, target).truthAnswer, 'yes');
    await restored(f, f.g);
    const before = rows(f.sqlite);
    await assert.rejects(
      act(f, index, { type: 'truthAnswer', answer: 'no' }),
      /truthfully/,
    );
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, 0);
    const done = await act(f, index, { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(secrets(done), secrets(f.g));
    oneCardSpent(f.g, done);
    await restored(f, done);
    if (!forecast) {
      const other = done.stormDialers.find((id) => id !== target)!;
      const continued = await act(f, f.ids.indexOf(other), {
        type: 'stormDial',
        amount: 0,
      });
      assert.equal(continued.stormDials[target], 0);
      assert.equal(continued.stormDials[other], 0);
      await restored(f, continued);
    }
  }
});

/** A conserved real Karama creates the native response; no response object is invented. */
function stormResponseGame(ids: string[]) {
  let g = knowledgeGame(true, ids);
  const karama = [...g.deck, ...g.players.flatMap((p) => p.hand)].find(
    (c) => c.effect === 'karama',
  )!;
  g.deck = g.deck.filter((c) => c.id !== karama.id);
  for (const p of g.players) p.hand = p.hand.filter((c) => c.id !== karama.id);
  g.players[0].hand.push(karama);
  for (const id of g.stormDialers)
    g = applyAction(g, id, { type: 'stormDial', amount: 0 });
  for (const p of g.players)
    if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.response?.kind, 'stormPeek');
  assert.equal(g.stormCardKnown, false);
  return g;
}

void test('unknown forecast survives restart and retains the card for rephrasing or saving while the original storm response resumes once', async (t) => {
  for (const save of [false, true]) {
    const f = await fixture(t, true, (ids) =>
      askKnowledge(stormResponseGame(ids), ids[2], {
        kind: 'stormForecast',
        compare: 'eq',
        value: 1,
      }),
    );
    const initial = clone(f.g),
      card = initial.truthtrance!.queue[0].card;
    await restored(f, initial);
    await assert.rejects(
      act(f, 2, { type: 'truthAnswer', answer: 'no' }),
      /truthfully/,
    );
    let g = await act(f, 2, { type: 'truthAnswer', answer: 'unknown' });
    assert.equal(g.truthtrance!.stage, 'unknown');
    assert.deepEqual(g.players[0].hand, initial.players[0].hand);
    assert.equal(
      g.discard.some((c) => c.id === card),
      false,
    );
    assert.deepEqual(secrets(g), secrets(initial));
    await restored(f, g);
    const before = rows(f.sqlite);
    await assert.rejects(act(f, 1, { type: 'truthSave' }));
    await assert.rejects(act(f, 2, { type: 'truthAnswer', answer: 'unknown' }));
    assert.deepEqual(rows(f.sqlite), before);
    if (save) {
      g = await act(f, 0, { type: 'truthSave' });
      assert.equal(g.truthtrance, null);
      assert.deepEqual(g.players[0].hand, initial.players[0].hand);
      assert.equal(
        g.discard.some((c) => c.id === card),
        false,
      );
    } else {
      g = await act(f, 0, {
        type: 'truthAsk',
        question: {
          kind: 'fact',
          target: f.ids[1],
          fact: { kind: 'prediction', field: 'turn', compare: 'eq', value: 7 },
        },
      });
      await restored(f, g);
      g = await act(f, 1, { type: 'truthAnswer', answer: 'yes' });
      oneCardSpent(initial, g);
    }
    assert.deepEqual(g.response, initial.response);
    assert.deepEqual(secrets(g), secrets(initial));
    await restored(f, g);
    for (
      let count = 0;
      g.response?.kind === 'stormPeek' && count < 5;
      count++
    ) {
      const responder = g.players.find(
        (p) => !g.response!.passed.includes(p.id),
      )!;
      g = await act(f, f.ids.indexOf(responder.id), { type: 'passResponse' });
    }
    assert.equal(g.response, null);
    assert.equal(g.stormCardKnown, true);
    assert.equal(g.discard.filter((c) => c.id === card).length, save ? 0 : 1);
    assert.deepEqual(knowledgePhysical(g), knowledgePhysical(initial));
    await restored(f, g);
  }
});

void test('concurrent identical truthful prediction answers commit one physical card and one history entry', async (t) => {
  const f = await fixture(t, true, (ids) =>
    askKnowledge(knowledgeGame(true, ids), ids[1], {
      kind: 'prediction',
      field: 'faction',
      faction: 'guild',
    }),
  );
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
      [0, 1].map(() =>
        act(f, 1, { type: 'truthAnswer', answer: 'yes' }, f.g.version),
      ),
    );
  } finally {
    clearTimeout(timer);
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, f.g.version + 1);
  assert.equal(done.truthHistory!.length, 1);
  assert.deepEqual(secrets(done), secrets(f.g));
  oneCardSpent(f.g, done);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  await restored(f, done);
});

void test('malformed saved knowledge bounds or fields cannot produce an authenticated answer or write a repaired state', async (t) => {
  const f = await fixture(t, false, (ids) =>
    askKnowledge(knowledgeGame(false, ids), ids[1], {
      kind: 'prediction',
      field: 'turn',
      compare: 'eq',
      value: 7,
    }),
  );
  for (const malformed of [
    { kind: 'prediction', field: 'turn', compare: 'eq', value: 11 },
    { kind: 'prediction', field: 'winner', compare: 'eq', value: 7 },
    { kind: 'stormForecast', compare: 'eq', value: 7 },
  ]) {
    const damaged = clone(f.g),
      question = damaged.truthtrance!.question!;
    assert.equal(question.kind, 'fact');
    if (question.kind !== 'fact')
      throw new Error('Expected the stored structured question');
    question.fact = malformed as TruthFact;
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(damaged), f.code);
    const before = rows(f.sqlite),
      writes = f.writes.length;
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, f.tokens[1]);
    await assert.rejects(
      rooms.readSeatView(f.code, auth),
      /prediction|forecast/,
    );
    await assert.rejects(
      act(f, 1, { type: 'truthAnswer', answer: 'yes' }),
      /prediction|forecast/,
    );
    await assert.rejects(
      act(f, 1, { type: 'truthAnswer', answer: 'unknown' }),
      /prediction|forecast/,
    );
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, writes);
  }
});
