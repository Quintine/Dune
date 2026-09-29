import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { adminStore, sha256 } from './admin-access-fixture';
import { adminLogin, adminLogoutAll, requireAdmin, AdminError } from '../db/admin-access';
import { applyAdminAccount, readAdminAccounts } from '../db/admin-accounts';
import { readAdminAudit } from '../db/admin-audit';
import { validAdminAccountInput, type AdminAccountInput } from '../lib/admin-accounts';

const now = Date.parse('2026-09-29T12:00:00Z');
const denied = (status: number) => (error: unknown) => error instanceof AdminError && error.status === status;
async function fixture() {
  const store = adminStore(), owner = store.provision('owner'), target = store.provision('viewer');
  const session = await adminLogin(store.database,owner.key,now);
  const identity = await requireAdmin(store.database,session.token,['owner'],now);
  return { ...store,owner,target,session,identity };
}
function newProvision(role: 'owner'|'operator'|'viewer' = 'viewer'): Extract<AdminAccountInput,{action:'provision'}> {
  const id = randomUUID();
  return { action:'provision',operationId:randomUUID(),id,key:`dune-admin.${id}.${randomBytes(32).toString('hex')}`,name:'New administrator',role,reason:'Staff rotation' };
}
function newRotation(target: string, expectedUpdatedAt = 1000): Extract<AdminAccountInput,{action:'rotate'}> {
  return { action:'rotate',operationId:randomUUID(),target,expectedUpdatedAt,
    key:`dune-admin.${target}.${randomBytes(32).toString('hex')}`,reason:'Replace compromised credential' };
}


