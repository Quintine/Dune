import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { choamKullGame, kullShipmentAttempt, takeKullCard } from './fixture-choam-kull';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
const held = (g: Game, id: string, card: string) => player(g, id).hand.some(c => c.id === card);
function inventory(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? [])].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'physical inventory has no duplicate cards');
  return ids;
}
function declare(g: Game) {
  const reaction = viewGame(g, 'c').kullReaction!;
  return applyAction(reload(g), 'c', { type: 'kullDecision', event: reaction.event, source: 'printed', card: 'ix-kull-wahad' });
}
function finishKull(g: Game) {
  for (let step = 0; g.pendingKull && step < 12; step++) {
    const responder = g.players.find(p => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    g = responder ? applyAction(reload(g), responder.id, { type: 'passResponse' }) : normalizeAutomaticGame(reload(g));
  }
  assert.equal(g.pendingKull, null, 'counter response settles without re-opening the offer');
  return g;
}
function finishConversion(g: Game, kind: NonNullable<Game['response']>['kind'] = 'worthlessKarama') {
  for (let step = 0; g.response?.kind === kind && step < 12; step++) {
    const responder = g.players.find(p => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    g = responder ? applyAction(reload(g), responder.id, { type: 'passResponse' }) : normalizeAutomaticGame(reload(g));
  }
  assert.notEqual(g.response?.kind, kind);
  return g;
}
function auction(g: Game, bid: number, payment = true) {
  const lot = g.deck.shift()!;
  Object.assign(g, { phase: 3, active: 'e', movementRemaining: [],
    auction: { cards: [lot], index: 0, bid, bidder: payment ? 'e' : null,
      active: 'e', passed: [], opener: 0 },
    decision: payment ? { kind: 'auctionPayment', player: 'e' } : null });
  return lot;
}

void test('ordinary printed attempts offer neutral CHOAM timing before cost with private projected choices', () => {
  const g = choamKullGame(), absent = reload(g);
  const replacement = absent.deck.shift()!;
  absent.deck.push(...player(absent, 'c').hand);
  player(absent, 'c').hand = [replacement];
  const action = kullShipmentAttempt(g), original = action.card as string;
  const offered = applyAction(g, 'e', action), neutral = applyAction(absent, 'e', action);
  assert.deepEqual(viewGame(offered, 'e'), viewGame(neutral, 'e'));
  assert.deepEqual(viewGame(offered, 'h'), viewGame(neutral, 'h'));
  assert.equal(offered.karamaShipping, null);
  assert.ok(held(offered, 'e', original));
  assert.equal(offered.discard.some(card => card.id === original), false);
  for (const id of ['e', 'b', 'h']) {
    assert.deepEqual(viewGame(offered, id).kullReaction?.plays, []);
    assert.equal(viewGame(offered, id).kullReaction?.canDecline, false);
    assert.equal(viewGame(offered, id).response, null);
  }
  assert.deepEqual(viewGame(offered, 'c').kullReaction?.plays.map(play => [play.source, play.card.id]), [['printed', 'ix-kull-wahad']]);
  assert.deepEqual(normalizeAutomaticGame(reload(offered)), reload(offered));
  const event = offered.pendingKull!.event;
  for (const [id, bad] of [
    ['h', { type: 'kullDecision', event, decline: true }],
    ['c', { type: 'kullDecision', event: 'stale', decline: true }],
    ['c', { type: 'kullDecision', event, decline: true, card: 'ix-kull-wahad' }],
    ['e', { type: 'ready' }],
  ] as const) {
    const before = JSON.stringify(offered);
    assert.throws(() => applyAction(offered, id, bad));
    assert.equal(JSON.stringify(offered), before);
  }
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event, decline: true });
  assert.deepEqual(declined.karamaShipping, { player: 'e', owner: 'e', card: original });
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
  assert.ok(held(declined, 'c', 'ix-kull-wahad'));
  assert.throws(() => applyAction(declined, 'c', { type: 'kullDecision', event, decline: true }));
});

