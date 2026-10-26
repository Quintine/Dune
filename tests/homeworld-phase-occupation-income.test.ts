import assert from 'node:assert/strict';
import test from 'node:test';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { TECH_TOKENS } from '../game/tech-tokens';
import {
  completeHomeworldPhaseOccupation, createHomeworldPhaseOccupationFixture,
  homeworldPhaseOccupationInventory as inventory, homeworldPhaseOccupationPlayer as player,
} from './fixture-homeworld-phase-occupation';

for (const advanced of [false, true]) {
  void test(`public selected-family ${advanced ? 'Advanced Worlds Tech Strongholds' : 'Basic Worlds Tech'} pays actual sole Caladan occupation separately from phase rewards`, () => {
    const f = createHomeworldPhaseOccupationFixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.deepEqual(f.setup.players.map(seat => seat.faction), ['atreides', 'ecaz', 'ixians']);
    assert.deepEqual(f.setup.expansions, ['ix', 'choam', 'ecaz']);
    assert.ok(f.setup.homeworlds && f.setup.ecazTreachery && f.setup.techTokens);
    assert.equal(!!f.setup.strongholdCards, advanced);
    assert.ok(f.game.homeworldOccupationPreview);
    assert.ok(!f.game.nexusCards && !f.game.leaderSkills && !f.game.discoveryEnabled && !f.game.semutaPreview);
    assert.equal(f.originalInventory.length, 50); assert.deepEqual(inventory(f.game), f.originalInventory);
    assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
    assert.equal(f.evacuation.steps[0].action.type, 'ship');
    assert.equal(f.evacuation.steps[0].action.amount, 10);
    assert.deepEqual(f.evacuationSources, { 'homeworld:atreides': { normal: 10, elite: 0 } });
    assert.equal(player(f.evacuation.before, f.native).reserves, 10);
    assert.equal(player(f.evacuation.after, f.native).reserves, 0);
    assert.equal(player(f.evacuation.after, f.native).forces['arrakeen:10'], 20);
    assert.equal(player(f.evacuation.before, f.native).spice - player(f.evacuation.after, f.native).spice, 10);
    assert.equal(f.invasionAction.type, 'homeworldShip'); assert.equal(f.invasionQuote.cost, 1);
    assert.deepEqual(f.incomingSources, { 'homeworld:ecaz': { normal: 1, elite: 0 } });
    assert.deepEqual(f.invasion.after.homeworlds?.custody?.visitors[f.world]?.[f.owner], { normal: 1, elite: 0 });
    assert.equal(player(f.invasion.before, f.owner).reserves - player(f.invasion.after, f.owner).reserves, 1);
    assert.equal(f.invasion.before.homeworldOccupationHistory?.qualifications.some(q => q.world === f.world), false);
    assert.equal(f.qualification.world, f.world); assert.equal(f.qualification.player, f.owner);
    assert.ok(f.invasion.after.homeworldOccupationHistory?.sources.some(source => source.event === f.qualification.event));
    assert.equal(f.entitlement.qualification, f.qualification.event); assert.equal(f.entitlement.ally, null);
    assert.equal(f.entitlement.spice, 2);
    assert.equal(f.evacuation.after.techTokens?.heighliners.spice, 1);
    assert.equal(f.invasion.after.techTokens?.heighliners.spice, 1, 'The second paid shipment does not duplicate the per-phase token accrual');
    assert.equal(f.game.techTokens?.heighliners.owner, f.techOwner);
    assert.equal(f.game.homeworldOccupiedIncomeHistory?.length, 0);
    homeworldGameIntegrity(f.game);

    const before = structuredClone(f.game), techBefore = structuredClone(f.game.techTokens);
    const result = completeHomeworldPhaseOccupation(f);
    assert.deepEqual(f.game, before, 'The qualified pre-Collection source remains reusable for the actual callback');
    assert.deepEqual(result.collection.steps[0], { actor: f.current, action: f.action });
    assert.equal(result.collection.before.phase, 5); assert.equal(result.collection.after.phase, 7);
    assert.equal(player(result.collection.after, f.techOwner).spice - player(result.collection.before, f.techOwner).spice, 1);
    assert.equal(result.collection.after.techTokens?.heighliners.spice, 0);
    assert.equal(player(result.collection.after, f.owner).spice - player(result.collection.before, f.owner).spice, 2);
    assert.equal(player(result.collection.after, f.native).spice,
      player(result.collection.before, f.native).spice + (advanced ? 2 : 0),
      'Advanced native Arrakeen Collection remains separate from the Ecaz occupier bank income');
    assert.equal(result.collection.after.pendingHomeworldOccupiedIncome, null);
    assert.equal(result.incomeHistory.queue.length, 1);
    assert.equal(result.incomeHistory.queue[0].qualification, f.qualification.event);
    assert.deepEqual(result.incomeReceipt, { world: f.world, status: 'settled', ownAmount: 2,
      credits: [{ player: f.owner, amount: 2 }] });
    for (const { id } of TECH_TOKENS)
      assert.equal(result.game.techTokens![id].owner, techBefore![id].owner,
        'Occupied-bank Collection transfers no original Tech custody');
    assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0);
    if (advanced) {
      assert.equal(f.game.strongholdCards?.claimedTurn, 0);
      assert.ok(Object.values(f.game.strongholdCards!.owners).every(owner => owner === null));
      assert.equal(result.mentat.after.strongholdCards?.claimedTurn, 1);
      assert.equal(result.mentat.after.strongholdCards?.owners.arrakeen, f.native);
      assert.equal(result.mentat.after.strongholdCards?.owners.hidden_mobile_stronghold, f.techOwner);
    }
    assert.deepEqual(inventory(result.game), f.originalInventory); homeworldGameIntegrity(result.game);
    assert.deepEqual(result.game.homeworlds?.custody?.visitors[f.world]?.[f.owner], { normal: 1, elite: 0 });
    assert.equal(player(result.game, f.native).reserves, 0);
  });
}
