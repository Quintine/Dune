import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';
import { askKnowledge, rejectKnowledge } from './truthtrance-knowledge-fixture';
import {
  advanceTruthMovementNativeEarly, createTruthMovementNativeEarlyFixture,
  truthMovementNativeEarlyInventory,
} from './fixture-truth-movement-native-early';

/** Original Basic start and native Ixian inspection. The shared fixture selects
 * unopened starting positions so Atreides receives a real Truthtrance card. */
function inspectedPool(): { game: Game; returned: string } {
  const fixture = createTruthMovementNativeEarlyFixture({ roster: 'ixians-tleilaxu' });
  let game = advanceTruthMovementNativeEarly(fixture.game, state =>
    state.phase === 3 && state.decision?.kind === 'ixAuction' && !state.response);
  const initial = game.ixAuction!.cards;
  assert.ok(initial.length > 1);
  const returned = initial[0].id;
  const retained = initial.slice(1).map(card => card.id).sort();
  game = applyAction(game, 'ixians', { type: 'decision', card: returned, position: 'bottom' });
  game = advanceTruthMovementNativeEarly(game, state =>
    state.phase === 3 && !!state.auction && !!state.ixAuctionKnown &&
    !state.response && !state.decision && !state.phaseOpening);
  assert.deepEqual(game.ixAuctionKnown!.cards.map(card => card.id).sort(), retained);
  assert.ok(!game.ixAuctionKnown!.cards.some(card => card.id === returned));
  assert.deepEqual(truthMovementNativeEarlyInventory(game), fixture.originalCards);
  return { game, returned };
}

void test('native Basic Ixian pool knowledge answers privately and preserves the original cards', () => {
  const { game: initial, returned } = inspectedPool();
  const pool = structuredClone(initial.ixAuctionKnown!.cards);
  const lot = structuredClone(initial.auction);
  const owned = viewGame(initial, 'ixians').ixTechnology;
  assert.deepEqual(owned?.known.map(card => card.id).sort(), pool.map(card => card.id).sort());
  assert.equal(viewGame(initial, 'emperor').ixTechnology, null);
  const name = pool[0].name;
  const questioned = askKnowledge(initial, 'ixians', { kind: 'ixPoolPeek', name });
  assert.equal(viewGame(questioned, 'ixians').truthAnswer, 'yes');
  for (const id of ['atreides', 'emperor', 'tleilaxu'])
    assert.equal(viewGame(questioned, id).truthAnswer, null);
  rejectKnowledge(questioned, 'ixians', { type: 'truthAnswer', answer: 'no' });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(questioned, 'ixians');
    view.players.find(player => player.id === 'ixians')!.bot = difficulty;
    const actions = botActions(view);
    assert.deepEqual(actions, [{ type: 'truthAnswer', answer: 'yes' }]);
    const done = applyAction(questioned, 'ixians', actions[0]);
    assert.equal(done.truthtrance, null);
    assert.equal(done.truthHistory!.at(-1)!.answer, 'yes');
    assert.deepEqual(done.ixAuctionKnown!.cards, pool);
    assert.deepEqual(done.auction, lot);
    assert.ok(done.deck.some(card => card.id === returned));
    assert.deepEqual(truthMovementNativeEarlyInventory(done), truthMovementNativeEarlyInventory(initial));
  }
});

void test('the recorded group answers no for an absent face and unknown when no matching knowledge exists', () => {
  const { game: initial } = inspectedPool();
  const absent = TRUTH_CARD_NAMES.find(name => !initial.ixAuctionKnown!.cards.some(card => card.name === name));
  assert.ok(absent);
  const notInPool = askKnowledge(initial, 'ixians', { kind: 'ixPoolPeek', name: absent });
  assert.equal(viewGame(notInPool, 'ixians').truthAnswer, 'no');
  const done = applyAction(notInPool, 'ixians', { type: 'truthAnswer', answer: 'no' });
  assert.deepEqual(truthMovementNativeEarlyInventory(done), truthMovementNativeEarlyInventory(initial));

  // These explicit saved-state fixtures remove or age the actual learned
  // observation; no simulated card is inserted into the physical auction.
  for (const missing of [null, { ...initial.ixAuctionKnown!, turn: initial.turn - 1 }]) {
    const staged = structuredClone(initial);
    staged.ixAuctionKnown = missing;
    const unknown = askKnowledge(staged, 'ixians', { kind: 'ixPoolPeek', name: absent });
    assert.equal(viewGame(unknown, 'ixians').truthAnswer, 'unknown');
    rejectKnowledge(unknown, 'ixians', { type: 'truthAnswer', answer: 'yes' });
    assert.equal(applyAction(unknown, 'ixians', { type: 'truthAnswer', answer: 'unknown' }).truthtrance?.stage, 'unknown');
  }
  const wrong = askKnowledge(initial, 'emperor', { kind: 'ixPoolPeek', name: initial.ixAuctionKnown!.cards[0].name });
  assert.equal(viewGame(wrong, 'emperor').truthAnswer, 'unknown');
});
