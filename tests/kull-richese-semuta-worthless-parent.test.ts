import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { act, advance, clean, createKullRicheseSemutaFixture, inventory, player } from './fixture-kull-richese-semuta';

void test('Semuta may recover Kull before a suspended CHOAM Worthless effect resumes', () => {
  const f = createKullRicheseSemutaFixture();
  let game = structuredClone(f.acquired);
  // Controlled physical supplement: transfer the original unopened La La La
  // from the deck to CHOAM, without creating a card or staging a response.
  const index = game.deck.findIndex(card => card.name === 'La La La');
  assert.ok(index >= 0, 'The original La La La is still in the deck');
  const card = game.deck.splice(index, 1)[0];
  player(game, f.reactor).hand.push(card);
  assert.deepEqual(inventory(game), f.originalCards);
  game = advance(game, state => state.phase === 4 && clean(state));
  game = act(game, f.reactor, { type: 'card', mode: 'choam', card: card.id, target: f.actor });
  assert.equal(game.pendingChoamWorthless?.effect, 'laLaLa');
  assert.equal(game.response?.kind, 'choamWorthless');
  game = act(game, f.actor, { type: 'card', mode: 'cancel', card: f.karama });
  assert.equal(game.pendingKull?.stage, 'offer');
  const reaction = viewGame(game, f.reactor).kullReaction;
  assert.ok(reaction);
  assert.ok(reaction.plays.some(row => row.card.id === f.kull && !row.blocked));
  game = act(game, f.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: f.kull });
  game = advance(game, state => !!state.pendingTreacheryDiscard);
  const pending = game.pendingTreacheryDiscard;
  assert.ok(pending);
  assert.equal(pending.continuation.kind, 'kullSuccessDiscard');
  assert.equal(game.pendingChoamWorthless?.effect, 'laLaLa');
  assert.ok(player(game, f.actor).hand.some(held => held.id === f.karama));
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  game = act(game, f.holder, { type: 'semutaCommit', event: pending.batch.event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = act(game, f.holder, { type: 'semutaSelect', event: pending.batch.event, card: f.kull });
  game = advance(game, clean);
  assert.equal(game.pendingKull, null);
  assert.ok(player(game, f.holder).hand.some(held => held.id === f.kull));
  assert.ok(player(game, f.actor).hand.some(held => held.id === f.karama));
  assert.ok(game.revivalRules?.freeBlocked?.includes(f.actor));
  assert.deepEqual(inventory(game), f.originalCards);
});
