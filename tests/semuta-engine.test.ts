import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { spiceDeck } from '../game/cards';
import { saphoAggressorGame, aggressorAction, prepareAggressorPlans } from './fixture-sapho-aggressor';
import { takeSaphoBattleCard } from './fixture-sapho-battle-order';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
function take(g: Game, id: string) {
  const zones = [g.deck, g.discard, g.richeseCache!, ...g.players.map(p => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex(card => card.id === id || card.effect === id);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw new Error(`Missing physical ${id}`);
}
function inventory(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.richeseCache!, ...g.players.flatMap(p => p.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function fixture(ix = false) {
  let g = createGame('SEMUTAQ2', newPlayer('r', 'Richese', 'richese'), false, ix ? ['choam', 'ix'] : ['choam']);
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of g.players) { p.bot = 'Medium'; p.ready = true; }
  g = initializeSemutaGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const action = botActions(viewGame(g, p.id))[0];
      if (action) { next = applyAction(g, p.id, action); break; }
    }
    assert.ok(next, 'genuine setup must have a legal AI choice');
    g = next;
  }
  assert.equal(g.status, 'playing');
  const semuta = take(g, SEMUTA_DRUG_ID), hajr = take(g, 'hajr');
  g.deck.push(...g.players.flatMap(p => p.hand));
  for (const p of g.players) p.hand = [];
  player(g, 'r').hand.push(semuta);
  player(g, 'a').hand.push(hajr);
  Object.assign(g, { turn: 2, phase: 5, active: 'a', storm: 18, ready: [], decision: null,
    response: null, phaseOpening: null, stormPending: null, movementRemaining: ['a', 'r', 'e'] });
  return { g, semuta, hajr };
}

void test('printed Karama auction payment offers its card before the winning lot settles', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [take(g, 'karama')];
  g.deck.push(hajr);
  const karama = player(g, 'a').hand[0], lot = g.deck.shift()!;
  Object.assign(g, { phase: 3, active: 'a', order: ['a', 'e', 'r'],
    movementRemaining: [], auction: { cards: [lot], index: 0, bid: 0,
      bidder: null, active: 'a', passed: [], opener: 0 } });
  g.richeseBidding = { owner: 'r', event: 'richese-normal:2', turn: g.turn,
    stage: 'normal', position: 'last', normalCount: 1,
    blackMarketSold: false, cacheCanceled: false, opener: 0 };
  g.richeseFunding = {};
  const startingSpice = player(g, 'a').spice;
  const original = [...inventory(g), lot.id].sort();
  let bidding = applyAction(g, 'a', { type: 'bid', amount: startingSpice + 2 });
  for (const id of ['e', 'r'])
    bidding = applyAction(bidding, id, { type: 'passBid' });
  assert.equal(bidding.decision?.kind, 'auctionPayment');
  assert.equal(bidding.auction?.bidder, 'a');
  const pending = applyAction(bidding, 'a',
    { type: 'decision', karama: true, card: karama.id });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'karamaPaymentDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(player(pending, 'a').spice, startingSpice);
  assert.equal(player(pending, 'a').hand.some(card => card.id === lot.id), false);
  assert.equal(pending.auction?.bidder, 'a');
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  for (const mutate of [
    (state: Game) => { state.auction!.bidder = 'e'; },
    (state: Game) => { state.richeseBidding!.position = 'first'; },
    (state: Game) => {
      const c = state.pendingTreacheryDiscard!.continuation;
      if (c.kind === 'karamaPaymentDiscard') c.stateSignature = 'wrong';
    },
  ]) {
    const altered = reload(pending);
    mutate(altered);
    const before = JSON.stringify(altered);
    assert.throws(() => applyAction(altered, 'r', { type: 'semutaCommit', event }));
    assert.equal(JSON.stringify(altered), before);
  }
  let declined = reload(pending);
  for (const id of ['a', 'r', 'e'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  for (const state of [declined, claimed]) {
    assert.equal(state.pendingTreacheryDiscard, null);
    assert.equal(state.auction, null);
    assert.equal(state.richeseBidding?.stage, 'cacheOffer');
    assert.equal(state.decision?.kind, 'richeseCache');
    assert.equal(player(state, 'a').spice, startingSpice);
    assert.equal(player(state, 'a').hand.filter(card => card.id === lot.id).length, 1);
    assert.deepEqual([...inventory(state)].sort(), original);
    assert.throws(() => applyAction(state, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(declined.discard.filter(card => card.id === karama.id).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === karama.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
});

void test('printed Karama purchase offers its spent card before one normal auction settlement', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [take(g, 'karama')];
  g.deck.push(hajr);
  const karama = player(g, 'a').hand[0];
  const lot = g.deck.shift()!;
  Object.assign(g, { phase: 3, active: 'a', order: ['a', 'e', 'r'],
    movementRemaining: [], auction: { cards: [lot], index: 0, bid: 0,
      bidder: null, active: 'a', passed: [], opener: 0 } });
  g.richeseBidding = { owner: 'r', event: 'richese-normal:2', turn: g.turn,
    stage: 'normal', position: 'last', normalCount: 1,
    blackMarketSold: false, cacheCanceled: false, opener: 0 };
  g.richeseFunding = {};
  const physical = (state: Game) => [
    ...inventory(state), ...(state.auction?.cards.slice(state.auction.index) ?? []).map(card => card.id),
  ].sort();
  const original = physical(g);
  const pending = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'purchase' });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'karamaPurchaseDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.auction?.cards[0].id, lot.id);
  assert.equal(pending.auction?.bidder, null);
  assert.equal(player(pending, 'a').hand.some(card => card.id === lot.id), false);
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  for (const mutate of [
    (state: Game) => { state.auction!.cards[0].name = 'Forged lot'; },
    (state: Game) => { state.richeseBidding!.position = 'first'; },
    (state: Game) => { state.players[1].spice += 1; },
    (state: Game) => {
      const c = state.pendingTreacheryDiscard!.continuation;
      if (c.kind === 'karamaPurchaseDiscard') c.stateSignature = 'wrong';
    },
  ]) {
    const altered = reload(pending);
    mutate(altered);
    const before = JSON.stringify(altered);
    assert.throws(() => applyAction(altered, 'r', { type: 'semutaCommit', event }));
    assert.equal(JSON.stringify(altered), before);
  }
  let declined = reload(pending);
  for (const id of ['a', 'r', 'e'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  for (const state of [declined, claimed]) {
    assert.equal(state.pendingTreacheryDiscard, null);
    assert.equal(player(state, 'a').hand.filter(card => card.id === lot.id).length, 1);
    assert.equal(state.auction, null);
    assert.equal(state.phase, 3);
    assert.equal(state.richeseBidding?.stage, 'cacheOffer');
    assert.equal(state.decision?.kind, 'richeseCache');
    assert.deepEqual(physical(state), original);
    assert.throws(() => applyAction(state, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(declined.discard.filter(card => card.id === karama.id).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === karama.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(player(claimed, 'a').spice, player(declined, 'a').spice);
});

void test('a clean public discard offers every seat the same event, then a committed sole Semuta claim resumes once across JSON', () => {
  const { g, semuta, hajr } = fixture();
  const original = inventory(g);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard?.batch.event;
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.ok(event);
  const from = viewGame(pending, 'a').semutaReaction!, to = viewGame(pending, 'r').semutaReaction!;
  assert.equal(from.event, to.event);
  assert.equal(from.canCommit, false);
  assert.equal(to.canCommit, true);
  assert.deepEqual(from.candidates, []);
  assert.deepEqual(to.candidates, []);
  assert.equal(viewGame(pending, 'e').semutaReaction?.event, event);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  assert.throws(() => applyAction(pending, 'a', { type: 'move', from: 'imperial_basin:10', amount: 1,
    territory: 'arrakeen', sector: 10 }));
  const before = JSON.stringify(pending);
  assert.throws(() => applyAction(pending, 'a', { type: 'semutaCommit', event }));
  assert.throws(() => applyAction(pending, 'r', { type: 'semutaSelect', event, card: hajr.id }));
  assert.equal(JSON.stringify(pending), before);
  const passed = applyAction(reload(pending), 'a', { type: 'semutaPass', event });
  assert.equal(viewGame(passed, 'a').semutaReaction?.passed, true);
  assert.equal(viewGame(passed, 'r').semutaReaction?.passed, false);
  assert.deepEqual(normalizeAutomaticGame(reload(passed)), reload(passed));
  const botChoice = botActions(viewGame(passed, 'r'))[0];
  assert.ok(botChoice);
  const claimed = applyAction(reload(passed), 'r', botChoice);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.resolvedTreacheryDiscardSequence, claimed.treacheryDiscardSequence);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(claimed, 'r').hand.some(card => card.id === semuta.id), false);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === hajr.id), false);
  assert.equal(claimed.hajr.filter(id => id === 'a').length, 1);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('neutral Semuta passes do not reveal hidden possession and resume a declined effect exactly once', () => {
  const { g, semuta, hajr } = fixture();
  const without = reload(g);
  player(without, 'r').hand = [];
  without.richeseCache!.push(semuta);
  player(without, 'r').hand.push(take(without, 'richese-distrans'));
  const held = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const absent = applyAction(without, 'a', { type: 'card', card: hajr.id });
  const event = held.pendingTreacheryDiscard!.batch.event;
  assert.equal(absent.pendingTreacheryDiscard!.batch.event, event);
  for (const id of ['a', 'e'])
    assert.deepEqual(viewGame(held, id), viewGame(absent, id));
  assert.equal(viewGame(absent, 'r').semutaReaction?.canCommit, false);
  assert.deepEqual(normalizeAutomaticGame(reload(absent)), reload(absent));
  let declined = reload(held);
  for (const id of ['e', 'r', 'a']) {
    declined = applyAction(declined, id, { type: 'semutaPass', event });
    assert.deepEqual(inventory(declined), inventory(held));
  }
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.hajr.filter(id => id === 'a').length, 1);
  assert.equal(declined.discard.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(declined, 'r').hand.some(card => card.id === semuta.id), true);
  assert.deepEqual(normalizeAutomaticGame(reload(declined)), reload(declined));
});

void test('the provisional free-slot guard is private and never spends a full-hand Semuta', () => {
  const { g, semuta, hajr } = fixture();
  for (let n = 0; n < 3; n++) player(g, 'r').hand.push(g.deck.shift()!);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const richese = viewGame(pending, 'r').semutaReaction!;
  assert.equal(richese.canCommit, false);
  assert.match(richese.blocked ?? '', /free hand slot/);
  assert.equal(viewGame(pending, 'a').semutaReaction?.blocked, null);
  const before = JSON.stringify(pending);
  assert.throws(() => applyAction(pending, 'r', { type: 'semutaCommit', event }));
  assert.equal(JSON.stringify(pending), before);
  assert.equal(player(pending, 'r').hand.some(card => card.id === semuta.id), true);
});

void test('a saved neutral reaction cannot be deleted to auto-retire the fresh discard', () => {
  const { g, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  delete corrupt.pendingTreacheryDiscard!.reaction;
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  assert.throws(() => applyAction(corrupt, 'a', { type: 'advanceBots' }));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('duplicate physical Semuta custody cannot survive projection or commit', () => {
  const { g, semuta, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  corrupt.richeseCache!.push(structuredClone(semuta));
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => applyAction(corrupt, 'r', {
    type: 'semutaCommit', event: corrupt.pendingTreacheryDiscard!.batch.event,
  }));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('an impossible saved all-passed offer rejects instead of waiting forever', () => {
  const { g, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  const reaction = corrupt.pendingTreacheryDiscard!.reaction;
  assert.equal(reaction?.stage, 'offer');
  if (reaction?.stage !== 'offer') return;
  reaction.passed = corrupt.players.map(player => player.id);
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('a completed paid Box discard can be claimed before resumption without repeating its search', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const box = take(g, 'richese-nullentropy-box');
  player(g, 'a').hand.push(box);
  g.discard.push(g.deck.shift()!, g.deck.shift()!);
  g.phase = 4;
  g.active = null;
  const original = inventory(g);
  const spice = player(g, 'a').spice;
  const paid = applyAction(g, 'a', { type: 'card', card: box.id });
  assert.ok(paid.pendingNullentropy);
  assert.equal(player(paid, 'a').spice, spice - 2);
  const target = paid.discard[0].id;
  const pending = applyAction(paid, 'a', {
    type: 'decision', event: paid.pendingNullentropy.event, card: target,
  });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'nullentropyDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const shuffled = pending.discard.filter(card => card.id !== box.id).map(card => card.id);
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'a').semutaReaction?.canCommit, false);
  assert.deepEqual(viewGame(pending, 'r').semutaReaction?.candidates, []);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['r', 'e', 'a']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.deepEqual(declined.discard, pending.discard);
  assert.equal(player(declined, 'a').spice, spice - 2);
  assert.equal(player(declined, 'a').hand.filter(card => card.id === target).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(player(claimed, 'a').spice, spice - 2);
  assert.equal(player(claimed, 'a').hand.filter(card => card.id === target).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === box.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(claimed.discard.filter(card => card.id !== semuta.id).map(card => card.id), shuffled);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
});

void test('a retired Ornithopter can be claimed after one flight group without replaying movement', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const ornithopter = take(g, 'richese-ornithopter');
  player(g, 'a').hand.push(ornithopter);
  player(g, 'a').forces = { 'imperial_basin:10': 3 };
  player(g, 'a').reserves = 17;
  player(g, 'a').shipped = true;
  const original = inventory(g);
  const first = applyAction(g, 'a', {
    type: 'move', movementCard: ornithopter.id, ornithopter: 'twoGroups',
    forces: { 'imperial_basin:10': 1 }, territory: 'arrakeen', sector: 10,
  });
  assert.equal(first.ornithopter?.completed, 1);
  assert.equal(first.discard.some(card => card.id === ornithopter.id), false);
  const pending = applyAction(first, 'a', { type: 'endMovement' });
  assert.equal(pending.ornithopter, null);
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'ornithopterDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.discard.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(pending.active, 'a');
  assert.deepEqual(pending.movementRemaining, ['a', 'r', 'e']);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'a').semutaReaction?.canCommit, false);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.active, 'r');
  assert.deepEqual(declined.movementRemaining, ['r', 'e']);
  assert.equal(declined.discard.filter(card => card.id === ornithopter.id).length, 1);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.active, 'r');
  assert.deepEqual(claimed.movementRemaining, ['r', 'e']);
  assert.equal(player(claimed, 'a').moved, 1);
  assert.equal(player(claimed, 'a').forces['arrakeen:10'], 1);
  assert.equal(player(claimed, 'a').forces['imperial_basin:10'], 2);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === ornithopter.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('a completed private Distrans transfer offers only its public used card', () => {
  const { g, semuta, hajr } = fixture();
  const distrans = take(g, 'richese-distrans');
  player(g, 'a').hand.push(distrans);
  const original = inventory(g);
  const without = reload(g);
  player(without, 'r').hand = [];
  without.richeseCache!.push(semuta);
  player(without, 'r').hand.push(take(without, 'richese-nullentropy-box'));
  const pending = applyAction(g, 'a', {
    type: 'card', card: distrans.id, target: 'e', give: hajr.id,
  });
  const absent = applyAction(without, 'a', {
    type: 'card', card: distrans.id, target: 'e', give: hajr.id,
  });
  assert.equal(absent.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  for (const id of ['a', 'e'])
    assert.deepEqual(viewGame(pending, id), viewGame(absent, id));
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.pendingTreacheryDiscard?.batch.entries.map(entry => entry.card.id), [distrans.id]);
  assert.equal(player(pending, 'e').hand.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(pending, 'a').hand.some(card => card.id === hajr.id), false);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const stranger = JSON.stringify(viewGame(pending, 'r'));
  assert.equal(stranger.includes(hajr.id), false);
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'e').semutaReaction?.canCommit, false);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  const corrupt = reload(pending);
  if (corrupt.pendingTreacheryDiscard?.continuation.kind !== 'distransDiscard')
    throw Error('Missing saved private transfer');
  corrupt.pendingTreacheryDiscard.continuation.transferred = semuta.id;
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => applyAction(corrupt, 'r', { type: 'semutaCommit', event }));
  assert.equal(JSON.stringify(corrupt), before);
  const duplicate = reload(pending);
  duplicate.richeseRemoved = [...(duplicate.richeseRemoved ?? []), structuredClone(hajr)];
  assert.throws(() => viewGame(duplicate, 'r'));
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.discard.filter(card => card.id === distrans.id).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(player(claimed, 'e').hand.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === distrans.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === distrans.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('a final definite Truthtrance answer offers its consumed card after public history binds', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const truth = take(g, 'truthtrance');
  const shield = g.deck.splice(g.deck.findIndex(card => card.name === 'Shield'), 1)[0];
  assert.ok(shield);
  player(g, 'a').hand.push(truth);
  player(g, 'e').hand.push(shield);
  const original = inventory(g);
  let declared = applyAction(g, 'a', { type: 'card', card: truth.id });
  while (declared.truthtrance?.stage === 'priority') {
    const responder = declared.players.find(p => !declared.truthtrance!.passed.includes(p.id))!;
    declared = applyAction(declared, responder.id, { type: 'truthPass' });
  }
  const asked = applyAction(declared, 'a', { type: 'truthAsk',
    question: { kind: 'fact', target: 'e', fact: { kind: 'hand', name: 'Shield' } },
  });
  assert.equal(viewGame(asked, 'e').truthAnswer, 'yes');
  const pending = applyAction(asked, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'truthtranceDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.truthHistory?.length, 1);
  assert.equal(pending.truthHistory?.[0].answer, 'yes');
  assert.equal(pending.discard.filter(card => card.id === truth.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.discard.filter(card => card.id === truth.id).length, 1);
  assert.deepEqual(declined.truthHistory, pending.truthHistory);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.truthtrance, null);
  assert.deepEqual(claimed.truthHistory, pending.truthHistory);
  assert.equal(player(claimed, 'e').hand.filter(card => card.id === shield.id).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === truth.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === truth.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('a completed Sapho first-movement reorder offers its public card before changing the active turn', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const sapho = take(g, 'richese-juice-of-sapho');
  player(g, 'e').hand.push(sapho);
  const original = inventory(g);
  const pending = applyAction(g, 'e', {
    type: 'card', card: sapho.id, scope: 'movement', mode: 'first',
    event: `movement:${g.turn}`,
  });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.movementRemaining, ['e', 'a', 'r']);
  assert.equal(pending.active, 'a');
  assert.equal(pending.discard.filter(card => card.id === sapho.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.active, 'e');
  assert.deepEqual(declined.movementRemaining, ['e', 'a', 'r']);
  assert.equal(declined.discard.filter(card => card.id === sapho.id).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.active, 'e');
  assert.deepEqual(claimed.movementRemaining, ['e', 'a', 'r']);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === sapho.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === sapho.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('Sapho last protects the saved queue and its discard receipt against alteration', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const sapho = take(g, 'richese-juice-of-sapho');
  player(g, 'a').hand.push(sapho);
  const pending = applyAction(g, 'a', {
    type: 'card', card: sapho.id, scope: 'movement', mode: 'last',
    event: `movement:${g.turn}`,
  });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.movementRemaining, ['r', 'e', 'a']);
  assert.equal(pending.active, 'a');
  assert.equal(pending.saphoMovementLast?.player, 'a');
  const tampered = reload(pending);
  tampered.movementRemaining = ['e', 'r', 'a'];
  const before = JSON.stringify(tampered);
  assert.throws(() => viewGame(tampered, 'r'));
  assert.throws(() => normalizeAutomaticGame(tampered));
  assert.equal(JSON.stringify(tampered), before);
  const spent = reload(pending);
  player(spent, 'a').moved = 1;
  assert.throws(() => applyAction(spent, 'r', {
    type: 'semutaCommit', event: pending.pendingTreacheryDiscard!.batch.event,
  }));
  const profile = reload(pending);
  profile.advanced = !profile.advanced;
  assert.throws(() => viewGame(profile, 'r'));
  const roster = reload(pending);
  player(roster, 'e').faction = 'guild';
  assert.throws(() => viewGame(roster, 'r'));
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit',
    event: pending.pendingTreacheryDiscard!.batch.event });
  assert.equal(claimed.active, 'r');
  assert.deepEqual(claimed.movementRemaining, ['r', 'e', 'a']);
  assert.equal(claimed.saphoMovementLast?.player, 'a');
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === sapho.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
});

void test('a completed clean Ornithopter flight offers the retired card before its one arrival', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const ornithopter = take(g, 'richese-ornithopter');
  player(g, 'a').hand.push(ornithopter);
  player(g, 'a').forces = { 'imperial_basin:10': 3 };
  player(g, 'a').reserves = 17;
  player(g, 'a').shipped = true;
  const original = inventory(g);
  const pending = applyAction(g, 'a', {
    type: 'move', movementCard: ornithopter.id, ornithopter: 'range3',
    forces: { 'imperial_basin:10': 1 }, territory: 'hagga_basin', sector: 12,
  });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'ornithopterDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.ornithopter, null);
  assert.equal(pending.discard.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(player(pending, 'a').forces['hagga_basin:12'], 1);
  assert.equal(player(pending, 'a').moved, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.discard.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(player(declined, 'a').forces['hagga_basin:12'], 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.active, 'a');
  assert.equal(player(claimed, 'a').moved, 1);
  assert.equal(player(claimed, 'a').forces['hagga_basin:12'], 1);
  assert.equal(player(claimed, 'a').forces['imperial_basin:10'], 2);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === ornithopter.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('clean winner-selected battle cards allow one committed Semuta choice after resolution', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const weaponIndex = g.deck.findIndex(card => card.kind === 'projectile');
  const [weapon] = g.deck.splice(weaponIndex, 1);
  const [shield] = g.deck.splice(g.deck.findIndex(card => card.kind === 'shield'), 1);
  const [defense] = g.deck.splice(g.deck.findIndex(card => card.kind === 'snooper'), 1);
  assert.ok(weapon && shield && defense);
  player(g, 'a').hand.push(weapon, shield);
  player(g, 'e').hand.push(defense);
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 5 };
    player(g, id).reserves = 15;
    for (const leader of player(g, id).leaders) leader.strength = 0;
  }
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    response: null, decision: null, phaseOpening: null, ready: [] });
  const original = inventory(g);
  let battle = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  for (let step = 0; step < 40; step++) {
    if (battle.response) {
      const p = battle.players.find(p => !battle.response!.passed.includes(p.id))!;
      battle = applyAction(battle, p.id, { type: 'passResponse' });
    } else if (battle.battle?.preparation)
      battle = applyAction(battle, battle.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  if (battle.battle?.preLeader && !battle.battle.preLeader.closed)
    for (const id of ['a', 'e'])
      battle = applyAction(battle, id, {
        type: 'battlePreparationReady', event: battle.battle!.preLeader!.event,
      });
  battle = applyAction(battle, 'a', { type: 'battlePlan', dial: 2, support: 2,
    leader: player(battle, 'a').leaders[0].id, weapon: weapon.id, defense: shield.id });
  battle = applyAction(battle, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(battle, 'e').leaders[0].id, defense: defense.id });
  battle = applyAction(battle, 'a', { type: 'traitorCall', call: false });
  battle = applyAction(battle, 'e', { type: 'traitorCall', call: false });
  assert.equal(battle.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
  assert.equal(battle.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(battle.pendingTreacheryDiscard?.batch.entries.map(entry => [
    entry.card.id, entry.discardedBy,
  ]), [[defense.id, 'e']]);
  const mandatoryEvent = battle.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(battle, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(battle)), reload(battle));
  for (const id of ['e', 'a', 'r'])
    battle = applyAction(battle, id, { type: 'semutaPass', event: mandatoryEvent });
  assert.equal(battle.decision?.kind, 'battleCards');
  const pending = applyAction(reload(battle), 'a', { type: 'decision', discard: [weapon.id] });
  assert.equal(pending.pendingTreacheryDiscard?.batch.cause, 'battle:winner');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.discard.filter(card => card.id === weapon.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.discard.filter(card => card.id === weapon.id).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === weapon.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === weapon.id), false);
  const settled = (game: Game) => game.players.map(p => ({
    id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, leaderDeaths: p.leaders.map(leader => leader.deaths),
  }));
  assert.deepEqual(settled(claimed), settled(declined));
  assert.deepEqual(claimed.lastBattle, declined.lastBattle);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
  const multiple = applyAction(reload(battle), 'a', {
    type: 'decision', discard: [weapon.id, shield.id],
  });
  assert.equal(multiple.pendingTreacheryDiscard?.batch.entries.length, 2);
  assert.equal(multiple.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(viewGame(multiple, 'e').semutaReaction?.candidates, []);
  const multiEvent = multiple.pendingTreacheryDiscard!.batch.event;
  const committed = applyAction(reload(multiple), 'r', { type: 'semutaCommit', event: multiEvent });
  assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
  assert.deepEqual(viewGame(committed, 'r').semutaReaction?.candidates.map(card => card.id),
    [weapon.id, shield.id]);
  assert.deepEqual(viewGame(committed, 'a').semutaReaction?.candidates, []);
  assert.equal(player(committed, 'r').hand.some(card => card.id === semuta.id), true);
  assert.equal(committed.discard.filter(card => card.id === weapon.id || card.id === shield.id).length, 2);
  const snapshot = JSON.stringify(committed);
  assert.throws(() => applyAction(committed, 'e', {
    type: 'semutaSelect', event: multiEvent, card: weapon.id,
  }));
  assert.equal(JSON.stringify(committed), snapshot);
  assert.deepEqual(normalizeAutomaticGame(reload(committed)), reload(committed));
  const selected = applyAction(reload(committed), 'r', botActions(viewGame(committed, 'r'))[0]!);
  assert.equal(selected.pendingTreacheryDiscard, null);
  assert.equal(player(selected, 'r').hand.filter(card => card.id === weapon.id).length, 1);
  assert.equal(selected.discard.some(card => card.id === shield.id), true);
  assert.equal(selected.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(inventory(selected), original);
  assert.deepEqual(settled(selected), settled(declined));
  const alternate = applyAction(reload(committed), 'r', {
    type: 'semutaSelect', event: multiEvent, card: shield.id,
  });
  assert.equal(alternate.pendingTreacheryDiscard, null);
  assert.equal(player(alternate, 'r').hand.filter(card => card.id === shield.id).length, 1);
  assert.equal(alternate.discard.filter(card => card.id === weapon.id).length, 1);
  assert.equal(alternate.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(inventory(alternate), original);
  assert.deepEqual(settled(alternate), settled(declined));
});

void test('a mandatory winner Hero discard can be claimed before optional battle cleanup', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const [hero] = g.deck.splice(g.deck.findIndex(card => card.kind === 'hero'), 1);
  const [weapon] = g.deck.splice(g.deck.findIndex(card => card.kind === 'projectile'), 1);
  const [defense] = g.deck.splice(g.deck.findIndex(card => card.kind === 'snooper'), 1);
  assert.ok(hero && weapon && defense);
  player(g, 'a').hand.push(hero, weapon);
  player(g, 'e').hand.push(defense);
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 5 };
    player(g, id).reserves = 15;
    for (const leader of player(g, id).leaders) leader.strength = 0;
  }
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    response: null, decision: null, phaseOpening: null, ready: [] });
  const original = inventory(g);
  let battle = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  for (let step = 0; step < 40; step++) {
    if (battle.response) {
      const p = battle.players.find(p => !battle.response!.passed.includes(p.id))!;
      battle = applyAction(battle, p.id, { type: 'passResponse' });
    } else if (battle.battle?.preparation)
      battle = applyAction(battle, battle.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  if (battle.battle?.preLeader && !battle.battle.preLeader.closed)
    for (const id of ['a', 'e'])
      battle = applyAction(battle, id, {
        type: 'battlePreparationReady', event: battle.battle!.preLeader!.event,
      });
  battle = applyAction(battle, 'a', { type: 'battlePlan', dial: 2, support: 2,
    leader: hero.id, weapon: weapon.id });
  battle = applyAction(battle, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(battle, 'e').leaders[0].id, defense: defense.id });
  battle = applyAction(battle, 'a', { type: 'traitorCall', call: false });
  const pending = applyAction(battle, 'e', { type: 'traitorCall', call: false });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'winnerMandatoryDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.pendingTreacheryDiscard?.batch.entries.map(entry => entry.card.id), [hero.id]);
  assert.equal(pending.discard.filter(card => card.id === hero.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.decision?.kind, 'battleCards');
  assert.equal(declined.discard.filter(card => card.id === hero.id).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.decision?.kind, 'battleCards');
  assert.equal(player(claimed, 'a').hand.some(card => card.id === weapon.id), true);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === hero.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === hero.id), false);
  assert.deepEqual(inventory(claimed), original);
  assert.deepEqual(claimed.lastBattle, declined.lastBattle);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('a mutual-traitor battle offers one mixed-owner mandatory batch with one committed choice', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const [shield] = g.deck.splice(g.deck.findIndex(card => card.kind === 'shield'), 1);
  const [snooper] = g.deck.splice(g.deck.findIndex(card => card.kind === 'snooper'), 1);
  assert.ok(shield && snooper);
  player(g, 'a').hand.push(shield);
  player(g, 'e').hand.push(snooper);
  player(g, 'a').traitors = [player(g, 'e').leaders[0].id];
  player(g, 'e').traitors = [player(g, 'a').leaders[0].id];
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 5 };
    player(g, id).reserves = 15;
    for (const leader of player(g, id).leaders) leader.strength = 0;
  }
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    response: null, decision: null, phaseOpening: null, ready: [] });
  const original = inventory(g);
  let battle = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  for (let step = 0; step < 40; step++) {
    if (battle.response) {
      const p = battle.players.find(p => !battle.response!.passed.includes(p.id))!;
      battle = applyAction(battle, p.id, { type: 'passResponse' });
    } else if (battle.battle?.preparation)
      battle = applyAction(battle, battle.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  if (battle.battle?.preLeader && !battle.battle.preLeader.closed)
    for (const id of ['a', 'e'])
      battle = applyAction(battle, id, {
        type: 'battlePreparationReady', event: battle.battle!.preLeader!.event,
      });
  battle = applyAction(battle, 'a', { type: 'battlePlan', dial: 2, support: 2,
    leader: player(battle, 'a').leaders[0].id, defense: shield.id });
  battle = applyAction(battle, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(battle, 'e').leaders[0].id, defense: snooper.id });
  battle = applyAction(battle, 'a', { type: 'traitorCall', call: true });
  const pending = applyAction(battle, 'e', { type: 'traitorCall', call: true });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.pendingTreacheryDiscard?.batch.entries.map(entry => [
    entry.card.id, entry.discardedBy,
  ]), [[shield.id, 'a'], [snooper.id, 'e']]);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const wrongOwner = reload(pending);
  wrongOwner.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'e';
  assert.throws(() => viewGame(wrongOwner, 'r'));
  const oldCard = reload(pending);
  const prior = oldCard.deck.shift()!;
  oldCard.discard.push(prior);
  oldCard.pendingTreacheryDiscard!.batch.entries[0].card = prior;
  assert.throws(() => viewGame(oldCard, 'r'));
  const committed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
  assert.deepEqual(viewGame(committed, 'r').semutaReaction?.candidates.map(card => card.id),
    [shield.id, snooper.id]);
  assert.deepEqual(viewGame(committed, 'a').semutaReaction?.candidates, []);
  assert.deepEqual(normalizeAutomaticGame(reload(committed)), reload(committed));
  const selected = applyAction(reload(committed), 'r', { type: 'semutaSelect',
    event, card: snooper.id });
  assert.equal(selected.pendingTreacheryDiscard, null);
  assert.equal(selected.lastBattleContext?.winner, null);
  assert.equal(player(selected, 'r').hand.filter(card => card.id === snooper.id).length, 1);
  assert.equal(selected.discard.filter(card => card.id === shield.id).length, 1);
  assert.equal(selected.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(inventory(selected), original);
  for (const p of selected.players)
    assert.deepEqual(viewGame(reload(selected), p.id), viewGame(selected, p.id));
});

void test('a clean Thumper discard pauses before its injected worm and resumes one Spice Blow', () => {
  const { g, semuta, hajr } = fixture(true);
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const thumper = take(g, 'thumper');
  player(g, 'a').hand.push(thumper);
  const lands = spiceDeck().filter(card => 'territory' in card);
  const prior = lands[0], next = lands[1];
  if (!('territory' in prior) || !('territory' in next))
    throw Error('Missing real spice territory cards');
  player(g, 'e').forces = { [`${prior.territory}:${prior.sector}`]: 3 };
  player(g, 'e').reserves = 17;
  g.spice = { [`${prior.territory}:${prior.sector}`]: 8 };
  g.spiceDiscard = [[prior], []];
  g.spiceDeck = [next, ...spiceDeck().filter(card => 'worm' in card)];
  Object.assign(g, { phase: 1, turn: 2, active: null, ready: [],
    decision: null, response: null, phaseOpening: null,
    spiceWindow: null, spiceResolution: null, spiceSequence: null, nexus: false });
  const original = inventory(g), deck = reload(g).spiceDeck;
  const pending = applyAction(g, 'a', { type: 'card', card: thumper.id });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.spiceWindow, null);
  assert.deepEqual(pending.spiceDeck, deck);
  assert.equal(player(pending, 'e').tanks, 0);
  assert.equal(pending.spice[`${prior.territory}:${prior.sector}`], 8);
  assert.equal(pending.discard.filter(card => card.id === thumper.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  const profile = reload(pending);
  profile.advanced = !profile.advanced;
  assert.throws(() => viewGame(profile, 'r'));
  const custody = reload(pending);
  player(custody, 'r').noField = undefined;
  assert.throws(() => normalizeAutomaticGame(custody));
  const expansion = reload(pending);
  expansion.expansions = ['choam'];
  assert.throws(() => viewGame(expansion, 'r'));
  const placement = reload(pending);
  placement.wormPlacementCanceledTurn = pending.turn;
  assert.throws(() => normalizeAutomaticGame(placement));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(player(declined, 'e').tanks, 3);
  assert.equal(declined.spice[`${prior.territory}:${prior.sector}`], undefined);
  assert.equal(declined.spiceWindow?.territory, next.territory);
  assert.equal(declined.discard.filter(card => card.id === thumper.id).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(player(claimed, 'e').tanks, 3);
  assert.equal(claimed.spiceWindow?.territory, next.territory);
  assert.deepEqual(claimed.spiceDeck, declined.spiceDeck);
  assert.deepEqual(claimed.spiceDiscard, declined.spiceDiscard);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === thumper.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === thumper.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('a clean Ix-deck Amal discard pauses after halving spice but before phase initialization', () => {
  const { g, semuta, hajr } = fixture(true);
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const amal = take(g, 'amal');
  player(g, 'a').hand.push(amal);
  player(g, 'r').spice = 11;
  player(g, 'a').spice = 9;
  player(g, 'e').spice = 7;
  Object.assign(g, { phase: 2, active: null, ready: [],
    decision: null, response: null, phaseOpening: null, auction: null });
  const original = inventory(g);
  let opening = g;
  for (const id of ['a', 'e', 'r'])
    opening = applyAction(opening, id, { type: 'ready' });
  assert.equal(opening.phase, 3);
  assert.ok(opening.phaseOpening);
  opening = applyAction(opening, 'e', { type: 'ready' });
  assert.deepEqual(opening.phaseOpening?.passed, ['e']);
  const deck = reload(opening).deck;
  const pending = applyAction(opening, 'a', { type: 'card', card: amal.id });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.phaseOpening, null);
  assert.equal(pending.auction, null);
  assert.deepEqual(pending.deck, deck);
  assert.deepEqual(pending.players.map(p => p.spice), [5, 4, 3]);
  assert.equal(pending.discard.filter(card => card.id === amal.id).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.deepEqual(declined.phaseOpening?.passed, []);
  assert.deepEqual(declined.players.map(p => p.spice), [5, 4, 3]);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.deepEqual(claimed.phaseOpening?.passed, []);
  assert.deepEqual(claimed.players.map(p => p.spice), [5, 4, 3]);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === amal.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === amal.id), false);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  let after = reload(claimed);
  for (const id of ['a', 'e', 'r'])
    after = applyAction(after, id, { type: 'ready' });
  assert.equal(after.phaseOpening, null);
  assert.equal(after.richeseBidding?.turn, after.turn);
  assert.deepEqual(after.players.map(p => p.spice), [5, 4, 3]);
  assert.deepEqual(inventory(after), original);
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('clean pre-plan Sapho aggressor discard offers Semuta before battle readiness resumes', () => {
  const g = saphoAggressorGame({ semutaPreview: true });
  takeSaphoBattleCard(g, 'r', SEMUTA_DRUG_ID);
  const original = inventory(g), battleEvent = g.battle!.event;
  const action = aggressorAction(g);
  const pending = applyAction(g, 'b', action);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.battle?.event, battleEvent);
  assert.equal(pending.battle?.preLeader?.closed, false);
  assert.equal(pending.battle?.saphoAggressor?.uses.length, 1);
  assert.equal(pending.discard.filter(card => card.id === action.card).length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['a', 'b', 'c', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.battle?.saphoAggressor?.uses.length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.battle?.event, battleEvent);
  assert.equal(claimed.battle?.saphoAggressor?.uses.length, 1);
  assert.equal(viewGame(claimed, 'a').battle?.aggressor, 'b');
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === action.card).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
  assert.equal(claimed.discard.some(card => card.id === action.card), false);
  assert.deepEqual(inventory(claimed), original);
  const prepared = prepareAggressorPlans(reload(claimed));
  assert.equal(prepared.battle?.preLeader?.closed, true);
  assert.equal(prepared.battle?.saphoAggressor?.uses.length, 1);
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});
