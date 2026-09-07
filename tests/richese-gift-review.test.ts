import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  createRicheseAuction,
  submitRicheseBid,
} from '../game/richese-auction';
import type { FactionId } from '../game/catalog';
function fixture(other: FactionId = 'emperor') {
  const g = createGame(
    'GIFTREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Ally', 'atreides'),
    newPlayer('e', 'Other', other),
  );
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  g.active = 'a';
  g.order = ['r', 'a', 'e'];
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  for (const p of g.players) {
    p.spice = 20;
    p.hand = [];
    p.forces = {};
  }
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  const card = g.richeseCache.find((c) => c.effect === 'karama')!;
  g.richeseCache = g.richeseCache.filter((c) => c.id !== card.id);
  g.players[0].hand.push(card);
  return g;
}
function hold(g: Game, owner: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(c);
  return c.id;
}
const send = (g: Game, id: string, action: Action) =>
  applyAction(g, id, action);
const gift = (g: Game) =>
  send(g, 'r', { type: 'richeseGift', card: 'richese-karama' });
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function handIds(g: Game) {
  return g.players.map((p) => ({ id: p.id, cards: p.hand.map((c) => c.id) }));
}

void test('a changed mutual ally during a paused gift cannot replace the original recipient hand with the new ally hand', () => {
  let g = fixture();
  hold(g, 'e', 'Karama');
  hold(g, 'a', 'Shield');
  hold(g, 'e', 'Maula Pistol');
  g = gift(g);
  g.players[0].ally = 'e';
  g.players[1].ally = null;
  g.players[2].ally = 'r';
  const before = handIds(g);
  g = send(reload(g), 'e', { type: 'passResponse' });
  assert.deepEqual(handIds(g), before);
  assert.equal(g.pendingRicheseGift, null);
  assert.equal(g.response, null);
  assert.match(g.log.at(-1)!.text, /became unavailable/);
});
void test('gift allowance suspends phase opening and restores its passes plus the original response before any income', () => {
  let g = fixture('guild');
  // Preserve the paused-parent fixture, with the income producer's real phase.
  g.phase = 5;
  hold(g, 'e', 'Karama');
  const parent = {
    kind: 'guildIncome' as const,
    owner: 'e',
    amount: 3,
    passed: ['r'],
  };
  g.response = parent;
  g.phaseOpening = { passed: ['r'], initialize: false };
  g = gift(g);
  assert.equal(g.phaseOpening, null);
  assert.deepEqual(g.pendingRicheseGift!.resume.phaseOpening, {
    passed: ['r'],
    initialize: false,
  });
  g = send(reload(g), 'e', { type: 'passResponse' });
  assert.equal(g.pendingRicheseGift, null);
  assert.deepEqual(g.response, parent);
  assert.deepEqual(g.phaseOpening, { passed: ['r'], initialize: false });
  assert.equal(g.players[2].spice, 20);
  assert.deepEqual(
    g.players[1].hand.map((c) => c.id),
    ['richese-karama'],
  );
  g = send(g, 'a', { type: 'ready' });
  g = send(g, 'e', { type: 'ready' });
  assert.equal(g.phaseOpening, null);
  assert.equal(g.response?.kind, 'guildIncome');
  g = send(g, 'a', { type: 'card', mode: 'cancel', card: 'richese-karama' });
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.discard.filter((c) => c.id === 'richese-karama').length, 1);
  assert.equal(g.response, null);
});
void test('nested Worthless Karama and its counter preserve the gift reservation and then restore the earlier response', () => {
  let g = fixture('guild');
  // Preserve the paused-parent fixture, with the income producer's real phase.
  g.phase = 5;
  g.players.push(newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  g.order.push('b');
  g.players[3].spice = 20;
  const counter = hold(g, 'e', 'Karama');
  const worthless = hold(g, 'b', 'Baliset');
  const parent = {
    kind: 'guildIncome' as const,
    owner: 'e',
    amount: 3,
    passed: ['r'],
  };
  g.response = parent;
  g = gift(g);
  g = send(g, 'b', { type: 'card', mode: 'cancel', card: worthless });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  assert.equal(
    viewGame(g, 'r').responseControls!.cancelCards.includes('richese-karama'),
    false,
  );
  const before = structuredClone(g);
  assert.throws(
    () =>
      send(g, 'r', { type: 'card', mode: 'cancel', card: 'richese-karama' }),
    /reserved/,
  );
  assert.deepEqual(g, before);
  g = send(reload(g), 'e', { type: 'card', mode: 'cancel', card: counter });
  assert.equal(g.pendingRicheseGift, null);
  assert.equal(g.pendingKarama ?? null, null);
  assert.deepEqual(g.response, parent);
  assert.deepEqual(
    g.players[1].hand.map((c) => c.id),
    ['richese-karama'],
  );
  assert.equal(g.discard.filter((c) => c.id === worthless).length, 1);
  assert.equal(g.discard.filter((c) => c.id === counter).length, 1);
  g = send(g, 'a', { type: 'card', mode: 'cancel', card: 'richese-karama' });
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.response, null);
});
void test('Harkonnen cannot randomly extract a pending gift and rejection consumes no RNG or cards', (t) => {
  let g = fixture('harkonnen');
  const k = hold(g, 'e', 'Karama');
  hold(g, 'r', 'Shield');
  g = gift(g);
  const before = structuredClone(g);
  let draws = 0;
  t.mock.method(crypto, 'getRandomValues', () => {
    draws++;
    throw new Error('Unexpected RNG');
  });
  assert.throws(
    () =>
      send(g, 'e', {
        type: 'card',
        mode: 'special',
        card: k,
        target: 'r',
        amount: 1,
      }),
    /reserved Richese gift/,
  );
  assert.equal(draws, 0);
  assert.deepEqual(g, before);
});
void test('ordinary winning bids and every sealed submission preserve the recipient final slot without revealing a zero bid', () => {
  const ordinary = fixture();
  ordinary.players[1].hand = ordinary.deck.splice(0, 3);
  ordinary.auction = {
    cards: [ordinary.deck.shift()!],
    index: 0,
    bid: 2,
    bidder: 'a',
    active: 'e',
    passed: [],
    opener: 0,
  };
  const before = structuredClone(ordinary);
  assert.throws(() => gift(ordinary), /committed auction/);
  assert.deepEqual(ordinary, before);
  const offers = [];
  for (const amount of [0, 2]) {
    const g = fixture();
    g.players[1].hand = g.deck.splice(0, 3);
    const card = g.richeseCache![0];
    g.richeseAuction = createRicheseAuction({
      event: 'silent',
      cardId: card.id,
      source: 'cache',
      owner: 'r',
      method: 'silent',
      eligible: ['r', 'a', 'e'],
      order: ['r', 'a', 'e'],
      tieOrder: ['r', 'a', 'e'],
    });
    g.richeseAuction = submitRicheseBid(
      g.richeseAuction,
      { event: 'silent', actor: 'a', amount },
      20,
    );
    g.richeseFunding = { a: { amount, allyPayment: 0, donor: null } };
    assert.throws(() => gift(g), /sealed submissions/);
    offers.push(viewGame(g, 'r').richeseGift);
  }
  assert.deepEqual(offers[0], offers[1]);
});
void test('a gift can fill the eighth Harkonnen slot while its suspended bonus finishes without drawing a ninth card', () => {
  let g = fixture();
  g.players[1].faction = 'harkonnen';
  g.players[1].hand = g.deck.splice(0, 7);
  hold(g, 'e', 'Karama');
  g.auction = {
    cards: [g.players[1].hand[0], g.deck.shift()!],
    index: 0,
    bid: 1,
    bidder: 'a',
    active: 'a',
    passed: [],
    opener: 0,
  };
  g.currentAuctionSale = {
    winner: 'a',
    amount: 1,
    free: false,
    origin: 'normal',
    seller: null,
  };
  g.response = { kind: 'harkonnenBonus', owner: 'a', passed: [] };
  const deck = [...g.deck];
  g = gift(g);
  g = send(reload(g), 'e', { type: 'passResponse' });
  assert.equal(g.players[1].hand.length, 8);
  assert.equal(
    g.players[1].hand.filter((c) => c.id === 'richese-karama').length,
    1,
  );
  assert.deepEqual(g.deck, deck);
  assert.equal(g.pendingRicheseGift, null);
  assert.notEqual(g.response?.kind, 'harkonnenBonus');
  assert.match(
    g.log.map((l) => l.text).join('\n'),
    /reached its eight-card limit/,
  );
  assert.deepEqual(normalizeAutomaticGame(g), g);
});
void test('gifting a CHOAM trade proposal card leaves its final confirmation free to decline the now-impossible exchange', () => {
  let g = fixture();
  g.players[1].faction = 'choam';
  const offered = hold(g, 'a', 'Shield');
  hold(g, 'e', 'Karama');
  g.choamMarket = {
    owner: 'a',
    resume: 'phase',
    blocked: [],
    trade: { ally: 'r', offered, returned: 'richese-karama' },
  };
  g.decision = { kind: 'choamTradeConfirm', player: 'a' };
  g = gift(g);
  g = send(g, 'e', { type: 'passResponse' });
  const before = handIds(g);
  assert.equal(g.decision?.kind, 'choamTradeConfirm');
  g = send(reload(g), 'a', { type: 'decision', accept: true });
  assert.deepEqual(handIds(g), before);
  assert.equal(g.choamMarket!.trade, undefined);
  assert.equal(g.decision?.kind, 'choamMarket');
  assert.equal(g.choamTradeTurn, undefined);
});

