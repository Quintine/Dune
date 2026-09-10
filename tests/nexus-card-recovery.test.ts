import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import * as engine from '../game/engine';
import type * as Rooms from '../db/rooms';
import { nexusTurnTwo, nexusReady, orderNexusSpice, finishNexusSpice, nexusInventory } from './fixture-nexus-cards';




const clock: Rooms.RoomsClock = { now: () => 10000, sleep: async () => {} };
async function persisted() {
  const store = unitStore();
  const made = await store.rooms.createRoom('Nexus SQL QA', 'fremen', false, []);
  const code = made.view.code;
  const credentials = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    credentials.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(credentials.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId) as [string,string,string];
  let initial = nexusTurnTwo({seatIds:ids});
  orderNexusSpice(initial, ['worm','land']);
  initial = nexusReady(nexusReady(initial));
  initial = engine.applyAction(initial, ids[0], {type:'alliance',target:ids[1]});
  initial = engine.applyAction(initial, ids[1], {type:'alliance',target:ids[0]});
  initial = finishNexusSpice(initial);
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  const cards = initial.nexusCards!.cards!;
  cards.deck = ['harkonnen','ecaz',...cards.deck.filter(card => !['harkonnen','ecaz'].includes(card))];
  const save = (state: engine.Game) => store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(state),state.version,code);
  save(initial);
  const other = await store.rooms.createRoom('Untouched Nexus room','fremen',false,[]);
  const otherBefore = await store.rooms.readRoom(other.view.code);
  store.writes.length = 0;
  return {...store,code,credentials,auths,ids,initial,save,otherCode:other.view.code,otherBefore};
}
type Fixture = Awaited<ReturnType<typeof persisted>> & { sqlite: DatabaseSync };
function snapshot(f: Fixture) {
  const row = f.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(f.code)!;
  return {version:row.version,hash:createHash('sha256').update(String(row.state)).digest('hex')};
}
function draw(f:Fixture, ownRedraws=0):engine.Action {
  return {type:'nexusCardChoice',turn:f.initial.turn,card:null,choice:'draw',ownRedraws};
}
async function restored(f:Fixture,g:engine.Game) {
  const before=snapshot(f), rooms=f.restart();
  for (const [i,token] of f.credentials.entries()) {
    const auth=await rooms.authenticate(f.code,token);
    const view=await rooms.readSeatView(f.code,auth);
    assert.deepEqual(view,engine.viewGame(g,f.ids[i]));
    const offer=view.nexusCards!;
    assert.equal(offer.card,g.nexusCards!.cards!.hands[f.ids[i]]);
    assert.equal(Object.hasOwn(offer,'deck'),false);
    assert.equal(Object.hasOwn(offer,'discard'),false);
    assert.equal(Object.hasOwn(offer,'hands'),false);
    assert.equal(JSON.stringify(offer).includes('signature'),false);
    if(i!==2) assert.equal(offer.card,null);
  }
  assert.deepEqual(snapshot(f),before);
  assert.deepEqual(await rooms.readRoom(f.otherCode),f.otherBefore);
  nexusInventory(g);
}
void test('Nexus SQL concurrent keep-own and redraw-own policies commit one physical result and one phase advance',async()=>{
  const f=await persisted();
  try {
    let arrived=0; let release!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    f.hooks.beforeWrite=async()=>{if(++arrived===2)release();await waiting;};
    const outcomes=await Promise.allSettled([
      f.rooms.act(f.code,f.auths[2],f.initial.version,draw(f,0),clock),
      f.restart().act(f.code,f.auths[2],f.initial.version,draw(f,2),clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
    assert.deepEqual(f.writes.map(write=>write.changes).sort((a,b)=>a-b),[0,1]);
    const g=await f.rooms.readRoom(f.code);
    assert.equal(g.version,f.initial.version+1);
    assert.equal(g.phase,2);
    assert.ok(['harkonnen','ecaz'].includes(g.nexusCards!.cards!.hands[f.ids[2]]!));
    assert.equal(g.nexusCards!.phase!.stage,'complete');
    const before=snapshot(f);
    await assert.rejects(f.rooms.act(f.code,f.auths[2],f.initial.version,draw(f),clock));
    await assert.rejects(f.rooms.act(f.code,f.auths[2],g.version,draw(f),clock),/Nexus/);
    assert.deepEqual(snapshot(f),before);
    await restored(f,g);
  } finally {f.sqlite.close();}
});
void test('Nexus SQL lost draw response restores the exact private card without reroll or additional writes',async()=>{
  const f=await persisted();
  try {
    await f.rooms.act(f.code,f.auths[2],f.initial.version,draw(f,2),clock);
    const g=await f.restart().readRoom(f.code);
    assert.equal(g.nexusCards!.cards!.hands[f.ids[2]],'ecaz');
    assert.deepEqual(g.nexusCards!.cards!.discard,['harkonnen']);
    const before=snapshot(f);f.writes.length=0;
    await restored(f,g);
    await f.restart().continueRoomAutomatic(f.code,clock);
    assert.deepEqual(snapshot(f),before);assert.equal(f.writes.length,0);
    for(const entry of g.log.filter(entry=>entry.text.includes('Nexus Card')))
      assert.doesNotMatch(entry.text,/Ecaz|Harkonnen.*card identity/);
  } finally {f.sqlite.close();}
});
void test('Nexus SQL invalid inventory and edited closing progress reject before storage or private projection',async()=>{
  const f=await persisted();
  try {
    for(const corrupt of [
      (g:engine.Game)=>{g.nexusCards!.cards!.deck.pop();},
      (g:engine.Game)=>{g.nexusCards!.phase!.done.push(f.ids[2]);},
      (g:engine.Game)=>{g.nexusCards!.phase!.occurred=false;},
      (g:engine.Game)=>{g.nexusCards!.phase=null;},
    ]) {
      const g=structuredClone(f.initial);corrupt(g);f.save(g);
      const before=snapshot(f);f.writes.length=0;
      await assert.rejects(f.rooms.readSeatView(f.code,f.auths[2]),/Nexus/);
      await assert.rejects(f.rooms.act(f.code,f.auths[2],g.version,draw(f),clock),/Nexus/);
      assert.deepEqual(snapshot(f),before);assert.equal(f.writes.length,0);
    }
  } finally {f.sqlite.close();}
});
