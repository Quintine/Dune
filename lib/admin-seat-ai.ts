import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

export type AdminSeatAiInput = {
  operationId: string; expectedVersion: number; expectedControlRevision: number;
  target: string; difficulty: Difficulty; reason: string;
};
export type AdminSeatAiView = {
  code: string; version: number; controlRevision: number;
  status: 'lobby' | 'setup' | 'playing' | 'finished' | 'unreadable';
  paused: boolean; closed: boolean; removed: boolean; archived: boolean;
  editable: boolean; blockedReason: string | null;
  players: { id: string; name: string; faction: string; control: 'human' | 'ai' | 'autopilot'; difficulty: Difficulty | null; eligible: boolean }[];
};
export type AdminSeatAiResult = { operationId: string; replayed: boolean; appliedVersion: number; room: AdminSeatAiView };

const hasControlCharacter = (text: string) => text.split('').some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function validAdminSeatAiInput(value: unknown): value is AdminSeatAiInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>, fields = ['operationId', 'expectedVersion', 'expectedControlRevision', 'target', 'difficulty', 'reason'];
  return Object.keys(input).length === fields.length && fields.every(key => Object.hasOwn(input, key)) &&
    typeof input.operationId === 'string' && input.operationId.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.operationId) &&
    [input.expectedVersion, input.expectedControlRevision].every(value => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER) &&
    typeof input.target === 'string' && input.target.length > 0 && input.target.length <= 80 && input.target.trim() === input.target && !hasControlCharacter(input.target) &&
    DIFFICULTIES.some(difficulty => difficulty === input.difficulty) &&
    typeof input.reason === 'string' && !!input.reason.trim() && input.reason.length <= 300 && !hasControlCharacter(input.reason);
}
