import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction, viewGame} from '../game/engine';
import {mirrorWeaponModeBlock} from '../game/mirror-weapon-mode';
import {STONE_CARD, MIRROR_CARD, stoneHarassOccupyFixture, takeStoneHarassCard,
  sealStoneHarassPlans, finishStoneHarassBattle} from './fixture-stone-harass';
import {IX_TOOTH, ixRevealedWeaponFixture, revealIxWeapons,
  finishIxWeaponBattle} from './fixture-ix-revealed-weapons';

void test('native Basic and Advanced Ix or Tleilaxu copied Stone keeps copy-first choices and physical custody in either slot', () => {
  for (const advanced of [false, true]) for (const native of ['ixians', 'tleilaxu'] as const)
    for (const holder of ['a', 'd'] as const) {
      const source = ixRevealedWeaponFixture({advanced, native, holder, kind: 'mirrorStone'});
      let game = revealIxWeapons(source);
      assert.equal(game.decision?.kind, 'stoneBurner');
      assert.equal(game.decision?.player, holder);
      assert.equal(game.decision?.physicalId, MIRROR_CARD);
      assert.equal(game.decision?.copiedFrom, STONE_CARD);
      game = applyAction(game, holder, {type: 'decision', event: game.decision!.event, mode: 'ignore'});
      assert.equal(game.decision?.kind, 'stoneBurner');
      assert.equal(game.decision?.player, source.other);
      game = applyAction(game, source.other, {type: 'decision', event: game.decision!.event, mode: 'kill'});
      game = finishIxWeaponBattle(game);
      assert.equal(game.lastBattleContext?.winner, 'a', 'four native undialed counters beat zero ordinary counters');
      assert.equal(game.players.find(player => player.id === holder)!.hand.some(card => card.id === MIRROR_CARD), holder === 'a');
      assert.equal(game.discard.filter(card => card.id === MIRROR_CARD).length, holder === 'a' ? 0 : 1);
      for (const actor of ['a', 'd']) {
        const selected = source.plans.find(step => step.actor === actor)!.action.leader;
        assert.equal(game.players.find(player => player.id === actor)!.leaders.find(leader => leader.id === selected)!.dead, true);
      }
    }
});

void test('native Ix-deck Mirror activates copied Tooth first without converting physical Mirror into a mandatory discard', () => {
  for (const advanced of [false, true]) for (const native of ['ixians', 'tleilaxu'] as const)
    for (const holder of ['a', 'd'] as const) {
      const source = ixRevealedWeaponFixture({advanced, native, holder, kind: 'mirrorTooth'});
      let game = revealIxWeapons(source);
      assert.equal(game.decision?.kind, 'poisonTooth');
      assert.equal(game.decision?.player, holder);
      assert.equal(game.decision?.physicalId, MIRROR_CARD);
      game = applyAction(game, holder, {type: 'decision', event: game.decision!.event, activate: true});
      assert.ok(game.decision?.kind === 'poisonTooth');
      assert.equal(game.decision?.player, source.other);
      assert.equal(game.decision?.physicalId, IX_TOOTH);
      game = applyAction(game, source.other, {type: 'decision', event: game.decision!.event, activate: false});
      assert.equal(game.battle!.poisonTooth![holder], true);
      assert.equal(game.battle!.poisonTooth![source.other], false);
      game = finishIxWeaponBattle(game);
      assert.equal(game.lastBattleContext?.winner, 'd', 'after both leaders die the original ordinary dial5 beats native zero');
      assert.equal(game.players.find(player => player.id === holder)!.hand.some(card => card.id === MIRROR_CARD), holder === 'd');
      assert.equal(game.players.find(player => player.id === source.other)!.hand.some(card => card.id === IX_TOOTH), source.other === 'd');
      for (const actor of ['a', 'd']) {
        const selected = source.plans.find(step => step.actor === actor)!.action.leader;
        assert.equal(game.players.find(player => player.id === actor)!.leaders.find(leader => leader.id === selected)!.dead, true);
      }
    }
});

void test('original Ix-deck Stone precedes uncopied Tooth under the existing provisional policy, without forcing Tooth activation', () => {
  for (const advanced of [false, true]) for (const native of ['ixians', 'tleilaxu'] as const)
    for (const holder of ['a', 'd'] as const) {
      const source = ixRevealedWeaponFixture({advanced, native, holder, kind: 'stoneTooth'});
      let game = revealIxWeapons(source);
      assert.equal(game.decision?.kind, 'stoneBurner');
      assert.equal(game.decision?.player, holder);
      game = applyAction(game, holder, {type: 'decision', event: game.decision!.event, mode: 'kill'});
      assert.equal(game.decision?.kind, 'poisonTooth');
      assert.equal(game.decision?.player, source.other);
      game = applyAction(game, source.other, {type: 'decision', event: game.decision!.event, activate: false});
      game = finishIxWeaponBattle(game);
      assert.equal(game.lastBattleContext?.winner, 'a');
      assert.equal(game.players.find(player => player.id === source.other)!.hand.some(card => card.id === IX_TOOTH), source.other === 'a');
      assert.equal(game.discard.filter(card => card.id === IX_TOOTH).length, source.other === 'a' ? 0 : 1);
    }
});

