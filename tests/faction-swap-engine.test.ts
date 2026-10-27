import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinControlledFaction, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';

function lobby(): Game {
  const game = createGame('SWAPTEST', newPlayer('host', 'Host', 'atreides'));
  joinGame(game, newPlayer('guest', 'Guest', 'harkonnen'));
  joinGame(game, newPlayer('third', 'Third', 'emperor'));
  return game;
}

function readyAll(game: Game): Game {
  for (const player of game.players.filter(player => !player.bot)) {
    game = applyAction(game, player.id, { type: 'ready' });
  }
  return game;
}

function proposal(game: Game) {
  assert.ok(game.factionSwap);
  return game.factionSwap;
}

function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, `${action.type} must not mutate its input when rejected`);
}

function identities(game: Game) {
  return game.players.map(({ id, name, faction, ready }) => ({ id, name, faction, ready }));
}

void test('an accepted offer exchanges faction assets, preserves seats and circles, and can start', () => {
  let game = readyAll(lobby());
  const positions = structuredClone(game.playerPositions);
  const initial = identities(game);
  game = applyAction(game, 'guest', { type: 'factionSwapOffer', target: 'host' });
  const offer = proposal(game);
  assert.equal(typeof offer.event, 'string');
  assert.ok(offer.event.length > 0);
  assert.deepEqual({ ...offer, event: '<event>' }, {
    event: '<event>', from: 'guest', to: 'host', fromFaction: 'harkonnen', toFaction: 'atreides',
  });
  assert.deepEqual(identities(game), initial);
  assert.deepEqual(viewGame(game, 'third').factionSwap, offer);

  game = applyAction(game, 'host', { type: 'factionSwapRespond', event: offer.event, accept: true });
  assert.equal(game.factionSwap, undefined);
  assert.equal(game.host, 'host');
  assert.deepEqual(game.playerPositions, positions);
  assert.deepEqual(game.players.map(({ id, name, faction, ready }) => ({ id, name, faction, ready })), [
    { id: 'host', name: 'Host', faction: 'harkonnen', ready: false },
    { id: 'guest', name: 'Guest', faction: 'atreides', ready: false },
    { id: 'third', name: 'Third', faction: 'emperor', ready: false },
  ]);
  assert.deepEqual(game.players[0].leaders, newPlayer('x', 'X', 'harkonnen').leaders);
  assert.deepEqual(game.players[1].leaders, newPlayer('x', 'X', 'atreides').leaders);
  game = readyAll(game);
  game = applyAction(game, 'host', { type: 'start' });
  assert.equal(game.status, 'setup');
  assert.equal(game.players.find(player => player.id === 'host')!.faction, 'harkonnen');
  assert.equal(game.players.find(player => player.id === 'guest')!.faction, 'atreides');
});

void test('declining and cancelling preserve factions and existing readiness', () => {
  let game = readyAll(lobby());
  const before = identities(game);
  game = applyAction(game, 'guest', { type: 'factionSwapOffer', target: 'host' });
  const first = proposal(game).event;
  game = applyAction(game, 'host', { type: 'factionSwapRespond', event: first, accept: false });
  assert.equal(game.factionSwap, undefined);
  assert.deepEqual(identities(game), before);
  game = applyAction(game, 'guest', { type: 'factionSwapOffer', target: 'host' });
  const second = proposal(game).event;
  assert.notEqual(first, second);
  rejected(game, 'host', { type: 'factionSwapRespond', event: first, accept: true });
  rejected(game, 'guest', { type: 'factionSwapCancel', event: first });
  game = applyAction(game, 'guest', { type: 'factionSwapCancel', event: second });
  assert.equal(game.factionSwap, undefined);
  assert.deepEqual(identities(game), before);
  rejected(game, 'host', { type: 'factionSwapRespond', event: second, accept: true });
});

