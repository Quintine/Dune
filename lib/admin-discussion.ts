import { FACTIONS } from '../game/catalog';

export type AdminDiscussionInput = {
  operationId: string; expectedVersion: number; expectedRevision: number;
  target: string; muted: boolean; reason: string;
};
export type AdminDiscussionView = {
  code: string; version: number; removed: boolean; closed: boolean; archived: boolean;
  status: 'lobby' | 'setup' | 'playing' | 'finished' | 'unreadable';
  editable: boolean; blockedReason: string | null;
  players: { id: string; name: string; faction: string; control: 'human' | 'autopilot' | 'ai'; muted: boolean; revision: number }[];
};
export type AdminDiscussionResult = { operationId: string; replayed: boolean; appliedRevision: number; room: AdminDiscussionView };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const counter = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER;
const oneLine = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !!value.trim() &&
  !value.split('').some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function validAdminDiscussionInput(value: unknown): value is AdminDiscussionInput {
  return object(value) && keys(value, ['operationId','expectedVersion','expectedRevision','target','muted','reason']) &&
    typeof value.operationId === 'string' && value.operationId.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.operationId) &&
    counter(value.expectedVersion) && counter(value.expectedRevision) && oneLine(value.target, 80) && value.target.trim() === value.target &&
    typeof value.muted === 'boolean' && oneLine(value.reason, 300);
}
export function validAdminDiscussionView(value: unknown): value is AdminDiscussionView {
  return object(value) && keys(value, ['code','version','removed','closed','archived','status','editable','blockedReason','players']) &&
    typeof value.code === 'string' && value.code.length === 8 && /^[A-Z2-9]{8}$/.test(value.code) && counter(value.version) &&
    ['removed','closed','archived','editable'].every(key => typeof value[key] === 'boolean') &&
    ['lobby','setup','playing','finished','unreadable'].includes(String(value.status)) && (value.blockedReason === null || typeof value.blockedReason === 'string') &&
    Array.isArray(value.players) && value.players.length <= 6 && value.players.every(player => object(player) &&
      keys(player, ['id','name','faction','control','muted','revision']) && oneLine(player.id, 80) && typeof player.name === 'string' && player.name.length <= 80 &&
      FACTIONS.some(faction => faction.id === player.faction) && ['human','autopilot','ai'].includes(String(player.control)) &&
      typeof player.muted === 'boolean' && counter(player.revision));
}
