import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionGuideButton } from '../components/turn-action-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { advanceTruthMovement, truthMovementInventory } from './fixture-truth-movement';
import {
  actTruthStormDial as act, askStormDial as ask, bindStormDial as bind,
  createTruthStormDialFixture as fixture, declareStormDialQuestion as declare,
  declareTwoStormDialQuestions as declareTwo, sourceWithStormWeather,
} from './fixture-truth-storm-dial';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
function privateDials(game: Game, player: string) {
  const view = viewGame(game, player);
  assert.equal(view.stormRevealed, null);
  assert.equal('stormDials' in view, false);
  return view;
}

void test('a Yes binds the current original dial and guides the native human and all four bots', () => {
  const f = fixture(), asked = ask(declare(f), f);
  assert.ok(viewGame(asked, f.target).truthTurnActionAnswers?.includes('yes'));
  let game = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.truthtrance, null); assert.equal(game.stormPending, null);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  const view = privateDials(game, f.target), guide = view.turnActionGuide;
  assert.ok(guide); assert.equal(guide.action.type, 'stormDial'); assert.equal(guide.action.amount, f.value);
  const sent: Action[] = [];
  const props = { game: view, busy: false, act: (action: Action) => sent.push(action) };
  const button = TurnActionGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
  assert.match(renderToStaticMarkup(createElement(TurnActionGuideButton, props)), /storm|dial/i);
  button.props.onClick(); assert.deepEqual(sent, [guide.action]);
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target);
    bot.players.find(player => player.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(bot)[0], guide.action);
  }
  rejected(game, f.target, { type: 'stormDial', amount: f.value + 1 });
  game = act(game, f.target, guide.action);
  assert.equal(game.stormDials[f.target], f.value); assert.equal(game.stormPending, null);
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  const observer = privateDials(game, f.asker);
  assert.ok(observer.stormSubmitted.includes(f.target));
  game = act(game, f.asker, { type: 'stormDial', amount: 3 });
  assert.equal(game.stormPending, f.value + 3);
  assert.deepEqual(viewGame(game, f.asker).stormRevealed, { [f.target]: f.value, [f.asker]: 3 });
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
});

void test('a No forbids only the named value and the other real dialer remains sealed', () => {
  const f = fixture();
  const otherDialed = act(f.game, f.asker, { type: 'stormDial', amount: 3 });
  assert.equal(otherDialed.stormPending, null);
  const targetView = privateDials(otherDialed, f.target);
  assert.ok(targetView.stormSubmitted.includes(f.asker));
  let game = bind(f, 'no', otherDialed).game;
  rejected(game, f.target, { type: 'stormDial', amount: f.value });
  const guide = viewGame(game, f.target).turnActionGuide;
  assert.ok(guide); assert.equal(guide.action.type, 'stormDial'); assert.notEqual(guide.action.amount, f.value);
  game = act(game, f.target, guide.action);
  assert.equal(game.stormPending, 3 + Number(guide.action.amount));
  assert.notEqual(game.stormDials[f.target], f.value);
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
});

void test('stale and ineligible original dial questions are rejected without changing state', () => {
  const f = fixture(), declared = declare(f);
  const stale = { kind: 'action', action: { kind: 'stormDial', source: JSON.stringify(['stormDial', 0, f.target]), value: f.value } };
  rejected(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: declared.turn, mixed: stale,
  } });
  rejected(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: declared.turn,
    mixed: { kind: 'action', action: { kind: 'stormDial', source: f.source, value: 21 } },
  } });
  const alreadyDialed = act(f.game, f.target, { type: 'stormDial', amount: 1 });
  const late = declare(f, alreadyDialed);
  rejected(late, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: late.turn, mixed: f.mixed,
  } });
});

void test('two actual Truthtrances bind one dial: Yes A remains compatible with No B but excludes a second conflicting Yes', () => {
  const f = fixture(7), queued = declareTwo(f);
  let game = ask(queued.game, f);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.truthtrance?.stage, 'ask');
  const second = { kind: 'action', action: { kind: 'stormDial', source: f.source, value: 4 } };
  game = ask(game, f, second);
  const answers = viewGame(game, f.target).truthTurnActionAnswers;
  assert.ok(answers?.includes('no')); assert.ok(!answers?.includes('yes'));
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  assert.equal(game.truthtrance, null);
  assert.equal(game.turnActionPromises?.filter(row => row.player === f.target).length, 2);
  rejected(game, f.target, { type: 'stormDial', amount: 4 });
  rejected(game, f.target, { type: 'stormDial', amount: 5 });
  game = act(game, f.target, { type: 'stormDial', amount: 7 });
  assert.equal(game.stormDials[f.target], 7);
  assert.ok(game.turnActionPromises?.filter(row => row.player === f.target).every(row => row.fulfilled));
  assert.equal(game.discard.filter(card => card.id === f.truth || card.id === queued.second).length, 2);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
});

