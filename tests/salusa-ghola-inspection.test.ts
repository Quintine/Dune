import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSalusaGholaFixture, playSalusaGholaBattle, actSalusaGhola as act,
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
function finish(f: SalusaGholaFixture, state: Game) {
  let game = act(state,f.actor,{type:'battlePlan',leader:leader(state,f.actor,true),dial:2,support:0});
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

void test('actual Ghola invalidates an impossible old odd dial and requires owned legal reanswer before native plans', () => {
  const f = source(1);
  let game = act(structuredClone(f.game),f.actor,f.action);
  assert.deepEqual(army(game),{normal:0,elite:2});
  assert.equal(game.battle!.event,f.game.battle!.event);
  assert.equal(game.battle!.prescience!.field,'dial');
  assert.equal(game.battle!.prescience!.player,'atreides');
  assert.equal(Object.hasOwn(game.battle!.prescience!,'value'),false);
  assert.equal(game.battle!.preparation?.kind,'prescienceAnswer');
  assert.equal(game.battle!.preparation?.owner,f.actor);
  assert.equal(game.battle!.preparation?.beneficiary,'atreides');
  assert.deepEqual(game.battle!.plans,{});
  assert.equal(viewGame(game,f.actor).battle!.ownForces!.eliteFreeSupport,true);
  assert.equal(game.discard.filter(c => c.id === f.card).length,1);
  assert.equal(p(game).elites!.tanks,0);
  reject(game,f.actor,{type:'battlePlan',leader:leader(game,f.actor,true),dial:1,support:0});
  reject(game,f.actor,{type:'prescienceAnswer',value:1});
  reject(game,f.opponent,{type:'prescienceAnswer',value:2});
  game = act(game,f.actor,{type:'prescienceAnswer',value:2});
  assert.equal(game.battle!.prescience!.value,2);
  assert.equal(game.battle!.preparation,undefined);
  assert.equal(p(game).elites!.tanks,0);
  game = finish(f,game);
  assert.equal(game.lastBattleContext!.winner,f.actor);
  assert.equal(p(game).elites!.tanks,1);
  assert.deepEqual(army(game),{normal:0,elite:2});
  assert.equal(game.discard.filter(c => c.id === f.card).length,1);
  assert.deepEqual(inventory(game),f.original);
});

void test('actual Ghola retains a still-feasible native dial2 answer and finishes without another inspection', () => {
  const f = source(2), result = playSalusaGholaBattle(f);
  assert.equal(f.game.battle!.prescience!.value,2);
  assert.equal(result.returned.battle!.prescience!.value,2);
  assert.equal(result.returned.battle!.preparation,undefined);
  assert.equal(result.returned.battle!.prescience!.player,'atreides');
  assert.equal(result.afterPlan.battle!.plans[f.actor].dial,2);
  assert.equal(result.afterPlan.battle!.plans[f.actor].support,0);
  assert.equal(result.actions.filter(step => step.action.type === 'prescience' ||
    step.action.type === 'prescienceAnswer').length,0);
  assert.equal(result.game.lastBattleContext!.winner,f.actor);
  assert.equal(result.game.discard.filter(c => c.id === f.card).length,1);
  assert.deepEqual(inventory(result.game),f.original);
});

void test('all four minimal profiles can supply a legal current Salusa Prescience reanswer', () => {
  const f = source(1), pending = act(structuredClone(f.game),f.actor,f.action);
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = structuredClone(pending), view = viewGame(game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const action = botActions(view).find(action => action.type === 'prescienceAnswer');
    assert.ok(action,`${profile} needs the actual owned reanswer action.`);
    assert.notEqual(action.value,1);
    const next = act(game,f.actor,action);
    assert.equal(next.battle!.prescience!.value,action.value);
    assert.equal(next.battle!.preparation,undefined);
    assert.deepEqual(next.battle!.plans,{});
    assert.equal(next.discard.filter(c => c.id === f.card).length,1);
    assert.deepEqual(army(next),{normal:0,elite:2});
    assert.deepEqual(inventory(next),f.original);
  }
});
