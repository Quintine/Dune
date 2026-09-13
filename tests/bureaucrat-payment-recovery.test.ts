import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import {
  bureaucratPaymentGame,
  beginBureaucratAuction,
  takeBureaucratCard,
} from './bureaucrat-payment-fixture';

const clock: Rooms.RoomsClock = { now: () => 81_000, sleep: async () => {} };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const rows = (db: DatabaseSync) => ({
  rooms: db.prepare('SELECT * FROM rooms ORDER BY code').all(),
  seats: db.prepare('SELECT * FROM seats ORDER BY player_id').all(),
});
function physical(game: Game) {
  return {
    players: game.players.map(
      ({ spice: _spice, bribes: _bribes, ...player }) => player,
    ),
    deck: game.deck,
    discard: game.discard,
    skills: game.leaderSkills,
  };
}
type PaymentKind = 'bribe' | 'shipment' | 'auction' | 'cache' | 'blackMarket';
function paidAuction(
  kind: 'auction' | 'cache' | 'blackMarket',
  advanced: boolean,
): Game {
  let game = bureaucratPaymentGame({ advanced, choam: kind !== 'auction' });
  const offered =
    kind === 'blackMarket' ? takeBureaucratCard(game, 'r', 'Baliset') : null;
  game = beginBureaucratAuction(game);
  if (kind === 'auction') {
    while (game.auction!.active !== 'p')
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
    game = applyAction(game, 'p', { type: 'bid', amount: 5 });
    for (let i = 0; !game.currentAuctionSale && i < 12; i++)
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
  } else {
    if (kind === 'cache')
      game = applyAction(game, 'r', {
        type: 'decision',
        event: game.richeseBidding!.event,
        position: 'first',
      });
    game = applyAction(game, 'r', {
      type: 'decision',
      event: game.richeseBidding!.event,
      card: offered?.id ?? game.richeseCache![0].id,
      method: 'silent',
    });
    for (const id of game.richeseAuction!.order)
      game = applyAction(game, id, {
        type: 'richeseBid',
        event: game.richeseAuction!.event,
        amount: id === 'p' ? 5 : 0,
      });
  }
  return game;
}
async function fixture(
  t: test.TestContext,
  kind: PaymentKind,
  advanced = false,
) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  let game =
    kind === 'bribe' || kind === 'shipment'
      ? applyAction(
          bureaucratPaymentGame({ advanced }),
          'p',
          kind === 'bribe'
            ? { type: 'bribe', target: 'e', amount: 5 }
            : { type: 'ship', territory: 'arrakeen', sector: 10, amount: 5 },
        )
      : paidAuction(kind, advanced);
  if (game.decision?.kind === 'guildShipment')
    game = applyAction(game, game.decision.player, {
      type: 'decision',
      allow: true,
    });
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  game.version = 41;
  const code = game.code,
    event = game.decision!.event!;
  store.sqlite
    .prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
    .run(code, JSON.stringify(game), game.version, 80_000);
  const tokens = Object.fromEntries(
    game.players.map((p) => [p.id, hash('bureaucrat-test:' + p.id)]),
  );
  const auths: Record<string, Rooms.SeatAuth> = {};
  for (const p of game.players) {
    store.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run(hash(tokens[p.id]), code, p.id);
    auths[p.id] = await store.rooms.authenticate(code, tokens[p.id]);
  }
  return {
    ...store,
    code,
    event,
    initial: game,
    tokens,
    auths,
    payee:
      kind === 'shipment'
        ? 'g'
        : kind === 'cache' || kind === 'blackMarket'
          ? 'r'
          : 'e',
    kind,
  };
}
async function views(f: Awaited<ReturnType<typeof fixture>>, game: Game) {
  const before = rows(f.sqlite),
    room = f.restart();
  for (const player of game.players) {
    const auth = await room.authenticate(f.code, f.tokens[player.id]);
    const view = await room.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(game, player.id));
    assert.equal('bureaucratPayments' in view, false);
    assert.equal('bureaucratUseEvents' in view, false);
    for (const rival of view.players.filter((p) => p.id !== player.id)) {
      assert.equal(rival.hand, undefined);
      assert.equal(rival.traitors, undefined);
    }
    if (view.bureaucrat.pending)
      assert.deepEqual(
        Object.keys(view.bureaucrat.pending).sort(),
        [
          'event',
          'owner',
          'payer',
          'payee',
          'amount',
          'kind',
          'redirect',
        ].sort(),
      );
  }
  assert.deepEqual(rows(f.sqlite), before);
}