void test('a genuine later Basic Storm cannot accept a whole No that forbids every native dial value', () => {
  const first = fixture();
  // The existing original programme uses real first-turn setup, payment and
  // movement; finish that actual actor, then use only the native continuation.
  let game = act(first.base.game, first.target, { type: 'endMovement' });
  game = advanceTruthMovement(game, state => state.turn === 2 && state.phase === 0);
  assert.equal(game.advanced, false); assert.equal(game.stormPending, null);
  assert.ok(game.stormDialers.includes(first.target));
  assert.ok(game.players.find(player => player.id === first.asker)?.hand.some(card => card.id === first.truth));
  const later = { ...first, game, source: JSON.stringify(['stormDial', 2, first.target]), value: 1,
    mixed: { kind: 'action' as const, action: { kind: 'stormDial' as const,
      source: JSON.stringify(['stormDial', 2, first.target]), value: 1 } } };
  const clauses = [1, 2, 3].map(value => ({ kind: 'action' as const, action: {
    kind: 'stormDial' as const, source: later.source, value,
  } }));
  game = ask(declare(later), later, { kind: 'or', terms: clauses });
  const answers = viewGame(game, later.target).truthTurnActionAnswers;
  assert.ok(answers?.includes('yes')); assert.ok(!answers?.includes('no'));
  rejected(game, later.target, { type: 'truthAnswer', answer: 'no' });
  game = act(game, later.target, { type: 'truthAnswer', answer: 'yes' });
  rejected(game, later.target, { type: 'stormDial', amount: 0 });
  rejected(game, later.target, { type: 'stormDial', amount: 4 });
  const guide = viewGame(game, later.target).turnActionGuide; assert.ok(guide);
  assert.ok([1, 2, 3].includes(Number(guide.action.amount)));
  game = act(game, later.target, guide.action);
  assert.ok([1, 2, 3].includes(game.stormDials[later.target]));
  assert.deepEqual(truthMovementInventory(game), later.base.originalCards);
});

void test('a required dial prevents own Weather Control but a different player can supersede and release it', () => {
  const f = fixture(7);
  const own = sourceWithStormWeather(f, 'target');
  let game = bind(f, 'yes', own.game).game;
  rejected(game, own.player, { type: 'card', card: own.weather, amount: 2 });
  assert.equal(game.stormPending, null);
  assert.ok(game.players.find(player => player.id === own.player)?.hand.some(card => card.id === own.weather));
  game = act(game, f.target, { type: 'stormDial', amount: 7 });
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);

  const foreign = sourceWithStormWeather(f, 'asker');
  game = bind(f, 'yes', foreign.game).game;
  game = act(game, foreign.player, { type: 'card', card: foreign.weather, amount: 2 });
  assert.equal(game.stormPending, 2);
  assert.equal(game.stormMovementSource?.kind, 'weather');
  assert.equal(game.stormDials[f.target], undefined);
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.released);
  assert.equal(game.discard.filter(card => card.id === foreign.weather).length, 1);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
});

void test('foreign Weather leaves an affordable payment alternative active until the actual bribe fulfills it', () => {
  const f = fixture(7), foreign = sourceWithStormWeather(f, 'asker');
  const mixed = { kind: 'or', terms: [f.mixed, { kind: 'action', action: {
    kind: 'payment', recipient: f.asker, minimum: 2,
  } }] };
  let game = ask(declare(f, foreign.game), f, mixed);
  assert.ok(viewGame(game, f.target).truthTurnActionAnswers?.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const payer = game.players.find(player => player.id === f.target),
    recipient = game.players.find(player => player.id === f.asker);
  assert.ok(payer && recipient && payer.spice >= 2); assert.notEqual(payer.ally, f.asker);
  const beforeSpice = payer.spice, beforeBribes = recipient.bribes;
  game = act(game, foreign.player, { type: 'card', card: foreign.weather, amount: 2 });
  assert.equal(game.stormPending, 2); assert.equal(game.stormMovementSource?.kind, 'weather');
  let promise = game.turnActionPromises?.find(row => row.player === f.target); assert.ok(promise);
  assert.equal(promise.released, false); assert.equal(promise.fulfilled, false);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 2 });
  promise = game.turnActionPromises?.find(row => row.player === f.target); assert.ok(promise);
  assert.equal(promise.released, false); assert.equal(promise.fulfilled, true);
  assert.equal(game.players.find(player => player.id === f.target)?.spice, beforeSpice - 2);
  assert.equal(game.players.find(player => player.id === f.asker)?.bribes, beforeBribes + 2);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
});