void test('a real Harkonnen exchange reserves its target return slots while permitting gifts that still leave enough room', () => {
  for (const initialSize of [4, 3]) {
    let g = fixture('harkonnen');
    const karama = hold(g, 'e', 'Karama');
    hold(g, 'e', 'Shield');
    for (const name of ['Maula Pistol', 'Snooper', 'Lasgun', 'Baliset'].slice(
      0,
      initialSize,
    ))
      hold(g, 'a', name);
    const originalTarget = g.players[1].hand.map((c) => c.id);
    const inventory = (state: Game) =>
      [...state.players.flatMap((p) => p.hand), ...state.discard]
        .map((c) => c.id)
        .sort();
    const beforeInventory = inventory(g);
    g = send(g, 'e', {
      type: 'card',
      mode: 'special',
      card: karama,
      target: 'a',
      amount: 2,
    });
    assert.deepEqual(g.decision, {
      kind: 'handExchange',
      player: 'e',
      target: 'a',
      count: 2,
    });
    assert.equal(g.players[1].hand.length, initialSize - 2);
    const returned = g.players[2].hand
      .filter((c) => originalTarget.includes(c.id))
      .map((c) => c.id);
    assert.equal(returned.length, 2);
    const exchange = structuredClone(g.decision);
    if (initialSize === 4) {
      const before = structuredClone(g);
      assert.throws(() => gift(g), /Leave room.*committed hand exchange/);
      assert.deepEqual(g, before);
      assert.equal(
        viewGame(g, 'r').richeseGift!.cards.some(
          (c) => c.id === 'richese-karama',
        ),
        false,
      );
    } else {
      g = gift(reload(g));
      assert.equal(g.pendingRicheseGift, null);
      assert.deepEqual(g.decision, exchange);
      assert.equal(
        g.players[1].hand.some((c) => c.id === 'richese-karama'),
        true,
      );
    }
    g = send(reload(g), 'e', { type: 'decision', returnCards: returned });
    assert.equal(g.pendingExchange, null);
    assert.notEqual(g.decision?.kind, 'handExchange');
    assert.equal(g.players[1].hand.length, 4);
    assert.equal(g.players[2].hand.length, 1);
    for (const id of originalTarget)
      assert.equal(
        g.players[1].hand.some((c) => c.id === id),
        true,
      );
    assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
    assert.deepEqual(inventory(g), beforeInventory);
  }
});
