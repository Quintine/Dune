import { randomId } from './random-id';
import { validAdminLobbyInput, type AdminLobbyAction, type AdminLobbyInput, type AdminLobbyView, type AdminLobbyResult } from './admin-lobby-configuration';
import { DIFFICULTIES } from '../game/bot-profiles';
import { FACTIONS } from '../game/catalog';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (account: string, code: string) => `dune.admin-lobby-request.v1:${account}:${code}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export function validAdminLobbyView(value: unknown): value is AdminLobbyView {
  if (!object(value) || !keys(value, ['code', 'version', 'status', 'editable', 'blockedReason', 'host', 'advanced', 'techTokens', 'strongholdCards', 'players', 'control']) ||
      typeof value.code !== 'string' || value.code.length !== 8 || !/^[A-Z2-9]{8}$/.test(value.code) || !integer(value.version) ||
      !['lobby', 'setup', 'playing', 'finished', 'unreadable'].includes(String(value.status)) || typeof value.editable !== 'boolean' ||
      !(value.blockedReason === null || typeof value.blockedReason === 'string') || !(value.host === null || typeof value.host === 'string') ||
      typeof value.advanced !== 'boolean' || typeof value.techTokens !== 'boolean' || typeof value.strongholdCards !== 'boolean' ||
      !Array.isArray(value.players) || value.players.length > 6 || !object(value.control)) return false;
  const control = value.control;
  return keys(control, ['paused', 'joinLocked', 'revision', 'updatedAt', ...(control.closed === true ? ['closed'] : [])]) && typeof control.paused === 'boolean' && typeof control.joinLocked === 'boolean' &&
    integer(control.revision) && (control.updatedAt === null || integer(control.updatedAt)) && value.players.every(player =>
      object(player) && keys(player, ['id', 'name', 'faction', 'bot', 'position', 'ready', 'hostEligible']) &&
      typeof player.id === 'string' && typeof player.name === 'string' && FACTIONS.some(faction => faction.id === player.faction) &&
      (player.bot === null || DIFFICULTIES.some(difficulty => difficulty === player.bot)) && integer(player.position) && player.position >= 1 && player.position <= 6 &&
      typeof player.ready === 'boolean' && typeof player.hostEligible === 'boolean');
}

export function adminLobbyResponse(value: unknown, code: string): AdminLobbyView {
  if (!validAdminLobbyView(value) || value.code !== code) throw new Error('The server returned unreadable lobby settings.');
  return value;
}

export function adminLobbyConfirmation(value: unknown, code: string, input: AdminLobbyInput): AdminLobbyResult {
  if (!object(value) || !keys(value, ['operationId', 'replayed', 'appliedVersion', 'lobby']) || value.operationId !== input.operationId ||
      typeof value.replayed !== 'boolean' || !integer(value.appliedVersion) || value.appliedVersion !== input.expectedVersion + 1)
    throw new Error('The server did not confirm this lobby request.');
  const lobby = adminLobbyResponse(value.lobby, code);
  if (lobby.version < value.appliedVersion) throw new Error('The server returned a lobby older than the confirmed change.');
  return value as AdminLobbyResult;
}

export function newAdminLobbyRequest(view: AdminLobbyView, action: AdminLobbyAction, reason: string): AdminLobbyInput {
  const input = { operationId: randomId(), expectedVersion: view.version, action, reason: reason.trim() };
  if (!validAdminLobbyInput(input)) throw new Error('Choose a valid lobby change and a reason of 1–300 characters.');
  return input;
}

export function readAdminLobbyRequest(storage: Storage, account: string, code: string): AdminLobbyInput | null {
  const raw = storage.getItem(key(account, code));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (!validAdminLobbyInput(value)) throw new Error('This tab’s saved lobby request is unreadable. Check the current lobby before discarding its local retry record.');
  return value;
}

export function saveAdminLobbyRequest(storage: Storage, account: string, code: string, input: AdminLobbyInput) {
  if (!validAdminLobbyInput(input)) throw new Error('Invalid lobby request.');
  const previous = readAdminLobbyRequest(storage, account, code), text = JSON.stringify(input);
  if (previous && JSON.stringify(previous) !== text) throw new Error('Resolve the saved lobby request before sending a different change.');
  storage.setItem(key(account, code), text);
  if (storage.getItem(key(account, code)) !== text) throw new Error('The lobby request could not be preserved in this tab. Nothing was sent.');
}

export function clearAdminLobbyRequest(storage: Storage, account: string, code: string) {
  storage.removeItem(key(account, code));
  if (storage.getItem(key(account, code)) !== null) throw new Error('The saved lobby request could not be cleared.');
}

export function describeAdminLobbyAction(action: AdminLobbyAction, view: AdminLobbyView): string {
  const player = 'target' in action ? view.players.find(player => player.id === action.target)?.name ?? 'the selected player' : '';
  const faction = 'faction' in action ? FACTIONS.find(item => item.id === action.faction)?.name ?? action.faction : '';
  switch (action.type) {
    case 'rules': return `Select ${action.advanced ? 'Advanced preview' : 'Basic'} rules`;
    case 'techTokens': return `${action.enabled ? 'Enable' : 'Disable'} Tech Tokens`;
    case 'strongholdCards': return `${action.enabled ? 'Enable' : 'Disable'} Stronghold Cards`;
    case 'addBot': return `Add ${faction} AI at ${action.difficulty}`;
    case 'removeBot': return `Remove AI player ${player}`;
    case 'configureBot': return `Configure ${player}: ${faction}, ${action.difficulty}, circle ${action.position}`;
    case 'assignHost': return `Assign ${player} as host`;
  }
}
