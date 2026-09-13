import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  prepareSpecialKaramaIntent,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(advanced = true, harkonnen = false) {
  let g = createGame('IXRICH', newPlayer('r', 'Richese', 'richese'), advanced, [
    'ix',
    'choam',
  ]);
  joinGame(g, newPlayer('i', 'Ixians', 'ixians'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  if (harkonnen) joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeFactionExpansionsGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 20; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((p) => p.id === view.me)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  // Focus the genuine initialized inventory on the Charity-to-Bidding transition.
  Object.assign(g, {
    phase: 2,
    ready: [],
    phaseOpening: null,
    stormPending: null,
    response: null,
    decision: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.spice = 20;
  }
  for (const [index, kind] of ['shield', 'snooper', 'projectile'].entries()) {
    const card = g.deck.findIndex((c) => c.kind === kind);
    assert.ok(card >= 0);
    g.players[index].hand.push(...g.deck.splice(card, 1));
  }
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function richese(g: Game, fields: Omit<Action, 'type'>) {
  return applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    ...fields,
  });
}
function offer(source: 'cache' | 'blackMarket', method = 'silent') {
  let g = fixture();
  if (source === 'cache') {
    g = richese(g, { decline: true });
    g = richese(g, { position: 'first' });
  }
  const card = source === 'cache' ? g.richeseCache![0] : g.players[0].hand[0];
  const before = structuredClone(g);
  g = richese(g, {
    card: card.id,
    method,
    direction: 'counterclockwise',
    claim: '  a private draft claim  ',
  });
  return { g, card, before };
}
function decline(g: Game) {
  return applyAction(reload(g), 'i', {
    type: 'decision',
    event: g.pendingIxRicheseTechnology!.event,
    decline: true,
  });
}
function stock(g: Game) {
  return {
    deck: g.deck,
    discard: g.discard,
    hands: g.players.map((p) => p.hand),
    spice: g.players.map((p) => p.spice),
    cache: g.richeseCache,
    removed: g.richeseRemoved,
    normalCount: g.richeseBidding!.normalCount,
    blackMarketSold: g.richeseBidding!.blackMarketSold,
    ixTechnologyTurn: g.ixTechnologyTurn,
  };
}
function reject(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}

for (const source of ['cache', 'blackMarket'] as const)
  void test(`${source} offer pauses before bidding or inspection and saved explicit Ixian decline preserves all custody, funds and Technology`, () => {
    for (const method of source === 'cache'
      ? ['silent', 'onceAround']
      : ['silent', 'onceAround', 'normal']) {
      const { g, card, before } = offer(source, method);
      assert.equal(g.decision?.kind, 'ixRicheseTechnology');
      assert.equal(g.decision?.player, 'i');
      assert.equal(g.response, null);
      assert.equal(g.richeseAuction, null);
      assert.equal(g.auction, null);
      assert.deepEqual(stock(g), stock(before));
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      const event = g.pendingIxRicheseTechnology!.event;
      for (const p of g.players)
        assert.deepEqual(viewGame(reload(g), p.id), viewGame(g, p.id));
      const resumed = decline(g);
      assert.equal(resumed.pendingIxRicheseTechnology, undefined);
      assert.equal(resumed.ixRicheseTechnologyEvent, undefined);
      assert.deepEqual(stock(resumed), stock(g));
      assert.equal(resumed.richeseAuction!.cardId, card.id);
      assert.equal(resumed.richeseAuction!.source, source);
      assert.equal(resumed.richeseAuction!.method, method);
      assert.equal(
        resumed.richeseClaim,
        source === 'blackMarket' ? 'a private draft claim' : null,
      );
      assert.equal(viewGame(resumed, 'a').richeseAuction!.card?.id, card.id);
      reject(resumed, 'i', { type: 'decision', event, decline: true });
    }
  });

void test('Black Market pending projections conceal card identity, terms and receipt from Ixians and Atreides before inspection', () => {
  const { g, card } = offer('blackMarket');
  for (const id of ['i', 'a']) {
    const view = viewGame(g, id),
      json = JSON.stringify(view);
    assert.equal(json.includes(card.id), false);
    assert.equal(json.includes('a private draft claim'), false);
    assert.equal('pendingIxRicheseTechnology' in view, false);
    assert.equal('ixRicheseTechnologyEvent' in view, false);
    assert.deepEqual(view.ixRicheseTechnology, {
      event: g.pendingIxRicheseTechnology!.event,
      player: 'i',
      owner: 'r',
      source: 'blackMarket',
      exchangeBlocked: view.ixRicheseTechnology!.exchangeBlocked,
    });
    assert.equal(view.richeseBidding!.offerBlocked, null);
  }
  assert.equal(JSON.stringify(g.log).includes(card.id), false);
  assert.equal(JSON.stringify(g.log).includes('a private draft claim'), false);
});

void test('decline requires the current Ixian owner and exact explicit action; exchange and stale offers remain guarded atomically', () => {
  const { g } = offer('cache'),
    event = g.pendingIxRicheseTechnology!.event;
  for (const action of [
    { type: 'decision', event },
    { type: 'decision', event, decline: false },
    { type: 'decision', event, card: g.players[1].hand[0].id },
    { type: 'decision', event, decline: true, card: 'extra' },
    { type: 'decision', event: 'expired', decline: true },
    { type: 'ready' },
  ])
    reject(g, 'i', action);
  reject(g, 'r', { type: 'decision', event, decline: true });
  reject(g, 'a', { type: 'decision', event, decline: true });
  reject(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: g.richeseCache![1].id,
    method: 'silent',
  });
  reject(g, 'a', { type: 'richeseBid', event, amount: 1 });
});

void test('saved receipt, independent marker, unique decision and exact physical offer cannot be forged or lost before view, action or normalization', () => {
  const { g } = offer('blackMarket');
  const mutations: Array<(g: Game) => void> = [
    (g) => {
      delete g.pendingIxRicheseTechnology;
    },
    (g) => {
      delete g.ixRicheseTechnologyEvent;
    },
    (g) => {
      g.decision = null;
    },
    (g) => {
      g.decision!.player = 'r';
    },
    (g) => {
      (
        g.decision as Extract<
          NonNullable<Game['decision']>,
          { kind: 'ixRicheseTechnology' }
        >
      ).event = 'stale';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.event = 'stale';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.source = 'cache';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.method = 'normal';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.claim = 'changed';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.card.name = 'changed';
    },
    (g) => {
      g.pendingIxRicheseTechnology!.round = 'stale';
    },
    (g) => {
      g.turn++;
    },
    (g) => {
      g.richeseBidding!.normalCount = 4;
    },
    (g) => {
      g.richeseBidding!.event = 'replaced';
    },
    (g) => {
      g.ixTechnologyTurn = g.turn;
    },
    (g) => {
      g.deck.push(g.players[0].hand[0]);
    },
    (g) => {
      g.deck.push(...g.players[0].hand.splice(0, 1));
    },
    (g) => {
      g.players[0].hand[0].name = 'changed physical card';
    },
    (g) => {
      g.pendingExchange = {
        response: null,
        decision: structuredClone(g.decision),
      };
    },
  ];
  for (const mutate of mutations) {
    const bad = reload(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() => viewGame(bad, 'i'));
    assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() =>
      applyAction(bad, 'i', {
        type: 'decision',
        event: g.pendingIxRicheseTechnology!.event,
        decline: true,
      }),
    );
    assert.deepEqual(bad, before);
  }
});

