import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { matchesPlanClaim, type PlanClaim } from '../game/battle-promises';
import { battleClaimExpressionSize } from '../game/battle-claim-expression';
import {
  createTruthPlanExpressionFixture as fixture,
  actTruthPlanExpression as act,
  truthPlanExpressionClean as clean,
  truthPlanExpressionPlayer as player,
  truthPlanExpressionInventory as inventory,
  truthPlanExpressionClaims as claims,
  truthPlanExpressionScenario as scenario,
  truthPlanExpressionNestedScenario as nestedScenario,
  declareTruthPlanExpression as declare,
  passTruthPlanExpressionPriority as passPriority,
  createTruthPlanExpressionAskSource as askSource,
  askTruthPlanExpression as ask,
  answerTruthPlanExpression as answer,
  sealTruthPlanExpression as seal,
  finishTruthPlanExpression as finish,
  type TruthPlanExpressionFixture,
} from './fixture-truth-plan-expression';

function reject(game: Game, actor: string, action: Action, message?: RegExp) {
  const before = structuredClone(game), run = () => applyAction(game, actor, action);
  if (message) assert.throws(run, message); else assert.throws(run);
  assert.deepEqual(game, before);
}
function battleControls(game: Game) {
  const battle = game.battle; assert.ok(battle);
  return {
    status: game.status, turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
    event: battle.event, territory: battle.territory, attacker: battle.attacker, defender: battle.defender,
    revealed: battle.revealed, plans: battle.plans,
    preparation: battle.preparation ?? null, preLeader: battle.preLeader ?? null,
    traitorCalls: battle.traitorCalls,
  };
}
function answered(game: Game, f: TruthPlanExpressionFixture, claim: PlanClaim, expected: 'yes' | 'no') {
  assert.ok(clean(game)); assert.equal(game.truthtrance, null);
  assert.deepEqual(battleControls(game), battleControls(f.source));
  assert.deepEqual(player(game, f.target).hand, player(f.source, f.target).hand);
  assert.equal(game.discard.length, f.source.discard.length + 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.asker).hand.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.originalCards);
  assert.deepEqual(game.battle!.truthPromises, [{ player: f.target, asker: f.asker, claim, answer: expected === 'yes' }]);
  assert.deepEqual(game.truthHistory!.at(-1), {
    turn: 1, phase: 6, asker: f.asker,
    question: { kind: 'battlePlan', target: f.target, territory: f.territory, claim }, answer: expected,
  });
}
function actualPlan(game: Game, f: TruthPlanExpressionFixture, claim: PlanClaim, expected: 'yes' | 'no') {
  assert.ok(game.battle?.revealed);
  assert.equal(game.battle.event, f.event); assert.equal(game.battle.territory, f.territory);
  const plan = game.battle.plans[f.target];
  assert.equal(matchesPlanClaim(claim, { ...plan, kwisatz: !!plan.kwisatz }, player(game, f.target).hand), expected === 'yes');
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
}

void test('native battle expression source stops at its honest action prefix before both original plans', () => {
  const f = fixture();
  assert.equal(f.setup.deck.length, 33); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.deepEqual(f.game.players.map(candidate => candidate.faction), ['atreides', 'emperor']);
  assert.equal(f.sourceActionCount, f.base.sourceActionCount - f.base.planSteps.length);
  assert.equal(f.actions.length, f.sourceActionCount);
  assert.deepEqual(f.actions, f.base.actions.slice(0, -2));
  assert.deepEqual(f.game, f.base.beforePlans); assert.ok(clean(f.game));
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, 1);
  assert.equal(f.game.battle!.revealed, false); assert.deepEqual(f.game.battle!.plans, {});
  assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.ordinary]);
  assert.equal(f.projectile.kind, 'projectile');
  assert.equal(player(f.game, f.target).forces['arrakeen:10'], 1);
  assert.equal(player(f.game, f.target).reserves, 19);
  assert.deepEqual(f.claim, { kind: 'and', terms: [
    { kind: 'dial', compare: 'eq', value: 0 }, { kind: 'weapon', name: null }, { kind: 'defense', name: null },
  ] });
  const prePromise = act(f.game, f.target, f.projectilePlan);
  assert.equal(prePromise.battle!.plans[f.target].weapon, f.ordinary, 'The original held projectile is legal before the promise');
  assert.equal(prePromise.battle!.revealed, false);
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
});

