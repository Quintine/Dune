import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthAllianceExpression as act, answerTruthAllianceExpression as answer,
  askTruthAllianceExpression as ask, bindTruthAllianceExpression as bind,
  closeTruthAllianceExpressionNexus as close, createTruthAllianceExpressionFixture as fixture,
  declareTruthAllianceExpression as declare, finishTruthAllianceExpression as finish,
  truthAllianceExpressionGroup as group, truthAllianceExpressionInventory as inventory,
  truthAllianceExpressionNexus as nexus, truthAllianceExpressionPartner as partner,
  truthAllianceExpressionPlayer as player, truthAllianceExpressionPromise as promise,
} from './fixture-truth-alliance-expression';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} whole alliance OR uses two real invitations and settles only at actual Nexus close`, () => {
  const f = fixture({ advanced, secondOffer: true });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup'); assert.ok(nexus(f.game));
  assert.equal(f.game.turn, 2); assert.equal(f.originalCards.length, 33); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceActionCount, f.sourceCounts.inherited + 1);
  assert.equal(f.offer!.steps[0].actor, f.partner); assert.equal(f.secondInvitation!.steps[0].actor, f.asker);
  assert.equal(f.game.allianceOffers[f.partner], f.target); assert.equal(f.game.allianceOffers[f.asker], f.target);
  assert.equal(player(f.game, f.target).ally, null);
  const before = structuredClone(f.game); let game = bind(f).game; assert.deepEqual(f.game, before);
  assert.deepEqual(promise(game).claim, f.claim); assert.equal(promise(game).answer, true);
  assert.ok(!promise(game).fulfilled); rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'alliance');
  assert.ok(guide.action.target === f.asker || guide.action.target === f.partner);
  assert.equal(guide.action.alliancePromiseEvent, promise(game).event);
  game = act(game, f.target, guide.action); assert.ok(!promise(game).fulfilled);
  const chosen = player(game, f.target).ally; assert.ok(chosen === f.asker || chosen === f.partner);
  game = close(game); assert.equal(game.nexus, false); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).ally, chosen); assert.equal(promise(game).released ?? false, false);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native whole OR accepts the other real invitation manually without pinning its guide route', () => {
  const f = fixture({ secondOffer: true }); let game = bind(f).game;
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'alliance');
  const alternative = guide.action.target === f.asker ? f.partner : f.asker;
  assert.equal(game.allianceOffers[alternative], f.target);
  game = act(game, f.target, { type: 'alliance', target: alternative });
  assert.equal(player(game, f.target).ally, alternative); assert.ok(!promise(game).fulfilled);
  game = close(game); assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native distinct-partner whole AND has only No and may retain a real single partnership until close', () => {
  const f = fixture({ secondOffer: true }), claim = group('and', partner(f.asker), partner(f.partner));
  const asked = ask(declare(f).game, f.asker, f.target, claim);
  assert.deepEqual(viewGame(asked, f.target).truthAllianceExpressionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' }); let game = answer(asked, f.target, 'no');
  assert.ok(!promise(game).fulfilled); game = act(game, f.target, { type: 'alliance', target: f.partner });
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game).fulfilled);
  game = close(game); assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).ally, f.partner);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole OR No breaks an existing named pair and then readies without treating one false leaf as the whole answer', () => {
  const f = fixture({ consent: 'allied' }); let game = bind(f, 'no').game;
  assert.equal(player(game, f.target).ally, f.partner); rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, null);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).ally, null);
  assert.ok(!promise(game).fulfilled); const ready = viewGame(game, f.target).alliancePromiseGuide;
  assert.ok(ready); assert.equal(ready.action.type, 'ready'); game = close(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).ally, null);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole OR No permits temporary real membership but does not settle until its own break and actual close', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  game = act(game, f.target, { type: 'alliance', target: f.partner });
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game).fulfilled);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, { type: 'alliance', target: null });
  assert.ok(!promise(game).fulfilled); game = close(game); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole OR without foreign consent preserves unknown save and reasks the same physical Truth after a real invitation', () => {
  const f = fixture({ consent: 'none' }); let game = ask(declare(f).game, f.asker, f.target, f.claim);
  assert.deepEqual(viewGame(game, f.target).truthAllianceExpressionAnswers, ['no', 'unknown']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'unknown');
  assert.equal(game.truthtrance!.stage, 'unknown'); assert.equal(game.discard.filter(card => card.id === f.truth).length, 0);
  game = act(game, f.asker, { type: 'truthSave' }); assert.equal(game.truthtrance, null);
  assert.equal(player(game, f.asker).hand.filter(card => card.effect === 'truthtrance').length, 2);
  game = act(game, f.partner, { type: 'alliance', target: f.target }); game = bind(f, 'yes', f.claim, game).game;
  game = close(game); assert.equal(player(game, f.target).ally, f.partner); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native definite whole alliance answer reopens only the respondent existing Ready', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'ready' });
  game = act(game, f.partner, { type: 'ready' }); assert.ok(game.ready.includes(f.target) && game.ready.includes(f.partner));
  game = bind(f, 'yes', f.claim, game).game;
  assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.partner));
  rejected(game, f.target, { type: 'ready' }); game = close(game); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole alliance question and callback retain current context owner turn event and JSON semantics', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthAllianceExpressionTargets.includes(f.target));
  rejected(declared.game, f.partner, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, claim: partner(f.target) } });
  let game = ask(declared.game, f.asker, f.target, f.claim);
  assert.deepEqual(viewGame(game, f.target).truthAllianceExpressionAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthAllianceExpressionAnswers, null);
  assert.equal(viewGame(game, f.partner).truthAllianceExpressionAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, alliancePromiseEvent: 'stale-whole-alliance-event' });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
  rejected(game, f.target, wire); game = close(game); rejected(game, f.target, wire);
  game = act(game, f.asker, { type: 'card', card: f.truths[1] });
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const next = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(next);
    game = act(game, next.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask'); rejected(game, f.asker, f.questionAction);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole alliance projection exposes only own original expression and aggregate status', () => {
  const f = fixture(), game = bind(f).game;
  for (const actor of [f.target, f.asker, f.partner]) {
    const view = viewGame(game, actor); assert.equal(view.truthAllianceExpressionAnswers, null);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor === f.target) {
      const row = promise(game); assert.equal(row.player, f.target); assert.equal(row.asker, f.asker);
      assert.equal(row.turn, f.game.turn); assert.deepEqual(row.claim, f.claim); assert.equal(row.answer, true);
      assert.ok(Object.keys(row).every(key => ['event', 'player', 'asker', 'turn', 'claim', 'answer', 'fulfilled', 'released'].includes(key)));
      assert.equal(view.alliancePromiseGuide?.action.alliancePromiseEvent, row.event);
    } else {
      assert.deepEqual(view.allianceExpressionPromises, []); assert.equal(view.alliancePromiseGuide, null);
    }
  }
  assert.equal(game.allianceExpressionPromises!.length, 1); assert.ok(game.allianceExpressionPromises![0].source);
});

void test('native whole OR survives one opposing invitation withdrawal, releases after the last, and never reactivates on reoffer', () => {
  const f = fixture({ secondOffer: true }); let game = bind(f).game;
  game = act(game, f.partner, { type: 'alliance', target: null }); assert.ok(!promise(game).released);
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.asker);
  game = act(game, f.asker, { type: 'alliance', target: null });
  assert.equal(promise(game).released, true); assert.ok(!promise(game).fulfilled);
  game = act(game, f.asker, { type: 'alliance', target: f.target }); rejected(game, f.target, guide.action);
  assert.equal(viewGame(game, f.target).alliancePromiseGuide, null);
  game = act(game, f.target, { type: 'alliance', target: f.asker }); game = close(game);
  assert.equal(promise(game).released, true); assert.ok(!promise(game).fulfilled);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole OR retains opposing actual departure rights and does not bind a later renewed consent', () => {
  const f = fixture({ consent: 'allied' }); let game = bind(f).game;
  rejected(game, f.target, { type: 'alliance', target: null });
  game = act(game, f.partner, { type: 'alliance', target: null });
  assert.equal(player(game, f.target).ally, null); assert.equal(promise(game).released, true);
  game = act(game, f.partner, { type: 'alliance', target: f.target }); game = close(game);
  assert.equal(promise(game).released, true); assert.ok(!promise(game).fulfilled);
  assert.equal(player(game, f.target).ally, null); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native nested whole OR and AND permits each complete matching final-partner outcome', () => {
  const f = fixture({ secondOffer: true });
  const claim = group('or', group('and', partner(f.asker), partner(f.asker)), partner(f.partner));
  for (const selected of [f.asker, f.partner]) {
    let game = bind(f, 'yes', claim).game; game = act(game, f.target, { type: 'alliance', target: selected });
    assert.ok(!promise(game).fulfilled); game = close(game); assert.equal(player(game, f.target).ally, selected);
    assert.equal(promise(game).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('all four minimal policies answer whole alliance questions and use their real acceptance and Ready controls legally', () => {
  const f = fixture({ secondOffer: true }), asked = ask(declare(f).game, f.asker, f.target, f.claim);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(asked, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'truthAnswer'); assert.ok(action, difficulty);
    assert.ok(action.answer === 'yes' || action.answer === 'no' || action.answer === 'unknown');
    assert.ok(view.truthAllianceExpressionAnswers!.includes(action.answer));
    const game = act(structuredClone(asked), f.target, action); truthOnce(game, f.truth);
    assert.deepEqual(inventory(game), f.originalCards);
  }
  for (const difficulty of DIFFICULTIES) {
    let game = bind(f).game; const view = viewGame(game, f.target);
    view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'alliance'); assert.ok(action, difficulty);
    game = act(game, f.target, action); assert.ok(player(game, f.target).ally); assert.ok(!promise(game).fulfilled);
    const readyView = viewGame(game, f.target); readyView.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const ready = botActions(readyView).find(action => action.type === 'ready'); assert.ok(ready, difficulty);
    game = act(game, f.target, ready); game = close(game); assert.equal(promise(game).fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
