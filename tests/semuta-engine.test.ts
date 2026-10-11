import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { fighterCount } from '../game/advisors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { spiceDeck } from '../game/cards';
import { saphoAggressorGame, aggressorAction, prepareAggressorPlans } from './fixture-sapho-aggressor';
import { takeSaphoBattleCard } from './fixture-sapho-battle-order';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

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
function fixture(ix = false, ixianAlly = false, advanced = false, opponent: 'emperor' | 'beneGesserit' | 'harkonnen' | 'moritani' = 'emperor') {
  let g = createGame('SEMUTAQ2', newPlayer('r', 'Richese', 'richese'), advanced,
    opponent === 'moritani' ? ['choam', 'ecaz'] : ix ? ['choam', 'ix'] : ['choam']);
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', ixianAlly ? 'Ixians' : opponent === 'beneGesserit' ? 'Bene Gesserit' : opponent === 'harkonnen' ? 'Harkonnen' : opponent === 'moritani' ? 'Moritani' : 'Emperor',
    ixianAlly ? 'ixians' : opponent));
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

for (const kind of ['sabotage', 'robbery'] as const) void test(
  `Semuta takes the private ${kind} discard before the original native arrival suffix`, () => {
    const { g, semuta } = fixture(false, false, false, 'moritani');
    for (const id of ['a', 'e']) Object.assign(player(g, id), { forces: {}, reserves: 20, shipped: false, moved: 0 });
    const gift = take(g, g.deck.find(c => c.kind === 'shield')!.id);
    if (kind === 'sabotage') {
      player(g, 'e').hand.push(gift);
      for (let i = 0; i < 2; i++) player(g, 'a').hand.push(take(g, g.deck.find(c => c.kind === 'projectile')!.id));
    } else {
      g.deck.push(gift);
      for (let i = 0; i < 4; i++) player(g, 'e').hand.push(take(g,
        g.deck.find(c => !c.effect || c.kind === 'worthless')!.id));
    }
    g.moritaniTerror = createTerrorState(() => 0);
    const token = g.moritaniTerror.tokens.find(t => t.kind === kind)!;
    g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'carthag', g.turn);
    const original = inventory(g);
    let state = applyAction(g, 'a', { type: 'ship', territory: 'carthag', sector: 11, amount: 2 });
    state = applyAction(state, 'e', { type: 'decision', reveal: true });
    let drawn: string | undefined;
    if (kind === 'robbery') {
      drawn = state.deck[0].id;
      state = applyAction(state, 'e', { type: 'decision', choice: 'card' });
      assert.equal(player(state, 'e').hand.some(c => c.id === drawn), true);
      state = applyAction(state, 'e', { type: 'decision', card: player(state, 'e').hand[0].id });
    }
    assert.equal(state.pendingTreacheryDiscard?.continuation.kind, 'terrorDiscard');
    assert.equal(state.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(state.pendingTreacheryDiscard!.batch.entries[0].publicFace, false);
    const victim = state.pendingTreacheryDiscard!.batch.entries[0].card.id;
    const event = state.pendingTreacheryDiscard!.batch.event;
    assert.deepEqual(viewGame(state, 'r').semutaReaction?.candidates, []);
    const settled = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice,
      forces: p.forces, reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved }));
    let declined = reload(state);
    for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
    const claimed = applyAction(reload(state), 'r', { type: 'semutaCommit', event });
    for (let resumed of [declined, claimed]) {
      assert.deepEqual(settled(resumed), settled(state));
      assert.equal(resumed.moritaniTerror!.tokens.find(t => t.id === token.id)!.status, 'removed');
      assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event }));
      if (kind === 'sabotage') {
        assert.equal(resumed.pendingTerrorEntry?.stage, 'gift');
        resumed = applyAction(resumed, 'e', { type: 'decision', card: gift.id });
        assert.equal(player(resumed, 'a').hand.some(c => c.id === gift.id), true);
        assert.equal(player(resumed, 'a').hand.length, 3);
      } else {
        assert.equal(player(resumed, 'e').hand.length, 4);
        assert.equal(player(resumed, 'e').hand.some(c => c.id === drawn), true);
      }
      assert.equal(resumed.pendingTerrorEntry, null);
      assert.equal(resumed.active, 'a');
      assert.equal(player(resumed, 'a').forces['carthag:11'], 2);
      assert.equal(player(resumed, 'a').reserves, 18);
      assert.deepEqual(inventory(resumed), original);
      assert.throws(() => applyAction(resumed, 'a', { type: 'ship', territory: 'carthag', sector: 11, amount: 2 }));
    }
    assert.equal(player(claimed, 'r').hand.some(c => c.id === victim), true);
    assert.equal(claimed.discard.some(c => c.id === semuta.id), true);
    assert.equal(declined.discard.some(c => c.id === victim), true);
  });