void test('successful Kull retains original card, spends exact cost and blocks activations only until phase expiry', () => {
  const g = choamKullGame(), cards = inventory(g), original = player(g, 'e').hand[0].id;
  const starting = g.players.map(p => p.spice);
  const result = finishKull(declare(applyAction(g, 'e', kullShipmentAttempt(g))));
  assert.equal(result.karamaShipping, null);
  assert.ok(held(result, 'e', original));
  assert.equal(result.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
  assert.deepEqual(result.players.map(p => p.spice), starting);
  assert.deepEqual(inventory(result), cards);
  assert.throws(() => applyAction(result, 'e', kullShipmentAttempt(result)), /Kull Wahad/);
  const expired = reload(result);
  expired.turn++;
  expired.karamaShipping = null;
  const retry = applyAction(expired, 'e', kullShipmentAttempt(expired));
  assert.equal(retry.pendingKull?.stage, 'offer');
  assert.ok(held(retry, 'e', original));
});

void test('different physical card counter works for the interrupted actor and cannot reuse the reserved original', () => {
  const g = choamKullGame(), original = player(g, 'e').hand[0].id;
  const counter = takeKullCard(g, player(g, 'h').hand[0].id);
  player(g, 'e').hand.push(counter);
  const cards = inventory(g);
  const window = declare(applyAction(g, 'e', kullShipmentAttempt(g)));
  assert.deepEqual(viewGame(window, 'e').responseControls?.cancelCards, [counter.id]);
  const before = JSON.stringify(window);
  assert.throws(() => applyAction(window, 'e', { type: 'card', mode: 'cancel', card: original }), /reserved/);
  assert.equal(JSON.stringify(window), before);
  const result = applyAction(reload(window), 'e', { type: 'card', mode: 'cancel', card: counter.id });
  assert.equal(result.pendingKull, null);
  assert.deepEqual(result.karamaShipping, { player: 'e', owner: 'e', card: original });
  assert.ok(held(result, 'c', 'ix-kull-wahad'));
  assert.equal(result.discard.filter(card => card.id === counter.id).length, 1);
  assert.equal(result.discard.filter(card => card.id === original).length, 1);
  assert.deepEqual(inventory(result), cards);
  assert.equal(result.choamWorthlessBlocked?.cards.includes('ix-kull-wahad'), true);
  assert.equal(viewGame(result, 'e').karamaBlocked, null);
});

void test('BG original is intercepted before conversion and retained on success; decline converts once', () => {
  const g = choamKullGame();
  g.active = 'b';
  const action = kullShipmentAttempt(g, 'b'), original = action.card as string;
  const offered = applyAction(g, 'b', action);
  assert.equal(offered.pendingKarama, null);
  assert.ok(held(offered, 'b', original));
  const result = finishKull(declare(offered));
  assert.ok(held(result, 'b', original));
  assert.equal(result.pendingKarama, null);
  assert.equal(result.karamaShipping, null);
  assert.throws(() => applyAction(result, 'b', action), /Kull Wahad/);
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
  assert.equal(declined.response?.kind, 'worthlessKarama');
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
  const completed = finishConversion(declined);
  assert.deepEqual(completed.karamaShipping, { player: 'b', owner: 'b', card: original });
  assert.equal(completed.discard.filter(card => card.id === original).length, 1);
});

void test('BG distinct substitution can counter Kull while original remains held until its one resumed commit', () => {
  const g = choamKullGame(), original = player(g, 'e').hand[0].id;
  const window = declare(applyAction(g, 'e', kullShipmentAttempt(g)));
  const bg = player(g, 'b').hand[0].id;
  const conversion = applyAction(reload(window), 'b', { type: 'card', mode: 'cancel', card: bg });
  assert.equal(conversion.response?.kind, 'worthlessKarama');
  assert.equal(conversion.pendingKull?.stage, 'counter');
  for (const id of ['c', 'e', 'b', 'h']) {
    const view = viewGame(conversion, id);
    assert.equal(view.kullCounterEvent, window.pendingKull!.event);
    assert.equal(view.kullReaction, null);
    if (id !== 'c') assert.equal(view.choamWorthless, null);
  }
  assert.ok(held(conversion, 'e', original));
  const result = finishConversion(conversion);
  assert.equal(result.pendingKull, null);
  assert.equal(viewGame(result, 'b').kullCounterEvent, null);
  assert.ok(held(result, 'c', 'ix-kull-wahad'));
  assert.equal(result.discard.filter(card => card.id === bg).length, 1);
  assert.equal(result.discard.filter(card => card.id === original).length, 1);
  assert.deepEqual(result.karamaShipping, { player: 'e', owner: 'e', card: original });
});

void test('special Emperor decline/counter commits revival once; Kull success leaves special use and resources unspent', () => {
  const g = choamKullGame();
  g.phase = 4;
  player(g, 'e').tanks = 4;
  player(g, 'e').reserves -= 4;
  const original = player(g, 'e').hand[0].id, reserves = player(g, 'e').reserves;
  const offered = applyAction(g, 'e', { type: 'card', mode: 'special', card: original, amount: 2 });
  assert.equal(player(offered, 'e').reserves, reserves);
  assert.equal(player(offered, 'e').specialKaramaUsed, undefined);
  const event = offered.pendingKull!.event;
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event, decline: true });
  assert.equal(player(declined, 'e').reserves, reserves + 2);
  assert.equal(player(declined, 'e').tanks, 2);
  assert.equal(player(declined, 'e').specialKaramaUsed, true);
  const canceled = applyAction(declare(offered), 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  assert.equal(player(canceled, 'e').reserves, reserves + 2);
  assert.equal(player(canceled, 'e').tanks, 2);
  const prevented = finishKull(declare(offered));
  assert.equal(player(prevented, 'e').reserves, reserves);
  assert.equal(player(prevented, 'e').tanks, 4);
  assert.equal(player(prevented, 'e').specialKaramaUsed, undefined);
  assert.ok(held(prevented, 'e', original));
  assert.throws(() => applyAction(prevented, 'e', { type: 'card', mode: 'special', card: original, amount: 2 }), /Kull Wahad/);
});