void test('Black Market decline does not use Technology; a later cache has a fresh choice and normal lots still offer their original exchange', () => {
  let { g } = offer('blackMarket');
  const first = g.pendingIxRicheseTechnology!.event;
  g = decline(g);
  for (const p of g.players)
    g = applyAction(g, p.id, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: 0,
    });
  assert.equal(g.decision?.kind, 'richeseDeclaration');
  g = richese(g, { position: 'first' });
  g = richese(g, { card: g.richeseCache![0].id, method: 'silent' });
  assert.equal(g.decision?.kind, 'ixRicheseTechnology');
  assert.notEqual(g.pendingIxRicheseTechnology!.event, first);
  reject(g, 'i', { type: 'decision', event: first, decline: true });
  g = decline(g);
  for (const p of g.players)
    g = applyAction(g, p.id, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: 0,
    });
  assert.equal(g.decision?.kind, 'richeseUnbid');
  g = richese(g, { keep: false });
  assert.equal(g.decision?.kind, 'ixAuction');
  const cards = g.ixAuction!.cards!;
  g = applyAction(g, 'i', {
    type: 'decision',
    card: cards[0].id,
    position: 'bottom',
  });
  assert.equal(g.decision?.kind, 'ixTechnology');
  const replacement = g.players[1].hand[0],
    taken = g.auction!.cards[g.auction!.index];
  g = applyAction(g, 'i', { type: 'decision', card: replacement.id });
  assert.equal(g.ixTechnologyTurn, g.turn);
  assert.ok(g.players[1].hand.some((c) => c.id === taken.id));
  assert.equal(g.auction!.cards[g.auction!.index].id, replacement.id);
});

