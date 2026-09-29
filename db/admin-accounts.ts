import { AdminError, type AdminIdentity } from './admin-access';
import { validAdminAccountInput, type AdminAccountInput, type AdminAccountRow, type AdminAccountResult, type AdminAccountsDirectory } from '../lib/admin-accounts';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND a.role='owner' AND s.revoked_at IS NULL
  AND s.expires_at>? AND s.generation=a.session_generation`;
const accountFields = 'id,name,role,enabled,created_at,updated_at';
const receiptFields = 'operation_id,actor_admin_id,request_hash,target_admin_id,name,role,enabled,created_at,updated_at';
const allReceipts = `SELECT ${receiptFields} FROM admin_account_operations UNION ALL SELECT ${receiptFields} FROM admin_account_rotations`;
type Account = { id: string; name: string; role: AdminAccountRow['role']; enabled: number; created_at: number; updated_at: number };
type Receipt = Omit<Account, 'id'> & { operation_id: string; actor_admin_id: string; request_hash: string; target_admin_id: string };
const project = (row: Account): AdminAccountRow => ({ id: row.id, name: row.name, role: row.role, enabled: row.enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at });

function credentials(identity: AdminIdentity, now: number) {
  if (!identity || typeof identity.id !== 'string' || !/^[0-9a-f]{64}$/.test(identity.sessionHash))
    throw new AdminError('Administrator sign-in required.', 401);
  return [identity.sessionHash, identity.id, now];
}
function authorized(result: D1Result) {
  if (!result.results.length) throw new AdminError('Administrator owner sign-in required.', 401);
}
const fingerprint = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2,'0')).join('');

export async function readAdminAccounts(database: D1Database, identity: AdminIdentity, search: URLSearchParams, now = Date.now()): Promise<AdminAccountsDirectory> {
  const args = credentials(identity, now), rawPage = search.get('page') ?? '1';
  if ([...search.keys()].some(key => key !== 'page' || search.getAll(key).length !== 1) || !/^[1-9][0-9]{0,5}$/.test(rawPage))
    throw new AdminError('Use a valid account directory page.', 400);
  const results = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(`SELECT COUNT(*) total FROM admin_accounts WHERE EXISTS (${authority})`).bind(...args),
    database.prepare(`SELECT ${accountFields} FROM admin_accounts WHERE EXISTS (${authority}) ORDER BY created_at DESC,id ASC LIMIT 25 OFFSET ?`).bind(...args,(Number(rawPage)-1)*25),
  ]);
  authorized(results[0]);
  return { accounts:(results[2].results as Account[]).map(project),total:Number((results[1].results[0] as {total:number}).total),page:Number(rawPage),pageSize:25 };
}

/** No key, key hash or session value enters the durable receipt, audit or response. */
export async function applyAdminAccount(database: D1Database, identity: AdminIdentity, input: AdminAccountInput, now = Date.now()): Promise<AdminAccountResult> {
  const args = credentials(identity, now);
  if (!validAdminAccountInput(input)) throw new AdminError('Check the account details, operation identifier and operational reason.', 400);
  const target = input.action === 'provision' ? input.id : input.target;
  const reason = input.reason.trim();
  const requestHash = await fingerprint(JSON.stringify(input.action === 'provision'
    ? { action:input.action,id:input.id,key:input.key,name:input.name,role:input.role,reason:input.reason }
    : input.action === 'role'
      ? { action:input.action,target,expectedUpdatedAt:input.expectedUpdatedAt,role:input.role,reason:input.reason }
      : input.action === 'rotate'
        ? { action:input.action,target,expectedUpdatedAt:input.expectedUpdatedAt,key:input.key,reason:input.reason }
        : { action:input.action,target,expectedUpdatedAt:input.expectedUpdatedAt,reason:input.reason }));
  const previous = await database.batch([
    database.prepare(authority).bind(...args),
    database.prepare(`SELECT ${receiptFields} FROM (${allReceipts}) WHERE operation_id=? AND EXISTS (${authority})`).bind(input.operationId,...args),
    database.prepare(`SELECT ${accountFields},key_hash FROM admin_accounts WHERE id=? AND EXISTS (${authority})`).bind(target,...args),
  ]);
  authorized(previous[0]);
  const resolve = (receipt: Receipt | undefined, replayed: boolean): AdminAccountResult | null => {
    if (!receipt) return null;
    if (receipt.actor_admin_id !== identity.id || receipt.request_hash !== requestHash || receipt.target_admin_id !== target)
      throw new AdminError('This operation identifier is bound to a different administrator or request.', 409);
    return { operationId:receipt.operation_id,replayed,account:project({ ...receipt,id:receipt.target_admin_id }) };
  };
  const existing = resolve(previous[1].results[0] as Receipt | undefined,true);
  if (existing) return existing;
  const account = previous[2].results[0] as (Account & { key_hash: string }) | undefined;
  if (input.action !== 'provision') {
    if (target === identity.id) throw new AdminError('You cannot change your own account credentials or authority.',409);
    if (!account || input.action !== 'rotate' && !account.enabled || account.updated_at !== input.expectedUpdatedAt)
      throw new AdminError('The account changed or was disabled. Refresh before choosing a new operation.',409);
    if (input.action === 'role' && account.role === input.role)
      throw new AdminError('Choose a different role for this account.',409);
  }
  const nextTime = input.action === 'provision' ? now : Math.max(now,account!.updated_at+1);
  if (input.action === 'rotate') {
    const keyHash = await fingerprint(input.key);
    const result = await database.batch([
      database.prepare(authority).bind(...args),
      database.prepare(`UPDATE admin_accounts SET key_hash=?,enabled=1,session_generation=session_generation+1,updated_at=?
        WHERE id=? AND updated_at=? AND role=? AND key_hash=? AND key_hash<>? AND id!=?
        AND NOT EXISTS (SELECT 1 FROM admin_account_retired_keys WHERE key_hash=?)
        AND EXISTS (${authority}) AND NOT EXISTS (SELECT 1 FROM admin_account_operations WHERE operation_id=?)
        AND NOT EXISTS (SELECT 1 FROM admin_account_rotations WHERE operation_id=?) RETURNING id`)
        .bind(keyHash,nextTime,target,input.expectedUpdatedAt,account!.role,account!.key_hash,keyHash,identity.id,keyHash,...args,input.operationId,input.operationId),
      database.prepare(`INSERT INTO admin_account_retired_keys (key_hash,admin_id)
        SELECT ?,? WHERE changes()=1 AND EXISTS (${authority})`)
        .bind(account!.key_hash,target,...args),
      database.prepare(`INSERT INTO admin_account_rotations
        (operation_id,actor_admin_id,request_hash,target_admin_id,name,role,previous_enabled,enabled,created_at,updated_at,expected_updated_at,reason,rotated_at)
        SELECT ?,?,?,?,name,role,?,enabled,created_at,updated_at,?,?,? FROM admin_accounts
        WHERE id=? AND changes()=1 AND EXISTS (${authority})`)
        .bind(input.operationId,identity.id,requestHash,target,account!.enabled, input.expectedUpdatedAt,reason,now,target,...args),
      database.prepare(`INSERT INTO admin_audit (id,actor_admin_id,target_admin_id,action,created_at,detail,reason)
        SELECT ?,?,?,'rotate',?,json_object('previousEnabled',?,'enabled',1),?
        WHERE changes()=1 AND EXISTS (${authority})`)
        .bind(crypto.randomUUID(),identity.id,target,now,account!.enabled,reason,...args),
      database.prepare(`UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND revoked_at IS NULL
        AND changes()=1 AND EXISTS (SELECT 1 FROM admin_account_rotations WHERE operation_id=? AND actor_admin_id=? AND request_hash=? AND target_admin_id=?)
        AND EXISTS (${authority})`)
        .bind(now,target,input.operationId,identity.id,requestHash,target,...args),
      database.prepare(`SELECT ${receiptFields} FROM (${allReceipts}) WHERE operation_id=? AND EXISTS (${authority})`).bind(input.operationId,...args),
    ]);
    authorized(result[0]);
    const committed = resolve(result[6].results[0] as Receipt | undefined,result[1].results.length !== 1);
    if (committed) return committed;
    throw new AdminError('The account or administrator authority changed. Refresh before choosing a new operation.',409);
  }
  const mutation = input.action === 'provision'
    ? database.prepare(`INSERT INTO admin_accounts(id,name,role,key_hash,created_at,updated_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS (${authority}) AND NOT EXISTS (SELECT 1 FROM admin_account_operations WHERE operation_id=?)
      AND NOT EXISTS (SELECT 1 FROM admin_account_rotations WHERE operation_id=?)
      AND NOT EXISTS (SELECT 1 FROM admin_accounts WHERE id=?) RETURNING id`)
      .bind(input.id,input.name,input.role,await fingerprint(input.key),now,now,...args,input.operationId,input.operationId,input.id)
    : input.action === 'role'
      ? database.prepare(`UPDATE admin_accounts SET role=?,updated_at=? WHERE id=? AND enabled=1 AND updated_at=? AND role=? AND role<>?
        AND id!=? AND EXISTS (${authority}) AND NOT EXISTS (SELECT 1 FROM admin_account_operations WHERE operation_id=?)
        AND NOT EXISTS (SELECT 1 FROM admin_account_rotations WHERE operation_id=?) RETURNING id`)
        .bind(input.role,nextTime,target,input.expectedUpdatedAt,account!.role,input.role,identity.id,...args,input.operationId,input.operationId)
      : database.prepare(`UPDATE admin_accounts SET enabled=0,updated_at=? WHERE id=? AND enabled=1 AND updated_at=? AND role=?
        AND id!=? AND EXISTS (${authority}) AND NOT EXISTS (SELECT 1 FROM admin_account_operations WHERE operation_id=?)
        AND NOT EXISTS (SELECT 1 FROM admin_account_rotations WHERE operation_id=?) RETURNING id`)
        .bind(nextTime,target,input.expectedUpdatedAt,account!.role,identity.id,...args,input.operationId,input.operationId);
  const result = await database.batch([
    database.prepare(authority).bind(...args),
    mutation,
    database.prepare(`INSERT INTO admin_account_operations(operation_id,actor_admin_id,request_hash,target_admin_id,action,name,role,enabled,created_at,updated_at)
      SELECT ?,?,?,?, ?,name,role,enabled,created_at,updated_at FROM admin_accounts
      WHERE id=? AND changes()=1 AND EXISTS (${authority})`)
      .bind(input.operationId,identity.id,requestHash,target,input.action,target,...args),
    input.action === 'role'
      ? database.prepare(`INSERT INTO admin_audit(id,actor_admin_id,target_admin_id,action,created_at,detail,reason)
        SELECT ?,?,?,'role',?,json_object('previousRole',?,'role',?),?
        WHERE changes()=1 AND EXISTS (${authority})`)
        .bind(crypto.randomUUID(),identity.id,target,now,account!.role,input.role,reason,...args)
      : database.prepare(`UPDATE admin_audit SET actor_admin_id=?,reason=? WHERE id=(
        SELECT id FROM admin_audit WHERE target_admin_id=? AND action=? AND actor_admin_id IS NULL ORDER BY rowid DESC LIMIT 1)
        AND changes()=1 AND EXISTS (${authority})`).bind(identity.id,reason,target,input.action === 'provision' ? 'provision' : 'revoke',...args),
    database.prepare(`SELECT ${receiptFields} FROM (${allReceipts}) WHERE operation_id=? AND EXISTS (${authority})`).bind(input.operationId,...args),
  ]);
  authorized(result[0]);
  const committed = resolve(result[4].results[0] as Receipt | undefined,result[1].results.length !== 1);
  if (committed) return committed;
  throw new AdminError('The account or administrator authority changed. Refresh before choosing a new operation.',409);
}