void test('ordinary cancellation preserves the original CHOAM Worthless parent across Kull success and counter', () => {
  const g = choamKullGame();
  const la = takeKullCard(g, 'La La La');
  player(g, 'c').hand.push(la);
  g.phase = 4;
  const parent = applyAction(g, 'c', { type: 'card', mode: 'choam', card: la.id, target: 'e' });
  const original = player(g, 'e').hand[0].id;
  const offered = applyAction(parent, 'e', { type: 'card', mode: 'cancel', card: original });
  assert.equal(viewGame(offered, 'h').response, null);
  assert.equal(offered.pendingChoamWorthless?.card, la.id);
  let success = finishKull(declare(offered));
  assert.equal(success.pendingChoamWorthless?.card, la.id);
  assert.equal(success.response?.intent, 'La La La');
  success = finishConversion(success, 'choamWorthless');
  assert.ok(held(success, 'e', original));
  assert.equal(success.revivalRules?.freeBlocked?.includes('e'), true);
  assert.equal(success.discard.filter(card => card.id === la.id).length, 1);
  const canceled = applyAction(declare(offered), 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  assert.ok(held(canceled, 'c', la.id));
  assert.equal(canceled.revivalRules?.freeBlocked?.includes('e') ?? false, false);
  assert.equal(canceled.discard.filter(card => card.id === original).length, 1);
});

void test('funded payment and free purchase resume once; unfunded overbid guard is hidden-Kull independent and immutable', () => {
  for (const payment of [true, false]) {
    const g = choamKullGame(), lot = auction(g, payment ? 2 : 0, payment), original = player(g, 'e').hand[0].id;
    const action = payment ? { type: 'decision', karama: true, card: original } : { type: 'card', mode: 'purchase', card: original };
    const offered = applyAction(g, 'e', action);
    assert.equal(held(offered, 'e', lot.id), false);
    const completed = applyAction(reload(offered), 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
    assert.ok(held(completed, 'e', lot.id));
    assert.equal(completed.discard.filter(card => card.id === original).length, 1);
    assert.equal(player(completed, 'e').spice, player(g, 'e').spice);
  }
  const g = choamKullGame();
  auction(g, player(g, 'e').spice + 1);
  const absent = reload(g);
  absent.deck.push(...player(absent, 'c').hand);
  player(absent, 'c').hand = [];
  for (const state of [g, absent]) {
    const before = JSON.stringify(state);
    assert.throws(() => applyAction(state, 'e', { type: 'decision', karama: true, card: player(state, 'e').hand[0].id }), /defers/);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.pendingKull, undefined);
  }
});

void test('invalid original and corrupted saved frame reject before public timing and without mutation', () => {
  const g = choamKullGame();
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, 'e', { type: 'card', mode: 'shipment', card: player(g, 'e').hand[0].id, target: 'h' }));
  assert.equal(JSON.stringify(g), before);
  const offered = applyAction(g, 'e', kullShipmentAttempt(g));
  const corrupt = reload(offered);
  corrupt.pendingKull!.intent = { kind: 'ordinary', use: { kind: 'shipment', recipient: 'h' } };
  const saved = JSON.stringify(corrupt);
  assert.throws(() => normalizeAutomaticGame(corrupt), /saved Kull attempt/);
  assert.throws(() => viewGame(corrupt, 'c'), /saved Kull attempt/);
  assert.throws(() => applyAction(corrupt, 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true }));
  assert.equal(JSON.stringify(corrupt), saved);
});

