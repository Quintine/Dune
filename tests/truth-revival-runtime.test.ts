import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { forceRevivalQuote } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthRevival as act, advanceTruthRevival as advance, answerTruthRevival as answer,
  askTruthRevival as ask, bindTruthRevival as bind, createTruthRevivalFixture as fixture,
  declareTruthRevival as declare, finishTruthRevival as finish, settleTruthRevival as settle,
  truthRevivalClean as clean, truthRevivalInventory as inventory, truthRevivalPlayer as player,
} from './fixture-truth-revival';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const progress = (game: Game, target: string) => game.revivalPromises!.find(promise => promise.player === target)!;

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced typed' : 'Basic'} ordinary Revival Yes earns original free and paid returns from real Storm casualties`, () => {
  const f = fixture({ advanced });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup'); assert.deepEqual(f.staging, []);
  assert.deepEqual(f.game.expansions, []); assert.equal(f.originalCards.length, 33);
  assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 6);
  assert.equal(player(f.shipment.after, f.target).forces[f.location], 3);
  assert.equal(player(f.storm.after, f.target).forces[f.location], undefined);
  assert.equal(player(f.storm.after, f.target).tanks, 3);
  assert.equal(player(f.storm.after, f.target).elites?.tanks ?? 0, advanced ? 1 : 0);
  const before = structuredClone(f.game), bound = bind(f);
  assert.deepEqual(f.game, before);
  assert.equal(bound.game.discard.filter(card => card.id === f.truth).length, 1);
  assert.equal(progress(bound.game, f.target).progress, 0);
  rejected(bound.game, f.target, { type: 'ready' });
  const guide = viewGame(bound.game, f.target).revivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'revive'); assert.equal(guide.action.amount, 3); assert.equal(guide.action.elite, advanced ? 1 : 0);
  const quote = forceRevivalQuote(bound.game, player(bound.game, f.target), 3, advanced ? 1 : 0);
  assert.equal(quote.free, 1); assert.equal(quote.cost, 4);
  const returned = settle(act(bound.game, f.target, guide.action)), own = player(returned, f.target);
  assert.equal(own.spice, 0); assert.equal(own.reserves, 20); assert.equal(own.tanks, 0);
  assert.equal(own.revived, 3); assert.equal(own.freeForcesRevived, 1);
  if (advanced) { assert.equal(own.elites!.tanks, 0); assert.equal(own.elites!.reserves, 5); assert.equal(own.elites!.revived, 1); }
  assert.equal(progress(returned, f.target).progress, 3); assert.equal(progress(returned, f.target).fulfilled, true);
  assert.deepEqual(inventory(returned), f.originalCards);
  const done = finish(returned); assert.equal(done.phase, 5); assert.deepEqual(inventory(done), f.originalCards);
});

void test('native split ordinary returns fulfill cumulative Yes only after the second actual request', () => {
  const f = fixture(), bound = bind(f); let game = act(bound.game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 1); assert.ok(!progress(game, f.target).fulfilled);
  assert.equal(player(game, f.target).spice, 4); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'revive', amount: 2, elite: 0 });
  assert.equal(progress(game, f.target).progress, 3); assert.equal(progress(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).freeForcesRevived, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native No counts split ordinary requests together and permits an owned finish below its threshold', () => {
  const f = fixture(); let game = bind(f, 'no', 2).game;
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 1);
  rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'ready');
  game = act(game, f.target, guide.action); game = finish(game);
  assert.equal(player(game, f.target).revived, 1); assert.equal(player(game, f.target).tanks, 2);
  assert.equal(progress(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Basic No survives an early Ready and permits only below-cap ordinary returns before phase close', () => {
  const f = fixture(); let game = bind(f, 'no', 3).game;
  game = act(game, f.target, { type: 'ready' });
  assert.equal(game.phase, 4); assert.ok(game.ready.includes(f.target));
  assert.ok(!progress(game, f.target).fulfilled);
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 1); assert.equal(player(game, f.target).revived, 1);
  rejected(game, f.target, { type: 'revive', amount: 2, elite: 0 });
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Advanced elite Yes counts one physical Sardaukar and ignores an earlier normal partial', () => {
  const f = fixture({ advanced: true }); let game = bind(f, 'yes', 1, 'elite').game;
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 0); assert.equal(player(game, f.target).freeForcesRevived, 1);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.action.elite, 1);
  game = act(game, f.target, guide.action);
  assert.equal(progress(game, f.target).progress, 1); assert.equal(progress(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).elites!.reserves, 5); assert.equal(player(game, f.target).elites!.tanks, 0);
  assert.equal(player(game, f.target).revived, 2); assert.equal(player(game, f.target).spice, 2);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior ordinary returns cannot fulfill a newly answered Revival Yes', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'revive', amount: 1, elite: 0 });
  game = bind(f, 'yes', 2, 'total', game).game;
  assert.equal(player(game, f.target).revived, 1); assert.equal(progress(game, f.target).progress, 0);
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 1); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 2); assert.equal(player(game, f.target).spice, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two genuine Truth copies bind compatible Advanced normal and elite ordinary returns', () => {
  const f = fixture({ advanced: true }), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, 2, 'normal'); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, 1, 'elite'); game = answer(game, f.target, 'yes');
  for (let count = 0; game.revivalPromises!.some(promise => promise.answer && !promise.fulfilled && !promise.released) && count < 3; count++) {
    const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); game = act(game, f.target, guide.action);
  }
  assert.ok(game.revivalPromises!.every(promise => promise.fulfilled));
  assert.deepEqual(game.revivalPromises!.map(promise => promise.progress), [2, 1]);
  assert.equal(player(game, f.target).tanks, 0); assert.equal(player(game, f.target).spice, 0);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two genuine Truth copies reject an incompatible cumulative ordinary Revival answer', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, 2); game = answer(game, f.target, 'no');
  game = ask(game, f.asker, f.target, 2);
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.equal(game.revivalPromises!.length, 2); assert.equal(game.discard.filter(card => f.truths.includes(card.id)).length, 2);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native promised payer cannot spend the four spice needed by its only ordinary Revival witness', () => {
  const f = fixture(), bound = bind(f);
  rejected(bound.game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(player(bound.game, f.target).spice, 4); assert.equal(progress(bound.game, f.target).progress, 0);
});

