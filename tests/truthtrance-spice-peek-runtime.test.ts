import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { knowledgeGame, knowledgeBotActions, askKnowledge, knowledgePhysical, rejectKnowledge } from './truthtrance-knowledge-fixture';

/** Native setup and phase progression; only the holder's Truthtrance acquisition
 * is staged by knowledgeGame, with each physical card retained exactly once. */
function withPeek(advanced = false) {
  let g = knowledgeGame(advanced);
  for (let n = 0; n < 300 && !(g.phase === 5 && g.spicePeekKnown && !g.response && !g.phaseOpening); n++) {
    const candidate = g.players.flatMap(player => knowledgeBotActions(g, player.id)
      .map(action => ({ id: player.id, action })))[0];
    assert.ok(candidate, `Native progression needs a legal decision in phase ${g.phase}`);
    g = applyAction(g, candidate.id, candidate.action);
  }
  assert.equal(g.phase, 5);
  assert.equal(g.spicePeekKnown, true);
  assert.ok(g.spiceDeck[0]);
  return g;
}

void test('actual Atreides peek supplies a private Truthtrance answer and native AI continuation', () => {
  for (const advanced of [false, true]) {
    const initial = withPeek(advanced);
    const card = initial.spiceDeck[0];
    const value = 'territory' in card ? card.territory : 'worm' in card ? 'worm' : 'sandtrout';
    const question = { kind: 'spicePeek' as const, value };
    const g = askKnowledge(initial, 'o', question);
    assert.equal(viewGame(g, 'o').truthAnswer, 'yes');
    assert.deepEqual(viewGame(g, 'o').spicePeek, card);
    for (const id of ['a', 'b', 'f']) {
      assert.equal(viewGame(g, id).truthAnswer, null);
      assert.equal(viewGame(g, id).spicePeek, null);
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
      assert.deepEqual(done.spiceDeck[0], card);
      assert.deepEqual(knowledgePhysical(done), knowledgePhysical(initial));
    }
  }
});

void test('a canceled peek yields unknown and retains the physical Truthtrance', () => {
  const initial = withPeek();
  initial.spicePeekKnown = false;
  const g = askKnowledge(initial, 'o', { kind: 'spicePeek', value: 'worm' });
  assert.equal(viewGame(g, 'o').truthAnswer, 'unknown');
  rejectKnowledge(g, 'o', { type: 'truthAnswer', answer: 'yes' });
  const done = applyAction(g, 'o', { type: 'truthAnswer', answer: 'unknown' });
  assert.equal(done.truthtrance?.stage, 'unknown');
  assert.deepEqual(knowledgePhysical(done), knowledgePhysical(initial));
});
