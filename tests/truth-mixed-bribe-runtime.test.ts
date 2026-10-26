import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import { enterMentatBribeWithUnpaidPromise } from './fixture-mentat-bribes';
import {
  actTruthMixedBribe as act, answerTruthMixedBribe as answer, askTruthMixedBribe as ask,
  bindTruthMixedBribe as bind, completeTruthMixedBribe as complete, createTruthMixedBribeFixture as fixture,
  declareTruthMixedBribe as declare, finishTruthMixedBribe as finish, truthMixedBribeBalances as balances,
  truthMixedBribeFact as fact, truthMixedBribeGroup as group, truthMixedBribeInventory as inventory,
  truthMixedBribePayment as payment, truthMixedBribePlayer as player, truthMixedBribePromise as promise,
} from './fixture-truth-mixed-bribe';

const progress = (game: Game, recipient: string) => promise(game).progress.find(row => row.recipient === recipient)?.amount ?? 0;
const pay = (game: Game, actor: string, recipient: string, amount: number) => act(game, actor, { type: 'bribe', target: recipient, amount });
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} mixed spice fact freezes before actual cumulative payments debit its original purse`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.originalCards.length, 33); assert.deepEqual(f.staging, []); assert.deepEqual(f.game.expansions, []);
  assert.equal(f.sourceActionCount, advanced ? 23 : 20); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  const source = structuredClone(f.game), before = balances(f.game); let game = bind(f).game;
  assert.deepEqual(f.game, source); assert.deepEqual(promise(game).mixed, f.mixed); assert.deepEqual(promise(game).progress, []);
  assert.equal(game.auction!.active, f.asker); assert.notEqual(game.auction!.active, f.target); truthOnce(game, f.truth);
  game = pay(game, f.target, f.asker, 1);
  assert.equal(progress(game, f.asker), 1); assert.ok(!promise(game).fulfilled);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  game = pay(game, f.target, f.asker, 2); assert.equal(progress(game, f.asker), 3); assert.ok(!promise(game).fulfilled);
  game = pay(game, f.target, f.opponent, 2); assert.equal(progress(game, f.opponent), 2);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false); assert.equal(player(game, f.target).spice, 5);
  for (const recipient of [f.asker, f.opponent]) assert.equal(player(game, recipient).spice, before[recipient]);
  assert.equal(player(game, f.asker).bribes, 3); assert.equal(player(game, f.opponent).bribes, 2);
  const result = complete(f, game);
  for (const [recipient, amount] of [[f.asker, 3], [f.opponent, 2]] as const) {
    assert.equal(player(result.mentat.before, recipient).bribes, amount);
    assert.equal(player(result.mentat.after, recipient).spice - player(result.mentat.before, recipient).spice, amount);
    assert.equal(player(result.mentat.after, recipient).bribes, 0); assert.equal(player(result.game, recipient).bribes, 0);
    assert.equal(progress(result.game, recipient), amount);
  }
  assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0); truthOnce(result.game, f.truth);
  assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native true held Shield OR future payment gives immediate Yes without a residual binding', () => {
  const f = fixture(), mixed = group('or', fact(f.shieldFact), payment(f.asker)), declared = declare(f);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.shieldFact), 'yes');
  const asked = ask(declared.game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBribeAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = answer(asked, f.target, 'yes'); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(promise(game).progress, []); assert.deepEqual(promise(game).mixed, mixed);
  assert.equal(game.bribeExpressionPromises?.length ?? 0, 0); assert.equal(viewGame(game, f.target).bribePromiseGuide, null);
  game = finish(game); assert.equal(player(game, f.target).spice, 10); truthOnce(game, f.truth);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.targetCard)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false held Hajr AND future payment gives immediate No while the actual payment remains legal', () => {
  const f = fixture(), mixed = group('and', fact(f.hajrFact), payment(f.asker)), declared = declare(f);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.hajrFact), 'no');
  const asked = ask(declared.game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBribeAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.bribeExpressionPromises?.length ?? 0, 0);
  game = pay(game, f.target, f.asker, 3); assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.asker).bribes, 3); assert.deepEqual(promise(game).progress, []);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native false Hajr OR future payment Yes requires a real debit rather than the frozen false fact', () => {
  const f = fixture(); let game = bind(f, 'yes', group('or', fact(f.hajrFact), payment(f.asker))).game;
  assert.ok(!promise(game).fulfilled); assert.deepEqual(promise(game).progress, []);
  game = pay(game, f.target, f.asker, 2); assert.ok(!promise(game).fulfilled);
  game = pay(game, f.target, f.asker, 1); assert.equal(promise(game).fulfilled, true);
  assert.equal(progress(game, f.asker), 3); assert.equal(player(game, f.target).spice, 7);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native true Shield AND future payment No caps the real cumulative amount through turn end', () => {
  const f = fixture(); let game = bind(f, 'no', group('and', fact(f.shieldFact), payment(f.asker))).game;
  assert.ok(!promise(game).fulfilled); rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  game = pay(game, f.target, f.asker, 2); assert.equal(progress(game, f.asker), 2);
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  game = finish(game); assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).spice, 8);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown non-Fremen forecast uses the conservative whole ${answerValue} payment constraint`, () => {
  const f = fixture(), p = player(f.game, f.target);
  assert.equal(p.faction, 'emperor'); assert.equal(truthKnowledgeOf(f.game, p).stormForecast, null);
  assert.equal(truthFactAnswer(p, f.forecastFact, truthKnowledgeOf(f.game, p)), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), payment(f.asker));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBribeAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue); assert.ok(!promise(game).fulfilled);
  if (answerValue === 'yes') {
    game = pay(game, f.target, f.asker, 3); assert.equal(promise(game).fulfilled, true); assert.equal(progress(game, f.asker), 3);
  } else {
    rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
    game = pay(game, f.target, f.asker, 2); assert.ok(!promise(game).fulfilled);
  }
  game = finish(game); assert.equal(promise(game).fulfilled, true); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed OR keeps the actual alternate recipient available instead of preselecting a branch', () => {
  const f = fixture(), mixed = group('or', group('and', fact(f.shieldFact), payment(f.asker, 3)), payment(f.opponent, 2));
  let game = bind(f, 'yes', mixed).game;
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); assert.ok(typeof guide.action.target === 'string');
  const recipient = guide.action.target === f.asker ? f.opponent : f.asker, amount = recipient === f.asker ? 3 : 2;
  assert.notEqual(recipient, guide.action.target); game = pay(game, f.target, recipient, amount);
  assert.equal(promise(game).fulfilled, true); assert.equal(progress(game, recipient), amount);
  assert.equal(progress(game, guide.action.target), 0); assert.equal(player(game, f.target).spice, 10 - amount);
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native repeated mixed recipient thresholds use one cumulative actual total', () => {
  const f = fixture(), mixed = group('and', fact(f.shieldFact), payment(f.asker, 3), payment(f.asker, 5));
  let game = bind(f, 'yes', mixed).game;
  game = pay(game, f.target, f.asker, 3); assert.equal(progress(game, f.asker), 3); assert.ok(!promise(game).fulfilled);
  game = pay(game, f.target, f.asker, 2); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(promise(game).progress, [{ recipient: f.asker, amount: 5 }]);
  assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.asker).bribes, 5);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native earlier payments remain in the receipt but start outside newly answered mixed progress', () => {
  const f = fixture(), mixed = group('and', fact(f.shieldFact), payment(f.asker, 3), payment(f.opponent, 2));
  let game = pay(f.game, f.target, f.asker, 3); game = bind(f, 'yes', mixed, game).game;
  assert.deepEqual(promise(game).progress, []); assert.equal(player(game, f.asker).bribes, 3);
  game = pay(game, f.target, f.opponent, 2); assert.ok(!promise(game).fulfilled);
  game = pay(game, f.target, f.asker, 3); assert.equal(promise(game).fulfilled, true);
  assert.equal(progress(game, f.asker), 3); assert.equal(player(game, f.asker).bribes, 6); assert.equal(player(game, f.target).spice, 2);
  const result = complete(f, game);
  assert.equal(player(result.mentat.after, f.asker).spice - player(result.mentat.before, f.asker).spice, 6);
  assert.equal(progress(result.game, f.asker), 3); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('two original Truths retain scalar H7 funding while the mixed OR shares the actual ten spice', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bribe', target: f.target, turn: game.turn,
    recipient: f.asker, minimum: 7 } });
  game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, group('and', fact(f.spiceFact), group('or', payment(f.asker, 7), payment(f.opponent, 4))));
  assert.deepEqual(viewGame(game, f.target).truthMixedBribeAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = answer(game, f.target, 'yes');
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 });
  game = pay(game, f.target, f.opponent, 3); assert.ok(!promise(game).fulfilled);
  game = pay(game, f.target, f.asker, 7); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.bribePromises![0].progress, 7); assert.equal(game.bribePromises![0].fulfilled, true);
  assert.equal(progress(game, f.opponent), 3); assert.equal(progress(game, f.asker), 7); assert.equal(player(game, f.target).spice, 0);
  for (const truth of f.truths) truthOnce(game, truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths retain scalar No H5 while a mixed Yes follows the actual alternate A2 guide', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bribe', target: f.target, turn: game.turn,
    recipient: f.asker, minimum: 5 } });
  game = answer(game, f.target, 'no');
  game = answer(ask(game, f.asker, f.target, group('and', fact(f.shieldFact),
    group('or', payment(f.asker, 5), payment(f.opponent, 2)))), f.target, 'yes');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.target, f.opponent); assert.equal(guide.action.amount, 2);
  assert.equal(guide.action.bribePromiseEvent, promise(game).event);
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 5 }); game = act(game, f.target, guide.action);
  assert.equal(game.bribePromises![0].progress, 0); assert.ok(!game.bribePromises![0].fulfilled);
  assert.equal(progress(game, f.opponent), 2); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 8); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed projection retains only owned raw question and aggregate with no frozen residual clauses', () => {
  const f = fixture(), game = bind(f).game;
  for (const actor of [f.target, f.asker, f.opponent]) {
    const view = viewGame(game, actor); assert.ok(!('mixedBribeQuestions' in view)); assert.deepEqual(view.bribeExpressionPromises, []);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    assert.equal(view.truthMixedBribeAnswers, null);
    if (actor !== f.target) {
      assert.deepEqual(view.mixedBribePromises, []); assert.equal(view.bribePromiseGuide, null);
    } else {
      const row = promise(game), required = ['answer', 'asker', 'event', 'mixed', 'player', 'progress', 'turn'];
      const allowed = [...required, 'fulfilled', 'released'];
      assert.ok(required.every(key => Object.keys(row).includes(key))); assert.ok(Object.keys(row).every(key => allowed.includes(key)));
      assert.deepEqual(row.mixed, f.mixed); assert.deepEqual(row.progress, []);
      assert.equal(row.asker, f.asker); assert.equal(row.player, f.target); assert.equal(row.turn, game.turn);
      assert.ok(view.bribePromiseGuide?.action.bribePromiseEvent); assert.ok(!JSON.stringify(row).includes('"claim"'));
    }
  }
  assert.equal(game.bribeExpressionPromises?.length, 1); assert.equal(game.bribeExpressionPromises![0].event, promise(game).event);
});

