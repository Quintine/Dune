import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { casualtyOptions, maxCombatDial, maxCombatSupport } from '../game/combat';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldPopulations } from '../game/homeworld-population';
import { reactionAction } from './fixture-classic-independent-nexus-reactions';
import {
  advanceWorldNexusBattle, createWorldNexusEmperorBattle, createWorldNexusHarkonnenBattle,
  revealWorldNexusPlans, worldNexusClean, worldNexusPlayer,
} from './fixture-nexus-core-world-battles';

for (const salusa of ['high', 'low'] as const) {
  void test(`original own-Kaitain Cunning with ${salusa} Salusa spends support but kills only physical ordinary counters`, () => {
    const f = createWorldNexusEmperorBattle({ salusa, skills: true, tech: true, strongholds: true });
    let game = f.game;
    const emperor = worldNexusPlayer(game, 'emperor'), guild = worldNexusPlayer(game, 'guild');
    const beforeSpice = emperor.spice, beforeStars = structuredClone(emperor.elites);
    const beforeSalusa = structuredClone(game.homeworlds!.custody!.salusa);
    const populations = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!);
    const home = populations.find(home => home.location === f.location)!;
    assert.deepEqual([home.population, home.side, home.nativeBattleStrength], [7, 'high', 2]);
    assert.deepEqual(beforeSalusa, { normal: 8, elite: salusa === 'high' ? 5 : 1 });
    assert.equal(populations.find(home => home.card === 'salusa_secundus')!.side, salusa);
    assert.equal(f.trainer!.leader, f.leader);
    assert.equal(game.battle!.leaderSkillHidden!.emperor, true);
    assert.equal(f.plans[0].action.leader, f.trainer!.leader);
    // Arrakeen and Tuek's Sietch were actually earned at END Mentat; neither
    // becomes generic off-planet strength or support in this native battle.
    assert.equal(game.strongholdCards!.owners.arrakeen, 'atreides');
    assert.equal(game.strongholdCards!.owners.tueks_sietch, 'guild');
    assert.deepEqual(viewGame(game, 'emperor').battle!.strongholdEffects, { guild: null, emperor: null });
    const offer = viewGame(game, 'emperor').nexusSardaukar!.offer!;
    assert.equal(offer.blocked, null);
    game = reactionAction(game, 'emperor', { type: 'nexusSardaukar', event: offer.event });
    game = advanceWorldNexusBattle(game, state => worldNexusClean(state));
    const forces = viewGame(game, 'emperor').battle!.ownForces!;
    assert.deepEqual([forces.normal, forces.elite, forces.temporaryElite], [7, 0, 5]);
    assert.equal(!!forces.eliteFreeSupport, salusa === 'high');
    assert.equal(maxCombatDial(forces), 12);
    assert.equal(maxCombatSupport(forces), salusa === 'high' ? 2 : 7);
    assert.ok(casualtyOptions(forces, 4, salusa === 'high' ? 0 : 2).some(loss => loss.normal === 2 && loss.elite === 0));
    // High Salusa's five real stars grant free elite support, so only the two
    // ordinary non-temporary counters can pay (shared cap 2). Low Salusa lifts
    // the shared counter cap to 7, but the desert export has already left the
    // Emperor 2 spice, so the live plan bound stays 0–2 and anything above it
    // is rejected unchanged.
    const badSupport = salusa === 'high' ? 3 : 8;
    assert.throws(() => applyAction(game, 'emperor', { ...f.plans[0].action, support: badSupport }));
    assert.throws(() => applyAction(game, 'emperor', { type: 'nexusSardaukar', event: offer.event }));
    game = revealWorldNexusPlans(game, f.plans);
    assert.deepEqual(viewGame(game, 'emperor').battle!.traitorVoters, ['emperor']);
    assert.throws(() => applyAction(game, 'guild', { type: 'traitorCall', call: false }));
    game = advanceWorldNexusBattle(game, state => !state.battle && !state.homeworldBattleLoss && worldNexusClean(state));
    assert.equal(game.lastBattleContext!.winner, 'emperor');
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.deepEqual(combatArmy(game, 'emperor', f.location), { normal: 5, elite: 0 });
    assert.deepEqual(combatArmy(game, 'guild', f.location), { normal: 0, elite: 0 });
    assert.equal(worldNexusPlayer(game, 'emperor').tanks, emperor.tanks + 2);
    assert.equal(worldNexusPlayer(game, 'guild').tanks, guild.tanks + 3);
    assert.equal(worldNexusPlayer(game, 'emperor').spice, beforeSpice - (salusa === 'high' ? 0 : 2));
    assert.deepEqual(worldNexusPlayer(game, 'emperor').elites, beforeStars);
    assert.deepEqual(game.homeworlds!.custody!.salusa, beforeSalusa);
    const record = game.nexusSardaukarHistory!.at(-1)!;
    assert.equal(record.casualties!.outcome, 'complete');
    assert.ok(record.casualties!.options.every(loss => loss.elite === 0));
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    assert.equal(viewGame(game, 'emperor').nexusSardaukar!.active, false);
    homeworldGameIntegrity(game);
  });
}

