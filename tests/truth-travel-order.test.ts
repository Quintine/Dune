import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { truthTravelGroup as group, truthTravelMove as move, truthTravelShip as ship } from './fixture-truth-travel';
import {
  actTruthTravelOrder as act, answerTruthTravelOrder as answer, askTruthTravelOrder as ask,
  bindTruthTravelOrder as bind, createTruthTravelOrderFixture as fixture, declareTruthTravelOrder as declare,
  settleTruthTravelOrder as settle, truthTravelOrderInventory as inventory, truthTravelOrderPlayer as player,
  truthTravelOrderQuestion as travelQuestion, type TruthTravelOrderFixture, type TruthTravelOrderStep,
} from './fixture-truth-travel-order';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physicalTruthsOnce(game: Game, f: TruthTravelOrderFixture) {
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.equal(player(game, f.asker).hand.some(card => f.truths.includes(card.id)), false);
  assert.deepEqual(inventory(game), f.originalCards);
}
function scalarQuestion(f: TruthTravelOrderFixture, kind: 'shipment' | 'movement' | 'movementExpression'): TruthQuestion {
  if (kind === 'shipment') return f.shipmentQuestion;
  if (kind === 'movement') return f.movementQuestion;
  return { kind: 'movementExpression', target: f.target, turn: f.game.turn, claim: { kind: 'or', terms: [
    { kind: 'move', territory: 'imperial_basin', minimum: 1 },
    { kind: 'move', territory: 'carthag', minimum: 1 },
  ] } };
}
function nativeRow(game: Game, kind: 'shipment' | 'movement' | 'movementExpression') {
  const row = kind === 'shipment' ? game.shipmentPromises?.[0]
    : kind === 'movement' ? game.movementPromises?.[0] : game.movementExpressionPromises?.[0];
  assert.ok(row); return row;
}

void test('native travel-order source genuinely owns both original opening Truthtrances before any question', () => {
  const f = fixture();
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.deck.length, 33);
  assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.equal(f.setup.deck.filter(card => card.effect === 'truthtrance').length, 2);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
  assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.target); assert.equal(f.target, 'atreides');
  assert.equal(f.sourceCount, f.actions.length); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceCounts.inheritedBidding + f.sourceCounts.nativeContinuation, f.sourceCount);
  assert.deepEqual(f.sourceActions.slice(0, f.sourceCounts.inheritedBidding), f.base.sourceActions);
  assert.equal(f.continuation.length, f.sourceCounts.nativeContinuation);
  assert.ok(f.continuation.some(step => step.action.type === 'passBid'));
  assert.ok(f.continuation.some(step => step.action.type === 'ready'));
  assert.ok(f.continuation.some(step => step.actor === f.asker && step.action.type === 'endMovement'));
  assert.equal(player(f.game, f.target).spice, 10); assert.equal(player(f.game, f.target).reserves, 10);
  assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10 });
  assert.equal(f.game.truthHistory?.length ?? 0, 0); assert.equal(f.game.travelPromiseOrder, undefined);
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
});

for (const kind of ['shipment', 'movement', 'movementExpression'] as const)
  for (const first of ['native', 'travel'] as const)
    void test(`two native opening Truths retain ${kind} No and travel OR Yes in actual ${first}-first acceptance order`, () => {
      const f = fixture(), actions: TruthTravelOrderStep[] = [];
      const native = scalarQuestion(f, kind), travel = f.travelQuestion;
      let game = f.game;
      game = bind(f, game, 0, first === 'native' ? native : travel, first === 'native' ? 'no' : 'yes', actions).game;
      const firstHistory = structuredClone(game.truthHistory!.at(-1));
      game = bind(f, game, 1, first === 'native' ? travel : native, first === 'native' ? 'yes' : 'no', actions).game;
      assert.deepEqual(game.travelPromiseOrder, first === 'native'
        ? [{ kind, index: 0 }, { kind: 'travel', index: 0 }]
        : [{ kind: 'travel', index: 0 }, { kind, index: 0 }]);
      assert.deepEqual(game.truthHistory!.at(-2), firstHistory);
      assert.equal(nativeRow(game, kind).answer, false); assert.ok(!nativeRow(game, kind).released);
      assert.equal(game.travelPromises![0].answer, true); assert.ok(!game.travelPromises![0].released);
      assert.deepEqual(viewGame(game, f.observer).travelPromises, []);
      if (kind === 'shipment') {
        rejected(game, f.target, f.shipment);
        const beforeSpice = player(game, f.target).spice;
        game = settle(act(game, f.target, f.alternativeShipment, actions), actions);
        assert.equal(player(game, f.target).spice, beforeSpice - 1);
        assert.ok(!game.travelPromises![0].fulfilled);
        game = settle(act(game, f.target, f.move, actions), actions);
        assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
      } else {
        rejected(game, f.target, f.move);
        const beforeSpice = player(game, f.target).spice;
        game = settle(act(game, f.target, f.shipment, actions), actions);
        assert.equal(player(game, f.target).spice, beforeSpice - 2);
        assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
        if (kind === 'movement') game = settle(act(game, f.target, f.alternativeMove, actions), actions);
      }
      assert.equal(game.travelPromises![0].fulfilled, true); assert.ok(!nativeRow(game, kind).released);
      game = settle(act(game, f.target, f.end, actions), actions);
      assert.equal(nativeRow(game, kind).fulfilled, true); assert.ok(!nativeRow(game, kind).released);
      assert.equal(game.travelPromises![0].fulfilled, true); assert.ok(!game.travelPromises![0].released);
      assert.equal(game.truthHistory!.length, 2); assert.equal(actions.filter(step => step.action.type === 'truthAsk').length, 2);
      physicalTruthsOnce(game, f);
    });

