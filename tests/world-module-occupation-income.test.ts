import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { TECH_TOKENS } from '../game/tech-tokens';
import {
  completeWorldModuleOccupation, createWorldModuleOccupationFixture,
  worldModuleOccupationComponents as components, worldModuleOccupationDeferred as deferred,
  worldModuleOccupationPlayer as player,
} from './fixture-world-module-occupation';

const cases = [
  { label: 'Basic World Nexus Tech', advanced: false, nexus: true, discoveries: false, skills: false, tech: true, strongholds: false },
  { label: 'Basic World Discovery Skills', advanced: false, nexus: false, discoveries: true, skills: true, tech: false, strongholds: false },
  { label: 'Advanced World Nexus Discovery Skills Tech Strongholds', advanced: true, nexus: true, discoveries: true, skills: true, tech: true, strongholds: true },
] as const;

for (const options of cases) {
  void test(`native ${options.label} earns Caladan occupation income beside original module continuations`, () => {
    const f = createWorldModuleOccupationFixture(options);
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.deepEqual(f.game.players.map(seat => seat.faction), ['atreides', 'emperor', 'fremen']);
    assert.deepEqual(f.game.expansions, []);
    assert.ok(f.game.homeworlds && f.game.homeworldOccupationPreview);
    assert.equal(!!f.game.nexusCards, options.nexus); assert.equal(!!f.game.discoveryEnabled, options.discoveries);
    assert.equal(!!f.game.leaderSkills, options.skills); assert.equal(!!f.game.techTokens, options.tech);
    assert.equal(!!f.game.strongholdCards, options.strongholds);
    assert.equal(f.originalComponents.cards.length, 33);
    assert.equal(f.originalComponents.skills.length, options.skills ? 14 : 0);
    assert.equal(f.originalComponents.nexus.length, options.nexus ? 12 : 0);
    assert.equal(f.originalComponents.spice.length, options.discoveries ? 28 : 21);
    assert.equal(f.originalComponents.tokens.length, options.discoveries ? 8 : 0);
    assert.deepEqual(components(f.game), f.originalComponents); assert.deepEqual(f.staging, []);
    assert.equal(f.sourceActionCount, f.sourceActions.length);
    assert.deepEqual(f.evacuationSources, { 'homeworld:atreides': { normal: 10, elite: 0 } });
    assert.equal(player(f.evacuation.after, f.native).reserves, 0);
    assert.equal(player(f.evacuation.after, f.native).forces['arrakeen:10'], 20);
    assert.equal(player(f.evacuation.before, f.native).spice - player(f.evacuation.after, f.native).spice, 10);
    assert.deepEqual(f.incomingSources, { 'homeworld:emperor': { normal: 1, elite: 0 } });
    assert.equal(player(f.invasion.before, f.owner).spice - player(f.invasion.after, f.owner).spice, 1);
    assert.equal(player(f.invasion.before, f.owner).reserves - player(f.invasion.after, f.owner).reserves, 1);
    assert.equal(player(f.invasion.after, f.owner).elites?.reserves, player(f.invasion.before, f.owner).elites?.reserves);
    assert.deepEqual(f.invasion.after.homeworlds?.custody?.salusa, f.invasion.before.homeworlds?.custody?.salusa);
    assert.deepEqual(f.invasion.after.homeworlds?.custody?.visitors[f.world]?.[f.owner], { normal: 1, elite: 0 });
    assert.equal(f.entitlement.qualification, f.qualification.event); assert.equal(f.entitlement.spice, 2);
    assert.equal(f.entitlement.occupier, f.owner); assert.equal(f.entitlement.ally, null);
    if (options.skills) {
      assert.equal(f.trainingActions.length, 3);
      for (const [actor, skill] of Object.entries(f.training!)) {
        const assignment = viewGame(f.game, actor).leaderSkills!.assignments.find(row => row.owner === actor);
        assert.ok(assignment); assert.equal(assignment.skill, skill);
        assert.equal(assignment.faceUp, true); assert.equal(assignment.captured, false);
        assert.ok(f.trainingActions.some(step => step.actor === actor && step.action.skill === skill && step.action.leader === assignment.leader));
      }
      assert.deepEqual(f.bankerSource!.source.bankLegs, [{ payer: f.native, amount: 10 }]);
      assert.equal(f.bankerSource!.grant!.owner, f.owner); assert.equal(deferred(f.game, f.owner), 1);
      assert.equal(player(f.evacuation.after, f.owner).spice, player(f.evacuation.before, f.owner).spice);
    } else assert.equal(f.bankerSource, null);

    const before = structuredClone(f.game), ordinary = quoteSpiceCollection(f.game).receipts;
    const techBefore = structuredClone(f.game.techTokens);
    const result = completeWorldModuleOccupation(f);
    assert.deepEqual(f.game, before, 'The native source remains reusable before its actual final callback');
    assert.deepEqual(result.collection.steps[0], { actor: f.current, action: f.action });
    assert.equal(result.collection.after.phase, 7);
    assert.deepEqual(result.incomeReceipt, { world: f.world, status: 'settled', ownAmount: 2,
      credits: [{ player: f.owner, amount: 2 }] });
    for (const seat of before.players) {
      const receipt = ordinary.find(receipt => receipt.player === seat.id);
      const nativeIncome = receipt ? receipt.strongholds + receipt.collected : 0;
      assert.equal(player(result.collection.after, seat.id).spice - seat.spice,
        nativeIncome + (seat.id === f.owner ? 2 : 0) + (seat.id === f.techOwner ? f.techAmount : 0));
    }
    assert.equal(player(result.collection.after, f.native).spice - player(before, f.native).spice,
      (options.advanced ? 2 : 0) + (f.techOwner === f.native ? f.techAmount : 0), 'Ordinary Arrakeen income remains separate');
    assert.equal(deferred(result.collection.after, f.owner), options.skills ? 1 : 0);
    if (options.tech) {
      assert.ok(f.techOwner); assert.ok(f.techAmount > 0);
      assert.equal(result.collection.after.techTokens!.heighliners.spice, 0);
      for (const { id } of TECH_TOKENS) assert.equal(result.game.techTokens![id].owner, techBefore![id].owner);
    }
    assert.equal(player(result.mentat.after, f.owner).spice - player(result.mentat.before, f.owner).spice, options.skills ? 1 : 0);
    if (options.skills) {
      assert.deepEqual(result.bankerCollection!.credits, [{ owner: f.owner, amount: 1 }]);
      assert.deepEqual(result.bankerCollection!.grants, [f.bankerSource!.cursor]);
      assert.equal(result.bankerCollection!.phase, 8);
      assert.equal(result.game.spiceBankerIncome!.sources.filter(receipt => receipt.grant !== null).length, 1);
    }
    assert.equal(deferred(result.game, f.owner), 0);
    if (options.strongholds) {
      assert.equal(result.game.strongholdCards!.claimedTurn, 1);
      assert.equal(result.game.strongholdCards!.owners.arrakeen, f.native);
      assert.equal(result.game.strongholdCards!.owners.sietch_tabr, 'fremen');
    }
    if (options.discoveries) {
      assert.equal(f.moduleSpiceOrder.length, 1); assert.ok(f.discoveryPlacement && f.discoveryMovement && f.token);
      assert.equal(f.token.face, 'cistern'); assert.equal(f.token.revealedTurn, null);
      assert.deepEqual(f.discoveryMovement.steps[0], { actor: f.native, action: {
        type: 'move', from: 'arrakeen:10', amount: 1, elite: 0, territory: 'gara_kulon', sector: 8 } });
      assert.equal(player(f.game, f.native).forces['gara_kulon:8'], 1);
      assert.equal(player(f.game, f.native).forces['arrakeen:10'], 19);
      assert.ok(result.revelation && result.beforeEntry && result.entry && result.entryAction);
      assert.deepEqual(result.revelation.steps.map(step => step.action), [
        { type: 'discovery', token: f.token.id, reveal: false }, { type: 'discovery', token: f.token.id, reveal: true },
      ]);
      assert.equal(result.beforeEntry.decision?.kind, 'discoveryEntry');
      assert.equal(result.beforeEntry.decision!.player, f.native);
      assert.deepEqual(result.entry.steps[0], { actor: f.native, action: result.entryAction });
      assert.equal(player(result.entry.after, f.native).forces['gara_kulon:8'], undefined);
      assert.equal(player(result.entry.after, f.native).forces['cistern:0'], 1);
      assert.equal(player(result.entry.after, f.native).spice, player(result.entry.before, f.native).spice);
      assert.equal(player(result.entry.after, f.native).moved, player(result.entry.before, f.native).moved);
      assert.equal(player(result.entry.after, f.native).reserves, player(result.entry.before, f.native).reserves);
    } else assert.equal(result.entry, null);
    assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 0);
    assert.deepEqual(components(result.game), f.originalComponents);
  });
}
