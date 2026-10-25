import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { matchesShipment, type ShipmentExpression } from '../game/shipment-promises';
import { shipmentExpressionInputSize } from '../game/shipment-expression-input';
import {
  createTruthShipmentExpressionFixture as fixture,
  actTruthShipmentExpression as act,
  truthShipmentExpressionClean as clean,
  truthShipmentExpressionPlayer as player,
  truthShipmentExpressionInventory as inventory,
  truthShipmentExpressionScenario as scenario,
  truthShipmentExpressionNestedScenario as nestedScenario,
  truthShipmentExpressionDepthScenario as depthScenario,
  declareTruthShipmentExpression as declare,
  passTruthShipmentExpressionPriority as passPriority,
  askTruthShipmentExpression as ask,
  answerTruthShipmentExpression as answer,
  settleTruthShipmentExpression as settle,
  finishTruthShipmentExpression as finish,
  type TruthShipmentExpressionFixture,
} from './fixture-truth-shipment-expression';

function reject(game: Game, actor: string, action: Action, message?: RegExp) {
  const before = structuredClone(game);
  const run = () => applyAction(game, actor, action);
  if (message) assert.throws(run, message); else assert.throws(run);
  assert.deepEqual(game, before);
}

/** Only the native interrupted movement controls, not a recovery campaign. */
function movementControls(game: Game) {
  return { turn: game.turn, phase: game.phase, active: game.active, order: game.order,
    movementRemaining: game.movementRemaining, storm: game.storm,
    response: game.response ?? null, decision: game.decision ?? null,
    phaseOpening: game.phaseOpening ?? null, pendingShipment: game.pendingShipment ?? null };
}
function bound(game: Game, f: TruthShipmentExpressionFixture, expression: ShipmentExpression, expected: 'yes' | 'no') {
  assert.ok(clean(game)); assert.equal(game.truthtrance, null);
  assert.deepEqual(movementControls(game), movementControls(f.source));
  assert.equal(player(game, f.target).shipped, false); assert.equal(player(game, f.target).reserves, 20);
  assert.deepEqual(player(game, f.target).hand, player(f.source, f.target).hand);
  assert.equal(player(game, f.target).spice, player(f.source, f.target).spice);
  assert.deepEqual(game.shipmentPromises, [{ player: f.target, asker: f.asker,
    turn: f.source.turn, claim: expression, answer: expected === 'yes' }]);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(game.discard.length, f.source.discard.length + 1);
  assert.equal(player(game, f.asker).hand.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.originalCards);
  assert.deepEqual(game.truthHistory!.at(-1), { turn: f.source.turn, phase: 5, asker: f.asker,
    question: { kind: 'shipment', target: f.target, claim: expression }, answer: expected });
}
function delivered(game: Game, f: TruthShipmentExpressionFixture) {
  assert.ok(clean(game)); assert.equal(game.pendingShipment ?? null, null);
  assert.equal(game.phase, 5); assert.equal(game.active, f.target);
  assert.equal(player(game, f.target).shipped, true);
  assert.equal(player(game, f.target).forces[f.location], 1);
  assert.equal(player(game, f.target).reserves, 19);
  assert.equal(player(f.source, f.target).spice - player(game, f.target).spice, 1);
  assert.equal(game.shipmentPromises!.length, 1);
  assert.equal(game.shipmentPromises![0].fulfilled, true);
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
}

void test('pure shipment source uses only the original public Basic prefix before Emperor’s unused active turn', () => {
  const f = fixture();
  assert.equal(f.game.advanced, false); assert.deepEqual(f.game.expansions, []);
  assert.equal(f.setup.deck.length, 33); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.deepEqual(f.game.players.map(candidate => candidate.faction), ['atreides', 'emperor']);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.target);
  assert.equal(player(f.game, f.target).reserves, 20); assert.deepEqual(player(f.game, f.target).forces, {});
  assert.equal(player(f.game, f.target).shipped, false);
  assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.card));
  assert.ok(player(f.game, f.target).hand.some(card => card.id === f.ordinary));
  assert.deepEqual(f.actions, f.base.actions.slice(0, f.sourceCounts.shipment));
  assert.deepEqual(f.base.actions[f.sourceActionCount], f.shipmentStep);
  assert.ok(f.sourceActionCount < f.base.sourceActionCount);
  assert.equal(f.actions.some(step => step.action.type === 'chooseBattle' || step.action.type === 'battlePlan'), false);
  assert.equal(f.game.truthHistory?.length ?? 0, 0); assert.equal(f.game.shipmentPromises?.length ?? 0, 0);
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
});

