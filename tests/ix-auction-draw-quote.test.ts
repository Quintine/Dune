import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { quoteIxAuctionDraw } from '../game/ix-auction-draw-quote';
function actual(advanced = true) {
  let g = createGame('IXDRAWQA', newPlayer('i', 'Ix', 'ixians'), advanced, [
    'ix',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    deck: baseDeck(),
    discard: [],
    order: ['i', 'e', 'b', 'a'],
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.traitors = [];
  }
  const hold = (id: string, pred: (c: Card) => boolean) => {
    const i = g.deck.findIndex(pred);
    assert.ok(i >= 0);
    const card = g.deck.splice(i, 1)[0];
    g.players.find((p) => p.id === id)!.hand.push(card);
    return card;
  };
  const printed = hold('e', (c) => c.effect === 'karama'),
    bg = hold('b', (c) => c.kind === 'worthless');
  for (let cycle = 0; cycle < 2; cycle++)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.response?.kind, 'ixAuction');
  assert.equal(g.ixAuction?.count, 4);
  return { g, printed, bg };
}
function quote(g: Game, canceled = true, spending?: Card) {
  return quoteIxAuctionDraw(
    {
      ...g,
      physicalCards: [
        ...g.players.flatMap((p) => p.hand),
        ...g.deck,
        ...g.discard,
        ...(g.ixAuction?.cards ?? []),
      ],
    },
    g.response!,
    canceled,
    spending,
  );
}
function allowConversion(g: Game) {
  for (let n = 0; g.response?.kind === 'worthlessKarama' && n < 12; n++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  return g;
}
void test('a pure frozen pool quote requests count or count+1 without sampling the draw or exposing any card', (t) => {
  const f = actual();
  const before = structuredClone(f.g);
  const rng = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('No draws');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No events');
  });
  assert.deepEqual(quote(f.g, true, f.printed), {
    owner: 'i',
    ordinaryCount: 4,
    drawCount: 4,
    inspection: false,
  });
  assert.deepEqual(quote(f.g, false), {
    owner: 'i',
    ordinaryCount: 4,
    drawCount: 5,
    inspection: true,
  });
  assert.deepEqual(f.g, before);
  assert.equal(rng.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
for (const form of ['printed', 'bg'] as const)
  void test(`${form} cancellation can refill an empty deck with its own spent cost and never creates an impossible pool choice`, () => {
    const f = actual();
    f.g.deck = [];
    f.g.discard = [];
    const actor = form === 'printed' ? 'e' : 'b';
    let g = applyAction(f.g, actor, {
      type: 'card',
      card: f[form].id,
      mode: 'cancel',
    });
    g = allowConversion(JSON.parse(JSON.stringify(g)) as Game);
    assert.equal(g.ixAuction, null);
    assert.notEqual(g.decision?.kind, 'ixAuction');
    assert.deepEqual(
      g.auction?.cards.map((c) => c.id),
      [f[form].id],
    );
    assert.equal(g.deck.length, 0);
    assert.equal(g.discard.length, 0);
    assert.deepEqual(viewGame(g, 'i').ixTechnology?.known, []);
    assert.equal(viewGame(g, 'i').auction?.card, null);
    assert.equal(
      g.players
        .find((p) => p.id === actor)!
        .hand.some((c) => c.id === f[form].id),
      false,
    );
  });
void test('a frozen pool count is not recomputed when an interrupted bidder hand fills or the canceler frees a slot', () => {
  const f = actual();
  const full = f.g.players[1];
  full.hand.push(...f.g.deck.splice(0, 3));
  assert.equal(full.hand.length, 4);
  assert.equal(quote(f.g, true, f.printed)?.ordinaryCount, 4);
  const expected = f.g.deck.slice(0, 4).map((c) => c.id);
  const done = applyAction(f.g, 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(done.players[1].hand.length, 3);
  assert.deepEqual(
    done.auction?.cards.map((c) => c.id),
    expected,
  );
});
void test('Basic Ix inspection preserves the same count and cancel rules', () => {
  const f = actual(false);
  const expected = f.g.deck.slice(0, 4).map((c) => c.id);
  const done = applyAction(f.g, 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.deepEqual(
    done.auction?.cards.map((c) => c.id),
    expected,
  );
  assert.equal(done.ixAuction, null);
});
for (const form of ['printed', 'bg'] as const)
  void test(`malformed ${form} pool sources reject before cost or random work`, (t) => {
    const f = actual();
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.ixAuction!.count = Number.MAX_SAFE_INTEGER;
      },
      (g) => {
        g.ixAuction!.count = 0;
      },
      (g) => {
        g.ixAuction!.cards = [g.deck[0]];
      },
      (g) => {
        g.order = ['i', 'e', 'b', 'b'];
      },
      (g) => {
        g.active = 'e';
      },
      (g) => {
        g.players[0].faction = 'guild';
      },
      (g) => {
        g.deck.push(g.deck[0]);
      },
      (g) => {
        g.discard.push(f[form]);
      },
      (g) => {
        g.players[3].hand.push(f[form]);
      },
      (g) => {
        g.deck[0].kind = 'unknown' as never;
      },
      (g) => {
        g.pendingNullentropy = {} as never;
      },
      (g) => {
        g.richeseBidding = {
          owner: 'e',
          turn: 2,
          stage: 'normal',
          event: 'x',
          position: 'last',
          normalCount: 4,
          blackMarketSold: false,
          cacheCanceled: false,
        };
      },
    ];
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('No draw');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('No event');
    });
    for (const mutate of mutations) {
      const g = structuredClone(f.g);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(() =>
        applyAction(g, form === 'printed' ? 'e' : 'b', {
          type: 'card',
          card: f[form].id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(g, before);
    }
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
void test('a damaged paid BG draw source rejects on reload without drawing or losing the saved cost', () => {
  const f = actual();
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.bg.id,
    mode: 'cancel',
  });
  const bad = JSON.parse(JSON.stringify(paid)) as Game;
  bad.deck.push(bad.deck[0]);
  const before = structuredClone(bad);
  assert.throws(() => applyAction(bad, 'e', { type: 'passResponse' }));
  assert.deepEqual(bad, before);
  assert.equal(bad.discard.filter((c) => c.id === f.bg.id).length, 1);
  const done = allowConversion(JSON.parse(JSON.stringify(paid)) as Game);
  assert.equal(done.ixAuction, null);
  assert.equal(done.auction?.cards.length, 4);
});
