import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { act, advance, clean, player, inventory, createAdvancedKullLobbyFixture as fixture,
  advancedKullAttempt as attempt } from './fixture-advanced-kull-lobby';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
function ready(game: Game): Game {
  for (const seat of game.players) game = act(game, seat.id, { type: 'ready' });
  return game;
}
function lobby(roster: readonly ('atreides' | 'beneGesserit' | 'emperor' | 'fremen' | 'guild' | 'harkonnen')[],
  advanced = true, expansions = ['choam', 'ix']): Game {
  const game = createGame('ADVKULL', newPlayer('choam', 'CHOAM', 'choam'), advanced, expansions);
  for (const faction of roster) joinGame(game, newPlayer(faction, faction, faction));
  return game;
}

void test('a normal Advanced lobby requires the explicit host selection and preview-start acknowledgement', () => {
  let game = lobby(['emperor', 'guild']);
  assert.equal(viewGame(game, 'choam').lobbyModules?.kullPreview, false);
  rejected(game, 'emperor', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  game = act(game, 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  assert.equal(viewGame(game, 'choam').lobbyModules?.kullPreview, true);
  game = ready(game);
  rejected(game, 'choam', { type: 'start' });
  const started = act(game, 'choam', { type: 'start', advancedPreview: true });
  assert.equal(started.status, 'setup');
  assert.equal(started.advanced, true);
  assert.equal(started.kullPreview, true);
  assert.equal(viewGame(started, 'choam').kullPreview, true);
  assert.equal(started.deck.filter(card => card.id === 'ix-kull-wahad').length, 1);
});

for (const seats of [2, 3, 4, 5, 6] as const) {
  void test(`Advanced Kull public preview starts its native CHOAM and ${seats - 1} classic-seat roster`, () => {
    const others = ['atreides', 'beneGesserit', 'emperor', 'fremen', 'guild'] as const;
    let game = lobby(others.slice(0, seats - 1));
    game = act(game, 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
    game = act(ready(game), 'choam', { type: 'start', advancedPreview: true });
    assert.equal(game.status, 'setup');
    assert.equal(game.players.length, seats);
    assert.equal(game.kullPreview, true);
    assert.equal(game.deck.filter(card => card.id === 'ix-kull-wahad').length, 1);
  });
}

void test('unselected and saved pre-selection Advanced lobbies do not acquire Kull automatically', () => {
  for (const old of [false, true]) {
    const game = lobby(['emperor']);
    if (old) delete game.kullDefaultPolicy;
    const started = act(ready(game), 'choam', { type: 'start', advancedPreview: true });
    assert.equal(started.kullPreview ?? false, false);
    assert.equal(viewGame(started, 'choam').kullPreview, false);
  }
});

void test('Advanced Kull selection rejects unsupported decks, native factions and modules atomically', () => {
  for (const kind of ['missingIx', 'richese', 'nexus', 'skills'] as const) {
    let game = lobby(['emperor'], true, kind === 'missingIx' ? ['choam'] : ['choam', 'ix']);
    if (kind === 'richese') joinGame(game, newPlayer('richese', 'Richese', 'richese'));
    if (kind === 'nexus') game = act(game, 'choam', { type: 'moduleOption', module: 'nexusCards', enabled: true });
    if (kind === 'skills') game = act(game, 'choam', { type: 'moduleOption', module: 'leaderSkills', enabled: true });
    game = act(game, 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
    game = ready(game);
    rejected(game, 'choam', { type: 'start', advancedPreview: true });
  }
});

void test('normal Advanced Kull preview uses the real held card and distinct counter at the original attempt', () => {
  const f = fixture();
  assert.ok(f.actions.some(row => row.actor === f.reactor && row.action.type === 'start' && row.action.advancedPreview === true));
  const pending = act(f.game, f.actor, attempt(f));
  assert.equal(pending.pendingKull?.stage, 'offer');
  assert.ok(player(pending, f.actor).hand.some(card => card.id === f.karama));
  const reaction = viewGame(pending, f.reactor).kullReaction; assert.ok(reaction);
  assert.equal(reaction.scope, 'effect');
  assert.ok(reaction.plays.some(play => play.source === 'printed' && play.card.id === f.kull && !play.blocked));
  assert.deepEqual(viewGame(pending, f.actor).kullReaction?.plays, []);
  assert.deepEqual(inventory(pending), f.originalCards);

  const bot = viewGame(pending, f.reactor); bot.players.find(seat => seat.id === f.reactor)!.bot = 'Easy';
  const botAction = botActions(bot).find(action => action.type === 'kullDecision'); assert.ok(botAction);
  assert.doesNotThrow(() => act(structuredClone(pending), f.reactor, botAction));

  const declared = act(pending, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  assert.equal(declared.pendingKull?.stage, 'counter');
  assert.ok(viewGame(declared, f.counterOwner).responseControls?.cancelCards.includes(f.counter));
  const countered = act(declared, f.counterOwner, { type: 'card', mode: 'cancel', card: f.counter });
  const resumed = advance(countered, clean);
  assert.equal(resumed.karamaShipping?.owner, f.actor);
  assert.equal(resumed.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(resumed.discard.filter(card => card.id === f.counter).length, 1);
  assert.ok(player(resumed, f.reactor).hand.some(card => card.id === f.kull));
  assert.deepEqual(inventory(resumed), f.originalCards);

  const successful = advance(declared, clean);
  assert.equal(successful.karamaShipping, null);
  assert.ok(player(successful, f.actor).hand.some(card => card.id === f.karama));
  assert.equal(successful.discard.filter(card => card.id === f.kull).length, 1);
  assert.equal(viewGame(successful, f.actor).karamaBlocked, null);
  assert.equal(viewGame(successful, f.actor).karamaPurposeBlocks[0]?.purpose, 'shipment-price');
  rejected(successful, f.actor, attempt(f));
  assert.deepEqual(inventory(successful), f.originalCards);
});
