import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import {
  quoteNormalAuctionPeek,
  quoteIxTechnologyCancellation,
  IxTechnologyCancellationError,
} from '../game/ix-technology-cancellation';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function hold(g: Game, who: string, predicate: (card: Card) => boolean) {
  const index = g.deck.findIndex(predicate);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, who).hand.push(card);
  return card;
}
function passFamily(g: Game, kind: string) {
  for (let n = 0; g.response?.kind === kind && n < 12; n++) {
    const who = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(reload(g), who.id, { type: 'passResponse' });
  }
  assert.notEqual(g.response?.kind, kind);
  return g;
}
/** Exposed phase fixture followed by genuine ready, pool selection, and
 * Technology declaration actions. Every held card comes out of the deck. */
function actual(atreides = true, blockerOwner: 'i' | 'a' = 'i') {
  let g = createGame('IXTECHCANCEL', newPlayer('i', 'Ixians', 'ixians'), true, [
    'ix',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
  );
  if (atreides) g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, { hand: [], spice: 20, traitors: [p.leaders[0].id] });
  const offered = hold(g, 'i', (c) => c.kind === 'shield');
  const blocker = hold(g, blockerOwner, (c) => c.effect === 'karama');
  const printed = hold(g, 'e', (c) => c.effect === 'karama');
  const bg = hold(g, 'b', (c) => c.kind === 'worthless');
  for (let n = 0; (g.phase === 2 || g.phaseOpening) && n < 4; n++)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.response?.kind, 'ixAuction');
  g = passFamily(g, 'ixAuction');
  assert.equal(g.decision?.kind, 'ixAuction');
  g = applyAction(g, 'i', {
    type: 'decision',
    card: g.ixAuction!.cards[0].id,
    position: 'bottom',
  });
  assert.equal(g.decision?.kind, 'ixTechnology');
  const incoming = g.auction!.cards[g.auction!.index];
  g = applyAction(g, 'i', { type: 'decision', card: offered.id });
  assert.equal(g.response?.kind, 'ixTechnology');
  return { g, offered, incoming, printed, bg, blocker };
}
const quote = (g: Game) => quoteIxTechnologyCancellation(g, g.response!);
function cancel(f: ReturnType<typeof actual>, bg: boolean) {
  let g = applyAction(f.g, bg ? 'b' : 'e', {
    type: 'card',
    card: bg ? f.bg.id : f.printed.id,
    mode: 'cancel',
  });
  if (bg) {
    assert.equal(g.response?.kind, 'worthlessKarama');
    g = passFamily(g, 'worthlessKarama');
  }
  return g;
}

for (const atreides of [true, false])
  void test(`pure Technology cancellation returns the normal peek boundary with Atreides ${atreides ? 'present' : 'absent'}`, (t) => {
    const f = actual(atreides),
      before = structuredClone(f.g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('Random draw');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('UUID allocation');
    });
    const q = quote(f.g)!;
    assert.deepEqual(q, {
      kind: 'ixTechnology',
      owner: 'i',
      pendingIxTechnology: null,
      peek: {
        peekKnown: false,
        response: atreides
          ? { kind: 'atreidesAuction', owner: 'a', passed: [] }
          : null,
      },
    });
    assert.deepEqual(f.g, before);
    for (const p of f.g.players)
      Object.defineProperty(p, 'hand', {
        get() {
          throw Error('Private hand read');
        },
      });
    assert.deepEqual(quote(f.g), q);
    assert.deepEqual(quoteNormalAuctionPeek(f.g), q.peek);
    assert.equal(JSON.stringify(q).includes(f.offered.id), false);
    assert.equal(JSON.stringify(q).includes(f.incoming.id), false);
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });

for (const bg of [false, true])
  for (const atreides of [true, false])
    void test(`${bg ? 'BG' : 'printed'} denial preserves the lot and attempt with Atreides ${atreides ? 'present' : 'absent'}`, () => {
      const f = actual(atreides),
        q = quote(f.g)!;
      const beforeHand = structuredClone(player(f.g, 'i').hand);
      const done = cancel(f, bg);
      assert.deepEqual(player(done, 'i').hand, beforeHand);
      assert.deepEqual(done.auction!.cards, f.g.auction!.cards);
      assert.equal(done.auction!.index, f.g.auction!.index);
      assert.equal(done.ixTechnologyTurn, done.turn);
      assert.equal(done.pendingIxTechnology, q.pendingIxTechnology);
      assert.equal(done.auction!.peekKnown, false);
      assert.deepEqual(done.response, q.peek.response);
      assert.equal(
        done.discard.filter((c) => c.id === (bg ? f.bg.id : f.printed.id))
          .length,
        1,
      );
      assert.equal(viewGame(done, 'e').auction?.card, null);
      assert.equal(
        JSON.stringify(viewGame(done, 'e')).includes(f.offered.id),
        false,
      );
      if (atreides) {
        assert.equal(viewGame(done, 'a').auction?.card, null);
        const allowed = passFamily(done, 'atreidesAuction');
        assert.equal(viewGame(allowed, 'a').auction?.card?.id, f.incoming.id);
        assert.equal(viewGame(allowed, 'e').auction?.card, null);
      }
    });

