import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { combatArmy } from '../game/combat-location';
import { casualtyOptions, maxCombatDial, maxCombatSupport } from '../game/combat';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldPopulations } from '../game/homeworld-population';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { reinforcementsBattleForces } from '../game/reinforcements-homeworld';
import { reactionAction } from './fixture-classic-independent-nexus-reactions';
import {
  advanceWorldNexusBattle, createWorldNexusEmperorBattle, revealWorldNexusPlans,
  worldNexusClean, worldNexusPlayer, type WorldNexusBattleStep,
} from './fixture-nexus-core-world-battles';

const KAITAIN = 'homeworld:emperor', SALUSA = 'homeworld:emperor:salusa';
const localFee: NativeReserveSelections = { [KAITAIN]: { normal: 3, elite: 0 } };
const remoteFee: NativeReserveSelections = { [SALUSA]: { normal: 3, elite: 0 } };

function declareCunning(game: Game): Game {
  const offer = viewGame(game, 'emperor').nexusSardaukar!.offer!;
  assert.equal(offer.blocked, null);
  game = reactionAction(game, 'emperor', { type: 'nexusSardaukar', event: offer.event });
  game = advanceWorldNexusBattle(game, worldNexusClean);
  const receipt = game.nexusSardaukarHistory!.at(-1)!.receipt;
  assert.equal(receipt.normal, 7);
  assert.equal(receipt.count, 5, 'The original declaration remains five roles, not a rewritten four-counter declaration');
  return game;
}

function cardPlan(step: WorldNexusBattleStep, slot: 'weapon' | 'defense', sources: NativeReserveSelections): WorldNexusBattleStep {
  return { actor: step.actor, action: { ...step.action, [slot]: REINFORCEMENTS_CARD,
    reinforcementsSources: sources } };
}

function finish(game: Game): Game {
  return advanceWorldNexusBattle(game, state => !state.battle && !state.homeworldBattleLoss && worldNexusClean(state));
}

function checkPhysicalDeal(game: Game): void {
  assert.equal(game.deck.length + game.discard.length + game.players.reduce((sum, player) => sum + player.hand.length, 0), 36);
  assert.equal(game.nexusCards!.cards!.deck.length + game.nexusCards!.cards!.discard.length +
    Object.values(game.nexusCards!.cards!.hands).filter(Boolean).length, 12);
}

for (const salusa of ['high', 'low'] as const) for (const slot of ['weapon', 'defense'] as const) {
  void test(`original independent ${slot}, own-Kaitain Cunning and ${salusa} Salusa pay the local fee before physical combat`, () => {
    const f = createWorldNexusEmperorBattle({ independent: true, salusa, skills: true, tech: true, strongholds: true });
    assert.equal(f.lobby.lobbyOptions?.ecazTreachery, true);
    assert.ok(f.lobby.players.every(player => !player.hand.length), 'The requested physical card was ordered before any starting deal');
    assert.equal(worldNexusPlayer(f.game, 'emperor').hand[0].id, REINFORCEMENTS_CARD);
    assert.ok(f.staging.some(note => note.includes('original unused Treachery shuffle')));
    checkPhysicalDeal(f.game);
    let game = declareCunning(f.game);
    const before = worldNexusPlayer(game, 'emperor'), other = worldNexusPlayer(game, 'guild');
    const stars = structuredClone(before.elites), salusaBefore = structuredClone(game.homeworlds!.custody!.salusa);
    const own = viewGame(game, 'emperor').battle!;
    assert.deepEqual([own.ownForces!.normal, own.ownForces!.elite, own.ownForces!.temporaryElite], [7, 0, 5]);
    assert.equal(own.nativeBattleStrength, 2);
    assert.equal(game.battle!.leaderSkillHidden!.emperor, true);
    assert.deepEqual(own.strongholdEffects, { guild: null, emperor: null });
    assert.equal(own.reinforcements!.blocked, null);
    const projected = reinforcementsBattleForces(own.ownForces!, localFee[KAITAIN]);
    // Provisional composition: the two non-role counters pay first, followed
    // by one temporary-role counter. The four survivors all retain the role.
    assert.deepEqual([projected.normal, projected.elite, projected.temporaryElite], [4, 0, 4]);
    assert.equal(projected.eliteFreeSupport, own.ownForces!.eliteFreeSupport);
    assert.equal(!!projected.eliteFreeSupport, salusa === 'high');
    assert.equal(maxCombatDial(projected), 8);
    assert.equal(maxCombatSupport(projected), salusa === 'high' ? 0 : 4);
    assert.deepEqual(casualtyOptions(projected, 4, salusa === 'high' ? 0 : 2), [
      { normal: 2, elite: 0, paidNormal: salusa === 'high' ? 0 : 2, paidElite: 0 },
    ]);
    const ownPlan = cardPlan(f.plans[0], slot, localFee);
    assert.throws(() => applyAction(game, 'emperor', { ...ownPlan.action, dial: 9 }),
      'The three fee counters cannot also fund the physical dial');
    if (salusa === 'high') assert.throws(() => applyAction(game, 'emperor', { ...ownPlan.action, support: 1 }),
      'There are no remaining ordinary non-role counters to pay support');
    game = revealWorldNexusPlans(game, [ownPlan, f.plans[1]]);
    assert.equal(viewGame(game, 'emperor').battle!.nativeBattleStrength, 2, 'The printed high face belongs to the original battle');
    game = finish(game);
    assert.equal(game.lastBattleContext!.winner, 'emperor');
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.deepEqual(combatArmy(game, 'emperor', KAITAIN), { normal: 2, elite: 0 });
    assert.deepEqual(combatArmy(game, 'guild', KAITAIN), { normal: 0, elite: 0 });
    const after = worldNexusPlayer(game, 'emperor');
    assert.equal(after.reserves, before.reserves - 5);
    assert.equal(after.tanks, before.tanks + 5, 'Three native fee counters and two real dial casualties, with no virtual bonus casualties');
    assert.equal(after.battleLosses, before.battleLosses + 5);
    assert.equal(worldNexusPlayer(game, 'guild').tanks, other.tanks + 3);
    assert.equal(after.spice, before.spice - (salusa === 'high' ? 0 : 2));
    assert.deepEqual(after.elites, stars, 'Temporary roles never become or kill actual stars');
    assert.deepEqual(game.homeworlds!.custody!.salusa, salusaBefore);
    const home = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!).find(home => home.location === KAITAIN)!;
    assert.deepEqual([home.population, home.side], [2, 'low']);
    const record = game.nexusSardaukarHistory!.at(-1)!;
    assert.equal(record.receipt.count, 5);
    assert.equal(record.receipt.normal, 7);
    assert.deepEqual(record.casualties!.reserveFee, { normal: 3, elite: 0 });
    assert.deepEqual([record.casualties!.forces.normal, record.casualties!.forces.elite,
      record.casualties!.forces.temporaryElite], [4, 0, 4]);
    assert.equal(record.casualties!.outcome, 'complete');
    assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    checkPhysicalDeal(game);
  });
}

