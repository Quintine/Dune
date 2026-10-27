import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinControlledFaction, newPlayer, viewGame, type Game,
} from '../game/engine';
import { runBots } from '../game/bots';

/** One real human controls two separately authenticated faction seats. */
function humanPair(): Game {
  let g = createGame('TWOBOT01', newPlayer('human', 'Human', 'atreides'));
  g = applyAction(g, 'human', { type: 'twoPlayerMode', enabled: true });
  joinControlledFaction(g, newPlayer('second', 'Human second', 'harkonnen'), 'human');
  return g;
}
function botPrimary(g: Game): { game: Game; id: string } {
  const game = applyAction(g, 'human', { type: 'addBot', faction: 'emperor', difficulty: 'Medium' });
  const bot = game.players.find(player => player.faction === 'emperor')!;
  assert.ok(bot.bot);
  return { game, id: bot.id };
}
function botPair(g: Game): { game: Game; primary: string; secondary: string } {
  const first = botPrimary(g);
  const game = applyAction(first.game, 'human', {
    type: 'addControlledBot', controller: first.id, faction: 'guild', difficulty: 'Medium',
  });
  const secondary = game.players.find(player => player.faction === 'guild')!;
  assert.ok(secondary.bot);
  return { game, primary: first.id, secondary: secondary.id };
}
function unchanged(g: Game, action: () => unknown) {
  const before = structuredClone(g);
  assert.throws(action);
  assert.deepEqual(g, before);
}

void test('a preexisting bot remains ready when enabling the two-controller lobby', () => {
  let g = createGame('TWOBOT02', newPlayer('human', 'Human', 'atreides'));
  g = applyAction(g, 'human', { type: 'addBot', faction: 'emperor', difficulty: 'Easy' });
  const bot = g.players.find(player => player.bot)!;
  assert.equal(bot.ready, true);
  g = applyAction(g, 'human', { type: 'twoPlayerMode', enabled: true });
  assert.equal(g.players.find(player => player.id === bot.id)!.ready, true);
  assert.equal(g.players.find(player => player.id === 'human')!.ready, false);
  assert.deepEqual(g.twoPlayerControllers!.controllers.map(controller => controller.seats), [['human'], [bot.id]]);
  g = applyAction(g, 'human', { type: 'addControlledBot', controller: bot.id, faction: 'guild', difficulty: 'Easy' });
  assert.equal(g.twoPlayerControllers!.controllers.find(controller => controller.id === bot.id)!.seats.length, 2);
});

void test('a bot controller gets two independent faction seats without giving the human their private views', () => {
  const { game: g, primary, secondary } = botPair(humanPair());
  assert.deepEqual(g.twoPlayerControllers!.controllers.map(controller => controller.seats), [
    ['human', 'second'], [primary, secondary],
  ]);
  assert.deepEqual(viewGame(g, 'human').controlledFactionSeats.map(seat => seat.id), ['human', 'second']);
  assert.deepEqual(viewGame(g, primary).controlledFactionSeats.map(seat => seat.id), [primary, secondary]);
  for (const observer of ['human', 'second', primary, secondary])
    for (const seat of viewGame(g, observer).players)
      assert.equal('hand' in seat, seat.id === observer);
  assert.equal(g.players.find(player => player.id === primary)!.ready, true);
  assert.equal(g.players.find(player => player.id === secondary)!.ready, true);
});

void test('only the host can create bots, and bot and human controllers cannot be mixed', () => {
  const initial = humanPair();
  unchanged(initial, () => applyAction(initial, 'second', {
    type: 'addBot', faction: 'emperor', difficulty: 'Easy',
  }));
  const { game, id } = botPrimary(initial);
  unchanged(game, () => applyAction(game, 'second', {
    type: 'addControlledBot', controller: id, faction: 'guild', difficulty: 'Easy',
  }));
  unchanged(game, () => applyAction(game, 'human', {
    type: 'addControlledBot', controller: 'human', faction: 'guild', difficulty: 'Easy',
  }));
  unchanged(game, () => joinControlledFaction(game, newPlayer('forged', 'Forged', 'guild'), id));
  unchanged(game, () => applyAction(game, 'human', {
    type: 'addControlledBot', controller: id, faction: 'atreides', difficulty: 'Easy',
  }));
  unchanged(game, () => applyAction(game, 'human', {
    type: 'addControlledBot', controller: id, faction: 'guild', difficulty: 'Impossible',
  }));
});