void test('Basic preview supports printed ordinary interception without enabling Advanced substitution or special powers', () => {
  const g = choamKullGame({ advanced: false });
  const original = player(g, 'e').hand[0].id;
  const offered = applyAction(g, 'e', kullShipmentAttempt(g));
  assert.equal(viewGame(offered, 'c').kullPreview, true);
  const result = finishKull(declare(offered));
  assert.ok(held(result, 'e', original));
  assert.equal(result.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
  const bg = reload(g);
  bg.active = 'b';
  assert.throws(() => applyAction(bg, 'b', { type: 'card', mode: 'shipment', card: player(bg, 'b').hand[0].id }));
});

void test('Harkonnen interrupted random exchange draws no RNG until decline and preserves the private return parent', t => {
  const g = choamKullGame();
  g.phase = 3;
  player(g, 'e').hand.push(takeKullCard(g, 'Shield'));
  player(g, 'h').hand.push(takeKullCard(g, 'Snooper'));
  const original = player(g, 'h').hand.find(card => card.effect === 'karama')!.id;
  let draws = 0;
  t.mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
    draws++;
    array.fill(0);
    return array;
  });
  const offered = applyAction(g, 'h', { type: 'card', mode: 'special', card: original, target: 'e', amount: 1 });
  assert.equal(draws, 0);
  assert.deepEqual(player(offered, 'e').hand, player(g, 'e').hand);
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
  assert.equal(draws, 1);
  assert.equal(declined.decision?.kind, 'handExchange');
  assert.equal(player(declined, 'h').specialKaramaUsed, true);
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
  assert.deepEqual(normalizeAutomaticGame(reload(declined)), reload(declined));
  assert.equal(draws, 1);
  assert.equal(viewGame(declined, 'e').harkonnenExchangeInspection, null);
  assert.throws(() => applyAction(declined, 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true }));
  assert.equal(draws, 1);
});

void test('Fremen special allowance is intercepted before worm appearance and canceled Kull cannot replay its card', () => {
  const g = choamKullGame({ opponents: ['fremen', 'emperor', 'harkonnen'] });
  g.phase = 1;
  const original = player(g, 'e').hand[0].id;
  const offered = applyAction(g, 'e', { type: 'card', mode: 'special', card: original, territory: 'hagga_basin' });
  assert.equal(offered.summonedWorm ?? null, null);
  assert.ok(held(offered, 'e', original));
  const prevented = finishKull(declare(offered));
  assert.equal(player(prevented, 'e').specialKaramaUsed, undefined);
  assert.equal(prevented.summonedWorm ?? null, null);
  assert.ok(held(prevented, 'e', original));
  const resumed = applyAction(declare(offered), 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  assert.equal(player(resumed, 'e').specialKaramaUsed, true);
  assert.equal(resumed.discard.filter(card => card.id === original).length, 1);
  assert.equal(resumed.pendingKull, null);
  assert.throws(() => applyAction(resumed, 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true }));
});