void test('private Ixian ally discard offers Semuta before replacement without revealing its face', () => {
  const { g, semuta, hajr } = fixture(true, true);
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  player(g, 'a').ally = 'e';
  player(g, 'e').ally = 'a';
  const lot = g.deck.shift()!;
  Object.assign(g, { phase: 3, active: 'a', order: ['a', 'e', 'r'],
    movementRemaining: [], auction: { cards: [lot], index: 0, bid: 0,
      bidder: null, active: 'a', passed: [], opener: 0 } });
  g.richeseBidding = { owner: 'r', event: 'richese-normal:2', turn: g.turn,
    stage: 'normal', position: 'last', normalCount: 1,
    blackMarketSold: false, cacheCanceled: false, opener: 0 };
  g.richeseFunding = {};
  const absent = reload(g);
  player(absent, 'r').hand = [take(absent, 'richese-distrans')];
  absent.richeseCache!.push(semuta);
  const original = [...inventory(g), lot.id].sort();
  const offer = (state: Game) => {
    let next = applyAction(state, 'a', { type: 'bid', amount: 2 });
    for (const id of ['e', 'r']) next = applyAction(next, id, { type: 'passBid' });
    if (next.decision?.kind === 'auctionPayment')
      next = applyAction(next, 'a', { type: 'decision', karama: false });
    assert.equal(next.decision?.kind, 'ixAllyCard');
    next = applyAction(next, 'a', { type: 'decision', accept: true });
    for (let i = 0; next.response?.kind === 'ixAllyCard' && i < 3; i++) {
      const other = next.players.find(p => !next.response!.passed.includes(p.id))!;
      next = applyAction(next, other.id, { type: 'passResponse' });
    }
    return next;
  };
  const pending = offer(g), neutral = offer(absent);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'ixAllyCard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(neutral.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.pendingTreacheryDiscard?.batch.entries[0].publicFace, false);
  assert.equal(pending.discard.filter(card => card.id === lot.id).length, 1);
  assert.equal(pending.deck[0].id, neutral.deck[0].id);
  assert.equal(player(pending, 'a').hand.some(card => card.id === lot.id), false);
  assert.deepEqual(viewGame(pending, 'a'), viewGame(neutral, 'a'));
  assert.deepEqual(viewGame(pending, 'e'), viewGame(neutral, 'e'));
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  const corrupted = reload(pending);
  corrupted.pendingTreacheryDiscard!.batch.entries[0].card.name = 'Forged face';
  const before = JSON.stringify(corrupted);
  assert.throws(() => applyAction(corrupted, 'r', { type: 'semutaCommit', event }));
  assert.equal(JSON.stringify(corrupted), before);
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  for (const state of [declined, claimed]) {
    assert.equal(state.pendingTreacheryDiscard, null);
    assert.equal(state.auction, null);
    assert.equal(state.richeseBidding?.stage, 'cacheOffer');
    assert.equal(state.decision?.kind, 'richeseCache');
    assert.deepEqual(inventory(state), original);
    assert.equal(player(state, 'a').spice, player(pending, 'a').spice);
    assert.equal(player(state, 'a').hand.length, 1);
    assert.throws(() => applyAction(state, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(declined.discard.filter(card => card.id === lot.id).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === lot.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
});

void test('Black Market Ixian replacement offers the private fresh card before drawing and pays the seller once', () => {
  const { g, semuta, hajr } = fixture(true, true, true);
  player(g, 'a').hand = [];
  player(g, 'r').hand.push(hajr);
  player(g, 'a').ally = 'e';
  player(g, 'e').ally = 'a';
  Object.assign(g, { phase: 2, active: 'a', order: ['a', 'e', 'r'], movementRemaining: [] });
  const buyerSpice = player(g, 'a').spice;
  const sellerSpice = player(g, 'r').spice;
  let state = g;
  for (const id of ['a', 'e', 'r']) state = applyAction(state, id, { type: 'ready' });
  for (const id of ['a', 'e', 'r']) state = applyAction(state, id, { type: 'ready' });
  assert.equal(state.decision?.kind, 'richeseBlackMarket');
  state = applyAction(state, 'r', { type: 'decision', event: state.richeseBidding!.event,
    card: hajr.id, method: 'silent' });
  for (const id of ['a', 'e', 'r'])
    state = applyAction(state, id, { type: 'richeseBid', event: state.richeseAuction!.event,
      amount: id === 'a' ? 3 : 0 });
  assert.equal(state.decision?.kind, 'ixAllyCard');
  const replacement = state.deck[0].id;
  state = applyAction(state, 'a', { type: 'decision', accept: true });
  while (state.response?.kind === 'ixAllyCard') {
    const actor = state.players.find(p => !state.response!.passed.includes(p.id))!;
    state = applyAction(state, actor.id, { type: 'passResponse' });
  }
  assert.equal(state.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(state.pendingTreacheryDiscard?.continuation.kind, 'ixAllyCard');
  assert.equal(state.pendingTreacheryDiscard?.batch.entries[0].publicFace, false);
  assert.equal(state.deck[0].id, replacement);
  assert.equal(player(state, 'a').hand.length, 0);
  assert.equal(player(state, 'a').spice, buyerSpice - 3);
  assert.equal(viewGame(state, 'e').semutaReaction?.candidates.length, 0);
  const event = state.pendingTreacheryDiscard!.batch.event;
  const beforeInventory = inventory(state);
  let declined = reload(state);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(state), 'r', { type: 'semutaCommit', event });
  for (const finished of [declined, claimed]) {
    assert.equal(finished.pendingTreacheryDiscard, null);
    assert.equal(finished.decision?.kind, 'richeseDeclaration');
    assert.equal(finished.richeseBidding?.blackMarketSold, true);
    assert.equal(player(finished, 'a').spice, buyerSpice - 3);
    assert.equal(player(finished, 'r').spice, sellerSpice + 3);
    assert.deepEqual(player(finished, 'a').hand.map(card => card.id), [replacement]);
    assert.deepEqual(inventory(finished), beforeInventory);
    assert.throws(() => applyAction(finished, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(declined.discard.some(card => card.id === hajr.id), true);
  assert.equal(player(claimed, 'r').hand.some(card => card.id === hajr.id), true);
  assert.equal(claimed.discard.some(card => card.id === semuta.id), true);
});

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

void test('a full-hand Semuta exchanges one card without revealing private capacity', () => {
  const { g, semuta, hajr } = fixture();
  for (let n = 0; n < 3; n++) player(g, 'r').hand.push(g.deck.shift()!);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'r').semutaReaction?.blocked, null);
  assert.equal(viewGame(pending, 'a').semutaReaction?.blocked, null);
  const done = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  assert.equal(player(done, 'r').hand.length, 4);
  assert.ok(player(done, 'r').hand.some(card => card.id === hajr.id));
  assert.ok(!player(done, 'r').hand.some(card => card.id === semuta.id));
  assert.equal(done.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(inventory(done), inventory(pending));
  assert.equal(done.hajr.filter(id => id === 'a').length, 1);
  assert.throws(() => applyAction(done, 'r', { type: 'semutaCommit', event }));
});

void test('Harkonnen exchanges Semuta at eight cards while an already overfull hand rejects immutably', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'r').hand = [];
  g.players[2] = newPlayer('e', 'Harkonnen', 'harkonnen');
  player(g, 'e').hand = [semuta, ...g.deck.splice(0, 7)];
  player(g, 'r').hand.push(g.deck.shift()!);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'e').semutaReaction?.canCommit, true);
  const overfull = reload(pending);
  player(overfull, 'e').hand.push(player(overfull, 'r').hand.pop()!);
  assert.equal(viewGame(overfull, 'e').semutaReaction?.canCommit, false);
  assert.deepEqual(viewGame(overfull, 'a'), viewGame(pending, 'a'));
  const before = JSON.stringify(overfull);
  assert.throws(() => applyAction(overfull, 'e', { type: 'semutaCommit', event }));
  assert.equal(JSON.stringify(overfull), before);
  const done = applyAction(reload(pending), 'e', { type: 'semutaCommit', event });
  assert.equal(player(done, 'e').hand.length, 8);
  assert.ok(player(done, 'e').hand.some(card => card.id === hajr.id));
  assert.ok(!player(done, 'e').hand.some(card => card.id === semuta.id));
  assert.deepEqual(inventory(done), inventory(pending));
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

void test('Semuta claims a battle Box after its paid search without changing the recovered weapon or sealed plan', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const box = take(g, 'richese-nullentropy-box');
  const weapon = take(g, g.deck.find(c => c.kind === 'projectile')!.id);
  player(g, 'a').hand.push(box);
  g.discard.push(weapon, g.deck.shift()!);
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    response: null, decision: null, phaseOpening: null, movementRemaining: [] });
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
  }
  const original = inventory(g);
  const spice = player(g, 'a').spice;
  let state = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  while (state.battle?.preparation)
    state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
  for (const id of ['a', 'e'])
    state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
  state = applyAction(state, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(state, 'e').leaders[0].id });
  const paid = applyAction(state, 'a', { type: 'card', card: box.id });
  const search = paid.pendingNullentropy!.event;
  const pending = applyAction(paid, 'a', { type: 'decision', event: search, card: weapon.id });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const shuffled = pending.discard.filter(c => c.id !== box.id).map(c => c.id);
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  for (const resumed of [declined, claimed]) {
    assert.equal(player(resumed, 'a').spice, spice - 2);
    assert.equal(player(resumed, 'a').hand.filter(c => c.id === weapon.id).length, 1);
    assert.deepEqual(resumed.battle, state.battle);
    assert.deepEqual(resumed.discard.filter(c => c.id !== box.id && c.id !== semuta.id).map(c => c.id), shuffled);
    assert.deepEqual(inventory(resumed), original);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, 'a', { type: 'decision', event: search, card: weapon.id }));
    const planned = applyAction(resumed, 'a', { type: 'battlePlan', dial: 1, support: 0,
      leader: player(resumed, 'a').leaders[0].id, weapon: weapon.id });
    assert.equal(planned.battle!.plans.a.weapon, weapon.id);
    assert.deepEqual(planned.battle!.plans.e, state.battle!.plans.e);
  }
  assert.equal(player(claimed, 'r').hand.some(c => c.id === box.id), true);
  assert.equal(claimed.discard.some(c => c.id === semuta.id), true);
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

