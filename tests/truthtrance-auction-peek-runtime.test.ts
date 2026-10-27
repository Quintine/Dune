import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { knowledgeGame, knowledgeBotActions, askKnowledge, knowledgePhysical, rejectKnowledge } from './truthtrance-knowledge-fixture';

/** Real setup and ordinary auction progression. The fixture stages only the
 * holder's acquisition of the two physical Truthtrance cards. */
function withInspection(advanced = false) {
  let g = knowledgeGame(advanced);
  for (let n = 0; n < 200 && !(g.phase === 3 && g.auction?.peekKnown && !g.response && !g.phaseOpening); n++) {
    const candidate = g.players.flatMap(player => knowledgeBotActions(g, player.id)
      .map(action => ({ id: player.id, action })))[0];
    assert.ok(candidate, `Native auction progression needs a legal decision in phase ${g.phase}`);
    g = applyAction(g, candidate.id, candidate.action);
  }
  assert.equal(g.phase, 3);
  assert.equal(g.auction?.peekKnown, true);
  assert.ok(g.auction?.cards[g.auction.index]);
  return g;
}

void test('actual ordinary auction inspection supplies a private Truthtrance answer for all AI profiles', () => {
  for (const advanced of [false, true]) {
    const initial = withInspection(advanced);
    const card = initial.auction!.cards[initial.auction!.index];
    const g = askKnowledge(initial, 'o', { kind: 'auctionPeek', name: card.name });
    assert.equal(viewGame(g, 'o').truthAnswer, 'yes');
    assert.equal(viewGame(g, 'o').auction?.card?.id, card.id);
    for (const id of ['a', 'b', 'f']) {
      assert.equal(viewGame(g, id).truthAnswer, null);
      assert.equal(viewGame(g, id).auction?.card, null);
    }
    rejectKnowledge(g, 'o', { type: 'truthAnswer', answer: 'no' });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(g, 'o');
      view.players.find(player => player.id === 'o')!.bot = difficulty;
      const actions = botActions(view);
      assert.deepEqual(actions, [{ type: 'truthAnswer', answer: 'yes' }]);
      const done = applyAction(g, 'o', actions[0]);
      assert.equal(done.truthtrance, null);
      assert.equal(done.truthHistory!.at(-1)!.answer, 'yes');
      assert.equal(done.auction!.cards[done.auction!.index].id, card.id);
      assert.deepEqual(knowledgePhysical(done), knowledgePhysical(initial));
    }
  }
});

void test('an unavailable auction inspection yields unknown and retains the physical card', () => {
  const initial = withInspection();
  initial.auction!.peekKnown = false;
  const name = initial.auction!.cards[initial.auction!.index].name;
  const g = askKnowledge(initial, 'o', { kind: 'auctionPeek', name });
  assert.equal(viewGame(g, 'o').truthAnswer, 'unknown');
  rejectKnowledge(g, 'o', { type: 'truthAnswer', answer: 'yes' });
  const done = applyAction(g, 'o', { type: 'truthAnswer', answer: 'unknown' });
  assert.equal(done.truthtrance?.stage, 'unknown');
  assert.deepEqual(knowledgePhysical(done), knowledgePhysical(initial));
});
