import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { BribeExpression } from '../game/bribe-expression-promises';
import { enterMentatBribeWithUnpaidPromise } from './fixture-mentat-bribes';
import {
  actTruthBribeExpression as act, answerTruthBribeExpression as answer,
  askTruthBribeExpression as ask, bindTruthBribeExpression as bind,
  completeTruthBribeExpression as complete, createTruthBribeExpressionFixture as fixture,
  declareTruthBribeExpression as declare, finishTruthBribeExpression as finish,
  truthBribeExpressionBalances as balances, truthBribeExpressionInventory as inventory,
  truthBribeExpressionPlayer as player,
} from './fixture-truth-bribe-expression';

const payment = (recipient: string, minimum: number): BribeExpression => ({ kind: 'payment', recipient, minimum });
const group = (kind: 'and' | 'or', ...terms: BribeExpression[]): BribeExpression => ({ kind, terms });
const promise = (game: Game, target: string, index = 0) => game.bribeExpressionPromises!.filter(row => row.player === target)[index];
const progress = (game: Game, target: string, recipient: string, index = 0) =>
  promise(game, target, index).progress.find(row => row.recipient === recipient)?.amount ?? 0;
const pay = (game: Game, actor: string, target: string, amount: number) => act(game, actor, { type: 'bribe', target, amount });
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function completePayments(game: Game, target: string): Game {
  for (let count = 0; count < 8 && game.bribeExpressionPromises!.some(row => row.player === target && row.answer && !row.fulfilled); count++) {
    const guide = viewGame(game, target).bribePromiseGuide; assert.ok(guide);
    game = act(game, target, guide.action);
  }
  assert.ok(game.bribeExpressionPromises!.filter(row => row.player === target && row.answer).every(row => row.fulfilled));
  return game;
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} grouped bribe AND requires both actual cumulative recipient payments before its one opening receipt`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.originalCards.length, 33); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  const source = structuredClone(f.game), before = balances(f.game), bound = bind(f);
  assert.deepEqual(f.game, source); assert.deepEqual(promise(bound.game, f.target).progress, []);
  assert.equal(bound.game.auction!.active, f.asker); assert.notEqual(bound.game.auction!.active, f.target);
  let game = pay(bound.game, f.target, f.asker, 1);
  assert.equal(progress(game, f.target, f.asker), 1); assert.ok(!promise(game, f.target).fulfilled);
  game = pay(game, f.target, f.asker, 2);
  assert.equal(progress(game, f.target, f.asker), 3); assert.equal(progress(game, f.target, f.opponent), 0);
  assert.ok(!promise(game, f.target).fulfilled); assert.equal(player(game, f.target).spice, 7);
  game = pay(game, f.target, f.opponent, 2);
  assert.equal(progress(game, f.target, f.opponent), 2); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 5);
  for (const recipient of [f.asker, f.opponent]) assert.equal(player(game, recipient).spice, before[recipient]);
  assert.equal(player(game, f.asker).bribes, 3); assert.equal(player(game, f.opponent).bribes, 2);
  const result = complete(f, game);
  for (const [recipient, amount] of [[f.asker, 3], [f.opponent, 2]] as const) {
    assert.equal(player(result.mentat.before, recipient).bribes, amount);
    assert.equal(player(result.mentat.after, recipient).spice - player(result.mentat.before, recipient).spice, amount);
    assert.equal(player(result.mentat.after, recipient).bribes, 0);
    assert.equal(progress(result.game, f.target, recipient), amount);
  }
  assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0);
  assert.equal(result.game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native grouped bribe OR accepts the actual alternate recipient instead of saving its suggested route', () => {
  const f = fixture(), claim = group('or', payment(f.asker, 3), payment(f.opponent, 2));
  let game = bind(f, 'yes', claim).game;
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  assert.ok(typeof guide.action.target === 'string');
  const recipient = guide.action.target === f.asker ? f.opponent : f.asker;
  const amount = recipient === f.asker ? 3 : 2;
  assert.notEqual(recipient, guide.action.target); game = pay(game, f.target, recipient, amount);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 10 - amount);
  assert.equal(progress(game, f.target, recipient), amount);
  assert.equal(progress(game, f.target, guide.action.target), 0);
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

for (const first of ['harkonnen', 'atreides']) void test(`native grouped bribe AND No permits ${first} first and rejects only completing both recipients`, () => {
  const f = fixture(); let game = bind(f, 'no').game;
  const other = first === f.asker ? f.opponent : f.asker;
  const firstMinimum = first === f.asker ? 3 : 2, otherMinimum = other === f.asker ? 3 : 2;
  game = pay(game, f.target, first, firstMinimum);
  game = pay(game, f.target, other, otherMinimum - 1);
  assert.equal(progress(game, f.target, first), firstMinimum);
  assert.equal(progress(game, f.target, other), otherMinimum - 1); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, { type: 'bribe', target: other, amount: 1 });
  game = finish(game); assert.equal(game.turn, 2); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native grouped bribe OR No caps either qualifying recipient while allowing smaller cumulative payments', () => {
  const f = fixture(); let game = bind(f, 'no', group('or', payment(f.asker, 3), payment(f.opponent, 2))).game;
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 2 });
  game = pay(game, f.target, f.asker, 2); game = pay(game, f.target, f.opponent, 1);
  for (const recipient of [f.asker, f.opponent]) rejected(game, f.target, { type: 'bribe', target: recipient, amount: 1 });
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 7); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native repeated recipient leaves share one actual payment total rather than charging their thresholds twice', () => {
  const f = fixture(), claim = group('and', payment(f.asker, 3), payment(f.asker, 5));
  let game = bind(f, 'yes', claim).game;
  game = pay(game, f.target, f.asker, 3);
  assert.equal(progress(game, f.target, f.asker), 3); assert.ok(!promise(game, f.target).fulfilled);
  game = pay(game, f.target, f.asker, 2);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(promise(game, f.target).progress.length, 1);
  assert.equal(progress(game, f.target, f.asker), 5); assert.equal(player(game, f.target).spice, 5);
  assert.equal(player(game, f.asker).bribes, 5); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior bribes stay in the real receipt but are excluded from newly answered grouped progress', () => {
  const f = fixture(); let game = pay(f.game, f.target, f.asker, 3);
  game = bind(f, 'yes', f.claim, game).game;
  assert.deepEqual(promise(game, f.target).progress, []); assert.equal(player(game, f.asker).bribes, 3);
  game = pay(game, f.target, f.opponent, 2); assert.ok(!promise(game, f.target).fulfilled);
  game = pay(game, f.target, f.asker, 3);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(progress(game, f.target, f.asker), 3);
  assert.equal(player(game, f.asker).bribes, 6); assert.equal(player(game, f.target).spice, 2);
  const result = complete(f, game);
  assert.equal(player(result.mentat.after, f.asker).spice - player(result.mentat.before, f.asker).spice, 6);
  assert.equal(progress(result.game, f.target, f.asker), 3); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('two original Truths share scalar H7 with grouped OR H7 A4 but spending A4 must retain the scalar H7', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bribe', target: f.target,
    turn: game.turn, recipient: f.asker, minimum: 7 } });
  game = answer(game, f.target, 'yes'); game = ask(game, f.asker, f.target, group('or', payment(f.asker, 7), payment(f.opponent, 4)));
  // Earlier H7 Yes already makes H7 OR A4 true; No cannot evade it.
  assert.deepEqual(viewGame(game, f.target).truthBribeExpressionAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = answer(game, f.target, 'yes');
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 4 });
  game = pay(game, f.target, f.opponent, 3); assert.ok(!promise(game, f.target).fulfilled);
  game = pay(game, f.target, f.asker, 7);
  assert.equal(game.bribePromises![0].progress, 7); assert.equal(game.bribePromises![0].fulfilled, true);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 0);
  assert.equal(progress(game, f.target, f.opponent), 3); assert.equal(progress(game, f.target, f.asker), 7);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths retain scalar No H5 while a grouped OR Yes uses actual A2', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bribe', target: f.target,
    turn: game.turn, recipient: f.asker, minimum: 5 } });
  game = answer(game, f.target, 'no'); game = ask(game, f.asker, f.target, group('or', payment(f.asker, 5), payment(f.opponent, 2)));
  game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  assert.ok(typeof guide.action.amount === 'number');
  assert.equal(guide.action.target, f.opponent); assert.equal(guide.action.amount, 2);
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 5 });
  game = act(game, f.target, guide.action);
  assert.equal(game.bribePromises![0].progress, 0); assert.ok(!game.bribePromises![0].fulfilled);
  assert.equal(progress(game, f.target, f.opponent), 2); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 8); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two whole questions retain one joint purse and a dynamically available OR completion', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, group('or', payment(f.asker, 8), payment(f.opponent, 6))), f.target, 'yes');
  game = ask(game, f.asker, f.target, group('and', payment(f.asker, 3), payment(f.opponent, 3)));
  assert.deepEqual(viewGame(game, f.target).truthBribeExpressionAnswers, ['yes', 'no']); game = answer(game, f.target, 'yes');
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 8 });
  game = pay(game, f.target, f.asker, 3);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target, 1).fulfilled);
  game = pay(game, f.target, f.opponent, 6);
  assert.ok(game.bribeExpressionPromises!.every(row => row.fulfilled)); assert.equal(player(game, f.target).spice, 1);
  for (const index of [0, 1]) {
    assert.equal(progress(game, f.target, f.asker, index), 3); assert.equal(progress(game, f.target, f.opponent, index), 6);
  }
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two whole questions preserve every No OR cap while funding the compatible A2 Yes alternative', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = answer(ask(game, f.asker, f.target, group('or', payment(f.asker, 5), payment(f.opponent, 3))), f.target, 'no');
  game = answer(ask(game, f.asker, f.target, group('or', payment(f.asker, 5), payment(f.opponent, 2))), f.target, 'yes');
  game = pay(game, f.target, f.asker, 4); game = pay(game, f.target, f.opponent, 2);
  assert.ok(!promise(game, f.target).fulfilled); assert.equal(promise(game, f.target, 1).fulfilled, true);
  for (const recipient of [f.asker, f.opponent]) rejected(game, f.target, { type: 'bribe', target: recipient, amount: 1 });
  game = finish(game); assert.ok(game.bribeExpressionPromises!.every(row => row.fulfilled));
  assert.equal(player(game, f.target).spice, 4); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Mentat grouped Yes reopens only its ready payer and its late receipts wait for the actual next opening', () => {
  const f = fixture({ phase: 8 }); let game = act(f.game, f.target, { type: 'ready' });
  game = act(game, f.asker, { type: 'ready' }); assert.equal(game.phase, 8);
  assert.ok(game.ready.includes(f.target)); assert.ok(game.ready.includes(f.asker)); assert.ok(!game.ready.includes(f.opponent));
  game = bind(f, 'yes', f.claim, game).game;
  assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.asker)); assert.ok(!game.ready.includes(f.opponent));
  rejected(game, f.target, { type: 'ready' }); const before = balances(game);
  game = pay(game, f.target, f.asker, 3); rejected(game, f.target, { type: 'ready' });
  game = pay(game, f.target, f.opponent, 2); game = act(game, f.target, { type: 'ready' });
  assert.equal(promise(game, f.target).fulfilled, true); assert.ok(game.ready.includes(f.target));
  for (const recipient of [f.asker, f.opponent]) assert.equal(player(game, recipient).spice, before[recipient]);
  const result = complete(f, game);
  assert.equal(result.nextTurn.after.turn, 2); assert.equal(result.nextTurn.after.phase, 0);
  for (const [recipient, amount] of [[f.asker, 3], [f.opponent, 2]] as const) {
    for (const state of [result.nextTurn.after, result.collection.after, result.mentat.before]) {
      assert.equal(player(state, recipient).bribes, amount); assert.equal(player(state, f.target).spice, 5);
    }
    assert.equal(player(result.mentat.after, recipient).spice - player(result.mentat.before, recipient).spice, amount);
    assert.equal(player(result.mentat.after, recipient).bribes, 0);
  }
  assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native whole No remains binding across opening receipts and late payments until the actual turn ends', () => {
  const f = fixture({ phase: 7 }); let game = bind(f, 'no').game;
  game = pay(game, f.target, f.asker, 3); const before = player(game, f.asker).spice;
  game = enterMentatBribeWithUnpaidPromise(game);
  assert.equal(game.phase, 8); assert.equal(player(game, f.asker).spice, before + 3);
  assert.equal(player(game, f.asker).bribes, 0); assert.equal(progress(game, f.target, f.asker), 3);
  game = pay(game, f.target, f.opponent, 1);
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 1 });
  assert.ok(!promise(game, f.target).fulfilled); game = finish(game);
  assert.equal(game.turn, 2); assert.equal(promise(game, f.target).fulfilled, true);
  game = pay(game, f.target, f.opponent, 2);
  assert.equal(progress(game, f.target, f.opponent), 1); assert.equal(player(game, f.opponent).bribes, 3);
  assert.equal(player(game, f.target).spice, 4); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native grouped question and ordinary guide retain exact target ownership current turn and payment event', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, claim: group('and', payment(f.asker, 3), payment(f.target, 1)) } });
  const claim = group('and', payment(f.asker, 3), payment(f.asker, 2));
  let game = ask(declared.game, f.asker, f.target, claim);
  assert.equal(viewGame(game, f.asker).truthBribeExpressionAnswers, null);
  assert.deepEqual(viewGame(game, f.target).truthBribeExpressionAnswers, ['yes', 'no']);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  assert.ok(typeof guide.action.amount === 'number');
  assert.equal(guide.action.bribePromiseEvent, promise(game, f.target).event);
  rejected(game, f.opponent, guide.action);
  rejected(game, f.target, { ...guide.action, bribePromiseEvent: 'stale-grouped-bribe-event' });
  rejected(game, f.target, { ...guide.action, amount: guide.action.amount + 1 });
  game = act(game, f.target, guide.action); rejected(game, f.target, guide.action);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies submit the exact legal ordinary guide until the whole grouped AND is paid', () => {
  const f = fixture({ phase: 8 }), bound = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(bound);
    for (let count = 0; count < 8 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
      const guide = view.bribePromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.type === 'bribe' && action.bribePromiseEvent === guide.action.bribePromiseEvent &&
        action.target === guide.action.target && action.amount === guide.action.amount);
      assert.ok(action, difficulty); game = act(game, f.target, action);
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.asker).bribes, 3);
    assert.equal(player(game, f.opponent).bribes, 2); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native exact grouped guides complete both recipients without changing the original auction turn', () => {
  const f = fixture(), game = completePayments(bind(f).game, f.target);
  assert.equal(game.auction!.active, f.game.auction!.active); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(progress(game, f.target, f.asker), 3); assert.equal(progress(game, f.target, f.opponent), 2);
  assert.equal(player(game, f.target).spice, 5); assert.deepEqual(inventory(game), f.originalCards);
});
