import { FACTIONS } from '../game/catalog';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { randomId } from './random-id';
import { validAdminSeatAiInput, type AdminSeatAiInput, type AdminSeatAiView, type AdminSeatAiResult } from './admin-seat-ai';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-seat-ai-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export function validAdminSeatAiView(value: unknown): value is AdminSeatAiView {
  if (!object(value) || !keys(value, ['code','version','controlRevision','status','paused','closed','removed','archived','editable','blockedReason','players']) ||
      typeof value.code !== 'string' || !/^[A-Z2-9]{8}$/.test(value.code) || value.code.length !== 8 || !integer(value.version) || !integer(value.controlRevision) ||
      !['lobby','setup','playing','finished','unreadable'].includes(String(value.status)) ||
      !['paused','closed','removed','archived','editable'].every(key => typeof value[key] === 'boolean') ||
      !(value.blockedReason === null || typeof value.blockedReason === 'string') || !Array.isArray(value.players) || value.players.length > 6) return false;
  return value.players.every(player => object(player) && keys(player, ['id','name','faction','control','difficulty','eligible']) &&
    typeof player.id === 'string' && !!player.id && player.id.length <= 80 && typeof player.name === 'string' && player.name.length <= 80 &&
    FACTIONS.some(faction => faction.id === player.faction) && ['human','ai','autopilot'].includes(String(player.control)) &&
    (player.difficulty === null || DIFFICULTIES.some(difficulty => difficulty === player.difficulty)) && typeof player.eligible === 'boolean');
}

export function adminSeatAiResponse(value: unknown, code: string): AdminSeatAiView {
  if (!validAdminSeatAiView(value) || value.code !== code) throw new Error('The server returned unreadable room availability.');
  return value;
}

export function adminSeatAiConfirmation(value: unknown, code: string, input: AdminSeatAiInput): AdminSeatAiResult {
  if (!object(value) || !keys(value, ['operationId', 'replayed', 'appliedVersion', 'room']) ||
      value.operationId !== input.operationId || typeof value.replayed !== 'boolean' ||
      !integer(value.appliedVersion) || value.appliedVersion !== input.expectedVersion + 1)
    throw new Error('The server did not confirm this participant AI request.');
  const room = adminSeatAiResponse(value.room, code);
  if (room.version < value.appliedVersion)
    throw new Error('The server returned room availability older than the confirmed change.');
  return value as AdminSeatAiResult;
}

export function newAdminSeatAiRequest(view: AdminSeatAiView, target: string, difficulty: Difficulty, reason: string): AdminSeatAiInput {
  const input = { operationId: randomId(), expectedVersion: view.version, expectedControlRevision: view.controlRevision, target, difficulty, reason: reason.trim() };
  if (!validAdminSeatAiInput(input)) throw new Error('Choose a participant, difficulty and a reason of 1–300 characters on one line.');
  if (!view.editable) throw new Error(view.blockedReason ?? 'Refresh the room before changing participant control.');
  if (!view.players.some(player => player.id === target && player.eligible)) throw new Error('Choose an eligible human participant.');
  return input;
}

export function readAdminSeatAiRequest(storage: Storage, account: string, code: string): AdminSeatAiInput | null {
  const raw = storage.getItem(key(account, code));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminSeatAiInput(value)) throw new Error('This tab’s saved participant AI request is unreadable. Inspect the current room before discarding its local retry record.');
  return value;
}

/** Save before sending; a different unresolved request must never be replaced. */
export function saveAdminSeatAiRequest(storage: Storage, account: string, code: string, input: AdminSeatAiInput) {
  if (!validAdminSeatAiInput(input)) throw new Error('Invalid participant AI request.');
  const previous = readAdminSeatAiRequest(storage, account, code), encoded = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== encoded) throw new Error('Resolve the saved participant AI request before sending a different change.');
  storage.setItem(key(account, code), encoded);
  if (storage.getItem(key(account, code)) !== encoded) throw new Error('The participant AI request could not be preserved in this tab. Nothing was sent.');
}

export function clearAdminSeatAiRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved participant AI request could not be cleared.');
}