void test('two native opening Truths keep whole travel No with an earlier or later compatible scalar shipment Yes', () => {
  const f = fixture(), travel = travelQuestion(f, group('and', ship(), move()));
  for (const first of ['native', 'travel'] as const) {
    const actions: TruthTravelOrderStep[] = [];
    let game = bind(f, f.game, 0, first === 'native' ? f.shipmentQuestion : travel,
      first === 'native' ? 'yes' : 'no', actions).game;
    const earlier = structuredClone(game.truthHistory!.at(-1));
    game = bind(f, game, 1, first === 'native' ? travel : f.shipmentQuestion,
      first === 'native' ? 'no' : 'yes', actions).game;
    assert.deepEqual(game.travelPromiseOrder, first === 'native'
      ? [{ kind: 'shipment', index: 0 }, { kind: 'travel', index: 0 }]
      : [{ kind: 'travel', index: 0 }, { kind: 'shipment', index: 0 }]);
    rejected(game, f.target, f.end);
    game = settle(act(game, f.target, f.shipment, actions), actions);
    assert.equal(game.shipmentPromises![0].fulfilled, true);
    assert.ok(!game.travelPromises![0].fulfilled); rejected(game, f.target, f.move);
    game = settle(act(game, f.target, f.end, actions), actions);
    assert.equal(game.travelPromises![0].fulfilled, true); assert.ok(!game.travelPromises![0].released);
    assert.equal(game.shipmentPromises![0].fulfilled, true); assert.ok(!game.shipmentPromises![0].released);
    assert.equal(player(game, f.target).moved, 0); assert.deepEqual(game.truthHistory!.at(-2), earlier);
    physicalTruthsOnce(game, f);
  }
});

void test('an incompatible second definite answer cannot erase the first native or travel receipt', () => {
  const f = fixture();
  // Earlier original shipment Yes forces the later incompatible-destination
  // travel AND to No. The second native card remains present after rejection.
  let game = bind(f, f.game, 0, f.shipmentQuestion, 'yes').game;
  const earlierShipment = structuredClone(game.shipmentPromises![0]), earlierHistory = structuredClone(game.truthHistory![0]);
  const incompatibleTravel = travelQuestion(f, group('and', ship('arrakeen'), move()));
  game = ask(declare(f, game, 1).game, f.asker, incompatibleTravel);
  assert.deepEqual(viewGame(game, f.target).truthTravelAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(game.shipmentPromises![0], earlierShipment); assert.deepEqual(game.truthHistory![0], earlierHistory);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  game = answer(game, f.target, 'no'); game = settle(act(game, f.target, f.shipment));
  game = settle(act(game, f.target, f.end)); physicalTruthsOnce(game, f);
  assert.equal(game.shipmentPromises![0].fulfilled, true); assert.equal(game.travelPromises![0].fulfilled, true);

  // Reverse actual acceptance: the original travel AND Yes requires Polar
  // Sink. A later scalar cannot answer No and erase that earlier raw receipt.
  game = bind(f, f.game, 0, travelQuestion(f, group('and', ship(), move())), 'yes').game;
  const earlierTravel = structuredClone(game.travelPromises![0]);
  game = ask(declare(f, game, 1).game, f.asker, f.shipmentQuestion);
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' });
  assert.deepEqual(game.travelPromises![0], earlierTravel);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  game = answer(game, f.target, 'yes');
  assert.deepEqual(game.travelPromiseOrder, [{ kind: 'travel', index: 0 }, { kind: 'shipment', index: 0 }]);
  game = settle(act(game, f.target, f.shipment)); game = settle(act(game, f.target, f.move));
  game = settle(act(game, f.target, f.end));
  assert.equal(game.travelPromises![0].fulfilled, true); assert.ok(!game.travelPromises![0].released);
  assert.equal(game.shipmentPromises![0].fulfilled, true); assert.ok(!game.shipmentPromises![0].released);
  physicalTruthsOnce(game, f);
});
