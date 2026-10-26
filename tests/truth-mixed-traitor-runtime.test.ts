import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer, type TruthAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedTraitor as act, answerTruthMixedTraitor as answer, askTruthMixedTraitor as ask,
  bindTruthMixedTraitor as bind, createTruthMixedTraitorFixture as fixture,
  declareTruthMixedTraitor as declare, finishTruthMixedTraitor as finish,
  settleTruthMixedTraitor as settle, truthMixedTraitorCall as call,
  truthMixedTraitorClean as clean, truthMixedTraitorFact as fact, truthMixedTraitorGroup as group,
  truthMixedTraitorInventory as inventory, truthMixedTraitorPlayer as player,
  truthMixedTraitorPromise as promise, truthMixedTraitorTraitors as traitors, voteTruthMixedTraitor as vote,
} from './fixture-truth-mixed-traitor';

function rejected(game: Game, actor: string, candidate: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, candidate)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

void test('native mixed Traitor retains the original Basic26 source and binds the actual declaration through cleanup', () => {
  const f = fixture(); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.setup.deck.length, 33); assert.equal(f.game.advanced, false); assert.deepEqual(f.game.expansions, []);
  assert.ok(f.setup.players.every(seat => !seat.hand.length)); assert.equal(f.sourceActionCount, 26);
  assert.equal(f.sourceActionCount, f.base.sourceActionCount); assert.equal(f.actions.length, f.sourceActionCount);
  assert.deepEqual(f.game, f.base.game); assert.equal(f.game.battle!.revealed, true);
  assert.deepEqual(f.game.battle!.traitorCalls, {}); assert.deepEqual(player(f.game, f.target).traitors, [f.traitorHeld]);
  assert.equal(f.game.battle!.plans[f.asker].leader, f.traitorHeld);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 1);
  assert.equal(player(f.game, f.target).forces['arrakeen:10'], 1);
  const source = structuredClone(f.game), bound = bind(f); let game = bound.game;
  assert.deepEqual(f.game, source); assert.ok(clean(game)); assert.equal(promise(game).fulfilled, false);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [true]);
  assert.equal(game.battle!.traitorDecisionPromises!.length, 1);
  assert.equal(game.battle!.traitorDecisionPromises![0].event, promise(game).event);
  rejected(game, f.target, { type: 'traitorCall', call: false });
  game = vote(game, f.target, true); assert.equal(game.battle!.traitorCalls[f.target], true);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  game = finish(game, f); assert.equal(game.battle, null); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(game).released, false); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
});

void test('native mixed Traitor freezes current spice before a real bribe and retains its required Reveal', () => {
  const f = fixture(), beforeSpice = player(f.game, f.target).spice, beforeBribes = player(f.game, f.asker).bribes;
  assert.ok(beforeSpice >= 3); let game = bind(f).game;
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'yes');
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, beforeSpice - 3); assert.equal(player(game, f.asker).bribes, beforeBribes + 3);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.equal(promise(game).fulfilled, false); assert.deepEqual(promise(game).mixed, f.mixed);
  rejected(game, f.target, { type: 'traitorCall', call: false });
  game = vote(game, f.target, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(finish(game, f)).fulfilled, true); truthOnce(game, f.truth);
});

void test('native true current fact OR Reveal is terminal Yes and permits an actual decline', () => {
  const f = fixture(), mixed = group('or', fact(f.trueFact), call(true));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedTraitorAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = answer(asked, f.target, 'yes'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.traitorDecisionPromises?.length ?? 0, 0);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false, true]);
  game = vote(game, f.target, false); assert.equal(game.battle!.traitorCalls[f.target], false);
  game = finish(game, f); assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
});

void test('native false current fact AND Reveal is terminal No and permits the actual matching call', () => {
  const f = fixture(), mixed = group('and', fact(f.falseFact), call(true));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedTraitorAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.traitorDecisionPromises?.length ?? 0, 0);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false, true]);
  game = vote(game, f.target, true); assert.equal(game.battle!.traitorCalls[f.target], true);
  assert.equal(promise(finish(game, f)).fulfilled, true);
});

