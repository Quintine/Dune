import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import { quoteHarassWithdraw } from '../game/harass-withdraw';
import { harassWithdrawGame, harassCustody, takeHarassCard } from './fixture-harass-withdraw';

function projection(game: Game, profile: Difficulty) {
  const view = viewGame(game, 'a');
  view.players.find(player => player.id === 'a')!.bot = profile;
  return view;
}
const usesHarass = (action: Action) =>
  action.weapon === 'ecaz-harass-withdraw' || action.defense === 'ecaz-harass-withdraw';

void test('each AI profile can commit Harass in either slot through genuine Basic and Advanced battle setup', () => {
  for (const advanced of [false, true]) for (const profile of DIFFICULTIES) {
    const game = harassWithdrawGame({ advanced });
    const view = projection(game, profile), before = structuredClone(view);
    const candidates = botActions(view).filter(action => action.type === 'battlePlan' && usesHarass(action));
    assert.deepEqual(view, before);
    assert.ok(candidates.length, `${profile}/${advanced} omitted Harass`);
    for (const slot of ['weapon', 'defense'] as const) {
      const action = candidates.find(action => action[slot] === 'ecaz-harass-withdraw');
      assert.ok(action, `${profile}/${advanced} omitted ${slot}`);
      quoteHarassWithdraw(view.battle!.harassWithdraw!, Number(action.dial), Number(action.support ?? 0));
      const sealed = applyAction(game, 'a', action);
      assert.equal(sealed.battle!.plans.a[slot], 'ecaz-harass-withdraw');
      harassCustody(sealed);
    }
    assert.ok(candidates.every(action => action.weapon !== 'ecaz-reinforcements' && action.defense !== 'ecaz-reinforcements'));
  }
});

void test('all profiles answer category inspections without revealing Harass and can keep it in a committed empty-category slot', () => {
  for (const profile of DIFFICULTIES) {
    let game = harassWithdrawGame({ prepare: false });
    for (let step = 0; game.response && step < 10; step++) {
      const id = game.players.find(player => !game.response!.passed.includes(player.id))!.id;
      game = applyAction(game, id, { type: 'passResponse' });
    }
    assert.equal(game.battle!.preparation?.kind, 'prescience');
    game = applyAction(game, 'd', { type: 'prescience', field: 'weapon' });
    const answers = botActions(projection(game, profile));
    assert.ok(answers.length);
    assert.ok(answers.every(action => action.type === 'prescienceAnswer' && action.value === null));
    game = applyAction(game, 'a', answers[0]);
    const view = projection(game, profile);
    const action = botActions(view).find(action => action.type === 'battlePlan' && action.weapon === 'ecaz-harass-withdraw');
    assert.ok(action, `${profile} erased the inspected slot occupant`);
    const sealed = applyAction(game, 'a', action);
    assert.equal(sealed.battle!.prescience!.value, null);
    assert.equal(viewGame(sealed, 'd').battle!.insight!.value, null);
    assert.equal(viewGame(sealed, 't').battle!.harassWithdraw, null);
    harassCustody(sealed);
  }
});

void test('hidden opponent card swaps leave the Harass planner input and actions identical', () => {
  const game = harassWithdrawGame();
  takeHarassCard(game, 'd', baseDeck()[0].id);
  takeHarassCard(game, 't', baseDeck()[1].id);
  const changed = structuredClone(game);
  [changed.players[1].hand[0], changed.players[2].hand[0]] = [changed.players[2].hand[0], changed.players[1].hand[0]];
  for (const profile of DIFFICULTIES) {
    const before = projection(game, profile), after = projection(changed, profile);
    assert.deepEqual(after, before);
    assert.deepEqual(botActions(after), botActions(before));
  }
  harassCustody(changed);
});

void test('the planner excludes a publicly blocked Harass module without reading opposing holdings', () => {
  const game = harassWithdrawGame();
  for (const profile of DIFFICULTIES) {
    const view = projection(game, profile);
    view.battle!.harassWithdraw = { ...view.battle!.harassWithdraw!, blocked: 'This configured card combination awaits a ruling.' };
    const actions = botActions(view);
    assert.ok(actions.length);
    assert.ok(actions.every(action => !usesHarass(action)));
  }
});