void test('native three through eight leaf AND and OR promises retain and fulfill both whole-expression Yes and No', () => {
  const f = fixture();
  for (const op of ['and', 'or'] as const) for (const count of [3, 4, 5, 6, 7, 8])
    for (const expected of ['yes', 'no'] as const) {
      const selected = scenario(op, count, expected), done = finish(f, selected);
      assert.equal(done.question.action.type, 'truthAsk');
      assert.deepEqual(done.beforeQuestion.truthtrance!.question, null);
      assert.deepEqual(viewGame(done.asked, f.target).truthShipmentAnswers, ['yes', 'no']);
      assert.equal(viewGame(done.asked, f.asker).truthShipmentAnswers, null);
      bound(done.bound, f, selected.expression, expected); delivered(done.game, f);
      assert.equal(matchesShipment({ claim: selected.expression }, { territory: 'arrakeen', amount: 1 }), expected === 'yes');
      assert.equal(done.actions.length, 5, 'Original declaration, one priority pass, full question, answer and delivery');
      if (op === 'and' && expected === 'no') {
        assert.ok('op' in selected.expression);
        assert.equal(matchesShipment({ claim: selected.expression.terms[0] }, { territory: 'arrakeen', amount: 1 }), true,
          'No makes the whole expression false while earlier conditions may remain true');
      }
    }
});

void test('native nested AND within OR and OR within AND keep their complete statement through actual delivery', () => {
  const f = fixture();
  for (const op of ['and', 'or'] as const) for (const expected of ['yes', 'no'] as const) {
    const selected = nestedScenario(op, expected), done = finish(f, selected);
    assert.deepEqual(done.asked.truthtrance!.question, { kind: 'shipment', target: f.target, claim: selected.expression });
    bound(done.bound, f, selected.expression, expected); delivered(done.game, f);
  }
});

void test('a sixteen-leaf distinct-destination OR and four group levels use the full existing pure-shipment bounds', () => {
  const f = fixture(), sixteen = scenario('or', 16, 'yes');
  assert.ok('op' in sixteen.expression);
  assert.equal(new Set(sixteen.expression.terms.map(term => 'territory' in term ? term.territory : '')).size, 16);
  assert.ok(sixteen.expression.terms.every(term => 'minimum' in term && term.minimum === 1));
  assert.deepEqual(sixteen.expression.terms[15], { territory: 'arrakeen', minimum: 1 });
  assert.deepEqual(shipmentExpressionInputSize(sixteen.expression), { leaves: 16, depth: 1 });
  for (const selected of [sixteen, depthScenario(4)]) {
    const done = finish(f, selected);
    bound(done.bound, f, selected.expression, 'yes'); delivered(done.game, f);
    const continued = act(done.game, f.continuationStep.actor, f.continuationStep.action, done.actions);
    assert.equal(done.actions.length, 6);
    assert.equal(continued.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(continued.shipmentPromises![0].fulfilled, true);
    assert.deepEqual(inventory(continued), f.originalCards);
  }
});

void test('original priority, target-only answer and one discard resume the same actor’s paid shipment and endMovement', () => {
  const f = fixture(), declared = declare(f);
  assert.deepEqual(declared.game.truthtrance!.queue, [{ player: f.asker, card: f.card }]);
  assert.deepEqual(declared.game.truthtrance!.passed, [f.asker]);
  reject(declared.game, f.asker, f.askStep.action, /priority/);
  let game = passPriority(declared.game, declared.actions);
  reject(game, f.target, f.askStep.action, /holder/);
  game = act(game, f.asker, f.askStep.action, declared.actions);
  reject(game, f.asker, f.answerStep.action, /questioned player/);
  reject(game, f.target, { type: 'truthAnswer', answer: 'unknown' });
  reject(game, f.target, f.shipmentStep.action);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 0);
  game = answer(game, 'yes', declared.actions);
  bound(game, f, f.expression, 'yes');
  reject(game, f.target, { type: 'endMovement' });
  reject(game, f.target, { ...f.shipmentStep.action, territory: 'carthag', sector: 11 });
  game = act(game, f.shipmentStep.actor, f.shipmentStep.action, declared.actions);
  game = settle(game, declared.actions); delivered(game, f);
  assert.equal(game.active, f.continuationStep.actor);
  reject(game, f.target, f.answerStep.action);
  const continued = act(game, f.continuationStep.actor, f.continuationStep.action, declared.actions);
  assert.equal(declared.actions.length, 6);
  assert.equal(continued.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(continued), f.originalCards);
});