void test('native exact mixed payment question and guide keep target turn event and JSON wire authoritative', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMixedBribeTargets.includes(f.target));
  rejected(declared.game, f.target, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question,
    mixed: group('and', fact(f.shieldFact), payment(f.target, 1)) } });
  const asked = ask(declared.game, f.asker, f.target, group('and', fact(f.shieldFact), payment(f.asker, 3)));
  assert.equal(viewGame(asked, f.asker).truthMixedBribeAnswers, null);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBribeAnswers, ['yes', 'no']);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' }); let game = answer(asked, f.target, 'yes');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); assert.ok(typeof guide.action.amount === 'number');
  assert.equal(guide.action.bribePromiseEvent, promise(game).event); rejected(game, f.opponent, guide.action);
  rejected(game, f.target, { ...guide.action, bribePromiseEvent: 'stale-mixed-bribe-event' });
  rejected(game, f.target, { ...guide.action, amount: guide.action.amount + 1 });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
  assert.equal(promise(game).fulfilled, true); rejected(game, f.target, wire); rejected(finish(game), f.target, wire);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} Mentat mixed Yes reopens its ready payer and pays at the actual next opening`, () => {
  const f = fixture({ advanced, phase: 8 }); assert.equal(f.sourceActionCount, advanced ? 35 : 32);
  assert.equal(f.sourceActionCount, f.sourceActions.length); let game = act(f.game, f.target, { type: 'ready' });
  game = act(game, f.asker, { type: 'ready' }); assert.equal(game.phase, 8);
  assert.ok(game.ready.includes(f.target)); assert.ok(game.ready.includes(f.asker));
  game = bind(f, 'yes', f.mixed, game).game;
  assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.asker)); assert.ok(!game.ready.includes(f.opponent));
  rejected(game, f.target, { type: 'ready' }); const before = balances(game);
  game = pay(game, f.target, f.asker, 3); rejected(game, f.target, { type: 'ready' });
  game = pay(game, f.target, f.opponent, 2); game = act(game, f.target, { type: 'ready' });
  assert.equal(promise(game).fulfilled, true); assert.ok(game.ready.includes(f.target));
  for (const recipient of [f.asker, f.opponent]) assert.equal(player(game, recipient).spice, before[recipient]);
  const result = complete(f, game); assert.equal(result.nextTurn.after.turn, 2); assert.equal(result.nextTurn.after.phase, 0);
  for (const [recipient, amount] of [[f.asker, 3], [f.opponent, 2]] as const) {
    for (const state of [result.nextTurn.after, result.collection.after, result.mentat.before]) {
      assert.equal(player(state, recipient).bribes, amount); assert.equal(player(state, f.target).spice, 5);
    }
    assert.equal(player(result.mentat.after, recipient).spice - player(result.mentat.before, recipient).spice, amount);
    assert.equal(player(result.mentat.after, recipient).bribes, 0);
  }
  truthOnce(result.game, f.truth); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native mixed No remains binding across actual opening receipts and late payment until turn end', () => {
  const f = fixture({ phase: 7 }); let game = bind(f, 'no').game;
  game = pay(game, f.target, f.asker, 3); const before = player(game, f.asker).spice;
  game = enterMentatBribeWithUnpaidPromise(game); assert.equal(game.phase, 8);
  assert.equal(player(game, f.asker).spice, before + 3); assert.equal(player(game, f.asker).bribes, 0);
  assert.equal(progress(game, f.asker), 3); game = pay(game, f.target, f.opponent, 1);
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 1 }); assert.ok(!promise(game).fulfilled);
  game = finish(game); assert.equal(game.turn, 2); assert.equal(promise(game).fulfilled, true);
  game = pay(game, f.target, f.opponent, 2); assert.equal(progress(game, f.opponent), 1);
  assert.equal(player(game, f.opponent).bribes, 3); assert.equal(player(game, f.target).spice, 4);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies actually answer mixed Yes and submit its exact ordinary payment guides', () => {
  const f = fixture({ phase: 8 }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked);
    const answering = viewGame(game, f.target); answering.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(action => action.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.equal(answerAction.answer, 'yes', difficulty); assert.ok(answering.truthMixedBribeAnswers?.includes('yes'));
    game = act(game, f.target, answerAction);
    for (let count = 0; count < 8 && !promise(game).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
      const guide = view.bribePromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.type === 'bribe' && action.bribePromiseEvent === guide.action.bribePromiseEvent);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action); game = act(game, f.target, action);
    }
    assert.equal(promise(game).fulfilled, true, difficulty); assert.equal(player(game, f.target).spice, 5);
    assert.equal(player(game, f.asker).bribes, 3); assert.equal(player(game, f.opponent).bribes, 2);
    truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});
