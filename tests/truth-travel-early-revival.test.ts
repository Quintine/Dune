import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

/** Controlled conserved native resources isolate joint quote compatibility.
 * Both original physical Truths are present; every promise is made through
 * actual declare/priority/Ask/answer actions. No setup/casualty history claimed. */
function controlled(spice = 2) {
  const game = createGame('EARLYTRAVELREVIVAL', newPlayer('a', 'Asker', 'harkonnen'), false);
  game.players.push(newPlayer('p', 'Emperor', 'emperor'), newPlayer('o', 'Other', 'atreides'));
  Object.assign(game, { status: 'playing', phase: 4, turn: 2, storm: 18, active: 'p',
    order: ['p', 'a', 'o'], movementRemaining: ['p', 'a', 'o'], ready: [], deck: baseDeck(), discard: [] });
  for (const player of game.players) {
    player.hand = []; player.forces = {}; player.reserves = 20; player.spice = 10; player.traitorChoices = [];
  }
  const target = game.players[1]; target.reserves = 17; target.tanks = 3; target.spice = spice;
  const cards = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(cards.length, 2);
  game.deck = game.deck.filter(card => card.effect !== 'truthtrance'); game.players[0].hand = cards;
  const inventory = (g: Game) => [...g.deck, ...g.discard, ...g.players.flatMap(player => player.hand)].map(card => card.id).sort();
  return { game, truths: cards.map(card => card.id), inventory, original: inventory(game) };
}
function ask(game: Game, card: string, question: unknown) {
  game = applyAction(game, 'a', { type: 'card', card });
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(player);
    game = applyAction(game, player.id, { type: 'truthPass' });
  }
  return applyAction(game, 'a', { type: 'truthAsk', question });
}
const revival = { kind: 'revival', target: 'p', turn: 2, counter: 'total', minimum: 2 };
const travel = { kind: 'travel', target: 'p', turn: 2, mixed: { kind: 'and', terms: [
  { kind: 'action', action: { kind: 'ship', territory: 'arrakeen', minimum: 1 } },
  { kind: 'action', action: { kind: 'move', territory: 'carthag', minimum: 1 } },
] } };
void test('controlled earlier Revival Yes prevents a later travel Yes from spending the same last spice', () => {
  const f = controlled(); let game = ask(f.game, f.truths[0], revival);
  assert.ok(viewGame(game, 'p').truthRevivalAnswers?.includes('yes'));
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.truths[1], travel);
  assert.deepEqual(viewGame(game, 'p').truthTravelAnswers, ['no']);
  const before = structuredClone(game); assert.throws(() => applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' }));
  assert.deepEqual(game, before);
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'no' });
  game = applyAction(game, 'p', { type: 'revive', amount: 2 });
  assert.equal(game.players[1].spice, 0); assert.equal(game.players[1].reserves, 19);
  assert.equal(game.revivalPromises?.[0].fulfilled, true); assert.equal(game.travelPromises?.[0].released, false);
  game = applyAction(game, 'p', { type: 'ready' }); assert.ok(game.ready.includes('p'));
  assert.deepEqual(f.inventory(game), f.original);
});
void test('controlled earlier travel Yes prevents a later paid Revival Yes while leaving the compatible No legal', () => {
  const f = controlled(); let game = ask(f.game, f.truths[0], travel);
  assert.ok(viewGame(game, 'p').truthTravelAnswers?.includes('yes'));
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.truths[1], revival);
  assert.deepEqual(viewGame(game, 'p').truthRevivalAnswers, ['no']);
  const before = structuredClone(game); assert.throws(() => applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' }));
  assert.deepEqual(game, before);
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'no' });
  game = applyAction(game, 'p', { type: 'ready' }); assert.ok(game.ready.includes('p'));
  assert.equal(game.travelPromises?.[0].released, false); assert.equal(game.travelPromises?.[0].fulfilled, false);
  assert.deepEqual(f.inventory(game), f.original);
});

void test('controlled compatible Revival and travel Yes use the required real return before offering Revival Ready', () => {
  const f = controlled(3); let game = ask(f.game, f.truths[0], revival);
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.truths[1], travel);
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
  const guide = viewGame(game, 'p').travelPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive'); assert.equal(guide.action.amount, 2);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'p'); view.players.find(player => player.id === 'p')!.bot = difficulty;
    const action = botActions(view)[0]; assert.deepEqual(action, view.travelPromiseGuide!.action);
    const done = applyAction(game, 'p', action); assert.equal(done.revivalPromises?.[0].fulfilled, true);
  }
  game = applyAction(game, 'p', guide.action);
  assert.equal(game.revivalPromises?.[0].fulfilled, true); assert.equal(game.players[1].spice, 1);
  const ready = viewGame(game, 'p').travelPromiseGuide; assert.ok(ready); assert.equal(ready.action.type, 'ready');
  game = applyAction(game, 'p', ready.action); assert.ok(game.ready.includes('p'));
  assert.equal(game.travelPromises?.[0].released, false); assert.deepEqual(f.inventory(game), f.original);
});