for (const advanced of [false, true]) {
  for (const cancel of [false, true]) {
    void test(`${advanced ? 'Advanced all14/phase' : 'Basic'} Giedi Prime native call ${cancel ? 'is canceled with retirement and replacement' : 'retains its original traitor outcome'}`, () => {
      const f = createWorldNexusHarkonnenBattle({ advanced, skills: advanced, tech: advanced, strongholds: advanced });
      let game = revealWorldNexusPlans(f.game, f.plans);
      const native = worldNexusPlayer(game, 'harkonnen'), invader = worldNexusPlayer(game, 'atreides');
      const home = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!).find(home => home.location === f.location)!;
      assert.deepEqual([home.population, home.side, home.nativeBattleStrength], [10, 'high', 2]);
      assert.deepEqual(viewGame(game, 'atreides').battle!.traitorVoters, ['harkonnen']);
      assert.throws(() => applyAction(game, 'atreides', { type: 'traitorCall', call: true }));
      if (advanced) {
        assert.equal(game.strongholdCards!.owners.carthag, 'harkonnen');
        assert.deepEqual(viewGame(game, 'harkonnen').battle!.strongholdEffects, { harkonnen: null, atreides: null });
        assert.equal(game.battle!.plans.harkonnen.leader, f.trainer!.leader);
      }
      game = reactionAction(game, 'harkonnen', { type: 'traitorCall', call: true });
      const event = game.pendingNexusHarkonnenBetrayal!.source.event;
      assert.equal(viewGame(game, 'atreides').nexusHarkonnenBetrayalReaction!.canUse, true);
      assert.equal(game.pendingNexusHarkonnenBetrayal!.source.declaration.identity, f.identity);
      game = reactionAction(game, 'atreides', { type: cancel ? 'nexusHarkonnenBetrayalUse' : 'nexusHarkonnenBetrayalPass', event });
      if (cancel) {
        assert.equal(worldNexusPlayer(game, 'harkonnen').traitors.includes(f.identity), false);
        assert.equal(game.traitorReserve!.filter(identity => identity === f.identity).length, 1);
        assert.equal(game.pendingNexusHarkonnenReplacement!.identity, f.identity);
        assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'harkonnen').length, 1);
      }
      let captive: string | undefined;
      if (advanced) {
        game = advanceWorldNexusBattle(game, state => state.decision?.kind === 'captureOffer' && !state.response);
        assert.equal(game.decision!.kind, 'captureOffer');
        game = reactionAction(game, 'harkonnen', { type: 'decision', accept: true });
        game = advanceWorldNexusBattle(game, state => state.decision?.kind === 'capturedLeader' && !state.response);
        assert.ok(game.decision?.kind === 'capturedLeader');
        captive = game.decision.leader;
        assert.equal(worldNexusPlayer(game, 'atreides').leaders.find(leader => leader.id === captive)!.capturedBy, 'harkonnen');
        const spice = worldNexusPlayer(game, 'harkonnen').spice;
        game = reactionAction(game, 'harkonnen', { type: 'decision', mode: 'execute' });
        assert.equal(worldNexusPlayer(game, 'harkonnen').spice, spice + 2);
        const executed = worldNexusPlayer(game, 'atreides').leaders.find(leader => leader.id === captive)!;
        assert.equal(executed.dead, true);
        assert.equal(executed.deaths, 2);
        assert.equal(executed.capturedBy, undefined);
      }
      const replacementTop = cancel ? game.traitorReserve![0] : null;
      game = advanceWorldNexusBattle(game, state => state.phase === 8 && worldNexusClean(state));
      assert.equal(game.lastBattleContext!.territory, f.location);
      assert.equal(game.lastBattleContext!.winner, 'harkonnen');
      assert.equal(game.lastBattleContext!.result, cancel ? 'normal' : 'traitor');
      assert.deepEqual(combatArmy(game, 'harkonnen', f.location), { normal: 10, elite: 0 });
      assert.deepEqual(combatArmy(game, 'atreides', f.location), { normal: 0, elite: 0 });
      assert.equal(worldNexusPlayer(game, 'harkonnen').tanks, native.tanks);
      assert.equal(worldNexusPlayer(game, 'atreides').tanks, invader.tanks + 1);
      assert.equal(game.pendingNexusHarkonnenReplacement, null);
      assert.equal(game.nexusHarkonnenReplacementHistory!.length, cancel ? 1 : 0);
      if (cancel) {
        assert.equal(game.nexusHarkonnenReplacementHistory![0].drawn, replacementTop);
        assert.equal(worldNexusPlayer(game, 'harkonnen').traitors.length, 4);
      } else {
        assert.equal(game.nexusCards!.cards!.hands.atreides, 'harkonnen');
        assert.ok(worldNexusPlayer(game, 'harkonnen').revealedTraitors!.includes(f.identity));
        assert.equal(worldNexusPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)!.dead, true);
      }
      assert.throws(() => applyAction(game, 'atreides', { type: 'nexusHarkonnenBetrayalUse', event }));
      homeworldGameIntegrity(game);
    });
  }
}
