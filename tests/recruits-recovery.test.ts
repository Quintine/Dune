import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { recruitsPlayAction } from '../game/recruits';
import { traitorDeck } from '../game/traitors';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { recruitsGame } from './fixture-recruits';

const clock: RoomsClock = { now: () => 73000, sleep: async () => {} };
const play: Action = { type: 'card', card: 'ecaz-recruits' };
const rows = (sqlite: DatabaseSync) => ({
  rooms: sqlite.prepare('SELECT * FROM rooms ORDER BY code').all(),
  seats: sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
});

function custody(g: Game) {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.deepEqual(
    cards.map((card) => card.id).sort(),
    [...treacheryDeck(g.expansions), ...ecazTreacheryCards()]
      .map((card) => card.id)
      .sort(),
  );
  const traitors = [
    ...(g.traitorReserve ?? []),
    ...g.players.flatMap((p) => [
      ...p.traitors,
      ...(p.faceDancers ?? []).map((card) => card.leader),
    ]),
  ];
  assert.deepEqual(traitors.sort(), traitorDeck(g.players, true).sort());
  for (const p of g.players) {
    const values = [p.reserves, p.tanks, ...Object.values(p.forces)];
    assert.ok(values.every((n) => Number.isSafeInteger(n) && n >= 0));
    assert.equal(
      values.reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites) {
      const elite = [
        p.elites.reserves,
        p.elites.tanks,
        ...Object.values(p.elites.forces),
      ];
      assert.ok(elite.every((n) => Number.isSafeInteger(n) && n >= 0));
      assert.equal(
        elite.reduce((a, b) => a + b, 0),
        3,
      );
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [location, amount] of Object.entries(p.elites.forces))
        assert.ok(amount <= (p.forces[location] ?? 0));
    }
  }
}

async function fixture(t: test.TestContext, advanced = true) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom(
    'Recruits recovery',
    'atreides',
    advanced,
    ['ix', 'choam'],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['fremen', 'tleilaxu', 'choam'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  const ids = [
    auths[0].playerId,
    auths[1].playerId,
    auths[2].playerId,
    auths[3].playerId,
  ] as const;
  // Genuine identities/setup and dealt cards; the shared fixture explicitly stages Revival and normal losses.
  const g = recruitsGame(advanced, 3, ids);
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  custody(g);
  const owner = g.players.find((p) =>
    p.hand.some((card) => card.id === 'ecaz-recruits'),
  )!.id;
  assert.equal(owner, ids[3]);
  store.sqlite
    .prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, owner };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function act(f: Fixture, player: string, action: Action) {
  const rooms = f.restart(),
    index = f.ids.indexOf(player);
  assert.ok(index >= 0);
  const auth = await rooms.authenticate(f.code, f.tokens[index]);
  const before = await rooms.readRoom(f.code);
  await rooms.act(f.code, auth, before.version, action, clock);
  const after = await rooms.readRoom(f.code);
  custody(after);
  return after;
}

async function restored(f: Fixture) {
  const g = await f.restart().readRoom(f.code),
    before = rows(f.sqlite);
  const publicRates = viewGame(g, f.owner).recruitsPreview!.rates;
  for (const [index, token] of f.tokens.entries()) {
    const rooms = f.restart(),
      auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, f.ids[index]));
    assert.deepEqual(
      view,
      viewGame(JSON.parse(JSON.stringify(g)) as Game, f.ids[index]),
    );
    assert.deepEqual(view.recruitsPreview!.rates, publicRates);
    if (auth.playerId !== f.owner)
      assert.equal(view.recruitsPreview!.play, null);
    for (const rival of view.players.filter((p) => p.id !== auth.playerId))
      for (const field of [
        'hand',
        'traitors',
        'spice',
        'prediction',
        'faceDancers',
      ])
        assert.equal(field in rival, false);
  }
  assert.deepEqual(rows(f.sqlite), before);
  custody(g);
  return g;
}

async function noWrite(
  f: Fixture,
  player: string,
  action: Action,
  version?: number,
  reason?: RegExp,
) {
  const rooms = f.restart(),
    auth = await rooms.authenticate(f.code, f.tokens[f.ids.indexOf(player)]);
  const current = await rooms.readRoom(f.code),
    before = rows(f.sqlite),
    writes = f.writes.length;
  const attempt = rooms.act(
    f.code,
    auth,
    version ?? current.version,
    action,
    clock,
  );
  if (reason) await assert.rejects(attempt, reason);
  else await assert.rejects(attempt);
  assert.deepEqual(rows(f.sqlite), before);
  assert.equal(f.writes.length, writes);
}