void test('three through eight condition AND and OR answers bind actual original empty or projectile plans', () => {
  const f = fixture();
  for (const kind of ['and', 'or'] as const) for (const count of [3, 4, 5, 6, 7, 8])
    for (const expected of ['yes', 'no'] as const) {
      const selected = scenario(f, kind, count, expected), asked = ask(f, selected.claim);
      assert.equal(asked.actions.length, 3, 'Declaration, the other seat priority pass and whole question');
      assert.deepEqual(viewGame(asked.game, f.target).truthBattleAnswers, ['yes', 'no']);
      assert.deepEqual(battleControls(asked.game), battleControls(f.source));
      reject(asked.game, f.target, { type: 'truthAnswer', answer: 'unknown' }, /legal plans/);
      const done = answer(asked.game, expected, asked.actions);
      answered(done, f, selected.claim, expected);
      reject(done, f.target, selected.contradictingPlan, /honor your Truthtrance/);
      const sealed = seal(done, f, selected.plan, asked.actions);
      assert.equal(asked.actions.length, 6);
      assert.equal(sealed.afterTargetPlan.battle!.revealed, false);
      actualPlan(sealed.game, f, selected.claim, expected);
      assert.equal(sealed.game.battle!.plans[f.target].weapon, expected === 'yes' ? null : f.ordinary);
    }
});

void test('mixed nested AND inside OR and OR inside AND enforce the complete aggregate through sealing', () => {
  const f = fixture();
  for (const kind of ['and', 'or'] as const) for (const expected of ['yes', 'no'] as const) {
    const selected = nestedScenario(f, kind, expected), asked = ask(f, selected.claim);
    assert.deepEqual(asked.game.truthtrance!.question, {
      kind: 'battlePlan', target: f.target, territory: f.territory, claim: selected.claim,
    });
    const done = answer(asked.game, expected);
    answered(done, f, selected.claim, expected);
    reject(done, f.target, selected.contradictingPlan, /honor your Truthtrance/);
    actualPlan(seal(done, f, selected.plan).game, f, selected.claim, expected);
  }
});

void test('one definite answer discards once and the original battle completes after the same two seal controls', () => {
  const f = fixture(), declared = declare(f);
  assert.deepEqual(declared.game.truthtrance!.queue, [{ player: f.asker, card: f.card }]);
  assert.deepEqual(declared.game.truthtrance!.passed, [f.asker]);
  reject(declared.game, f.asker, f.askStep.action, /priority/);
  let game = passPriority(declared.game, declared.actions);
  reject(game, f.target, f.askStep.action, /holder/);
  game = act(game, f.asker, f.askStep.action, declared.actions);
  reject(game, f.asker, f.answerStep.action, /questioned player/);
  reject(game, f.target, f.targetPlan);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 0);
  game = answer(game, 'yes', declared.actions);
  answered(game, f, f.claim, 'yes');
  reject(game, f.target, f.projectilePlan, /honor your Truthtrance/);
  reject(game, f.target, f.answerStep.action);
  const sealed = seal(game, f, f.targetPlan, declared.actions);
  game = sealed.game; assert.equal(declared.actions.length, 6);
  actualPlan(game, f, f.claim, 'yes');
  for (const actor of [f.target, f.asker]) game = act(game, actor, { type: 'traitorCall', call: false }, declared.actions);
  assert.equal(game.battle, null); assert.equal(declared.actions.length, 8);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
  assert.equal(game.truthHistory!.length, 1);
});

void test('all leaves are server validated beyond the former second condition before consuming the original card', () => {
  const f = fixture(), source = askSource(f), game = source.game;
  const invalid: PlanClaim[] = [
    { kind: 'and', terms: [f.claim, { kind: 'dial', compare: 'eq', value: -1 }] },
    { kind: 'or', terms: [{ kind: 'dial', compare: 'eq', value: 0 }, { kind: 'weapon', name: null },
      { kind: 'weapon', name: 'Not an original card' }] },
    { kind: 'and', terms: [{ kind: 'dial', compare: 'eq', value: 1 }, { kind: 'weapon', name: null },
      { kind: 'or', terms: [{ kind: 'dial', compare: 'eq', value: 0 }, { kind: 'leader', leader: 'not-a-leader' }] }] },
  ];
  for (const claim of invalid) reject(game, f.asker, { type: 'truthAsk', question: {
    kind: 'battlePlan', target: f.target, territory: f.territory, claim,
  } }, /valid battle-plan condition/);
  assert.equal(game.truthtrance!.stage, 'ask'); assert.equal(game.truthtrance!.question, null);
  assert.deepEqual(battleControls(game), battleControls(f.source));
  assert.deepEqual(game.discard, f.source.discard); assert.deepEqual(inventory(game), f.originalCards);
});