void test('final Ornithopter discard resolves Semuta before the original Bene Gesserit intrusion without moving twice', () => {
  const { g, semuta, hajr } = fixture(false, false, true, 'beneGesserit');
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const ornithopter = take(g, 'richese-ornithopter');
  player(g, 'a').hand.push(ornithopter);
  Object.assign(player(g, 'a'), { forces: { 'imperial_basin:10': 3 }, reserves: 17, shipped: true });
  Object.assign(player(g, 'e'), { forces: { 'arrakeen:10': 2 }, reserves: 18, advisors: {} });
  const original = inventory(g);
  const pending = applyAction(g, 'a', {
    type: 'move', movementCard: ornithopter.id, ornithopter: 'range3',
    forces: { 'imperial_basin:10': 1 }, territory: 'arrakeen', sector: 10,
  });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.decision, null);
  assert.equal(fighterCount(player(pending, 'e'), 'arrakeen'), 2);
  assert.equal(player(pending, 'a').moved, 1);
  assert.deepEqual(player(pending, 'a').forces, { 'imperial_basin:10': 2, 'arrakeen:10': 1 });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  for (const resumed of [declined, claimed]) {
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.decision?.kind, 'intrusion');
    assert.equal(resumed.decision?.player, 'e');
    let finished = applyAction(resumed, 'e', { type: 'decision', accept: true });
    while (finished.response?.kind === 'advisorFlip') {
      const actor = finished.players.find(p => !finished.response!.passed.includes(p.id))!;
      finished = applyAction(finished, actor.id, { type: 'passResponse' });
    }
    assert.equal(finished.decision, null);
    assert.equal(fighterCount(player(finished, 'e'), 'arrakeen'), 0);
    assert.deepEqual(player(finished, 'e').forces, { 'arrakeen:10': 2 });
    assert.equal(player(finished, 'a').moved, 1);
    assert.deepEqual(player(finished, 'a').forces, { 'imperial_basin:10': 2, 'arrakeen:10': 1 });
    assert.deepEqual(inventory(finished), original);
    assert.throws(() => applyAction(finished, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(player(claimed, 'r').hand.some(card => card.id === ornithopter.id), true);
  assert.equal(claimed.discard.some(card => card.id === semuta.id), true);
});

for (const recipient of ['a', 'r'] as const) void test(
  `Semuta claims battle Distrans to ${recipient} without repeating its private transfer or changing a sealed plan`, () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const distrans = take(g, 'richese-distrans');
  const weapon = take(g, g.deck.find(c => c.kind === 'projectile')!.id);
  player(g, 'e').hand.push(distrans, weapon);
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    response: null, decision: null, phaseOpening: null, movementRemaining: [] });
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
  }
  const original = inventory(g);
  let state = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  while (state.battle?.preparation)
    state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
  for (const id of ['a', 'e'])
    state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
  state = applyAction(state, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(state, 'e').leaders[0].id });
  const transfer = { type: 'card', card: distrans.id, target: recipient, give: weapon.id };
  const pending = applyAction(state, 'e', transfer);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id), [distrans.id]);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  for (const resumed of [declined, claimed]) {
    assert.equal(player(resumed, recipient).hand.filter(c => c.id === weapon.id).length, 1);
    assert.equal(player(resumed, 'e').hand.some(c => c.id === weapon.id || c.id === distrans.id), false);
    assert.deepEqual(resumed.battle, state.battle);
    assert.deepEqual(inventory(resumed), original);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, 'e', transfer));
    const planned = applyAction(resumed, 'a', { type: 'battlePlan', dial: 1, support: 0,
      leader: player(resumed, 'a').leaders[0].id, ...(recipient === 'a' ? { weapon: weapon.id } : {}) });
    if (recipient === 'a') assert.equal(planned.battle!.plans.a.weapon, weapon.id);
    assert.deepEqual(planned.battle!.plans.e, state.battle!.plans.e);
  }
  assert.equal(player(claimed, 'r').hand.some(c => c.id === distrans.id), true);
  assert.equal(player(claimed, 'r').hand.some(c => c.id === weapon.id), recipient === 'r');
  assert.equal(claimed.discard.some(c => c.id === semuta.id), true);
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

