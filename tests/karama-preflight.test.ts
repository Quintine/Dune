import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { submitRicheseBid } from '../game/richese-auction';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

function hold(g: Game, id: string, form: 'printed' | 'worthless') {
  const index = g.deck.findIndex((c) =>
    form === 'printed' ? c.effect === 'karama' : c.kind === 'worthless',
  );
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}

function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}

/** Construct only the pre-Bidding scenario. The count opportunity itself is
 * generated through real all-ready and Richese declaration actions. */
function countOpportunity(position: 'first' | 'last' = 'first') {
  let g = createGame(
    'KARAMAPREFLIGHT',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    order: ['r', 'b', 'e'],
    ready: [],
    deck: baseDeck(),
    richeseCache: richeseCards(),
    richeseRemoved: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
  }
  const worthless = hold(g, 'b', 'worthless');
  const printed = hold(g, 'e', 'printed');
  const spare = hold(g, 'e', 'printed');
  const physical = inventory(g);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  assert.equal(g.decision?.kind, 'richeseDeclaration');
  assert.equal(g.richeseBidding?.normalCount, 2);
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    position,
  });
  assert.equal(g.response?.kind, 'richeseAuction');
  assert.equal(g.response.owner, 'r');
  assert.equal(g.auction, null);
  assert.deepEqual(inventory(g), physical);
  return { g, worthless, printed, spare };
}

for (const form of ['printed', 'worthless'] as const)
  for (const position of ['first', 'last'] as const)
    void test(`${form} cancellation of the real ${position} Richese count rejects before cost or conversion, without randomness`, (t) => {
      const { g, worthless, printed } = countOpportunity(position);
      const before = structuredClone(g);
      const physical = inventory(g);
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Rejected preflight must not draw randomness.');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Rejected preflight must not allocate an event.');
      });
      for (let attempt = 0; attempt < 2; attempt++)
        assert.throws(
          () =>
            applyAction(g, form === 'printed' ? 'e' : 'b', {
              type: 'card',
              card: form === 'printed' ? printed : worthless,
              mode: 'cancel',
            }),
          /canceled Richese auction count.*ruling/i,
        );
      assert.deepEqual(g, before);
      assert.deepEqual(inventory(g), physical);
      assert.equal(g.pendingKarama, undefined);
      assert.equal(g.discard.length, 0);
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });

void test('printed cancellation of a legacy BG conversion restores the original Richese count instead of executing its unsupported cancellation', () => {
  const { g: initial, worthless, printed, spare } = countOpportunity();
  const physical = inventory(initial);
  const original = structuredClone(initial.response!);
  const legacy = reload(initial);
  const bg = player(legacy, 'b');
  // Historical saves accepted this conversion before checking the eventual
  // unsupported count cancellation. Preserve its real parent and spent card;
  // do not use the newly rejected declaration to manufacture a legacy save.
  const index = bg.hand.findIndex((c) => c.id === worthless);
  legacy.discard.push(bg.hand.splice(index, 1)[0]);
  legacy.pendingKarama = {
    owner: 'b',
    use: { kind: 'cancel', response: original },
  };
  legacy.response = {
    kind: 'worthlessKarama',
    owner: 'b',
    passed: [],
    intent: 'Cancel a power used by Richese.',
  };
  const saved = reload(legacy);
  const before = structuredClone(saved);
  for (const p of saved.players)
    assert.equal(viewGame(saved, p.id).response?.kind, 'worthlessKarama');
  assert.deepEqual(reload(normalizeAutomaticGame(saved)), saved);
  let done = applyAction(saved, 'e', {
    type: 'card',
    card: printed,
    mode: 'cancel',
  });
  assert.deepEqual(saved, before);
  assert.equal(done.pendingKarama, null);
  assert.deepEqual(done.response, original);
  assert.deepEqual(done.richeseBidding, initial.richeseBidding);
  assert.equal(done.auction, null);
  assert.equal(done.discard.filter((c) => c.id === worthless).length, 1);
  assert.equal(done.discard.filter((c) => c.id === printed).length, 1);
  assert.ok(player(done, 'e').hand.some((c) => c.id === spare));
  assert.deepEqual(inventory(done), physical);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));

  // Actual passes now allow the original count once. The spare printed card
  // kept restoration observable instead of allowing automatic advancement.
  while (done.response?.kind === 'richeseAuction') {
    const next = done.players.find(
      (p) => !done.response!.passed.includes(p.id),
    );
    assert.ok(next);
    done = applyAction(done, next.id, { type: 'passResponse' });
  }
  assert.equal(done.decision?.kind, 'richeseCache');
  assert.equal(done.richeseBidding?.normalCount, 2);
  assert.equal(done.richeseBidding?.stage, 'cacheOffer');
  assert.equal(done.discard.length, 2);
  assert.deepEqual(inventory(done), physical);
});

