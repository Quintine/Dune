import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { guildTransportQuote } from '../game/transport-quote';
import {
  createSemutaAdvisorTransportMatchingFixture as fixture,
  actSemutaAdvisorTransportMatching as act, allowSemutaAdvisorTransportMatching as allow,
  finishSemutaAdvisorTransportMatching as finish, semutaAdvisorTransportMatchingPlayer as player,
  semutaAdvisorTransportMatchingInventory as inventory,
} from './fixture-semuta-advisor-transport-matching';

const advisorEntry: Action = {type:'guildShip',from:'arrakeen:10',territory:'tueks_sietch',
  sector:5,amount:1,elite:0,allyPayment:0};
function complete(game: Game) {
  for (let count=0;game.response && ['guildTransportPermission','guildRate'].includes(game.response.kind) && count<3;count++)
    game=allow(game);
  return finish(game);
}
function reject(game: Game, actor: string, action: Action) {
  const before=structuredClone(game);assert.throws(()=>applyAction(game,actor,action));assert.deepEqual(game,before);
}
function source() {
  const f=fixture({kind:'guild'}),game=structuredClone(f.beforeDeclaration);
  assert.equal(game.pendingAdvisorTransportMatching,undefined);
  assert.ok((player(game,f.guild).forces['tueks_sietch:5']??0)>0);
  assert.equal(player(game,f.owner).ally,f.guild);assert.equal(player(game,f.guild).ally,f.owner);
  assert.equal(isAdvisor(player(game,f.owner),'arrakeen'),true);
  assert.equal(player(game,f.owner).forces['arrakeen:10'],1);
  return {f,game};
}

void test('fresh Guild board transport quotes and delivers the actual advisor into its allied foreign group',()=>{
  const {f,game:before}=source();
  assert.deepEqual(guildTransportQuote(viewGame(before,f.owner),advisorEntry).unavailableReasons,[]);
  let game=act(before,f.owner,advisorEntry);
  assert.equal(game.response?.kind,'guildTransportPermission');assert.equal(game.pendingAdvisorTransportMatching,undefined);
  assert.equal(game.pendingGuildTransport?.advisorArrivalSource,'arrakeen');assert.equal(game.pendingGuildTransport?.advisors,true);
  assert.deepEqual(player(game,f.owner).forces,player(before,f.owner).forces);
  game=complete(game);
  assert.equal(player(game,f.owner).forces['arrakeen:10']??0,0);
  assert.equal(player(game,f.owner).forces['tueks_sietch:5'],1);assert.equal(isAdvisor(player(game,f.owner),'tueks_sietch'),true);
  assert.deepEqual(player(game,f.guild).forces,player(before,f.guild).forces);
  assert.equal(player(game,f.owner).spice,player(before,f.owner).spice-1);
  assert.equal(player(game,f.guild).spice,player(before,f.guild).spice+1);
  assert.equal(player(game,f.owner).shipped,true);assert.equal(player(game,f.owner).moved,0);
  assert.equal(game.pendingAutomaticAdvisorFlips,undefined);assert.deepEqual(inventory(game),f.originalInventory);
  reject(game,f.owner,advisorEntry);
});

void test('the source-stance cutover blocks fighter cross-entry and preserves the direct reserve default',()=>{
  const {f,game}=source();
  const fighter:Action={...advisorEntry,from:'imperial_basin:9'};
  assert.ok(guildTransportQuote(viewGame(game,f.owner),fighter).unavailableReasons.length>0);
  reject(game,f.owner,fighter);
  const reserve=act(game,f.owner,{type:'ship',territory:'tueks_sietch',sector:5,amount:1,elite:0,allyPayment:0});
  assert.ok(reserve.pendingShipment);assert.equal(reserve.pendingShipment.advisors,false);
  assert.equal('advisorArrivalSource' in reserve.pendingShipment,false);
});

void test('a fresh Guild advisor declaration rejects a changed source before payment or transfer',()=>{
  const {f,game:before}=source(),game=act(before,f.owner,advisorEntry);
  assert.ok(game.pendingGuildTransport);game.pendingGuildTransport.advisorArrivalSource='polar_sink';
  reject(game,f.holder,{type:'passResponse'});
});

void test('controlled legacy Guild permission bytes retain the original already-approved matching settlement',()=>{
  const f=fixture({kind:'guild'});let game=allow(structuredClone(f.game));
  assert.equal(game.response?.kind,'guildTransportPermission');const intent=game.pendingGuildTransport;assert.ok(intent);
  // Explicit format supplement to a genuine approved prefix. This is not a
  // historical saved-game capture and changes no physical source or approval.
  delete intent.advisorArrivalSource;
  const fields:unknown[]=[intent.event,intent.turn,intent.player,intent.fromReserves,intent.group,
    intent.eliteGroup,intent.origin,intent.to,intent.sector,intent.amount,intent.elite,
    intent.cost,intent.allyPayment,intent.advisors];
  if(intent.permission!==undefined)fields.push(intent.permission);
  intent.signature=JSON.stringify(fields);
  game=complete(game);
  assert.equal(player(game,f.owner).forces['imperial_basin:9'],1);
  assert.equal(player(game,f.owner).forces['arrakeen:10'],2);assert.equal(isAdvisor(player(game,f.owner),'arrakeen'),true);
  assert.equal(player(game,f.owner).shipped,true);assert.equal(player(game,f.owner).moved,0);
  assert.deepEqual(inventory(game),f.originalInventory);assert.equal(game.pendingGuildTransport??null,null);
});
