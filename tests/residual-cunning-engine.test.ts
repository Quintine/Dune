import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actResidualCunning, createResidualCunningFixture, finishResidualCunning,
  playResidualCunning, residualCunningInventory, residualCunningPhysical,
  residualCunningPlayer as player, type ResidualCunningFixture,
} from './fixture-residual-cunning';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actResidualCunning(game, actor, action));
  assert.deepEqual(game, before);
}
function source(f: ResidualCunningFixture) {
  assert.equal(f.game.status, 'playing');
  assert.equal(f.game.turn, 2);
  assert.equal(f.game.phase, 6);
  assert.equal(f.game.response ?? null, null);
  assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.game.battle!.event, f.event);
  assert.deepEqual(f.game.battle!.plans, {});
  assert.equal(f.game.battle!.preparation ?? null, null);
  assert.equal(f.game.battle!.preLeader!.closed, true);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.card));
  assert.equal(f.acquisition.before.richeseCache!.filter(card => card.id === f.card).length, 1);
  assert.ok(f.acquisition.actions.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(f.beforeDraw.nexusCards!.cards!.hands[f.holder], null);
  assert.equal(f.afterDraw.nexusCards!.cards!.hands[f.holder], 'atreides');
  assert.ok(f.drawActions.some(step => step.actor === f.holder && step.action.type === 'nexusCardChoice' &&
    step.action.choice === 'draw' && step.action.ownRedraws === 0));
  assert.equal(player(f.game, f.holder).ally, null);
  assert.equal(player(f.game, 'e').ally, 'g');
  assert.equal(player(f.game, 'g').ally, 'e');
  assert.equal(f.game.nexusCards!.cards!.hands[f.holder], null);
  assert.equal(f.game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.equal(f.shipment.actor, f.target);
  assert.equal(f.shipment.action.amount, 1);
  assert.equal(player(f.afterShipment, f.target).reserves, player(f.beforeShipment, f.target).reserves - 1);
  assert.equal(player(f.game, f.target).forces['arrakeen:10'], 1);
  assert.equal(player(f.game, f.holder).forces['arrakeen:10'], 10);
  assert.equal(f.originalPrescience!.field, 'dial');
  assert.equal(f.originalPrescience!.value, 0);
  assert.equal(f.originalInspection!.mode, 'cunning');
  assert.equal(f.originalInspection!.stage, 'answered');
  assert.equal(f.originalInspection!.field, 'weapon');
  assert.deepEqual(f.originalInspection!.answers, [null]);
  assert.equal(f.originalLeaders.filter(leader => !leader.dead).length, 5);
  assert.equal(viewGame(f.game, f.holder).residualPoison!.blocked, null);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(residualCunningInventory(f.game), f.originalInventory);
}
function poisonOutcome(f: ResidualCunningFixture, game: Game) {
  assert.equal(game.battle!.event, f.event);
  assert.deepEqual(game.battle!.plans, {});
  assert.deepEqual(game.battle!.prescience, f.originalPrescience);
  assert.deepEqual(game.battle!.nexusInspection, f.originalInspection,
    'Both feasible answers and the original signed Cunning history survive the actual death');
  assert.equal(game.battle!.preparation ?? null, null);
  assert.deepEqual(residualCunningPhysical(game), f.originalPhysical, 'No bounty, force loss, movement or payment is introduced');
  const changed = player(game, f.target).leaders.filter(leader => {
    const before = f.originalLeaders.find(original => original.id === leader.id)!;
    return leader.dead !== before.dead || leader.deaths !== before.deaths;
  });
  assert.equal(changed.length, 1);
  const victim = changed[0], before = f.originalLeaders.find(leader => leader.id === victim.id)!;
  assert.equal(before.dead, false);
  assert.equal(victim.dead, true);
  assert.equal(victim.deaths, before.deaths + 1);
  for (const leader of player(game, f.target).leaders.filter(leader => leader.id !== victim.id))
    assert.deepEqual(leader, f.originalLeaders.find(original => original.id === leader.id));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), false);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.deepEqual(residualCunningInventory(game), f.originalInventory);
  return victim;
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} genuine Residual after answered Cunning preserves both answers and completes the actual battle`, () => {
    const f = createResidualCunningFixture({ advanced });
    source(f);
    const poisoned = playResidualCunning(f), victim = poisonOutcome(f, poisoned);
    rejected(poisoned, f.holder, f.action);
    assert.equal(player(poisoned, f.target).leaders.find(leader => leader.id === victim.id)!.deaths, victim.deaths);
    const completed = finishResidualCunning(f, poisoned);
    assert.equal(completed.plans[0].actor, f.target);
    assert.notEqual(completed.plans[0].action.leader, victim.id);
    assert.equal(completed.plans[0].action.dial, 0);
    assert.equal(completed.plans[0].action.weapon, undefined);
    assert.deepEqual(completed.sealed.battle!.prescience, f.originalPrescience);
    assert.deepEqual(completed.sealed.battle!.nexusInspection, f.originalInspection);
    assert.equal(completed.game.battle, null);
    assert.equal(completed.game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(completed.game, f.target).leaders.find(leader => leader.id === victim.id)!.deaths, victim.deaths);
    assert.equal(player(completed.game, f.target).leaders.filter(leader => leader.dead).length, 1);
    assert.equal(completed.game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
    assert.deepEqual(residualCunningInventory(completed.game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} genuine Residual Cunning source rejects stale and foreign use without a death or discard`, () => {
    const f = createResidualCunningFixture({ advanced });
    source(f);
    rejected(f.game, f.target, f.action);
    rejected(f.game, 'g', f.action);
    rejected(f.game, f.holder, { ...f.action, event: 'stale' });
    rejected(f.game, f.holder, { ...f.action, target: 'e' });
    assert.deepEqual(player(f.game, f.target).leaders, f.originalLeaders);
    assert.deepEqual(f.game.battle!.nexusInspection, f.originalInspection);
    assert.deepEqual(residualCunningPhysical(f.game), f.originalPhysical);
    assert.equal(f.game.discard.some(card => card.id === f.card), false);
    assert.deepEqual(residualCunningInventory(f.game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} actual leader commitment closes the earned Residual Cunning window for either combatant`, () => {
    const f = createResidualCunningFixture({ advanced });
    source(f);
    for (const actor of [f.holder, f.target]) {
      const leader = player(f.game, actor).leaders.find(leader => !leader.dead && !leader.usedAt);
      assert.ok(leader);
      const game = actResidualCunning(structuredClone(f.game), actor,
        { type: 'battlePlan', leader: leader.id, dial: 0, support: 0 });
      assert.ok(game.battle!.plans[actor]);
      assert.match(viewGame(game, f.holder).residualPoison!.blocked!, /leader/i);
      rejected(game, f.holder, f.action);
      assert.deepEqual(player(game, f.target).leaders, f.originalLeaders);
      assert.equal(game.discard.some(card => card.id === f.card), false);
      assert.deepEqual(residualCunningInventory(game), f.originalInventory);
    }
  });
}

void test('four minimal profiles legally play the actually purchased Residual after native and Cunning answers', () => {
  for (const advanced of [false, true]) {
    const f = createResidualCunningFixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.holder);
      view.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.deepEqual(action, f.action, `${advanced}/${difficulty}`);
      const game = actResidualCunning(structuredClone(f.game), f.holder, action);
      poisonOutcome(f, game);
    }
  }
});
