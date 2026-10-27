import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSalusaGholaFixture, actSalusaGhola as act,
  advanceSalusaGhola as advance, salusaGholaClean as clean,
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

void test('earned Low Salusa rejects a free Sardaukar Ghola without changing the physical battle or card', () => {
  const f = fixture(), before = structuredClone(f.game);
  reject(before,f.opponent,f.action);
  reject(before,f.actor,f.action);
  const view = viewGame(before,f.actor);
  assert.match(view.ghola.eliteBlock!,/Salusa.*free Sardaukar/i);
  assert.equal(view.ghola.eliteRemaining,0);
  assert.deepEqual(army(before),{normal:0,elite:1});
  assert.equal(p(before).elites!.tanks,1);
  assert.deepEqual(before.battle!.plans,{});
  assert.equal(view.battle!.ownForces!.eliteFreeSupport,undefined);
  assert.ok(p(before).hand.some(c => c.id === f.card));
  assert.equal(before.discard.filter(c => c.id === f.card).length,0);
  assert.deepEqual(inventory(before),f.original);
});

void test('native battle continues legally after the Low Salusa Ghola rejection', () => {
  const f = fixture(); let game = structuredClone(f.game);
  reject(game,f.actor,f.action);
  const own = p(game,f.actor).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy).sort((a,b) => b.strength-a.strength)[0];
  const enemy = p(game,f.opponent).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy).sort((a,b) => a.strength-b.strength)[0];
  assert.ok(own && enemy);
  game = act(game,f.actor,{type:'battlePlan',leader:own.id,dial:2,support:0});
  assert.equal(game.battle!.plans[f.actor].dial,2);
  game = act(game,f.opponent,{type:'battlePlan',leader:enemy.id,dial:0,support:0});
  game = advance(game,g => !g.battle && clean(g));
  assert.equal(game.lastBattleContext!.winner,f.actor);
  assert.equal(game.lastBattleContext!.territory,f.territory);
  assert.deepEqual(army(game),{normal:0,elite:1});
  assert.ok(p(game).hand.some(c => c.id === f.card));
  assert.equal(game.discard.filter(c => c.id === f.card).length,0);
  assert.deepEqual(inventory(game),f.original);
});

void test('all four minimal policies propose legal native plans without a blocked Low Salusa Ghola return', () => {
  const f = fixture();
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = structuredClone(f.game), view = viewGame(game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const plans = botActions(view).filter(action => action.type === 'battlePlan');
    assert.ok(plans.length,`${profile} needs a legal current Battle Plan.`);
    for (const plan of plans) {
      const next = act(game,f.actor,plan);
      assert.ok(next.battle!.plans[f.actor]);
      assert.deepEqual(army(next),{normal:0,elite:1});
      assert.ok(p(next).hand.some(c => c.id === f.card));
      assert.deepEqual(inventory(next),f.original);
    }
  }
});
