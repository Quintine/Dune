import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { windowCardOpportunity } from '../game/window-card-play';
import { truthTurnPowerInventory, truthTurnPowerPlayer } from './fixture-truth-turn-power';
import {
  actResponseCancel as act, askResponseCancel as ask, bindResponseCancel as bind,
  createResponseCancelFixture as fixture, declareResponseCancel as declare,
  responseCancelFact as fact, responseCancelPlay as play, type ResponseCancelFixture,
} from './fixture-truth-turn-response-cancel';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
function receipt(game: Game, f: ResponseCancelFixture) {
  const row = game.turnActionPromises?.find(promise => promise.player === f.target);
  assert.ok(row); const stage = row.windowCards?.karamaBattleCancel; assert.ok(stage);
  return { row, stage };
}
function physical(game: Game, f: ResponseCancelFixture) {
  assert.deepEqual(truthTurnPowerInventory(game), f.base.originalCards);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
}

void test('current native Voice and Prescience responses accept a printed cancellation Yes and record the original physical cost once', () => {
  for (const power of ['voice', 'prescience'] as const) {
    const f = fixture(power);
    const window = windowCardOpportunity(f.game, 'karamaBattleCancel');
    assert.equal(window?.source, f.source);
    const declared = declare(f), asked = ask(declared, f);
    assert.ok(viewGame(asked, f.target).truthTurnActionAnswers?.includes('yes'));
    let game = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.equal(game.response?.kind, power);
    assert.deepEqual(receipt(game, f).stage, { source: f.source, played: false, closed: false });
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'card'); assert.equal(guide.action.mode, 'cancel');
    assert.equal(guide.action.card, f.karama);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.target);
      view.players.find(player => player.id === f.target)!.bot = difficulty;
      assert.deepEqual(botActions(view)[0], guide.action);
    }
    game = act(game, f.target, guide.action);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.battle?.[power], undefined);
    assert.equal(receipt(game, f).stage.played, true);
    assert.equal(receipt(game, f).row.fulfilled, true);
    assert.ok(truthTurnPowerPlayer(game, f.asker).hand.some(card => card.id === f.secondKarama));
    physical(game, f);
  }
});

void test('No blocks the exact printed cancellation while retaining the original response and other player choice', () => {
  for (const power of ['voice', 'prescience'] as const) {
    const f = fixture(power); let game = bind(f, 'no').game;
    assert.equal(game.response?.kind, power);
    const view = viewGame(game, f.target);
    assert.ok(!view.responseControls?.cancelCards.includes(f.karama));
    for (const difficulty of DIFFICULTIES) {
      const bot = viewGame(game, f.target);
      bot.players.find(player => player.id === f.target)!.bot = difficulty;
      assert.ok(!botActions(bot).some(action => action.type === 'card' && action.card === f.karama && action.mode === 'cancel'));
    }
    rejected(game, f.target, f.cancel);
    assert.ok(truthTurnPowerPlayer(game, f.target).hand.some(card => card.id === f.karama));
    game = act(game, f.asker, { type: 'passResponse' });
    if (game.response && !game.response.passed.includes(f.target))
      game = act(game, f.target, { type: 'passResponse' });
    assert.equal(game.response, null);
    assert.equal(receipt(game, f).stage.played, false);
    assert.equal(receipt(game, f).stage.closed, true);
    assert.equal(receipt(game, f).row.fulfilled, true);
    assert.ok(game.battle?.[power]);
    physical(game, f);
  }
});

void test('a Yes may pass while another participant remains, but cannot voluntarily close its last actual opportunity', () => {
  for (const power of ['voice', 'prescience'] as const) {
    const f = fixture(power), bound = bind(f, 'yes').game;
    let passed = act(bound, f.target, { type: 'passResponse' });
    assert.ok(passed.response?.passed.includes(f.target));
    passed = act(passed, f.target, f.cancel);
    assert.equal(receipt(passed, f).row.fulfilled, true);
    let last = act(bound, f.asker, { type: 'passResponse' });
    assert.equal(last.response?.kind, power);
    rejected(last, f.target, { type: 'passResponse' });
    last = act(last, f.target, f.cancel);
    assert.equal(receipt(last, f).row.fulfilled, true);
    physical(last, f);
  }
});

void test('another player cancelling the same original power releases an unmet Yes without spending the respondent card', () => {
  for (const power of ['voice', 'prescience'] as const) {
    const f = fixture(power); let game = bind(f, 'yes').game;
    game = act(game, f.asker, f.foreignCancel);
    assert.equal(game.battle?.[power], undefined);
    assert.equal(game.discard.filter(card => card.id === f.secondKarama).length, 1);
    assert.ok(truthTurnPowerPlayer(game, f.target).hand.some(card => card.id === f.karama));
    assert.equal(receipt(game, f).stage.played, false);
    assert.equal(receipt(game, f).stage.closed, true);
    assert.equal(receipt(game, f).row.released, true);
    physical(game, f);
  }
});

void test('current facts may combine with this exact response, while stale sources, the power owner and unrelated actions are rejected', () => {
  const f = fixture('voice'), declared = declare(f);
  const stale = play(JSON.stringify(['karamaBattleCancel', declared.turn, 'other-battle', f.base.territory, f.power, f.owner]));
  rejected(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: declared.turn, mixed: stale,
  } });
  rejected(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.owner, turn: declared.turn, mixed: f.mixed,
  } });
  rejected(declared, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: declared.turn,
    mixed: { kind: 'action', action: { kind: 'payment', recipient: f.asker, minimum: 1 } },
  } });
  const mixed = { kind: 'and' as const, terms: [
    fact({ kind: 'spice', compare: 'gte', value: 0 }), f.mixed,
  ] };
  const asked = ask(declared, f, mixed);
  assert.ok(viewGame(asked, f.target).truthTurnActionAnswers?.includes('yes'));
});
