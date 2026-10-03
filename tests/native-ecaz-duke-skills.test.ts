import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  advancedNativePlayer as player, advancedNativeStep, finishAdvancedNativeSkillAftermath,
  openAdvancedNativeSkillBattle, rejectAdvancedNativeAction as reject,
} from './fixture-advanced-native-skills';
import {
  acquireNativeEcazSkillDuke, assertEcazDukeSkillsCustody,
  ecazDukeSkillsAction as act, ecazDukeSkillsTrainer as trainer,
  reloadEcazDukeSkills as reload, stageNativeEcazDukeSkillBattle,
} from './fixture-ecaz-duke-skills';

function resolve(game: Game, actor: string, enemy: string): Game {
  game = act(game, actor, { type: 'traitorCall', call: false });
  return act(game, enemy, { type: 'traitorCall', call: false });
}

for (const rules of ['basic', 'advanced'] as const) {
  void test(`${rules} original Ecaz Ambassador acquisition gives separate Duke6 only the native face-up Warmaster's normal +1`, () => {
    const acquired = acquireNativeEcazSkillDuke(rules);
    const assignment = structuredClone(trainer(acquired));
    const native = structuredClone(player(acquired, 'ecaz').leaders);
    for (const [visible, dial, expectedWinner] of [
      [true, 2, 'ecaz'], [false, 2, 'emperor'], [true, 3, 'emperor'],
    ] as const) {
      const staged = stageNativeEcazDukeSkillBattle(reload(acquired));
      let game = openAdvancedNativeSkillBattle(reload(staged.game), staged.actor, staged.enemy, !visible);
      assert.equal(game.dukeVidal!.controller, staged.actor);
      assert.equal(game.dukeVidal!.source, 'ecaz');
      assert.equal(game.dukeVidal!.leader.strength, 6);
      assert.equal(player(game, 'ecaz').leaders.find(l => l.id === assignment.leader)!.dead, false);
      assert.equal(game.battle!.leaderSkillHidden![staged.actor], !visible);
      assert.equal(viewGame(game, staged.actor).leaderSkills!.eligibleLeaders.some(l => l.id === DUKE_VIDAL_ID), false);
      game = act(game, staged.actor, {
        type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 0, support: 0, weapon: staged.worthless.id,
      });
      game = act(game, staged.enemy, {
        type: 'battlePlan', leader: staged.defender, dial, support: dial,
      });
      assert.equal(game.battle!.plans[staged.actor].leader, DUKE_VIDAL_ID);
      assert.equal(game.battle!.plans[staged.actor].weapon, staged.worthless.id);
      const enemyWallet = player(game, 'emperor').spice;
      game = resolve(game, staged.actor, staged.enemy);
      // Duke6+normal1 ties Captain5+2: Ecaz attacks and wins. Hidden6 loses;
      // visible7 loses to5+3. Giving Duke the trainer's selected-disc+3 would
      // incorrectly win the last case. Every dial is paid/allocated natively.
      assert.equal(game.lastBattleContext!.winner, player(game, expectedWinner).id);
      assert.equal(player(game, 'emperor').spice, enemyWallet - (game.advanced ? dial : 0));
      assert.equal(game.dukeVidal!.leader.dead, false);
      assert.equal(game.dukeVidal!.leader.deaths, 0);
      assert.equal(game.dukeVidal!.leader.usedAt, 'wind_pass');
      assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
        [null, null, null]);
      assert.deepEqual(trainer(game), assignment);
      assert.deepEqual(player(game, 'ecaz').leaders, native);
      assert.equal(game.leaderSkills!.deck.includes('warmaster'), false);
      game = finishAdvancedNativeSkillAftermath(reload(game));
      assert.equal(game.battle, null);
      assert.equal(game.decision, null);
      assertEcazDukeSkillsCustody(game);
      const refreshed = reload(game);
      assert.deepEqual(refreshed.dukeVidal, game.dukeVidal);
      assert.deepEqual(viewGame(refreshed, staged.actor).dukeVidal, viewGame(game, staged.actor).dukeVidal);
      assert.deepEqual(trainer(refreshed), assignment);
    }
  });

  void test(`${rules} real Duke weapon death pays printed6 only and never kills or returns his separate native trainer`, () => {
    const staged = stageNativeEcazDukeSkillBattle(acquireNativeEcazSkillDuke(rules), true);
    const assignment = structuredClone(trainer(staged.game));
    const native = structuredClone(player(staged.game, 'ecaz').leaders);
    const skills = structuredClone(staged.game.leaderSkills);
    let game = openAdvancedNativeSkillBattle(reload(staged.game), staged.actor, staged.enemy, false);
    game = act(game, staged.actor, {
      type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 0, support: 0, weapon: staged.worthless.id,
    });
    game = act(game, staged.enemy, {
      type: 'battlePlan', leader: staged.defender, dial: 0, support: 0, weapon: staged.weapon!.id,
    });
    const wallets = Object.fromEntries(game.players.map(p => [p.id, p.spice]));
    game = resolve(game, staged.actor, staged.enemy);
    assert.equal(game.lastBattleContext!.winner, staged.enemy);
    assert.deepEqual(Object.fromEntries(game.players.map(p => [p.id, p.spice])),
      { ...wallets, [staged.enemy]: wallets[staged.enemy] + 6 });
    assert.equal(game.dukeVidal!.leader.dead, true);
    assert.equal(game.dukeVidal!.leader.deaths, 1);
    assert.equal(game.dukeVidal!.leader.strength, 6);
    assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
      [null, null, null]);
    assert.deepEqual(player(game, 'ecaz').leaders, native);
    assert.deepEqual(game.leaderSkills, skills);
    assert.deepEqual(trainer(game), assignment);
    assert.equal(game.leaderSkills!.deck.includes('warmaster'), false);
    game = finishAdvancedNativeSkillAftermath(reload(game));
    assert.equal(game.battle, null);
    assert.equal(game.decision, null);
    assert.equal(player(game, 'emperor').hand.some(c => c.id === staged.weapon!.id), true,
      'Native winner elects to keep the actual weapon.');
    assert.equal(game.discard.some(c => c.id === staged.worthless.id), true,
      'Native loser returns the real played Worthless to discard.');
    assertEcazDukeSkillsCustody(game);

    // Genuine next-turn phase transitions retain the actual battle death and
    // original wallet; no fake Tanks placement or hand/deck replacement.
    const deathTurn = game.turn;
    for (let i = 0; (game.turn === deathTurn || game.phase !== 4 || game.phaseOpening || game.response || game.decision)
      && i < 1000; i++) {
      if (game.decision?.kind === 'ecazPlacement')
        game = act(game, game.decision.player, { type: 'decision', decline: true });
      else game = advancedNativeStep(reload(game));
    }
    assert.equal(game.turn, deathTurn + 1);
    assert.equal(game.phase, 4);
    assert.equal(game.decision, null);
    const funds = player(game, 'ecaz').spice;
    const option = viewGame(game, staged.actor).revival.leaders.find(l => l.id === DUKE_VIDAL_ID)!;
    assert.equal(option.normalCost, 5);
    assert.equal(option.cost, 5);
    assert.equal(option.affordable, true);
    assert.equal(viewGame(game, staged.enemy).revival.leaders.some(l => l.id === DUKE_VIDAL_ID), false);
    reject(game, staged.enemy, { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
    game = act(game, staged.actor, { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
    for (let i = 0; (game.response || game.pendingRevival) && i < 100; i++)
      game = advancedNativeStep(reload(game));
    assert.equal(game.pendingRevival, null);
    assert.equal(player(game, 'ecaz').spice, funds - 5);
    assert.equal(player(game, 'ecaz').leaderRevived, true);
    assert.equal(game.dukeVidal!.leader.dead, false);
    assert.equal(game.dukeVidal!.leader.deaths, 1);
    assert.equal(game.dukeVidal!.leader.strength, 6);
    assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
      [null, null, null]);
    assert.equal(game.leaderSkills!.offers[staged.actor], undefined);
    assert.notEqual(game.decision?.kind, 'leaderSkillRevival');
    assert.deepEqual(trainer(game), assignment);
    assert.deepEqual(game.leaderSkills, skills);
    assert.equal(viewGame(game, staged.actor).leaderSkills!.eligibleLeaders.some(l => l.id === DUKE_VIDAL_ID), false);
    assertEcazDukeSkillsCustody(game);
    const refreshed = reload(game);
    assert.deepEqual(refreshed.dukeVidal, game.dukeVidal);
    // A subsequent original action accepts the refreshed paid-revival custody.
    assert.ok(refreshed.players.some(p => !refreshed.ready.includes(p.id)));
    const actor = refreshed.players.find(p => !refreshed.ready.includes(p.id))!.id;
    game = applyAction(refreshed, actor, { type: 'ready' });
    assertEcazDukeSkillsCustody(game);
    assert.deepEqual(trainer(game), assignment);
  });
}
