import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import {
  actAdvancedCharityOrder as act, advancedCharityOrderClean as clean,
  advancedCharityOrderInventory as inventory, advancedCharityOrderPlayer as p,
  advancedCharityOrderReload as reload, allowAdvancedCharityOpening as allow,
  createAdvancedCharityOrderFixture as fixture, finishAdvancedCharityPhase as finishPhase,
  finishAdvancedCharityTurn as finishTurn, nextAdvancedCharityOrderStep as next,
  passAdvancedCharityResponses as pass, unstampedAdvancedCharitySupplement as unstamped,
  type AdvancedCharityOrderStep,
} from './fixture-advanced-charity-order';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('genuine Advanced Charity source uses native First Player order and a claim retains its owned turn', () => {
  const f = fixture(); let game = allow(reload(f.game));
  assert.equal(f.sourceCounts.setup, f.setupActions.length);
  assert.equal(f.sourceCounts.bribes, f.bribeActions.length);
  assert.equal(f.sourceCounts.source, f.actions.length);
  assert.ok(f.bribeActions.some(step => step.actor === 'atreides' && step.action.type === 'bribe'));
  assert.equal(p(f.beforeIncome, 'choam').spice, 2); assert.equal(p(game, 'choam').spice, 8);
  assert.equal(p(game, 'choam').bribes, p(f.beforeIncome, 'choam').bribes);
  assert.deepEqual(game.charityOrder, { version: 1, turn: game.turn, order: game.order, remaining: game.order });
  assert.equal(game.active, 'atreides');
  assert.deepEqual(viewGame(game, 'atreides').charityOrder, game.charityOrder);
  const queue = structuredClone(game.charityOrder);
  game = act(game, 'atreides', { type: 'charity' });
  assert.equal(p(game, 'atreides').spice, 2); assert.equal(p(game, 'atreides').charityTurn, game.turn);
  assert.equal(p(game, 'choam').spice, 6);
  assert.deepEqual(game.charityOrder, queue); assert.equal(game.active, 'atreides');
  game = finishTurn(game);
  assert.equal(game.active, 'beneGesserit');
  assert.deepEqual(game.charityOrder?.remaining, ['beneGesserit', 'choam']);
  assert.deepEqual(inventory(game), f.original);
});

void test('later and completed Advanced Charity actors cannot claim or finish out of order', () => {
  const f = fixture(); let game = allow(reload(f.game));
  for (const actor of ['beneGesserit', 'choam']) {
    assert.ok(viewGame(game, actor).charity.orderBlocked);
    reject(game, actor, { type: 'charity' }); reject(game, actor, { type: 'ready' });
  }
  game = finishTurn(game);
  reject(game, 'atreides', { type: 'charity' }); reject(game, 'atreides', { type: 'ready' });
  assert.ok(viewGame(game, 'atreides').charity.orderBlocked);
  assert.equal(game.active, 'beneGesserit');
  assert.deepEqual(game.charityOrder?.remaining, ['beneGesserit', 'choam']);
});

void test('original CHOAM opening response holds the whole Charity queue before any claim or Finish', () => {
  const f = fixture(), before = reload(f.game), queue = structuredClone(f.game.charityOrder);
  assert.equal(before.response?.kind, 'choamCharity');
  assert.ok(queue);
  reject(before, 'atreides', { type: 'charity' }); reject(before, 'atreides', { type: 'ready' });
  let game = before;
  for (let count = 0; game.response && count < 10; count++) {
    assert.deepEqual(game.charityOrder, queue);
    const step = next(game); assert.ok(step); assert.equal(step.action.type, 'passResponse');
    game = act(game, step.actor, step.action);
  }
  assert.equal(game.response ?? null, null);
  assert.deepEqual(game.charityOrder, queue);
  assert.equal(game.active, queue.remaining[0]);
  assert.equal(p(game, 'choam').spice, 8);
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
  assert.notEqual(p(game, 'atreides').charityTurn, game.turn);
  assert.deepEqual(inventory(game), f.original);
});