void test('OR No rejects its matching original delivery and can explicitly skip the shipment instead', () => {
  const f = fixture(), selected = scenario('or', 16, 'yes'), asked = ask(f, selected.expression);
  let game = answer(asked.game, 'no');
  bound(game, f, selected.expression, 'no');
  reject(game, f.target, f.shipmentStep.action);
  game = act(game, f.continuationStep.actor, f.continuationStep.action);
  assert.equal(player(game, f.target).reserves, 20); assert.deepEqual(player(game, f.target).forces, {});
  assert.equal(game.shipmentPromises![0].fulfilled, true);
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all leaves validate before Ask even under decisive OR; constants, seventeenth leaf and fifth depth never consume the card', () => {
  const f = fixture(), game = passPriority(declare(f).game);
  const a: ShipmentExpression = { territory: 'arrakeen', minimum: 1 };
  const invalid: ShipmentExpression[] = [
    { op: 'or', terms: [a, a, { territory: 'arrakeen', minimum: 0 }] },
    { op: 'or', terms: [a, a, { territory: 'not-a-territory', minimum: 1 }] },
    ...(['yes', 'no', 'unknown'] as const).map(constant => ({ op: 'or' as const, terms: [a, a, { constant }] })),
    { op: 'or', terms: [a, { op: 'and', terms: [a, { constant: 'yes' }] }] },
    { op: 'and', terms: [a] }, { op: 'or', terms: [] },
    { op: 'or', terms: Array.from({ length: 17 }, () => a) },
    depthScenario(5).expression,
  ];
  for (const expression of invalid)
    reject(game, f.asker, { type: 'truthAsk', question: { kind: 'shipment', target: f.target, claim: expression } });
  assert.equal(game.truthtrance!.stage, 'ask'); assert.equal(game.truthtrance!.question, null);
  assert.deepEqual(game.discard, f.source.discard);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a genuine incompatible-destination AND offers only No and honors it with a matching individual branch', () => {
  const f = fixture(), expression: ShipmentExpression = { op: 'and', terms: [
    { territory: 'arrakeen', minimum: 1 }, { territory: 'carthag', minimum: 1 }, { territory: 'sietch_tabr', minimum: 1 },
  ] };
  const asked = ask(f, expression);
  assert.deepEqual(viewGame(asked.game, f.target).truthShipmentAnswers, ['no']);
  reject(asked.game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const done = finish(f, { id: 'incompatible-and-no', expression, answer: 'no' });
  bound(done.bound, f, expression, 'no'); delivered(done.game, f);
});

void test('all four minimal profiles pass native priority and legally answer and complete full pure shipment expressions', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const declared = declare(f), priority = viewGame(declared.game, f.target);
    priority.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(priority), [{ type: 'truthPass' }]);
    const passed = act(declared.game, f.target, botActions(priority)[0]);
    assert.equal(passPriority(passed).truthtrance!.stage, 'ask');
    for (const selected of [scenario('and', 8, 'yes'), scenario('or', 8, 'no'),
      nestedScenario('and', 'no'), nestedScenario('or', 'yes'), scenario('or', 16, 'yes')]) {
      const asked = ask(f, selected.expression), view = viewGame(asked.game, f.target);
      view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const before = structuredClone(view), actions = botActions(view);
      assert.deepEqual(view, before); assert.equal(actions.length, 1);
      assert.equal(actions[0].type, 'truthAnswer');
      const selectedAnswer = actions[0].answer;
      assert.ok(selectedAnswer === 'yes' || selectedAnswer === 'no');
      assert.ok(view.truthShipmentAnswers!.includes(selectedAnswer));
      assert.deepEqual(botActions(viewGame(asked.game, f.asker)), []);
      let game = act(asked.game, f.target, actions[0]);
      bound(game, f, selected.expression, selectedAnswer);
      const completion = viewGame(game, f.target).shipmentCompletion?.actions;
      assert.ok(completion?.length, 'The authoritative existing completion supplies a legal next step');
      game = act(game, f.target, completion[0]); game = settle(game);
      assert.equal(game.shipmentPromises![0].fulfilled, true);
      assert.equal(game.shipmentPromises![0].released, undefined);
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
      assert.deepEqual(inventory(game), f.originalCards);
    }
  }
});
