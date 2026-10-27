import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  createSalusaGholaTruthFixture as fixture, actSalusaGholaTruth as act,
  salusaGholaTruthPlayer as p, salusaGholaTruthInventory as inventory,
  salusaGholaTruthPlan as plan, finishSalusaGholaTruthBattle as finish,
  type SalusaGholaTruthFixture,
} from './fixture-salusa-ghola-truth';
import { salusaGholaArmy as army } from './fixture-salusa-ghola';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game,actor,action));
  assert.deepEqual(game,before);
}
function binding(game: Game, f: SalusaGholaTruthFixture) {
  assert.deepEqual(game.battle!.truthPromises,[{player:f.actor,asker:f.opponent,
    claim:f.claim,answer:f.answer === 'yes'}]);
  assert.equal(game.discard.filter(c => c.id === f.truthCard).length,1);
  assert.equal(game.truthHistory!.at(-1)!.answer,f.answer);
  assert.deepEqual(game.truthHistory!.at(-1)!.question,f.question);
  assert.deepEqual(inventory(game),f.base.original);
}
function done(game: Game, f: SalusaGholaTruthFixture, gholaUsed: boolean) {
  assert.equal(game.battle,null);
  assert.equal(game.lastBattleContext!.winner,f.actor);
  assert.equal(game.discard.filter(c => c.id === f.truthCard).length,1);
  assert.equal(game.discard.filter(c => c.id === f.card).length,Number(gholaUsed));
  assert.equal(game.truthHistory!.at(-1)!.answer,f.answer);
  assert.deepEqual(game.truthHistory!.at(-1)!.question,f.question);
  assert.deepEqual(inventory(game),f.base.original);
}

void test('earned native Truth Yes dial2 permits Salusa Ghola and preserves its original binding through the actual plan', () => {
  const f = fixture();
  assert.equal(p(f.base.afterSetup,f.opponent).hand[0].id,f.truthCard);
  assert.equal(f.base.beforeDeal.players.every(p => p.hand.length === 0),true);
  assert.equal(f.truthActions.filter(s => s.action.type === 'card').length,1);
  assert.equal(f.truthActions.filter(s => s.action.type === 'truthAsk').length,1);
  assert.equal(f.truthActions.filter(s => s.action.type === 'truthAnswer').length,1);
  assert.equal(f.sourceCount,f.sourceActions.length);
  assert.deepEqual(f.game.battle!.plans,{});
  binding(f.game,f);
  const game = act(structuredClone(f.game),f.actor,f.action);
  assert.deepEqual(army(game),{normal:0,elite:2});
  assert.equal(p(game).elites!.tanks,0);
  binding(game,f);
  const result = finish(f,game);
  assert.equal(result.afterPlan.battle!.plans[f.actor].dial,2);
  assert.equal(result.afterPlan.battle!.plans[f.actor].support,0);
  assert.equal(result.revealed.battle!.truthPromises![0].released,undefined);
  done(result.game,f,true);
});

void test('earned native Truth No dial1 remains feasible after Salusa Ghola without releasing its aggregate answer', () => {
  const f = fixture({claim:{kind:'dial',compare:'eq',value:1},answer:'no'});
  const game = act(structuredClone(f.game),f.actor,f.action);
  assert.deepEqual(army(game),{normal:0,elite:2});
  binding(game,f);
  const result = finish(f,game,plan(game,2,0));
  assert.equal(result.revealed.battle!.truthPromises![0].answer,false);
  assert.equal(result.revealed.battle!.truthPromises![0].released,undefined);
  done(result.game,f,true);
});

void test('earned native Truth Yes odd1 rejects Salusa Ghola before cost and can finish dial1 before later printed use', () => {
  const f = fixture({claim:{kind:'dial',compare:'eq',value:1}});
  binding(f.game,f);
  reject(f.game,f.actor,f.action);
  assert.deepEqual(army(f.game),{normal:0,elite:1});
  assert.equal(p(f.game).elites!.tanks,1);
  assert.ok(p(f.game).hand.some(c => c.id === f.card));
  assert.equal(f.game.discard.some(c => c.id === f.card),false);
  const result = finish(f,structuredClone(f.game),plan(f.game,1,0));
  assert.equal(result.afterPlan.battle!.plans[f.actor].dial,1);
  done(result.game,f,false);
  const returned = act(result.game,f.actor,f.action);
  assert.deepEqual(army(returned),{normal:0,elite:2});
  assert.equal(returned.discard.filter(c => c.id === f.card).length,1);
  assert.deepEqual(inventory(returned),f.base.original);
});

void test('earned native Truth Yes paid support rejects Salusa Ghola while the original supported plan stays legal', () => {
  const f = fixture({claim:{kind:'support',compare:'gte',value:1}});
  binding(f.game,f);
  reject(f.game,f.actor,f.action);
  assert.deepEqual(army(f.game),{normal:0,elite:1});
  assert.equal(p(f.game).elites!.tanks,1);
  const result = finish(f,structuredClone(f.game),plan(f.game,2,1));
  assert.equal(result.afterPlan.battle!.plans[f.actor].support,1);
  assert.equal(result.afterPlan.battle!.plans[f.actor].dial,2);
  done(result.game,f,false);
});

void test('earned grouped Truth Yes odd1 or even2 keeps its live even alternative after Salusa Ghola', () => {
  const f = fixture({claim:{kind:'or',terms:[
    {kind:'dial',compare:'eq',value:1},{kind:'dial',compare:'eq',value:2},
  ]}});
  const game = act(structuredClone(f.game),f.actor,f.action);
  binding(game,f);
  assert.deepEqual(army(game),{normal:0,elite:2});
  const result = finish(f,game,plan(game,2,0));
  assert.deepEqual(result.revealed.battle!.truthPromises![0].claim,f.claim);
  assert.equal(result.revealed.battle!.truthPromises![0].released,undefined);
  done(result.game,f,true);
});

void test('earned Prescience odd1 and native Truth Yes even2 can renew the inspection through actual Salusa Ghola', () => {
  const f = fixture({inspectionDial:1});
  assert.ok(f.base.inspection);
  assert.equal(f.base.inspection.answered.battle!.prescience!.value,1);
  assert.equal(f.game.battle!.prescience!.value,1);
  binding(f.game,f);
  let game = act(structuredClone(f.game),f.actor,f.action);
  assert.deepEqual(army(game),{normal:0,elite:2});
  binding(game,f);
  assert.equal(Object.hasOwn(game.battle!.prescience!,'value'),false);
  assert.equal(game.battle!.preparation?.kind,'prescienceAnswer');
  assert.equal(game.battle!.preparation?.owner,f.actor);
  reject(game,f.actor,{type:'prescienceAnswer',value:1});
  game = act(game,f.actor,{type:'prescienceAnswer',value:2});
  assert.equal(game.battle!.prescience!.value,2);
  binding(game,f);
  const result = finish(f,game,plan(game,2,0));
  done(result.game,f,true);
});
