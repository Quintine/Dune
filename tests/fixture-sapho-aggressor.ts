import assert from 'node:assert/strict';
import {applyAction, viewGame, type Game, type Action} from '../game/engine';
import {saphoBattleOrderGame, chooseSaphoBattleAction, resolveSaphoBattle, SAPHO_BATTLE_CARD} from './fixture-sapho-battle-order';
export function saphoAggressorGame(options: Parameters<typeof saphoBattleOrderGame>[0] = {}, configure?: (game: Game) => void) {
  const game = saphoBattleOrderGame({holder:'b',geometry:'separate',...options});
  configure?.(game);
  const choice = chooseSaphoBattleAction(game);
  let opened = applyAction(game,choice.player,choice.action);
  if(opened.decision?.kind==='fullPlanOffer') opened=applyAction(opened,opened.decision.player,{type:'decision',decline:true});
  return opened;
}
export function aggressorAction(game: Game, owner = game.battle!.defender): Action {
  const option = viewGame(game,owner).saphoOptions.find(o=>o.scope==='battleAggressor');
  assert.ok(option,'The owner must have a real pre-plan aggressor action.');
  return {type:'card',card:SAPHO_BATTLE_CARD,...option};
}
export function prepareAggressorPlans(state: Game) {
  let g=state;
  for(const id of [g.battle!.attacker,g.battle!.defender])
    if(!g.battle!.preLeader!.ready.includes(id))
      g=applyAction(g,id,{type:'battlePreparationReady',event:g.battle!.event});
  while(g.battle?.preparation)
    g=applyAction(g,g.battle.preparation.owner,{type:'declineBattlePower'});
  if(g.decision?.kind==='fullPlanOffer') g=applyAction(g,g.decision.player,{type:'decision',decline:true});
  assert.equal(g.decision,null); assert.equal(g.response,null);
  return g;
}
export function revealEqualAggressorPlans(state: Game, stoneOwner?: string) {
  let g=prepareAggressorPlans(state);
  for(const id of [g.battle!.attacker,g.battle!.defender]) {
    const leader=g.players.find(p=>p.id===id)!.leaders.find(l=>l.strength===3&&!l.dead)!;
    assert.ok(leader);
    g=applyAction(g,id,{type:'battlePlan',leader:leader.id,dial:0,support:0,
      ...(id===stoneOwner?{weapon:'richese-stone-burner'}:{})});
  }
  if(stoneOwner) g=applyAction(g,stoneOwner,{type:'decision',event:g.battle!.event,mode:'ignore'});
  return g;
}
export function finishAggressorBattle(state: Game) {
  let g=state;
  const combatants=[g.battle!.attacker,g.battle!.defender];
  for(const id of combatants) g=applyAction(g,id,{type:'traitorCall',call:false});
  return g.battle?resolveSaphoBattle(g):g;
}
