import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bindTruthBribe } from './fixture-truth-bribe';
import {
  actMentatBribe as act, advanceMentatBribe as advance, bindMentatBribe as bind,
  completeMentatBribe as complete, createMentatBribeFixture as fixture,
  enterMentatBribeWithUnpaidPromise as enterMentat, finishMentatBribe as finish,
  mentatBribeBalances as balances, mentatBribeClean as clean,
  mentatBribeDeferred as deferred, mentatBribeInventory as inventory, mentatBribePlayer as player,
  nextMentatBribeOpening as opening, settleMentatBribe as settle,
} from './fixture-mentat-bribes';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const promise = (game: Game, target: string, recipient: string) =>
  game.bribePromises!.find(promise => promise.player === target && promise.recipient === recipient)!;
const pay = (game: Game, actor: string, target: string, amount: number) => act(game, actor, { type: 'bribe', target, amount });

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} late Mentat payment waits through real next Storm and Collection for one opening receipt`, () => {
  const f = fixture({ advanced });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.originalCards.length, 33); assert.deepEqual(f.staging, []);
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.ok(f.mentat.steps.length > 0);
  assert.equal(f.phase7.before.phase, 3); assert.equal(f.phase7.after.phase, 7);
  assert.equal(f.mentat.before.phase, 7); assert.equal(f.mentat.after.phase, 8);
  assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
  const source = structuredClone(f.game), before = balances(f.game);
  let game = pay(f.game, f.payer, f.recipient, 3);
  assert.deepEqual(f.game, source);
  assert.equal(player(game, f.payer).spice, 7); assert.equal(player(game, f.recipient).spice, before[f.recipient]);
  assert.equal(player(game, f.recipient).bribes, 3);
  const result = complete(f, game);
  assert.equal(result.nextTurn.after.turn, 2); assert.equal(result.nextTurn.after.phase, 0);
  for (const state of [result.nextTurn.after, result.collection.after, result.mentat.before]) {
    assert.equal(player(state, f.recipient).bribes, 3);
    assert.equal(player(state, f.payer).spice, 7);
    assert.deepEqual(player(state, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(inventory(state), f.originalCards);
  }
  assert.equal(player(result.nextTurn.after, f.recipient).spice, before[f.recipient]);
  assert.equal(player(result.collection.after, f.recipient).spice - before[f.recipient], advanced ? 2 : 0);
  assert.equal(player(result.mentat.after, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 3);
  assert.equal(player(result.mentat.after, f.recipient).bribes, 0);
  const received = balances(result.game);
  game = settle(act(result.game, f.payer, { type: 'ready' }));
  assert.equal(game.phase, 8); assert.deepEqual(balances(game), received);
  assert.ok(game.players.every(seat => seat.bribes === 0)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native late incoming Mentat spice cannot fund another payment or the next actual auction bid before collection', () => {
  const f = fixture(), game = pay(f.game, f.payer, f.recipient, 3), cash = player(game, f.recipient).spice;
  rejected(game, f.recipient, { type: 'bribe', target: f.opponent, amount: cash + 1 });
  const auction = advance(game, state => state.turn === 2 && state.phase === 3 && clean(state) && state.auction?.active === f.recipient);
  assert.equal(player(auction, f.recipient).spice, cash); assert.equal(player(auction, f.recipient).bribes, 3);
  rejected(auction, f.recipient, { type: 'bid', amount: cash + 1 });
  rejected(auction, f.recipient, { type: 'bribe', target: f.opponent, amount: cash + 1 });
  assert.deepEqual(player(auction, f.asker).hand.map(card => card.id), f.truths);
  assert.deepEqual(inventory(auction), f.originalCards);
});

void test('native multiple late payer payments sum once in the exact next Mentat recipient receipt', () => {
  const f = fixture(), before = balances(f.game);
  let game = pay(f.game, f.payer, f.recipient, 3); game = pay(game, f.opponent, f.recipient, 2);
  assert.equal(player(game, f.payer).spice, before[f.payer] - 3);
  assert.equal(player(game, f.opponent).spice, before[f.opponent] - 2);
  assert.equal(player(game, f.recipient).spice, before[f.recipient]); assert.equal(player(game, f.recipient).bribes, 5);
  const result = complete(f, game);
  assert.equal(player(result.mentat.before, f.recipient).bribes, 5);
  assert.equal(player(result.game, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 5);
  assert.ok(result.game.players.every(seat => seat.bribes === 0)); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native pre-Mentat and late-Mentat payments belong to their separate actual openings', () => {
  const f = fixture(); let game = pay(f.base.game, f.payer, f.recipient, 2);
  const firstCash = player(game, f.recipient).spice;
  game = opening(game);
  assert.equal(player(game, f.recipient).spice, firstCash + 2); assert.equal(player(game, f.recipient).bribes, 0);
  game = pay(game, f.payer, f.recipient, 3);
  assert.equal(player(game, f.payer).spice, 5); assert.equal(player(game, f.recipient).spice, firstCash + 2);
  assert.equal(player(game, f.recipient).bribes, 3);
  const result = complete(f, game);
  assert.equal(player(result.nextTurn.after, f.recipient).spice, firstCash + 2);
  assert.equal(player(result.game, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 3);
  assert.equal(player(result.game, f.recipient).bribes, 0); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native new Mentat Truth Yes requires the real payment before payer Ready and leaves its receipt deferred', () => {
  const f = fixture(), bound = bind(f); let game = bound.game;
  assert.equal(game.phase, 8); assert.deepEqual(viewGame(bound.asked, f.payer).truthBribeAnswers, ['yes', 'no']);
  rejected(game, f.payer, { type: 'ready' });
  const guide = viewGame(game, f.payer).bribePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.target, f.recipient); assert.equal(guide.action.amount, 3);
  const before = balances(game); game = act(game, f.payer, guide.action);
  assert.equal(player(game, f.payer).spice, 7); assert.equal(player(game, f.recipient).spice, before[f.recipient]);
  assert.equal(player(game, f.recipient).bribes, 3); assert.equal(promise(game, f.payer, f.recipient).fulfilled, true);
  game = act(game, f.payer, { type: 'ready' }); assert.ok(game.ready.includes(f.payer)); assert.equal(game.phase, 8);
  const result = complete(f, game);
  assert.equal(player(result.game, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 3);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native Collection Truth Yes survives Collection Ready and remains binding in actual Mentat', () => {
  const f = fixture(); let game = bindTruthBribe(f.base).game;
  const before = balances(game); game = enterMentat(game);
  assert.equal(game.phase, 8); assert.deepEqual(balances(game), before); assert.equal(player(game, f.recipient).bribes, 0);
  assert.equal(promise(game, f.payer, f.recipient).progress, 0); assert.ok(!promise(game, f.payer, f.recipient).released);
  rejected(game, f.payer, { type: 'ready' });
  const guide = viewGame(game, f.payer).bribePromiseGuide; assert.ok(guide); game = act(game, f.payer, guide.action);
  assert.equal(player(game, f.payer).spice, 7); assert.equal(player(game, f.recipient).spice, before[f.recipient]);
  assert.equal(player(game, f.recipient).bribes, 3); assert.equal(promise(game, f.payer, f.recipient).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Collection No cap spans its old receipt and late Mentat payments until actual turn advance', () => {
  const f = fixture(); let game = bindTruthBribe(f.base, 'no').game;
  game = pay(game, f.payer, f.recipient, 1); const before = player(game, f.recipient).spice;
  game = enterMentat(game);
  assert.equal(player(game, f.recipient).spice, before + 1); assert.equal(player(game, f.recipient).bribes, 0);
  assert.equal(promise(game, f.payer, f.recipient).progress, 1);
  game = pay(game, f.payer, f.recipient, 1);
  assert.equal(promise(game, f.payer, f.recipient).progress, 2); assert.equal(player(game, f.recipient).bribes, 1);
  rejected(game, f.payer, { type: 'bribe', target: f.recipient, amount: 1 });
  game = finish(game); assert.equal(game.turn, 2); assert.equal(game.phase, 0);
  game = pay(game, f.payer, f.recipient, 3);
  assert.equal(player(game, f.payer).spice, 5); assert.equal(player(game, f.recipient).bribes, 4);
  assert.equal(promise(game, f.payer, f.recipient).progress, 2); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native new Mentat Yes reopens only its already-ready payer while another seat is still unready', () => {
  const f = fixture(); let game = act(f.game, f.payer, { type: 'ready' });
  game = act(game, f.asker, { type: 'ready' }); assert.equal(game.phase, 8);
  assert.ok(game.ready.includes(f.payer)); assert.ok(game.ready.includes(f.asker)); assert.ok(!game.ready.includes(f.opponent));
  game = bind(f, 'yes', 3, f.recipient, game).game;
  assert.ok(!game.ready.includes(f.payer)); assert.ok(game.ready.includes(f.asker)); assert.ok(!game.ready.includes(f.opponent));
  rejected(game, f.payer, { type: 'ready' });
  const guide = viewGame(game, f.payer).bribePromiseGuide; assert.ok(guide); game = act(game, f.payer, guide.action);
  game = act(game, f.payer, { type: 'ready' });
  assert.equal(game.phase, 8); assert.ok(game.ready.includes(f.payer)); assert.ok(game.ready.includes(f.asker));
  assert.equal(player(game, f.recipient).bribes, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native an already-ready Mentat payer can make an ordinary late payment while other seats wait', () => {
  const f = fixture(); let game = act(f.game, f.payer, { type: 'ready' });
  const before = balances(game), ready = [...game.ready]; game = pay(game, f.payer, f.recipient, 3);
  assert.equal(game.phase, 8); assert.deepEqual(game.ready, ready);
  assert.equal(player(game, f.payer).spice, 7); assert.equal(player(game, f.recipient).spice, before[f.recipient]);
  assert.equal(player(game, f.recipient).bribes, 3);
  assert.deepEqual(player(game, f.asker).hand.map(card => card.id), f.truths); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native a new Mentat No still caps cumulative payments until the real next turn', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  game = pay(game, f.payer, f.recipient, 1); rejected(game, f.payer, { type: 'bribe', target: f.recipient, amount: 2 });
  const cash = balances(game), receipts = deferred(game); game = finish(game);
  assert.equal(game.turn, 2); assert.deepEqual(balances(game), cash); assert.deepEqual(deferred(game), receipts);
  game = pay(game, f.payer, f.recipient, 3);
  assert.equal(player(game, f.payer).spice, 6); assert.equal(player(game, f.recipient).bribes, 4);
  assert.equal(promise(game, f.payer, f.recipient).progress, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles execute the exact legal Mentat Truth Yes payment before Ready', () => {
  const f = fixture(), game = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.payer); view.players.find(seat => seat.id === f.payer)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'bribe' && action.target === f.recipient && action.amount === 3);
    assert.ok(action, difficulty); const paid = act(structuredClone(game), f.payer, action);
    assert.equal(player(paid, f.payer).spice, 7); assert.equal(player(paid, f.recipient).spice, player(game, f.recipient).spice);
    assert.equal(player(paid, f.recipient).bribes, 3); assert.equal(promise(paid, f.payer, f.recipient).fulfilled, true);
    assert.deepEqual(inventory(paid), f.originalCards);
  }
});