void test('native false current fact OR Reveal Yes still requires the actual matching declaration', () => {
  const f = fixture(); let game = bind(f, 'yes', group('or', fact(f.falseFact), call(true))).game;
  assert.equal(promise(game).fulfilled, false); assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [true]);
  rejected(game, f.target, { type: 'traitorCall', call: false }); game = vote(game, f.target, true);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(finish(game, f)).released, false);
});

void test('native true current fact AND Reveal No requires the actual decline', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  assert.equal(promise(game).answer, false); assert.equal(promise(game).fulfilled, false);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false]);
  rejected(game, f.target, { type: 'traitorCall', call: true }); game = vote(game, f.target, false);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(finish(game, f)).released, false);
});

void test('native No to true current fact AND decline inversely requires Reveal', () => {
  const f = fixture(), mixed = group('and', fact(f.trueFact), call(false)); let game = bind(f, 'no', mixed).game;
  assert.equal(promise(game).answer, false); assert.equal(game.battle!.traitorDecisionPromises![0].answer, true);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [true]);
  rejected(game, f.target, { type: 'traitorCall', call: false }); game = vote(game, f.target, true);
  assert.equal(promise(game).fulfilled, true); assert.deepEqual(promise(game).mixed, mixed); finish(game, f);
});

void test('native correlated call tautology and contradiction are terminal without inventing a fixed native vote', () => {
  const f = fixture();
  for (const kind of ['or', 'and'] as const) {
    const mixed = group('and', fact(f.trueFact), group(kind, call(true), call(false)));
    const expected = kind === 'or' ? 'yes' : 'no';
    const asked = ask(declare(f).game, f.asker, f.target, mixed);
    assert.deepEqual(viewGame(asked, f.target).truthMixedTraitorAnswers, [expected]);
    rejected(asked, f.target, { type: 'truthAnswer', answer: expected === 'yes' ? 'no' : 'yes' });
    const answered = answer(asked, f.target, expected); assert.equal(promise(answered).fulfilled, true);
    assert.equal(answered.battle!.traitorDecisionPromises?.length ?? 0, 0);
    for (const choice of [false, true]) {
      let game = vote(answered, f.target, choice); assert.equal(game.battle!.traitorCalls[f.target], choice);
      game = finish(game, f); assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
    }
  }
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown forecast uses conservative mixed Traitor ${answerValue} and completes at the original declaration`, () => {
  const f = fixture(), target = player(f.game, f.target), knowledge = truthKnowledgeOf(f.game, target);
  assert.equal(knowledge.stormForecast, null); assert.equal(truthFactAnswer(target, f.forecastFact, knowledge), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), call(true));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedTraitorAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, { type: 'traitorCall', call: answerValue !== 'yes' });
  game = vote(game, f.target, answerValue === 'yes'); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(finish(game, f)).released, false); truthOnce(game, f.truth);
});

void test('controlled conserved original-card exchange keeps mixed answers inside native matching-card eligibility', () => {
  const f = fixture(), source = structuredClone(f.game), target = player(source, f.target);
  // Controlled physical exchange only: this is not an earned native exchange
  // action, and the altered hand is not claimed as original source provenance.
  const reserve = source.traitorReserve!.findIndex(id => id !== f.traitorHeld), held = target.traitors.indexOf(f.traitorHeld);
  assert.ok(reserve >= 0 && held >= 0);
  [target.traitors[held], source.traitorReserve![reserve]] = [source.traitorReserve![reserve], target.traitors[held]];
  assert.deepEqual(traitors(source), f.originalTraitors);
  const asked = ask(declare(f, source).game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedTraitorAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false]);
  game = vote(game, f.target, false); assert.equal(promise(game).fulfilled, true); finish(game, f);
});

void test('native mixed Traitor Ask enforces original owner event territory raw wire and revealed scope', () => {
  const f = fixture(), declared = declare(f), game = declared.game;
  assert.ok(viewGame(game, f.asker).truthMixedTraitorTargets.includes(f.target)); rejected(game, f.target, f.questionAction);
  for (const replacement of [{ battle: 'stale-battle' }, { battle: null }, { territory: 'carthag' },
    { target: 'foreign-seat' }, { binding: true }, { forcedCall: true }, { frozen: true }])
    rejected(game, f.asker, { type: 'truthAsk', question: { ...f.question, ...replacement } });
  const wire: Action = JSON.parse(JSON.stringify(f.questionAction)), asked = act(game, f.asker, wire);
  assert.deepEqual(asked.truthtrance!.question, f.question);
  assert.deepEqual(new Set(viewGame(asked, f.target).truthMixedTraitorAnswers), new Set(['yes', 'no']));
  assert.equal(viewGame(asked, f.asker).truthMixedTraitorAnswers, null); assert.equal(viewGame(asked, f.target).truthTraitorAnswers, null);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'unknown' });
  const done = act(asked, f.target, JSON.parse(JSON.stringify({ type: 'truthAnswer', answer: 'yes' })) as Action);
  rejected(done, f.target, { type: 'truthAnswer', answer: 'yes' }); truthOnce(done, f.truth);
  const unrevealed = declare(f, f.beforeReveal).game;
  assert.deepEqual(viewGame(unrevealed, f.asker).truthMixedTraitorTargets, []); rejected(unrevealed, f.asker, wire);
  let ended = finish(vote(f.game, f.target, false), f); ended = declare(f, settle(ended)).game;
  assert.deepEqual(viewGame(ended, f.asker).truthMixedTraitorTargets, []); rejected(ended, f.asker, wire);
});

void test('native mixed Traitor projections expose only each respondents raw aggregate and retain hidden native choice constraints', () => {
  const f = fixture(), game = bind(f).game, before = structuredClone(game);
  assert.equal(game.mixedTraitorQuestions?.length, 1);
  for (const actor of [f.asker, f.target]) {
    const view = viewGame(game, actor); assert.ok(!('mixedTraitorQuestions' in view));
    assert.deepEqual(view.battle!.ownTraitorPromises, []); assert.equal(view.truthMixedTraitorAnswers, null);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor !== f.target) assert.deepEqual(view.mixedTraitorPromises, []);
    else {
      const row = promise(game);
      assert.deepEqual(Object.keys(row).sort(), ['answer', 'asker', 'battle', 'event', 'fulfilled', 'mixed', 'player', 'released', 'territory', 'turn']);
      assert.equal(row.player, f.target); assert.equal(row.asker, f.asker); assert.equal(row.turn, 1);
      assert.equal(row.battle, f.event); assert.equal(row.territory, f.territory); assert.equal(row.answer, true);
      assert.deepEqual(row.mixed, f.mixed); assert.equal(row.fulfilled, false); assert.equal(row.released, false);
      assert.deepEqual(view.battle!.traitorCallChoices, [true]);
    }
  }
  assert.deepEqual(game, before); const completed = finish(vote(game, f.target, true), f);
  assert.equal(promise(completed).fulfilled, true); assert.equal(promise(completed).released, false);
  for (const actor of [f.asker, f.target]) assert.equal(viewGame(completed, actor).mixedTraitorPromises.length, actor === f.target ? 1 : 0);
});

void test('native submitted false and true Traitor slots cannot be reopened by a mixed question', () => {
  const f = fixture();
  for (const choice of [false, true]) {
    const source = vote(f.game, f.target, choice), declared = declare(f, source).game;
    assert.equal(declared.battle!.traitorCalls[f.target], choice);
    assert.ok(!viewGame(declared, f.asker).truthMixedTraitorTargets.includes(f.target));
    rejected(declared, f.asker, f.questionAction); assert.equal(declared.battle!.traitorCalls[f.target], choice);
    assert.ok(player(declared, f.asker).hand.some(card => card.id === f.truth));
  }
});

void test('all four minimal profiles answer a native mixed Traitor question and actually declare its permitted vote', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const answering = viewGame(game, f.target);
    answering.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.ok(answering.truthMixedTraitorAnswers?.includes(answerAction.answer as TruthAnswer));
    game = act(game, f.target, answerAction); const declaring = viewGame(game, f.target);
    declaring.players.find(seat => seat.id === f.target)!.bot = difficulty;
    assert.deepEqual(declaring.battle!.ownTraitorPromises, []);
    const declaration = botActions(declaring).find(candidate => candidate.type === 'traitorCall'); assert.ok(declaration, difficulty);
    assert.ok(declaring.battle!.traitorCallChoices!.includes(declaration.call as boolean));
    game = act(game, f.target, declaration); assert.equal(game.battle!.traitorCalls[f.target], answerAction.answer === 'yes');
    assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
    game = finish(game, f); assert.equal(promise(game).fulfilled, true); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});