void test('swap actions reject forged parties, payloads, stale events and AI proposers without mutation', () => {
  let game = lobby();
  game = applyAction(game, 'host', { type: 'addBot', faction: 'guild', difficulty: 'Easy' });
  const bot = game.players.find(player => player.bot)!;
  for (const [actor, action] of [
    ['host', { type: 'factionSwapOffer', target: 'host' }],
    ['host', { type: 'factionSwapOffer', target: 'missing' }],
    [bot.id, { type: 'factionSwapOffer', target: 'host' }],
    ['missing', { type: 'factionSwapOffer', target: 'host' }],
    ['host', { type: 'factionSwapOffer', target: 'guest', from: 'third' }],
    ['guest', { type: 'factionSwapRespond', event: 'missing', accept: true }],
    ['host', { type: 'factionSwapCancel', event: 'missing' }],
  ] as Array<[string, Action]>) rejected(game, actor, action);

  game = applyAction(game, 'host', { type: 'factionSwapOffer', target: 'guest' });
  const event = proposal(game).event;
  for (const [actor, action] of [
    ['host', { type: 'factionSwapRespond', event, accept: true }],
    ['third', { type: 'factionSwapRespond', event, accept: true }],
    ['guest', { type: 'factionSwapCancel', event }],
    ['third', { type: 'factionSwapCancel', event }],
    ['guest', { type: 'factionSwapRespond', event: 'forged', accept: true }],
    ['guest', { type: 'factionSwapRespond', event, accept: 'true' }],
    ['guest', { type: 'factionSwapRespond', event, accept: true, target: 'third' }],
    ['host', { type: 'factionSwapCancel', event, target: 'third' }],
    ['third', { type: 'factionSwapOffer', target: 'guest' }],
  ] as Array<[string, Action]>) rejected(game, actor, action);
});

void test('a human offer to an AI seat is accepted immediately with faction assets and readiness updated', () => {
  let game = createGame('SWAPAI', newPlayer('host', 'Host', 'atreides'));
  joinGame(game, newPlayer('guest', 'Guest', 'harkonnen'));
  game = applyAction(game, 'host', { type: 'addBot', faction: 'guild', difficulty: 'Hard' });
  const bot = game.players.find(player => player.bot)!;
  const positions = structuredClone(game.playerPositions);
  game = readyAll(game);
  const original = structuredClone(game);

  game = applyAction(game, 'guest', { type: 'factionSwapOffer', target: bot.id });
  assert.equal(game.factionSwap, undefined, 'AI consent completes within the offer action');
  assert.deepEqual(game.playerPositions, positions);
  assert.equal(game.host, 'host');
  assert.deepEqual(game.players.map(player => player.id), original.players.map(player => player.id));
  assert.equal(game.players.find(player => player.id === 'guest')!.faction, 'guild');
  assert.equal(game.players.find(player => player.id === 'guest')!.name, 'Guest');
  const swappedBot = game.players.find(player => player.id === bot.id)!;
  assert.equal(swappedBot.faction, 'harkonnen');
  assert.equal(swappedBot.name, 'Harkonnen AI');
  assert.equal(swappedBot.bot, 'Hard');
  assert.deepEqual(swappedBot.leaders, newPlayer('x', 'X', 'harkonnen').leaders);
  assert.deepEqual(game.players.find(player => player.id === 'guest')!.leaders, newPlayer('x', 'X', 'guild').leaders);
  assert.equal(swappedBot.ready, true);
  assert.ok(game.players.filter(player => !player.bot).every(player => !player.ready));
  assert.ok(game.log.some(entry => /accept/i.test(entry.text)), 'the automatic acceptance is recorded');
  rejected(game, bot.id, { type: 'factionSwapOffer', target: 'guest' });
  rejected(game, 'guest', { type: 'factionSwapRespond', event: 'missing', accept: true });
});