void test('a queued definite Truthtrance answer offers its card before the next reserved question resumes', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const truthA = take(g, 'truthtrance');
  const truthE = take(g, 'truthtrance');
  const shield = g.deck.splice(g.deck.findIndex(card => card.name === 'Shield'), 1)[0];
  assert.ok(shield);
  player(g, 'a').hand.push(truthA);
  player(g, 'e').hand.push(truthE, shield);
  Object.assign(g, { order: ['a', 'e', 'r'] });
  const original = inventory(g);
  let declared = applyAction(g, 'a', { type: 'card', card: truthA.id });
  declared = applyAction(declared, 'e', { type: 'card', card: truthE.id });
  while (declared.truthtrance?.stage === 'priority') {
    const responder = declared.players.find(p => !declared.truthtrance!.passed.includes(p.id))!;
    declared = applyAction(declared, responder.id, { type: 'truthPass' });
  }
  const queue = declared.truthtrance!.queue.map(entry => entry.player);
  assert.equal(queue.length, 2);
  const asked = applyAction(declared, queue[0], { type: 'truthAsk',
    question: { kind: 'fact', target: 'e', fact: { kind: 'hand', name: 'Shield' } },
  });
  const pending = applyAction(asked, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'truthtranceDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const continuation = pending.pendingTreacheryDiscard!.continuation;
  assert.deepEqual(continuation.kind === 'truthtranceDiscard' ? continuation.remaining?.queue.map(entry => entry.player) : null,
    queue.slice(1));
  assert.equal(pending.truthHistory?.length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  for (const resumed of [declined, claimed]) {
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.truthtrance?.stage, 'ask');
    assert.equal(resumed.truthtrance!.question, null);
    assert.deepEqual(resumed.truthtrance!.queue.map(entry => entry.player), queue.slice(1));
    assert.deepEqual(resumed.truthHistory, pending.truthHistory);
    assert.deepEqual(inventory(resumed), original);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event }));
  }
  assert.equal(declined.discard.filter(card => card.id === truthA.id).length, 1);
  assert.equal(player(claimed, 'r').hand.some(card => card.id === truthA.id), true);
  assert.equal(claimed.discard.some(card => card.id === semuta.id), true);
});