void test('Ix public precommit still rejects winner-changing cyborg allocations independently of the hidden opposing plan', () => {
  const source = ixRevealedWeaponFixture({advanced: true, kind: 'stoneTooth'});
  const own = {...source.plans[0].action, dial: 2, support: 0};
  const messages: string[] = [];
  for (const dial of [0, 5]) {
    const game = applyAction(source.game, 'd', {...source.plans[1].action, dial, support: dial});
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, 'a', own), error => {
      assert.match(String(error), /change the winner/);
      messages.push(String(error));
      return true;
    });
    assert.deepEqual(game, before);
  }
  assert.equal(messages[0], messages[1]);
});

void test('new Ix admission leaves optional-module and Basic Ecaz limits closed while retaining the existing non-Ix band', () => {
  const source = ixRevealedWeaponFixture().game;
  assert.equal(mirrorWeaponModeBlock(source), null);
  for (const moduleName of ['homeworlds', 'nexusCards', 'leaderSkills', 'discoveries', 'techTokens', 'strongholdCards'] as const)
    assert.notEqual(mirrorWeaponModeBlock({...source, [moduleName]: {}}), null);
  assert.notEqual(mirrorWeaponModeBlock({...source, sandtrout: true}), null);
  assert.notEqual(mirrorWeaponModeBlock({...source, expansions: ['ix']}), null);
  assert.notEqual(mirrorWeaponModeBlock({...source, expansions: ['ix', 'choam', 'ecaz'], advanced: false}), null);
  assert.equal(mirrorWeaponModeBlock({expansions: ['choam'], advanced: true,
    players: [{faction: 'emperor'}, {faction: 'richese'}, {faction: 'guild'}], techTokens: {}, strongholdCards: {}}), null);
});

void test('native Ixian or Tleilaxu Occupy keeps fixed remainder, copied Stone queue and actual card-user reserve cost separate', () => {
  for (const allyFaction of ['ixians', 'tleilaxu'] as const) for (const lead of ['ecaz', 'ally'] as const) {
    const source = stoneHarassOccupyFixture({allyFaction, lead, harass: false, stone: 'opponent', mirror: true,
      variableDial: 0, support: 0, allyForces: 4, ...(allyFaction === 'ixians' ? {allyElite: 2} : {}), opponentForces: 5});
    takeStoneHarassCard(source.game, source.lead, 'ecaz-reinforcements');
    source.plans.find(step => step.actor === source.lead)!.action.defense = 'ecaz-reinforcements';
    const originalReserves = source.game.players.find(player => player.id === source.lead)!.reserves;
    // Natural Storm changes public tie priority. Make the original Stone
    // finishable for every mixed allocation, never just the sealed zero dial.
    const opponentPlan = source.plans.find(step => step.actor === source.opponent)!.action;
    const fullCommitment = viewGame(source.game, source.opponent).battle!.tieWinner !== source.opponent;
    opponentPlan.dial = fullCommitment ? 5 : 0;
    opponentPlan.support = fullCommitment ? 5 : 0;
    let game = sealStoneHarassPlans(source);
    assert.equal(game.decision?.player, source.lead, 'the selected lead physically owns Mirror and chooses the copy first');
    game = finishStoneHarassBattle(game, {modes: {[source.lead]: 'ignore', [source.opponent]: 'ignore'}});
    assert.equal(game.lastBattleContext?.winner, source.lead, 'the public-safe original plan leaves fewer undialed counters than the coalition');
    assert.equal(game.players.find(player => player.id === source.lead)!.hand.some(card => card.id === MIRROR_CARD), true);
    assert.equal(game.players.find(player => player.id === source.ecaz)!.tanks, lead === 'ecaz' ? 6 : 3);
    assert.equal(game.players.find(player => player.id === source.ally)!.tanks, lead === 'ally' ? 3 : 0);
    assert.equal(game.players.find(player => player.id === source.lead)!.reserves, originalReserves - 3);
    assert.equal(game.discard.filter(card => card.id === 'ecaz-reinforcements').length, 1);
    assert.equal(viewGame(game, source.lead).battle, null);
  }
});
