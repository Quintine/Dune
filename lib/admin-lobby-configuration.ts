import { FACTIONS, type FactionId } from '../game/catalog';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import type { RoomControl } from './room-control';

export type AdminLobbyAction =
  | { type: 'rules'; advanced: boolean }
  | { type: 'techTokens' | 'strongholdCards'; enabled: boolean }
  | { type: 'addBot'; faction: FactionId; difficulty: Difficulty }
  | { type: 'removeBot' | 'assignHost'; target: string }
  | {
      type: 'configureBot';
      target: string;
      faction: FactionId;
      difficulty: Difficulty;
      position: number;
    };
export type AdminLobbyInput = {
  operationId: string;
  expectedVersion: number;
  action: AdminLobbyAction;
  reason: string;
};
export type AdminLobbyView = {
  code: string;
  version: number;
  status: 'lobby' | 'setup' | 'playing' | 'finished' | 'unreadable';
  editable: boolean;
  blockedReason: string | null;
  host: string | null;
  advanced: boolean;
  techTokens: boolean;
  strongholdCards: boolean;
  players: {
    id: string;
    name: string;
    faction: string;
    bot: Difficulty | null;
    position: number;
    ready: boolean;
    hostEligible: boolean;
  }[];
  control: RoomControl;
};
export type AdminLobbyResult = {
  operationId: string;
  replayed: boolean;
  appliedVersion: number;
  lobby: AdminLobbyView;
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const target = (value: unknown) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 80 &&
  value.trim() === value;
export function validAdminLobbyInput(value: unknown): value is AdminLobbyInput {
  if (
    !object(value) ||
    !keys(value, ['operationId', 'expectedVersion', 'action', 'reason']) ||
    typeof value.operationId !== 'string' ||
    value.operationId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value.operationId,
    ) ||
    !Number.isSafeInteger(value.expectedVersion) ||
    Number(value.expectedVersion) < 0 ||
    Number(value.expectedVersion) >= Number.MAX_SAFE_INTEGER ||
    typeof value.reason !== 'string' ||
    !value.reason.trim() ||
    value.reason.length > 300 ||
    value.reason
      .split('')
      .some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !object(value.action)
  )
    return false;
  const action = value.action;
  if (action.type === 'rules')
    return (
      keys(action, ['type', 'advanced']) && typeof action.advanced === 'boolean'
    );
  if (action.type === 'techTokens' || action.type === 'strongholdCards')
    return (
      keys(action, ['type', 'enabled']) && typeof action.enabled === 'boolean'
    );
  if (action.type === 'removeBot' || action.type === 'assignHost')
    return keys(action, ['type', 'target']) && target(action.target);
  if (action.type !== 'addBot' && action.type !== 'configureBot') return false;
  if (
    !FACTIONS.some(
      (faction) =>
        faction.id === action.faction && faction.expansion === 'base',
    ) ||
    !DIFFICULTIES.some((difficulty) => difficulty === action.difficulty)
  )
    return false;
  return action.type === 'addBot'
    ? keys(action, ['type', 'faction', 'difficulty'])
    : keys(action, ['type', 'target', 'faction', 'difficulty', 'position']) &&
        target(action.target) &&
        Number.isInteger(action.position) &&
        Number(action.position) >= 1 &&
        Number(action.position) <= 6;
}