for (const answer of ['yes', 'no'] as const) void test(
  `Semuta preserves a ${answer} Truthtrance shipment promise through claim and decline`, () => {
    const { g, semuta, hajr } = fixture();
    player(g, 'a').hand = [];
    g.deck.push(hajr);
    const truth = take(g, 'truthtrance');
    player(g, 'a').hand.push(truth);
    Object.assign(g, { active: 'e', order: ['e', 'a', 'r'], movementRemaining: ['e', 'a', 'r'] });
    const original = inventory(g);
    let state = applyAction(g, 'a', { type: 'card', card: truth.id });
    while (state.truthtrance?.stage === 'priority') {
      const actor = state.players.find(p => !state.truthtrance!.passed.includes(p.id))!;
      state = applyAction(state, actor.id, { type: 'truthPass' });
    }
    state = applyAction(state, 'a', { type: 'truthAsk',
      question: { kind: 'shipment', target: 'e', territory: 'carthag', minimum: 2 } });
    const pending = applyAction(state, 'e', { type: 'truthAnswer', answer });
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(pending.shipmentPromises?.length, 1);
    assert.equal(pending.shipmentPromises![0].answer, answer === 'yes');
    const event = pending.pendingTreacheryDiscard!.batch.event;
    let declined = reload(pending);
    for (const id of ['e', 'a', 'r'])
      declined = applyAction(declined, id, { type: 'semutaPass', event });
    const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
    for (const resumed of [declined, claimed]) {
      assert.deepEqual(resumed.shipmentPromises, pending.shipmentPromises);
      assert.deepEqual(resumed.truthHistory, pending.truthHistory);
      assert.deepEqual(inventory(resumed), original);
      const wrong = answer === 'yes'
        ? { type: 'endMovement' }
        : { type: 'ship', territory: 'carthag', sector: 11, amount: 2 };
      assert.throws(() => applyAction(resumed, 'e', wrong));
      const legal = answer === 'yes'
        ? { type: 'ship', territory: 'carthag', sector: 11, amount: 2 }
        : { type: 'endMovement' };
      const fulfilled = applyAction(resumed, 'e', legal);
      assert.equal(fulfilled.shipmentPromises!.length, 1);
      assert.equal(fulfilled.shipmentPromises![0].fulfilled, true);
      assert.equal(fulfilled.truthHistory!.length, 1);
      if (answer === 'yes')
        assert.equal(player(fulfilled, 'e').forces['carthag:11'], 2);
      assert.deepEqual(inventory(fulfilled), original);
    }
    assert.equal(player(claimed, 'r').hand.some(card => card.id === truth.id), true);
    assert.equal(claimed.discard.some(card => card.id === semuta.id), true);
  });

