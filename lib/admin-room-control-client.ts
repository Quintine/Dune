import { randomId } from './random-id';
import { ClientRequestError, requestMayHaveCompleted } from './client-request';
import { validAdminRoomControlInput, type AdminRoomControlInput, type RoomControl } from './room-control';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageKey = (account: string, room: string) => `dune.admin-room-control.v1:${account}:${room}`;

/** Denial now cannot establish whether an earlier attempt committed under the original session. */
export function retainAdminRoomRequest(error: unknown): boolean {
  return requestMayHaveCompleted(error) || (error instanceof ClientRequestError && [401, 403].includes(error.status ?? 0));
}

export function newAdminRoomRequest(control: RoomControl, paused: boolean, joinLocked: boolean, reason: string): AdminRoomControlInput {
  const input = { operationId: randomId(), expectedRevision: control.revision, paused, joinLocked, reason: reason.trim() };
  if (!validAdminRoomControlInput(input)) throw new Error('Enter a reason of 1–300 characters on one line.');
  return input;
}

export function readAdminRoomRequest(storage: Storage, account: string, room: string): AdminRoomControlInput | null {
  const raw = storage.getItem(storageKey(account, room));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminRoomControlInput(value)) throw new Error('This tab’s saved room-settings request is unreadable. Inspect the current settings before discarding the local retry record.');
  return value;
}

/** Save before sending; never overwrite a different unresolved request. */
export function saveAdminRoomRequest(storage: Storage, account: string, room: string, input: AdminRoomControlInput) {
  if (!validAdminRoomControlInput(input)) throw new Error('Invalid room-settings request.');
  const previous = readAdminRoomRequest(storage, account, room);
  const encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved room-settings request before sending a new one.');
  storage.setItem(storageKey(account, room), encoded);
  if (storage.getItem(storageKey(account, room)) !== encoded) throw new Error('Could not preserve the room-settings request in this tab. Nothing was sent.');
}

export function clearAdminRoomRequest(storage: Storage, account: string, room: string) {
  storage.removeItem(storageKey(account, room));
  if (storage.getItem(storageKey(account, room)) !== null) throw new Error('The saved retry record could not be cleared.');
}
