import test from 'node:test';
import assert from 'node:assert/strict';
import {viewGame,type Game} from '../game/engine';
import {unitStore} from './fixture-nexus-room-store';
import {saphoAggressorGame,aggressorAction} from './fixture-sapho-aggressor';
import {nextSaphoBattleAction,saphoBattleCustody,SAPHO_BATTLE_CARD} from './fixture-sapho-battle-order';
const clock={now:()=>87000,sleep:async()=>{}};
for(const advanced of [false,true]) void test(`authenticated ${advanced?'Advanced':'Basic'} aggressor races once, reconnects privately and completes the same battle`,async t=>{
 const f=unitStore();t.after(()=>f.sqlite.close());
 const made=await f.rooms.createRoom('Aggressor recovery','emperor',advanced,['choam']);const code=made.view.code;
 const tokens=[made.token,(await f.rooms.joinRoom(code,'Guild','guild')).token!,
  (await f.rooms.joinRoom(code,'Atreides','atreides')).token!, (await f.rooms.joinRoom(code,'Richese','richese')).token!];
 const auths=await Promise.all(tokens.map(token=>f.rooms.authenticate(code,token)));
 const ids=auths.map(a=>a.playerId) as [string,string,string,string];
 let game=saphoAggressorGame({advanced,seatIds:ids,holder:ids[1]});game.code=code;
 game.version=(await f.rooms.readRoom(code)).version;
 f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?').run(JSON.stringify(game),game.version,code);
 const seats=f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
 const action=aggressorAction(game,ids[1]);const event=game.battle!.event;
 const outcomes=await Promise.allSettled([f.rooms.act(code,auths[1],game.version,action,clock),f.restart().act(code,auths[1],game.version,action,clock)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 game=await f.restart().readRoom(code);assert.equal(game.battle!.saphoAggressor!.uses.length,1);
 assert.equal(game.discard.filter(c=>c.id===SAPHO_BATTLE_CARD).length,1);
 const rows=()=>f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').all(code);
 for(let step=0;step<100&&game.battle;step++){
  for(const [index,token] of tokens.entries()){
   const rooms=f.restart(),auth=await rooms.authenticate(code,token),view=await rooms.readSeatView(code,auth);
   assert.deepEqual(view,viewGame(JSON.parse(JSON.stringify(game)) as Game,ids[index]));
   assert.equal(view.battle!.aggressor,ids[1]);
   for(const rival of view.players.filter(p=>p.id!==auth.playerId))for(const field of ['hand','spice','traitors','prediction'])assert.equal(field in rival,false);
  }
  const before=rows();await assert.rejects(()=>f.restart().act(code,auths[1],game.version,action,clock));assert.deepEqual(rows(),before);
  const next=nextSaphoBattleAction(game);assert.ok(next);const index=ids.indexOf(next.player);
  await f.restart().act(code,auths[index],game.version,next.action,clock);game=await f.restart().readRoom(code);saphoBattleCustody(game);
 }
 assert.equal(game.battle,null);assert.equal(game.lastBattleContext!.event,event);assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),seats);
});