void test('Basic offers and Advanced already-used Technology keep the original direct special-lot path', () => {
  for (const advanced of [false, true]) {
    let g = fixture(advanced);
    if (advanced) {
      g.ixTechnologyTurn = g.turn;
      g = richese(g, { decline: true });
    }
    g = richese(g, { position: 'first' });
    g = richese(g, { card: g.richeseCache![0].id, method: 'silent' });
    assert.ok(g.richeseAuction);
    assert.equal(g.pendingIxRicheseTechnology, undefined);
    assert.equal(viewGame(g, 'i').ixRicheseTechnology, null);
  }
});

void test('an independent Richese gift can suspend the Ixian lot choice and restore the same private commitment after a saved response', () => {
  let g = fixture();
  g.players[0].ally = 'i';
  g.players[1].ally = 'r';
  const gift = g.richeseCache!.splice(0, 1)[0];
  g.players[0].hand.push(gift);
  const karamaIndex = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  g.players[2].hand.push(...g.deck.splice(karamaIndex, 1));
  g = richese(g, { card: g.players[0].hand[0].id, method: 'silent' });
  const commitment = structuredClone(g.pendingIxRicheseTechnology);
  g = applyAction(g, 'r', { type: 'richeseGift', card: gift.id });
  assert.equal(g.decision, null);
  assert.equal(g.response?.kind, 'richeseGift');
  assert.equal(
    g.pendingRicheseGift!.resume.decision?.kind,
    'ixRicheseTechnology',
  );
  assert.deepEqual(g.pendingIxRicheseTechnology, commitment);
  for (const id of ['r', 'i', 'a'])
    assert.deepEqual(viewGame(reload(g), id), viewGame(g, id));
  g = applyAction(reload(g), 'a', { type: 'passResponse' });
  assert.equal(g.decision?.kind, 'ixRicheseTechnology');
  assert.deepEqual(g.pendingIxRicheseTechnology, commitment);
  assert.ok(g.players[1].hand.some((c) => c.id === gift.id));
  g = decline(g);
  assert.equal(g.richeseAuction!.cardId, commitment!.card.id);
  assert.equal(g.ixTechnologyTurn, undefined);
});

void test('the pending physical card cannot begin a competing gift, paid Box search, or cache acquisition response', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    let g = fixture();
    g.players[0].ally = 'i';
    g.players[1].ally = 'r';
    const karamaIndex = g.deck.findIndex((c) => c.effect === 'karama');
    const karama = g.deck.splice(karamaIndex, 1)[0];
    g.players[0].hand.push(karama);
    if (source === 'cache') {
      g = richese(g, { decline: true });
      g = richese(g, { position: 'first' });
      for (const p of g.players)
        if (g.response && !g.response.passed.includes(p.id))
          g = applyAction(g, p.id, { type: 'passResponse' });
      g = richese(g, { card: g.richeseCache![0].id, method: 'silent' });
      reject(g, 'r', {
        type: 'card',
        mode: 'special',
        card: karama.id,
        acquire: g.pendingIxRicheseTechnology!.card.id,
      });
    } else {
      const index = g.richeseCache!.findIndex(
        (c) => c.effect === 'nullentropyBox',
      );
      const card = g.richeseCache!.splice(index, 1)[0];
      g.players[0].hand.push(card);
      g.discard.push(...g.deck.splice(0, 1));
      g = richese(g, { card: card.id, method: 'silent' });
      reject(g, 'r', { type: 'richeseGift', card: card.id });
      reject(g, 'r', { type: 'card', card: card.id });
      assert.equal(
        viewGame(g, 'r').richeseGift?.cards.some((c) => c.id === card.id),
        false,
      );
    }
    assert.equal(g.response, null);
    assert.equal(g.pendingNullentropy, undefined);
    assert.equal(g.pendingRicheseGift, undefined);
    assert.equal(g.decision?.kind, 'ixRicheseTechnology');
  }
});

