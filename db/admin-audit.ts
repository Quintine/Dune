import { AdminError, type AdminIdentity } from './admin-access';
import { AUDIT_CATEGORIES, AUDIT_ACTIONS, type AdminAuditEvent, type AdminAuditPage, type AuditCategory, type AuditChange } from '../lib/admin-audit';
import { FACTIONS } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';

const authority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND s.revoked_at IS NULL
  AND s.expires_at>? AND s.generation=a.session_generation AND a.role IN ('owner','operator','viewer')`;
const json = (column: string) => `CASE WHEN json_valid(${column}) THEN ${column} ELSE '{}' END`;
const actionType = `json_extract(${json('action')},'$.type')`;
// These are receipt tables only. Never join private games, messages or credential tables.
// Raw JSON is bounded then freshly projected; credential/hash columns are never selected.
// Workerd permits at most five terms in one compound SELECT. Materialize two
// bounded groups so SQLite cannot flatten the nine sources back into one union.
const rawEvents = `WITH first_events AS MATERIALIZED (
  SELECT 'account' category,rowid row_key,id receipt_id,actor_admin_id actor_id,NULL room_code,target_admin_id target_admin_id,NULL target_seat_id,
    CASE WHEN action IN ('provision','revoke','role','rotate','login','logout','logout_all') THEN action ELSE 'unknown' END action,
    reason,NULL before_json,substr(detail,1,8192) after_json,created_at FROM admin_audit
  UNION ALL SELECT 'control',rowid,operation_id,actor_admin_id,room_code,NULL,NULL,'room_control',reason,
    json_object('paused',before_paused,'joinLocked',before_join_locked,'revision',expected_revision),
    json_object('paused',after_paused,'joinLocked',after_join_locked,'revision',expected_revision+1),created_at FROM admin_room_audit
  UNION ALL SELECT 'creation',rowid,operation_id,actor_admin_id,room_code,NULL,host_id,'create',reason,NULL,substr(configuration,1,8192),created_at FROM admin_room_creations
  UNION ALL SELECT 'lobby',rowid,operation_id,actor_admin_id,room_code,NULL,
    CASE WHEN ${actionType} IN ('removeBot','assignHost','configureBot') THEN json_extract(${json('action')},'$.target') ELSE NULL END,
    CASE WHEN ${actionType} IN ('rules','techTokens','strongholdCards','addBot','removeBot','assignHost','configureBot') THEN ${actionType} ELSE 'unknown' END,
    reason,substr(before_configuration,1,8192),substr(after_configuration,1,8192),created_at FROM admin_lobby_operations
  UNION ALL SELECT 'removal',rowid,operation_id,actor_admin_id,room_code,NULL,NULL,CASE removed WHEN 1 THEN 'remove' WHEN 0 THEN 'restore' ELSE 'unknown' END,
    reason,substr(before_metadata,1,8192),substr(after_metadata,1,8192),created_at FROM admin_room_removals
), last_events AS MATERIALIZED (
  SELECT 'closure',rowid,operation_id,actor_admin_id,room_code,NULL,NULL,CASE closed WHEN 1 THEN 'close' WHEN 0 THEN 'reopen' ELSE 'unknown' END,
    reason,substr(before_metadata,1,8192),substr(after_metadata,1,8192),created_at FROM admin_room_closures
  UNION ALL SELECT 'archive',rowid,operation_id,actor_admin_id,room_code,NULL,NULL,CASE archived WHEN 1 THEN 'archive' WHEN 0 THEN 'unarchive' ELSE 'unknown' END,
    reason,substr(before_metadata,1,8192),substr(after_metadata,1,8192),created_at FROM admin_room_archives
  UNION ALL SELECT 'participant_ai',rowid,operation_id,actor_admin_id,room_code,NULL,target,'participant_ai',reason,
    json_object('version',expected_version),json_object('version',applied_version,'difficulty',difficulty),created_at FROM admin_seat_ai_operations
  UNION ALL SELECT 'discussion',rowid,operation_id,actor_admin_id,room_code,NULL,target,CASE muted WHEN 1 THEN 'mute' WHEN 0 THEN 'unmute' ELSE 'unknown' END,reason,
    json_object('revision',expected_revision),json_object('revision',applied_revision,'muted',muted),created_at FROM admin_discussion_operations
), raw_events AS (
  SELECT * FROM first_events UNION ALL SELECT * FROM last_events
)`;
// Search exactly the normalized public columns, never values rejected by projection.
const sqlId = (column: string) => `CASE WHEN typeof(${column})='text' AND instr(${column},char(0))=0 AND length(${column})=36
  AND substr(${column},9,1)='-' AND substr(${column},14,1)='-' AND substr(${column},19,1)='-' AND substr(${column},24,1)='-'
  AND length(replace(${column},'-',''))=32 AND replace(${column},'-','') NOT GLOB '*[^0-9a-f]*' THEN ${column} ELSE NULL END`;
const sqlName = (column: string) => `CASE WHEN typeof(${column})='text' AND length(${column})<=80
  AND instr(${column},char(0))=0 AND ${column} NOT GLOB '*['||char(${Array.from({length:31},(_,i)=>i+1).join(',')},127)||']*' THEN ${column} ELSE NULL END`;
const events = `${rawEvents}, events AS (SELECT e.category,e.row_key,e.receipt_id,${sqlId('e.actor_id')} actor_id,
  ${sqlName('a.name')} actor_name,${sqlId('e.target_admin_id')} target_admin_id,${sqlName('t.name')} target_admin_name,
  ${sqlId('e.target_seat_id')} target_seat_id,
  CASE WHEN typeof(e.room_code)='text' AND instr(e.room_code,char(0))=0 AND length(e.room_code)=8 AND e.room_code NOT GLOB '*[^A-Z2-9]*' THEN e.room_code ELSE NULL END room_code,
  e.action,e.reason,e.before_json,e.after_json,e.created_at
  FROM raw_events e LEFT JOIN admin_accounts a ON a.id=${sqlId('e.actor_id')} LEFT JOIN admin_accounts t ON t.id=${sqlId('e.target_admin_id')})`;
type Row = { category: AuditCategory; row_key: number; receipt_id: string; actor_id: unknown; actor_name: unknown; target_admin_name: unknown; target_admin_id: unknown; room_code: unknown; target_seat_id: unknown; action: string; reason: unknown; before_json: string | null; after_json: string | null; created_at: unknown };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasControl = (v: string) => Array.from(v).some(c => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127);
const safeText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max && !hasControl(v) ? v : null;
const id = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
const number = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 8640000000000000 ? String(v) : null;
const flag = (v: unknown) => v === true || v === 1 ? 'Yes' : v === false || v === 0 ? 'No' : null;
const role = (v: unknown) => typeof v === 'string' && ['owner','operator','viewer'].includes(v) ? v : null;
function parse(raw: string | null) { try { const v: unknown = raw === null ? null : JSON.parse(raw); return object(v) ? v : {}; } catch { return {}; } }
function configuration(value: Record<string, unknown>): Record<string, string | null> {
  const bots = Array.isArray(value.bots) ? value.bots : Array.isArray(value.players) ? value.players.filter(p => object(p) && p.bot) : null;
  return { 'Rules': value.advanced === true ? 'Advanced preview' : value.advanced === false ? 'Basic' : null,
    'Tech Tokens': typeof value.techTokens === 'boolean' ? flag(value.techTokens) : null,
    'Stronghold Cards': typeof value.strongholdCards === 'boolean' ? flag(value.strongholdCards) : null,
    'Host seat': id(value.host), 'Host faction': FACTIONS.find(f => f.id === value.faction)?.name ?? null,
    'Player count': Array.isArray(value.players) && value.players.length <= 6 ? String(value.players.length) : null,
    'AI seats': bots && bots.length <= 5 && bots.every(b => object(b) && FACTIONS.some(f => f.id === b.faction) && DIFFICULTIES.some(d => d === (b.difficulty ?? b.bot))) ?
      bots.map(b => `${FACTIONS.find(f => f.id === b.faction)!.name} (${b.difficulty ?? b.bot})`).join(', ') || 'None' : null };
}
export function projectAdminAudit(row: Row, reasonsVisible: boolean): AdminAuditEvent {
  const before = parse(row.before_json), after = parse(row.after_json), changes: AuditChange[] = [];
  const add = (field: AuditChange['field'], a: string | null, b: string | null) => { if (a !== null || b !== null) changes.push({ field,before:a,after:b }); };
  if (row.category === 'account') add('Role',role(after.previousRole),role(after.role));
  if (row.category === 'account' && row.action === 'rotate') add('Enabled',flag(after.previousEnabled),flag(after.enabled));
  if (row.category === 'lobby' || row.category === 'creation') {
    const a = configuration(before), b = configuration(after);
    for (const field of ['Rules','Tech Tokens','Stronghold Cards','Host seat','Host faction','Player count','AI seats'] as const) add(field,a[field],b[field]);
  }
  if (row.category === 'lobby' && row.action === 'configureBot') {
    const target = id(row.target_seat_id);
    const player = (config: Record<string,unknown>) => target && Array.isArray(config.players) ? config.players.find(p => object(p) && p.id === target) : null;
    const a = player(before), b = player(after);
    const position = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 6 ? String(v) : null;
    add('Player circle',position(a?.position),position(b?.position));
  }
  for (const [field,key] of [['Paused','paused'],['Joining locked','joinLocked'],['Removed','removed'],['Closed','closed'],['Archived','archived'],['Discussion muted','muted']] as const)
    if (['control','removal','closure','archive','discussion'].includes(row.category)) add(field,flag(before[key]),flag(after[key]));
  if (['control','removal','closure','archive','discussion'].includes(row.category)) add('Setting revision',number(before.revision),number(after.revision));
  if (['removal','closure','archive','participant_ai'].includes(row.category)) add('Game version',number(before.version),number(after.version));
  if (row.category === 'participant_ai') add('Difficulty',null,DIFFICULTIES.find(d => d === after.difficulty) ?? null);
  return { id: `${row.category}:${row.row_key}`,category:row.category,action:Object.hasOwn(AUDIT_ACTIONS,row.action) ? row.action as AdminAuditEvent['action'] : 'unknown',
    createdAt:number(row.created_at) === null ? null : Number(row.created_at), actorId:id(row.actor_id),actorName:safeText(row.actor_name,160),targetAdminId:id(row.target_admin_id),targetAdminName:safeText(row.target_admin_name,160),
    roomCode: typeof row.room_code === 'string' && /^[A-Z2-9]{8}$/.test(row.room_code) ? row.room_code : null,targetSeatId:id(row.target_seat_id),
    reason:reasonsVisible ? safeText(row.reason,300) : null,outcome:'recorded',changes };
}
function date(value: string | null): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AdminError('Use calendar dates for the history range.',400);
  const time = Date.parse(value+'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== value) throw new AdminError('Use valid calendar dates for the history range.',400);
  return time;
}
export async function readAdminAudit(database: D1Database, identity: AdminIdentity, search: URLSearchParams, now = Date.now()): Promise<AdminAuditPage> {
  if (!identity || typeof identity.id !== 'string' || !/^[0-9a-f]{64}$/.test(identity.sessionHash)) throw new AdminError('Administrator sign-in required.',401);
  const allowed = ['q','category','from','to','page'];
  if ([...search.keys()].some(k => !allowed.includes(k) || search.getAll(k).length !== 1)) throw new AdminError('Invalid action history filters.',400);
  const q = (search.get('q') ?? '').trim(), category = search.get('category') || 'all', rawPage = search.get('page') ?? '1';
  const from = date(search.get('from')), to = date(search.get('to'));
  if (q.length > 80 || hasControl(q) || category !== 'all' && !Object.hasOwn(AUDIT_CATEGORIES,category) || !/^[1-9][0-9]{0,5}$/.test(rawPage) || from !== null && to !== null && from > to)
    throw new AdminError('Check the action history filters and date range.',400);
  const credentials = [identity.sessionHash,identity.id,now], conditions = [`EXISTS (${authority})`], args: (string | number)[] = [...credentials];
  if (q) {
    const pattern = '%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    conditions.push(`(e.room_code LIKE ? ESCAPE '\\' OR e.actor_id LIKE ? ESCAPE '\\' OR e.actor_name LIKE ? ESCAPE '\\' OR e.target_admin_id LIKE ? ESCAPE '\\' OR e.target_seat_id LIKE ? ESCAPE '\\' OR e.target_admin_name LIKE ? ESCAPE '\\')`);
    args.push(pattern,pattern,pattern,pattern,pattern,pattern);
  }
  if (category !== 'all') { conditions.push('e.category=?'); args.push(category); }
  if (from !== null) { conditions.push('e.created_at>=?'); args.push(from); }
  if (to !== null) { conditions.push('e.created_at<?'); args.push(to+86400000); }
  const source = `FROM events e WHERE ${conditions.join(' AND ')}`;
  const results = await database.batch([
    database.prepare(authority).bind(...credentials),
    database.prepare(`${events} SELECT COUNT(*) AS total ${source}`).bind(...args),
    database.prepare(`${events} SELECT e.category,e.row_key,e.receipt_id,e.actor_id,e.actor_name,e.room_code,e.target_admin_id,e.target_admin_name,e.target_seat_id,e.action,
      CASE WHEN (${authority}) IN ('owner','operator') THEN substr(e.reason,1,301) ELSE NULL END reason,
      e.before_json,e.after_json,e.created_at ${source} ORDER BY e.created_at DESC,e.category ASC,e.receipt_id ASC LIMIT 25 OFFSET ?`)
      .bind(...credentials,...args,(Number(rawPage)-1)*25),
  ]);
  const liveRole = (results[0].results[0] as { role: string } | undefined)?.role;
  if (!liveRole) throw new AdminError('Administrator sign-in required.',401);
  const reasonsVisible = liveRole !== 'viewer';
  return { events:(results[2].results as Row[]).map(row => projectAdminAudit(row,reasonsVisible)),total:Number((results[1].results[0] as { total: number }).total),page:Number(rawPage),pageSize:25,reasonsVisible };
}
