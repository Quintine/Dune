import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, createGame, newPlayer, viewGame, type Game} from '../game/engine';
import {baseDeck} from '../game/cards';
import {richeseCards} from '../game/richese-cards';

function fixture(advanced = false, phase = 3) {
  const g = createGame('GIFTENGINE', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  g.players.push(newPlayer('a', 'Ally', 'atreides'), newPlayer('o', 'Observer', 'emperor'));
  g.status = 'playing'; g.turn = 2; g.phase = phase; g.active = 'a'; g.order = ['r', 'a', 'o'];
  g.players[0].ally = 'a'; g.players[1].ally = 'r';
  g.deck = baseDeck(); g.richeseCache = richeseCards();
  for (const p of g.players) {p.hand = []; p.spice = 10; p.forces = {};}
  return g;
}
function take(g: Game, cardId: string) {
  const card = g.richeseCache!.find(c => c.id === cardId)!;
  assert.ok(card); g.richeseCache = g.richeseCache!.filter(c => c.id !== cardId);
  g.players[0].hand.push(card); return card;
}
function counter(g: Game) {
  const index = g.deck.findIndex(c => c.effect === 'karama');
  const card = g.deck.splice(index, 1)[0]; g.players[2].hand.push(card); return card;
}
function gift(g: Game, cardId: string) {return applyAction(g, 'r', {type: 'richeseGift', card: cardId});}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('every canonical Richese card transfers once in Basic and Advanced across all nine phases without acquisition effects', () => {
  for (const advanced of [false, true]) for (let phase = 0; phase < 9; phase++) for (const card of richeseCards()) {
    const g = fixture(advanced, phase); take(g, card.id);
    const before = structuredClone(g), next = gift(g, card.id);
    assert.deepEqual(g, before);
    assert.deepEqual(next.players[0].hand, []);
    assert.deepEqual(next.players[1].hand, [card]);
    assert.deepEqual(next.deck, g.deck); assert.deepEqual(next.discard, g.discard);
    assert.deepEqual(next.richeseCache, g.richeseCache);
    assert.deepEqual(next.players.map(p => p.spice), [10, 10, 10]);
    assert.equal(next.phase, phase); assert.equal(next.turn, 2);
    assert.equal(next.pendingRicheseGift, null);
    assert.throws(() => gift(next, card.id));
  }
});
void test('pending exact gift is private to its two participants, never leaks card identity in public history, and restores ready flags', () => {
  const g = fixture(); const card = take(g, 'richese-distrans'); counter(g);
  g.players[0].ready = true; g.players[2].ready = true;
  const pending = gift(g, card.id);
  assert.equal(pending.response?.kind, 'richeseGift');
  for (const id of ['r', 'a']) assert.equal(viewGame(pending, id).richeseGift?.pending?.card?.id, card.id);
  assert.equal(viewGame(pending, 'o').richeseGift, null);
  assert.equal(JSON.stringify(viewGame(pending, 'o')).includes(card.id), false);
  const next = applyAction(reload(pending), 'o', {type: 'passResponse'});
  assert.deepEqual(next.players.map(p => p.ready), [true, false, true]);
  assert.equal(next.log.some(entry => entry.text.includes(card.name) || entry.text.includes(card.id)), false);
  assert.deepEqual(next.players[1].hand, [card]);
});
void test('a canceled gift can be retried in the same phase, with a fresh counter window and original custody', () => {
  const g = fixture(); const card = take(g, 'richese-karama'), first = counter(g), second = counter(g);
  const parent = {kind: 'richeseDeclaration' as const, player: 'r'};
  g.decision = parent;
  const inventory = (state: Game) => [...state.deck, ...state.discard, ...state.richeseCache!, ...state.players.flatMap(p => p.hand)].map(c => c.id).sort();
  const original = inventory(g);
  const pending = gift(g, card.id);
  assert.equal(pending.decision, null);
  const canceled = applyAction(reload(pending), 'o', {type: 'card', mode: 'cancel', card: first.id});
  assert.deepEqual(canceled.decision, parent);
  assert.deepEqual(canceled.players[0].hand, [card]);
  assert.deepEqual(canceled.players[1].hand, []);
  assert.equal(canceled.discard.filter(c => c.id === first.id).length, 1);
  assert.ok(viewGame(canceled, 'r').richeseGift!.cards.some(c => c.id === card.id));
  const retry = gift(reload(canceled), card.id);
  assert.equal(retry.response?.kind, 'richeseGift');
  assert.notEqual(retry.pendingRicheseGift!.event, pending.pendingRicheseGift!.event);
  assert.deepEqual(retry.players[0].hand, [card]);
  assert.ok(retry.players[2].hand.some(c => c.id === second.id));
  assert.deepEqual(inventory(retry), original);
  const allowed = applyAction(reload(retry), 'o', {type: 'passResponse'});
  assert.deepEqual(allowed.decision, parent);
  assert.deepEqual(allowed.players[0].hand, []);
  assert.deepEqual(allowed.players[1].hand, [card]);
  assert.ok(allowed.players[2].hand.some(c => c.id === second.id));
  assert.deepEqual(inventory(allowed), original);
  assert.throws(() => gift(allowed, card.id));
});
void test('repeated same-phase cancellation costs each physical Karama once and allows the original gift afterward', () => {
  const g = fixture(); const card = take(g, 'richese-distrans'), first = counter(g), second = counter(g);
  const inventory = (state: Game) => [...state.deck, ...state.discard, ...state.richeseCache!, ...state.players.flatMap(p => p.hand)].map(c => c.id).sort();
  const original = inventory(g);
  let current = g;
  for (const k of [first, second]) {
    const pending = gift(reload(current), card.id);
    assert.equal(pending.response?.kind, 'richeseGift');
    current = applyAction(reload(pending), 'o', {type: 'card', mode: 'cancel', card: k.id});
    assert.equal(current.phase, g.phase);
    assert.deepEqual(current.players[0].hand, [card]);
    assert.deepEqual(current.players[1].hand, []);
    assert.equal(current.discard.filter(c => c.id === k.id).length, 1);
    assert.deepEqual(inventory(current), original);
  }
  const transferred = gift(reload(current), card.id);
  assert.deepEqual(transferred.players[0].hand, []);
  assert.deepEqual(transferred.players[1].hand, [card]);
  assert.equal(transferred.discard.filter(c => c.id === first.id || c.id === second.id).length, 2);
  assert.deepEqual(inventory(transferred), original);
});
void test('capacity changed during recovery aborts without consuming, discarding or replacing any hand card', () => {
  const g = fixture(); const card = take(g, 'richese-karama'); counter(g);
  const pending = gift(g, card.id);
  pending.players[1].hand = pending.deck.splice(0, 4);
  const before = pending.players.map(p => p.hand);
  const next = applyAction(reload(pending), 'o', {type: 'passResponse'});
  assert.deepEqual(next.players.map(p => p.hand), before);
  assert.equal(next.pendingRicheseGift, null);
  assert.match(next.log.at(-1)!.text, /became unavailable/);
});
void test('only exact canonical cards held by Richese can be gifted to a mutual ally; all rejected inputs remain unchanged', () => {
  for (const mutate of [
    (g: Game) => {g.players[0].hand[0].name = 'Forged identity';},
    (g: Game) => {g.players[1].ally = null;},
    (g: Game) => {g.players[0].hand = [];},
    (g: Game) => {g.players[0].faction = 'choam';},
  ]) {
    const g = fixture(); take(g, 'richese-karama'); mutate(g); const before = structuredClone(g);
    assert.throws(() => gift(g, 'richese-karama')); assert.deepEqual(g, before);
  }
});