void test('saved Bureaucrat bribe and Guild choices resume once with unchanged payer cost and physical custody', async (t) => {
  for (const advanced of [false, true])
    for (const kind of ['bribe', 'shipment'] as const)
      for (const redirect of [false, true]) {
        const f = await fixture(t, kind, advanced),
          before = rows(f.sqlite),
          original = f.initial.players.find((p) => p.id === f.payee)!;
        const action = { type: 'decision', event: f.event, redirect };
        await views(f, f.initial);
        await assert.rejects(f.rooms.act(f.code, f.auths.p, 41, action));
        await assert.rejects(
          f.rooms.act(f.code, f.auths.b, 40, action),
          /table changed/,
        );
        await assert.rejects(
          f.rooms.act(f.code, f.auths.b, 41, {
            ...action,
            event: 'stale-event',
          }),
        );
        await assert.rejects(
          f.rooms.act(f.code, f.auths.b, 41, { ...action, redirect: 'yes' }),
        );
        assert.deepEqual(rows(f.sqlite), before);
        assert.equal(f.writes.length, 0);
        await f.restart().act(f.code, f.auths.b, 41, action, clock);
        const after = await f.restart().readRoom(f.code);
        assert.equal(after.version, 42);
        assert.deepEqual(physical(after), physical(f.initial));
        const recipient = after.players.find((p) => p.id === f.payee)!,
          amount = redirect ? 3 : 5;
        assert.equal(
          recipient.spice,
          original.spice + (kind === 'shipment' ? amount : 0),
        );
        assert.equal(
          recipient.bribes,
          original.bribes + (kind === 'bribe' ? amount : 0),
        );
        assert.equal(
          after.players.find((p) => p.id === 'p')!.spice,
          f.initial.players.find((p) => p.id === 'p')!.spice,
        );
        assert.equal(after.bureaucratPayments?.used.length, Number(redirect));
        assert.equal(
          after.decision?.kind,
          f.initial.bureaucratPayments!.pending!.resume.decision?.kind,
        );
        await views(f, after);
        const saved = rows(f.sqlite);
        await assert.rejects(
          f.rooms.act(f.code, f.auths.b, 41, action),
          /table changed/,
        );
        await assert.rejects(f.rooms.act(f.code, f.auths.b, 42, action));
        assert.deepEqual(rows(f.sqlite), saved);
        assert.deepEqual(
          f.writes.map((w) => w.changes),
          [1],
        );
      }
});

