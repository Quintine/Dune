import { randomId } from './random-id';
import { validAdminArchiveInput, type AdminArchiveInput, type AdminArchiveView, type AdminArchiveResult } from './admin-archive';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-archive-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const timestamp = (value: unknown) => value === null || integer(value) && value <= 8_640_000_000_000_000;

export function validAdminArchiveView(value: unknown): value is AdminArchiveView {
  return object(value) && keys(value, ['closed', 'removed', 'code', 'version', 'archived', 'revision', 'archivedAt', 'updatedAt', 'paused', 'joinLocked']) &&
    typeof value.code === 'string' && /^[A-Z2-9]{8}$/.test(value.code) && integer(value.version) && integer(value.revision) &&
    typeof value.closed === 'boolean' && typeof value.removed === 'boolean' && typeof value.archived === 'boolean' && typeof value.paused === 'boolean' && typeof value.joinLocked === 'boolean' &&
    timestamp(value.archivedAt) && timestamp(value.updatedAt);
}

export function adminArchiveResponse(value: unknown, code: string): AdminArchiveView {
  if (!validAdminArchiveView(value) || value.code !== code) throw new Error('The server returned unreadable room availability.');
  return value;
}

export function adminArchiveConfirmation(value: unknown, code: string, input: AdminArchiveInput): AdminArchiveResult {
  if (!object(value) || !keys(value, ['operationId', 'replayed', 'appliedRevision', 'appliedVersion', 'room']) ||
      value.operationId !== input.operationId || typeof value.replayed !== 'boolean' ||
      !integer(value.appliedVersion) || value.appliedVersion !== input.expectedVersion + 1 ||
      !integer(value.appliedRevision) || value.appliedRevision !== input.expectedRevision + 1)
    throw new Error('The server did not confirm this archive or unarchive request.');
  const room = adminArchiveResponse(value.room, code);
  if (room.version < value.appliedVersion || room.revision < value.appliedRevision)
    throw new Error('The server returned room availability older than the confirmed change.');
  return value as AdminArchiveResult;
}

export function newAdminArchiveRequest(view: AdminArchiveView, archived: boolean, reason: string): AdminArchiveInput {
  const input = { operationId: randomId(), expectedVersion: view.version, expectedRevision: view.revision, archived, reason: reason.trim() };
  if (!validAdminArchiveInput(input)) throw new Error('Enter a reason of 1–300 characters on one line.');
  if (view.removed) throw new Error('Restore this removed room before changing its archive.');
  if (!view.closed) throw new Error('Close this room before changing its archive state.');
  if (archived === view.archived) throw new Error('Refresh the room before choosing an archive or unarchive.');
  return input;
}

export function readAdminArchiveRequest(storage: Storage, account: string, code: string): AdminArchiveInput | null {
  const raw = storage.getItem(key(account, code));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminArchiveInput(value)) throw new Error('This tab’s saved archive or unarchive request is unreadable. Inspect the current room before discarding its local retry record.');
  return value;
}

/** Save before sending; a different unresolved request must never be replaced. */
export function saveAdminArchiveRequest(storage: Storage, account: string, code: string, input: AdminArchiveInput) {
  if (!validAdminArchiveInput(input)) throw new Error('Invalid archive or unarchive request.');
  const previous = readAdminArchiveRequest(storage, account, code), encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved archive or unarchive request before sending a different change.');
  storage.setItem(key(account, code), encoded);
  if (storage.getItem(key(account, code)) !== encoded) throw new Error('The archive or unarchive request could not be preserved in this tab. Nothing was sent.');
}

export function clearAdminArchiveRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved archive or unarchive request could not be cleared.');
}
