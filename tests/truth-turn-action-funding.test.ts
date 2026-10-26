import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actTruthBid as act, createTruthBidFixture, truthBidInventory as inventory, truthBidPlayer as player,
  type TruthBidStep,
} from './fixture-truth-bid';
import {
  createTruthRevivalEarlyFixture, reachTruthRevivalEarlyOpportunity, settleTruthRevivalEarly,
} from './fixture-truth-revival-early';

/** These two sources actually deal Harkonnen both printed Truthtrances.
 * Every commitment below uses its own card and native declaration/priority/
 * Ask/answer; no hand, cash, force, clock or promise is installed. */
function ask(game: Game, asker: string, card: string, question: TruthQuestion, actions: TruthBidStep[]) {
  game = act(game, asker, { type: 'card', card }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'truthPass' }, actions);
  }
  return act(game, asker, { type: 'truthAsk', question }, actions);
}
function paymentQuestion(game: Game, target: string, recipient: string, minimum: number): TruthQuestion {
  return { kind: 'turnActions', target, turn: game.turn,
    mixed: { kind: 'action', action: { kind: 'payment', recipient, minimum } } };
}
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physicalTruths(game: Game, truths: string[], originalCards: string[]) {
  for (const truth of truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), originalCards);
}

for (const first of ['bid', 'aggregate'] as const)
  void test(`two original Truths reject a second unfunded payment or bid Yes with ${first} accepted first`, () => {
    const f = createTruthBidFixture({ window: 'active' }), actions: TruthBidStep[] = [];
    assert.equal(f.game.phase, 3); assert.equal(f.game.auction?.active, f.target);
    assert.equal(player(f.game, f.target).spice, 10);
    assert.equal(f.sourceActionCount, f.sourceActions.length);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    const bid: TruthQuestion = { ...f.question, minimum: 10 };
    const aggregate = paymentQuestion(f.game, f.target, f.asker, 10);
    let game = ask(f.game, f.asker, f.truths[0], first === 'bid' ? bid : aggregate, actions);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }, actions);
    const earlierHistory = structuredClone(game.truthHistory![0]);
    const earlierRow = structuredClone(first === 'bid' ? game.bidPromises![0] : game.turnActionPromises![0]);
    game = ask(game, f.asker, f.truths[1], first === 'bid' ? aggregate : bid, actions);
    const answers = first === 'bid' ? viewGame(game, f.target).truthTurnActionAnswers : viewGame(game, f.target).truthBidAnswers;
    assert.deepEqual(answers, ['no']); rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(game.truthHistory![0], earlierHistory);
    assert.deepEqual(first === 'bid' ? game.bidPromises![0] : game.turnActionPromises![0], earlierRow);
    assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
    assert.equal(player(game, f.target).spice, 10);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' }, actions);
    assert.equal(game.truthHistory!.length, 2); assert.deepEqual(game.truthHistory![0], earlierHistory);
    assert.deepEqual(first === 'bid' ? game.bidPromises![0] : game.turnActionPromises![0], earlierRow);
    game = act(game, f.target, first === 'bid'
      ? { type: 'bid', amount: 10, allyPayment: 0 }
      : { type: 'bribe', target: f.asker, amount: 10 }, actions);
    assert.equal(first === 'bid' ? game.bidPromises![0].fulfilled : game.turnActionPromises![0].fulfilled, true);
    assert.ok(!(first === 'bid' ? game.bidPromises![0].released : game.turnActionPromises![0].released));
    physicalTruths(game, f.truths, f.originalCards);
  });

for (const first of ['revival', 'aggregate'] as const)
  void test(`two earned native Truths reject a second unfunded payment or Revival Yes with ${first} accepted first`, () => {
    // The original source paid six for a real shipment of three; the next
    // Storm killed those counters. Its four remaining spice fund exactly the
    // ordinary three-force return (one free, two paid), or one payment of four.
    const f = createTruthRevivalEarlyFixture({ phase: 3 }), actions = structuredClone(f.sourceActions);
    assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
    let game = reachTruthRevivalEarlyOpportunity(f.game, f.target, actions);
    assert.equal(game.turn, 2); assert.equal(game.phase, 4); assert.equal(player(game, f.target).spice, 4);
    assert.equal(player(game, f.target).tanks, 3); assert.equal(player(game, f.target).reserves, 17);
    assert.deepEqual(player(game, f.asker).hand.map(card => card.id), f.truths);
    const revival: TruthQuestion = { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 3 };
    const aggregate = paymentQuestion(game, f.target, f.asker, 4);
    game = ask(game, f.asker, f.truths[0], first === 'revival' ? revival : aggregate, actions);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }, actions);
    const earlierHistory = structuredClone(game.truthHistory![0]);
    const earlierRow = structuredClone(first === 'revival' ? game.revivalPromises![0] : game.turnActionPromises![0]);
    game = ask(game, f.asker, f.truths[1], first === 'revival' ? aggregate : revival, actions);
    const answers = first === 'revival' ? viewGame(game, f.target).truthTurnActionAnswers : viewGame(game, f.target).truthRevivalAnswers;
    assert.deepEqual(answers, ['no']); rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(game.truthHistory![0], earlierHistory);
    assert.deepEqual(first === 'revival' ? game.revivalPromises![0] : game.turnActionPromises![0], earlierRow);
    assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' }, actions);
    assert.equal(game.truthHistory!.length, 2); assert.deepEqual(game.truthHistory![0], earlierHistory);
    assert.deepEqual(first === 'revival' ? game.revivalPromises![0] : game.turnActionPromises![0], earlierRow);
    game = settleTruthRevivalEarly(act(game, f.target, first === 'revival'
      ? { type: 'revive', amount: 3, elite: 0 }
      : { type: 'bribe', target: f.asker, amount: 4 }, actions), actions);
    assert.equal(player(game, f.target).spice, 0);
    assert.equal(first === 'revival' ? game.revivalPromises![0].fulfilled : game.turnActionPromises![0].fulfilled, true);
    assert.ok(!(first === 'revival' ? game.revivalPromises![0].released : game.turnActionPromises![0].released));
    physicalTruths(game, f.truths, f.originalCards);
  });
