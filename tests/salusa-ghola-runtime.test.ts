import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSalusaGholaFixture, playSalusaGholaBattle, actSalusaGhola as act,
  salusaGholaPlayer as p, salusaGholaArmy as army,
  salusaGholaInventory as inventory, type SalusaGholaFixture,
} from './fixture-salusa-ghola';

let earned: SalusaGholaFixture|undefined;
const fixture = () => earned ??= createSalusaGholaFixture();
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game,actor,action));
  assert.deepEqual(game,before);
}

void test('earned public Salusa source has one actual Sardaukar casualty and a later live commitment-free battle', () => {
  const f = fixture();
  assert.equal(f.initial.status,'lobby');
  assert.deepEqual(f.initial.players.map(p => p.faction),['emperor','atreides','guild']);
  assert.ok(f.lobby.homeworlds); assert.equal(f.setup.status,'setup');
  assert.ok(f.beforeDeal.players.every(p => p.hand.length === 0));
  assert.equal(f.afterSetup.advanced,true);
  assert.deepEqual(f.afterSetup.expansions,[]);
  assert.ok(!f.afterSetup.nexusCards && !f.afterSetup.leaderSkills && !f.afterSetup.discoveryEnabled);
  assert.equal(p(f.afterSetup).hand[0].id,f.card);
  assert.deepEqual(army(f.afterSetup),{normal:0,elite:5});
  assert.equal(f.original.cards.length,33);
  assert.equal(f.sourceCount,f.sourceActions.length);
  const ship = f.shipments.find(s => s.steps[0].actor === f.actor)!;
  assert.ok(ship);
  assert.equal(ship.steps[0].action.type,'ship');
  assert.equal(ship.steps[0].action.amount,4);
  assert.equal(ship.steps[0].action.elite,4);
  assert.equal(p(ship.before).spice-p(ship.after).spice,8);
  assert.deepEqual(army(ship.after),{normal:0,elite:1});
  assert.equal(f.movement.steps[0].action.type,'move');
  assert.equal(f.movement.steps[0].action.amount,2);
  assert.equal(f.movement.steps[0].action.elite,2);
  assert.ok(f.firstActions.filter(s => s.action.type === 'battlePlan').length === 2);
  assert.equal(f.firstResolution.lastBattleContext!.winner,f.actor);
  assert.equal(p(f.firstResolution).tanks,1);
  assert.equal(p(f.firstResolution).elites!.tanks,1);
  assert.equal(p(f.firstBeforePlans).spice-p(f.firstResolution).spice,1);
  assert.equal(f.game.battle!.territory,f.territory);
  assert.deepEqual(f.game.battle!.plans,{});
  assert.equal(f.game.battle!.revealed,false);
  assert.equal(f.game.truthtrance ?? null,null);
  assert.equal(f.game.turnActionPromises,undefined);
  assert.equal(viewGame(f.game,f.actor).battle!.ownForces!.elite,2);
  assert.equal(viewGame(f.game,f.actor).battle!.ownForces!.eliteFreeSupport,undefined);
  assert.deepEqual(army(f.game),{normal:0,elite:1});
  assert.deepEqual(inventory(f.game),f.original);
  assert.match(f.disclosure,/Original public.*No later phase, force, purse, Tank, hand, battle commitment or receipt is installed/);
});

void test('actual uncommitted-battle Ghola returns the dead Sardaukar to Salusa2 and immediately changes the native support view', () => {
  const f = fixture(), before = structuredClone(f.game);
  reject(before,f.opponent,f.action);
  const game = act(before,f.actor,f.action), player = p(game);
  assert.deepEqual(army(game),{normal:0,elite:2});
  assert.equal(player.tanks,p(before).tanks-1);
  assert.equal(player.elites!.tanks,p(before).elites!.tanks-1);
  assert.equal(player.reserves,p(before).reserves+1);
  assert.equal(player.elites!.reserves,p(before).elites!.reserves+1);
  assert.equal(player.spice,p(before).spice);
  assert.deepEqual(player.forces,p(before).forces);
  assert.deepEqual(player.elites!.forces,p(before).elites!.forces);
  assert.deepEqual(game.battle!.plans,{});
  assert.equal(game.battle!.event,before.battle!.event);
  assert.equal(viewGame(game,f.actor).battle!.ownForces!.eliteFreeSupport,true);
  assert.equal(viewGame(game,f.actor).battle!.ownForces!.elite,2);
  assert.equal(game.discard.filter(c => c.id === f.card).length,1);
  assert.equal(player.hand.some(c => c.id === f.card),false);
  reject(game,f.actor,f.action);
  assert.deepEqual(inventory(game),f.original);
});

void test('native plans and calls after Salusa Ghola use zero-spice support and settle actual star casualties', () => {
  const f = fixture(), result = playSalusaGholaBattle(f);
  assert.deepEqual(army(result.returned),{normal:0,elite:2});
  assert.equal(result.afterPlan.battle!.plans[f.actor].support,0);
  assert.equal(result.afterPlan.battle!.plans[f.actor].dial,2);
  assert.equal(p(result.afterPlan).spice,p(result.returned).spice);
  assert.equal(result.game.lastBattleContext!.winner,f.actor);
  assert.equal(result.game.lastBattleContext!.territory,f.territory);
  assert.equal(result.game.battle,null);
  assert.equal(p(result.game).elites!.tanks,1);
  assert.deepEqual(army(result.game),{normal:0,elite:2});
  assert.equal(result.actions.filter(s => s.action.type === 'battlePlan').length,2);
  assert.equal(result.actions.filter(s => s.action.type === 'traitorCall').length,2);
  assert.equal(result.game.discard.filter(c => c.id === f.card).length,1);
  assert.deepEqual(inventory(result.game),f.original);
});

void test('all four minimal policies propose legal native plans after the actual Salusa Ghola return', () => {
  const f = fixture(), returned = act(structuredClone(f.game),f.actor,f.action);
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = structuredClone(returned), view = viewGame(game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const plans = botActions(view).filter(action => action.type === 'battlePlan');
    assert.ok(plans.length,`${profile} needs a legal current Battle Plan.`);
    for (const plan of plans) {
      assert.equal(plan.support ?? 0,0);
      const next = act(game,f.actor,plan);
      assert.ok(next.battle!.plans[f.actor]);
      assert.deepEqual(army(next),{normal:0,elite:2});
      assert.equal(next.discard.filter(c => c.id === f.card).length,1);
      assert.deepEqual(inventory(next),f.original);
    }
  }
});
