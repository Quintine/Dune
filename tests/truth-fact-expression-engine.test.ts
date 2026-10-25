import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { TruthFact } from '../game/truthtrance';
import {
  createTruthFactExpressionFixture as fixture,
  actTruthFactExpression as act,
  truthFactExpressionClean as clean,
  truthFactExpressionPlayer as player,
  truthFactExpressionInventory as inventory,
  truthFactExpressionFacts,
  truthFactExpressionScenario as scenario,
  truthFactExpressionNestedScenario as nestedScenario,
  declareTruthFactExpression as declare,
  passTruthFactExpressionPriority as passPriority,
  askTruthFactExpression as ask,
  answerTruthFactExpression as answer,
  finishTruthFactExpression as finish,
  type TruthFactExpressionFixture,
} from './fixture-truth-fact-expression';

function reject(game: Game, actor: string, action: Action, message?: RegExp) {
  const before = structuredClone(game);
  const run = () => applyAction(game, actor, action);
  if (message) assert.throws(run, message);
  else assert.throws(run);
  assert.deepEqual(game, before);
}

/** Only the actual interrupted Storm controls, not a recovery snapshot. */
function stormControls(game: Game) {
  return {
    status: game.status, turn: game.turn, phase: game.phase, active: game.active,
    order: game.order, ready: game.ready, storm: game.storm,
    stormPending: game.stormPending, stormDials: game.stormDials, stormDialers: game.stormDialers,
    stormMovementSource: game.stormMovementSource,
    response: game.response ?? null, decision: game.decision ?? null,
    phaseOpening: game.phaseOpening ?? null, pendingKarama: game.pendingKarama ?? null,
  };
}

function aggregateOnly(game: Game, f: TruthFactExpressionFixture, expected: 'yes' | 'no') {
  assert.equal(game.truthtrance?.stage, 'answer');
  assert.equal(viewGame(game, f.target).truthAnswer, expected);
  for (const other of game.players.filter(candidate => candidate.id !== f.target))
    assert.equal(viewGame(game, other.id).truthAnswer, null);
}

function completed(game: Game, f: TruthFactExpressionFixture, fact: TruthFact, expected: 'yes' | 'no') {
  assert.ok(clean(game)); assert.equal(game.truthtrance, null);
  assert.deepEqual(stormControls(game), stormControls(f.source));
  assert.deepEqual(player(game, f.target).hand, player(f.source, f.target).hand);
  assert.equal(player(game, f.target).spice, 10); assert.equal(player(game, f.target).reserves, 20);
  assert.equal(game.discard.length, f.source.discard.length + 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.asker).hand.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.originalCards);
  assert.equal(game.truthHistory!.length, (f.source.truthHistory?.length ?? 0) + 1);
  assert.deepEqual(game.truthHistory!.at(-1), {
    turn: 1, phase: 0, asker: f.asker,
    question: { kind: 'fact', target: f.target, fact }, answer: expected,
  });
}

void test('compound facts begin with original Basic cards and native Storm dials plus a real nonempty Ready list', () => {
  const f = fixture();
  assert.equal(f.setup.deck.length, 33); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.deepEqual(f.game.players.map(candidate => candidate.faction), ['atreides', 'emperor', 'harkonnen', 'guild']);
  assert.equal(f.sourceActionCount, f.base.sourceActionCount + 3);
  assert.equal(f.actions.length, f.sourceActionCount);
  assert.deepEqual(f.stormSteps, [
    ...f.game.stormDialers.map(actor => ({ actor, action: { type: 'stormDial', amount: 0 } })),
    { actor: f.target, action: { type: 'ready' } },
  ]);
  assert.equal(f.beforeStormControls.stormPending, null); assert.deepEqual(f.beforeStormControls.ready, []);
  assert.deepEqual(f.game.ready, [f.target]); assert.equal(f.game.phase, 0); assert.equal(f.game.turn, 1);
  assert.equal(f.game.response ?? null, null); assert.equal(f.game.truthtrance ?? null, null);
  assert.equal(f.game.truthHistory?.length ?? 0, 0);
  assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), [f.card]);
  assert.deepEqual(player(f.game, f.target).hand.map(card => card.name), ['Baliset']);
  assert.ok(player(f.game, f.counterHolder).hand.some(card => card.id === f.karama));
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
  assert.deepEqual(f.fact, { kind: 'and', terms: [
    { kind: 'spice', compare: 'gte', value: 10 },
    { kind: 'handCount', name: 'Baliset', compare: 'gte', value: 1 },
    { kind: 'handCount', name: 'Shield', compare: 'eq', value: 0 },
  ] });
});

