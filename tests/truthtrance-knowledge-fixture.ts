import assert from 'node:assert/strict';
import { applyAction, createGame, initializeBaseGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { TruthFact } from '../game/truthtrance';

export function knowledgeBotActions(g:Game,id:string) {
  const view=viewGame(g,id);view.players.find(p=>p.id===id)!.bot='Medium';
  return botActions(view);
}

/** Real Basic/Advanced setup and locked BG prediction. Only the asker's physical
 * Truthtrance acquisition is staged; all other opening cards remain in custody. */
export function knowledgeGame(advanced = false, ids = ['a', 'b', 'f', 'o']) {
  let g = createGame('KNOWTEST', newPlayer(ids[0], 'Question holder', 'guild'), advanced, []);
  for (const [index, faction] of ['beneGesserit', 'fremen', 'atreides'].entries())
    joinGame(g, newPlayer(ids[index + 1], faction, faction as 'beneGesserit' | 'fremen' | 'atreides'));
  for (const p of g.players) p.ready = true;
  g = initializeBaseGameForAudit(g);
  g = applyAction(g, ids[1], { type: 'predict', faction: 'guild', turn: 7 });
  for (let n = 0; g.status !== 'playing' && n < 40; n++) {
    const candidate = g.players.flatMap(p => knowledgeBotActions(g,p.id).map(action => ({id:p.id,action})))[0];
    assert.ok(candidate,'A legal setup choice must be available');
    g = applyAction(g,candidate.id,candidate.action);
  }
  assert.equal(g.status,'playing');assert.equal(g.phase,0);
  const cards = [...g.deck,...g.players.flatMap(p=>p.hand)].filter(c=>c.effect==='truthtrance');
  assert.equal(cards.length,2);
  for (const card of cards) {
    g.deck = g.deck.filter(c=>c.id!==card.id);
    for (const p of g.players) p.hand = p.hand.filter(c=>c.id!==card.id);
    g.players[0].hand.push(card);
  }
  return g;
}

export function knownForecastGame(ids = ['a','b','f','o']) {
  let g = knowledgeGame(true,ids);
  for (const id of g.stormDialers) g=applyAction(g,id,{type:'stormDial',amount:0});
  for (let n=0;(g.phase===0||g.response?.kind==='stormPeek')&&n<40;n++) {
    const candidates=g.players.flatMap(p=>knowledgeBotActions(g,p.id).map(action=>({id:p.id,action})));
    const candidate=candidates.find(c=>c.action.type==='passResponse'||c.action.type==='ready');
    assert.ok(candidate,'Storm progression must have a pass/ready action');
    g=applyAction(g,candidate.id,candidate.action);
  }
  assert.equal(g.phase,1);assert.equal(g.stormCardKnown,true);
  return g;
}

export function askKnowledge(state:Game,target:string,fact:TruthFact) {
  const asker=state.players[0],card=asker.hand.find(c=>c.effect==='truthtrance')!;
  let g=applyAction(state,asker.id,{type:'card',card:card.id});
  while(g.truthtrance?.stage==='priority') {
    const p=g.players.find(p=>!g.truthtrance!.passed.includes(p.id))!;
    g=applyAction(g,p.id,{type:'truthPass'});
  }
  return applyAction(g,asker.id,{type:'truthAsk',question:{kind:'fact',target,fact}});
}
export function rejectKnowledge(g:Game,id:string,action:Action) {
  const before=structuredClone(g);assert.throws(()=>applyAction(g,id,action));assert.deepEqual(g,before);
}
export function knowledgePhysical(g:Game) {
  return {cards:[...g.deck,...g.discard,...g.players.flatMap(p=>p.hand)].map(c=>c.id).sort(),
    forces:g.players.map(p=>({id:p.id,total:p.reserves+p.tanks+Object.values(p.forces).reduce((a,b)=>a+b,0),elite:(p.elites?.reserves??0)+(p.elites?.tanks??0)+Object.values(p.elites?.forces??{}).reduce((a,b)=>a+b,0)}))};
}