void test('countercanceling the paid BG attempt restores the original Technology and performs one exchange only after allowance', () => {
  const f = actual(true, 'a');
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.bg.id,
    mode: 'cancel',
  });
  const restored = applyAction(reload(paid), 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(restored.response?.kind, 'ixTechnology');
  assert.deepEqual(restored.pendingIxTechnology, f.g.pendingIxTechnology);
  assert.equal(
    restored.auction!.cards[restored.auction!.index].id,
    f.incoming.id,
  );
  const done = passFamily(restored, 'ixTechnology');
  assert.equal(done.pendingIxTechnology, null);
  assert.equal(done.auction!.cards[done.auction!.index].id, f.offered.id);
  assert.equal(
    player(done, 'i').hand.some((c) => c.id === f.offered.id),
    false,
  );
  assert.equal(
    player(done, 'i').hand.filter((c) => c.id === f.incoming.id).length,
    1,
  );
  assert.equal(done.discard.filter((c) => c.id === f.bg.id).length, 1);
  assert.equal(done.discard.filter((c) => c.id === f.printed.id).length, 1);
});

for (const bg of [false, true])
  void test(`${bg ? 'BG' : 'printed'} denial allows the declared replacement to be missing and Ix's current hand to be empty`, () => {
    const f = actual();
    // Constructed post-declaration custody change, conserving both original
    // hand cards. Cancellation requires neither exchange nor current capacity.
    f.g.discard.push(...player(f.g, 'i').hand);
    player(f.g, 'i').hand = [];
    assert.ok(quote(f.g));
    const done = cancel(f, bg);
    assert.deepEqual(player(done, 'i').hand, []);
    assert.deepEqual(done.auction!.cards, f.g.auction!.cards);
    assert.equal(done.pendingIxTechnology, null);
    assert.equal(done.ixTechnologyTurn, done.turn);
  });

void test('pure shared normal peek retains Basic and non-Ix opening availability', () => {
  const f = actual();
  f.g.advanced = false;
  player(f.g, 'i').faction = 'fremen';
  assert.deepEqual(quoteNormalAuctionPeek(f.g), {
    peekKnown: false,
    response: { kind: 'atreidesAuction', owner: 'a', passed: [] },
  });
  assert.throws(() => quote(f.g), IxTechnologyCancellationError);
  assert.equal(
    quoteIxTechnologyCancellation(f.g, {
      kind: 'advisor',
      owner: 'b',
      passed: [],
    }),
    null,
  );
});

const corruptions: [string, (g: Game) => void][] = [
  [
    'owner',
    (g) => {
      g.response!.owner = 'e';
    },
  ],
  [
    'Basic declaration',
    (g) => {
      g.advanced = false;
    },
  ],
  [
    'phase',
    (g) => {
      g.phase = 4;
    },
  ],
  [
    'used turn',
    (g) => {
      g.ixTechnologyTurn = g.turn - 1;
    },
  ],
  [
    'missing declaration',
    (g) => {
      g.pendingIxTechnology = null;
    },
  ],
  [
    'empty declaration',
    (g) => {
      g.pendingIxTechnology!.card = '';
    },
  ],
  [
    'past final index',
    (g) => {
      g.auction!.index = g.auction!.cards.length;
    },
  ],
  [
    'fractional index',
    (g) => {
      g.auction!.index = 0.5;
    },
  ],
  [
    'missing current card',
    (g) => {
      g.auction!.cards[g.auction!.index] = null as unknown as Card;
    },
  ],
  [
    'empty current card identity',
    (g) => {
      g.auction!.cards[g.auction!.index].id = '';
    },
  ],
  [
    'empty order',
    (g) => {
      g.order = [];
    },
  ],
  [
    'duplicate order',
    (g) => {
      g.order.push(g.order[0]);
    },
  ],
  [
    'unseated order',
    (g) => {
      g.order[0] = 'missing';
    },
  ],
  [
    'invalid opener',
    (g) => {
      g.auction!.opener = -1;
    },
  ],
  [
    'changed opening bidder',
    (g) => {
      g.auction!.active = 'e';
    },
  ],
  [
    'changed active player',
    (g) => {
      g.active = 'e';
    },
  ],
  [
    'bid already placed',
    (g) => {
      g.auction!.bid = 1;
    },
  ],
  [
    'bidder already placed',
    (g) => {
      g.auction!.bidder = 'e';
    },
  ],
  [
    'passed bidder',
    (g) => {
      g.auction!.passed = ['e'];
    },
  ],
  [
    'funded bid',
    (g) => {
      g.auction!.allyPayment = 1;
    },
  ],
  [
    'revealed peek',
    (g) => {
      g.auction!.peekKnown = true;
    },
  ],
  [
    'Richese lot',
    (g) => {
      g.richeseAuction = {} as NonNullable<Game['richeseAuction']>;
    },
  ],
];
for (const [name, mutate] of corruptions)
  void test(`malformed ${name} rejects purely and before printed or BG card cost`, () => {
    const f = actual();
    mutate(f.g);
    const before = structuredClone(f.g);
    assert.throws(() => quote(f.g), IxTechnologyCancellationError);
    for (const bg of [false, true]) {
      assert.throws(() =>
        applyAction(f.g, bg ? 'b' : 'e', {
          type: 'card',
          card: bg ? f.bg.id : f.printed.id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(f.g, before);
      assert.equal(
        f.g.discard.some((c) => c.id === (bg ? f.bg.id : f.printed.id)),
        false,
      );
    }
  });
