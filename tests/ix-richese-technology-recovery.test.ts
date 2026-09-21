import test from 'node:test';
import assert from 'node:assert/strict';
import { botActions } from '../game/bots';
import { treacheryDeck, type Card } from '../game/cards';
import {
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const clock: Rooms.RoomsClock = {
  now: () => 22_000,
  sleep: async () => {},
};

type Store = ReturnType<typeof unitStore>;
type Source = 'cache' | 'blackMarket';

function player(g: Game, id: string) {
  return g.players.find((candidate) => candidate.id === id)!;
}

function take(g: Game, predicate: (card: Card) => boolean) {
  const index = g.deck.findIndex(predicate);
  assert.ok(index >= 0);
  return g.deck.splice(index, 1)[0];
}

function physicalCards(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((seat) => seat.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
    ...(g.ixAuction?.cards ?? []),
  ]
    .map((card) => card.id)
    .sort();
}

function storageRow(store: Store, code: string) {
  const row = store.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(code) as { state: string; version: number } | undefined;
  assert.ok(row);
  return row;
}

function snapshot(store: Store, code: string) {
  const row = storageRow(store, code);
  return { state: row.state, version: row.version };
}

function barrier() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) release();
    await wait;
  };
}

async function fixture(t: test.TestContext) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Richese seller', 'richese', true, [
    'ix',
    'choam',
  ]);
  const code = made.view.code;
  const ixJoined = await store.rooms.joinRoom(code, 'Ixian choice', 'ixians');
  const observerJoined = await store.rooms.joinRoom(
    code,
    'Outside observer',
    'emperor',
  );
  assert.ok(ixJoined.token);
  assert.ok(observerJoined.token);
  const auths = await Promise.all(
    [made.token, ixJoined.token, observerJoined.token].map((token) =>
      store.rooms.authenticate(code, token),
    ),
  );
  const [richeseAuth, ixAuth, observerAuth] = auths;
  const initial = await store.rooms.readRoom(code);
  Object.assign(initial, {
    status: 'playing',
    advanced: true,
    turn: 2,
    phase: 2,
    order: auths.map((auth) => auth.playerId),
    active: null,
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    deck: treacheryDeck(['ix', 'choam']),
    discard: [],
    richeseCache: richeseCards(),
    richeseRemoved: [],
    richeseBidding: null,
    richeseAuction: null,
    richeseFunding: {},
  });
  for (const seat of initial.players) {
    seat.hand = [];
    seat.spice = 20;
    seat.traitors = [seat.leaders[0].id];
    seat.traitorChoices = [];
  }
  const blackMarketCard = take(
    initial,
    (card) => card.effect !== 'karama' && card.kind !== 'worthless',
  );
  player(initial, richeseAuth.playerId).hand.push(blackMarketCard);
  player(initial, ixAuth.playerId).hand.push(
    take(initial, (card) => card.effect !== 'karama'),
  );
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);

  async function act(
    auth: Rooms.SeatAuth,
    action: Action,
    rooms = store.rooms,
    version?: number,
  ) {
    const currentVersion = version ?? (await rooms.readRoom(code)).version;
    return rooms.act(code, auth, currentVersion, action, clock);
  }
  for (const auth of auths) await act(auth, { type: 'ready' });
  let opened = await store.rooms.readRoom(code);
  for (const auth of auths) {
    if (!opened.phaseOpening) break;
    await act(auth, { type: 'ready' });
    opened = await store.rooms.readRoom(code);
  }
  store.writes.length = 0;
  opened = await store.restart().readRoom(code);
  assert.equal(opened.phase, 3);
  assert.equal(opened.decision?.kind, 'richeseBlackMarket');
  return {
    ...store,
    code,
    auths,
    richeseAuth,
    ixAuth,
    observerAuth,
    blackMarketCard,
    act,
  };
}

async function openIxChoice(
  f: Awaited<ReturnType<typeof fixture>>,
  source: Source,
) {
  let game = await f.rooms.readRoom(f.code);
  if (source === 'cache') {
    await f.act(f.richeseAuth, {
      type: 'decision',
      event: game.richeseBidding!.event,
      decline: true,
    });
    game = await f.rooms.readRoom(f.code);
    assert.equal(game.decision?.kind, 'richeseDeclaration');
    await f.act(f.richeseAuth, {
      type: 'decision',
      event: game.richeseBidding!.event,
      position: 'first',
    });
    game = await f.rooms.readRoom(f.code);
    while (game.response) {
      const auth = f.auths.find(
        (candidate) => !game.response!.passed.includes(candidate.playerId),
      );
      assert.ok(auth);
      await f.act(auth, { type: 'passResponse' });
      game = await f.rooms.readRoom(f.code);
    }
    assert.equal(game.decision?.kind, 'richeseCache');
  }
  const offered =
    source === 'cache' ? game.richeseCache![3] : f.blackMarketCard;
  const roundEvent = game.richeseBidding!.event;
  await f.act(f.richeseAuth, {
    type: 'decision',
    event: roundEvent,
    card: offered.id,
    method: 'onceAround',
    direction: source === 'cache' ? 'clockwise' : 'counterclockwise',
    ...(source === 'blackMarket' ? { claim: '  concealed claim  ' } : {}),
  });
  game = await f.restart().readRoom(f.code);
  assert.deepEqual(game.decision, {
    kind: 'ixRicheseTechnology',
    player: f.ixAuth.playerId,
    event: game.pendingIxRicheseTechnology!.event,
    source,
  });
  assert.equal(game.pendingIxRicheseTechnology?.round, roundEvent);
  assert.equal(game.pendingIxRicheseTechnology?.card.id, offered.id);
  assert.equal(
    game.pendingIxRicheseTechnology?.direction,
    source === 'cache' ? 'clockwise' : 'counterclockwise',
  );
  assert.equal(
    game.pendingIxRicheseTechnology?.claim,
    source === 'blackMarket' ? 'concealed claim' : null,
  );
  return { game, offered };
}