/** Allow only the existing revival/CHOAM/Tleilaxu continuation through authenticated room actions. */
async function settleRevival(f: Fixture) {
  for (let step = 0; step < 30; step++) {
    const g = await f.restart().readRoom(f.code);
    if (!g.pendingRevival && !g.decision && !g.response) return g;
    if (g.decision) {
      assert.ok(['choamFreeRevival', 'revivalStop'].includes(g.decision.kind));
      await act(f, g.decision.player, { type: 'decision', decline: true });
    } else if (g.response) {
      const next = g.players.find((p) => !g.response!.passed.includes(p.id));
      assert.ok(next);
      await act(f, next.id, { type: 'passResponse' });
    } else assert.fail('A pending revival needs an explicit continuation.');
  }
  assert.fail('The saved revival failed to settle.');
}

void test('Recruits restores privately and counts earlier free revivals once across later free and paid returns', async (t) => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced),
      original = await restored(f);
    const seats = rows(f.sqlite).seats,
      initialAtreides = original.players[0];
    assert.deepEqual(
      recruitsPlayAction(viewGame(original, f.owner).recruitsPreview),
      play,
    );
    await noWrite(f, f.ids[0], play, undefined, /not in your hand/);
    await noWrite(
      f,
      f.owner,
      { ...play, blocked: null },
      undefined,
      /additional mode or selection/,
    );

    await act(f, f.ids[0], { type: 'revive', amount: 2, elite: 0 });
    const priorFree = await settleRevival(f);
    assert.equal(priorFree.players[0].freeForcesRevived, 2);
    assert.equal(priorFree.players[0].revived, 2);
    assert.equal(priorFree.players[0].spice, initialAtreides.spice);
    const played = await act(f, f.owner, play);
    assert.deepEqual(played.recruits, {
      turn: 2,
      player: f.owner,
      card: 'ecaz-recruits',
    });
    assert.equal(
      played.discard.filter((card) => card.id === 'ecaz-recruits').length,
      1,
    );
    assert.equal(
      played.players
        .flatMap((p) => p.hand)
        .some((card) => card.id === 'ecaz-recruits'),
      false,
    );
    for (const p of played.players) {
      const before = priorFree.players.find(
        (candidate) => candidate.id === p.id,
      )!;
      assert.deepEqual(
        [p.spice, p.reserves, p.tanks, p.revived, p.freeForcesRevived],
        [
          before.spice,
          before.reserves,
          before.tanks,
          before.revived,
          before.freeForcesRevived,
        ],
      );
    }
    const active = await restored(f);
    assert.deepEqual(
      viewGame(active, f.owner).recruitsPreview!.rates,
      active.order.map((player) => {
        const faction = active.players.find((p) => p.id === player)!.faction;
        return {
          player,
          freeRate: faction === 'fremen' ? 6 : faction === 'choam' ? 0 : 4,
          limit: faction === 'tleilaxu' || faction === 'choam' ? 20 : 7,
        };
      }),
    );
    await noWrite(f, f.owner, play, priorFree.version);
    await noWrite(f, f.owner, play, active.version, /not in your hand/);

    await act(f, f.ids[0], { type: 'revive', amount: 2, elite: 0 });
    const four = await settleRevival(f);
    assert.equal(four.players[0].freeForcesRevived, 4);
    assert.equal(four.players[0].revived, 4);
    assert.equal(four.players[0].spice, initialAtreides.spice);
    await restored(f);
    await act(f, f.ids[0], { type: 'revive', amount: 3, elite: 0 });
    const seven = await settleRevival(f);
    assert.equal(seven.players[0].freeForcesRevived, 4);
    assert.equal(seven.players[0].revived, 7);
    assert.equal(seven.players[0].spice, initialAtreides.spice - 6);
    assert.equal(seven.players[0].tanks, initialAtreides.tanks - 7);
    assert.equal(seven.players[0].reserves, initialAtreides.reserves + 7);
    assert.equal(
      seven.discard.filter((card) => card.id === 'ecaz-recruits').length,
      1,
    );
    await noWrite(f, f.ids[0], { type: 'revive', amount: 1, elite: 0 });
    await restored(f);
    assert.deepEqual(rows(f.sqlite).seats, seats);
  }
});

