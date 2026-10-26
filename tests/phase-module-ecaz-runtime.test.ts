import assert from 'node:assert/strict';
import test from 'node:test';
import { ownedTech } from '../game/tech-tokens';
import { strongholdBenefit } from '../game/stronghold-cards';
import {
  createPhaseModuleEcazFixture as fixture, resolvePhaseModuleEcazFixture as resolve,
  phaseModuleEcazInventory as inventory, phaseModuleEcazPlayer as player,
  type PhaseModuleEcazFixture,
} from './fixture-phase-module-ecaz';

function source(f: PhaseModuleEcazFixture) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.ready.status, 'lobby'); assert.equal(f.started.status, 'setup');
  assert.equal(f.afterSetup.status, 'playing'); assert.equal(f.game.status, 'playing');
  assert.equal(f.game.turn, 3); assert.equal(f.game.phase, 6); assert.equal(f.game.advanced, f.advanced);
  assert.deepEqual(f.game.expansions, ['ix', 'choam', 'ecaz']);
  assert.deepEqual(f.game.players.map(p => p.faction), ['ecaz', 'ixians', 'emperor']);
  assert.ok(f.game.techTokens); assert.equal(!!f.game.strongholdCards, f.advanced);
  assert.ok(!f.game.leaderSkills && !f.game.homeworlds && !f.game.nexusCards && !f.game.discoveryEnabled && !f.game.ecazTreachery && !f.game.semutaPreview);
  assert.ok(f.actions.some(step => step.action.type === 'techTokens' && step.action.enabled === true));
  assert.ok(f.actions.some(step => step.action.type === 'start' && (!f.advanced || step.action.advancedPreview === true)));
  assert.equal(f.beforeAlliance.turn, 2); assert.equal(f.beforeAlliance.phase, 1); assert.equal(f.beforeAlliance.nexus, true);
  assert.ok(f.beforeAlliance.spiceDiscard.flat().some(card => 'worm' in card && !card.suppressed));
  assert.equal(player(f.afterAlliance, f.ecaz).ally, f.ally); assert.equal(player(f.afterAlliance, f.ally).ally, f.ecaz);
  assert.ok(f.actions.some(step => step.actor === f.ecaz && step.action.type === 'alliance' && step.action.target === f.ally));
  assert.ok(f.actions.some(step => step.actor === f.ally && step.action.type === 'alliance' && step.action.target === f.ecaz));
  assert.equal(f.beforeMentat.turn, 2); assert.equal(f.beforeMentat.phase, 8); assert.equal(f.afterMentat.turn, 3);
  assert.equal(f.mentatStep.action.type, 'ready');
  if (f.advanced) {
    assert.equal(f.afterMentat.strongholdCards!.owners.sietch_tabr, f.ecaz);
    assert.equal(f.afterMentat.strongholdCards!.claimedTurn, 2);
    assert.equal(strongholdBenefit(f.game.strongholdCards, f.ecaz, f.territory), f.territory);
    assert.equal(strongholdBenefit(f.game.strongholdCards, f.ally, f.territory), null);
  }
  assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead'); assert.equal(f.beforeLead.decision?.player, f.ecaz);
  assert.equal(f.game.battle!.revealed, false); assert.equal(f.game.decision ?? null, null); assert.equal(f.game.response ?? null, null);
  assert.equal(f.profile.ecaz, f.ecaz); assert.equal(f.profile.ally, f.ally); assert.equal(f.profile.planOwner, f.actor);
  assert.equal(f.profile.payer, f.actor); assert.equal(f.profile.forceOwner, f.ally); assert.equal(f.profile.canceled, false);
  assert.equal(f.profile.fixedEcazDial, Math.ceil(f.ecazForces / 2));
  assert.equal(f.profile.ecazForces.normal, f.ecazForces);
  assert.equal(f.profile.allyForces.normal, 3); assert.equal(f.profile.allyForces.elite, 3);
  assert.equal(f.profile.allyForces.normalFixedHalf, true); assert.equal(f.profile.allyForces.eliteStrength, 2);
  assert.equal(player(f.game, f.ecaz).forces[f.location], f.ecazForces);
  assert.equal(player(f.game, f.ally).forces[f.location], 6); assert.equal(player(f.game, f.ally).elites!.forces[f.location], 3);
  assert.equal(player(f.game, f.opponent).forces[f.location], 8);
  assert.equal(ownedTech(f.afterFirstStorm.techTokens, f.ecaz).length, 1);
  assert.equal(ownedTech(f.afterFirstStorm.techTokens, f.ally).length, 1);
  assert.equal(ownedTech(f.afterFirstStorm.techTokens, f.opponent).length, 1);
  assert.deepEqual(f.game.techTokens, f.afterFirstStorm.techTokens);
  assert.ok(player(f.game, f.actor).hand.some(card => card.id === f.shield));
  assert.equal(f.sourceActionCount, f.actions.length); assert.match(f.staging[1], /CONTROLLED/); assert.match(f.staging[2], /CONTROLLED/);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.originalInventory.length, 47);
}

