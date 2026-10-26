import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedAlliance as act, answerTruthMixedAlliance as answer, askTruthMixedAlliance as ask,
  bindTruthMixedAlliance as bind, closeTruthMixedAllianceNexus as close,
  createTruthMixedAllianceFixture as fixture, declareTruthMixedAlliance as declare,
  finishTruthMixedAlliance as finish, truthMixedAllianceFact as fact,
  truthMixedAllianceGroup as group, truthMixedAllianceInventory as inventory,
  truthMixedAllianceNexus as nexus, truthMixedAlliancePartner as partner,
  truthMixedAlliancePlayer as player, truthMixedAlliancePromise as promise,
} from './fixture-truth-alliance-expression';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} mixed final-alliance OR freezes genuine ten spice before a real debit and either consent path`, () => {
  const f = fixture({ advanced, secondOffer: true });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup'); assert.ok(nexus(f.game));
  assert.deepEqual(f.staging, []); assert.equal(f.originalCards.length, 33);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.sourceCounts.inherited + 1);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  assert.equal(truthFactAnswer(player(f.game, f.target), f.shieldFact), 'yes');
  const before = structuredClone(f.game); let game = bind(f).game; assert.deepEqual(f.game, before);
  assert.deepEqual(promise(game).mixed, f.mixed); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, 7); assert.equal(player(game, f.asker).bribes, 3);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.equal(promise(game).fulfilled, false); rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'alliance');
  const selected = guide.action.target === f.asker ? f.partner : f.asker;
  game = act(game, f.target, { type: 'alliance', target: selected });
  assert.equal(player(game, f.target).ally, selected); assert.equal(promise(game).fulfilled, false);
  game = close(game); assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(player(game, f.target).spice, 7); truthOnce(game, f.truth);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native true current fact OR final alliance is a fulfilled constant that still reopens only its respondent Ready', () => {
  const f = fixture(), mixed = group('or', fact(f.shieldFact), partner(f.partner));
  let game = act(f.game, f.target, { type: 'ready' }); game = act(game, f.partner, { type: 'ready' });
  game = ask(declare(f, game).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedAllianceAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = answer(game, f.target, 'yes');
  assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.partner));
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(game.allianceExpressionPromises?.length ?? 0, 0);
  assert.equal(viewGame(game, f.target).alliancePromiseGuide, null);
  game = act(game, f.target, { type: 'alliance', target: f.partner }); game = close(game);
  assert.equal(player(game, f.target).ally, f.partner); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false current fact AND final alliance has only constant No and keeps an actual later acceptance legal', () => {
  const f = fixture(), mixed = group('and', fact(f.hajrFact), partner(f.partner));
  assert.equal(truthFactAnswer(player(f.game, f.target), f.hajrFact), 'no');
  let game = act(f.game, f.target, { type: 'ready' });
  game = ask(declare(f, game).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedAllianceAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.ok(!game.ready.includes(f.target)); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.allianceExpressionPromises?.length ?? 0, 0);
  game = act(game, f.target, { type: 'alliance', target: f.partner }); game = close(game);
  assert.equal(player(game, f.target).ally, f.partner); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(game).released, false); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown forecast takes the conservative whole mixed alliance ${answerValue} obligation`, () => {
  const f = fixture(), respondent = player(f.game, f.target), knowledge = truthKnowledgeOf(f.game, respondent);
  assert.equal(knowledge.stormForecast, null); assert.equal(truthFactAnswer(respondent, f.forecastFact, knowledge), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), partner(f.partner));
  let game = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedAllianceAnswers, [answerValue]);
  rejected(game, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  game = answer(game, f.target, answerValue); assert.equal(promise(game).fulfilled, false);
  if (answerValue === 'yes') {
    rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, { type: 'alliance', target: f.partner });
  } else {
    game = act(game, f.target, { type: 'alliance', target: f.partner });
    rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, { type: 'alliance', target: null });
  }
  assert.equal(promise(game).fulfilled, false); game = close(game); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).ally, answerValue === 'yes' ? f.partner : null);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed alliance whole No negates every OR route and waits for the real final membership', () => {
  const f = fixture({ consent: 'allied' }); let game = bind(f, 'no').game;
  rejected(game, f.target, { type: 'ready' }); const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, null); game = act(game, f.target, guide.action);
  assert.equal(promise(game).fulfilled, false); game = act(game, f.asker, { type: 'alliance', target: f.target });
  game = act(game, f.target, { type: 'alliance', target: f.asker }); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'alliance', target: null }); game = close(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).ally, null);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed alliance question projection and JSON guide retain owner turn event and hide frozen facts and residuals', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMixedAllianceTargets.includes(f.target));
  rejected(declared.game, f.partner, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question,
    mixed: group('and', fact(f.spiceFact), partner(f.target)) } });
  let game = ask(declared.game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedAllianceAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthMixedAllianceAnswers, null);
  assert.equal(viewGame(game, f.partner).truthMixedAllianceAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  for (const actor of [f.target, f.asker, f.partner]) {
    const view = viewGame(game, actor); assert.deepEqual(view.allianceExpressionPromises, []);
    assert.deepEqual(view.alliancePromises, []); assert.deepEqual(view.truthHistory.at(-1)?.question, f.question);
    assert.equal(view.truthHistory.at(-1)?.answer, 'yes'); assert.equal(view.truthMixedAllianceAnswers, null);
    if (actor === f.target) {
      const row = promise(game); assert.deepEqual(Object.keys(row).sort(),
        ['answer', 'asker', 'event', 'fulfilled', 'mixed', 'player', 'released', 'turn']);
      assert.deepEqual(row.mixed, f.mixed); assert.equal(row.player, f.target); assert.equal(row.asker, f.asker);
      assert.equal(row.turn, f.game.turn); assert.equal(row.answer, true); assert.equal(row.fulfilled, false);
      assert.equal(row.released, false); assert.equal(view.alliancePromiseGuide?.action.alliancePromiseEvent, row.event);
    } else {
      assert.deepEqual(view.mixedAlliancePromises, []); assert.equal(view.alliancePromiseGuide, null);
    }
  }
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, alliancePromiseEvent: 'stale-mixed-alliance-event' });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
  assert.equal(promise(game).fulfilled, false); rejected(game, f.target, wire); game = close(game);
  assert.equal(promise(game).fulfilled, true); rejected(game, f.target, wire);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed OR retains one surviving consent and releases only after the last real withdrawal without reactivation', () => {
  const f = fixture({ secondOffer: true }); let game = bind(f).game;
  game = act(game, f.partner, { type: 'alliance', target: null }); assert.equal(promise(game).released, false);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.equal(guide.action.target, f.asker);
  game = act(game, f.asker, { type: 'alliance', target: null }); assert.equal(promise(game).released, true);
  assert.equal(promise(game).fulfilled, false); game = act(game, f.asker, { type: 'alliance', target: f.target });
  rejected(game, f.target, guide.action); assert.equal(viewGame(game, f.target).alliancePromiseGuide, null);
  game = close(game); assert.equal(promise(game).released, true); assert.equal(promise(game).fulfilled, false);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies answer mixed alliance and perform legal real acceptance and Ready', () => {
  const f = fixture({ secondOffer: true }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(asked, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(view).find(action => action.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.ok(answerAction.answer === 'yes' || answerAction.answer === 'no' || answerAction.answer === 'unknown');
    assert.ok(view.truthMixedAllianceAnswers!.includes(answerAction.answer));
    const answered = act(structuredClone(asked), f.target, answerAction); truthOnce(answered, f.truth);
    let game = bind(f).game; const boundView = viewGame(game, f.target);
    boundView.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const acceptance = botActions(boundView).find(action => action.type === 'alliance'); assert.ok(acceptance, difficulty);
    game = act(game, f.target, acceptance); assert.ok(player(game, f.target).ally); assert.equal(promise(game).fulfilled, false);
    const readyView = viewGame(game, f.target); readyView.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const ready = botActions(readyView).find(action => action.type === 'ready'); assert.ok(ready, difficulty);
    game = act(game, f.target, ready); game = close(game); assert.equal(promise(game).fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
