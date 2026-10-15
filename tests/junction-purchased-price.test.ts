import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { junctionTransportChoice, junctionTransportActions } from '../game/junction-transport-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { createJunctionPurchasedPrice } from './fixture-junction-purchased-price';
import { createPurchasedHomeworldRate, completePurchasedHomeworldRate } from './fixture-purchased-homeworld-rate';
import { holdGuildCunningCard } from './fixture-nexus-guild-cunning';
import { createGuildBetrayalFixture, settleGuildBetrayalFixture } from './fixture-nexus-guild-betrayal';
import { settleNativeGuildRateModules } from './fixture-native-guild-rate-modules';
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
const act = (g: Game, actor: string, action: Action) => applyAction(structuredClone(g), actor, action);
function reject(g: Game, actor: string, action: Action) {
  const copy = structuredClone(g), before = structuredClone(copy);
  assert.throws(() => applyAction(copy, actor, action));
  assert.deepEqual(copy, before);
}

for (const rate of ['half', 'full'] as const) for (const order of ['cardFirst', 'offerFirst'] as const) {
  void test(`original ${order} ${rate} Junction source retains immune fee and requires explicit unused-card acceptance`, () => {
    const f = createJunctionPurchasedPrice({ rate, order }), before = f.beforeAction;
    assert.ok(f.action);
    const cost = rate === 'half' ? 2 : 3;
    assert.equal(f.quote.cost, cost);
    assert.equal(f.quote.forfeitPurchasedRate, true);
    assert.equal(f.action.forfeitPurchasedRate, true);
    assert.equal(before.junctionOffer?.rate, rate);
    const missing = { ...f.action }; delete missing.forfeitPurchasedRate;
    reject(before, f.shipper, missing);
    reject(before, f.shipper, { ...f.action, forfeitPurchasedRate: false });
    const done = act(before, f.shipper, f.action);
    assert.equal(player(done, f.shipper).spice, player(before, f.shipper).spice - cost);
    assert.equal(player(done, f.guild).spice, player(before, f.guild).spice);
    assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves - 3);
    assert.deepEqual(done.homeworlds!.custody!.visitors[f.destination][f.shipper], { normal: 3, elite: 0 });
    assert.equal(player(done, f.shipper).shipped, true);
    assert.equal(player(done, f.shipper).moved, player(before, f.shipper).moved);
    assert.ok(!done.karamaShipping);
    assert.equal(done.discard.filter(c => c.id === f.card).length, 1);
    assert.ok(!player(done, f.cardOwner).hand.some(c => c.id === f.card));
    assert.ok(!done.response);
    assert.ok(!done.decision);
    reject(done, f.shipper, f.action);
    homeworldGameIntegrity(done);
    const next = act(done, f.shipper, { type: 'endMovement' });
    assert.notEqual(next.active, f.shipper);
    assert.equal(player(next, f.shipper).spice, player(done, f.shipper).spice);
  });
}

void test('original unaffordable immune full offer preserves the purchased grant; half replacement needs its own current identity', () => {
  const f = createJunctionPurchasedPrice({ poor: true }), before = f.beforeAction;
  assert.equal(player(before, f.shipper).spice, 2);
  assert.equal(f.quote.cost, 3);
  assert.ok(!f.action);
  assert.ok(f.quote.blocked);
  const option = viewGame(before, f.shipper).junctionTransport!;
  const original: Action = { type: 'junctionShip', event: option.event, offer: option.offer!.event,
    destination: f.destination, sources: f.sources, allyPayment: 0, forfeitPurchasedRate: true };
  reject(before, f.shipper, original);
  assert.ok(player(before, f.cardOwner).hand.every(c => c.id !== f.card));
  assert.equal(before.karamaShipping?.card, f.card);
  const sponsor = viewGame(before, f.guild).junctionTransport!;
  const changed = act(before, f.guild, { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'half' });
  reject(changed, f.shipper, original);
  assert.equal(changed.karamaShipping?.card, f.card);
  const replacement = junctionTransportChoice(viewGame(changed, f.shipper), f.destination, f.sources);
  assert.equal(replacement.cost, 2);
  assert.ok(replacement.action);
  const done = act(changed, f.shipper, replacement.action);
  assert.equal(player(done, f.shipper).spice, 0);
  assert.deepEqual(done.homeworlds!.custody!.visitors[f.destination][f.shipper], { normal: 3, elite: 0 });
  assert.ok(!done.karamaShipping);
});

void test('original optional Junction offer does not force forfeiture when the recipient chooses its ordinary purchased route', () => {
  const f = createJunctionPurchasedPrice({ rate: 'full' });
  const done = completePurchasedHomeworldRate(act(f.beforeAction, f.shipper, f.original.action)).game;
  assert.equal(player(done, f.shipper).spice, player(f.beforeAction, f.shipper).spice - 2);
  assert.deepEqual(done.homeworlds!.custody!.visitors[f.destination][f.shipper], { normal: 3, elite: 0 });
  assert.equal(done.discard.filter(c => c.id === f.card).length, 1);
  assert.ok(!done.karamaShipping);
  assert.equal(player(done, f.guild).spice, player(f.beforeAction, f.guild).spice);
});

void test('a Junction quote made before actual purchased-card activation cannot silently accept the new unused-grant effect', () => {
  const f = createPurchasedHomeworldRate('world');
  let g = structuredClone(f.beforePurchase);
  const sponsor = viewGame(g, f.guild).junctionTransport!;
  g = act(g, f.guild, { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate: 'full' });
  const old = junctionTransportChoice(viewGame(g, f.shipper), f.destination, f.sources);
  assert.ok(old.action);
  assert.equal(old.cost, 3);
  g = act(g, f.ecaz, { type: 'card', mode: 'shipment', card: f.karama, target: f.shipper });
  reject(g, f.shipper, old.action);
  const current = junctionTransportChoice(viewGame(g, f.shipper), f.destination, f.sources);
  assert.ok(current.action);
  assert.equal(current.cost, 3);
  const without = { ...current.action }; delete without.forfeitPurchasedRate;
  reject(g, f.shipper, without);
  assert.equal(g.karamaShipping?.card, f.karama);
});

