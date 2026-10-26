import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { TECH_TOKENS } from '../game/tech-tokens';
import {
  completeWorldSandtrout, createWorldSandtroutFixture, worldSandtroutDeferred as deferred,
  worldSandtroutInventory as inventory, worldSandtroutPlayer as player,
  worldSandtroutSkills as skills, worldSandtroutSpice as spice, worldSandtroutStocks as stocks,
} from './fixture-world-sandtrout';

for (const advanced of [false, true]) {
  void test(`native ${advanced ? 'Advanced Worlds Skills Tech Strongholds' : 'Basic Worlds Tech'} Sandtrout waits through real phases and suppresses only the later worm`, () => {
    const f = createWorldSandtroutFixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.deepEqual(f.game.players.map(seat => seat.faction), ['atreides', 'emperor', 'ixians']);
    assert.deepEqual(f.game.expansions, ['ix']); assert.ok(f.game.homeworlds && f.game.techTokens);
    assert.ok(f.game.homeworldOccupationPreview && f.game.homeworldOccupationHistory);
    assert.equal(!!f.game.leaderSkills, advanced); assert.equal(!!f.game.strongholdCards, advanced);
    assert.ok(!f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
    assert.equal(f.originalInventory.length, 47); assert.equal(f.originalSkills.length, advanced ? 14 : 0);
    assert.equal(f.originalSpice.length, 22); assert.deepEqual(f.staging, []);
    assert.equal(f.sourceActionCount, f.sourceActions.length);
    assert.equal(f.beforeDraw.sandtrout, false); assert.equal(f.game.sandtrout, true);
    assert.equal(viewGame(f.game, f.actor).sandtrout, true);
    assert.deepEqual(stocks(f.game), stocks(f.beforeDraw));
    assert.deepEqual(f.game.players.map(seat => seat.spice), f.beforeDraw.players.map(seat => seat.spice));
    assert.deepEqual(inventory(f.game), f.originalInventory); assert.deepEqual(spice(f.game), f.originalSpice);
    if (advanced) for (const [owner, skill] of Object.entries(f.training!)) {
      const assignment = f.afterSetup.leaderSkills!.assignments.find(row => row.owner === owner); assert.ok(assignment);
      assert.equal(assignment.skill, skill);
      assert.ok(f.sourceActions.some(step => step.actor === owner && step.action.type === 'leaderSkill' &&
        step.action.skill === skill && step.action.leader === assignment.leader));
    }
    const before = structuredClone(f.game), result = completeWorldSandtrout(f);
    assert.deepEqual(f.game, before);
    assert.equal(result.firstSpice.after.sandtrout, true); assert.equal(result.firstSpice.after.phase, 2);
    assert.deepEqual(result.shipmentSources, { 'homeworld:atreides': { normal: 2, elite: 0 } });
    assert.equal(player(result.shipment.after, f.actor).reserves, player(result.shipment.before, f.actor).reserves - 2);
    assert.equal(player(result.shipment.after, f.actor).forces[f.targetLocation], 2);
    assert.equal(player(result.shipment.before, f.actor).spice - player(result.shipment.after, f.actor).spice, 4);
    const ordinary = quoteSpiceCollection(result.collection.before).receipts;
    for (const seat of result.collection.before.players) {
      const receipt = ordinary.find(row => row.player === seat.id);
      assert.equal(player(result.collection.after, seat.id).spice - seat.spice,
        (receipt ? receipt.strongholds + receipt.collected : 0) + (seat.id === result.techOwner ? result.techAmount : 0));
    }
    assert.equal(result.collection.after.sandtrout, true);
    assert.ok(result.techAmount > 0);
    assert.equal(result.collection.after.techTokens!.heighliners.spice, 0);
    assert.equal(result.mentat.after.turn, 2); assert.equal(result.mentat.after.phase, 0);
    assert.equal(result.mentat.after.sandtrout, true); assert.equal(result.storm.after.sandtrout, true);
    assert.equal(player(result.mentat.after, 'emperor').spice - player(result.mentat.before, 'emperor').spice, advanced ? 1 : 0);
    if (advanced) {
      assert.deepEqual(result.bankerSource!.source.bankLegs, [{ payer: f.actor, amount: 4 }]);
      assert.equal(result.bankerSource!.grant!.owner, f.banker);
      assert.equal(deferred(result.collection.after), 1);
      assert.deepEqual(result.bankerCollection!.credits, [{ owner: f.banker, amount: 1 }]);
      assert.equal(result.mentat.after.strongholdCards!.claimedTurn, 1);
      assert.equal(result.mentat.after.strongholdCards!.owners.arrakeen, f.actor);
      assert.equal(result.mentat.after.strongholdCards!.owners.hidden_mobile_stronghold, 'ixians');
    } else assert.equal(result.bankerSource, null);
    assert.equal(deferred(result.mentat.after), 0);
    const land = result.secondSpiceOrder[1].card; assert.ok('territory' in land);
    assert.equal(result.revealed.spiceWindow!.amount, land.amount * 2);
    assert.equal(result.revealed.spice[`${land.territory}:${land.sector}`] -
      (result.beforeSuppression.spice[`${land.territory}:${land.sector}`] ?? 0), land.amount * 2);
    assert.equal(result.revealed.sandtrout, false); assert.equal(result.revealed.nexus, false);
    assert.deepEqual(stocks(result.revealed), stocks(result.beforeSuppression), 'The suppressed worm destroys no physical force');
    assert.equal(result.revealed.spice[f.targetLocation], result.beforeSuppression.spice[f.targetLocation],
      'The suppressed worm leaves its actual previous pile intact');
    assert.deepEqual(result.revealed.players.map(seat => seat.spice), result.beforeSuppression.players.map(seat => seat.spice));
    assert.equal(result.revealed.decision, null); assert.deepEqual(result.revealed.wormRides, []);
    assert.equal(result.revealed.spiceDiscard.flat().filter(card => 'worm' in card && card.suppressed).length, 1);
    assert.equal(result.revealed.spiceDiscard.flat().filter(card => 'sandtrout' in card).length, 1);
    if (advanced) {
      const next = result.secondSpiceOrder[2].card; assert.ok('territory' in next);
      assert.equal(result.secondWindow!.spiceWindow!.territory, next.territory);
      assert.equal(result.secondWindow!.spiceWindow!.amount, next.amount, 'Doubling is limited to the immediate replacement');
    }
    assert.equal(result.game.phase, 2); assert.equal(result.game.turn, 2); assert.equal(result.game.sandtrout, false);
    for (const { id } of TECH_TOKENS) assert.equal(result.game.techTokens![id].owner, result.beforeSuppression.techTokens![id].owner);
    assert.deepEqual(inventory(result.game), f.originalInventory); assert.deepEqual(skills(result.game), f.originalSkills);
    assert.deepEqual(spice(result.game), f.originalSpice);
  });
}

void test('native Basic World Sandtrout keeps the original ignored first-turn worm and waits for its later encounter', () => {
  const f = createWorldSandtroutFixture({ firstTurnWorm: true });
  assert.equal(f.game.turn, 1); assert.equal(f.game.sandtrout, true); assert.equal(f.game.nexus, false);
  const land = f.spiceOrder[2].card; assert.ok('territory' in land);
  assert.equal(f.game.spiceWindow!.amount, land.amount);
  assert.equal(f.game.spiceSequence!.skipped.filter(card => 'worm' in card).length, 1);
  assert.ok(f.game.log.some(entry => /first-turn worm rule leaves Sandtrout waiting/.test(entry.text)));
  assert.deepEqual(spice(f.game), f.originalSpice);
  const result = completeWorldSandtrout(f);
  assert.equal(result.beforeSuppression.sandtrout, true); assert.equal(result.beforeSuppression.turn, 2);
  assert.equal(result.revealed.nexus, false); assert.equal(result.revealed.sandtrout, false);
  assert.equal(result.game.phase, 2); assert.deepEqual(spice(result.game), f.originalSpice);
});