function blackMarketOpportunity(winner: 'a' | 'b' | 'e' = 'a') {
  let g = createGame(
    'KARAMAMARKET',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    order: ['r', 'b', 'e', 'a'],
    ready: [],
    deck: baseDeck(),
    richeseCache: richeseCards(),
    richeseRemoved: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
  }
  const donor = winner === 'a' ? 'b' : 'a';
  player(g, winner).ally = donor;
  player(g, donor).ally = winner;
  const worthless = hold(g, 'b', 'worthless');
  const printed = hold(g, 'e', 'printed');
  hold(g, 'e', 'printed');
  const offered = g.deck.splice(
    g.deck.findIndex((c) => c.kind === 'projectile'),
    1,
  )[0];
  player(g, 'r').hand.push(offered);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'richeseBlackMarket');
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: offered.id,
    method: 'silent',
    direction: 'clockwise',
  });
  assert.equal(g.response?.kind, 'richeseBlackMarket');
  assert.equal(g.richeseAuction?.cardId, offered.id);
  return { g, worthless, printed, offered };
}

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} Black Market cancellation rejects an exhausted-cache saved continuation before cost`, (t) => {
    const { g: initial, worthless, printed } = blackMarketOpportunity();
    const g = reload(initial);
    // A constructed corruption boundary: a real offered Black Market retains
    // its response while its cache has been exhausted. Preserve all card IDs.
    g.richeseRemoved!.push(...g.richeseCache!);
    g.richeseCache = [];
    const before = structuredClone(g);
    const physical = inventory(g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('Preflight must not draw randomness.');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('Preflight must not allocate a declaration event.');
    });
    assert.throws(
      () =>
        applyAction(g, form === 'printed' ? 'e' : 'b', {
          type: 'card',
          card: form === 'printed' ? printed : worthless,
          mode: 'cancel',
        }),
      /exhausted Richese cache.*ruling/i,
    );
    assert.deepEqual(g, before);
    assert.deepEqual(inventory(g), physical);
    assert.equal(g.pendingKarama, undefined);
    assert.equal(g.discard.length, 0);
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });

function passKind(initial: Game, kind: NonNullable<Game['response']>['kind']) {
  let g = initial;
  while (g.response?.kind === kind) {
    const next = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(next);
    g = applyAction(g, next.id, { type: 'passResponse' });
  }
  return g;
}

function savedSoldPeek(winner: 'a' | 'b' | 'e' = 'a') {
  const f = blackMarketOpportunity(winner);
  let g = passKind(f.g, 'richeseBlackMarket');
  assert.equal(g.response?.kind, 'atreidesAuction');
  const peek = structuredClone(g.response);
  g = passKind(g, 'atreidesAuction');
  assert.equal(g.response, null);
  const donor = winner === 'a' ? 'b' : 'a';
  g = applyAction(g, donor, { type: 'pledgeAid', amount: 2 });
  // Saved-state coverage, not a claimed reachable public pause: today's final
  // bid immediately settles. Derive a coherent terminal outcome using the
  // real pure bidding reducer, retaining the earlier genuine peek control.
  // The cancellation dispatcher must safely handle or reject this snapshot.
  for (const id of g.richeseAuction!.eligible) {
    const amount = id === winner ? 5 : 0;
    g.richeseAuction = submitRicheseBid(
      g.richeseAuction!,
      { event: g.richeseAuction!.event, actor: id, amount },
      20,
    );
    g.richeseFunding![id] = {
      amount,
      allyPayment: id === winner ? 2 : 0,
      donor: id === winner ? donor : null,
    };
  }
  assert.deepEqual(g.richeseAuction!.outcome, {
    kind: 'sold',
    winner,
    amount: 5,
  });
  g.response = peek;
  g.active = g.richeseAuction!.active;
  return { ...f, g: reload(g) };
}

const invalidSettlement: [string, (g: Game) => void, RegExp][] = [
  [
    'reserved card missing from its actual source',
    (g) => {
      const owner = player(g, 'r');
      const i = owner.hand.findIndex((c) => c.id === g.richeseAuction!.cardId);
      g.deck.push(owner.hand.splice(i, 1)[0]);
    },
    /reserved auction card.*available/i,
  ],
  [
    'winning hand at capacity',
    (g) => {
      const winner = player(g, 'a');
      while (winner.hand.length < 4) winner.hand.push(g.deck.shift()!);
    },
    /winning hand.*room/i,
  ],
  [
    'missing exact funding',
    (g) => delete g.richeseFunding!.a,
    /exact funding/i,
  ],
  [
    'funding amount differs from the winning bid',
    (g) => {
      g.richeseFunding!.a.amount = 4;
    },
    /exact funding/i,
  ],
  [
    'ally split exceeds the actual pledged credit',
    (g) => {
      g.richeseFunding!.a.allyPayment = 3;
    },
    /payment.*funded/i,
  ],
  [
    'own part of the declared split is unfunded',
    (g) => {
      player(g, 'a').spice = 2;
    },
    /payment.*funded/i,
  ],
];

for (const form of ['printed', 'worthless'] as const)
  for (const [name, corrupt, error] of invalidSettlement)
    void test(`${form} Atreides peek cancellation preflights ${name} before spending`, (t) => {
      const { g, worthless, printed } = savedSoldPeek();
      corrupt(g);
      const before = structuredClone(g);
      const physical = inventory(g);
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Rejected settlement preflight must not draw.');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Rejected settlement preflight must not advance its lot.');
      });
      assert.throws(
        () =>
          applyAction(g, form === 'printed' ? 'e' : 'b', {
            type: 'card',
            card: form === 'printed' ? printed : worthless,
            mode: 'cancel',
          }),
        error,
      );
      assert.deepEqual(g, before);
      assert.deepEqual(inventory(g), physical);
      assert.equal(g.pendingKarama, undefined);
      assert.equal(g.discard.length, 0);
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} Atreides peek cancellation preserves a valid exact split and settles the original card once`, () => {
    const { g, worthless, printed, offered } = savedSoldPeek();
    const before = structuredClone(g);
    const physical = inventory(g);
    let done = applyAction(g, form === 'printed' ? 'e' : 'b', {
      type: 'card',
      card: form === 'printed' ? printed : worthless,
      mode: 'cancel',
    });
    assert.deepEqual(g, before);
    if (form === 'worthless') {
      assert.equal(done.response?.kind, 'worthlessKarama');
      assert.equal(player(done, 'a').spice, 20);
      assert.equal(done.aid.b.amount, 2);
      assert.ok(player(done, 'r').hand.some((c) => c.id === offered.id));
      done = passKind(reload(done), 'worthlessKarama');
    }
    assert.equal(player(done, 'a').spice, 17);
    assert.equal(done.aid.b.amount, 0);
    assert.equal(player(done, 'b').spice, 18);
    assert.equal(player(done, 'r').spice, 25);
    assert.equal(
      player(done, 'a').hand.filter((c) => c.id === offered.id).length,
      1,
    );
    assert.ok(!player(done, 'r').hand.some((c) => c.id === offered.id));
    assert.equal(done.decision?.kind, 'richeseDeclaration');
    assert.equal(done.richeseAuction, null);
    assert.equal(done.discard.length, 1);
    assert.deepEqual(inventory(done), physical);
    assert.deepEqual(
      reload(normalizeAutomaticGame(reload(done))),
      reload(done),
    );
  });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} winning buyer at capacity frees its own slot before the saved Atreides settlement quote`, () => {
    const winner = form === 'printed' ? 'e' : 'b';
    const { g, worthless, printed, offered } = savedSoldPeek(winner);
    // The same documented constructed sold-peek boundary, with the winning
    // buyer also paying for cancellation. Its pre-cost hand is exactly full.
    const buyer = player(g, winner);
    while (buyer.hand.length < 4) buyer.hand.push(g.deck.shift()!);
    assert.equal(buyer.hand.length, 4);
    const spent = form === 'printed' ? printed : worthless;
    const before = structuredClone(g);
    const physical = inventory(g);
    let done = applyAction(g, winner, {
      type: 'card',
      card: spent,
      mode: 'cancel',
    });
    assert.deepEqual(g, before);
    if (form === 'worthless') {
      assert.equal(done.response?.kind, 'worthlessKarama');
      assert.equal(player(done, winner).hand.length, 3);
      assert.equal(player(done, winner).spice, 20);
      assert.equal(done.aid.a.amount, 2);
      assert.ok(player(done, 'r').hand.some((c) => c.id === offered.id));
      done = passKind(reload(done), 'worthlessKarama');
    }
    assert.equal(player(done, winner).hand.length, 4);
    assert.equal(
      player(done, winner).hand.filter((c) => c.id === offered.id).length,
      1,
    );
    assert.equal(
      player(done, winner).hand.some((c) => c.id === spent),
      false,
    );
    assert.equal(done.discard.filter((c) => c.id === spent).length, 1);
    assert.equal(player(done, winner).spice, 17);
    assert.equal(player(done, 'a').spice, 18);
    assert.equal(done.aid.a.amount, 0);
    assert.equal(player(done, 'r').spice, 25);
    assert.equal(done.richeseAuction, null);
    assert.equal(done.decision?.kind, 'richeseDeclaration');
    assert.deepEqual(inventory(done), physical);
    assert.deepEqual(
      reload(normalizeAutomaticGame(reload(done))),
      reload(done),
    );
  });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} original normal-auction winner can pay from a full saved hand by freeing its Karama slot`, () => {
    const winner = form === 'printed' ? 'e' : 'b';
    let g = createGame(
      'KARAMAFULLPAY',
      newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
      true,
    );
    joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
    joinGame(g, newPlayer('g', 'Guild', 'guild'));
    Object.assign(g, {
      status: 'playing',
      phase: 3,
      turn: 2,
      order: [
        winner,
        ...g.players.map((p) => p.id).filter((id) => id !== winner),
      ],
      active: winner,
      deck: baseDeck(),
    });
    for (const p of g.players) {
      p.hand = [];
      p.spice = 20;
    }
    const card = hold(g, winner, form);
    hold(g, 'g', 'printed');
    const sold = g.deck.shift()!;
    g.auction = {
      cards: [sold],
      index: 0,
      bid: 0,
      bidder: null,
      active: winner,
      passed: [],
      opener: 0,
      peekKnown: false,
    };
    g = applyAction(g, winner, { type: 'bid', amount: 3 });
    while (!g.decision)
      g = applyAction(g, g.auction!.active, { type: 'passBid' });
    assert.equal(g.decision.kind, 'auctionPayment');
    assert.equal(g.decision.player, winner);
    assert.equal(g.auction!.bidder, winner);
    // A saved payment-stage capacity boundary; actual bidding above establishes
    // the winner. Keep card custody unique while filling the remaining slots.
    while (player(g, winner).hand.length < 4)
      player(g, winner).hand.push(g.deck.shift()!);
    const before = structuredClone(g);
    const physical = inventory(g);
    let done = applyAction(reload(g), winner, {
      type: 'decision',
      karama: true,
      card,
    });
    assert.deepEqual(g, before);
    if (form === 'worthless') {
      assert.equal(player(done, winner).hand.length, 3);
      done = passKind(reload(done), 'worthlessKarama');
    }
    assert.equal(player(done, winner).hand.length, 4);
    assert.equal(
      player(done, winner).hand.filter((c) => c.id === sold.id).length,
      1,
    );
    assert.equal(player(done, winner).spice, 20);
    assert.equal(done.discard.filter((c) => c.id === card).length, 1);
    assert.equal(done.auction, null);
    assert.deepEqual(inventory(done), physical);
    assert.deepEqual(
      reload(normalizeAutomaticGame(reload(done))),
      reload(done),
    );
  });
