import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { act, advance, clean, createKullBribeFixture, inventory, player } from './fixture-kull-bribe';

/** Real public Basic CHOAM/Emperor/Guild/Harkonnen game, selected unopened
 * cards and Spice position, and a genuine ordinary bribe. Harkonnen starts
 * with ten forces in Carthag, ten reserves, ten Spice and a physical Karama.
 * Paying seven leaves only the Karama-discounted five-force city shipment
 * available to complete a fifteen-force move in this phase. */
function movementSource() {
  const f = createKullBribeFixture();
  let game = act(f.game, 'harkonnen', { type: 'bribe', target: 'guild', amount: 7 });
  assert.equal(player(game, 'harkonnen').spice, 3);
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(p => !game.truthtrance!.passed.includes(p.id));
    assert.ok(passer);
    game = act(game, passer.id, { type: 'truthPass' });
  }
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'movement', target: 'harkonnen', territory: 'imperial_basin', minimum: 15,
  } });
  assert.deepEqual(viewGame(game, 'harkonnen').truthMovementAnswers, ['yes', 'no']);
  game = act(game, 'harkonnen', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.movementPromises?.[0].answer, true);
  game = advance(game, g => g.phase === 5 && g.active === 'harkonnen' && clean(g));
  assert.ok(player(game, 'harkonnen').hand.some(card => card.id === f.counter));
  assert.deepEqual(inventory(game), f.originalCards);
  return { f, game };
}

function offer(f: ReturnType<typeof createKullBribeFixture>, game: Game): Game {
  game = act(game, 'harkonnen', { type: 'card', mode: 'shipment', card: f.counter, target: 'harkonnen' });
  assert.equal(game.pendingKull?.stage, 'offer');
  assert.ok(player(game, 'harkonnen').hand.some(card => card.id === f.counter));
  assert.equal(game.movementPromises?.[0].released, undefined);
  return game;
}

function declare(f: ReturnType<typeof createKullBribeFixture>, game: Game): Game {
  const reaction = viewGame(game, 'choam').kullReaction; assert.ok(reaction);
  return act(game, 'choam', { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
}

function finishMove(f: ReturnType<typeof createKullBribeFixture>, game: Game): Game {
  game = act(game, 'harkonnen', { type: 'ship', territory: 'carthag', sector: 11, amount: 5, elite: 0, allyPayment: 0 });
  game = advance(game, clean);
  assert.equal(player(game, 'harkonnen').spice, 0);
  assert.equal(player(game, 'harkonnen').forces['carthag:11'], 15);
  game = act(game, 'harkonnen', { type: 'move', from: 'carthag:11', territory: 'imperial_basin', sector: 9, amount: 15, elite: 0 });
  assert.equal(game.movementPromises?.[0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
  return game;
}

void test('a Kull preview offers the legal movement Yes using a future Karama and actual decline', () => {
  const { f, game } = movementSource();
  const pending = offer(f, game);
  const reaction = viewGame(pending, 'choam').kullReaction; assert.ok(reaction);
  const declined = act(pending, 'choam', { type: 'kullDecision', event: reaction.event, decline: true });
  assert.equal(declined.karamaShipping?.owner, 'harkonnen');
  assert.equal(declined.movementPromises?.[0].released, undefined);
  finishMove(f, declined);
});

void test('a distinct Karama counter preserves the original movement route and card custody', () => {
  const { f, game } = movementSource();
  const declared = declare(f, offer(f, game));
  assert.ok(viewGame(declared, 'emperor').responseControls?.cancelCards?.includes(f.karama));
  const countered = act(declared, 'emperor', { type: 'card', mode: 'cancel', card: f.karama });
  const resumed = advance(countered, clean);
  assert.equal(resumed.karamaShipping?.owner, 'harkonnen');
  assert.equal(resumed.movementPromises?.[0].released, undefined);
  assert.equal(resumed.discard.filter(card => card.id === f.karama).length, 1);
  assert.ok(player(resumed, 'choam').hand.some(card => card.id === f.kull));
  finishMove(f, resumed);
});

void test('successful Kull preserves the original Karama and releases an impossible movement promise', () => {
  const { f, game } = movementSource();
  const declared = declare(f, offer(f, game));
  const blocked = advance(declared, clean);
  assert.equal(blocked.karamaShipping, null);
  assert.ok(player(blocked, 'harkonnen').hand.some(card => card.id === f.counter));
  assert.equal(blocked.discard.filter(card => card.id === f.kull).length, 1);
  assert.equal(blocked.movementPromises?.[0].released, true);
  assert.deepEqual(inventory(blocked), f.originalCards);
});
