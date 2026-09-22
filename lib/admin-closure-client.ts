import { randomId } from './random-id';
import { validAdminClosureInput, type AdminClosureInput, type AdminClosureView, type AdminClosureResult } from './admin-closure';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-closure-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const timestamp = (value: unknown) => value === null || integer(value) && value <= 8_640_000_000_000_000;

export function validAdminClosureView(value: unknown): value is AdminClosureView {
  return object(value) && keys(value, ['removed', 'code', 'version', 'closed', 'revision', 'closedAt', 'updatedAt', 'paused', 'joinLocked']) &&
    typeof value.code === 'string' && /^[A-Z2-9]{8}$/.test(value.code) && integer(value.version) && integer(value.revision) &&
    typeof value.removed === 'boolean' && typeof value.closed === 'boolean' && typeof value.paused === 'boolean' && typeof value.joinLocked === 'boolean' &&
    timestamp(value.closedAt) && timestamp(value.updatedAt);
}

export function adminClosureResponse(value: unknown, code: string): AdminClosureView {
  if (!validAdminClosureView(value) || value.code !== code) throw new Error('The server returned unreadable room availability.');
  return value;
}

export function adminClosureConfirmation(value: unknown, code: string, input: AdminClosureInput): AdminClosureResult {
  if (!object(value) || !keys(value, ['operationId', 'replayed', 'appliedRevision', 'appliedVersion', 'room']) ||
      value.operationId !== input.operationId || typeof value.replayed !== 'boolean' ||
      !integer(value.appliedVersion) || value.appliedVersion !== input.expectedVersion + 1 ||
      !integer(value.appliedRevision) || value.appliedRevision !== input.expectedRevision + 1)
    throw new Error('The server did not confirm this closure or reopening request.');
  const room = adminClosureResponse(value.room, code);
  if (room.version < value.appliedVersion || room.revision < value.appliedRevision)
    throw new Error('The server returned room availability older than the confirmed change.');
  return value as AdminClosureResult;
}

export function newAdminClosureRequest(view: AdminClosureView, closed: boolean, reason: string): AdminClosureInput {
  const input = { operationId: randomId(), expectedVersion: view.version, expectedRevision: view.revision, closed, reason: reason.trim() };
  if (!validAdminClosureInput(input)) throw new Error('Enter a reason of 1–300 characters on one line.');
  if (view.removed) throw new Error('Restore this removed room before changing its closure.');
  if (closed === view.closed) throw new Error('Refresh the room before choosing a closure or reopening.');
  return input;
}

export function readAdminClosureRequest(storage: Storage, account: string, code: string): AdminClosureInput | null {
  const raw = storage.getItem(key(account, code));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminClosureInput(value)) throw new Error('This tab’s saved closure or reopening request is unreadable. Inspect the current room before discarding its local retry record.');
  return value;
}

/** Save before sending; a different unresolved request must never be replaced. */
export function saveAdminClosureRequest(storage: Storage, account: string, code: string, input: AdminClosureInput) {
  if (!validAdminClosureInput(input)) throw new Error('Invalid closure or reopening request.');
  const previous = readAdminClosureRequest(storage, account, code), encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved closure or reopening request before sending a different change.');
  storage.setItem(key(account, code), encoded);
  if (storage.getItem(key(account, code)) !== encoded) throw new Error('The closure or reopening request could not be preserved in this tab. Nothing was sent.');
}

export function clearAdminClosureRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved closure or reopening request could not be cleared.');
}