void test('a two-faction AI controller keeps both seats and receives Ixian elites when swapped', () => {
  let game = createGame('SWAPAI2', newPlayer('human', 'Human', 'ixians'), false, ['ix']);
  game = applyAction(game, 'human', { type: 'twoPlayerMode', enabled: true });
  joinControlledFaction(game, newPlayer('second', 'Human second', 'harkonnen'), 'human');
  game = applyAction(game, 'human', { type: 'addBot', faction: 'emperor', difficulty: 'Medium' });
  const firstBot = game.players.find(player => player.bot)!;
  game = applyAction(game, 'human', { type: 'addControlledBot', controller: firstBot.id, faction: 'guild', difficulty: 'Easy' });
  const secondBot = game.players.find(player => player.faction === 'guild')!;
  const mapping = structuredClone(game.twoPlayerControllers);
  const positions = structuredClone(game.playerPositions);
  game = readyAll(game);

  game = applyAction(game, 'human', { type: 'factionSwapOffer', target: secondBot.id });
  assert.equal(game.factionSwap, undefined);
  assert.deepEqual(game.twoPlayerControllers, mapping);
  assert.deepEqual(game.playerPositions, positions);
  const human = game.players.find(player => player.id === 'human')!;
  const bot = game.players.find(player => player.id === secondBot.id)!;
  assert.equal(human.faction, 'guild');
  assert.equal(human.elites, undefined);
  assert.equal(bot.faction, 'ixians');
  assert.equal(bot.name, 'Ixians AI');
  assert.equal(bot.bot, 'Easy');
  assert.deepEqual(bot.elites, { reserves: 7, tanks: 0, forces: {}, revived: 0 });
  assert.deepEqual(bot.leaders, newPlayer('x', 'X', 'ixians').leaders);
  assert.equal(game.players.find(player => player.id === firstBot.id)!.faction, 'emperor');
  assert.ok(game.players.filter(player => player.bot).every(player => player.ready));
  assert.ok(game.players.filter(player => !player.bot).every(player => !player.ready));
  assert.deepEqual(viewGame(game, 'human').controlledFactionSeats.map(seat => seat.id), ['human', 'second']);
});

void test('an outstanding offer freezes conflicting lobby actions and joining', () => {
  let game = readyAll(lobby());
  game = applyAction(game, 'host', { type: 'factionSwapOffer', target: 'guest' });
  for (const [actor, action] of [
    ['guest', { type: 'faction', faction: 'guild' }],
    ['third', { type: 'faction', faction: 'fremen' }],
    ['host', { type: 'factionAllocation', mode: 'random' }],
    ['host', { type: 'factionAllocation', mode: 'draft' }],
    ['host', { type: 'addBot', faction: 'guild', difficulty: 'Easy' }],
    ['host', { type: 'seatPosition', position: 6 }],
    ['host', { type: 'start' }],
  ] as Array<[string, Action]>) rejected(game, actor, action);
  const before = structuredClone(game);
  assert.throws(() => joinGame(game, newPlayer('new', 'New', 'guild')));
  assert.deepEqual(game, before);
});

void test('Ixian elite reserves and faction leaders follow the faction on acceptance', () => {
  let game = createGame('SWAPIX', newPlayer('host', 'Host', 'atreides'), false, ['ix']);
  joinGame(game, newPlayer('ix', 'Ix', 'ixians'));
  game = applyAction(game, 'host', { type: 'factionSwapOffer', target: 'ix' });
  game = applyAction(game, 'ix', { type: 'factionSwapRespond', event: proposal(game).event, accept: true });
  assert.deepEqual(game.players[0].elites, { reserves: 7, tanks: 0, forces: {}, revived: 0 });
  assert.equal(game.players[1].elites, undefined);
  assert.deepEqual(game.players[0].leaders, newPlayer('x', 'X', 'ixians').leaders);
  assert.deepEqual(game.players[1].leaders, newPlayer('x', 'X', 'atreides').leaders);
});

void test('two seats with one controller may exchange factions without changing their ownership', () => {
  let game = createGame('SWAPTWO', newPlayer('a', 'A', 'atreides'));
  game = applyAction(game, 'a', { type: 'twoPlayerMode', enabled: true });
  joinControlledFaction(game, newPlayer('b', 'A second', 'emperor'), 'a');
  joinGame(game, newPlayer('c', 'C', 'guild'));
  joinControlledFaction(game, newPlayer('d', 'C second', 'harkonnen'), 'c');
  const controllers = structuredClone(game.twoPlayerControllers);
  const positions = structuredClone(game.playerPositions);
  game = applyAction(game, 'a', { type: 'factionSwapOffer', target: 'b' });
  game = applyAction(game, 'b', { type: 'factionSwapRespond', event: proposal(game).event, accept: true });
  assert.deepEqual(game.twoPlayerControllers, controllers);
  assert.deepEqual(game.playerPositions, positions);
  assert.equal(game.players.find(player => player.id === 'a')!.faction, 'emperor');
  assert.equal(game.players.find(player => player.id === 'b')!.faction, 'atreides');
  assert.deepEqual(viewGame(game, 'b').controlledFactionSeats.map(seat => seat.id), ['a', 'b']);
  game = readyAll(game);
  game = applyAction(game, 'a', { type: 'start' });
  assert.equal(game.status, 'setup');
});