function decline(game: Game): Action {
  return {
    type: 'decision',
    event: game.pendingIxRicheseTechnology!.event,
    decline: true,
  };
}

void test('restored Ixian declines resume the exact cache and Black Market lots once without spending Technology or exposing cards', async (t) => {
  for (const source of ['cache', 'blackMarket'] as const) {
    await t.test(source, async (t) => {
      const f = await fixture(t);
      const { game: pending, offered } = await openIxChoice(f, source);
      const pendingVersion = pending.version;
      const inventory = physicalCards(pending);
      const counts = {
        deck: pending.deck.length,
        cache: pending.richeseCache?.length,
        richeseHand: player(pending, f.richeseAuth.playerId).hand.length,
        ixHand: player(pending, f.ixAuth.playerId).hand.length,
        auctionPool: pending.auction?.cards.length ?? 0,
        ixPool: pending.ixAuction?.cards.length ?? 0,
      };
      assert.equal(pending.ixTechnologyTurn, undefined);

      for (const auth of f.auths) {
        const view = await f.restart().readSeatView(f.code, auth);
        assert.deepEqual(view.ixRicheseTechnology, {
          event: pending.pendingIxRicheseTechnology!.event,
          player: f.ixAuth.playerId,
          owner: f.richeseAuth.playerId,
          source,
          exchangeBlocked:
            'Ixian exchange custody for Richese lots is not implemented. You can explicitly continue without this exchange; Technology remains available for later lots.',
        });
        assert.equal(Object.hasOwn(view, 'pendingIxRicheseTechnology'), false);
        assert.equal(Object.hasOwn(view, 'ixRicheseTechnologyEvent'), false);
        if (auth.playerId !== f.richeseAuth.playerId)
          assert.equal(JSON.stringify(view).includes(offered.id), false);
      }
      const ixView = await f.rooms.readSeatView(f.code, f.ixAuth);
      const botView = structuredClone(ixView);
      botView.players.find((seat) => seat.id === f.ixAuth.playerId)!.bot =
        'Medium';
      assert.deepEqual(botActions(botView), [decline(pending)]);

      if (source === 'blackMarket') {
        const beforeRejected = snapshot(f, f.code);
        await assert.rejects(
          f.rooms.act(
            f.code,
            f.observerAuth,
            pendingVersion,
            decline(pending),
            clock,
          ),
          /pending decision/,
        );
        for (const action of [
          {
            type: 'decision',
            event: pending.pendingIxRicheseTechnology!.event + '-stale',
            decline: true,
          },
          {
            type: 'decision',
            event: pending.pendingIxRicheseTechnology!.event,
            decline: false,
          },
          {
            ...decline(pending),
            card: pending.pendingIxRicheseTechnology!.card.id,
          },
        ])
          await assert.rejects(
            f.rooms.act(f.code, f.ixAuth, pendingVersion, action, clock),
            /Explicitly continue/,
          );
        assert.deepEqual(snapshot(f, f.code), beforeRejected);
      }

      await f.act(f.ixAuth, decline(pending), f.restart(), pendingVersion);
      const resumed = await f.restart().readRoom(f.code);
      assert.equal(resumed.version, pendingVersion + 1);
      assert.equal(resumed.pendingIxRicheseTechnology, undefined);
      assert.equal(resumed.ixRicheseTechnologyEvent, undefined);
      assert.equal(resumed.ixTechnologyTurn, undefined);
      assert.equal(resumed.richeseAuction?.source, source);
      assert.equal(resumed.richeseAuction?.cardId, offered.id);
      assert.equal(resumed.richeseAuction?.method, 'onceAround');
      assert.deepEqual(physicalCards(resumed), inventory);
      assert.deepEqual(
        {
          deck: resumed.deck.length,
          cache: resumed.richeseCache?.length,
          richeseHand: player(resumed, f.richeseAuth.playerId).hand.length,
          ixHand: player(resumed, f.ixAuth.playerId).hand.length,
          auctionPool: resumed.auction?.cards.length ?? 0,
          ixPool: resumed.ixAuction?.cards.length ?? 0,
        },
        counts,
      );
      const outside = await f.restart().readSeatView(f.code, f.observerAuth);
      if (source === 'blackMarket') {
        assert.equal(outside.richeseAuction?.card, null);
        assert.equal(outside.richeseAuction?.cardId, null);
        assert.equal(JSON.stringify(outside).includes(offered.id), false);
      }

      const saved = snapshot(f, f.code);
      await assert.rejects(
        f.rooms.act(f.code, f.ixAuth, pendingVersion, decline(pending), clock),
        /table changed/,
      );
      await assert.rejects(
        f.rooms.act(f.code, f.ixAuth, resumed.version, decline(pending), clock),
      );
      assert.deepEqual(snapshot(f, f.code), saved);
    });
  }
});