void test('pending and already paid revivals reject Recruits after restart without changing the saved transaction', async (t) => {
  const f = await fixture(t);
  const pending = await act(f, f.ids[0], {
    type: 'revive',
    amount: 3,
    elite: 0,
  });
  assert.equal(pending.decision?.kind, 'choamFreeRevival');
  assert.equal(pending.pendingRevival?.cost, 2);
  await restored(f);
  assert.match(
    viewGame(pending, f.owner).recruitsPreview!.play!.blocked!,
    /transaction or priority/,
  );
  await noWrite(f, f.owner, play, undefined, /transaction or priority/);
  assert.deepEqual(
    (await f.restart().readRoom(f.code)).pendingRevival,
    pending.pendingRevival,
  );
  const paid = await settleRevival(f);
  assert.equal(paid.players[0].revived, 3);
  assert.equal(paid.players[0].freeForcesRevived, 2);
  assert.equal(paid.players[0].spice, 18);
  assert.match(
    viewGame(paid, f.owner).recruitsPreview!.play!.blocked!,
    /after a paid normal force revival/,
  );
  assert.equal(
    recruitsPlayAction(viewGame(paid, f.owner).recruitsPreview),
    null,
  );
  await noWrite(
    f,
    f.owner,
    play,
    undefined,
    /after a paid normal force revival/,
  );
  const final = await restored(f);
  assert.equal(final.recruits, undefined);
  assert.ok(final.players[3].hand.some((card) => card.id === 'ecaz-recruits'));
});

void test('competing authenticated Recruits plays commit one physical discard and one effect', async (t) => {
  const f = await fixture(t),
    before = await f.rooms.readRoom(f.code),
    seatRows = rows(f.sqlite).seats;
  let entered = 0,
    release!: () => void;
  const both = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++entered === 2) release();
    await both;
  };
  const attempts = await Promise.allSettled(
    [0, 1].map(() =>
      f.rooms.act(f.code, f.auths[3], before.version, play, clock),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(
    attempts.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.deepEqual(
    f.writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const after = await restored(f);
  assert.equal(after.version, before.version + 1);
  assert.equal(
    after.discard.filter((card) => card.id === 'ecaz-recruits').length,
    1,
  );
  assert.equal(
    after.log.filter((entry) => entry.text.includes('played Recruits.')).length,
    1,
  );
  for (const p of after.players) assert.equal(p.revived, 0);
  await noWrite(f, f.owner, play, before.version);
  await noWrite(f, f.owner, play, after.version);
  assert.deepEqual(rows(f.sqlite).seats, seatRows);
});

void test('malformed active Recruits saves fail private reads and actions without SQL writes', async (t) => {
  const f = await fixture(t),
    valid = await act(f, f.owner, play);
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.recruits!.turn++;
    },
    (g) => {
      g.players[0].freeForcesRevived = 1;
    },
    (g) => {
      g.players[0].hand.push(
        g.discard.find((card) => card.id === 'ecaz-recruits')!,
      );
    },
  ];
  for (const mutate of mutations) {
    const corrupt = JSON.parse(JSON.stringify(valid)) as Game;
    mutate(corrupt);
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(corrupt), f.code);
    const before = rows(f.sqlite),
      writes = f.writes.length;
    for (const [index, token] of f.tokens.entries()) {
      const rooms = f.restart(),
        auth = await rooms.authenticate(f.code, token);
      await assert.rejects(
        rooms.readSeatView(f.code, auth),
        /Recruits|Ecaz Treachery/,
      );
      assert.throws(
        () => viewGame(corrupt, f.ids[index]),
        /Recruits|Ecaz Treachery/,
      );
    }
    await noWrite(
      f,
      f.owner,
      { type: 'ready' },
      valid.version,
      /Recruits|Ecaz Treachery/,
    );
    await noWrite(
      f,
      f.owner,
      { type: 'setAutopilot', difficulty: 'Easy' },
      valid.version,
      /Recruits|Ecaz Treachery/,
    );
    assert.deepEqual(rows(f.sqlite), before);
    assert.equal(f.writes.length, writes);
  }
});
