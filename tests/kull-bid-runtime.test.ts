import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { bidPromiseModeSupported } from '../game/bid-promises';
import { phaseBidPromiseModeSupported } from '../game/turn-bid-promises';
import { act, advance, clean, createKullBribeFixture, inventory, player } from './fixture-kull-bribe';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}

void test('Basic printed Kull admits native bid commitments only in its supported envelope', () => {
  const scope = { advanced: false, expansions: ['choam', 'ix'],
    players: [{ faction: 'choam' }, { faction: 'emperor' }], kullPreview: true };
  assert.equal(bidPromiseModeSupported(scope), true);
  assert.equal(phaseBidPromiseModeSupported(scope), false);
  assert.equal(bidPromiseModeSupported({ ...scope, advanced: true }), false);
  assert.equal(bidPromiseModeSupported({ ...scope, expansions: ['choam'] }), false);
  assert.equal(bidPromiseModeSupported({ ...scope, semutaPreview: true }), false);
  assert.equal(bidPromiseModeSupported({ ...scope, nexusKullPreview: true }), false);
  assert.equal(bidPromiseModeSupported({ ...scope, leaderSkills: {} }), false);
  assert.equal(bidPromiseModeSupported({ ...scope, players: [{ faction: 'emperor' }, { faction: 'guild' }] }), false);
});

void test('a genuine Basic Kull auction preserves the respondent’s real Yes bid and payment', () => {
  const f = createKullBribeFixture();
  let game = advance(structuredClone(f.charity), g => g.phase === 3 && clean(g) && g.auction?.active === f.actor);
  assert.ok(game.auction);
  const lot = game.auction.cards[game.auction.index].id;
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer); game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bid', target: f.actor, turn: game.turn, lot: game.auction!.index + 1, minimum: 4,
  } });
  assert.ok(viewGame(game, f.actor).truthBidAnswers?.includes('yes'));
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
  rejected(game, f.actor, { type: 'passBid' });
  rejected(game, f.actor, { type: 'bid', amount: 3 });
  const guide = viewGame(game, f.actor).bidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.amount, 4);
  const bot = viewGame(game, f.actor); bot.players.find(p => p.id === f.actor)!.bot = 'Easy';
  const botBid = botActions(bot).find(action => action.bidPromiseEvent === guide.action.bidPromiseEvent); assert.ok(botBid);
  assert.equal(act(structuredClone(game), f.actor, botBid).bidPromises?.[0].fulfilled, true);
  game = act(game, f.actor, guide.action);
  assert.ok(game.bidPromises?.some(row => row.player === f.actor && row.fulfilled));
  game = advance(game, g => player(g, f.actor).hand.some(card => card.id === lot));
  assert.equal(player(game, f.actor).spice, 6);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a Yes bid cannot be evaded by buying its own lot with Karama', () => {
  const f = createKullBribeFixture();
  let game = advance(structuredClone(f.charity), g => g.phase === 3 && clean(g) && g.auction?.active === f.actor);
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer); game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bid', target: f.actor, turn: game.turn, lot: game.auction!.index + 1, minimum: 4,
  } });
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
  rejected(game, f.actor, { type: 'card', mode: 'purchase', card: f.karama });
});

void test('a No bid caps the actual current-lot declaration in a Kull game', () => {
  const f = createKullBribeFixture();
  let game = advance(structuredClone(f.charity), g => g.phase === 3 && clean(g) && g.auction?.active === f.actor);
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer); game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bid', target: f.actor, turn: game.turn, lot: game.auction!.index + 1, minimum: 4,
  } });
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'no' });
  rejected(game, f.actor, { type: 'bid', amount: 4 });
  game = act(game, f.actor, { type: 'bid', amount: 3 });
  assert.equal(game.auction?.bid, 3);
  assert.equal(game.bidPromises?.[0].answer, false);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('an opposing Karama purchase and Kull response suspend and then reconcile a Yes bid', () => {
  const f = createKullBribeFixture();
  let game = advance(structuredClone(f.charity), g => g.phase === 3 && clean(g) && g.auction?.active === f.actor);
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer); game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'bid', target: f.actor, turn: game.turn, lot: game.auction!.index + 1, minimum: 4,
  } });
  game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
  const before = structuredClone(game.bidPromises);
  const pending = act(game, f.counterOwner, { type: 'card', mode: 'purchase', card: f.counter });
  assert.equal(pending.pendingKull?.stage, 'offer');
  assert.deepEqual(pending.bidPromises, before);
  assert.equal(viewGame(pending, f.actor).bidPromiseGuide, null);
  const reaction = viewGame(pending, f.reactor).kullReaction; assert.ok(reaction);
  const declined = advance(act(pending, f.reactor,
    { type: 'kullDecision', event: reaction.event, decline: true }), clean);
  assert.equal(declined.bidPromises?.[0].released, true);
  assert.ok(player(declined, f.reactor).hand.some(card => card.id === f.kull));
  assert.deepEqual(inventory(declined), f.originalCards);
  const declared = act(pending, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  assert.deepEqual(declared.bidPromises, before);
  game = advance(declared, clean);
  assert.deepEqual(game.bidPromises, before);
  const guide = viewGame(game, f.actor).bidPromiseGuide; assert.ok(guide);
  game = act(game, f.actor, guide.action);
  assert.equal(game.bidPromises?.[0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});