void test('removing either bot updates its controller and promotes a surviving secondary', () => {
  const { game, primary, secondary } = botPair(humanPair());
  let g = applyAction(game, 'human', { type: 'removeBot', target: secondary });
  assert.deepEqual(g.twoPlayerControllers!.controllers.find(controller => controller.id === primary)!.seats, [primary]);
  assert.equal(g.players.some(player => player.id === secondary), false);
  g = applyAction(g, 'human', { type: 'addControlledBot', controller: primary, faction: 'guild', difficulty: 'Easy' });
  const replacement = g.players.find(player => player.faction === 'guild')!.id;
  g = applyAction(g, 'human', { type: 'removeBot', target: primary });
  assert.equal(g.players.some(player => player.id === primary), false);
  assert.deepEqual(g.twoPlayerControllers!.controllers.find(controller => controller.id === replacement)!.seats, [replacement]);
  g = applyAction(g, 'human', { type: 'addControlledBot', controller: replacement, faction: 'emperor', difficulty: 'Hard' });
  assert.equal(g.twoPlayerControllers!.controllers.find(controller => controller.id === replacement)!.seats.length, 2);
  assert.equal(viewGame(g, 'human').controlledFactionSeats.length, 2);
});

void test('per-seat bot configuration and human readiness remain usable in the paired lobby', () => {
  const { game, primary, secondary } = botPair(humanPair());
  const position = game.playerPositions![primary];
  let g = applyAction(game, 'human', { type: 'ready' });
  g = applyAction(g, 'second', { type: 'ready' });
  g = applyAction(g, 'human', { type: 'configureBot', target: primary, faction: 'emperor', difficulty: 'Hard', position });
  assert.equal(g.players.find(player => player.id === primary)!.bot, 'Hard');
  assert.equal(g.players.find(player => player.id === secondary)!.bot, 'Medium');
  assert.equal(g.players.find(player => player.id === 'human')!.ready, false);
  assert.equal(g.players.find(player => player.id === 'second')!.ready, false);
  assert.equal(g.players.find(player => player.id === primary)!.ready, true);
  assert.equal(g.players.find(player => player.id === secondary)!.ready, true);
});

void test('real two-controller setup lets the scheduler make both AI faction decisions', () => {
  const partial = botPrimary(humanPair());
  let incomplete = applyAction(partial.game, 'human', { type: 'ready' });
  incomplete = applyAction(incomplete, 'second', { type: 'ready' });
  unchanged(incomplete, () => applyAction(incomplete, 'human', { type: 'start' }));
  const complete = applyAction(incomplete, 'human', {
    type: 'addControlledBot', controller: partial.id, faction: 'guild', difficulty: 'Medium',
  });
  const botIds = complete.players.filter(player => player.bot).map(player => player.id);
  let g = complete;
  for (const id of ['human', 'second']) g = applyAction(g, id, { type: 'ready' });
  g = applyAction(g, 'human', { type: 'start' });
  assert.equal(g.status, 'setup');
  for (let n = 0; n < 8 && botIds.some(id => g.players.find(player => player.id === id)!.traitorChoices.length); n++)
    g = runBots(g, 1);
  for (const id of botIds) {
    const bot = g.players.find(player => player.id === id)!;
    assert.equal(bot.traitorChoices.length, 0);
    assert.equal(bot.traitors.length, 1);
  }
  const human = g.players.find(player => player.id === 'human')!;
  g = applyAction(g, 'human', { type: 'traitor', leader: human.traitorChoices[0] });
  assert.equal(g.status, 'playing');
  assert.equal(g.players.every(player => player.ally === null), true);
});
