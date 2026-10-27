import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { act, advance, clean, createDefaultChoamKullFixture, defaultKullAttempt } from './fixture-default-choam-kull';

function lobby(): Game {
  const game = createGame('KULLDEFAULT', newPlayer('choam', 'CHOAM', 'choam'), false, ['choam', 'ix']);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  return game;
}
function start(game: Game): Game {
  for (const seat of game.players) game = act(game, seat.id, { type: 'ready' });
  return act(game, game.host, { type: 'start' });
}

void test('a genuine fresh Basic lobby enables printed Kull and a real interception by default', () => {
  const f = createDefaultChoamKullFixture();
  const view = viewGame(f.lobby, f.reactor);
  assert.equal(view.lobbyModules?.kullDefault, true);
  assert.equal(view.lobbyModules?.kullPreview, true);
  assert.equal(f.setup.kullPreview, true);
  assert.equal(f.setup.kullDefaultPolicy, undefined);
  assert.equal(f.setup.lobbyOptions, undefined);
  let game = act(f.game, f.actor, defaultKullAttempt(f));
  const reaction = viewGame(game, f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(play => play.source === 'printed' && play.card.id === f.kull));
  game = act(game, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  game = advance(game, clean);
  assert.ok(viewGame(game, f.actor).karamaBlocked);
  assert.equal(game.discard.filter(card => card.id === f.kull).length, 1);
});

void test('the host can opt out of the new default and then opt back in', () => {
  let game = lobby();
  assert.equal(viewGame(game, game.host).lobbyModules?.kullPreview, true);
  for (const seat of game.players) game = act(game, seat.id, { type: 'ready' });
  game = act(game, game.host, { type: 'moduleOption', module: 'kullPreview', enabled: false });
  assert.ok(game.players.every(seat => !seat.ready));
  assert.equal(viewGame(game, game.host).lobbyModules?.kullPreview, false);
  assert.equal(game.lobbyOptions?.kullOptOut, true);
  assert.equal(start(structuredClone(game)).kullPreview ?? false, false);
  game = act(game, game.host, { type: 'moduleOption', module: 'kullPreview', enabled: true });
  assert.equal(viewGame(game, game.host).lobbyModules?.kullPreview, true);
  assert.equal(game.lobbyOptions?.kullOptOut, undefined);
  assert.equal(game.lobbyOptions?.kullPreview, undefined, 'Re-enabling returns to the automatic policy');
  const changed = act(structuredClone(game), game.host, { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  assert.equal(viewGame(changed, changed.host).lobbyModules?.kullDefault, false);
  assert.equal(viewGame(changed, changed.host).lobbyModules?.kullPreview, false);
  assert.ok(changed.players.every(seat => !seat.ready));
  assert.equal(start(game).kullPreview, true);
});

void test('saved pre-default lobbies retain their original opt-in selection', () => {
  const old = lobby(); delete old.kullDefaultPolicy;
  assert.equal(viewGame(old, old.host).lobbyModules?.kullPreview, false);
  assert.equal(start(old).kullPreview ?? false, false);
});

void test('an unsupported configuration does not silently enable the preview', () => {
  const game = createGame('KULLUNSUPPORTED', newPlayer('choam', 'CHOAM', 'choam'), false, ['choam']);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  assert.equal(viewGame(game, game.host).lobbyModules?.kullDefault, false);
  assert.equal(viewGame(game, game.host).lobbyModules?.kullPreview, false);
  assert.equal(start(game).kullPreview ?? false, false);
});
