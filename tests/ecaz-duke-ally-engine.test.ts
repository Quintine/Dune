import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actEcazDukeAlly, advanceEcazDukeAlly, battleEcazDukeAlly, createEcazDukeAllyFixture,
  ecazDukeAllyClean, ecazDukeAllyInventory, ecazDukeAllyPhysical,
  ecazDukeAllyPlayer as player, finishEcazDukeAlly, grantEcazDukeAlly,
} from './fixture-ecaz-duke-ally';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actEcazDukeAlly(game, actor, action));
  assert.deepEqual(game, before);
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native already-allied Ecaz Ambassador transfers its held ordinary Duke to the ally`, () => {
    const f = createEcazDukeAllyFixture({ advanced });
    assert.equal(f.game.status, 'playing');
    assert.equal(f.game.turn, 2);
    assert.equal(f.game.phase, 5);
    assert.equal(f.game.active, f.entrant);
    assert.equal(f.game.pendingAmbassador!.stage, 'offer');
    assert.equal(f.game.pendingAmbassador!.owner, f.owner);
    assert.equal(f.game.pendingAmbassador!.entrant, f.entrant);
    assert.equal(f.game.pendingAmbassador!.token, f.token);
    assert.equal(f.game.pendingAmbassador!.territory, 'carthag');
    assert.equal(f.game.response ?? null, null);
    assert.equal(f.game.phaseOpening ?? null, null);
    assert.equal(f.game.battle, null);
    assert.equal(player(f.game, f.owner).ally, f.ally);
    assert.equal(player(f.game, f.ally).ally, f.owner);
    assert.equal(player(f.game, f.entrant).ally, null);
    assert.deepEqual([f.afterSelf.dukeVidal!.controller, f.afterSelf.dukeVidal!.source, f.afterSelf.dukeVidal!.acquiredTurn],
      [f.owner, 'ecaz', 1]);
    assert.equal(f.afterMentat.dukeVidal!.controller, f.owner);
    assert.deepEqual([f.game.dukeVidal!.controller, f.game.dukeVidal!.source, f.game.dukeVidal!.acquiredTurn],
      [f.owner, 'ecaz', 1]);
    assert.equal(f.placements.length, 2);
    assert.ok(f.placements.every(placement => placement.action.token === f.token));
    assert.equal(f.shipments.length, 3);
    assert.equal(f.shipments[0].step.action.territory, 'habbanya_ridge_sietch');
    assert.equal(f.shipments[1].step.actor, f.ally);
    assert.equal(f.shipments[2].step.actor, f.entrant);
    assert.ok(f.alliance.actions.some(step => step.actor === f.owner && step.action.type === 'alliance'));
    assert.ok(f.alliance.actions.some(step => step.actor === f.ally && step.action.type === 'alliance'));
    const offer = viewGame(f.game, f.owner).ambassadorEntry;
    assert.ok(offer);
    assert.ok(offer.beneficiaries!.find(target => target.player === f.owner)!.blocked);
    assert.equal(offer.beneficiaries!.find(target => target.player === f.ally)!.blocked, null);
    assert.equal(player(f.game, f.ally).forces['carthag:11'], 1);
    assert.equal(player(f.game, f.entrant).forces['carthag:11'], 1);
    assert.equal(f.sourceActionCount, f.actions.length);
    assert.deepEqual(ecazDukeAllyInventory(f.game), f.originalInventory);
    let game = grantEcazDukeAlly(f);
    game = finishEcazDukeAlly(f, game);
    assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
      [f.ally, 'ecaz', 2]);
    assert.deepEqual(game.dukeVidal!.leader, f.originalDuke.leader);
    assert.ok(game.log.filter(entry => entry.text.includes('acquired Duke Prad Vidal')).at(-1)!.text
      .startsWith(`${player(game, f.ally).name} acquired Duke Prad Vidal`));
    assert.deepEqual(ecazDukeAllyPhysical(game), f.originalPhysical,
      'Only the existing shared disc controller changes after the already-paid native entry');
    assert.equal(game.pendingAmbassador ?? null, null);
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'supply');
    assert.deepEqual(game.ecazAmbassadors!.cohort, f.cohort);
    assert.deepEqual(ecazDukeAllyInventory(game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} native existing-ally ordinary Duke fights once and releases the same living shared disc`, () => {
    const f = createEcazDukeAllyFixture({ advanced });
    const granted = finishEcazDukeAlly(f, grantEcazDukeAlly(f));
    const beforeRosters = granted.players.map(seat => ({ id: seat.id, leaders: seat.leaders.map(leader => leader.id) }));
    const fought = battleEcazDukeAlly(f, granted);
    assert.equal(fought.beforePlans.dukeVidal!.controller, f.ally);
    assert.equal(fought.beforePlans.dukeVidal!.source, 'ecaz');
    assert.equal(fought.plans[0].actor, f.ally);
    assert.equal(fought.plans[0].action.leader, f.duke);
    assert.equal(fought.sealed.battle!.plans[f.ally].leader, f.duke);
    assert.equal(fought.game.battle, null);
    assert.equal(fought.game.lastBattleContext!.winner, f.ally);
    assert.equal(fought.game.lastBattleContext!.territory, 'carthag');
    assert.deepEqual([fought.game.dukeVidal!.controller, fought.game.dukeVidal!.source, fought.game.dukeVidal!.acquiredTurn],
      [null, null, null]);
    assert.equal(fought.game.dukeVidal!.leader.id, f.duke);
    assert.equal(fought.game.dukeVidal!.leader.dead, false);
    assert.equal(fought.game.dukeVidal!.leader.deaths, f.originalDuke.leader.deaths);
    assert.equal(player(fought.game, f.ally).forces['carthag:11'], 1);
    assert.equal(player(fought.game, f.opponent).forces['carthag:11'] ?? 0, 0);
    assert.deepEqual(fought.game.players.map(seat => ({ id: seat.id, leaders: seat.leaders.map(leader => leader.id) })), beforeRosters);
    assert.deepEqual(ecazDukeAllyInventory(fought.game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} unused existing-ally direct acquisition persists through a real native battle and next Mentat`, () => {
    const f = createEcazDukeAllyFixture({ advanced });
    const granted = finishEcazDukeAlly(f, grantEcazDukeAlly(f));
    const fought = battleEcazDukeAlly(f, granted, [], { useDuke: false });
    assert.notEqual(fought.plans[0].action.leader, f.duke);
    assert.deepEqual(fought.game.dukeVidal, granted.dukeVidal);
    const nextTurn = advanceEcazDukeAlly(fought.game, state => state.turn === 3 && state.phase === 1 && ecazDukeAllyClean(state));
    assert.equal(nextTurn.turn, 3);
    assert.deepEqual([nextTurn.dukeVidal!.controller, nextTurn.dukeVidal!.source, nextTurn.dukeVidal!.acquiredTurn],
      [f.ally, 'ecaz', 2]);
    assert.deepEqual(nextTurn.dukeVidal!.leader, granted.dukeVidal!.leader);
    assert.equal(player(nextTurn, f.owner).ally, f.ally);
    assert.equal(player(nextTurn, f.ally).ally, f.owner);
    assert.deepEqual(ecazDukeAllyInventory(nextTurn), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} live Ecaz Duke entry rejects foreign, stale, self-held and nonally beneficiaries before consuming its token`, () => {
    const f = createEcazDukeAllyFixture({ advanced });
    rejected(f.game, f.ally, f.action);
    rejected(f.game, f.entrant, f.action);
    rejected(f.game, f.owner, { ...f.action, event: 'stale' });
    rejected(f.game, f.owner, { ...f.action, beneficiary: f.owner });
    rejected(f.game, f.owner, { ...f.action, beneficiary: f.entrant });
    rejected(f.game, f.owner, { ...f.action, beneficiary: 'guild' });
    assert.equal(player(f.beforeSelf, f.owner).ally, null);
    assert.equal(player(f.beforeSelf, f.ally).ally, null);
    rejected(f.beforeSelf, f.owner, { ...f.action, event: f.beforeSelf.pendingAmbassador!.event });
    assert.deepEqual(f.game.dukeVidal, f.originalDuke);
    assert.deepEqual(f.game.pendingAmbassador, f.originalParent);
    assert.deepEqual(ecazDukeAllyPhysical(f.game), f.originalPhysical);
    assert.equal(f.game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'placed');
    const granted = finishEcazDukeAlly(f, grantEcazDukeAlly(f));
    rejected(granted, f.owner, f.action);
    assert.deepEqual(ecazDukeAllyInventory(granted), f.originalInventory);
  });
}

void test('four minimal owner profiles choose the actual existing ally when Ecaz already holds the shared Duke', () => {
  for (const advanced of [false, true]) {
    const f = createEcazDukeAllyFixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.owner);
      view.players.find(seat => seat.id === f.owner)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.deepEqual(action, f.action, `${advanced}/${difficulty}`);
      const game = finishEcazDukeAlly(f, actEcazDukeAlly(structuredClone(f.game), f.owner, action));
      assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
        [f.ally, 'ecaz', 2]);
      assert.deepEqual(game.dukeVidal!.leader, f.originalDuke.leader);
      assert.deepEqual(ecazDukeAllyPhysical(game), f.originalPhysical);
      assert.deepEqual(ecazDukeAllyInventory(game), f.originalInventory);
    }
  }
});
