import { randomId } from './random-id';
import { validAdminDiscussionInput, validAdminDiscussionView, type AdminDiscussionInput, type AdminDiscussionView, type AdminDiscussionResult } from './admin-discussion';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-discussion-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function adminDiscussionResponse(value: unknown, code: string): AdminDiscussionView {
  if (!validAdminDiscussionView(value) || value.code !== code) throw new Error('The server returned unreadable participant discussion settings.');
  return value;
}
export function adminDiscussionConfirmation(value: unknown, code: string, input: AdminDiscussionInput): AdminDiscussionResult {
  if (!object(value) || Object.keys(value).length !== 4 || !['operationId','replayed','appliedRevision','room'].every(key => Object.hasOwn(value, key)) ||
      value.operationId !== input.operationId || typeof value.replayed !== 'boolean' || value.appliedRevision !== input.expectedRevision + 1)
    throw new Error('The server did not confirm this participant discussion request.');
  const room = adminDiscussionResponse(value.room, code), target = room.players.find(player => player.id === input.target);
  if (room.version < input.expectedVersion || (target && target.revision < Number(value.appliedRevision)))
    throw new Error('The server returned participant settings older than the confirmed change.');
  return value as AdminDiscussionResult;
}
export function newAdminDiscussionRequest(view: AdminDiscussionView, target: string, muted: boolean, reason: string): AdminDiscussionInput {
  if (!view.editable) throw new Error(view.blockedReason ?? 'Refresh participant discussion settings.');
  const player = view.players.find(player => player.id === target && player.control !== 'ai');
  if (!player || player.muted === muted) throw new Error('Choose a human participant with a different discussion setting.');
  const input = { operationId: randomId(), expectedVersion: view.version, expectedRevision: player.revision, target, muted, reason: reason.trim() };
  if (!validAdminDiscussionInput(input)) throw new Error('Choose a participant and a reason of 1–300 characters on one line.');
  return input;
}
export function readAdminDiscussionRequest(storage: Storage, account: string, code: string): AdminDiscussionInput | null {
  const raw = storage.getItem(key(account, code)); if (raw === null) return null;
  let value: unknown; try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminDiscussionInput(value)) throw new Error('This tab’s saved discussion request is unreadable. Inspect the room before discarding its local retry record.');
  return value;
}
export function saveAdminDiscussionRequest(storage: Storage, account: string, code: string, input: AdminDiscussionInput) {
  if (!validAdminDiscussionInput(input)) throw new Error('Invalid participant discussion request.');
  const previous = readAdminDiscussionRequest(storage, account, code), encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved discussion request before sending a different change.');
  storage.setItem(key(account, code), encoded);
  if (storage.getItem(key(account, code)) !== encoded) throw new Error('The discussion request could not be preserved in this tab. Nothing was sent.');
}
export function clearAdminDiscussionRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved discussion request could not be cleared.');
}
