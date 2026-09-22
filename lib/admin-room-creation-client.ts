import { randomId } from './random-id';
import { validAdminRoomCreationInput, type AdminRoomCreationInput, type AdminRoomCreationResult } from './admin-room-creation';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type AdminRoomCreationRecord = { kind: 'pending'; input: AdminRoomCreationInput } | { kind: 'completed'; result: AdminRoomCreationResult };
const key = (account: string) => `dune.admin-room-creation.v1:${account}`;
const uuid = (value: unknown) => typeof value === 'string' && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export function validAdminRoomCreationResult(value: unknown): value is AdminRoomCreationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === (result.roomRemoved === true ? 6 : 5) &&
    (!Object.hasOwn(result, 'roomRemoved') || result.roomRemoved === true && result.hostAccess === false) && typeof result.code === 'string' && result.code.length === 8 && /^[A-Z2-9]{8}$/.test(result.code) &&
    uuid(result.hostId) && uuid(result.operationId) && typeof result.replayed === 'boolean' && typeof result.hostAccess === 'boolean';
}

export function newAdminRoomCreationRequest(fields: Omit<AdminRoomCreationInput, 'operationId' | 'sessionToken'>): AdminRoomCreationInput {
  const input = { ...fields, name: fields.name.trim(), reason: fields.reason.trim(), operationId: randomId(),
    sessionToken: Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') };
  if (!validAdminRoomCreationInput(input)) throw new Error('Check the host, rules, AI seats and operational reason.');
  return input;
}

export function readAdminRoomCreation(storage: Storage, account: string): AdminRoomCreationRecord | null {
  const raw = storage.getItem(key(account));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 4096 ? JSON.parse(raw) : null; } catch { value = null; }
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2) {
    const record = value as Record<string, unknown>;
    if (record.kind === 'pending' && validAdminRoomCreationInput(record.input)) return value as AdminRoomCreationRecord;
    if (record.kind === 'completed' && validAdminRoomCreationResult(record.result)) return value as AdminRoomCreationRecord;
  }
  throw new Error('This tab’s saved room-creation record is unreadable. Keep it until you have checked the room directory; no new request has been sent.');
}

function write(storage: Storage, account: string, record: AdminRoomCreationRecord) {
  const text = JSON.stringify(record);
  storage.setItem(key(account), text);
  if (storage.getItem(key(account)) !== text) throw new Error('The room-creation record could not be saved in this tab.');
}

export function saveAdminRoomCreation(storage: Storage, account: string, input: AdminRoomCreationInput) {
  if (!validAdminRoomCreationInput(input)) throw new Error('Invalid room-creation request.');
  const previous = readAdminRoomCreation(storage, account);
  if (previous && (previous.kind !== 'pending' || JSON.stringify(previous.input) !== JSON.stringify(input)))
    throw new Error('Resolve the saved room-creation record before creating another room.');
  write(storage, account, { kind: 'pending', input });
}

export function completeAdminRoomCreation(storage: Storage, account: string, input: AdminRoomCreationInput, result: AdminRoomCreationResult) {
  if (!validAdminRoomCreationResult(result) || result.operationId !== input.operationId) throw new Error('The server did not confirm this room-creation request.');
  if (result.roomRemoved) throw new Error('The room is temporarily removed. Keep the exact creation proof until an administrator restores it.');
  const previous = readAdminRoomCreation(storage, account);
  if (!previous || previous.kind !== 'pending' || JSON.stringify(previous.input) !== JSON.stringify(input))
    throw new Error('The saved room-creation record changed. Keep the current record and inspect the room directory.');
  // Replace the private retry proof with a safe room receipt in one storage write.
  write(storage, account, { kind: 'completed', result });
}

export function clearAdminRoomCreation(storage: Storage, account: string) {
  storage.removeItem(key(account));
  if (storage.getItem(key(account)) !== null) throw new Error('The local room-creation record could not be cleared.');
}
