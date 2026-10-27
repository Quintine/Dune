import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES } from '../game/board';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { revivalPromiseModeSupported } from '../game/revival-promises';
import { act, advance, clean, createKullBribeFixture, inventory, player } from './fixture-kull-bribe';

function source() {
  const f = createKullBribeFixture();
  let game = structuredClone(f.game);
  // The original driver selects the scalar lottery and dials one for each
  // player in the next Storm. Select a real empty next-Storm sand sector.
  const sector = game.storm % 18 + 1;
  const destination = TERRITORIES.find(place => place.type === 'sand' && place.sectors.includes(sector) &&
    game.players.every(seat => !Object.keys(seat.forces).some(key => key.startsWith(`${place.id}:`))));
  assert.ok(destination);
  game = act(game, f.actor, { type: 'ship', territory: destination.id, sector, amount: 3, elite: 0, allyPayment: 0 });
  game = advance(game, clean);
  game = act(game, f.actor, { type: 'endMovement' });
  // Reorder only the still-unopened Spice deck so the next turn has a normal
  // blow and cannot open an unrelated random Nexus decision.
  const safe = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
  assert.ok(safe >= 0); game.spiceDeck.unshift(game.spiceDeck.splice(safe, 1)[0]);
  game = advance(game, state => state.turn === 2 && state.phase === 3 && clean(state) && state.auction?.active === f.actor);
  assert.equal(player(game, f.actor).tanks, 3);
  assert.equal(player(game, f.actor).spice, 4);
  assert.deepEqual(inventory(game), f.originalCards);
  return { ...f, game };
}

function ask(f: ReturnType<typeof source>, game: Game) {
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id));
    assert.ok(passer); game = act(game, passer.id, { type: 'truthPass' });
  }
  return act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'revival', target: f.actor, turn: game.turn, counter: 'total', minimum: 3,
  } });
}

void test('Basic printed Kull permits native Revival questions while preserving module fences', () => {
  const native = { advanced: false, expansions: ['choam', 'ix'],
    players: [{ faction: 'choam' }, { faction: 'emperor' }], kullPreview: true };
  assert.equal(revivalPromiseModeSupported(native), true);
  for (const option of ['semutaPreview', 'nexusKullPreview', 'nexusCards', 'leaderSkills',
    'richeseBetrayalPreview', 'guildBetrayalPreview'] as const)
    assert.equal(revivalPromiseModeSupported({ ...native, [option]: true }), false, option);
  assert.equal(revivalPromiseModeSupported({ ...native, advanced: true }), false);
  assert.equal(revivalPromiseModeSupported({ ...native, players: [{ faction: 'emperor' }, { faction: 'guild' }] }), false);
});

void test('a genuine Kull game binds and completes an ordinary Revival Yes after real Storm losses', () => {
  const f = source();
  let game = advance(f.game, state => state.phase === 4 && clean(state));
  game = ask(f, game);
  assert.ok(viewGame(game, f.actor).truthRevivalAnswers?.includes('yes'));
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
  const guide = viewGame(game, f.actor).revivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive'); assert.equal(guide.action.amount, 3);
  const bot = viewGame(game, f.actor); bot.players.find(p => p.id === f.actor)!.bot = 'Easy';
  const botRevival = botActions(bot).find(action => action.revivalPromiseEvent === guide.action.revivalPromiseEvent); assert.ok(botRevival);
  assert.equal(act(structuredClone(game), f.actor, botRevival).decision?.kind, 'choamFreeRevival');
  game = act(game, f.actor, guide.action);
  assert.equal(game.decision?.kind, 'choamFreeRevival');
  assert.equal(game.revivalPromises?.[0].progress, 0);
  game = advance(game, clean);
  assert.equal(game.revivalPromises?.[0].progress, 3);
  assert.equal(game.revivalPromises?.[0].fulfilled, true);
  assert.equal(player(game, f.actor).tanks, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a successful Kull auction block cannot be forecast as a Karama payment funding Revival', () => {
  const f = source();
  let game = act(f.game, f.actor, { type: 'card', mode: 'purchase', card: f.karama });
  const reaction = viewGame(game, f.reactor).kullReaction; assert.ok(reaction);
  game = act(game, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  game = advance(game, clean);
  assert.ok(viewGame(game, f.actor).karamaBlocked);
  game = act(game, f.actor, { type: 'bid', amount: 3, allyPayment: 0 });
  game = ask(f, game);
  assert.deepEqual(viewGame(game, f.actor).truthRevivalAnswers, ['no']);
  const before = structuredClone(game);
  assert.throws(() => act(game, f.actor, { type: 'truthAnswer', answer: 'yes' }));
  assert.deepEqual(game, before);
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'no' });
  assert.equal(game.revivalPromises?.[0].answer, false);
  assert.deepEqual(inventory(game), f.originalCards);
});

function outstandingPayment() {
  const f = source();
  let game = act(f.game, f.actor, { type: 'bid', amount: 3, allyPayment: 0 });
  game = ask(f, game);
  assert.ok(viewGame(game, f.actor).truthRevivalAnswers?.includes('yes'));
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
  const promise = structuredClone(game.revivalPromises);
  game = advance(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'auctionPayment' && state.decision.player === f.actor);
  const payment = viewGame(game, f.actor).revivalPromiseGuide; assert.ok(payment);
  assert.equal(payment.action.type, 'decision'); assert.equal(payment.action.karama, true);
  game = act(game, f.actor, payment.action);
  assert.equal(game.pendingKull?.stage, 'offer');
  assert.deepEqual(game.revivalPromises, promise);
  assert.equal(viewGame(game, f.actor).revivalPromiseGuide, null);
  const reaction = viewGame(game, f.reactor).kullReaction; assert.ok(reaction);
  game = act(game, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  assert.equal(game.pendingKull?.stage, 'counter');
  assert.deepEqual(game.revivalPromises, promise);
  assert.equal(viewGame(game, f.actor).revivalPromiseGuide, null);
  return { f, game, promise };
}

void test('an opposing successful Kull may release a Revival Yes only after preventing its actual payment', () => {
  const { f, game: offered, promise } = outstandingPayment();
  const game = advance(offered, clean);
  assert.equal(promise?.[0].released, undefined);
  assert.equal(game.revivalPromises?.[0].progress, 0);
  assert.equal(game.revivalPromises?.[0].released, true);
  assert.equal(player(game, f.actor).spice, 1);
  assert.ok(player(game, f.actor).hand.some(card => card.id === f.karama));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a distinct Kull counter preserves the original payment and outstanding Revival Yes', () => {
  const { f, game: offered, promise } = outstandingPayment();
  assert.ok(viewGame(offered, f.counterOwner).responseControls?.cancelCards.includes(f.counter));
  let game = act(offered, f.counterOwner, { type: 'card', mode: 'cancel', card: f.counter });
  game = advance(game, state => state.phase === 4 && clean(state));
  assert.deepEqual(game.revivalPromises, promise);
  assert.equal(player(game, f.actor).spice, 4);
  const guide = viewGame(game, f.actor).revivalPromiseGuide; assert.ok(guide);
  game = advance(act(game, f.actor, guide.action), clean);
  assert.equal(game.revivalPromises?.[0].progress, 3);
  assert.equal(game.revivalPromises?.[0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});
