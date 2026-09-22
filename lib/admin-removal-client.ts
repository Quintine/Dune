import { randomId } from './random-id';
import { validAdminRemovalInput, type AdminRemovalInput, type AdminRemovalView, type AdminRemovalResult } from './admin-removal';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-removal-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const timestamp = (value: unknown) => value === null || integer(value) && value <= 8_640_000_000_000_000;

export function validAdminRemovalView(value: unknown): value is AdminRemovalView {
  return object(value) && keys(value, ['code', 'version', 'removed', 'revision', 'removedAt', 'updatedAt', 'paused', 'joinLocked']) &&
    typeof value.code === 'string' && /^[A-Z2-9]{8}$/.test(value.code) && integer(value.version) && integer(value.revision) &&
    typeof value.removed === 'boolean' && typeof value.paused === 'boolean' && typeof value.joinLocked === 'boolean' &&
    timestamp(value.removedAt) && timestamp(value.updatedAt);
}

export function adminRemovalResponse(value: unknown, code: string): AdminRemovalView {
  if (!validAdminRemovalView(value) || value.code !== code) throw new Error('The server returned unreadable room availability.');
  return value;
}

export function adminRemovalConfirmation(value: unknown, code: string, input: AdminRemovalInput): AdminRemovalResult {
  if (!object(value) || !keys(value, ['operationId', 'replayed', 'appliedRevision', 'appliedVersion', 'room']) ||
      value.operationId !== input.operationId || typeof value.replayed !== 'boolean' ||
      !integer(value.appliedVersion) || value.appliedVersion !== input.expectedVersion + 1 ||
      !integer(value.appliedRevision) || value.appliedRevision !== input.expectedRevision + 1)
    throw new Error('The server did not confirm this removal or restoration request.');
  const room = adminRemovalResponse(value.room, code);
  if (room.version < value.appliedVersion || room.revision < value.appliedRevision)
    throw new Error('The server returned room availability older than the confirmed change.');
  return value as AdminRemovalResult;
}

export function newAdminRemovalRequest(view: AdminRemovalView, removed: boolean, reason: string): AdminRemovalInput {
  const input = { operationId: randomId(), expectedVersion: view.version, expectedRevision: view.revision, removed, reason: reason.trim() };
  if (!validAdminRemovalInput(input)) throw new Error('Enter a reason of 1–300 characters on one line.');
  if (removed === view.removed) throw new Error('Refresh the room before choosing a removal or restoration.');
  return input;
}

export function readAdminRemovalRequest(storage: Storage, account: string, code: string): AdminRemovalInput | null {
  const raw = storage.getItem(key(account, code));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminRemovalInput(value)) throw new Error('This tab’s saved removal or restoration request is unreadable. Inspect the current room before discarding its local retry record.');
  return value;
}

/** Save before sending; a different unresolved request must never be replaced. */
export function saveAdminRemovalRequest(storage: Storage, account: string, code: string, input: AdminRemovalInput) {
  if (!validAdminRemovalInput(input)) throw new Error('Invalid removal or restoration request.');
  const previous = readAdminRemovalRequest(storage, account, code), encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved removal or restoration request before sending a different change.');
  storage.setItem(key(account, code), encoded);
  if (storage.getItem(key(account, code)) !== encoded) throw new Error('The removal or restoration request could not be preserved in this tab. Nothing was sent.');
}

export function clearAdminRemovalRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved removal or restoration request could not be cleared.');
}
