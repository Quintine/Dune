import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EcazSetup } from '../components/ecaz-setup';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { ECAZ_START_LOCATIONS } from '../game/ecaz-setup';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function pending(advanced = false) {
  let game = createGame('ECAZSETU', newPlayer('e', 'Ecaz', 'ecaz'), advanced, [
    'ecaz',
  ]);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game = initializeFactionExpansionsGameForAudit(game);
  while (game.setupStage === 'traitors') {
    const player = game.players.find((p) => p.traitorChoices.length)!;
    game = applyAction(game, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  assert.equal(game.setupStage, 'forces');
  assert.deepEqual(
    game.players.map((p) => p.hand.length),
    [0, 0],
  );
  assert.deepEqual(game.setupStage && viewGame(game, 'e').setupPending, ['e']);
  return game;
}

function markup(game: Game, viewer = 'e', busy = false) {
  return renderToStaticMarkup(
    createElement(EcazSetup, { game: viewGame(game, viewer), act() {}, busy }),
  );
}

void test('Ecaz setup presents three sector allocations only to its pending owner, before cards are dealt', () => {
  for (const advanced of [false, true]) {
    const game = pending(advanced);
    const html = markup(game);
    assert.match(html, /Ecaz starting forces/);
    assert.match(html, /fourteen forces remain in reserves/);
    for (const location of ECAZ_START_LOCATIONS)
      assert.ok(html.includes(`ecaz-start-${location}`));
    assert.match(html, /6 \/ 6 forces assigned/);
    assert.match(html, /Place Ecaz starting forces/);
    assert.equal(markup(game, 'g'), '');
    assert.equal(
      (
        markup(game, 'e', true).match(
          /<(?:input|button)\b[^>]*\sdisabled=""/g,
        ) ?? []
      ).length,
      4,
    );
    const placed = applyAction(JSON.parse(JSON.stringify(game)), 'e', {
      type: 'ecazSetup',
      placements: Object.fromEntries(
        ECAZ_START_LOCATIONS.map((location) => [location, 2]),
      ),
    });
    assert.equal(markup(placed), '');
    assert.equal(placed.players[0].reserves, 14);
    assert.deepEqual(
      placed.players.map((p) => p.hand.length),
      [1, 1],
    );
  }
});

void test('every AI profile supplies a legal Ecaz allocation and other seats wait for placement', () => {
  for (const difficulty of DIFFICULTIES) {
    const game = pending(true);
    const view = viewGame(game, 'e');
    view.players[0].bot = difficulty;
    const actions = botActions(view);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'ecazSetup');
    const result = applyAction(game, 'e', actions[0]);
    assert.equal(result.players[0].reserves, 14);
    assert.equal(
      Object.values(result.players[0].forces).reduce(
        (sum, count) => sum + count,
        0,
      ),
      6,
    );
    const other = viewGame(game, 'g');
    other.players[1].bot = difficulty;
    assert.deepEqual(botActions(other), []);
  }
});
