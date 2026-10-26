import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthBribe as act, advanceTruthBribe as advance, answerTruthBribe as answer,
  askTruthBribe as ask, bindTruthBribe as bind, completeTruthBribe as complete,
  createTruthBribeFixture as fixture, declareTruthBribe as declare, settleTruthBribe as settle, finishTruthBribe as finish,
  truthBribeBalances as balances, truthBribeClean as clean, truthBribeInventory as inventory, truthBribePlayer as player,
} from './fixture-truth-bribe';
import { createTruthRevivalFixture } from './fixture-truth-revival';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const promise = (game: Game, target: string, recipient: string) =>
  game.bribePromises!.find(promise => promise.player === target && promise.recipient === recipient)!;

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} Truth bribe Yes debits now and credits its exact nonally at actual Mentat`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.originalCards.length, 33); assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  const before = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, before);
  assert.equal(bound.game.auction!.active, f.asker); assert.notEqual(bound.game.auction!.active, f.target);
  assert.equal(bound.game.discard.filter(card => card.id === f.truth).length, 1);
  assert.equal(promise(bound.game, f.target, f.recipient).progress, 0);
  const guide = viewGame(bound.game, f.target).bribePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'bribe'); assert.equal(guide.action.target, f.recipient); assert.equal(guide.action.amount, 3);
  const paid = settle(act(bound.game, f.target, guide.action));
  assert.equal(player(paid, f.target).spice, 7); assert.equal(player(paid, f.recipient).spice, player(before, f.recipient).spice);
  assert.equal(player(paid, f.recipient).bribes, 3);
  assert.equal(promise(paid, f.target, f.recipient).progress, 3); assert.equal(promise(paid, f.target, f.recipient).fulfilled, true);
  const result = complete(f, paid);
  assert.equal(player(result.mentat.before, f.recipient).bribes, 3);
  assert.equal(player(result.mentat.after, f.recipient).bribes, 0);
  assert.equal(player(result.mentat.after, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 3);
  assert.equal(player(result.collection.after, f.recipient).spice - player(paid, f.recipient).spice, advanced ? 2 : 0);
  assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0);
  assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native split bribes fulfill Yes cumulatively only through future matching payments', () => {
  const f = fixture(); let game = bind(f).game;
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.equal(promise(game, f.target, f.recipient).progress, 1); assert.ok(!promise(game, f.target, f.recipient).fulfilled);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 2 });
  assert.equal(promise(game, f.target, f.recipient).progress, 3); assert.equal(promise(game, f.target, f.recipient).fulfilled, true);
  assert.equal(player(game, f.target).spice, 7); assert.equal(player(game, f.recipient).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native No aggregates matching bribes below its cap until the actual next turn', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  for (let index = 0; index < 2; index++) game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.equal(promise(game, f.target, f.recipient).progress, 2);
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  game = complete(f, game).game;
  assert.equal(game.turn, 2); assert.equal(player(game, f.recipient).bribes, 0);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 3 });
  assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.recipient).bribes, 3);
  assert.equal(promise(game, f.target, f.recipient).progress, 2); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior bribes never advance a later Truth promise for the same recipient', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  game = bind(f, 'yes', 3, f.recipient, game).game;
  assert.equal(promise(game, f.target, f.recipient).progress, 0);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.equal(promise(game, f.target, f.recipient).progress, 1);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 2 });
  assert.equal(promise(game, f.target, f.recipient).progress, 3); assert.equal(player(game, f.recipient).bribes, 4);
  assert.equal(player(game, f.target).spice, 6); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native other-recipient payment does not count and cannot spend the last matching Yes funding', () => {
  const f = fixture(); let game = bind(f).game;
  game = act(game, f.target, { type: 'bribe', target: f.opponent, amount: 7 });
  assert.equal(promise(game, f.target, f.recipient).progress, 0); assert.equal(player(game, f.target).spice, 3);
  assert.equal(player(game, f.opponent).bribes, 7); assert.equal(player(game, f.recipient).bribes, 0);
  rejected(game, f.target, { type: 'bribe', target: f.opponent, amount: 1 });
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).spice, 0);
  assert.equal(promise(game, f.target, f.recipient).progress, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truth copies bind compatible Yes and No payments to the exact same recipient', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.recipient, 3); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.recipient, 5); game = answer(game, f.target, 'no');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); game = act(game, f.target, guide.action);
  assert.deepEqual(game.bribePromises!.map(promise => promise.progress), [3, 3]);
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 2 });
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truth copies cannot answer Yes inside an existing matching No cap', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.recipient, 3); game = answer(game, f.target, 'no');
  game = ask(game, f.asker, f.target, f.recipient, 3);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  assert.equal(game.bribePromises!.length, 2); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two native recipient Yes promises reserve their joint actual purse rather than the same spice twice', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.recipient, 3); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.opponent, 3); game = answer(game, f.target, 'yes');
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 8 });
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 7 });
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); assert.equal(guide.action.target, f.opponent);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 7);
  assert.equal(player(game, f.opponent).bribes, 3); assert.ok(game.bribePromises!.every(promise => promise.fulfilled));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native current winning-bid liability limits a bribe witness and the original invoice remains payable', () => {
  const f = fixture({ window: 'active' }); let game = act(f.game, f.target, { type: 'bid', amount: 7 });
  game = bind(f, 'yes', 3, f.recipient, game).game;
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 3);
  game = act(game, f.target, guide.action); assert.equal(player(game, f.target).spice, 7);
  game = advance(game, state => clean(state) && state.auction?.index === 1);
  assert.equal(player(game, f.target).spice, 0); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(player(game, f.recipient).bribes, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native already committed auction spice cannot supply an unfunded three-spice bribe answer', () => {
  const f = fixture({ window: 'active' }); let game = act(f.game, f.target, { type: 'bid', amount: 8 });
  game = declare(f, game).game; game = ask(game, f.asker, f.target, f.recipient, 3);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(player(game, f.target).spice, 10); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native unpaid Bribe Yes passes Collection but cannot finish Mentat before its late payment', () => {
  const f = fixture({ phase: 7 }); let game = act(f.game, f.asker, { type: 'ready' });
  game = act(game, f.opponent, { type: 'ready' }); assert.equal(game.phase, 7);
  game = bind(f, 'yes', 3, f.recipient, game).game;
  const before = player(game, f.recipient).spice;
  game = act(game, f.target, { type: 'ready' });
  assert.equal(game.phase, 8); assert.equal(player(game, f.recipient).spice, before);
  assert.ok(!promise(game, f.target, f.recipient).fulfilled);
  assert.ok(!promise(game, f.target, f.recipient).released);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.recipient).spice, before);
  assert.equal(player(game, f.recipient).bribes, 3);
  game = finish(game);
  assert.equal(game.turn, 2); assert.equal(player(game, f.recipient).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a new Bribe Yes retains already-ready Collection status and permits its original out-of-turn payment', () => {
  const f = fixture({ phase: 7 });
  let game = act(f.game, f.target, { type: 'ready' });
  assert.equal(game.phase, 7); assert.ok(game.ready.includes(f.target));
  game = bind(f, 'yes', 3, f.recipient, game).game;
  assert.equal(game.phase, 7); assert.ok(game.ready.includes(f.target));
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action);
  assert.ok(game.ready.includes(f.target));
  assert.equal(player(game, f.recipient).bribes, 3);
  const result = complete(f, game);
  assert.equal(player(result.mentat.after, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 3);
  assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('controlled known Inflation Double closure reopens a ready payer and requires payment before Collection readiness', () => {
  const f = fixture({ phase: 7 });
  const controlled = structuredClone(f.game);
  // Only the token frame is controlled; the real H/A/E source has no CHOAM
  // player and does not claim a native token-placement history.
  controlled.inflation = { side: 'cancel', placedTurn: 0, updatedTurn: 0, flipped: false };
  let game = act(controlled, f.target, { type: 'ready' });
  assert.ok(game.ready.includes(f.target));
  game = bind(f, 'yes', 3, f.recipient, game).game;
  assert.ok(!game.ready.includes(f.target));
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'ready' }), /Inflation Double/);
  assert.deepEqual(game, before);
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action);
  game = act(game, f.target, { type: 'ready' });
  assert.ok(game.ready.includes(f.target));
  assert.equal(promise(game, f.target, f.recipient).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Truth bribe owner current-turn and guided event checks retain out-of-turn legal payment', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, recipient: f.target } });
  let game = ask(declared.game, f.asker, f.target, f.recipient);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthBribeAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).bribePromiseGuide; assert.ok(guide); assert.ok(guide.action.bribePromiseEvent);
  rejected(game, f.asker, guide.action); const before = balances(game);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).spice, before[f.target] - 3);
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two genuine Truth answers can fund an actual bid and exact-recipient bribe together', () => {
  const f = fixture({ window: 'active' }), declared = declare(f, f.game, { copies: 2 });
  let game = act(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: f.game.turn, lot: f.game.auction!.index + 1, minimum: 2 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.asker, f.target, f.recipient, 3); game = answer(game, f.target, 'yes');
  const bribe = viewGame(game, f.target).bribePromiseGuide; assert.ok(bribe); game = act(game, f.target, bribe.action);
  const bid = viewGame(game, f.target).bidPromiseGuide; assert.ok(bid); game = act(game, f.target, bid.action);
  game = advance(game, state => clean(state) && state.auction?.index === 1);
  assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.recipient).bribes, 3);
  assert.equal(promise(game, f.target, f.recipient).fulfilled, true);
  assert.ok(game.bidPromises!.every(promise => promise.fulfilled || promise.released)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('an existing native Bid Yes cannot reuse its reserved purse for an incompatible Bribe Yes', () => {
  const f = fixture({ window: 'active' }), declared = declare(f, f.game, { copies: 2 });
  let game = act(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: f.game.turn, lot: f.game.auction!.index + 1, minimum: 8 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = ask(game, f.asker, f.target, f.recipient, 3);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
});

void test('an existing native Shipment Yes cannot reuse its paid route funding for a Bribe Yes', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = act(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'shipment', target: f.target,
    territory: 'arrakeen', minimum: 8 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = ask(game, f.asker, f.target, f.recipient, 3);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
});

void test('an existing earned ordinary Revival Yes cannot reuse its paid return funding for a Bribe Yes', () => {
  const f = createTruthRevivalFixture(), declared = declare(f, f.game, { copies: 2 });
  let game = act(declared.game, f.asker, { type: 'truthAsk', question: f.question });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = ask(game, f.asker, f.target, f.asker, 1);
  assert.deepEqual(viewGame(game, f.target).truthBribeAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles submit a legal exact-recipient Bribe Yes payment out of turn', () => {
  const f = fixture(), game = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'bribe' && action.target === f.recipient && action.amount === 3);
    assert.ok(action, difficulty); const paid = act(structuredClone(game), f.target, action);
    assert.equal(player(paid, f.target).spice, 7); assert.equal(player(paid, f.recipient).bribes, 3);
    assert.equal(promise(paid, f.target, f.recipient).fulfilled, true); assert.deepEqual(inventory(paid), f.originalCards);
  }
});
