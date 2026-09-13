import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { applyAction, viewGame, type Game } from '../game/engine';
import { mentatQuestionGame, mentatReload } from './mentat-question-fixture';

function botView(game: Game, id: string, difficulty: (typeof DIFFICULTIES)[number]) {
  const view = viewGame(game, id);
  view.players.find(player => player.id === id)!.bot = difficulty;
  return view;
}

void test('all profiles name a permitted weapon and show only a permitted physical card using their own private views', () => {
  for (const difficulty of DIFFICULTIES) {
    const game = mentatQuestionGame();
    const named = botActions(botView(game, 'a', difficulty))[0];
    assert.ok(viewGame(game, 'a').mentat!.pending!.weapons.includes(named.weapon as string));
    const question = applyAction(mentatReload(game), 'a', named);
    assert.equal(question.decision?.kind, 'mentatQuestion');
    assert.equal(question.decision?.player, 'd');
    assert.equal(viewGame(question, 'a').mentat!.history.length, 0);
    const response = botActions(botView(question, 'd', difficulty))[0];
    assert.ok(viewGame(question, 'd').mentat!.pending!.cards.some(card => card.id === response.card));
    const shown = applyAction(mentatReload(question), 'd', response);
    assert.equal(shown.decision?.kind, 'leaderSkillVisibility');
    assert.equal(viewGame(shown, 'a').mentat!.history.length, 1);
    assert.deepEqual(shown.players.map(player => player.hand), game.players.map(player => player.hand));
    assert.deepEqual(viewGame(shown, 'o').mentat!.history, []);
  }
});

void test('the naming policy does not depend on hidden opponent cards and nonowners cannot act during either question stage', () => {
  for (const difficulty of DIFFICULTIES) {
    const held = mentatQuestionGame({cards:['Crysknife','Snooper']});
    const absent = mentatQuestionGame({cards:['Chaumas','Shield']});
    const left = botActions(botView(held,'a',difficulty))[0];
    const right = botActions(botView(absent,'a',difficulty))[0];
    assert.equal(left.weapon,right.weapon);
    assert.deepEqual(botActions(botView(held,'d',difficulty)),[]);
    assert.deepEqual(botActions(botView(held,'o',difficulty)),[]);
    assert.ok(held.decision?.kind === 'mentatQuestion');
    const pending = applyAction(held,'a',{type:'decision',event:held.decision.event,weapon:'Crysknife'});
    assert.deepEqual(botActions(botView(pending,'a',difficulty)),[]);
    assert.deepEqual(botActions(botView(pending,'o',difficulty)),[]);
    const response = botActions(botView(pending,'d',difficulty))[0];
    assert.equal(response.card,held.players.find(player => player.id === 'd')!.hand.find(card => card.name === 'Crysknife')!.id);
  }
});