void test('competing Bureaucrat redirect and allowance commit one recipient share without duplicate debit', async (t) => {
  const f = await fixture(t, 'bribe');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived = 0;
  f.hooks.beforeWrite = async () => {
    arrived++;
    if (arrived === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [true, false].map((redirect) =>
      f
        .restart()
        .act(
          f.code,
          f.auths.b,
          41,
          { type: 'decision', event: f.event, redirect },
          clock,
        ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const after = await f.restart().readRoom(f.code);
  assert.equal(after.version, 42);
  const amount = after.players.find((p) => p.id === 'e')!.bribes;
  assert.ok(amount === 3 || amount === 5);
  assert.equal(after.bureaucratPayments!.used.length, amount === 3 ? 1 : 0);
  assert.deepEqual(physical(after), physical(f.initial));
  assert.equal(after.players.find((p) => p.id === 'p')!.spice, 25);
  await views(f, after);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
});

function auctionInventory(game: Game) {
  return [
    ...game.deck,
    ...game.discard,
    ...game.players.flatMap((player) => player.hand),
    ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(
      game.auction.index +
        (game.currentAuctionSale?.origin === 'normal' ? 1 : 0),
    ) ?? []),
  ]
    .map((card) => card.id)
    .sort((a, b) => a.localeCompare(b));
}

void test('saved normal, Richese cache and Black Market payments resume card custody and auction callbacks once after SQLite restart', async (t) => {
  for (const kind of ['auction', 'cache', 'blackMarket'] as const) {
    const redirect = kind !== 'blackMarket',
      f = await fixture(t, kind, kind === 'blackMarket');
    const source = f.initial.currentAuctionSale!;
    const purchased =
      kind === 'auction'
        ? f.initial.auction!.cards[f.initial.auction!.index].id
        : f.initial.richeseAuction!.cardId;
    const inventory = auctionInventory(f.initial),
      payer = f.initial.players.find((player) => player.id === 'p')!;
    assert.equal(source.winner, 'p');
    assert.equal(source.amount, 5);
    assert.equal(payer.spice, 25);
    assert.equal(payer.hand.filter((card) => card.id === purchased).length, 1);
    assert.equal(payer.hand.length, 1);
    assert.equal(
      f.initial.bureaucratPayments!.pending!.continuation.kind,
      kind === 'auction' ? 'response' : 'auction',
    );
    await views(f, f.initial);
    if (kind === 'blackMarket')
      assert.ok(!JSON.stringify(viewGame(f.initial, 'g')).includes(purchased));
    const action = { type: 'decision', event: f.event, redirect },
      before = rows(f.sqlite);
    await assert.rejects(f.rooms.act(f.code, f.auths.p, 41, action));
    assert.deepEqual(rows(f.sqlite), before);
    const restarted = f.restart(),
      auth = await restarted.authenticate(f.code, f.tokens.b);
    await restarted.act(f.code, auth, 41, action, clock);
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, 42);
    assert.equal(after.currentAuctionSale, null);
    assert.equal(after.bureaucratPayments!.pending, undefined);
    assert.deepEqual(auctionInventory(after), inventory);
    for (const initial of f.initial.players) {
      const actual = after.players.find((player) => player.id === initial.id)!;
      assert.equal(
        actual.spice,
        initial.spice + (actual.id === f.payee ? (redirect ? 3 : 5) : 0),
      );
      const { spice: _initialSpice, hand: _initialHand, ...original } = initial;
      const { spice: _actualSpice, hand: _actualHand, ...current } = actual;
      assert.deepEqual(current, original);
    }
    const winner = after.players.find((player) => player.id === 'p')!;
    assert.equal(winner.hand.length, 2);
    assert.equal(winner.hand.filter((card) => card.id === purchased).length, 1);
    assert.equal(
      after.log.filter((entry) =>
        entry.text.includes('drew one bonus treachery card'),
      ).length,
      f.initial.log.filter((entry) =>
        entry.text.includes('drew one bonus treachery card'),
      ).length + 1,
    );
    assert.equal(after.bureaucratPayments!.used.length, Number(redirect));
    if (kind === 'auction') assert.equal(after.auction!.index, 1);
    else if (kind === 'cache') {
      assert.equal(after.richeseAuction, null);
      assert.equal(after.auction!.index, 0);
    } else {
      assert.equal(after.richeseAuction, null);
      assert.equal(after.decision?.kind, 'richeseDeclaration');
    }
    await views(f, after);
    if (kind === 'blackMarket')
      assert.ok(!JSON.stringify(viewGame(after, 'g')).includes(purchased));
    const saved = rows(f.sqlite);
    await assert.rejects(
      f.restart().act(f.code, f.auths.b, 41, action),
      /table changed/,
    );
    await assert.rejects(f.restart().act(f.code, f.auths.b, 42, action));
    assert.deepEqual(rows(f.sqlite), saved);
    assert.deepEqual(
      f.writes.map((write) => write.changes),
      [1],
    );
  }
});
