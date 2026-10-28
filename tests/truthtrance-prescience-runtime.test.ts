import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { KnowledgeFact } from '../game/truthtrance-knowledge';
import {
  actTruthTurnPower, advanceTruthTurnPower, createTruthTurnPowerFixture,
  declareTruthTurnPower, finishTruthTurnPowerBattle, truthTurnPowerInventory,
  truthTurnPowerPlayer,
} from './fixture-truth-turn-power';

/** Reach the original Basic battle through real setup, bidding and shipment,
 * then actually declare and resolve the selected Prescience power. The source
 * fixture selects unopened deck order but does not stage hands or combatants. */
function inspected(field: 'leader' | 'weapon' | 'defense' | 'dial') {
  const fixture = createTruthTurnPowerFixture({ power: 'prescience' });
  let game = actTruthTurnPower(fixture.game, fixture.atreides, { type: 'prescience', field });
  game = advanceTruthTurnPower(game, state => !state.response &&
    state.battle?.preparation?.kind === 'prescienceAnswer', [], true);
  const respondent = game.battle!.preparation!.owner;
  const subject = truthTurnPowerPlayer(game, respondent);
  const leader = subject.leaders.find(item => !item.dead && !item.usedAt);
  const weapon = subject.hand.find(item => item.kind === 'projectile');
  assert.ok(leader); assert.ok(weapon);
  const value = field === 'leader' ? leader.id : field === 'weapon' ? weapon.id :
    field === 'defense' ? null : 0;
  const name = field === 'leader' ? leader.name : field === 'weapon' ? weapon.name : 'None';
  game = actTruthTurnPower(game, respondent, { type: 'prescienceAnswer', value });
  assert.equal(game.battle?.prescience?.player, fixture.atreides);
  assert.equal(game.battle?.prescience?.value, value);
  return { fixture, game, respondent, name };
}

function ask(fixture: ReturnType<typeof createTruthTurnPowerFixture>, source: Game, fact: KnowledgeFact) {
  const declared = declareTruthTurnPower(fixture, source).game;
  return actTruthTurnPower(declared, fixture.asker, { type: 'truthAsk',
    question: { kind: 'fact', target: fixture.atreides, fact } });
}

for (const field of ['leader', 'weapon', 'defense', 'dial'] as const) {
  void test(`Basic native ${field} Prescience supports an actual truthful question and battle continuation`, () => {
    const { fixture, game: source, name } = inspected(field);
    const fact: KnowledgeFact = field === 'dial'
      ? { kind: 'presciencePeek', field, value: 0 }
      : { kind: 'presciencePeek', field, name };
    const asked = ask(fixture, source, fact);
    assert.equal(viewGame(asked, fixture.atreides).truthAnswer, 'yes');
    assert.equal(viewGame(asked, fixture.asker).truthAnswer, null);
    assert.equal(viewGame(asked, fixture.asker).battle?.insight, null);
    assert.throws(() => applyAction(asked, fixture.atreides, { type: 'truthAnswer', answer: 'no' }));
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(asked, fixture.atreides);
      view.players.find(player => player.id === fixture.atreides)!.bot = difficulty;
      const actions = botActions(view);
      assert.deepEqual(actions, [{ type: 'truthAnswer', answer: 'yes' }]);
      const done = applyAction(asked, fixture.atreides, actions[0]);
      assert.equal(done.truthHistory?.at(-1)?.answer, 'yes');
      assert.equal(done.truthtrance, null);
      assert.deepEqual(truthTurnPowerInventory(done), fixture.originalCards);
    }
    const answered = applyAction(asked, fixture.atreides, { type: 'truthAnswer', answer: 'yes' });
    const settled = finishTruthTurnPowerBattle(answered, fixture);
    assert.notEqual(settled.battle?.event, fixture.event);
    assert.deepEqual(truthTurnPowerInventory(settled), fixture.originalCards);
  });
}

void test('a different, uninspected element remains unknown in a real battle', () => {
  const { fixture, game } = inspected('dial');
  const asked = ask(fixture, game, { kind: 'presciencePeek', field: 'weapon', name: 'None' });
  assert.equal(viewGame(asked, fixture.atreides).truthAnswer, 'unknown');
  assert.throws(() => applyAction(asked, fixture.atreides, { type: 'truthAnswer', answer: 'yes' }));
  const answered = applyAction(asked, fixture.atreides, { type: 'truthAnswer', answer: 'unknown' });
  assert.equal(answered.truthtrance?.stage, 'unknown');
  assert.deepEqual(truthTurnPowerInventory(answered), fixture.originalCards);
});
