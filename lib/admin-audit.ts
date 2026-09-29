export const AUDIT_CATEGORIES = {
  account: 'Administrator access', control: 'Pause and joining', creation: 'Room creation', lobby: 'Lobby configuration',
  removal: 'Room removal', closure: 'Close and reopen', archive: 'Room archive', participant_ai: 'Participant AI', discussion: 'Discussion moderation',
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const AUDIT_ACTIONS = {
  provision: 'Provision administrator', revoke: 'Revoke administrator', login: 'Sign in', logout: 'Sign out', logout_all: 'Sign out everywhere',
  room_control: 'Apply room controls', create: 'Create room', rules: 'Change rules', techTokens: 'Change Tech Tokens', strongholdCards: 'Change Stronghold Cards',
  addBot: 'Add AI player', removeBot: 'Remove AI player', assignHost: 'Assign host', configureBot: 'Configure AI player',
  remove: 'Remove room', restore: 'Restore room', close: 'Close room', reopen: 'Reopen room', archive: 'Archive room', unarchive: 'Unarchive room',
  participant_ai: 'Enable participant AI', mute: 'Mute discussion', unmute: 'Unmute discussion', unknown: 'Unrecognized recorded action',
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;
export const AUDIT_FIELDS = ['Role','Rules','Tech Tokens','Stronghold Cards','Host seat','Host faction','AI seats','Player count','Paused','Joining locked','Removed','Closed','Archived','Game version','Setting revision','Difficulty','Discussion muted','Player circle'] as const;
export type AuditChange = { field: typeof AUDIT_FIELDS[number]; before: string | null; after: string | null };
export type AdminAuditEvent = {
  id: string; category: AuditCategory; action: AuditAction; createdAt: number | null;
  actorId: string | null; actorName: string | null; targetAdminId: string | null; targetAdminName: string | null;
  roomCode: string | null; targetSeatId: string | null;
  reason: string | null; outcome: 'recorded'; changes: AuditChange[];
};
export type AdminAuditPage = { events: AdminAuditEvent[]; total: number; page: number; pageSize: 25; reasonsVisible: boolean };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, list: string[]) => Object.keys(v).length === list.length && list.every(k => Object.hasOwn(v,k));
const nullableText = (v: unknown, max: number) => v === null || typeof v === 'string' && v.length <= max;
export function adminAuditResponse(value: unknown): AdminAuditPage {
  if (!object(value) || !keys(value,['events','total','page','pageSize','reasonsVisible']) || value.pageSize !== 25 ||
      !Number.isSafeInteger(value.total) || Number(value.total) < 0 || !Number.isSafeInteger(value.page) || Number(value.page) < 1 ||
      typeof value.reasonsVisible !== 'boolean' || !Array.isArray(value.events) || value.events.length > 25 || !value.events.every(e =>
        object(e) && keys(e,['id','category','action','createdAt','actorId','actorName','targetAdminId','targetAdminName','roomCode','targetSeatId','reason','outcome','changes']) &&
        typeof e.id === 'string' && e.id.length <= 100 && typeof e.category === 'string' && Object.hasOwn(AUDIT_CATEGORIES,e.category) &&
        typeof e.action === 'string' && Object.hasOwn(AUDIT_ACTIONS,e.action) && e.outcome === 'recorded' &&
        (e.createdAt === null || Number.isSafeInteger(e.createdAt) && Number(e.createdAt) >= 0 && Number(e.createdAt) <= 8640000000000000) &&
        ['actorId','targetAdminId','targetSeatId'].every(k => nullableText(e[k],80)) && nullableText(e.actorName,160) && nullableText(e.targetAdminName,160) && nullableText(e.roomCode,8) &&
        nullableText(e.reason,300) && (value.reasonsVisible || e.reason === null) && Array.isArray(e.changes) && e.changes.length <= AUDIT_FIELDS.length &&
        e.changes.every(c => object(c) && keys(c,['field','before','after']) && AUDIT_FIELDS.some(f => f === c.field) && nullableText(c.before,240) && nullableText(c.after,240))))
    throw new Error('The server returned unreadable action history. Refresh to try again.');
  return value as AdminAuditPage;
}