void test('Guild special prevention keeps the unpaid shipment parent on Kull success and stops it once on decline', () => {
  let g = choamKullGame({ opponents: ['guild', 'emperor', 'harkonnen'] });
  g.active = 'b';
  g.movementRemaining = ['b', 'e', 'h', 'c'];
  const before = { spice: player(g, 'b').spice, reserves: player(g, 'b').reserves };
  g = applyAction(g, 'b', { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 });
  assert.equal(g.decision?.kind, 'guildShipment');
  const original = player(g, 'e').hand[0].id;
  const offered = applyAction(g, 'e', { type: 'card', mode: 'special', card: original });
  assert.deepEqual({ spice: player(offered, 'b').spice, reserves: player(offered, 'b').reserves }, before);
  assert.equal(viewGame(offered, 'b').decision, null);
  const prevented = finishKull(declare(offered));
  assert.equal(prevented.decision?.kind, 'guildShipment');
  assert.equal(prevented.pendingShipment?.player, 'b');
  assert.equal(player(prevented, 'e').specialKaramaUsed, undefined);
  assert.deepEqual({ spice: player(prevented, 'b').spice, reserves: player(prevented, 'b').reserves }, before);
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
  assert.equal(declined.pendingShipment, null);
  assert.equal(player(declined, 'b').shipped, true);
  assert.equal(player(declined, 'e').specialKaramaUsed, true);
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
  assert.deepEqual({ spice: player(declined, 'b').spice, reserves: player(declined, 'b').reserves }, before);
});