for (const advanced of [false, true]) for (const lead of ['ecaz', 'ally'] as const) {
  void test(`public ${advanced ? 'Advanced Stronghold+Tech' : 'Basic Tech'} all-three-deck coalition: ${lead} lead retains original native losses, holder benefit and winner Tech`, () => {
    const f = fixture({ advanced, lead }); source(f);
    const before = structuredClone(f.game), result = resolve(f), { quote, revealed, beforeCleanup, game } = result;
    assert.deepEqual(f.game, before);
    assert.equal(quote.winner, f.actor); assert.equal(beforeCleanup.lastBattleContext!.winner, f.actor);
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: Math.ceil(f.ecazForces / 2), elite: 0 }]);
    assert.equal(quote.casualties!.owner, f.ally);
    assert.deepEqual(quote.casualties!.options, [{ normal: 1, elite: 0, paidNormal: 0, paidElite: 0 }]);
    assert.ok(quote.payments.every(payment => payment.ownPayment === 0 && payment.bankSupport === 0));
    const income = advanced && lead === 'ecaz' ? 1 : 0;
    assert.deepEqual(quote.strongholdIncome, income ? [{ player: f.actor, amount: income }] : []);
    assert.equal(player(beforeCleanup, f.actor).spice, player(revealed, f.actor).spice + income);
    const nonLead = f.actor === f.ecaz ? f.ally : f.ecaz;
    assert.equal(player(beforeCleanup, nonLead).spice, player(revealed, nonLead).spice);
    assert.equal(player(beforeCleanup, f.opponent).spice, player(revealed, f.opponent).spice);
    assert.equal(beforeCleanup.decision?.kind, 'battleCards'); assert.equal(beforeCleanup.decision?.player, f.actor);
    assert.equal(beforeCleanup.techTokens![f.enemyToken].owner, f.opponent, 'Original winner-card cleanup precedes the original enemy token transfer');
    assert.equal(player(beforeCleanup, f.ecaz).tanks - player(f.game, f.ecaz).tanks, Math.ceil(f.ecazForces / 2));
    assert.equal(player(beforeCleanup, f.ally).tanks - player(f.game, f.ally).tanks, 1);
    assert.equal(player(beforeCleanup, f.ally).elites!.tanks, player(f.game, f.ally).elites!.tanks);
    assert.equal(player(beforeCleanup, f.opponent).tanks - player(f.game, f.opponent).tanks, 8);
    assert.equal(player(game, f.ecaz).forces[f.location], 2);
    assert.equal(player(game, f.ally).forces[f.location], 5); assert.equal(player(game, f.ally).elites!.forces[f.location], 3);
    assert.equal(player(game, f.opponent).forces[f.location] ?? 0, 0);
    assert.equal(game.lastBattleContext!.winner, f.actor); assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(game.techTokens![f.enemyToken].owner, f.actor);
    assert.equal(ownedTech(game.techTokens, f.actor).length, 2); assert.equal(ownedTech(game.techTokens, nonLead).length, 1);
    assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
    assert.ok(player(game, f.actor).hand.some(card => card.id === f.shield));
    assert.equal(player(game, f.actor).leaders.find(leader => leader.id === f.winnerLeader)!.dead, false);
    if (advanced) assert.equal(game.strongholdCards!.owners.sietch_tabr, f.ecaz, 'Held-card custody is not transferred to the selected ally lead');
    assert.ok(result.actions.some(step => step.actor === f.actor && step.action.type === 'decision' && Array.isArray(step.action.discard)));
    assert.equal(result.actions.filter(step => step.action.type === 'battlePlan').length, 2);
    assert.ok(result.actions.some(step => step.action.type === 'traitorCall' && step.action.call === false));
    assert.equal(game.battle ?? null, null); assert.equal(game.decision ?? null, null);
    assert.deepEqual(inventory(game), f.originalInventory);
  });
}