void test('forged or missing saved Ixian lot decisions fail before projection, action and normalization without writes', async (t) => {
  const f = await fixture(t);
  const { game: pending } = await openIxChoice(f, 'blackMarket');
  const genuine = structuredClone(pending);
  const corruptions: Array<(game: Game) => void> = [
    (game) => {
      game.decision = null;
    },
    (game) => {
      delete game.pendingIxRicheseTechnology;
    },
    (game) => {
      if (game.decision?.kind === 'ixRicheseTechnology')
        game.decision.event += '-forged';
    },
    (game) => {
      game.ixRicheseTechnologyEvent += '-forged';
    },
  ];

  async function rejectSaved(game: Game) {
    f.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, f.code);
    const before = snapshot(f, f.code);
    const original = structuredClone(game);
    assert.throws(() => viewGame(game, f.ixAuth.playerId), /saved Ixian/);
    assert.deepEqual(game, original);
    assert.throws(() => normalizeAutomaticGame(game), /saved Ixian/);
    assert.deepEqual(game, original);
    await assert.rejects(f.rooms.readSeatView(f.code, f.ixAuth), /saved Ixian/);
    await assert.rejects(
      f.rooms.act(f.code, f.ixAuth, game.version, decline(genuine), clock),
      /saved Ixian/,
    );
    assert.deepEqual(snapshot(f, f.code), before);
  }
  for (const corrupt of corruptions) {
    const game = structuredClone(genuine);
    corrupt(game);
    await rejectSaved(game);
  }

  // A real paid Box search holds this exact Ix decision. Duplicating the live
  // decision now exercises Ix uniqueness without fabricating a Harkonnen parent.
  const staged = structuredClone(genuine);
  const boxIndex = staged.richeseCache!.findIndex(card => card.effect === 'nullentropyBox');
  assert.ok(boxIndex >= 0);
  const box = staged.richeseCache!.splice(boxIndex, 1)[0];
  player(staged, f.observerAuth.playerId).hand.push(box);
  // Two eligible physical cards keep the paid search as a genuine private choice.
  staged.discard.push(take(staged, card => card.kind === 'worthless'),
    take(staged, card => card.kind === 'worthless'));
  assert.deepEqual(physicalCards(staged), physicalCards(genuine));
  f.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(staged), staged.version, f.code);
  await f.act(f.observerAuth, { type: 'card', card: box.id });
  const suspended = await f.restart().readRoom(f.code);
  assert.equal(suspended.decision?.kind, 'nullentropy');
  assert.equal(player(suspended, f.observerAuth.playerId).spice,
    player(staged, f.observerAuth.playerId).spice - 2);
  assert.deepEqual(suspended.pendingNullentropy!.resume.decision, genuine.decision);
  assert.deepEqual(physicalCards(suspended), physicalCards(genuine));
  assert.doesNotThrow(() => viewGame(suspended, f.ixAuth.playerId));
  const duplicated = structuredClone(suspended);
  duplicated.decision = structuredClone(genuine.decision);
  await rejectSaved(duplicated);
});

void test('concurrent authenticated declines persist one Richese lot continuation behind the room CAS', async (t) => {
  const f = await fixture(t);
  const { game: pending, offered } = await openIxChoice(f, 'blackMarket');
  const inventory = physicalCards(pending);
  f.writes.length = 0;
  f.hooks.beforeWrite = barrier();
  const attempts = await Promise.allSettled([
    f.rooms.act(f.code, f.ixAuth, pending.version, decline(pending), clock),
    f.restart().act(f.code, f.ixAuth, pending.version, decline(pending), clock),
  ]);
  delete f.hooks.beforeWrite;
  assert.equal(
    attempts.filter((attempt) => attempt.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === 'rejected').length,
    1,
  );
  assert.deepEqual(
    f.writes.map((write) => write.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const resumed = await f.restart().readRoom(f.code);
  assert.equal(resumed.version, pending.version + 1);
  assert.equal(resumed.richeseAuction?.cardId, offered.id);
  assert.equal(resumed.richeseAuction?.source, 'blackMarket');
  assert.equal(resumed.pendingIxRicheseTechnology, undefined);
  assert.equal(resumed.ixTechnologyTurn, undefined);
  assert.deepEqual(physicalCards(resumed), inventory);
  assert.equal(
    resumed.log.filter((entry) =>
      entry.text.includes('continued without exchanging this Richese lot'),
    ).length,
    1,
  );
});