void test('original three through eight clause AND and OR questions enforce both truthful aggregate answers', () => {
  const f = fixture();
  for (const kind of ['and', 'or'] as const)
    for (const count of [3, 4, 5, 6, 7, 8])
      for (const expected of ['yes', 'no'] as const) {
        const selected = scenario(kind, count, expected), asked = ask(f, selected.fact);
        assert.equal(asked.actions.length, 5, 'One declaration, three other-seat priority passes and one question');
        assert.deepEqual(stormControls(asked.game), stormControls(f.source));
        aggregateOnly(asked.game, f, expected);
        reject(asked.game, f.target, { type: 'truthAnswer', answer: expected === 'yes' ? 'no' : 'yes' }, /truthfully/);
        reject(asked.game, f.target, { type: 'truthAnswer', answer: 'unknown' }, /truthfully/);
        const done = answer(asked.game, expected);
        completed(done, f, selected.fact, expected);
      }
});

void test('mixed nested AND inside OR and OR inside AND retain their public question and target-only aggregate', () => {
  const f = fixture();
  for (const kind of ['and', 'or'] as const)
    for (const expected of ['yes', 'no'] as const) {
      const selected = nestedScenario(kind, expected), asked = ask(f, selected.fact);
      assert.deepEqual(asked.game.truthtrance!.question, { kind: 'fact', target: f.target, fact: selected.fact });
      aggregateOnly(asked.game, f, expected);
      const done = answer(asked.game, expected);
      completed(done, f, selected.fact, expected);
    }
});

void test('the original holder waits for real priority and one answer discards once before the same Storm Ready control resumes', () => {
  const f = fixture(), declared = declare(f);
  assert.deepEqual(declared.game.truthtrance!.queue, [{ player: f.asker, card: f.card }]);
  assert.deepEqual(declared.game.truthtrance!.passed, [f.asker]);
  assert.deepEqual(stormControls(declared.game), stormControls(f.source));
  reject(declared.game, f.asker, f.askStep.action, /priority/);
  let game = passPriority(declared.game, declared.actions);
  assert.equal(declared.actions.length, 4); assert.equal(game.truthtrance!.stage, 'ask');
  reject(game, f.target, f.askStep.action, /holder/);
  reject(game, f.asker, { type: 'truthPass' });
  game = act(game, f.asker, f.askStep.action, declared.actions);
  aggregateOnly(game, f, 'yes');
  reject(game, f.asker, f.answerStep.action, /questioned player/);
  reject(game, f.guild, f.answerStep.action, /questioned player/);
  reject(game, f.target, { type: 'truthAnswer', answer: 'no' }, /truthfully/);
  reject(game, f.target, { type: 'truthAnswer', answer: 'unknown' }, /truthfully/);
  reject(game, f.asker, f.continuationStep.action);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 0);
  game = answer(game, 'yes', declared.actions);
  assert.equal(declared.actions.length, 6);
  completed(game, f, f.fact, 'yes');
  reject(game, f.target, f.answerStep.action);
  reject(game, f.asker, f.askStep.action);
  const continued = act(game, f.continuationStep.actor, f.continuationStep.action, declared.actions);
  assert.equal(declared.actions.length, 7);
  assert.equal(continued.phase, 0); assert.equal(continued.turn, 1);
  assert.deepEqual(continued.ready, [f.target, f.asker]);
  assert.equal(continued.response ?? null, null); assert.ok(clean(continued));
  assert.equal(continued.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(continued.truthHistory!.length, 1);
  assert.deepEqual(inventory(continued), f.originalCards);
});

