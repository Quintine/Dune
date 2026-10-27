import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
import { territory } from '../game/board';
import { baseDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import { quoteVictory } from '../game/victory-quote';

/** Controlled public board using five printed strongholds, one physically
 * placed mobile stronghold, and the original three-token stronghold bonus. */
function position(advanced = true): Game {
  const g = createGame('VICTORYORDER', newPlayer('ix', 'Ixians', 'ixians'), advanced);
  g.players.push(newPlayer('at', 'Atreides', 'atreides'));
  g.players.push(newPlayer('em', 'Emperor', 'emperor'));
  g.players.push(newPlayer('bg', 'Bene Gesserit', 'beneGesserit'));
  Object.assign(g, { status: 'playing', phase: 8, turn: 2, storm: 18,
    order: g.players.map(p => p.id), ready: [], phaseOpening: null,
    deck: baseDeck(), active: null, mobileStronghold: { location: 'red_chasm:7' },
    techTokens: createTechTokens() });
  for (const p of g.players) Object.assign(p, { hand: [], forces: {},
    reserves: 20, spice: 20, traitors: [], traitorChoices: [] });
  return g;
}
function holds(g: Game, id: string, ...names: string[]) {
  const player = g.players.find(p => p.id === id)!;
  player.forces = Object.fromEntries(names.map(name => [
    `${name}:${territory(name).sectors[0]}`, 1,
  ]));
}
function tech(g: Game, id: string) {
  for (const token of Object.values(g.techTokens!)) token.owner = id;
}
function actual(g: Game) {
  let result = structuredClone(g);
  result.phase = 7;
  for (const p of result.players) result = applyAction(result, p.id, { type: 'ready' });
  return result;
}

void test('Advanced awards the unallied higher qualified stronghold count, including a mobile and Tech stronghold', () => {
  const g = position();
  holds(g, 'ix', 'arrakeen', 'carthag', 'sietch_tabr');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  holds(g, 'at', 'tueks_sietch', 'habbanya_ridge_sietch');
  tech(g, 'at');
  const before = structuredClone(g);
  assert.deepEqual(quoteVictory(g).winner, ['ix']);
  assert.deepEqual(actual(g).winner, ['ix']);
  assert.deepEqual(g, before);
});

void test('equal qualified Advanced solo stronghold counts still share the win', () => {
  const g = position();
  holds(g, 'ix', 'arrakeen', 'carthag');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  holds(g, 'at', 'sietch_tabr', 'tueks_sietch', 'habbanya_ridge_sietch');
  assert.deepEqual(quoteVictory(g).winner, ['ix', 'at']);
  assert.deepEqual(actual(g).winner, ['ix', 'at']);
});

void test('the complete Tech set is one extra stronghold for comparing qualified solos', () => {
  const g = position();
  holds(g, 'ix', 'arrakeen', 'carthag');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  holds(g, 'at', 'sietch_tabr', 'tueks_sietch', 'habbanya_ridge_sietch');
  tech(g, 'at');
  assert.deepEqual(quoteVictory(g).winner, ['at']);
  assert.deepEqual(actual(g).winner, ['at']);
});

void test('Basic retains its existing shared-win policy for unequal qualified solos', () => {
  const g = position(false);
  holds(g, 'ix', 'arrakeen', 'carthag', 'sietch_tabr');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  holds(g, 'at', 'tueks_sietch', 'habbanya_ridge_sietch');
  tech(g, 'at');
  assert.deepEqual(quoteVictory(g).winner, ['ix', 'at']);
  assert.deepEqual(actual(g).winner, ['ix', 'at']);
});

void test('a qualifying alliance and solo still share an Advanced win regardless of their totals', () => {
  const g = position();
  g.players[1].ally = 'em'; g.players[2].ally = 'at';
  holds(g, 'at', 'arrakeen', 'carthag');
  holds(g, 'em', 'sietch_tabr');
  tech(g, 'at');
  holds(g, 'ix', 'tueks_sietch', 'habbanya_ridge_sietch');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  assert.deepEqual(quoteVictory(g).winner, ['ix', 'at', 'em']);
  const offered = actual(g);
  assert.ok(offered.victoryContinuation);
  const settled = applyAction(offered, offered.victoryContinuation.voters[0], {
    type: 'victoryContinuation', event: offered.victoryContinuation.event, mode: 'finish',
  });
  assert.deepEqual(settled.winner, ['ix', 'at', 'em']);
});

void test('Bene Gesserit prediction uses the actual higher solo winner, not the lower qualifier', () => {
  const g = position();
  holds(g, 'ix', 'arrakeen', 'carthag', 'sietch_tabr');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
  holds(g, 'at', 'tueks_sietch', 'habbanya_ridge_sietch');
  tech(g, 'at');
  g.players[3].prediction = { faction: 'atreides', turn: 2 };
  assert.deepEqual(quoteVictory(g).winner, ['ix']);
  assert.deepEqual(actual(g).winner, ['ix']);
  g.players[3].prediction = { faction: 'ixians', turn: 2 };
  assert.deepEqual(quoteVictory(g).winner, ['bg']);
  assert.deepEqual(actual(g).winner, ['bg']);
});
