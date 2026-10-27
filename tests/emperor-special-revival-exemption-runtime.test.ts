import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actAdvancedRevivalOrder as act,
  advanceAdvancedRevivalOrder as advance,
  advancedRevivalOrderClean as clean,
  advancedRevivalOrderInventory as inventory,
  advancedRevivalOrderPlayer as player,
  type AdvancedRevivalOrderStep,
} from './fixture-advanced-revival-order';

/** A genuine Advanced lobby, native setup, paid shipment and Storm deaths.
 * Only original unopened starting-deal and Spice card positions are selected;
 * no played hand, force, Tank, revival counter or clock is assigned. */
function source() {
  let game = createGame('EMPERORSPECIAL', newPlayer('emperor', 'Emperor', 'emperor'), true, ['ix']);
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('tleilaxu', 'Tleilaxu', 'tleilaxu'));
  const actions: AdvancedRevivalOrderStep[] = [];
  const send = (actor: string, action: Action) => { game = act(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advance(game, until, actions); };
  for (const seat of game.players) send(seat.id, { type: 'ready' });
  send('emperor', { type: 'start', advancedPreview: true });
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(seat => seat.hand.length === 0));
  const originalCards = inventory(game);
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0);
  [game.deck[0], game.deck[index]] = [game.deck[index], game.deck[0]];
  const karama = game.deck[0].id;
  reach(state => state.status === 'playing');
  assert.ok(player(game, 'emperor').hand.some(card => card.id === karama));
  for (let position = 0; position < 4; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(from, 1)[0]);
  }
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'emperor' && clean(state));
  const beforeShipment = structuredClone(game);
  send('emperor', { type: 'ship', territory: 'hagga_basin', sector: 13, amount: 3, elite: 3, allyPayment: 0 });
  reach(clean);
  assert.equal(player(game, 'emperor').elites?.forces['hagga_basin:13'], 3);
  assert.equal(player(beforeShipment, 'emperor').spice - player(game, 'emperor').spice, 6);
  reach(state => state.turn === 2 && state.phase === 1);
  assert.equal(player(game, 'emperor').tanks, 3);
  assert.equal(player(game, 'emperor').elites?.tanks, 3);
  assert.equal(player(game, 'emperor').elites?.revived, 0);
  reach(state => state.turn === 2 && state.phase === 4 && clean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === 'emperor'));
  assert.deepEqual(inventory(game), originalCards);
  return { game, karama, originalCards, actions };
}

function special(game: Game, card: string, amount: number, elite: number): Game {
  return act(game, 'emperor', { type: 'card', mode: 'special', card, amount, elite });
}
function ordinary(game: Game): Game {
  return advance(act(game, 'emperor', { type: 'revive', amount: 1, elite: 1 }), clean);
}
function reject(game: Game, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, 'emperor', action));
  assert.deepEqual(game, before);
}

void test('Advanced Emperor may revive two extra Sardaukar after an ordinary elite revival', () => {
  const f = source();
  let game = ordinary(f.game);
  assert.equal(player(game, 'emperor').elites?.revived, 1);
  assert.equal(player(game, 'emperor').elites?.tanks, 2);
  const before = structuredClone(player(game, 'emperor'));
  game = advance(special(game, f.karama, 2, 2), clean);
  assert.equal(player(game, 'emperor').elites?.tanks, 0);
  assert.equal(player(game, 'emperor').elites?.reserves, before.elites!.reserves + 2);
  assert.equal(player(game, 'emperor').elites?.revived, 1);
  assert.equal(player(game, 'emperor').revived, before.revived);
  assert.equal(player(game, 'emperor').spice, before.spice);
  assert.equal(player(game, 'emperor').specialKaramaUsed, true);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('Advanced Emperor retains ordinary elite allowance after special two-Sardaukar revival', () => {
  const f = source();
  let game = advance(special(f.game, f.karama, 2, 2), clean);
  assert.equal(player(game, 'emperor').elites?.tanks, 1);
  assert.equal(player(game, 'emperor').elites?.revived, 0);
  assert.equal(player(game, 'emperor').revived, 0);
  game = ordinary(game);
  assert.equal(player(game, 'emperor').elites?.tanks, 0);
  assert.equal(player(game, 'emperor').elites?.revived, 1);
  assert.equal(player(game, 'emperor').revived, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('Advanced Emperor may use all three special slots for Sardaukar without exceeding real Tanks', () => {
  const f = source();
  reject(f.game, { type: 'card', mode: 'special', card: f.karama, amount: 4, elite: 4 });
  const game = advance(special(f.game, f.karama, 3, 3), clean);
  assert.equal(player(game, 'emperor').tanks, 0);
  assert.equal(player(game, 'emperor').elites?.tanks, 0);
  assert.equal(player(game, 'emperor').elites?.reserves, 5);
  assert.equal(player(game, 'emperor').elites?.revived, 0);
  assert.equal(player(game, 'emperor').revived, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('the minimal bot can use the special revival with three actual Sardaukar', () => {
  const f = source(), view = viewGame(f.game, 'emperor');
  view.players.find(seat => seat.id === 'emperor')!.bot = 'Easy';
  const action = botActions(view).find(candidate => candidate.type === 'card' && candidate.mode === 'special');
  assert.ok(action);
  assert.equal(action.amount, 3);
  assert.equal(action.elite, 3);
  const game = advance(act(f.game, 'emperor', action), clean);
  assert.equal(player(game, 'emperor').elites?.tanks, 0);
  assert.equal(player(game, 'emperor').elites?.revived, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});