void test('wealthy Bene Gesserit response retains the current Charity actor through native payment then real finishes close phase', () => {
  const f = fixture(); let game = allow(reload(f.game));
  game = act(game, 'atreides', { type: 'charity' }); game = finishTurn(game);
  const bg = p(game, 'beneGesserit').spice, provider = p(game, 'choam').spice;
  const queue = structuredClone(game.charityOrder);
  assert.ok(bg >= 2);
  game = act(game, 'beneGesserit', { type: 'charity' });
  assert.equal(game.response?.kind, 'bgCharity');
  assert.equal(game.active, 'beneGesserit'); assert.deepEqual(game.charityOrder, queue);
  reject(game, 'beneGesserit', { type: 'ready' }); reject(game, 'choam', { type: 'ready' });
  game = pass(game);
  assert.equal(p(game, 'beneGesserit').spice, bg + 2);
  assert.equal(p(game, 'choam').spice, provider - 2);
  assert.equal(game.active, 'beneGesserit'); assert.deepEqual(game.charityOrder, queue);
  game = finishTurn(game); assert.equal(game.active, 'choam');
  game = finishTurn(game);
  if (game.phase === 2) assert.ok(game.charityOrder, 'The original closing phase controls still own the frame');
  game = finishPhase(game);
  assert.equal(game.phase, 3); assert.equal(game.charityOrder ?? null, null);
  assert.deepEqual(inventory(game), f.original);
});

void test('Basic low claimants retain concurrent Charity and no ordered frame', () => {
  const f = fixture({ advanced: false, lowBG: true }); let game = allow(reload(f.game));
  assert.equal(game.charityOrder ?? null, null);
  assert.equal(viewGame(game, 'beneGesserit').charity.orderBlocked, null);
  assert.equal(p(game, 'atreides').spice, 0); assert.equal(p(game, 'beneGesserit').spice, 0);
  game = act(game, 'beneGesserit', { type: 'charity' });
  assert.equal(p(game, 'beneGesserit').spice, 2);
  game = act(game, 'beneGesserit', { type: 'ready' });
  game = act(game, 'atreides', { type: 'charity' });
  assert.equal(p(game, 'atreides').spice, 2);
  assert.equal(p(game, 'choam').spice, 4);
  assert.equal(game.charityOrder ?? null, null);
  assert.deepEqual(inventory(game), f.original);
});

void test('explicit conserved unstamped Advanced unit boundary retains the old concurrent claim contract', () => {
  const f = fixture(), ordered = allow(reload(f.game));
  let game = unstamped(ordered);
  const { charityOrder: ignored, ...rest } = ordered;
  assert.ok(ignored); assert.deepEqual(game, rest, 'Only the frame is removed in this labelled unit supplement');
  game = act(game, 'beneGesserit', { type: 'charity' });
  assert.equal(game.response?.kind, 'bgCharity'); game = pass(game);
  game = act(game, 'atreides', { type: 'charity' });
  assert.equal(p(game, 'atreides').spice, 2);
  assert.equal(game.charityOrder ?? null, null);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal profiles claim or Finish only the current actual Advanced Charity turn', () => {
  const f = fixture(), opened = allow(reload(f.game));
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = reload(opened);
    const actions: AdvancedCharityOrderStep[] = [];
    for (let count = 0; game.phase === 2 && count < 40; count++) {
      if (!clean(game)) {
        const step = next(game); assert.ok(step);
        game = act(game, step.actor, step.action, actions); continue;
      }
      const actor = game.charityOrder?.remaining[0]; assert.ok(actor);
      for (const other of game.players.filter(player => player.id !== actor)) {
        const view = viewGame(game, other.id); view.players.find(player => player.id === other.id)!.bot = difficulty;
        assert.equal(botActions(view).some(action => ['charity', 'ready'].includes(action.type)), false);
      }
      const view = viewGame(game, actor); view.players.find(player => player.id === actor)!.bot = difficulty;
      const action = botActions(view).find(action => ['charity', 'ready'].includes(action.type));
      assert.ok(action, `${difficulty} supplies the current actor’s native claim or Finish`);
      game = act(game, actor, action, actions);
    }
    assert.ok(actions.length > 0); assert.equal(game.phase, 3);
    assert.equal(game.charityOrder ?? null, null);
    assert.deepEqual(inventory(game), f.original);
  }
});