void test('original unused purchased price does not cancel the separate native Guild receipt on sponsored reserve arrival', () => {
  const f = createJunctionPurchasedPrice({ route: 'nativeArrival', rate: 'full' });
  assert.ok(f.action);
  assert.equal(f.quote.cost, 6);
  const done = settleNativeGuildRateModules(act(f.beforeAction, f.shipper, f.action)).game;
  assert.equal(player(done, f.shipper).spice, player(f.beforeAction, f.shipper).spice - 6);
  assert.equal(player(done, f.guild).spice, player(f.beforeAction, f.guild).spice + 6);
  assert.equal(player(done, f.shipper).forces[f.destination], 3);
  assert.ok(!done.karamaShipping);
});

void test('controlled second-card native denial does not remove immune Junction permission or change its acknowledged full tariff', () => {
  const f = createJunctionPurchasedPrice({ nativeDenied: true, route: 'arrakisReturn', rate: 'full' });
  assert.equal(viewGame(f.beforeAction, f.shipper).guildTransportCanceled, true);
  assert.equal(f.beforeAction.karamaShipping?.card, f.card);
  assert.ok(f.action);
  assert.equal(f.quote.cost, 3);
  const done = act(f.beforeAction, f.shipper, f.action);
  assert.equal(player(done, f.shipper).spice, player(f.beforeAction, f.shipper).spice - 3);
  assert.equal(player(done, f.shipper).reserves, player(f.beforeAction, f.shipper).reserves + 3);
  assert.equal(player(done, f.shipper).forces[f.origin], player(f.beforeAction, f.shipper).forces[f.origin] - 3);
  assert.ok(!done.karamaShipping);
  assert.ok(!done.response);
});

for (const use of [false, true]) {
  void test(`controlled purchased Junction acknowledgement survives deferred Betrayal ${use ? 'Use' : 'Pass'} until actual delivery`, () => {
    const f = createGuildBetrayalFixture({ source: 'junction', payer: 'holder' });
    const before = structuredClone(f.before);
    // Explicit controlled physical acquisition on the existing native invoice
    // fixture; gift, offer acceptance and both source continuations are real.
    const card = holdGuildCunningCard(before, f.guild, 'karama');
    let g = act(before, f.guild, { type: 'card', mode: 'shipment', card: card.id, target: f.shipper });
    const choice = junctionTransportChoice(viewGame(g, f.shipper), String(f.declaration.destination),
      f.declaration.sources as Record<string, { normal: number; elite: number }>, 0);
    assert.ok(choice.action);
    assert.equal(choice.cost, f.price);
    const purchased = structuredClone(g);
    g = act(g, f.shipper, choice.action);
    assert.ok(g.pendingGuildBetrayal);
    assert.equal(g.karamaShipping?.card, card.id);
    assert.equal(player(g, f.shipper).spice, player(purchased, f.shipper).spice);
    assert.deepEqual(g.homeworlds, purchased.homeworlds);
    const event = g.pendingGuildBetrayal.invoice.event;
    if (use) g = act(g, f.holder, { type: 'guildBetrayalUse', event });
    g = settleGuildBetrayalFixture(g);
    assert.ok(!g.karamaShipping);
    assert.equal(player(g, f.shipper).shipped, true);
    assert.equal(g.discard.filter(c => c.id === card.id).length, 1);
    assert.ok(!player(g, f.guild).hand.some(c => c.id === card.id));
    assert.deepEqual(player(g, f.shipper).forces, player(f.original, f.shipper).forces);
    assert.equal(player(g, f.shipper).reserves, player(f.original, f.shipper).reserves);
    assert.equal(player(g, f.shipper).spice, player(purchased, f.shipper).spice - (use ? 0 : f.price));
    assert.ok(!g.pendingGuildBetrayal);
  });
}

void test('all four original sponsored-route policies acknowledge the unused purchase and execute the immune quote once', () => {
  const f = createJunctionPurchasedPrice({ rate: 'full' });
  for (const difficulty of [0, 1, 2, 3]) {
    const view = viewGame(f.beforeAction, f.shipper);
    const action = junctionTransportActions(view, difficulty)[0];
    assert.ok(action);
    const quote = junctionTransportChoice(view, String(action.destination),
      action.sources as Record<string, { normal: number; elite: number }>, Number(action.allyPayment));
    const done = settleNativeGuildRateModules(act(f.beforeAction, f.shipper, action)).game;
    assert.equal(player(done, f.shipper).spice, player(f.beforeAction, f.shipper).spice - quote.cost);
    assert.equal(player(done, f.shipper).shipped, true);
    assert.equal(player(done, f.shipper).moved, player(f.beforeAction, f.shipper).moved);
    assert.ok(!done.karamaShipping);
    assert.equal(done.discard.filter(card => card.id === f.card).length, 1);
    if (String(action.destination).startsWith('homeworld:'))
      assert.deepEqual(done.homeworlds!.custody!.visitors[String(action.destination)][f.shipper],
        { normal: quote.amount, elite: 0 });
    else assert.equal(player(done, f.shipper).forces[String(action.destination)],
      (player(f.beforeAction, f.shipper).forces[String(action.destination)] ?? 0) + quote.amount);
  }
});
