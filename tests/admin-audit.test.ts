import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { adminStore } from './admin-access-fixture';
import { adminLogin, requireAdmin, AdminError, type AdminRole } from '../db/admin-access';
import { createAdminRoom } from '../db/admin-room-creation';
import { readAdminLobby, configureAdminLobby } from '../db/admin-lobby-configuration';
import { readAdminAudit } from '../db/admin-audit';
import { adminAuditResponse, AUDIT_CATEGORIES } from '../lib/admin-audit';

const now = Date.parse('2026-09-26T12:00:00Z'), room = 'AUDITQAA';
const privateValue = 'PRIVATE_GAME_OR_CREDENTIAL_SENTINEL', reason = 'Operational reason sentinel';
async function fixture(role: AdminRole = 'operator') {
  const f = adminStore(); assert.ok(f.sqlite instanceof DatabaseSync);
  const account = f.provision(role, 'QA _operator'), target = f.provision('viewer','Target account');
  const login = await adminLogin(f.database,account.key,now);
  const identity = await requireAdmin(f.database,login.token,undefined,now);
  f.sqlite.exec('DELETE FROM admin_audit');
  const seat = randomUUID(), operation = randomUUID();
  function insert(table: string, row: Record<string,string | number | null>) {
    const keys=Object.keys(row); f.sqlite.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row));
  }
  const core = { operation_id:operation,actor_admin_id:account.id,room_code:room,reason,created_at:now-1000 };
  const snapshot = JSON.stringify({version:7,revision:2,paused:true,joinLocked:false,removed:false,closed:false,archived:false,private:privateValue});
  const config = JSON.stringify({host:seat,advanced:false,techTokens:false,strongholdCards:false,players:[{id:seat,name:'Public player',faction:'atreides',bot:null}],private:privateValue});
  insert('admin_audit',{id:'a'.repeat(32),actor_admin_id:null,target_admin_id:target.id,action:'provision',created_at:now-1000,detail:JSON.stringify({role:'viewer',sessionId:privateValue,private:privateValue})});
  insert('admin_room_audit',{...core,action:'room_control',expected_revision:1,before_paused:0,before_join_locked:0,after_paused:1,after_join_locked:0});
  insert('admin_room_creations',{...core,host_id:seat,request_hash:privateValue,session_hash:privateValue,configuration:JSON.stringify({name:'Public player',faction:'atreides',advanced:false,techTokens:false,strongholdCards:false,bots:[],private:privateValue})});
  insert('admin_lobby_operations',{...core,request_hash:privateValue,expected_version:6,applied_version:7,action:JSON.stringify({type:'assignHost',target:seat,private:privateValue}),before_configuration:config,after_configuration:config});
  for (const [table,flag] of [['admin_room_removals','removed'],['admin_room_closures','closed'],['admin_room_archives','archived']])
    insert(table,{...core,request_hash:privateValue,expected_version:6,expected_revision:1,applied_version:7,applied_revision:2,[flag]:0,before_metadata:snapshot,after_metadata:snapshot});
  insert('admin_seat_ai_operations',{...core,request_hash:privateValue,expected_version:6,expected_control_revision:1,applied_version:7,target:seat,difficulty:'Hard'});
  insert('admin_discussion_operations',{...core,request_hash:privateValue,expected_version:7,expected_revision:1,applied_revision:2,target:seat,muted:1});
  const read = (search='') => readAdminAudit(f.database,identity,new URLSearchParams(search),now);
  return {...f,account,target,identity,seat,operation,insert,core,read};
}
void test('unified audit covers all nine sources without reading saved games or exposing private JSON, sessions or hashes',async () => {
  const f = await fixture();
  try {
    const page = await f.read(); adminAuditResponse(page);
    assert.equal(page.total,9); assert.equal(page.events.length,9);
    assert.deepEqual(page.events.map(e=>e.category).sort(),Object.keys(AUDIT_CATEGORIES).sort());
    assert.equal(new Set(page.events.map(e=>e.id)).size,9,'same operation UUID in different tables must remain distinct');
    assert.doesNotMatch(JSON.stringify(page),new RegExp(privateValue+'|sessionId|request_hash|session_hash|key_hash|before_json|after_json'));
    assert.equal(page.reasonsVisible,true); assert.equal(page.events.filter(e=>e.reason===reason).length,8);
    const external=page.events.find(e=>e.category==='account')!;
    assert.equal(external.actorId,null); assert.equal(external.action,'provision'); assert.equal(external.targetAdminId,f.target.id);
    assert.deepEqual(external.changes,[{field:'Role',before:null,after:'viewer'}]);
    const lobby=page.events.find(e=>e.category==='lobby')!;
    assert.equal(lobby.action,'assignHost'); assert.equal(lobby.targetSeatId,f.seat);
    assert.ok(lobby.changes.some(c=>c.field==='Host seat' && c.after===f.seat));
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM rooms').get()!.n,0,'historical events exist independently of rooms');
  } finally {f.sqlite.close();}
});
void test('nine-source audit executes within workerd D1 compound-query limits',async () => {
  const { Miniflare } = await import('miniflare');
  const f = await fixture();
  const worker = new Miniflare({ modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-15',d1Databases:['DB'] });
  try {
    const db = await worker.getD1Database('DB');
    // Copy the isolated fixture, never the running server's database. Install
    // its triggers after copying rows so provisioning does not add new receipts.
    const schema = f.sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END").all() as {type:string;name:string;sql:string}[];
    for (const entry of schema.filter(e=>e.type!=='trigger')) await db.prepare(entry.sql).run();
    for (const entry of schema.filter(e=>e.type==='table')) {
      for (const row of f.sqlite.prepare(`SELECT * FROM "${entry.name}"`).all()) {
        const columns=Object.keys(row);
        await db.prepare(`INSERT INTO "${entry.name}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...Object.values(row)).run();
      }
    }
    for (const entry of schema.filter(e=>e.type==='trigger')) await db.prepare(entry.sql).run();
    const read = (query='') => readAdminAudit(db as unknown as D1Database,f.identity,new URLSearchParams(query),now);
    const result=await read(); adminAuditResponse(result);
    assert.equal(result.total,9); assert.deepEqual(result,await f.read());
    assert.equal((await read('q='+room+'&category=discussion')).total,1);
    await db.prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?").bind(f.account.id).run();
    const viewer=await read(); assert.equal(viewer.reasonsVisible,false); assert.ok(viewer.events.every(e=>e.reason===null));
  } finally { await worker.dispose(); f.sqlite.close(); }
});
void test('viewer hides reasons and reasons never influence searches or counts for any role',async () => {
  for (const role of ['viewer','operator'] as const) {
    const f = await fixture(role);
    try {
      const result=await f.read();adminAuditResponse(result);
      assert.equal(result.reasonsVisible,role==='operator');
      if(role==='viewer')assert.ok(result.events.every(e=>e.reason===null));
      for (const q of [reason,privateValue,'%','\\']) assert.equal((await f.read('q='+encodeURIComponent(q))).total,0);
      assert.equal((await f.read('q='+encodeURIComponent('QA _operator'))).total,8);
      assert.equal((await f.read('q='+f.seat)).total,4); // creation, host assignment, AI and discussion
    } finally {f.sqlite.close();}
  }
});
void test('live demotion hides reasons even when the prior identity claims operator; revocation/expiry fails closed',async () => {
  const f=await fixture();
  try {
    f.hooks.beforeBatch=async()=>{delete f.hooks.beforeBatch;f.sqlite.prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?").run(f.account.id);};
    const result=await f.read();assert.equal(result.reasonsVisible,false);assert.ok(result.events.every(e=>e.reason===null));
    for(const sql of ['UPDATE admin_sessions SET revoked_at=1','UPDATE admin_sessions SET revoked_at=NULL,expires_at=1','UPDATE admin_sessions SET expires_at=9999999999999,generation=generation+1']) {
      f.sqlite.exec(sql);await assert.rejects(f.read,(error:unknown)=>error instanceof AdminError && error.status===401);
    }
  } finally {f.sqlite.close();}
});
void test('history survives account deletion and malformed metadata without revealing raw contents',async () => {
  const f=await fixture();
  try {
    f.sqlite.prepare('DELETE FROM admin_accounts WHERE id=?').run(f.target.id);
    f.sqlite.prepare('UPDATE admin_lobby_operations SET action=?,before_configuration=?,after_configuration=?').run('{broken',JSON.stringify({private:privateValue}),JSON.stringify([privateValue]));
    f.sqlite.prepare('UPDATE admin_room_creations SET configuration=?').run('"'+privateValue+'"');
    f.sqlite.prepare('UPDATE admin_audit SET action=?,detail=?').run(privateValue,JSON.stringify({role:privateValue,sessionId:privateValue}));
    const page=await f.read();adminAuditResponse(page);assert.equal(page.total,9);
    assert.doesNotMatch(JSON.stringify(page),new RegExp(privateValue));
    assert.equal(page.events.find(e=>e.category==='account')!.action,'unknown');
    assert.equal(page.events.find(e=>e.category==='lobby')!.action,'unknown');
  } finally {f.sqlite.close();}
});
void test('equal-time events page deterministically and filters apply before pagination',async () => {
  const f=await fixture();
  try {
    for(let i=0;i<58;i++)f.insert('admin_discussion_operations',{...f.core,operation_id:randomUUID(),request_hash:privateValue,expected_version:7,expected_revision:2,applied_revision:3,target:f.seat,muted:0});
    const ids=[];
    for(let page=1;page<=3;page++) {
      const result=await f.read('category=discussion&page='+page);assert.equal(result.total,59);
      ids.push(...result.events.map(e=>e.id));
      assert.deepEqual(await f.read('category=discussion&page='+page),result);
    }
    assert.equal(ids.length,59);assert.equal(new Set(ids).size,59);
    assert.equal((await f.read('category=discussion&from=2026-09-26&to=2026-09-26')).total,59);
    assert.equal((await f.read('from=2026-09-27')).total,0);
    assert.equal((await f.read('to=2026-09-25')).total,0);
    for(const bad of ['q=x&q=y','category=private','page=0','page=1e3','page=9999999','from=2026-02-30','from=2026-09-27&to=2026-09-26','secret=x'])
      await assert.rejects(()=>f.read(bad),(error:unknown)=>error instanceof AdminError && error.status===400);
  } finally {f.sqlite.close();}
});
void test('client rejects private or malformed audit fields rather than rendering unknown server data',async () => {
  const f=await fixture();
  try {
    const page=await f.read();
    for(const bad of [{...page,state:{}},{...page,reasonsVisible:false},{...page,events:[{...page.events[0],sessionHash:privateValue}]},
      {...page,events:[{...page.events[0],changes:[{field:'Private hand',before:null,after:privateValue}]}]},
      {...page,events:[{...page.events[0],createdAt:Infinity}]}])assert.throws(()=>adminAuditResponse(bad));
  } finally {f.sqlite.close();}
});

void test('malformed roles and rejected target metadata cannot crash history or become a viewer search oracle',async () => {
  const f=await fixture('viewer');
  try {
    for(const invalid of [{toString:null},['owner'],{nested:privateValue}]) {
      f.sqlite.prepare('UPDATE admin_audit SET detail=?').run(JSON.stringify({role:invalid,previousRole:invalid}));
      const page=await f.read();adminAuditResponse(page);assert.deepEqual(page.events.find(e=>e.category==='account')!.changes,[]);
    }
    for(const target of [{private:privateValue},[privateValue],privateValue,7]) {
      f.sqlite.prepare('UPDATE admin_lobby_operations SET action=?').run(JSON.stringify({type:'configureBot',target}));
      const page=await f.read('category=lobby');assert.equal(page.events[0].targetSeatId,null);
      assert.equal((await f.read('q='+encodeURIComponent(privateValue))).total,0);
    }
    f.sqlite.prepare('UPDATE admin_room_audit SET room_code=?,actor_admin_id=?').run(privateValue,privateValue);
    assert.equal((await f.read('q='+encodeURIComponent(privateValue))).total,0);
    f.sqlite.prepare('UPDATE admin_room_audit SET room_code=?,actor_admin_id=?').run('SECRETAA\0hidden',f.account.id+'\0hidden');
    assert.equal((await f.read('q=SECRETAA')).total,0);
    assert.equal((await f.read('category=control&q='+f.account.id)).total,0);
    f.sqlite.prepare('UPDATE admin_accounts SET name=? WHERE id=?').run(privateValue+'\n',f.account.id);
    assert.equal((await f.read('q='+encodeURIComponent(privateValue))).total,0);
  } finally {f.sqlite.close();}
});
void test('external account operations match affected account names and position-only AI changes show the actual circles',async () => {
  const f=await fixture();
  try {
    const found=await f.read('q='+encodeURIComponent('Target account'));
    assert.equal(found.total,1);assert.equal(found.events[0].actorId,null);assert.equal(found.events[0].targetAdminName,'Target account');
    const config=(position:number)=>JSON.stringify({advanced:false,techTokens:false,strongholdCards:false,host:f.seat,players:[{id:f.seat,faction:'atreides',bot:'Hard',position}]});
    f.sqlite.prepare('UPDATE admin_lobby_operations SET action=?,before_configuration=?,after_configuration=?').run(JSON.stringify({type:'configureBot',target:f.seat}),config(1),config(6));
    const page=await f.read('category=lobby');adminAuditResponse(page);
    assert.deepEqual(page.events[0].changes.find(c=>c.field==='Player circle'),{field:'Player circle',before:'1',after:'6'});
  } finally {f.sqlite.close();}
});

void test('real room creation and position-only configuration receipts display the authoritative player circles',async () => {
  const f=await fixture();
  try {
    const created=await createAdminRoom(f.database,f.identity,{operationId:randomUUID(),sessionToken:'b'.repeat(64),name:'Audit host',faction:'atreides',advanced:false,techTokens:false,strongholdCards:false,bots:[{faction:'emperor',difficulty:'Hard'}],reason:'Audit genuine operation'},now);
    const lobby=await readAdminLobby(f.database,f.identity,created.code,now), bot=lobby.players.find(p=>p.bot)!;
    assert.equal(bot.position,2);
    await configureAdminLobby(f.database,f.identity,created.code,{operationId:randomUUID(),expectedVersion:lobby.version,action:{type:'configureBot',target:bot.id,faction:'emperor',difficulty:'Hard',position:6},reason:'Move the player circle'},now);
    const page=await f.read('category=lobby&q='+created.code);adminAuditResponse(page);
    assert.equal(page.events.length,1);
    assert.deepEqual(page.events[0].changes.find(c=>c.field==='Player circle'),{field:'Player circle',before:'2',after:'6'});
  } finally {f.sqlite.close();}
});