void test('existing sixteen-node and four-level boundaries ask, answer and seal the real committed plan', () => {
  const f = fixture(), { closedTrue } = claims(f);
  const sixteen: PlanClaim = { kind: 'and', terms: [
    { kind: 'and', terms: closedTrue }, { kind: 'and', terms: closedTrue.slice(0, 5) },
  ] };
  let depthFour: PlanClaim = closedTrue[1];
  for (let depth = 0; depth < 4; depth++) depthFour = { kind: 'and', terms: [closedTrue[0], depthFour] };
  assert.deepEqual(battleClaimExpressionSize(sixteen), { nodes: 16, depth: 2 });
  assert.deepEqual(battleClaimExpressionSize(depthFour), { nodes: 9, depth: 4 });
  for (const [id, claim] of [['sixteen-nodes', sixteen], ['depth-four', depthFour]] as const) {
    const selected = { ...scenario(f), id, claim }, done = finish(f, selected);
    assert.equal(done.actions.length, 6);
    answered(done.answered, f, claim, 'yes'); actualPlan(done.game, f, claim, 'yes');
  }
});

void test('a ninth child, seventeenth node, singleton or fifth grouping level rejects before the original card is consumed', () => {
  const f = fixture(), game = askSource(f).game, { closedTrue } = claims(f);
  let depthFive: PlanClaim = closedTrue[1];
  for (let depth = 0; depth < 5; depth++) depthFive = { kind: 'and', terms: [closedTrue[0], depthFive] };
  const invalid: PlanClaim[] = [
    { kind: 'and', terms: [] }, { kind: 'or', terms: [closedTrue[0]] },
    { kind: 'or', terms: [...closedTrue, closedTrue[0]] },
    { kind: 'and', terms: [{ kind: 'and', terms: closedTrue }, { kind: 'and', terms: closedTrue.slice(0, 6) }] },
    depthFive,
  ];
  for (const claim of invalid) reject(game, f.asker, { type: 'truthAsk', question: {
    kind: 'battlePlan', target: f.target, territory: f.territory, claim,
  } }, /valid battle-plan condition/);
  assert.equal(game.truthtrance!.stage, 'ask'); assert.equal(game.truthtrance!.question, null);
  assert.deepEqual(game.discard, f.source.discard);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles choose feasible whole answers and seal legal plans for grouped questions', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const declared = declare(f), priorityView = viewGame(declared.game, f.target);
    priorityView.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(priorityView), [{ type: 'truthPass' }]);
    const passed = act(declared.game, f.target, botActions(priorityView)[0]);
    assert.equal(passed.truthtrance?.stage, 'ask');
    for (const selected of [scenario(f, 'and', 8), scenario(f, 'or', 8), nestedScenario(f, 'and'), nestedScenario(f, 'or')]) {
      const asked = ask(f, selected.claim), answerView = viewGame(asked.game, f.target);
      answerView.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const before = structuredClone(answerView), response = botActions(answerView)[0];
      assert.deepEqual(answerView, before); assert.equal(response?.type, 'truthAnswer');
      assert.ok(answerView.truthBattleAnswers?.includes(response.answer as 'yes' | 'no' | 'unknown'));
      assert.deepEqual(botActions(viewGame(asked.game, f.asker)), []);
      let game = act(asked.game, f.target, response);
      const planView = viewGame(game, f.target); planView.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const plan = botActions(planView).find(action => action.type === 'battlePlan');
      assert.ok(plan, `${difficulty} supplies a legal plan after its aggregate answer`);
      game = act(game, f.target, plan);
      const sealed = game.battle!.plans[f.target];
      assert.equal(matchesPlanClaim(selected.claim, { ...sealed, kwisatz: !!sealed.kwisatz }, player(game, f.target).hand), response.answer === 'yes');
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
      assert.deepEqual(inventory(game), f.originalCards);
    }
  }
});