void test('an original Salusa-only fee leaves all five Kaitain Cunning roles available', () => {
  const f = createWorldNexusEmperorBattle({ independent: true, salusa: 'high' });
  let game = declareCunning(f.game);
  const before = worldNexusPlayer(game, 'emperor'), stars = structuredClone(before.elites);
  const salusaBefore = structuredClone(game.homeworlds!.custody!.salusa!);
  const own = viewGame(game, 'emperor').battle!.ownForces!;
  const projected = reinforcementsBattleForces(own, remoteFee[KAITAIN]);
  assert.deepEqual([projected.normal, projected.elite, projected.temporaryElite], [7, 0, 5]);
  assert.equal(maxCombatDial(projected), 12);
  assert.equal(maxCombatSupport(projected), 2);
  game = revealWorldNexusPlans(game, [cardPlan(f.plans[0], 'weapon', remoteFee), f.plans[1]]);
  game = finish(game);
  assert.equal(game.lastBattleContext!.winner, 'emperor');
  assert.deepEqual(combatArmy(game, 'emperor', KAITAIN), { normal: 5, elite: 0 });
  assert.deepEqual(game.homeworlds!.custody!.salusa, { normal: salusaBefore.normal - 3, elite: salusaBefore.elite });
  assert.equal(worldNexusPlayer(game, 'emperor').tanks, before.tanks + 5);
  assert.deepEqual(worldNexusPlayer(game, 'emperor').elites, stars);
  const record = game.nexusSardaukarHistory!.at(-1)!;
  assert.equal(record.casualties!.forces.temporaryElite, 5);
  assert.equal(record.casualties!.reserveFee, undefined, 'An off-World fee never rewrites the original temporary-role army');
  assert.equal(record.casualties!.outcome, 'complete');
  checkPhysicalDeal(game);
});

for (const salusa of ['high', 'low'] as const) {
  void test(`all four minimal legal policies emit positive source-bearing Reinforcements plans with ${salusa} Salusa and original Cunning`, () => {
    const f = createWorldNexusEmperorBattle({ independent: true, salusa });
    const game = declareCunning(f.game);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(game, 'emperor');
      view.players.find(player => player.id === 'emperor')!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'battlePlan' && Number(action.dial) > 0 &&
        (action.weapon === REINFORCEMENTS_CARD || action.defense === REINFORCEMENTS_CARD));
      assert.ok(action, `${difficulty} must retain a positive physical card path`);
      const sources = action.reinforcementsSources as NativeReserveSelections | undefined;
      assert.ok(sources && Object.keys(sources).length, `${difficulty} must declare actual native sources`);
      const pool = reinforcementsBattleForces(view.battle!.ownForces!, sources[KAITAIN]);
      assert.ok(casualtyOptions(pool, Number(action.dial), Number(action.support ?? 0)).length,
        `${difficulty} must fund the physical dial after its own fee`);
      const sealed = applyAction(game, 'emperor', action);
      assert.ok(sealed.battle!.plans.emperor);
    }
  });
}
