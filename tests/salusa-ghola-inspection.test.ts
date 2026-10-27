import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSalusaGholaFixture, actSalusaGhola as act,
  advanceSalusaGhola as advance, salusaGholaClean as clean,
  salusaGholaArmy as army, salusaGholaPlayer as p, salusaGholaInventory as inventory,
  type SalusaGholaFixture,
} from './fixture-salusa-ghola';

const sources = new Map<number,SalusaGholaFixture>();
function source(answer: 1|2) {
  let f = sources.get(answer);
  if (!f) {
    f = createSalusaGholaFixture({firstTerritory:'imperial_basin',inspectionDial:answer});
    sources.set(answer,f);
  }
  return f;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game,actor,action));
  assert.deepEqual(game,before);
}
function leader(game: Game, actor: string, strongest: boolean) {
  const choices = p(game,actor).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy);
  choices.sort((a,b) => strongest ? b.strength-a.strength : a.strength-b.strength);
  assert.ok(choices[0]); return choices[0].id;
}
function finish(f: SalusaGholaFixture, state: Game, dial: 1|2) {
  let game = act(state,f.actor,{type:'battlePlan',leader:leader(state,f.actor,true),dial,support:0});
  game = act(game,f.opponent,{type:'battlePlan',leader:leader(game,f.opponent,false),dial:0,support:0});
  return advance(game,g => !g.battle && clean(g));
}

void test('earned Basin-first source answers real Atreides dial Prescience before either plan is sealed', () => {
  const f = source(1), inspection = f.inspection;
  assert.ok(inspection);
  assert.equal(f.firstTerritory,'imperial_basin');
  assert.equal(f.firstOpponent,'guild');
  assert.equal(f.territory,'arrakeen');
  assert.equal(f.opponent,'atreides');
  assert.ok(viewGame(f.beforeFirstBattle,f.beforeFirstBattle.active!).battleChoices
    .some(choice => choice.territory === 'imperial_basin'));
  assert.equal(inspection.beforeDeclaration.battle!.preparation!.kind,'prescience');
  assert.equal(inspection.beforeDeclaration.battle!.preparation!.owner,'atreides');
  assert.equal(inspection.steps[0].actor,'atreides');
  assert.deepEqual(inspection.steps[0].action,{type:'prescience',field:'dial'});
  assert.equal(inspection.beforeAnswer.battle!.preparation!.owner,f.actor);
  assert.ok(inspection.steps.some(step => step.actor === f.actor &&
    step.action.type === 'prescienceAnswer' && step.action.value === 1));
  assert.equal(f.game.battle!.prescience!.player,'atreides');
  assert.equal(f.game.battle!.prescience!.field,'dial');
  assert.equal(f.game.battle!.prescience!.value,1);
  assert.deepEqual(f.game.battle!.plans,{});
  assert.equal(f.game.battle!.preparation,undefined);
  assert.equal(p(f.game).elites!.tanks,1);
  assert.deepEqual(army(f.game),{normal:0,elite:1});
  assert.equal(f.sourceCount,f.sourceActions.length);
  assert.deepEqual(inventory(f.game),f.original);
});

void test('Low Salusa rejection preserves the original native odd-dial Prescience answer', () => {
  const f = source(1);
  let game = structuredClone(f.game);
  reject(game,f.actor,f.action);
  assert.deepEqual(army(game),{normal:0,elite:1});
  assert.equal(game.battle!.event,f.game.battle!.event);
  assert.equal(game.battle!.prescience!.field,'dial');
  assert.equal(game.battle!.prescience!.player,'atreides');
  assert.equal(game.battle!.prescience!.value,1);
  assert.equal(game.battle!.preparation,undefined);
  assert.deepEqual(game.battle!.plans,{});
  assert.equal(viewGame(game,f.actor).battle!.ownForces!.eliteFreeSupport,undefined);
  assert.equal(game.discard.filter(c => c.id === f.card).length,0);
  assert.equal(p(game).elites!.tanks,1);
  reject(game,f.actor,{type:'battlePlan',leader:leader(game,f.actor,true),dial:2,support:0});
  game = finish(f,game,1);
  assert.equal(game.lastBattleContext!.winner,f.actor);
  assert.equal(p(game).elites!.tanks,2);
  assert.deepEqual(army(game),{normal:0,elite:1});
  assert.equal(game.discard.filter(c => c.id === f.card).length,0);
  assert.deepEqual(inventory(game),f.original);
});

void test('Low Salusa rejection retains a native dial2 answer and finishes without another inspection', () => {
  const f = source(2), before = structuredClone(f.game);
  assert.equal(f.game.battle!.prescience!.value,2);
  reject(before,f.actor,f.action);
  assert.equal(before.battle!.prescience!.value,2);
  assert.equal(before.battle!.preparation,undefined);
  const done = finish(f,before,2);
  assert.equal(done.lastBattleContext!.winner,f.actor);
  assert.equal(done.discard.filter(c => c.id === f.card).length,0);
  assert.deepEqual(inventory(done),f.original);
});

void test('all four minimal profiles honor the existing Salusa Prescience answer after rejection', () => {
  const f = source(1), pending = structuredClone(f.game);
  reject(pending,f.actor,f.action);
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = structuredClone(pending), view = viewGame(game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const action = botActions(view).find(action => action.type === 'battlePlan' && action.dial === 1);
    assert.ok(action,`${profile} needs a legal plan honoring the actual answered dial.`);
    const next = act(game,f.actor,action);
    assert.equal(next.battle!.prescience!.value,1);
    assert.equal(next.battle!.plans[f.actor].dial,1);
    assert.equal(next.discard.filter(c => c.id === f.card).length,0);
    assert.deepEqual(army(next),{normal:0,elite:1});
    assert.deepEqual(inventory(next),f.original);
  }
});