void test('Semuta claims a battle Ghola without reviving twice or changing the sealed opposing plan', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const ghola = take(g, 'ghola');
  player(g, 'a').hand.push(ghola);
  const leader = player(g, 'a').leaders[0];
  Object.assign(leader, { dead: true, deaths: 1 });
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    decision: null, response: null, phaseOpening: null, movementRemaining: [] });
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
  }
  const original = inventory(g);
  let state = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  while (state.battle?.preparation)
    state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
  for (const id of ['a', 'e'])
    state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
  state = applyAction(state, 'e', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(state, 'e').leaders[0].id });
  const pending = applyAction(state, 'a', { type: 'card', card: ghola.id, leader: leader.id });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(player(pending, 'a').leaders[0].dead, false);
  assert.equal(player(pending, 'a').leaders[0].deaths, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  for (const resumed of [declined, claimed]) {
    assert.deepEqual(resumed.battle, pending.battle);
    assert.deepEqual(player(resumed, 'a').leaders, player(pending, 'a').leaders);
    assert.deepEqual(inventory(resumed), original);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, 'a', { type: 'card', card: ghola.id, leader: leader.id }));
    const planned = applyAction(resumed, 'a', { type: 'battlePlan', dial: 1, support: 0, leader: leader.id });
    assert.equal(planned.battle!.plans.a.leader, leader.id);
    assert.deepEqual(planned.battle!.plans.e, state.battle!.plans.e);
  }
  assert.equal(player(claimed, 'r').hand.some(c => c.id === ghola.id), true);
  assert.equal(claimed.discard.some(c => c.id === semuta.id), true);
});

