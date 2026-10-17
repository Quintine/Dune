import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  createE3IndependentNexusOccupyFixture, e3IndependentNexusOccupyClean,
  e3IndependentNexusOccupyPlayer as player, quoteE3IndependentNexusOccupy,
  revealE3IndependentNexusOccupy, settleE3IndependentNexusOccupy,
} from './fixture-e3-independent-nexus-occupy';

for (const modules of [false, true]) for (const lead of ['ecaz', 'ally'] as const) {
  void test(`original ${modules ? 'all-family World/all14/phase' : 'Ecaz'} independent Nexus ${lead} Occupy lead pays only its own fee and typed undialed return`, () => {
    const f = createE3IndependentNexusOccupyFixture({ lead,
      expansions: modules ? ['ix', 'choam', 'ecaz'] : ['ecaz'],
      homeworlds: modules, skills: modules, tech: modules, strongholds: modules });
    const beforeEcaz = player(f.game, 'ecaz'), beforeAlly = player(f.game, 'emperor'), beforeEnemy = player(f.game, 'guild');
    const originalEcaz = Object.fromEntries(Object.entries(player(f.afterSetup, 'ecaz').forces)
      .filter(([key]) => key.startsWith('imperial_basin:')));
    assert.equal(Object.values(originalEcaz).reduce((sum, count) => sum + count, 0), 6);
    assert.equal(f.shipments.length, 3);
    assert.deepEqual(f.shipments.map(shipment => [shipment.step.actor, shipment.step.action.amount, shipment.step.action.elite])
      .sort(([one], [two]) => String(one).localeCompare(String(two))),
    [['ecaz', 5, 0], ['emperor', 5, 2], ['guild', 3, 0]]);
    assert.equal(f.purchases.length, 2);
    assert.ok(f.purchases.every(purchase => purchase.step.actor === f.cardUser && purchase.step.action.amount === 1));
    assert.equal(f.beforeAlliance.turn, 2);
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands.guild, 'guild');
    assert.equal(f.drawStep.action.type, 'nexusCardChoice');
    assert.equal(player(f.afterNexusDraw, 'ecaz').ally, 'emperor');
    assert.equal(player(f.afterNexusDraw, 'emperor').ally, 'ecaz');
    assert.equal(player(f.afterNexusDraw, 'guild').ally, null);
    assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
    assert.equal(f.leadStep.action.lead, f.cardUser);
    assert.deepEqual([f.profile.planOwner, f.profile.payer, f.profile.forceOwner], [f.cardUser, f.cardUser, 'emperor']);
    assert.deepEqual([f.profile.ecazForces.normal, f.profile.ecazForces.elite], [5, 0]);
    assert.deepEqual([f.profile.forces.normal, f.profile.forces.elite], [3, 2]);
    assert.equal(f.profile.fixedEcazDial, 3);
    assert.equal(f.plans[0].action.dial, 5);
    assert.equal(f.support, modules ? 0 : 1, 'Actual high Salusa supports the real stars; ordinary Advanced uses one paid star');
    assert.ok(player(f.game, f.cardUser).hand.some(card => card.id === REINFORCEMENTS_CARD));
    assert.ok(player(f.game, f.cardUser).hand.some(card => card.id === HARASS_WITHDRAW_CARD));
    if (modules) {
      assert.ok(f.plans[0].action.reinforcementsSources);
      assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, 'ecaz');
    }

    const revealed = revealE3IndependentNexusOccupy(f.game, f.plans, f.actions);
    const quote = quoteE3IndependentNexusOccupy(revealed, f.cardUser, f.returns);
    assert.equal(quote.result, 'normal');
    assert.equal(quote.winner, f.cardUser);
    assert.deepEqual(quote.reinforcements, [{ player: f.cardUser, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.fixedLosses, [{ owner: 'ecaz', normal: 3, elite: 0 }]);
    assert.equal(quote.casualties!.owner, 'emperor');
    assert.equal(quote.casualties!.dial, 2, 'The original fixed contribution and score bonus do not enter the variable physical dial');
    assert.ok(quote.casualties!.options.some(loss => loss.normal === 0 && loss.elite === 1));
    const withdrawal = quote.harassWithdraw!.find(entry => entry.player === f.cardUser)!;
    assert.deepEqual(withdrawal.returned, lead === 'ecaz' ? { normal: 2, elite: 0 } : { normal: 3, elite: 1 });
    assert.deepEqual(withdrawal.locations, f.returns);
    assert.deepEqual([withdrawal.remaining.normal, withdrawal.remaining.elite], lead === 'ecaz' ? [3, 0] : [0, 1]);
    const plan = revealed.battle!.plans[f.cardUser];
    const leader = player(revealed, f.cardUser).leaders.find(leader => leader.id === plan.leader)!;
    const side = revealed.battle!.attacker === f.cardUser ? 'attacker' : 'defender';
    assert.equal(quote.scores![side], leader.strength + 5 + 2, 'Reinforcements contributes exactly two normal-score points');

    const game = settleE3IndependentNexusOccupy(revealed, f.returns, f.actions);
    assert.equal(game.phase, 7);
    assert.equal(game.battle, null);
    assert.ok(e3IndependentNexusOccupyClean(game));
    assert.equal(game.lastBattleContext!.winner, f.cardUser);
    assert.equal(game.lastBattleContext!.result, 'normal');
    const ecaz = player(game, 'ecaz'), ally = player(game, 'emperor'), enemy = player(game, 'guild');
    assert.deepEqual(Object.fromEntries(Object.entries(ecaz.forces).filter(([key]) => key.startsWith('imperial_basin:'))), originalEcaz);
    assert.equal(ecaz.forces[f.location] ?? 0, lead === 'ecaz' ? 0 : 2);
    assert.equal(ecaz.reserves, beforeEcaz.reserves + (lead === 'ecaz' ? -1 : 0));
    assert.equal(ecaz.tanks, beforeEcaz.tanks + (lead === 'ecaz' ? 6 : 3));
    assert.equal(ally.forces[f.location] ?? 0, lead === 'ecaz' ? 4 : 0);
    assert.equal(ally.elites!.forces[f.location] ?? 0, lead === 'ecaz' ? 1 : 0);
    assert.equal(ally.reserves, beforeAlly.reserves + (lead === 'ecaz' ? 0 : 1));
    assert.equal(ally.elites!.reserves, beforeAlly.elites!.reserves + (lead === 'ecaz' ? 0 : 1));
    assert.equal(ally.tanks, beforeAlly.tanks + (lead === 'ecaz' ? 1 : 4));
    assert.equal(ally.elites!.tanks, beforeAlly.elites!.tanks + 1);
    assert.equal(enemy.forces[f.location] ?? 0, 0);
    assert.equal(enemy.tanks, beforeEnemy.tanks + 3);
    assert.equal(enemy.reserves, beforeEnemy.reserves);
    assert.equal(game.nexusCards!.cards!.hands.guild, 'guild', 'The original unspent closing-draw card remains held');
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD]) {
      assert.equal(game.discard.filter(physical => physical.id === card).length, 1);
      assert.ok(!player(game, f.cardUser).hand.some(physical => physical.id === card));
    }
  });
}

void test('four minimal legal policies use original independent cards through the selected Occupy owner with real World sources', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const f = createE3IndependentNexusOccupyFixture({ lead, homeworlds: true, expansions: ['ix', 'choam', 'ecaz'] });
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(f.game, f.cardUser);
      view.players.find(player => player.id === f.cardUser)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'battlePlan' &&
        Number(action.dial) > f.profile.fixedEcazDial &&
        (action.weapon === REINFORCEMENTS_CARD || action.defense === REINFORCEMENTS_CARD));
      assert.ok(action, `${lead} ${difficulty} must expose its own card with a positive variable commitment`);
      assert.ok(action.reinforcementsSources, 'The selected payer declares an actual own native reserve source');
      assert.ok(applyAction(f.game, f.cardUser, action).battle!.plans[f.cardUser]);
    }
  }
});
