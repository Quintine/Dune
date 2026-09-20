import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  STORM_CARD_DISTANCES,
  isStormCardDistance,
  stormCardDistance,
} from '../game/storm-cards';
import {
  confirmDiscoveryStorm,
  discoveryStormFixture,
} from './fixture-discovery-storm';
import { discoveryFixture } from './fixture-discovery';
import { placeFixtureHand } from './fixture-hand';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function advancedStormGame() {
  const game = discoveryFixture(true);
  game.players.forEach((_, index) => placeFixtureHand(game, index, []));
  assert.equal(game.status, 'playing');
  assert.equal(game.advanced, true);
  return game;
}

function readyAll(state: Game) {
  let game = state;
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  return game;
}

function allowResponses(state: Game) {
  let game = state;
  while (game.response) {
    const responder = game.players.find(
      (player) => !game.response!.passed.includes(player.id),
    );
    assert.ok(responder, 'a pending response has a responder');
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  return game;
}

function forecastOpportunity(withKarama = true) {
  let game = advancedStormGame();
  let karama: ReturnType<typeof baseDeck>[number] | undefined;
  if (withKarama) {
    karama = baseDeck().find((card) => card.effect === 'karama')!;
    placeFixtureHand(
      game,
      game.players.findIndex((player) => player.id === 'a'),
      [karama],
    );
  }
  for (const dialer of game.stormDialers)
    game = applyAction(game, dialer, { type: 'stormDial', amount: 0 });
  game = readyAll(game);
  assert.equal(game.response?.kind, 'stormPeek');
  assert.ok(isStormCardDistance(game.stormCard));
  return { game, face: game.stormCard, karama };
}

function revealedStorm() {
  const opportunity = forecastOpportunity();
  let game = allowResponses(opportunity.game);
  assert.equal(viewGame(game, 'f').stormForecast, opportunity.face);
  game.phase = 8;
  game.ready = [];
  game = readyAll(game);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 0);
  assert.equal(game.stormPending, opportunity.face);
  return { game, face: opportunity.face };
}

function receiptFaces(game: { log: readonly { component?: unknown }[] }) {
  return game.log.flatMap((entry) => {
    const distance = stormCardDistance(entry.component);
    return distance === null ? [] : [distance];
  });
}

void test('the six-card catalog and structured receipt guard accept only exact canonical faces', () => {
  assert.deepEqual(STORM_CARD_DISTANCES, [1, 2, 3, 4, 5, 6]);
  for (const distance of STORM_CARD_DISTANCES) {
    assert.equal(isStormCardDistance(distance), true);
    assert.equal(stormCardDistance({ kind: 'stormCard', distance }), distance);
  }
  for (const invalid of [
    null,
    [],
    'stormCard',
    { kind: 'stormCard' },
    { distance: 1 },
    { kind: 'storm-card', distance: 1 },
    { kind: 'stormCard', distance: 0 },
    { kind: 'stormCard', distance: 7 },
    { kind: 'stormCard', distance: 1.5 },
    { kind: 'stormCard', distance: 1, extra: true },
  ])
    assert.equal(stormCardDistance(invalid), null);
  for (const invalid of [0, 7, 1.5, NaN, '1', null])
    assert.equal(isStormCardDistance(invalid), false);
});

void test('a forecast remains private until allowed, cancellation hides it, and neither path publishes a component receipt', () => {
  const acceptedOpportunity = forecastOpportunity();
  assert.equal(viewGame(acceptedOpportunity.game, 'f').stormForecast, null);
  assert.equal(viewGame(acceptedOpportunity.game, 'a').stormForecast, null);
  assert.deepEqual(receiptFaces(acceptedOpportunity.game), []);
  const accepted = allowResponses(acceptedOpportunity.game);
  assert.equal(viewGame(accepted, 'f').stormForecast, acceptedOpportunity.face);
  assert.equal(viewGame(accepted, 'a').stormForecast, null);
  assert.deepEqual(receiptFaces(accepted), []);

  const canceledOpportunity = forecastOpportunity(true);
  const canceled = applyAction(canceledOpportunity.game, 'a', {
    type: 'card',
    card: canceledOpportunity.karama!.id,
    mode: 'cancel',
  });
  assert.equal(viewGame(canceled, 'f').stormForecast, null);
  assert.equal(viewGame(canceled, 'a').stormForecast, null);
  assert.equal(canceled.stormCard, canceledOpportunity.face);
  assert.deepEqual(receiptFaces(canceled), []);
});

void test('the actual next-turn reveal publishes one face to every view and survives JSON restoration without replay', () => {
  const revealed = revealedStorm();
  assert.deepEqual(receiptFaces(revealed.game), [revealed.face]);
  for (const player of revealed.game.players)
    assert.deepEqual(receiptFaces(viewGame(revealed.game, player.id)), [
      revealed.face,
    ]);

  const restored = reload(revealed.game);
  assert.deepEqual(receiptFaces(restored), [revealed.face]);
  viewGame(restored, 'f');
  viewGame(restored, 'a');
  assert.deepEqual(receiptFaces(restored), [revealed.face]);

  const legacy = reload(restored);
  for (const entry of legacy.log) delete entry.component;
  assert.doesNotThrow(() => viewGame(legacy, 'f'));
  assert.deepEqual(receiptFaces(legacy), []);
});

void test('Weather Control changes effective movement without rewriting the revealed Storm Card receipt', () => {
  const revealed = revealedStorm();
  let game = revealed.game;
  const weather = baseDeck().find((card) => card.effect === 'weather')!;
  placeFixtureHand(
    game,
    game.players.findIndex((player) => player.id === 'a'),
    [weather],
  );
  const replacement = revealed.face === 6 ? 5 : 6;
  game = applyAction(game, 'a', {
    type: 'card',
    card: weather.id,
    amount: replacement,
  });
  assert.equal(game.stormPending, replacement);
  assert.equal(game.stormMovementSource?.kind, 'weather');
  assert.deepEqual(receiptFaces(game), [revealed.face]);
  assert.deepEqual(receiptFaces(viewGame(game, 'f')), [revealed.face]);
});

void test('Ecological Testing Station changes card movement while retaining the original public face', () => {
  let game = discoveryStormFixture(true);
  assert.equal(game.stormPending, 2);
  assert.deepEqual(receiptFaces(game), [2]);
  game = confirmDiscoveryStorm(game);
  assert.equal(game.decision?.kind, 'ecologicalStorm');
  game = applyAction(game, 'a', {
    type: 'decision',
    event: game.ecologicalStorm!.event,
    delta: 1,
  });
  assert.equal(game.storm, 9);
  assert.equal(game.phase, 1);
  assert.deepEqual(receiptFaces(game), [2]);
  for (const player of game.players)
    assert.deepEqual(receiptFaces(viewGame(game, player.id)), [2]);
});
