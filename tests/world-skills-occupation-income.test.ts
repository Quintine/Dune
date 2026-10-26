import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { TECH_TOKENS } from '../game/tech-tokens';
import {
  completeWorldSkillsOccupation, createWorldSkillsOccupationFixture,
  worldSkillsOccupationDeferred as deferred, worldSkillsOccupationInventory as inventory,
  worldSkillsOccupationPlayer as player, worldSkillsOccupationSkillInventory as skills,
} from './fixture-world-skills-occupation';

for (const advanced of [false, true]) {
  void test(`public trained ${advanced ? 'Advanced Worlds Tech Strongholds' : 'Basic Worlds Tech'} keeps Caladan income, other-payer Banker and phase rewards distinct`, () => {
    const f = createWorldSkillsOccupationFixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.deepEqual(f.game.players.map(seat => seat.faction), ['atreides', 'ecaz', 'ixians']);
    assert.deepEqual(f.game.expansions, ['ix', 'choam', 'ecaz']);
    assert.ok(f.game.homeworlds && f.game.ecazTreachery && f.game.techTokens && f.game.leaderSkills);
    assert.equal(!!f.game.strongholdCards, advanced);
    assert.ok(f.game.homeworldOccupationPreview && f.game.spiceBankerIncomePreview);
    assert.ok(!f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
    assert.equal(f.originalInventory.length, 50); assert.equal(f.originalSkills.length, 14);
    assert.deepEqual(inventory(f.game), f.originalInventory); assert.deepEqual(skills(f.game), f.originalSkills);
    assert.equal(f.trainingActions.length, 3); assert.deepEqual(f.staging, []);
    assert.equal(f.sourceActionCount, f.sourceActions.length);
    for (const [actor, skill] of Object.entries(f.training)) {
      const assignment = viewGame(f.game, actor).leaderSkills!.assignments.find(assignment => assignment.owner === actor);
      assert.ok(assignment); assert.equal(assignment.skill, skill);
      assert.equal(assignment.faceUp, true); assert.equal(assignment.captured, false);
      assert.equal(assignment.controller, actor);
    }

    assert.deepEqual(f.evacuationSources, { 'homeworld:atreides': { normal: 10, elite: 0 } });
    assert.equal(player(f.evacuation.after, f.native).reserves, 0);
    assert.equal(player(f.evacuation.after, f.native).forces['arrakeen:10'], 20);
    assert.equal(player(f.evacuation.before, f.native).spice - player(f.evacuation.after, f.native).spice, 10);
    assert.deepEqual(f.bankerSource.source.bankLegs, [{ payer: f.native, amount: 10 }]);
    assert.equal(f.bankerSource.source.phase, 5); assert.equal(f.bankerSource.source.turn, 1);
    assert.equal(f.bankerSource.source.trainer?.assignment.owner, f.banker);
    assert.equal(f.bankerSource.source.trainer?.faceUp, true);
    assert.equal(f.bankerSource.grant?.owner, f.banker); assert.equal(f.bankerSource.grant?.amount, 1);
    assert.notEqual(f.banker, f.native, 'The qualifying Bank10 belongs to another payer');
    assert.equal(player(f.evacuation.after, f.banker).spice, player(f.evacuation.before, f.banker).spice,
      'The mandatory normal grant waits in front of the shield');
    assert.equal(deferred(f.evacuation.after, f.banker), 1); assert.equal(deferred(f.game, f.banker), 1);
    assert.deepEqual(f.invasion.after.homeworlds?.custody?.visitors[f.world]?.[f.owner], { normal: 1, elite: 0 });
    assert.equal(f.entitlement.qualification, f.qualification.event); assert.equal(f.entitlement.spice, 2);
    assert.equal(f.game.techTokens?.heighliners.spice, 1);
    assert.equal(f.game.spiceBankerIncome!.sources.filter(receipt => receipt.grant !== null).length, 1);

    const before = structuredClone(f.game), originalTech = structuredClone(f.game.techTokens);
    const result = completeWorldSkillsOccupation(f);
    assert.deepEqual(f.game, before, 'The genuine trained source remains reusable before its final callback');
    assert.deepEqual(result.collection.steps[0], { actor: f.current, action: f.action });
    assert.equal(result.collection.after.phase, 7);
    assert.equal(player(result.collection.after, f.owner).spice - player(result.collection.before, f.owner).spice, 2);
    assert.equal(deferred(result.collection.after, f.banker), 1, 'Caladan Collection does not prematurely collect Banker');
    assert.deepEqual(result.incomeReceipt, { world: f.world, status: 'settled', ownAmount: 2,
      credits: [{ player: f.owner, amount: 2 }] });
    assert.equal(player(result.collection.after, f.techOwner).spice - player(result.collection.before, f.techOwner).spice, 1);
    assert.equal(result.collection.after.techTokens?.heighliners.spice, 0);
    assert.equal(player(result.collection.after, f.native).spice - player(result.collection.before, f.native).spice, advanced ? 2 : 0,
      'Ordinary Advanced Arrakeen Collection belongs to Atreides');
    assert.equal(result.collection.after.spiceBankerIncome!.sources.length, before.spiceBankerIncome!.sources.length,
      'Bank awards and Tech payouts are not another player Bank invoice');
    assert.equal(player(result.mentat.after, f.banker).spice - player(result.mentat.before, f.banker).spice, 1);
    assert.deepEqual(result.bankerCollection.credits, [{ owner: f.banker, amount: 1 }]);
    assert.deepEqual(result.bankerCollection.grants, [f.bankerSource.cursor]);
    assert.equal(result.bankerCollection.phase, 8); assert.equal(result.bankerCollection.turn, 1);
    assert.equal(deferred(result.game, f.banker), 0);
    assert.equal(result.game.spiceBankerIncome!.sources.filter(receipt => receipt.grant !== null).length, 1);
    assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0);
    for (const { id } of TECH_TOKENS) assert.equal(result.game.techTokens![id].owner, originalTech![id].owner);
    if (advanced) {
      assert.equal(result.game.strongholdCards?.claimedTurn, 1);
      assert.equal(result.game.strongholdCards?.owners.arrakeen, f.native);
      assert.equal(result.game.strongholdCards?.owners.hidden_mobile_stronghold, f.techOwner);
    }
    assert.deepEqual(inventory(result.game), f.originalInventory); assert.deepEqual(skills(result.game), f.originalSkills);
    assert.deepEqual(result.game.leaderSkills?.assignments, f.game.leaderSkills!.assignments);
    homeworldGameIntegrity(result.game);
  });
}
