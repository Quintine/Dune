import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTruthTraitorDecisionFixture as fixture, actTruthTraitorDecision as act,
  truthTraitorDecisionPlayer as player, truthTraitorDecisionInventory as inventory,
  askTruthTraitorDecision as ask } from './fixture-truth-traitor-decision';

function declare(game: Game, asker: string, card: string) {
  game = act(game, asker, { type: 'card', card });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id))
    game = act(game, p.id, { type: 'truthPass' });
  return game;
}

for (const answer of ['yes', 'no'] as const) void test(`native revealed-battle Truthtrance ${answer} binds the actual original Traitor declaration`, () => {
  const f = fixture(); let g = ask(f.game, f.asker, f.truth, f.target);
  assert.deepEqual(viewGame(g, f.target).truthTraitorAnswers, ['no', 'yes']);
  assert.equal(viewGame(g, f.asker).truthTraitorAnswers, null);
  g = act(g, f.target, { type: 'truthAnswer', answer });
  const promises = g.battle!.traitorDecisionPromises; assert.equal(promises?.length, 1);
  assert.deepEqual(viewGame(g, f.target).battle!.traitorCallChoices, [answer === 'yes']);
  const before = structuredClone(g);
  assert.throws(() => act(g, f.target, { type: 'traitorCall', call: answer !== 'yes' }));
  assert.deepEqual(g, before);
  g = act(g, f.target, { type: 'traitorCall', call: answer === 'yes' });
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  assert.equal(g.battle!.traitorCalls[f.target], answer === 'yes');
  g = act(g, f.asker, { type: 'traitorCall', call: false });
  assert.equal(g.battle, null); assert.equal(g.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('an already submitted No cannot be reopened as a future Traitor decision', () => {
  const f = fixture(); let g = act(f.game, f.target, { type: 'traitorCall', call: false });
  assert.ok(!viewGame(g, f.asker).truthTraitorTargets.includes(f.target));
  g = declare(g, f.asker, f.truth);
  const before = structuredClone(g);
  assert.throws(() => act(g, f.asker, { type: 'truthAsk', question: { kind: 'traitorCall', target: f.target,
    battle: g.battle!.event, territory: g.battle!.territory } }), /unsubmitted/);
  assert.deepEqual(g, before); assert.equal(g.battle!.traitorCalls[f.target], false);
  assert.ok(player(g, f.asker).hand.some(card => card.id === f.truth));
});

void test('unrevealed plans cannot be queried as a current Traitor decision', () => {
  const f = fixture(), g = declare(f.beforeReveal, f.asker, f.truth), before = structuredClone(g);
  assert.throws(() => act(g, f.asker, { type: 'truthAsk', question: { kind: 'traitorCall', target: f.target,
    battle: g.battle!.event, territory: g.battle!.territory } }), /revealed battle/);
  assert.deepEqual(g, before);
});

void test('controlled original Traitor exchange offers only No when the revealed opposing identity is absent', () => {
  const f = fixture(), source = structuredClone(f.game), target = player(source, f.target);
  // Conserved original-card exchange isolates native inability; not a claimed
  // actual exchange action or native source provenance for this changed hand.
  const at = source.traitorReserve!.findIndex(id => id !== f.traitorHeld); assert.ok(at >= 0);
  const held = target.traitors.indexOf(f.traitorHeld); assert.ok(held >= 0);
  [target.traitors[held], source.traitorReserve![at]] = [source.traitorReserve![at], target.traitors[held]];
  const g = ask(source, f.asker, f.truth, f.target);
  assert.deepEqual(viewGame(g, f.target).truthTraitorAnswers, ['no']);
  assert.throws(() => act(g, f.target, { type: 'truthAnswer', answer: 'yes' }));
});

void test('all four minimal policies honor both native Yes and No declaration promises', () => {
  const f = fixture();
  for (const answer of ['yes', 'no'] as const) for (const difficulty of DIFFICULTIES) {
    let g = ask(f.game, f.asker, f.truth, f.target);
    g = act(g, f.target, { type: 'truthAnswer', answer });
    const view = viewGame(g, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const choice = botActions(view)[0]; assert.ok(choice);
    assert.deepEqual(choice, { type: 'traitorCall', call: answer === 'yes' });
    g = act(g, f.target, choice); assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  }
});

void test('all four minimal policies answer the native current-decision question then declare legally', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    let g = ask(f.game, f.asker, f.truth, f.target);
    const answerView = viewGame(g, f.target); answerView.players.find(p => p.id === f.target)!.bot = difficulty;
    const answer = botActions(answerView)[0]; assert.equal(answer?.type, 'truthAnswer');
    g = act(g, f.target, answer);
    const callView = viewGame(g, f.target); callView.players.find(p => p.id === f.target)!.bot = difficulty;
    g = act(g, f.target, botActions(callView)[0]);
    assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  }
});
