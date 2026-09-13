import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { botBattleChoices } from '../game/bot-battle-choices';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { saphoBattleOrderGame } from './fixture-sapho-battle-order';

function choices(game: Game, owner: string, level: Difficulty) {
  const view = viewGame(game, owner);
  view.players.find(player => player.id === owner)!.bot = level;
  const before = JSON.stringify(view);
  const actions = botActions(view);
  assert.equal(JSON.stringify(view), before, 'policy leaves its private projection unchanged');
  return actions;
}

void test('all four profiles use battle first and choose the actual opponent from either stable slot', () => {
  for (const advanced of [false, true]) for (const level of DIFFICULTIES) {
    const game = saphoBattleOrderGame({ advanced, holder: 'c', geometry: 'shared' });
    const actions = choices(game, 'c', level);
    const card = actions.find(action => action.card === 'richese-juice-of-sapho');
    assert.ok(card, `${level}: offered card action`);
    assert.equal(card.scope, 'battleOrder');
    assert.equal(card.mode, 'first');
    const ordered = applyAction(game, 'c', card);
    assert.equal(ordered.active, 'c');
    const plans = botBattleChoices(viewGame(ordered, 'c'));
    assert.ok(plans.some(action => action.target === 'a'));
    assert.ok(plans.every(action => action.target !== 'c'));
    for (const action of plans) {
      const next = applyAction(ordered, 'c', action);
      assert.equal(next.battle?.territory, action.territory);
      assert.equal(next.battle?.defender, 'c');
      assert.equal(next.battle?.attacker, action.target);
    }
    const botPlans = choices(ordered, 'c', level).filter(action => action.type === 'chooseBattle');
    assert.deepEqual(botPlans, plans);
  }
});

void test('all profiles can move the first chooser last without changing physical storm order', () => {
  for (const advanced of [false, true]) for (const level of DIFFICULTIES) {
    const game = saphoBattleOrderGame({ advanced, holder: 'a', geometry: 'shared' });
    const action = choices(game, 'a', level).find(action => action.card === 'richese-juice-of-sapho');
    assert.ok(action);
    assert.equal(action.scope, 'battleOrder');
    assert.equal(action.mode, 'last');
    const next = applyAction(game, 'a', action);
    assert.deepEqual(next.order, game.order);
    assert.notEqual(next.active, 'a');
    assert.deepEqual(botBattleChoices(viewGame(next, 'a')), []);
    assert.equal(next.discard.filter(card => card.id === 'richese-juice-of-sapho').length, 1);
  }
});

void test('Sapho scheduling policy cannot inspect another seat’s concealed cards or resources', () => {
  const game = saphoBattleOrderGame({ advanced: true, holder: 'c', geometry: 'shared' });
  for (const level of DIFFICULTIES) {
    const view = viewGame(game, 'c');
    view.players.find(player => player.id === 'c')!.bot = level;
    const expected = botActions(view);
    for (const other of view.players.filter(player => player.id !== 'c'))
      for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
        Object.defineProperty(other, field, { get() { throw new Error(`Unauthorized ${field}`); } });
    assert.deepEqual(botActions(view), expected);
  }
});
