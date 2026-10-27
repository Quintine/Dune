import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

/** Controlled Advanced Ecaz/Moritani table with original physical markers.
 * It isolates the pre-existing Advanced overlap gate, not a played setup or
 * an assurance of every optional-module combination. */
function advancedTable(effect: 'fremen' | 'guild'): Game {
  const game = createGame('OVERLAPADVANCEDGATE', newPlayer('ec','Ecaz','ecaz'), true, ['ecaz']);
  game.players.push(newPlayer('m','Moritani','moritani'),newPlayer('in','Entrant','harkonnen'));
  Object.assign(game, {status:'playing',phase:5,turn:3,storm:18,active:'in',
    order:['ec','m','in'],movementRemaining:['ec','m','in'],deck:baseDeck()});
  for (const player of game.players)
    Object.assign(player,{hand:[],spice:20,forces:{},reserves:20,shipped:false,moved:0});
  const ambassadors = createAmbassadors(() => 0.2);
  const selected = ambassadors.tokens.find(token=>token.effect===effect); assert.ok(selected);
  ambassadors.cohort = [selected.id,...ambassadors.tokens.filter(token=>token.effect!=='ecaz' &&
    token.id!==selected.id).slice(0,4).map(token=>token.id)];
  for (const token of ambassadors.tokens) {
    token.zone = token.effect==='ecaz' || ambassadors.cohort.includes(token.id) ? 'supply' : 'pool';
    token.location = null;
  }
  game.ecazAmbassadors = placeAmbassador(ambassadors,selected.id,{turn:2,availableSpice:20,
    destination:{id:'arrakeen',stronghold:true,inStorm:false,allowed:true}}).state;
  const terror = createTerrorState(()=>0.2), token = terror.tokens.find(row=>row.kind==='robbery'); assert.ok(token);
  game.moritaniTerror = placeTerror(terror,token.id,'arrakeen',2);
  return game;
}

for (const effect of ['fremen','guild'] as const) {
  void test(`Advanced ${effect} Ambassador child stays gated during overlap`,()=>{
    const game = applyAction(advancedTable(effect),'in',{type:'ship',territory:'arrakeen',sector:10,amount:2});
    const entry = game.pendingAmbassador; assert.ok(entry);
    assert.equal(game.pendingArrivalOverlap?.first,'ambassador');
    const blocked = viewGame(game,'ec').ambassadorEntry?.beneficiaries[0].blocked;
    assert.match(blocked ?? '',/bare Basic faction preview/);
    const before = structuredClone(game);
    assert.throws(()=>applyAction(game,'ec',{type:'decision',event:entry.event,trigger:true,beneficiary:'ec'}),
      /bare Basic faction preview/);
    assert.deepEqual(game,before);
    let settled = applyAction(game,'ec',{type:'decision',event:entry.event,decline:true});
    assert.equal(settled.pendingTerrorEntry?.entrant,'in');
    settled = applyAction(settled,'m',{type:'decision',decline:true});
    assert.equal(settled.pendingArrivalOverlap,null);
  });
}
