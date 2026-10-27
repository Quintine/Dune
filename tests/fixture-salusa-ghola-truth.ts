import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { PlanClaim } from '../game/battle-promises';
import type { TruthQuestion } from '../game/truthtrance';
import {
  createSalusaGholaFixture, actSalusaGhola, advanceSalusaGhola, salusaGholaClean,
  salusaGholaPlayer, salusaGholaInventory, type SalusaGholaStep,
} from './fixture-salusa-ghola';

export const actSalusaGholaTruth = actSalusaGhola;
export const salusaGholaTruthPlayer = salusaGholaPlayer;
export const salusaGholaTruthInventory = salusaGholaInventory;
export const salusaGholaTruthClean = salusaGholaClean;

/** Original public source and native Truth protocol. The optional inspection
 * was really declared/answered before this original Truth card is used. No
 * binding, frozen answer, battle commitment or physical receipt is installed. */
export function createSalusaGholaTruthFixture(options: {
  claim?: PlanClaim; answer?: 'yes'|'no'; inspectionDial?: 1|2;
} = {}) {
  const base = createSalusaGholaFixture({firstTerritory:'imperial_basin',truthtrance:true,
    ...(options.inspectionDial === undefined ? {} : {inspectionDial:options.inspectionDial})});
  const actor = base.actor, opponent = base.opponent;
  assert.equal(opponent,'atreides');
  const truth = salusaGholaPlayer(base.game,opponent).hand.find(c => c.effect === 'truthtrance');
  assert.ok(truth);
  const claim: PlanClaim = structuredClone(options.claim ?? {kind:'dial',compare:'eq',value:2});
  const answer = options.answer ?? 'yes';
  const question: Extract<TruthQuestion,{kind:'battlePlan'}> = {
    kind:'battlePlan',target:actor,territory:base.territory,claim,
  };
  const actions: SalusaGholaStep[] = [...base.sourceActions], at = actions.length;
  let game = actSalusaGhola(structuredClone(base.game),opponent,{type:'card',card:truth.id},actions);
  const declared = structuredClone(game);
  for (let n = 0; game.truthtrance?.stage === 'priority' && n < game.players.length; n++) {
    const owner = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(owner);
    game = actSalusaGhola(game,owner.id,{type:'truthPass'},actions);
  }
  assert.equal(game.truthtrance?.stage,'ask');
  const beforeQuestion = structuredClone(game);
  game = actSalusaGhola(game,opponent,{type:'truthAsk',question},actions);
  const asked = structuredClone(game);
  assert.ok(viewGame(game,actor).truthBattleAnswers?.includes(answer),
    'The actual native Truth question must offer the requested definite answer.');
  game = actSalusaGhola(game,actor,{type:'truthAnswer',answer},actions);
  assert.equal(game.truthtrance,null);
  assert.deepEqual(game.battle!.plans,{});
  assert.equal(game.discard.filter(c => c.id === truth.id).length,1);
  assert.deepEqual(salusaGholaInventory(game),base.original);
  return {...base,base,game,source:structuredClone(game),actor,opponent,truthCard:truth.id,
    claim,answer,question,declared,beforeQuestion,asked,event:game.battle!.event!,
    actions,sourceActions:actions,sourceCount:actions.length,truthActions:actions.slice(at),
    disclosure:base.disclosure+' Atreides actually received its original unopened Truthtrance instead of Shield. Its native printed declaration, original priority passes, battle-plan question and Emperor definite answer create the live binding; no promise is installed.'};
}
export type SalusaGholaTruthFixture = ReturnType<typeof createSalusaGholaTruthFixture>;

export function salusaGholaTruthPlan(game: Game, dial = 2, support = 0): Action {
  const leaders = salusaGholaPlayer(game).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy)
    .sort((a,b) => b.strength-a.strength);
  assert.ok(leaders[0]);
  return {type:'battlePlan',leader:leaders[0].id,dial,support};
}

/** Actual native seals and calls only. It does not play Ghola or manufacture a
 * replacement inspection answer; the caller must finish the current chooser. */
export function finishSalusaGholaTruthBattle(f: SalusaGholaTruthFixture, state: Game,
  plan: Action = salusaGholaTruthPlan(state), actions: SalusaGholaStep[] = []) {
  let game = actSalusaGhola(state,f.actor,plan,actions);
  const afterPlan = structuredClone(game);
  const enemy = salusaGholaPlayer(game,f.opponent).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy)
    .sort((a,b) => a.strength-b.strength)[0]; assert.ok(enemy);
  game = actSalusaGhola(game,f.opponent,{type:'battlePlan',leader:enemy.id,dial:0,support:0},actions);
  const revealed = structuredClone(game);
  game = advanceSalusaGhola(game,g => !g.battle && salusaGholaClean(g),actions);
  return {game,afterPlan,revealed,actions};
}