void test('original Ghola return does not advance an ordinary Revival promise or consume its free quota', () => {
  const f = fixture({ targetGhola: true }); let game = bind(f, 'no', 2).game; assert.ok(f.ghola);
  game = settle(act(game, f.target, { type: 'card', card: f.ghola, amount: 1, elite: 0 }));
  assert.equal(progress(game, f.target).progress, 0); assert.equal(player(game, f.target).revived, 0);
  assert.equal(player(game, f.target).freeForcesRevived ?? 0, 0); assert.equal(player(game, f.target).tanks, 2);
  assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(progress(game, f.target).progress, 1); assert.equal(player(game, f.target).freeForcesRevived, 1);
  rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 }); assert.deepEqual(inventory(game), f.originalCards);
});

void test('original Ghola cannot voluntarily withdraw the Tanks needed by a promised ordinary return', () => {
  const f = fixture({ targetGhola: true }), bound = bind(f); assert.ok(f.ghola);
  rejected(bound.game, f.target, { type: 'card', card: f.ghola, amount: 1, elite: 0 });
  assert.ok(player(bound.game, f.target).hand.some(card => card.id === f.ghola));
  assert.equal(player(bound.game, f.target).tanks, 3);
});

void test('native waiting Advanced respondent keeps its future Revival witness until its original current opportunity', () => {
  const f = fixture({ advanced: true, window: 'waiting' }); assert.notEqual(f.game.revivalOrder!.remaining[0], f.target);
  let game = bind(f).game; assert.equal(viewGame(game, f.target).revivalPromiseGuide, null);
  game = advance(game, state => clean(state) && state.revivalOrder?.remaining[0] === f.target);
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(progress(game, f.target).progress, 3);
  assert.equal(player(game, f.target).tanks, 0); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Tleilaxu response records no promised progress before the actual allowed typed return', () => {
  const f = fixture({ advanced: true, stopper: true }); let game = bind(f).game;
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); const before = structuredClone(player(game, f.target));
  game = act(game, f.target, guide.action);
  assert.equal(game.decision?.kind, 'revivalStop'); assert.equal(game.decision!.player, f.stopper);
  assert.equal(progress(game, f.target).progress, 0); assert.deepEqual(player(game, f.target), before);
  game = settle(act(game, f.stopper!, { type: 'decision', decline: true }));
  assert.equal(progress(game, f.target).progress, 3); assert.equal(progress(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).tanks, 0);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native opposing Tleilaxu special Karama prevents the pending return and releases its impossible Yes', () => {
  const f = fixture({ advanced: true, stopper: true }); let game = bind(f).game; assert.ok(f.special && f.karama);
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(progress(game, f.target).progress, 0);
  game = settle(act(game, f.stopper!, f.special));
  assert.equal(progress(game, f.target).progress, 0); assert.equal(progress(game, f.target).released, true);
  assert.equal(player(game, f.target).spice, 4); assert.equal(player(game, f.target).tanks, 3);
  assert.equal(player(game, f.target).revived, 0); assert.equal(player(game, f.target).freeForcesRevived ?? 0, 0);
  assert.equal(player(game, f.stopper!).specialKaramaUsed, true);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.revivalOrder!.completed.includes(f.target));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Revival question ownership and stale guided actions preserve the actual current turn', () => {
  const f = fixture({ advanced: true }), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  let game = ask(declared.game, f.asker, f.target);
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthRevivalAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.ok(guide.action.revivalPromiseEvent);
  rejected(game, f.opponent, guide.action);
  game = act(game, f.target, guide.action); rejected(game, f.target, guide.action);
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.revivalOrder!.completed.includes(f.target));
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies offer a legal ordinary return for the native Revival Yes', () => {
  const f = fixture(), game = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'revive' && action.amount === 3); assert.ok(action, difficulty);
    const accepted = act(structuredClone(game), f.target, action);
    assert.equal(progress(accepted, f.target).fulfilled, true); assert.equal(player(accepted, f.target).tanks, 0);
    assert.deepEqual(inventory(accepted), f.originalCards);
  }
});