void test('Atreides special prescience retains its pre-plan offer until the intercepted card is allowed', () => {
  let g = choamKullGame({ opponents: ['atreides', 'emperor', 'harkonnen'] });
  g.phase = 6;
  g.active = 'e';
  for (const p of g.players) { p.forces = {}; p.reserves = 20; }
  for (const id of ['e', 'b']) { player(g, id).forces = { 'arrakeen:10': 2 }; player(g, id).reserves = 18; }
  g = applyAction(g, 'e', { type: 'chooseBattle', territory: 'arrakeen', target: 'b' });
  for (let step = 0; (g.response || g.battle?.preparation) && step < 20; step++) {
    if (g.response) {
      const responder = g.players.find(p => {
        const controls = viewGame(g, p.id).responseControls;
        return controls && !controls.hasPassed && controls.cancelCards.length > 0;
      });
      g = responder ? applyAction(g, responder.id, { type: 'passResponse' }) : normalizeAutomaticGame(g);
    } else g = applyAction(g, g.battle!.preparation!.owner, { type: 'declineBattlePower' });
  }
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  const original = player(g, 'e').hand[0].id;
  const offered = applyAction(g, 'e', { type: 'card', mode: 'special', card: original, target: 'b' });
  assert.equal(offered.battle?.fullPlan ?? null, null);
  const prevented = finishKull(declare(offered));
  assert.equal(prevented.decision?.kind, 'fullPlanOffer');
  assert.equal(player(prevented, 'e').specialKaramaUsed, undefined);
  assert.ok(held(prevented, 'e', original));
  const declined = applyAction(reload(offered), 'c', { type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
  assert.deepEqual(declined.battle?.fullPlan, { owner: 'e', target: 'b' });
  assert.equal(player(declined, 'e').specialKaramaUsed, true);
  assert.equal(declined.discard.filter(card => card.id === original).length, 1);
});

void test('a canceled BG counter does not release the original card or prematurely apply the ban', () => {
  const g = choamKullGame(), original = player(g, 'e').hand[0].id;
  const window = declare(applyAction(g, 'e', kullShipmentAttempt(g)));
  const bg = player(g, 'b').hand[0].id;
  const conversion = applyAction(window, 'b', { type: 'card', mode: 'cancel', card: bg });
  const result = applyAction(reload(conversion), 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  assert.equal(result.pendingKull, null);
  assert.ok(held(result, 'e', original));
  assert.equal(result.karamaShipping, null);
  assert.equal(result.discard.filter(card => card.id === bg).length, 1);
  assert.equal(result.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
  assert.equal(viewGame(result, 'e').karamaBlocked !== null, true);
});

void test('nonopted games keep native Karama execution and no Kull opportunity', () => {
  const g = choamKullGame();
  delete g.kullPreview;
  const original = player(g, 'e').hand[0].id;
  const result = applyAction(g, 'e', kullShipmentAttempt(g));
  assert.deepEqual(result.karamaShipping, { player: 'e', owner: 'e', card: original });
  assert.equal(result.discard.filter(card => card.id === original).length, 1);
  assert.equal(result.pendingKull, undefined);
  assert.equal(viewGame(result, 'c').kullReaction, null);
  assert.equal(viewGame(result, 'c').kullPreview, false);
});

void test('unproven live Truthtrance cancellation rejects privately before Kull cost or offer', () => {
  let g = choamKullGame({ opponents: ['atreides', 'beneGesserit', 'harkonnen'] });
  g.phase = 6;
  g.active = 'e';
  for (const p of g.players) { p.forces = {}; p.reserves = 20; p.advisors = {}; }
  for (const id of ['e', 'b']) { player(g, id).forces = { 'arrakeen:10': 2 }; player(g, id).reserves = 18; }
  g = applyAction(g, 'e', { type: 'chooseBattle', territory: 'arrakeen', target: 'b' });
  assert.equal(g.battle?.preparation?.kind, 'voice');
  g = finishConversion(g, 'kwisatz');
  g = applyAction(g, 'b', { type: 'declineBattlePower' });
  g = applyAction(g, 'e', { type: 'prescience', field: 'dial' });
  const attemptedConversion = applyAction(g, 'b', { type: 'card', mode: 'cancel', card: player(g, 'b').hand[0].id });
  g = applyAction(attemptedConversion, 'c', { type: 'kullDecision', event: attemptedConversion.pendingKull!.event, decline: true });
  assert.equal(g.response?.kind, 'worthlessKarama');
  // A valid, feasible saved answer; this response's cancellation suffix is
  // intentionally outside the engine's pure promise-feasibility quote.
  g.battle!.truthPromises = [{ player: 'e', asker: 'h', claim: { kind: 'dial', compare: 'eq', value: 0 }, answer: true }];
  const absent = reload(g);
  absent.deck.push(...player(absent, 'c').hand);
  player(absent, 'c').hand = [];
  for (const state of [g, absent]) {
    const before = JSON.stringify(state);
    assert.throws(() => applyAction(state, 'e', { type: 'card', mode: 'cancel', card: player(state, 'e').hand[0].id }), /unproven Truthtrance/);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.pendingKull, null);
    assert.equal(state.battle?.truthPromises?.[0].released, undefined);
  }
});

void test('a phase-blocked held Karama does not authorize accepting an unsupported unfunded overbid', () => {
  const g = choamKullGame();
  auction(g, 0, false);
  const blocked = finishKull(declare(applyAction(g, 'e', { type: 'card', mode: 'purchase', card: player(g, 'e').hand[0].id })));
  assert.ok(held(blocked, 'e', player(g, 'e').hand[0].id));
  const before = JSON.stringify(blocked);
  assert.throws(() => applyAction(blocked, 'e', { type: 'bid', amount: player(blocked, 'e').spice + 1 }), /defers/);
  assert.equal(JSON.stringify(blocked), before);
  const funded = applyAction(blocked, 'e', { type: 'bid', amount: 1 });
  assert.equal(funded.auction?.bid, 1);
  assert.equal(funded.auction?.bidder, 'e');
});

function preparedKullBattle() {
  let g = choamKullGame();
  Object.assign(g, { phase: 6, active: 'e' });
  for (const p of g.players) { p.forces = {}; p.reserves = 20; p.advisors = {}; }
  for (const id of ['e', 'b']) {
    player(g, id).forces = { 'arrakeen:10': 2 };
    player(g, id).reserves = 18;
  }
  g = applyAction(g, 'e', { type: 'chooseBattle', territory: 'arrakeen', target: 'b' });
  if (g.response) g = finishConversion(g, g.response.kind);
  return g;
}

void test('a promised battle card cannot be spent as an unproven Kull counter', () => {
  const g = preparedKullBattle();
  g.battle!.preparation = undefined;
  g.battle!.truthPromises = [{
    player: 'b', asker: 'h', claim: { kind: 'weapon', name: 'Baliset' }, answer: true,
  }];
  g.response = { kind: 'eliteStrength', owner: 'e', passed: [] };
  const offered = applyAction(g, 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  const counter = declare(offered), before = JSON.stringify(counter);
  const cost = player(counter, 'b').hand[0].id;
  assert.deepEqual(viewGame(counter, 'b').responseControls?.cancelCards, []);
  assert.throws(() => applyAction(counter, 'b', { type: 'card', mode: 'cancel', card: cost }));
  assert.equal(JSON.stringify(counter), before);
  assert.ok(held(counter, 'b', cost));
  for (const profile of DIFFICULTIES) {
    let automatic = reload(counter);
    for (const p of automatic.players) p.bot = profile;
    for (let step = 0; automatic.pendingKull && step < 12; step++) {
      const choice = automatic.players.flatMap(p =>
        botActions(viewGame(automatic, p.id)).map(action => ({ actor: p.id, action })))[0];
      assert.ok(choice, 'a legal counter or automatic allowance must progress');
      automatic = applyAction(automatic, choice.actor, choice.action);
    }
    assert.equal(automatic.pendingKull, null);
    assert.ok(held(automatic, 'b', cost));
    assert.equal(automatic.battle!.truthPromises![0].released, undefined);
  }
  assert.equal(counter.battle!.truthPromises![0].released, undefined);
});

void test('automatic Kull counter recovery preserves the suspended Voice promise', () => {
  let g = preparedKullBattle();
  player(g, 'e').hand.push(takeKullCard(g, 'Shield'));
  g.battle!.truthPromises = [{
    player: 'e', asker: 'h', claim: { kind: 'defense', name: 'Shield' }, answer: true,
  }];
  g = applyAction(g, 'b', { type: 'voice', kind: 'shield', must: false });
  g = applyAction(g, 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  const counter = declare(g);
  const restored = normalizeAutomaticGame(reload(counter));
  assert.equal(restored.battle!.truthPromises![0].released, undefined);
  assert.equal(restored.pendingKull?.event, counter.pendingKull?.event);
  for (const id of ['c', 'e', 'b', 'h'])
    assert.deepEqual(viewGame(restored, id), viewGame(counter, id));
});

void test('orphaned direct or converted Kull counters reject before views, recovery or new actions', () => {
  const initial = choamKullGame();
  const declared = declare(applyAction(initial, 'e', kullShipmentAttempt(initial)));
  const converted = applyAction(declared, 'b', {
    type: 'card', mode: 'cancel', card: player(declared, 'b').hand[0].id,
  });
  for (const source of [declared, converted])
    for (const remove of [true, false]) {
      const corrupt = reload(source);
      if (remove) delete corrupt.pendingKull;
      else corrupt.pendingKull = null;
      const before = JSON.stringify(corrupt);
      assert.throws(() => viewGame(corrupt, 'h'), /lost its interrupted Karama frame/);
      assert.throws(() => normalizeAutomaticGame(corrupt), /lost its interrupted Karama frame/);
      assert.throws(() => applyAction(corrupt, 'h', { type: 'passResponse' }),
        /lost its interrupted Karama frame/);
      assert.equal(JSON.stringify(corrupt), before);
    }
});

void test('Kull counter preserves a genuine Auditor response until the original cancellation resumes', () => {
  let g = choamKullGame();
  Object.assign(g, { phase: 6, active: 'c' });
  for (const p of g.players) {
    p.forces = ['c', 'e'].includes(p.id) ? { 'arrakeen:10': 3 } : {};
    p.reserves = ['c', 'e'].includes(p.id) ? 17 : 20;
    p.traitors = [];
  }
  g = applyAction(g, 'c', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  for (let step = 0; step < 30; step++) {
    if (g.response) g = finishConversion(g, g.response.kind);
    else if (g.battle?.preLeader && !g.battle.preLeader.closed) {
      const id = ['c', 'e'].find(id => !g.battle!.preLeader!.ready.includes(id))!;
      g = applyAction(g, id, { type: 'battlePreparationReady', event: g.battle.event });
    } else if (g.battle?.preparation)
      g = applyAction(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  g = applyAction(g, 'c', { type: 'battlePlan', leader: 'choam-auditor', dial: 0, support: 0 });
  g = applyAction(g, 'e', { type: 'battlePlan', leader: 'emperor-0', dial: 0, support: 0 });
  g = applyAction(g, 'c', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  if (g.response) g = finishConversion(g, g.response.kind);
  assert.equal(g.decision?.kind, 'choamAudit');
  g = applyAction(g, 'c', { type: 'decision', audit: true, event: g.pendingAuditor!.event });
  assert.equal(g.response?.kind, 'choamAudit');
  const original = player(g, 'h').hand[0].id;
  const offered = applyAction(g, 'h', { type: 'card', mode: 'cancel', card: original });
  const counter = normalizeAutomaticGame(reload(declare(offered)));
  assert.equal(counter.pendingAuditor?.stage, 'response');
  for (const id of ['c', 'e', 'b', 'h']) assert.ok(viewGame(counter, id).response);
  const cost = player(counter, 'e').hand[0].id;
  const completed = applyAction(counter, 'e', { type: 'card', mode: 'cancel', card: cost });
  assert.equal(completed.pendingKull, null);
  assert.equal(completed.pendingAuditor, null);
  assert.ok(held(completed, 'c', 'ix-kull-wahad'));
  assert.equal(completed.discard.filter(card => card.id === original).length, 1);
  assert.equal(completed.discard.filter(card => card.id === cost).length, 1);
});

void test('CHOAM cannot voluntarily spend the Kull card required by its own battle promise', () => {
  let g = choamKullGame();
  Object.assign(g, { phase: 6, active: 'c' });
  for (const p of g.players) { p.forces = {}; p.reserves = 20; p.advisors = {}; }
  for (const id of ['c', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 3 };
    player(g, id).reserves = 17;
  }
  g = applyAction(g, 'c', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  if (g.response) g = finishConversion(g, g.response.kind);
  g.battle!.preparation = undefined;
  g.battle!.truthPromises = [{
    player: 'c', asker: 'h', claim: { kind: 'weapon', name: 'Kull Wahad' }, answer: true,
  }];
  g.response = { kind: 'eliteStrength', owner: 'e', passed: [] };
  const offered = applyAction(g, 'h', { type: 'card', mode: 'cancel', card: player(g, 'h').hand[0].id });
  assert.deepEqual(viewGame(offered, 'c').kullReaction?.plays, []);
  assert.equal(viewGame(offered, 'c').kullReaction?.canDecline, true);
  const before = JSON.stringify(offered);
  assert.throws(() => applyAction(offered, 'c', {
    type: 'kullDecision', event: offered.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad',
  }), /eligible held Kull/);
  assert.equal(JSON.stringify(offered), before);
  const declined = applyAction(offered, 'c', {
    type: 'kullDecision', event: offered.pendingKull!.event, decline: true,
  });
  assert.ok(held(declined, 'c', 'ix-kull-wahad'));
  assert.equal(declined.battle!.truthPromises![0].released, undefined);
});

void test('deferred unfunded bids reject before commitment regardless of hidden Kull, without changing non-preview bidding', () => {
  const g = choamKullGame();
  player(g, 'e').spice = 1;
  auction(g, 0, false);
  const absent = reload(g);
  const replacement = absent.deck.shift()!;
  absent.deck.push(...player(absent, 'c').hand);
  player(absent, 'c').hand = [replacement];
  for (const state of [g, absent]) {
    const before = JSON.stringify(state);
    assert.throws(() => applyAction(state, 'e', { type: 'bid', amount: 2 }));
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.auction?.bid, 0);
    assert.equal(state.auction?.bidder, null);
  }
  const normal = reload(g);
  delete normal.kullPreview;
  const bid = applyAction(normal, 'e', { type: 'bid', amount: 2 });
  assert.equal(bid.auction?.bid, 2);
  assert.equal(bid.auction?.bidder, 'e');
});

void test('CHOAM self-activation remains outside Kull interception and can settle its funded-by-Karama bid', () => {
  let g = choamKullGame();
  const card = takeKullCard(g, player(g, 'h').hand[0].id);
  player(g, 'c').hand.push(card);
  player(g, 'c').spice = 1;
  auction(g, 0, false);
  g.active = 'c';
  g.auction!.active = 'c';
  g = applyAction(g, 'c', { type: 'bid', amount: 2 });
  for (let step = 0; g.auction && !g.decision && step < 12; step++)
    g = applyAction(g, g.auction.active!, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  const done = applyAction(g, 'c', { type: 'decision', karama: true, card: card.id });
  assert.equal(done.pendingKull ?? null, null);
  assert.ok(held(done, 'c', 'ix-kull-wahad'));
  assert.equal(done.discard.filter(used => used.id === card.id).length, 1);
});