void test('spending the last Ixian hand card in an independent Truthtrance leaves the saved per-lot decline available', () => {
  let g = fixture();
  g.deck.push(...g.players[1].hand.splice(0));
  const index = g.deck.findIndex((c) => c.effect === 'truthtrance');
  const truth = g.deck.splice(index, 1)[0];
  g.players[1].hand.push(truth);
  g = richese(g, { card: g.players[0].hand[0].id, method: 'silent' });
  const receipt = structuredClone(g.pendingIxRicheseTechnology);
  g = applyAction(g, 'i', { type: 'card', card: truth.id });
  while (g.truthtrance?.stage === 'priority') {
    const player = g.players.find(
      (p) => !g.truthtrance!.passed.includes(p.id),
    )!;
    g = applyAction(g, player.id, { type: 'truthPass' });
  }
  g = applyAction(g, 'i', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'a',
      fact: { kind: 'hand', name: g.players[2].hand[0].name },
    },
  });
  g = applyAction(reload(g), 'a', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.players[1].hand.length, 0);
  assert.deepEqual(g.pendingIxRicheseTechnology, receipt);
  assert.equal(g.decision?.kind, 'ixRicheseTechnology');
  g = decline(g);
  assert.equal(g.richeseAuction!.cardId, receipt!.card.id);
  assert.equal(g.ixTechnologyTurn, undefined);
});

void test('Harkonnen random exchange rejects the reserved Black Market hand before RNG in live and suspended Ixian choices', (t) => {
  const g = fixture(true, true);
  const karama = g.deck.splice(
    g.deck.findIndex((c) => c.effect === 'karama'),
    1,
  )[0];
  g.players[3].hand.push(karama);
  g.players[0].hand.push(
    g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'worthless'),
      1,
    )[0],
  );
  const box = g.richeseCache!.splice(
    g.richeseCache!.findIndex((c) => c.effect === 'nullentropyBox'),
    1,
  )[0];
  g.players[1].hand.push(box);
  g.discard.push(
    g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'worthless'),
      1,
    )[0],
  );
  g.discard.push(
    g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'shield'),
      1,
    )[0],
  );
  const original = reload(g);
  const games: Game[] = [];
  for (const card of original.players[0].hand) {
    const live = richese(original, { card: card.id, method: 'silent' });
    const suspended = applyAction(live, 'i', { type: 'card', card: box.id });
    assert.equal(
      suspended.pendingNullentropy!.resume.decision?.kind,
      'ixRicheseTechnology',
    );
    assert.ok(viewGame(suspended, 'i').ixRicheseTechnology);
    games.push(live, suspended);
  }
  let cache = richese(original, { decline: true });
  cache = richese(cache, { position: 'first' });
  cache = applyAction(cache, 'h', { type: 'passResponse' });
  cache = richese(cache, { card: cache.richeseCache![0].id, method: 'silent' });
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Unexpected random selection');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw new Error('Unexpected event allocation');
  });
  for (const state of games)
    for (const amount of [1, 2]) {
      const action = {
        type: 'card',
        mode: 'special',
        card: karama.id,
        target: 'r',
        amount,
      };
      const before = structuredClone(state);
      assert.throws(
        () => prepareSpecialKaramaIntent(state, 'h', action),
        /pending Black Market Ixian choice/,
      );
      assert.throws(() => applyAction(state, 'h', action));
      assert.deepEqual(state, before);
    }
  // A cache lot reserves the separate cache card, not Richese's unrelated hand.
  assert.equal(
    prepareSpecialKaramaIntent(cache, 'h', {
      type: 'card',
      mode: 'special',
      card: karama.id,
      target: 'r',
      amount: 1,
    }).kind,
    'harkonnen',
  );
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
