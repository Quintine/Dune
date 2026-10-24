import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { createTruthMovementShipmentFixture } from './fixture-truth-movement-shipment';
import { actTruthMovement as act, truthMovementPlayer as player } from './fixture-truth-movement';
import { createTruthMovementGholaFixture as native, createTruthMovementBoxGholaFixture as box,
  truthMovementGholaInventory as inventory } from './fixture-truth-movement-ghola';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function ask(game: Game, asker: string, card: string, target: string, minimum = 20) {
  game = act(game, asker, { type: 'card', card });
  while (game.truthtrance?.stage === 'priority') {
    const p = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(p);
    game = act(game, p.id, { type: 'truthPass' });
  }
  return act(game, asker, { type: 'truthAsk', question: { kind: 'movement', target, territory: 'carthag', minimum } });
}

void test('a controlled conserved Ghola and one Tank make the otherwise missing twentieth movement counter reachable', () => {
  const f = createTruthMovementShipmentFixture({ hajr: false }), source = structuredClone(f.game);
  const p = player(source, f.target); p.reserves--; p.tanks++;
  const index = source.deck.findIndex(card => card.effect === 'ghola'); assert.ok(index >= 0);
  p.hand.push(source.deck.splice(index, 1)[0]);
  // Explicit prior casualty/original-card acquisition, not a natural loss source.
  const game = ask(source, f.asker, f.truth, f.target);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
});

function settle(game: Game): Game {
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  while (game.response) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = act(game, p.id, { type: 'passResponse' });
  }
  return game;
}
function bind(f: ReturnType<typeof native> | ReturnType<typeof box>, source = f.game) {
  const asked = ask(source, f.asker, f.truth, f.target);
  assert.ok(viewGame(asked, f.target).truthMovementAnswers!.includes('yes'));
  return settle(act(asked, f.target, { type: 'truthAnswer', answer: 'yes' }));
}
function next(game: Game, target: string) {
  const action = viewGame(game, target).movementPromisePolicy?.[0]; assert.ok(action); return action;
}
void test('an original held Ghola returns the real Storm casualty before paid shipment and twenty-force ground movement', () => {
  const f = native(); let game = bind(f);
  const before = structuredClone(game), quotas = [player(game).revived, player(game).freeForcesRevived, player(game).leaderRevived];
  assert.deepEqual(next(game, f.target), f.gholaStep.action);
  assert.deepEqual(game, before, 'Forecast cannot play the live card or return a live counter');
  game = settle(act(game, f.target, next(game, f.target)));
  assert.equal(player(game).tanks, 0); assert.equal(player(game).reserves, 10);
  assert.equal(player(game).spice, 10); assert.equal(player(game).shipped, false);
  assert.deepEqual([player(game).revived, player(game).freeForcesRevived, player(game).leaderRevived], quotas);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  assert.equal(next(game, f.target).type, 'ship');
  game = settle(act(game, f.target, f.shipment));
  assert.equal(player(game).spice, 0); assert.equal(player(game).forces['arrakeen:10'], 20);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = settle(act(game, f.target, f.move));
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = act(game, f.target, f.endMovement); assert.deepEqual(inventory(game), f.originalCards);
});
void test('Ghola returns reserves but cannot replace a shipment already spent before the question', () => {
  const f = native();
  const source = settle(act(f.game, f.target, { ...f.shipment, amount: 9 }));
  assert.equal(player(source).forces['arrakeen:10'], 19); assert.equal(player(source).tanks, 1);
  const game = ask(source, f.asker, f.truth, f.target);
  assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['no']);
});
void test('the original publicly spent Ghola is recovered with a real Box fee and its complete paid choice', () => {
  const f = box(); let game = bind(f);
  assert.deepEqual(next(game, f.target), f.boxStep.action);
  game = act(game, f.target, next(game, f.target));
  assert.equal(player(game).spice, 11);
  const search = viewGame(game, f.target).nullentropy!.search!;
  assert.ok(search.cards.some(card => card.id === f.ghola)); assert.ok(search.cards.some(card => card.id === f.truth));
  assert.deepEqual(next(game, f.target), { type: 'decision', event: search.event, card: f.ghola });
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'decision', event: search.event, card: f.truth }));
  assert.deepEqual(game, before, 'Wrong selection retains the actual paid event, cards and fee');
  game = settle(act(game, f.target, next(game, f.target)));
  assert.deepEqual(next(game, f.target), f.gholaStep.action);
  game = settle(act(game, f.target, f.gholaStep.action));
  game = settle(act(game, f.target, f.shipment)); game = settle(act(game, f.target, f.move));
  assert.equal(game.movementPromises![0].fulfilled, true); assert.equal(player(game).spice, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});
