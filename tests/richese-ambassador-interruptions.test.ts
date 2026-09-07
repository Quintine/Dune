import test from 'node:test';

import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import {
  createAmbassadors,
  placeAmbassador,
  validateAmbassadors,
} from '../game/ecaz-ambassadors';

const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(copy = false, fifth = false) {
  const g = createGame('RAMBTEST', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
    'ecaz',
  ]);
  g.players.push(
    newPlayer('in', 'Entrant', 'guild'),
    newPlayer('h', 'Buyer', 'harkonnen'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'h', 'e', 'b'],
    movementRemaining: ['in', 'ec', 'h', 'e', 'b'],
    deck: baseDeck(),
    discard: [],
  });
  for (const player of g.players)
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  // No available BG reserves: competing shipment accompaniment remains gated.
  p(g, 'b').reserves = 0;
  p(g, 'b').tanks = 20;
  p(g, 'ec').ally = 'h';
  p(g, 'h').ally = 'ec';
  const hold = (id: string, match: (c: Card) => boolean) => {
    const at = g.deck.findIndex(match);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    p(g, id).hand.push(card);
    return card;
  };
  const printed = hold('ec', (c) => c.effect === 'karama');
  const second = hold('in', (c) => c.effect === 'karama');
  const worthless = hold('b', (c) => c.kind === 'worthless');
  for (let n = 0; n < 6; n++) hold('h', (c) => c.kind !== 'worthless');
  let state = createAmbassadors(() => 0.2);
  const effect = copy ? 'beneGesserit' : 'richese';
  const token = state.tokens.find((t) => t.effect === effect)!;
  state.cohort = [
    token.id,
    ...state.tokens
      .filter(
        (t) =>
          t.effect !== 'ecaz' &&
          t.id !== token.id &&
          (!copy || t.effect !== 'richese'),
      )
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const t of state.tokens) {
    t.zone =
      t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool';
    if (fifth && t.id !== token.id && state.cohort.includes(t.id))
      t.zone = 'used';
    t.location = null;
  }
  state = placeAmbassador(state, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  g.ecazAmbassadors = state;
  return {
    g,
    token: token.id,
    printed: printed.id,
    second: second.id,
    worthless: worthless.id,
  };
}
function trigger(g: Game, buyer = 'h') {
  return applyAction(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: buyer,
  });
}
function allowWindow(g: Game) {
  const kind = g.response?.kind;
  for (let n = 0; g.response?.kind === kind && g.response && n < 30; n++) {
    const actor = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  return g;
}
function allResponses(g: Game) {
  for (let n = 0; g.response && n < 10; n++) g = allowWindow(g);
  assert.equal(g.response, null);
  return g;
}
function arrival(g: Game) {
  return {
    turn: g.turn,
    phase: g.phase,
    active: g.active,
    queue: g.movementRemaining,
    forces: g.players.map((p) => ({
      id: p.id,
      forces: p.forces,
      reserves: p.reserves,
      shipped: p.shipped,
      moved: p.moved,
    })),
  };
}
import { richeseCards } from '../game/richese-cards';
function moved(g: Game) {
  p(g, 'in').forces = { 'imperial_basin:10': 1 };
  p(g, 'in').reserves = 19;
  p(g, 'in').shipped = true;
  return applyAction(g, 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
}

function holdRichese(g: Game, owner: string, effect: string) {
  g.richeseCache ??= richeseCards();
  const at = g.richeseCache.findIndex((c) => c.effect === effect);
  assert.ok(at >= 0);
  const card = g.richeseCache.splice(at, 1)[0];
  p(g, owner).hand.push(card);
  return card.id;
}
function physical(g: Game) {
  const cards = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ];
  const ids = cards.map((c) => c.id).sort();
  assert.equal(
    new Set(ids).size,
    ids.length,
    'one physical instance in all custody zones',
  );
  validateAmbassadors(g.ecazAmbassadors!);
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
    );
  return ids;
}
function assertPrivate(g: Game, owner: string, card: string) {
  const snapshot = reload(g);
  for (const viewer of g.players) {
    const v = viewGame(g, viewer.id);
    assert.equal('pendingAmbassador' in v, false);
    assert.equal('pendingKarama' in v, false);
    assert.equal('purchaseReceipt' in (v.ambassadorEntry ?? {}), false);
    assert.ok(!JSON.stringify(v.ambassadorEntry).includes(card));
    assert.ok(!JSON.stringify(v.response).includes(card));
    assert.ok(!JSON.stringify(v.log).includes(card));
    if (viewer.id !== owner)
      assert.equal(v.players.find((p) => p.id === owner)!.hand, undefined);
  }
  assert.deepEqual(reload(g), snapshot);
}
function search(g: Game, owner: string, box: string) {
  const begin = applyAction(g, owner, { type: 'card', card: box });
  assert.ok(
    begin.pendingNullentropy,
    'multiple candidates create actual paid search',
  );
  const own = viewGame(begin, owner).nullentropy!.search!;
  assert.ok(own.cards.length > 1);
  for (const viewer of begin.players.filter((p) => p.id !== owner)) {
    assert.equal(viewGame(begin, viewer.id).nullentropy?.search ?? null, null);
  }
  return {
    begin,
    choose: {
      type: 'decision',
      event: own.event,
      // Keep the spent BG activator in discard for the exact-once assertion.
      card: own.cards.find((c) => c.kind !== 'worthless')!.id,
    } as Action,
  };
}
function completed(g: Game, expected: string[], entry: Game) {
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.auction, null);
  assert.equal(g.currentAuctionSale ?? null, null);
  assert.deepEqual(arrival(g), arrival(entry));
  assert.deepEqual(physical(g), expected);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
}