void test('complete server validation rejects a bad third clause even when the first clause determines the aggregate', () => {
  const f = fixture(), declared = declare(f), game = passPriority(declared.game);
  const { trueFacts, falseFacts } = truthFactExpressionFacts();
  const invalid = [
    { kind: 'or', terms: [trueFacts[0], falseFacts[0], { kind: 'spice', compare: 'gte', value: -1 }] },
    { kind: 'and', terms: [falseFacts[0], trueFacts[0],
      { kind: 'handCount', name: 'Not an original card', compare: 'eq', value: 0 }] },
    { kind: 'or', terms: [trueFacts[0], falseFacts[0],
      { kind: 'and', terms: [trueFacts[0], { kind: 'handInventory', category: 'unknown', compare: 'eq', value: 0 }] }] },
  ];
  for (const fact of invalid)
    reject(game, f.asker, { type: 'truthAsk', question: { kind: 'fact', target: f.target, fact } });
  assert.equal(game.truthtrance!.stage, 'ask'); assert.equal(game.truthtrance!.question, null);
  assert.deepEqual(stormControls(game), stormControls(f.source));
  assert.deepEqual(game.discard, f.source.discard); assert.deepEqual(inventory(game), f.originalCards);
});

void test('original current facts accept the existing sixteen-node and four-depth boundaries', () => {
  const f = fixture(), { trueFacts } = truthFactExpressionFacts();
  const sixteen: TruthFact = { kind: 'and', terms: [
    { kind: 'or', terms: trueFacts.slice(0, 6) },
    { kind: 'and', terms: trueFacts.slice(0, 7) },
  ] };
  let depthFour: TruthFact = trueFacts[0];
  for (let depth = 0; depth < 4; depth++) depthFour = { kind: 'and', terms: [trueFacts[1], depthFour] };
  for (const [id, fact] of [['sixteen-nodes', sixteen], ['depth-four', depthFour]] as const) {
    const done = finish(f, { id, fact, answer: 'yes' });
    assert.equal(done.actions.length, 6);
    completed(done.game, f, fact, 'yes');
  }
});

void test('a ninth group child, seventeenth node and fifth depth reject before the original card is consumed', () => {
  const f = fixture(), game = passPriority(declare(f).game);
  const { trueFacts } = truthFactExpressionFacts();
  let depthFive: TruthFact = trueFacts[0];
  for (let depth = 0; depth < 5; depth++) depthFive = { kind: 'and', terms: [trueFacts[1], depthFive] };
  const invalid: [TruthFact, RegExp][] = [
    [{ kind: 'and', terms: [] }, /two to eight/],
    [{ kind: 'or', terms: [trueFacts[0]] }, /two to eight/],
    [{ kind: 'or', terms: [...trueFacts, trueFacts[0]] }, /two to eight/],
    [{ kind: 'and', terms: [
      { kind: 'or', terms: trueFacts.slice(0, 7) },
      { kind: 'and', terms: trueFacts.slice(0, 7) },
    ] }, /16 clauses/],
    [depthFive, /four levels/],
  ];
  for (const [fact, message] of invalid)
    reject(game, f.asker, { type: 'truthAsk', question: { kind: 'fact', target: f.target, fact } }, message);
  assert.equal(game.truthtrance!.stage, 'ask'); assert.equal(game.truthtrance!.question, null);
  assert.deepEqual(game.discard, f.source.discard);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles pass real priority and answer new compound questions from the private aggregate', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const declared = declare(f), priorityView = viewGame(declared.game, f.target);
    priorityView.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const priorityAction = botActions(priorityView);
    assert.deepEqual(priorityAction, [{ type: 'truthPass' }]);
    const passed = act(declared.game, f.target, priorityAction[0]);
    assert.equal(passed.truthtrance!.passed.includes(f.target), true);
    assert.equal(passPriority(passed).truthtrance!.stage, 'ask');
    for (const selected of [scenario('and', 8, 'yes'), scenario('or', 8, 'no'),
      nestedScenario('and', 'no'), nestedScenario('or', 'yes')]) {
      const asked = ask(f, selected.fact), view = viewGame(asked.game, f.target);
      view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const before = structuredClone(view), actions = botActions(view);
      assert.deepEqual(view, before);
      assert.deepEqual(actions, [{ type: 'truthAnswer', answer: selected.answer }]);
      assert.deepEqual(botActions(viewGame(asked.game, f.asker)), []);
      assert.deepEqual(botActions(viewGame(asked.game, f.guild)), []);
      aggregateOnly(asked.game, f, selected.answer);
      const done = act(asked.game, f.target, actions[0]);
      completed(done, f, selected.fact, selected.answer);
    }
  }
});