void test('controlled hidden discard knowledge cannot supply an unpaid Ghola recovery witness', () => {
  const f = box(), source = structuredClone(f.game);
  // A knowledge-boundary projection, not a claim that the source's public play was hidden.
  delete source.movementDiscardKnowledge;
  const game = ask(source, f.asker, f.truth, f.target);
  assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['no']);
});
void test('a controlled conserved Ghola plus Box can return ten Tanks by reusing the single original Ghola', () => {
  const f = box(), source = structuredClone(f.game), owner = player(source);
  // Explicit prior acquisition/loss projection. No second Ghola is manufactured:
  // the source's original public card moves to hand; nine reserves join Tanks.
  const index = source.discard.findIndex(card => card.id === f.ghola); assert.ok(index >= 0);
  owner.hand.push(source.discard.splice(index, 1)[0]); owner.tanks += owner.reserves; owner.reserves = 0;
  let game = bind(f, source), plays = 0, searches = 0;
  for (let count = 0; count < 6 && !game.movementPromises![0].fulfilled; count++) {
    const action = next(game, f.target);
    if (action.type === 'card' && action.card === f.ghola) { assert.equal(action.amount, 5); plays++; }
    if (action.type === 'card' && action.card === f.box) searches++;
    game = settle(act(game, f.target, action));
  }
  assert.equal(plays, 2); assert.equal(searches, 1);
  assert.equal(game.movementPromises![0].fulfilled, true); assert.equal(player(game).tanks, 0);
  assert.equal(player(game).spice, 1); assert.deepEqual(inventory(game), f.originalCards);
});
void test('a controlled acquired original counter keeps native Ghola income conditional without speculative forecast credit', () => {
  const f = native({ tleilaxu: true }), source = structuredClone(f.game);
  // Conserved original-card acquisition keeps the real counter window open.
  const counter = source.deck.findIndex(card => card.effect === 'karama'); assert.ok(counter >= 0);
  player(source, f.asker).hand.push(source.deck.splice(counter, 1)[0]);
  let game = bind(f, source);
  const income = player(game, 'tleilaxu').spice;
  assert.deepEqual(next(game, f.target), f.gholaStep.action);
  assert.equal(player(game, 'tleilaxu').spice, income);
  game = act(game, f.target, f.gholaStep.action);
  assert.equal(player(game).reserves, 10); assert.equal(player(game).tanks, 0);
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  assert.equal(game.response?.kind, 'revivalIncome');
  assert.equal(player(game, 'tleilaxu').spice, income);
  game = settle(game); assert.equal(player(game, 'tleilaxu').spice, income + 1);
  game = settle(act(game, f.target, f.shipment)); game = settle(act(game, f.target, f.move));
  assert.equal(game.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});
void test('all minimal profiles play the actual held Ghola, reinforce and fulfill the same ground promise', () => {
  const f = native(), bound = bind(f);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(bound);
    for (let count = 0; count < 5 && !game.movementPromises![0].fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      const options = botActions(view); let accepted = false;
      for (const action of options) {
        try { game = settle(act(game, f.target, action)); accepted = true; break; } catch { /* try next legal proposal */ }
      }
      assert.ok(accepted, difficulty);
    }
    assert.equal(game.movementPromises![0].fulfilled, true, difficulty);
    assert.equal(player(game).tanks, 0); assert.deepEqual(inventory(game), f.originalCards);
  }
});