void test('Semuta preserves an unsubmitted battle-plan promise through claim and decline', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const truth = take(g, 'truthtrance');
  player(g, 'a').hand.push(truth);
  Object.assign(g, { phase: 6, active: 'a', order: ['a', 'e', 'r'],
    decision: null, response: null, phaseOpening: null, movementRemaining: [] });
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
  }
  const original = inventory(g);
  let state = applyAction(g, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
  while (state.battle?.preparation)
    state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
  while (state.battle?.preLeader && !state.battle.preLeader.closed)
    for (const id of ['a', 'e'])
      if (!state.battle!.preLeader!.ready.includes(id))
        state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
  state = applyAction(state, 'a', { type: 'card', card: truth.id });
  while (state.truthtrance?.stage === 'priority') {
    const actor = state.players.find(p => !state.truthtrance!.passed.includes(p.id))!;
    state = applyAction(state, actor.id, { type: 'truthPass' });
  }
  state = applyAction(state, 'a', { type: 'truthAsk',
    question: { kind: 'battlePlan', target: 'e', territory: 'arrakeen',
      claim: { kind: 'dial', compare: 'gte', value: 2 } } });
  const pending = applyAction(state, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.battle?.truthPromises?.length, 1);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let declined = reload(pending);
  for (const id of ['a', 'e', 'r']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  const plan = (dial: number) => ({ type: 'battlePlan' as const, dial, support: 0,
    leader: player(pending, 'e').leaders[0].id });
  for (const resumed of [declined, claimed]) {
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.deepEqual(resumed.battle, pending.battle);
    assert.deepEqual(resumed.truthHistory, pending.truthHistory);
    assert.throws(() => applyAction(resumed, 'e', plan(0)));
    const planned = applyAction(resumed, 'e', plan(2));
    assert.equal(planned.battle!.plans.e.dial, 2);
    assert.equal(planned.battle!.truthPromises!.length, 1);
    assert.equal(planned.battle!.truthPromises![0].released ?? false, false);
    assert.deepEqual(inventory(planned), original);
  }
  assert.equal(player(claimed, 'r').hand.some(card => card.id === truth.id), true);
  assert.equal(claimed.discard.some(card => card.id === semuta.id), true);
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

void test('Semuta settles mandatory and winner discards before the original Harkonnen capture', () => {
  const { g, semuta, hajr } = fixture(false, false, true, 'harkonnen');
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const weapon = take(g, g.deck.find(c => c.kind === 'projectile')!.id);
  const defense = take(g, g.deck.find(c => c.kind === 'snooper')!.id);
  player(g, 'e').hand.push(weapon);
  player(g, 'a').hand.push(defense);
  for (const id of ['a', 'e']) {
    player(g, id).forces = { 'arrakeen:10': 5 };
    player(g, id).reserves = 15;
    for (const leader of player(g, id).leaders) leader.strength = 0;
  }
  Object.assign(g, { phase: 6, active: 'e', order: ['e', 'a', 'r'],
    response: null, decision: null, phaseOpening: null, ready: [] });
  const original = inventory(g);
  let state = applyAction(g, 'e', { type: 'chooseBattle', territory: 'arrakeen', target: 'a' });
  for (let step = 0; step < 40; step++) {
    if (state.response) {
      const actor = state.players.find(p => !state.response!.passed.includes(p.id))!;
      state = applyAction(state, actor.id, { type: 'passResponse' });
    } else if (state.battle?.preparation)
      state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
    else if (state.decision?.kind === 'fullPlanOffer')
      state = applyAction(state, state.decision.player, { type: 'decision', decline: true });
    else break;
  }
  for (const id of ['e', 'a'])
    state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
  state = applyAction(state, 'e', { type: 'battlePlan', dial: 2, support: 2,
    leader: player(state, 'e').leaders[0].id, weapon: weapon.id });
  state = applyAction(state, 'a', { type: 'battlePlan', dial: 0, support: 0,
    leader: player(state, 'a').leaders[0].id, defense: defense.id });
  for (const id of ['e', 'a']) state = applyAction(state, id, { type: 'traitorCall', call: false });
  assert.equal(state.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
  assert.equal(state.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(state.pendingCapture, { player: 'e', loser: 'a', territory: 'arrakeen' });
  const settled = (game: Game) => game.players.map(p => ({
    id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves, tanks: p.tanks,
    leaders: p.leaders,
  }));
  const pass = (game: Game) => {
    const event = game.pendingTreacheryDiscard!.batch.event;
    for (const id of ['e', 'a', 'r']) game = applyAction(game, id, { type: 'semutaPass', event });
    return game;
  };
  const mandatoryEvent = state.pendingTreacheryDiscard!.batch.event;
  const mandatoryClaim = applyAction(reload(state), 'r', { type: 'semutaCommit', event: mandatoryEvent });
  const mandatoryPass = pass(reload(state));
  assert.equal(player(mandatoryClaim, 'r').hand.some(c => c.id === defense.id), true);
  assert.deepEqual(settled(mandatoryClaim), settled(mandatoryPass));
  for (const resumed of [mandatoryClaim, mandatoryPass]) {
    assert.equal(resumed.decision?.kind, 'battleCards');
    assert.deepEqual(resumed.pendingCapture, state.pendingCapture);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event: mandatoryEvent }));
  }
  const winnerDiscard = applyAction(mandatoryPass, 'e', { type: 'decision', discard: [weapon.id] });
  assert.equal(winnerDiscard.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const winnerEvent = winnerDiscard.pendingTreacheryDiscard!.batch.event;
  const winnerClaim = applyAction(reload(winnerDiscard), 'r', { type: 'semutaCommit', event: winnerEvent });
  const winnerPass = pass(reload(winnerDiscard));
  assert.deepEqual(settled(winnerClaim), settled(winnerPass));
  assert.equal(player(winnerClaim, 'r').hand.some(c => c.id === weapon.id), true);
  assert.equal(winnerClaim.discard.filter(c => c.id === semuta.id).length, 1);
  assert.equal(winnerPass.discard.some(c => c.id === semuta.id), false);
  for (let resumed of [winnerClaim, winnerPass]) {
    assert.equal(resumed.decision?.kind, 'captureOffer');
    assert.deepEqual(resumed.pendingCapture, state.pendingCapture);
    resumed = applyAction(resumed, 'e', { type: 'decision', accept: true });
    while (resumed.response?.kind === 'capture') {
      const actor = resumed.players.find(p => !resumed.response!.passed.includes(p.id))!;
      resumed = applyAction(resumed, actor.id, { type: 'passResponse' });
    }
    assert.equal(resumed.decision?.kind, 'capturedLeader');
    const captive = player(resumed, 'a').leaders.find(l => l.capturedBy === 'e')!;
    assert.ok(captive);
    resumed = applyAction(resumed, 'e', { type: 'decision', mode: 'keep' });
    assert.equal(resumed.pendingCapture, null);
    assert.equal(player(resumed, 'a').leaders.filter(l => l.capturedBy === 'e').length, 1);
    assert.deepEqual(inventory(resumed), original);
    assert.throws(() => applyAction(resumed, 'r', { type: 'semutaCommit', event: winnerEvent }));
  }
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