void test('account receipt migration adds metadata without changing existing games or credentials',() => {
  const sqlite=new DatabaseSync(':memory:');
  try {
    for(const file of readdirSync(new URL('../drizzle/',import.meta.url))
      .filter(file=>file.endsWith('.sql') && file<'0019')
      .sort((a,b)=>a.localeCompare(b)))
      sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
    const id=randomUUID(),keyHash=sha256('private-old-key'),sessionHash=sha256('private-old-session');
    sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)')
      .run('SAVE0001','{"sealed":"original"}',7,1000);
    sqlite.prepare('INSERT INTO seats(token_hash,revoked,room_code,player_id) VALUES(?,?,?,?)')
      .run('d'.repeat(64),0,'SAVE0001','player');
    sqlite.prepare('INSERT INTO admin_accounts(id,name,role,key_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(id,'Original owner','owner',keyHash,1000,1000);
    sqlite.prepare('INSERT INTO admin_sessions(token_hash,id,admin_id,generation,created_at,expires_at) VALUES(?,?,?,?,?,?)')
      .run(sessionHash,randomUUID(),id,0,1000,100000);
    const saved=()=>JSON.stringify([
      sqlite.prepare('SELECT * FROM rooms').all(),sqlite.prepare('SELECT * FROM seats').all(),
      sqlite.prepare('SELECT * FROM admin_accounts').all(),sqlite.prepare('SELECT * FROM admin_sessions').all(),
      sqlite.prepare('SELECT id,actor_admin_id,target_admin_id,action,created_at,detail FROM admin_audit').all(),
    ]);
    const before=saved();
    sqlite.exec(readFileSync(new URL('../drizzle/0019_admin_accounts.sql',import.meta.url),'utf8'));
    const operation=randomUUID();
    sqlite.prepare(`INSERT INTO admin_account_operations
      (operation_id,actor_admin_id,request_hash,target_admin_id,action,name,role,enabled,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(operation,id,'a'.repeat(64),id,'role','Original owner','owner',1,1000,1000);
    const previousReceipt=sqlite.prepare('SELECT * FROM admin_account_operations WHERE operation_id=?').get(operation);
    sqlite.exec(readFileSync(new URL('../drizzle/0020_admin_key_rotation.sql',import.meta.url),'utf8'));
    assert.deepEqual(sqlite.prepare('SELECT * FROM admin_account_operations WHERE operation_id=?').get(operation),previousReceipt);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM admin_account_rotations').get()!.n,0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM admin_account_retired_keys').get()!.n,0);
    assert.equal(saved(),before);
    assert.equal(sqlite.prepare('SELECT reason FROM admin_audit WHERE target_admin_id=?').get(id)!.reason,null);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM admin_account_operations').get()!.n,1);
    assert.throws(()=>sqlite.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').run(id));
    assert.equal(saved(),before);
  } finally {sqlite.close();}
});

void test('owner directory pages 25 safe accounts and rejects stale/forged authority',async () => {
  const f = await fixture();
  try {
    for(let i=0;i<27;i++)f.provision('viewer','Directory '+i);
    const first=await readAdminAccounts(f.database,f.identity,new URLSearchParams(),now);
    const second=await readAdminAccounts(f.database,f.identity,new URLSearchParams('page=2'),now);
    assert.equal(first.total,29);assert.equal(first.accounts.length,25);assert.equal(second.accounts.length,4);
    assert.equal(new Set([...first.accounts,...second.accounts].map(a=>a.id)).size,29);
    assert.doesNotMatch(JSON.stringify(first),/key_hash|session_hash|dune-admin\.|[0-9a-f]{64}/);
    for(const query of ['page=0','page=1&page=2','role=owner'])await assert.rejects(readAdminAccounts(f.database,f.identity,new URLSearchParams(query),now),denied(400));
    f.provision('owner');
    f.sqlite.prepare("UPDATE admin_accounts SET role='operator' WHERE id=?").run(f.owner.id);
    await assert.rejects(readAdminAccounts(f.database,f.identity,new URLSearchParams(),now),denied(401));
  } finally {f.sqlite.close();}
});

void test('provision exact retry returns the committed snapshot without doubling audit',async () => {
  const f=await fixture();
  try {
    const input=newProvision('operator');
    assert.equal(validAdminAccountInput(input),true);
    const initial=await applyAdminAccount(f.database,f.identity,input,now);
    assert.equal(initial.replayed,false);assert.equal(initial.account.id,input.id);
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,input,now),{...initial,replayed:true});
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_audit WHERE target_admin_id=?').get(input.id)!.n,1);
  } finally {f.sqlite.close();}
});

void test('an unchanged role request cannot advance the account version or fabricate an audit change',async () => {
  const f=await fixture();
  try {
    const before=JSON.stringify([
      f.sqlite.prepare('SELECT * FROM admin_accounts WHERE id=?').get(f.target.id),
      f.sqlite.prepare('SELECT * FROM admin_audit ORDER BY rowid').all(),
    ]);
    const input:AdminAccountInput={action:'role',operationId:randomUUID(),target:f.target.id,
      expectedUpdatedAt:1000,role:'viewer',reason:'No change'};
    await assert.rejects(applyAdminAccount(f.database,f.identity,input,now),denied(409));
    assert.equal(JSON.stringify([
      f.sqlite.prepare('SELECT * FROM admin_accounts WHERE id=?').get(f.target.id),
      f.sqlite.prepare('SELECT * FROM admin_audit ORDER BY rowid').all(),
    ]),before);
  } finally {f.sqlite.close();}
});

void test('provision, role and permanent disable retain one audited operation each and leave games/seats untouched',async () => {
  const f=await fixture();
  try {
    f.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run('SAVEDQAA','{"secret":"sealed"}',4,1000);
    f.sqlite.prepare('INSERT INTO seats(token_hash,revoked,room_code,player_id) VALUES(?,?,?,?)').run('f'.repeat(64),0,'SAVEDQAA','player');
    const before=JSON.stringify([f.sqlite.prepare('SELECT * FROM rooms').all(),f.sqlite.prepare('SELECT * FROM seats').all()]);
    const provision=newProvision('viewer');
    const created=await applyAdminAccount(f.database,f.identity,provision,now);
    assert.equal(created.account.role,'viewer');
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,provision,now),{...created,replayed:true});
    const role: AdminAccountInput={action:'role',operationId:randomUUID(),target:provision.id,expectedUpdatedAt:created.account.updatedAt,role:'operator',reason:'Assign duty'};
    const promoted=await applyAdminAccount(f.database,f.identity,role,now);
    assert.equal(promoted.account.role,'operator');assert.ok(promoted.account.updatedAt>created.account.updatedAt);
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,role,now),{...promoted,replayed:true});
    await assert.rejects(applyAdminAccount(f.database,f.identity,{...role,operationId:randomUUID()},now),denied(409));
    const login=await adminLogin(f.database,provision.key,now);
    const disable: AdminAccountInput={action:'disable',operationId:randomUUID(),target:provision.id,expectedUpdatedAt:promoted.account.updatedAt,reason:'Access no longer needed'};
    const disabled=await applyAdminAccount(f.database,f.identity,disable,now);
    assert.equal(disabled.account.enabled,false);
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,disable,now),{...disabled,replayed:true});
    await assert.rejects(adminLogin(f.database,provision.key,now),denied(401));
    await assert.rejects(requireAdmin(f.database,login.token,undefined,now),denied(401));
    assert.ok(f.sqlite.prepare('SELECT revoked_at FROM admin_sessions WHERE admin_id=?').get(provision.id)!.revoked_at);
    const audits=f.sqlite.prepare('SELECT actor_admin_id,action,reason,detail FROM admin_audit WHERE target_admin_id=?').all(provision.id);
    assert.equal(audits.length,4); // Login receipt plus three account operations.
    assert.deepEqual(audits.filter(a=>a.action!=='login').map(a=>a.action).sort((a,b)=>String(a).localeCompare(String(b))),['provision','revoke','role']);
    assert.ok(audits.filter(a=>a.action!=='login').every(a=>a.actor_admin_id===f.owner.id && typeof a.reason==='string'));
    const history=await readAdminAudit(f.database,f.identity,new URLSearchParams('category=account'),now);
    const roleEvent=history.events.find(e=>e.targetAdminId===provision.id && e.action==='role');
    assert.deepEqual(roleEvent?.changes,[{field:'Role',before:'viewer',after:'operator'}]);
    assert.equal(roleEvent?.reason,'Assign duty');
    assert.equal(f.sqlite.prepare('SELECT key_hash FROM admin_accounts WHERE id=?').get(provision.id)!.key_hash,sha256(provision.key));
    const persisted=JSON.stringify([f.sqlite.prepare('SELECT * FROM admin_account_operations').all(),f.sqlite.prepare('SELECT * FROM admin_audit').all(),history]);
    assert.equal(persisted.includes(provision.key),false);
    assert.equal(persisted.includes(sha256(provision.key)),false);
    assert.equal(JSON.stringify([f.sqlite.prepare('SELECT * FROM rooms').all(),f.sqlite.prepare('SELECT * FROM seats').all()]),before);
  } finally {f.sqlite.close();}
});

void test('conflicting replay, actor change and invalid payloads cannot write',async () => {
  const f=await fixture();
  try {
    const input=newProvision();await applyAdminAccount(f.database,f.identity,input,now);
    const before=Number(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_audit').get()!.n);
    await assert.rejects(applyAdminAccount(f.database,f.identity,{...input,reason:'Different reason'},now),denied(409));
    await assert.rejects(applyAdminAccount(f.database,f.identity,{...input,reason:' '+input.reason},now),denied(409));
    const other=f.provision('owner');const session=await adminLogin(f.database,other.key,now);
    const identity=await requireAdmin(f.database,session.token,['owner'],now);
    await assert.rejects(applyAdminAccount(f.database,identity,input,now),denied(409));
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_audit').get()!.n,before+2); // Other owner provision and login only.
    for(const bad of [{...input,key:input.key+'\n'},{...input,name:'Bad\nname'},{...input,reason:'contains '+input.key},{...input,unknown:true},{...input,role:'superuser'},
      {...input,id:randomUUID()},{...input,operationId:'not-a-uuid'}])assert.equal(validAdminAccountInput(bad),false);
  } finally {f.sqlite.close();}
});

void test('write-time revocation, concurrent target change, final-owner trigger and self mutation fail closed',async () => {
  const f=await fixture();
  try {
    assert.throws(()=>f.sqlite.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').run(f.owner.id));
    assert.equal(f.sqlite.prepare('SELECT enabled FROM admin_accounts WHERE id=?').get(f.owner.id)!.enabled,1);
    const self: AdminAccountInput={action:'disable',operationId:randomUUID(),target:f.owner.id,expectedUpdatedAt:1000,reason:'Self'};
    await assert.rejects(applyAdminAccount(f.database,f.identity,self,now),denied(409));
    await assert.rejects(applyAdminAccount(f.database,f.identity,{
      action:'role',operationId:randomUUID(),target:f.owner.id,expectedUpdatedAt:1000,role:'viewer',reason:'Self demotion',
    },now),denied(409));
    const input=newProvision();
    f.hooks.beforeBatch=async()=>{f.hooks.beforeBatch=async()=>{delete f.hooks.beforeBatch;f.sqlite.prepare('UPDATE admin_sessions SET revoked_at=1 WHERE admin_id=?').run(f.owner.id);};};
    await assert.rejects(applyAdminAccount(f.database,f.identity,input,now),denied(401));
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_accounts WHERE id=?').get(input.id)!.n,0);
    f.sqlite.prepare('UPDATE admin_sessions SET revoked_at=NULL WHERE admin_id=?').run(f.owner.id);
    const target=f.provision('viewer');
    const change: AdminAccountInput={action:'role',operationId:randomUUID(),target:target.id,expectedUpdatedAt:1000,role:'operator',reason:'Race'};
    f.hooks.beforeBatch=async()=>{f.hooks.beforeBatch=async()=>{delete f.hooks.beforeBatch;f.sqlite.prepare('UPDATE admin_accounts SET updated_at=2000 WHERE id=?').run(target.id);};};
    await assert.rejects(applyAdminAccount(f.database,f.identity,change,now),denied(409));
    assert.equal(f.sqlite.prepare('SELECT role FROM admin_accounts WHERE id=?').get(target.id)!.role,'viewer');
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_account_operations WHERE operation_id=?').get(change.operationId)!.n,0);
  } finally {f.sqlite.close();}
});

void test('logout-all cannot roll back an account version and admit a stale disable',async () => {
  const f=await fixture();
  try {
    const promote:AdminAccountInput={action:'role',operationId:randomUUID(),target:f.target.id,
      expectedUpdatedAt:1000,role:'operator',reason:'Grant duty'};
    const changed=await applyAdminAccount(f.database,f.identity,promote,1000);
    const login=await adminLogin(f.database,f.target.key,1000);
    const target=await requireAdmin(f.database,login.token,undefined,1000);
    await adminLogoutAll(f.database,target,1000);
    const updated=Number(f.sqlite.prepare('SELECT updated_at FROM admin_accounts WHERE id=?').get(f.target.id)!.updated_at);
    assert.ok(updated>changed.account.updatedAt);
    const stale:AdminAccountInput={action:'disable',operationId:randomUUID(),target:f.target.id,
      expectedUpdatedAt:1000,reason:'Stale version'};
    await assert.rejects(applyAdminAccount(f.database,f.identity,stale,1000),denied(409));
    assert.equal(f.sqlite.prepare('SELECT enabled FROM admin_accounts WHERE id=?').get(f.target.id)!.enabled,1);
  } finally {f.sqlite.close();}
});
void test('rotating an enabled administrator invalidates old keys and sessions while preserving account and game state',async () => {
  const f=await fixture();
  try {
    f.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run('ROTATE01','{"private":"saved"}',3,1000);
    f.sqlite.prepare('INSERT INTO seats(token_hash,revoked,room_code,player_id) VALUES(?,?,?,?)').run('e'.repeat(64),0,'ROTATE01','player');
    const saved=JSON.stringify([f.sqlite.prepare('SELECT * FROM rooms').all(),f.sqlite.prepare('SELECT * FROM seats').all()]);
    const oldSession=await adminLogin(f.database,f.target.key,now);
    const input=newRotation(f.target.id), result=await applyAdminAccount(f.database,f.identity,input,now);
    assert.equal(result.replayed,false);
    assert.deepEqual({id:result.account.id,name:result.account.name,role:result.account.role,enabled:result.account.enabled},
      {id:f.target.id,name:f.target.name,role:f.target.role,enabled:true});
    assert.ok(result.account.updatedAt>1000);
    const row=f.sqlite.prepare('SELECT key_hash,session_generation,updated_at FROM admin_accounts WHERE id=?').get(f.target.id)!;
    assert.equal(row.key_hash,sha256(input.key));assert.equal(row.session_generation,1);
    assert.equal(row.updated_at,result.account.updatedAt);
    assert.ok(f.sqlite.prepare('SELECT revoked_at FROM admin_sessions WHERE token_hash=?').get(sha256(oldSession.token))!.revoked_at);
    await assert.rejects(adminLogin(f.database,f.target.key,now),denied(401));
    await assert.rejects(requireAdmin(f.database,oldSession.token,undefined,now),denied(401));
    const fresh=await adminLogin(f.database,input.key,now);
    assert.equal((await requireAdmin(f.database,fresh.token,undefined,now)).id,f.target.id);
    const audit=f.sqlite.prepare("SELECT action,actor_admin_id,detail,reason FROM admin_audit WHERE target_admin_id=? AND action='rotate'").all(f.target.id);
    assert.equal(audit.length,1);
    assert.equal(audit[0].action,'rotate');
    assert.equal(audit[0].actor_admin_id,f.owner.id);
    assert.equal(audit[0].reason,input.reason);
    assert.deepEqual(JSON.parse(String(audit[0].detail)),{previousEnabled:1,enabled:1});
    assert.deepEqual((await readAdminAudit(f.database,f.identity,new URLSearchParams('category=account'),now))
      .events.find(event=>event.action==='rotate' && event.targetAdminId===f.target.id)?.changes,[{field:'Enabled',before:'Yes',after:'Yes'}]);
    assert.equal(f.sqlite.prepare('SELECT admin_id FROM admin_account_retired_keys WHERE key_hash=?').get(sha256(f.target.key))!.admin_id,f.target.id);
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,input,now),{...result,replayed:true});
    const second=newRotation(f.target.id,result.account.updatedAt);
    const rotatedAgain=await applyAdminAccount(f.database,f.identity,second,now);
    const revive={...newRotation(f.target.id,rotatedAgain.account.updatedAt),key:f.target.key};
    await assert.rejects(applyAdminAccount(f.database,f.identity,revive,now),denied(409));
    assert.equal(f.sqlite.prepare('SELECT key_hash FROM admin_accounts WHERE id=?').get(f.target.id)!.key_hash,sha256(second.key));
    await assert.rejects(adminLogin(f.database,f.target.key,now),denied(401));
    await assert.rejects(requireAdmin(f.database,fresh.token,undefined,now),denied(401));
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,input,now),{...result,replayed:true});
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_account_retired_keys WHERE admin_id=?').get(f.target.id)!.n,2);
    assert.equal(JSON.stringify([f.sqlite.prepare('SELECT * FROM rooms').all(),f.sqlite.prepare('SELECT * FROM seats').all()]),saved);
    const persisted=JSON.stringify([f.sqlite.prepare('SELECT * FROM admin_account_rotations').all(),audit,result]);
    assert.equal(persisted.includes(input.key),false);assert.equal(persisted.includes(sha256(input.key)),false);
  } finally {f.sqlite.close();}
});

void test('disabled administrators return only with a fresh key, and replay retains original metadata after later changes',async () => {
  const f=await fixture();
  try {
    const disable:AdminAccountInput={action:'disable',operationId:randomUUID(),target:f.target.id,expectedUpdatedAt:1000,reason:'Disable access'};
    const stopped=await applyAdminAccount(f.database,f.identity,disable,now);
    await assert.rejects(adminLogin(f.database,f.target.key,now),denied(401));
    const reuse={...newRotation(f.target.id,stopped.account.updatedAt),key:f.target.key};
    await assert.rejects(applyAdminAccount(f.database,f.identity,reuse,now),denied(409));
    assert.equal(f.sqlite.prepare('SELECT enabled FROM admin_accounts WHERE id=?').get(f.target.id)!.enabled,0);
    const rotate=newRotation(f.target.id,stopped.account.updatedAt);
    const restored=await applyAdminAccount(f.database,f.identity,rotate,now);
    assert.equal(restored.account.enabled,true);assert.ok(restored.account.updatedAt>stopped.account.updatedAt);
    await assert.rejects(adminLogin(f.database,f.target.key,now),denied(401));
    assert.equal((await adminLogin(f.database,rotate.key,now)).admin.id,f.target.id);
    const audit=(await readAdminAudit(f.database,f.identity,new URLSearchParams('category=account'),now)).events.find(event=>event.action==='rotate' && event.targetAdminId===f.target.id);
    assert.deepEqual(audit?.changes,[{field:'Enabled',before:'No',after:'Yes'}]);assert.equal(audit?.reason,rotate.reason);
    const role:AdminAccountInput={action:'role',operationId:randomUUID(),target:f.target.id,expectedUpdatedAt:restored.account.updatedAt,role:'operator',reason:'New duty'};
    await applyAdminAccount(f.database,f.identity,role,now);
    assert.deepEqual(await applyAdminAccount(f.database,f.identity,rotate,now),{...restored,replayed:true});
    assert.equal(f.sqlite.prepare('SELECT role FROM admin_accounts WHERE id=?').get(f.target.id)!.role,'operator');
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_audit WHERE target_admin_id=? AND action=?').get(f.target.id,'rotate')!.n,1);
  } finally {f.sqlite.close();}
});

void test('rotation rejects stale versions, simultaneous target changes, other owners and reused operation IDs',async () => {
  const f=await fixture();
  try {
    const original=newRotation(f.target.id);
    for(const bad of [{...original,key:f.owner.key},{...original,key:original.key.toUpperCase()},
      {...original,key:original.key+'\\n'},{...original,reason:original.key},{...original,unknown:true}])
      assert.equal(validAdminAccountInput(bad),false);
    assert.equal(validAdminAccountInput(original),true);
    const self=newRotation(f.owner.id);
    await assert.rejects(applyAdminAccount(f.database,f.identity,self,now),denied(409));
    const winner=await applyAdminAccount(f.database,f.identity,original,now);
    const stale=newRotation(f.target.id);
    await assert.rejects(applyAdminAccount(f.database,f.identity,stale,now),denied(409));
    await assert.rejects(applyAdminAccount(f.database,f.identity,{...original,key:stale.key},now),denied(409));
    await assert.rejects(applyAdminAccount(f.database,f.identity,{...original,reason:'Changed reason'},now),denied(409));
    const another=f.provision('owner'), login=await adminLogin(f.database,another.key,now);
    const other=await requireAdmin(f.database,login.token,['owner'],now);
    await assert.rejects(applyAdminAccount(f.database,other,original,now),denied(409));
    const cross:AdminAccountInput={action:'role',operationId:original.operationId,target:f.target.id,
      expectedUpdatedAt:winner.account.updatedAt,role:'operator',reason:'Cross-table operation ID'};
    await assert.rejects(applyAdminAccount(f.database,f.identity,cross,now),denied(409));
    const before=Number(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_account_rotations').get()!.n);
    const race=newRotation(f.target.id,winner.account.updatedAt);
    f.hooks.beforeBatch=async()=>{f.hooks.beforeBatch=async()=>{
      delete f.hooks.beforeBatch;f.sqlite.prepare('UPDATE admin_accounts SET updated_at=updated_at+1 WHERE id=?').run(f.target.id);
    };};
    await assert.rejects(applyAdminAccount(f.database,f.identity,race,now),denied(409));
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_account_rotations').get()!.n,before);
    const expired=newRotation(f.target.id,Number(f.sqlite.prepare('SELECT updated_at FROM admin_accounts WHERE id=?').get(f.target.id)!.updated_at));
    f.hooks.beforeBatch=async()=>{f.hooks.beforeBatch=async()=>{
      delete f.hooks.beforeBatch;f.sqlite.prepare('UPDATE admin_sessions SET revoked_at=1 WHERE admin_id=?').run(f.owner.id);
    };};
    await assert.rejects(applyAdminAccount(f.database,f.identity,expired,now),denied(401));
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM admin_account_rotations').get()!.n,before);
    await assert.rejects(applyAdminAccount(f.database,f.identity,original,now),denied(401));
  } finally {f.sqlite.close();}
});


void test('workerd D1 applies provision, exact retry and revocation in transactional batches',async () => {
  const { Miniflare }=await import('miniflare');
  const f=await fixture();
  const worker=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-15',d1Databases:['DB']});
  try {
    const db=await worker.getD1Database('DB');
    const schema=f.sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END").all() as {type:string;name:string;sql:string}[];
    for(const entry of schema.filter(e=>e.type!=='trigger'))await db.prepare(entry.sql).run();
    for(const entry of schema.filter(e=>e.type==='table')) {
      for(const row of f.sqlite.prepare(`SELECT * FROM "${entry.name}"`).all()) {
        const columns=Object.keys(row);
        await db.prepare(`INSERT INTO "${entry.name}" (${columns.map(column=>'"'+column+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...Object.values(row)).run();
      }
    }
    for(const entry of schema.filter(e=>e.type==='trigger'))await db.prepare(entry.sql).run();
    const database=db as unknown as D1Database, input=newProvision('owner');
    const created=await applyAdminAccount(database,f.identity,input,now);
    const simultaneous=newProvision('viewer');
    const races=await Promise.all([
      applyAdminAccount(database,f.identity,simultaneous,now),
      applyAdminAccount(database,f.identity,simultaneous,now),
    ]);
    assert.deepEqual(races.map(result=>result.replayed).sort((a,b)=>Number(a)-Number(b)),[false,true],JSON.stringify(races));
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM admin_audit WHERE target_admin_id=?').bind(simultaneous.id).first<{n:number}>())?.n,1);
    assert.deepEqual(await applyAdminAccount(database,f.identity,input,now),{...created,replayed:true});
    const listed=await readAdminAccounts(database,f.identity,new URLSearchParams(),now);
    assert.equal(listed.total,4);
    const disable:AdminAccountInput={action:'disable',operationId:randomUUID(),target:input.id,expectedUpdatedAt:created.account.updatedAt,reason:'Remove access'};
    const result=await applyAdminAccount(database,f.identity,disable,now);
    assert.equal(result.account.enabled,false);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM admin_audit WHERE target_admin_id=?').bind(input.id).first<{n:number}>())?.n,2);
    const rotation=newRotation(input.id,result.account.updatedAt);
    const restored=await applyAdminAccount(database,f.identity,rotation,now);
    assert.equal(restored.account.enabled,true);
    assert.equal((await adminLogin(database,rotation.key,now)).admin.id,input.id);
    await assert.rejects(adminLogin(database,input.key,now),denied(401));
    const competingA=newRotation(input.id,restored.account.updatedAt),competingB=newRotation(input.id,restored.account.updatedAt);
    const outcomes=await Promise.allSettled([
      applyAdminAccount(database,f.identity,competingA,now),
      applyAdminAccount(database,f.identity,competingB,now),
    ]);
    assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(outcome=>outcome.status==='rejected' && denied(409)(outcome.reason)).length,1);
    assert.deepEqual(await applyAdminAccount(database,f.identity,rotation,now),{...restored,replayed:true});
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE target_admin_id=? AND action='rotate'").bind(input.id).first<{n:number}>())?.n,2);
    await assert.rejects(adminLogin(database,input.key,now),denied(401));
  } finally {await worker.dispose();f.sqlite.close();}
});
