import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture() {
  const g = createGame(
    'BGOPPORTUNITY',
    newPlayer('b', 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('r', 'Richese', 'richese'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    active: 'e',
    order: ['e', 'b', 'r'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
  }
  g.players[0].ally = 'r';
  g.players[1].ally = 'b';
  const hold = (
    index: number,
    predicate: (c: Game['deck'][number]) => boolean,
    cache = false,
  ) => {
    const pile = cache ? g.richeseCache! : g.deck,
      at = pile.findIndex(predicate);
    assert.ok(at >= 0);
    const card = pile.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  };
  const worthless = hold(0, (c) => c.kind === 'worthless');
  hold(0, (c) => c.name === 'Shield');
  hold(0, (c) => c.name === 'Snooper');
  const karama = hold(2, (c) => c.effect === 'karama');
  const gifts = [
    hold(1, (c) => c.effect === 'ornithopter', true),
    hold(1, (c) => c.effect === 'stoneBurner', true),
  ];
  const lot = g.deck.splice(0, 1)[0];
  g.auction = {
    cards: [lot],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'e',
    passed: [],
    opener: 0,
  };
  return { g, worthless, karama, gifts, lot };
}
function passKind(initial: Game, kind: NonNullable<Game['response']>['kind']) {
  let g = reload(initial);
  for (let tries = 0; g.response?.kind === kind; tries++) {
    assert.ok(tries < 10, 'response must terminate');
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function directPurchase() {
  const f = fixture();
  f.g = applyAction(f.g, 'e', { type: 'bid', amount: 2 });
  f.g = applyAction(f.g, 'b', {
    type: 'card',
    card: f.worthless.id,
    mode: 'purchase',
  });
  return f;
}
function gift(initial: Game, card: string) {
  return passKind(
    applyAction(reload(initial), 'r', { type: 'richeseGift', card }),
    'richeseGift',
  );
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function assertPrivate(g: Game) {
  const before = structuredClone(g);
  for (const p of g.players) {
    const v = viewGame(reload(g), p.id);
    assert.equal('pendingKarama' in v, false);
    for (const other of v.players)
      if (other.id !== p.id)
        for (const key of ['hand', 'spice', 'traitors'])
          assert.equal(key in other, false, key);
    assert.equal(JSON.stringify(v).includes('stateSignature'), false);
  }
  assert.deepEqual(g, before);
}

void test('a pending BG direct purchase reserves its incoming slot while one legal Richese gift and JSON recovery remain available', () => {
  const f = directPurchase(),
    original = reload(f.g),
    ids = inventory(f.g);
  assert.equal(f.g.auction!.bidder, 'e');
  assert.equal(f.g.players[0].hand.length, 2);
  const nested = applyAction(reload(f.g), 'r', {
    type: 'richeseGift',
    card: f.gifts[0].id,
  });
  assert.equal(nested.pendingKarama, null);
  assert.deepEqual(
    nested.pendingRicheseGift!.resume.pendingKarama,
    original.pendingKarama,
  );
  assertPrivate(nested);
  const one = passKind(reload(nested), 'richeseGift');
  assert.equal(one.players[0].hand.length, 3);
  assert.deepEqual(one.pendingKarama, original.pendingKarama);
  assert.deepEqual(one.response, original.response);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(one))), reload(one));
  const before = structuredClone(one);
  assert.throws(
    () => applyAction(one, 'r', { type: 'richeseGift', card: f.gifts[1].id }),
    /room|slot|purchase|commit/i,
  );
  assert.deepEqual(one, before);
  assertPrivate(one);
  const done = passKind(one, 'worthlessKarama');
  assert.equal(done.players[0].hand.length, 4);
  assert.equal(done.players[0].hand.filter((c) => c.id === f.lot.id).length, 1);
  assert.equal(done.players[0].spice, 20);
  assert.equal(
    done.players[1].hand.some((c) => c.id === f.gifts[1].id),
    true,
  );
  assert.deepEqual(inventory(done), ids);
});

void test('winning-bid conversion retains its original lot and capacity through a nested gift and cancellation', () => {
  const f = fixture();
  f.g.order = ['b', 'r', 'e'];
  f.g.active = 'b';
  f.g.auction!.active = 'b';
  let g = applyAction(f.g, 'b', { type: 'bid', amount: 5 });
  g = applyAction(g, 'r', { type: 'passBid' });
  g = applyAction(g, 'e', { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  g = applyAction(g, 'b', {
    type: 'decision',
    karama: true,
    card: f.worthless.id,
  });
  const pending = JSON.parse(JSON.stringify(g.pendingKarama));
  g = gift(g, f.gifts[0].id);
  assert.deepEqual(g.pendingKarama, pending);
  assert.throws(
    () => applyAction(g, 'r', { type: 'richeseGift', card: f.gifts[1].id }),
    /room|purchase|commit/i,
  );
  g = applyAction(reload(g), 'e', {
    type: 'card',
    mode: 'cancel',
    card: f.karama.id,
  });
  // Affordable spice payment becomes the only payment method and may settle
  // automatically; it must buy the same original lot exactly once.
  while (g.response) g = passKind(g, g.response.kind);
  assert.equal(g.players[0].spice, 15);
  assert.equal(g.players[0].hand.length, 4);
  assert.equal(g.players[0].hand.filter((c) => c.id === f.lot.id).length, 1);
  assert.equal(g.pendingKarama, null);
});

void test('shipment conversion permits real Distrans and Truthtrance hand changes without replacing its opportunity', () => {
  const f = fixture();
  let g = f.g;
  g.phase = 5;
  g.active = 'e';
  g.auction = null;
  g.movementRemaining = ['e', 'b', 'r'];
  g.richeseCache!.push(...g.players[1].hand);
  g.players[1].hand = [];
  function take(
    index: number,
    predicate: (c: Game['deck'][number]) => boolean,
    cache = false,
  ) {
    const pile = cache ? g.richeseCache! : g.deck,
      at = pile.findIndex(predicate);
    assert.ok(at >= 0);
    const c = pile.splice(at, 1)[0];
    g.players[index].hand.push(c);
    return c;
  }
  // Return one held card before sourcing Truthtrance so every hand remains legal.
  g.deck.push(g.players[0].hand.pop()!);
  const truth = take(0, (c) => c.effect === 'truthtrance'),
    distrans = take(1, (c) => c.effect === 'distrans', true),
    given = take(1, (c) => c.name === 'Snooper');
  g = applyAction(g, 'b', {
    type: 'card',
    card: f.worthless.id,
    mode: 'shipment',
    target: 'e',
  });
  const pending = structuredClone(g.pendingKarama),
    response = structuredClone(g.response);
  g = applyAction(reload(g), 'r', {
    type: 'card',
    card: distrans.id,
    target: 'b',
    give: given.id,
  });
  assert.deepEqual(g.pendingKarama, pending);
  assert.deepEqual(g.response, response);
  g = applyAction(g, 'b', { type: 'card', card: truth.id });
  for (const id of ['e', 'r']) g = applyAction(g, id, { type: 'truthPass' });
  g = applyAction(g, 'b', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'spice', compare: 'eq', value: 20 },
    },
  });
  assert.equal(viewGame(g, 'e').truthAnswer, 'yes');
  assert.equal(viewGame(g, 'b').truthAnswer, null);
  g = applyAction(g, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(g.pendingKarama, pending);
  assert.deepEqual(g.response, response);
  assertPrivate(g);
  g = passKind(reload(g), 'worthlessKarama');
  assert.deepEqual(g.karamaShipping, {
    player: 'e',
    owner: 'b',
    card: f.worthless.id,
  });
  assert.equal(g.players[2].shipped, false);
  assert.equal(
    g.players[0].hand.some((c) => c.id === given.id),
    true,
  );
  assert.equal(g.truthHistory!.length, 1);
});

void test('new conversion bindings reject changed auction or shipment opportunities while legacy unstamped conversion still resolves', () => {
  for (const kind of ['purchase', 'auctionPayment', 'shipment'] as const) {
    const f = fixture();
    let g = f.g;
    if (kind === 'shipment') {
      g.phase = 5;
      g.active = 'e';
      g.auction = null;
      g.movementRemaining = ['e', 'b', 'r'];
      g = applyAction(g, 'b', {
        type: 'card',
        card: f.worthless.id,
        mode: 'shipment',
        target: 'e',
      });
    } else if (kind === 'purchase') {
      g = applyAction(g, 'e', { type: 'bid', amount: 2 });
      g = applyAction(g, 'b', {
        type: 'card',
        card: f.worthless.id,
        mode: 'purchase',
      });
    } else {
      g.order = ['b', 'r', 'e'];
      g.active = 'b';
      g.auction!.active = 'b';
      g = applyAction(g, 'b', { type: 'bid', amount: 5 });
      g = applyAction(g, 'r', { type: 'passBid' });
      g = applyAction(g, 'e', { type: 'passBid' });
      g = applyAction(g, 'b', {
        type: 'decision',
        karama: true,
        card: f.worthless.id,
      });
    }
    const mutations: ((g: Game) => void)[] = [
      (s) => {
        s.response!.owner = 'e';
      },
      (s) => {
        s.response!.kind = 'guildIncome';
      },
      (s) => {
        s.response = null;
      },
      (s) => {
        s.turn++;
      },
      (s) => {
        s.phase = 7;
      },
      (s) => {
        s.pendingKarama!.owner = 'r';
      },
    ];
    if (kind === 'shipment')
      mutations.push(
        (s) => {
          s.active = 'r';
        },
        (s) => {
          s.players[2].shipped = true;
        },
        (s) => {
          s.pendingKarama!.use = {
            kind: 'shipment',
            recipient: 'r',
            card: f.worthless.id,
          };
        },
        (s) => {
          s.karamaShipping = { player: 'e', owner: 'r', card: f.karama.id };
        },
      );
    else
      mutations.push(
        (s) => {
          s.players[2].hand.push(structuredClone(s.auction!.cards[0]));
        },
        (s) => {
          s.deck.push(structuredClone(s.auction!.cards[0]));
        },
        (s) => {
          s.auction!.cards.push(structuredClone(s.auction!.cards[0]));
        },
        (s) => {
          s.auction!.index++;
        },
        (s) => {
          s.auction!.bidder = 'r';
        },
        (s) => {
          const old = s.auction!.cards[0];
          s.auction!.cards[0] = s.deck.shift()!;
          s.deck.push(old);
        },
        (s) => {
          s.pendingKarama!.use = {
            kind: kind === 'purchase' ? 'auctionPayment' : 'purchase',
          };
        },
      );
    for (const change of mutations) {
      const bad = reload(g);
      change(bad);
      const before = reload(bad);
      for (const p of bad.players) assert.throws(() => viewGame(bad, p.id));
      assert.throws(() => normalizeAutomaticGame(bad));
      assert.throws(() => applyAction(bad, 'e', { type: 'passResponse' }));
      assert.deepEqual(bad, before);
    }
    const legacy = reload(g);
    delete legacy.pendingKarama!.opportunity;
    const done = passKind(legacy, 'worthlessKarama');
    assert.equal(done.pendingKarama, null);
    if (kind === 'shipment') assert.equal(done.karamaShipping?.player, 'e');
    else
      assert.equal(
        done.players[0].hand.filter((c) => c.id === f.lot.id).length,
        1,
      );
  }
});