void test('paid Box search restores Ambassador income before a subsequent BG cancellation', () => {
  const f = fixture(),
    box = holdRichese(f.g, 'b', 'nullentropyBox');
  f.g.discard.push(f.g.deck.shift()!, f.g.deck.shift()!);
  const expected = physical(f.g),
    entry = moved(f.g);
  let g = trigger(entry);
  const receipt = reload(g).pendingAmbassador!.purchaseReceipt!,
    buyerSpice = p(g, 'h').spice;
  const paid = search(g, 'b', box);
  assert.equal(p(paid.begin, 'b').spice, 18);
  assertPrivate(paid.begin, 'h', receipt.card);
  g = applyAction(reload(paid.begin), 'b', paid.choose);
  assert.deepEqual(g.pendingAmbassador!.purchaseReceipt, receipt);
  assert.equal(g.response?.source, 'ambassador');
  g = applyAction(g, 'b', { type: 'card', card: f.worthless, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assertPrivate(g, 'h', receipt.card);
  g = allResponses(reload(g));
  assert.equal(p(g, 'e').spice, 20);
  assert.equal(p(g, 'h').spice, buyerSpice);
  assert.equal(p(g, 'h').hand.length, 8);
  assert.equal(p(g, 'b').spice, 18);
  assert.equal(g.discard.filter((c) => c.id === box).length, 1);
  assert.equal(g.discard.filter((c) => c.id === f.worthless).length, 1);
  completed(g, expected, entry);
});

void test('paid Box nested inside BG conversion preserves the paid Ambassador source across reload', () => {
  const f = fixture(),
    box = holdRichese(f.g, 'b', 'nullentropyBox');
  f.g.discard.push(f.g.deck.shift()!, f.g.deck.shift()!);
  const expected = physical(f.g),
    entry = moved(f.g);
  let g = trigger(entry);
  const receipt = reload(g).pendingAmbassador!.purchaseReceipt!;
  g = applyAction(g, 'b', { type: 'card', card: f.worthless, mode: 'cancel' });
  const conversion = reload(g).pendingKarama;
  const paid = search(g, 'b', box);
  assertPrivate(paid.begin, 'h', receipt.card);
  assert.deepEqual(
    normalizeAutomaticGame(reload(paid.begin)),
    reload(paid.begin),
  );
  g = applyAction(reload(paid.begin), 'b', paid.choose);
  assert.deepEqual(g.pendingKarama, conversion);
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = allowWindow(reload(g));
  assert.equal(g.response?.kind, 'harkonnenBonus');
  assert.equal(g.response?.source, 'ambassador');
  g = applyAction(reload(g), 'in', {
    type: 'card',
    card: f.second,
    mode: 'cancel',
  });
  assert.equal(p(g, 'e').spice, 20);
  assert.equal(p(g, 'h').spice, 17);
  assert.equal(p(g, 'h').hand.length, 7);
  assert.ok(p(g, 'h').hand.some((c) => c.id === receipt.card));
  assert.equal(g.discard.filter((c) => c.id === box).length, 1);
  assert.equal(g.discard.filter((c) => c.id === f.worthless).length, 1);
  assert.equal(g.discard.filter((c) => c.id === f.second).length, 1);
  completed(g, expected, entry);
});

void test('Distrans can transfer the purchased card while its historical Ambassador receipt waits for income', () => {
  const f = fixture();
  // Keep six initial buyer cards, replacing one with a uniquely sourced Distrans.
  f.g.deck.push(p(f.g, 'h').hand.pop()!);
  const distrans = holdRichese(f.g, 'h', 'distrans');
  const expected = physical(f.g),
    entry = moved(f.g);
  let g = trigger(entry);
  const receipt = reload(g).pendingAmbassador!.purchaseReceipt!;
  g = applyAction(g, 'h', {
    type: 'card',
    card: distrans,
    target: 'ec',
    give: receipt.card,
  });
  assert.deepEqual(g.pendingAmbassador!.purchaseReceipt, receipt);
  assert.ok(!p(g, 'h').hand.some((c) => c.id === receipt.card));
  assert.ok(p(g, 'ec').hand.some((c) => c.id === receipt.card));
  assertPrivate(g, 'ec', receipt.card);
  g = allResponses(reload(g));
  assert.equal(p(g, 'e').spice, 23);
  assert.equal(p(g, 'h').spice, 17);
  assert.equal(p(g, 'h').hand.length, 6);
  assert.equal(g.discard.filter((c) => c.id === distrans).length, 1);
  assert.equal(
    g.players.flatMap((p) => p.hand).filter((c) => c.id === receipt.card)
      .length,
    1,
  );
  completed(g, expected, entry);
});

void test('incoming Distrans fills Harkonnen last slot during Ambassador bonus without granting a ninth card', () => {
  const f = fixture(),
    distrans = holdRichese(f.g, 'b', 'distrans');
  const expected = physical(f.g),
    entry = moved(f.g);
  let g = allowWindow(trigger(entry));
  assert.equal(g.response?.kind, 'harkonnenBonus');
  assert.equal(p(g, 'h').hand.length, 7);
  const deck = reload(g).deck;
  g = applyAction(reload(g), 'b', {
    type: 'card',
    card: distrans,
    target: 'h',
    give: f.worthless,
  });
  assert.equal(p(g, 'h').hand.length, 8);
  assert.ok(p(g, 'h').hand.some((c) => c.id === f.worthless));
  assert.deepEqual(g.deck, deck);
  assert.equal(p(g, 'e').spice, 23);
  assert.equal(p(g, 'h').spice, 17);
  assert.equal(g.discard.filter((c) => c.id === distrans).length, 1);
  completed(g, expected, entry);
});

void test('a paid BG conversion rejects a substituted same-phase Ambassador purchase receipt', () => {
  const f = fixture();
  let g = trigger(moved(f.g));
  g = applyAction(g, 'b', { type: 'card', card: f.worthless, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  const valid = reload(g);
  // A different real physical card does not belong to this already paid acquisition.
  g.pendingAmbassador!.purchaseReceipt!.card = f.printed;
  const before = reload(g);
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() => viewGame(g, 'b'));
  assert.throws(() => applyAction(g, 'in', { type: 'passResponse' }));
  assert.deepEqual(reload(g), before);
  assert.equal(g.discard.filter((c) => c.id === f.worthless).length, 1);
  assert.equal(allResponses(valid).pendingAmbassador, null);
});
