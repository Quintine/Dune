import { validAdminAccountInput, type AdminAccountInput, type AdminAccountResult, type AdminAccountRow } from './admin-accounts';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type AdminAccountRecord =
  | { kind: 'pending'; input: AdminAccountInput }
  | { kind: 'completed'; input: Extract<AdminAccountInput, { action: 'provision' }>; account: AdminAccountRow };

const storageKey = (owner: string) => `dune.admin-accounts.v1:${owner}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hasControl = (value: string) => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
};

export function validAdminAccountRow(value: unknown): value is AdminAccountRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 6 && typeof row.id === 'string' && uuid.test(row.id) &&
    typeof row.name === 'string' && row.name.length >= 1 && row.name.length <= 80 &&
    !hasControl(row.name) &&
    (row.role === 'owner' || row.role === 'operator' || row.role === 'viewer') && typeof row.enabled === 'boolean' &&
    typeof row.createdAt === 'number' && Number.isSafeInteger(row.createdAt) && row.createdAt >= 0 &&
    typeof row.updatedAt === 'number' && Number.isSafeInteger(row.updatedAt) && row.updatedAt >= 0;
}

export function validAdminAccountResult(value: unknown, input: AdminAccountInput): value is AdminAccountResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== 3 || result.operationId !== input.operationId ||
    typeof result.replayed !== 'boolean' || !validAdminAccountRow(result.account)) return false;
  const account = result.account;
  if (account.id !== (input.action === 'provision' ? input.id : input.target)) return false;
  if (input.action === 'provision')
    return account.enabled && account.name === input.name && account.role === input.role;
  return account.updatedAt > input.expectedUpdatedAt &&
    (input.action === 'role' ? account.enabled && account.role === input.role : !account.enabled);
}

export function newAdminAccountRequest(fields:
  | { action: 'provision'; name: string; role: AdminAccountRow['role']; reason: string }
  | { action: 'role'; target: string; expectedUpdatedAt: number; role: AdminAccountRow['role']; reason: string }
  | { action: 'disable'; target: string; expectedUpdatedAt: number; reason: string },
): AdminAccountInput {
  const operationId = crypto.randomUUID();
  const input = fields.action === 'provision' ? (() => {
    const id = crypto.randomUUID();
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    return { action: 'provision' as const, operationId, id, key: `dune-admin.${id}.${secret}`, name: fields.name.trim(), role: fields.role, reason: fields.reason.trim() };
  })() : { ...fields, operationId, reason: fields.reason.trim() };
  if (!validAdminAccountInput(input)) throw new Error('Check the account, role and operational reason. Do not include credentials in the reason.');
  return input;
}

export function readAdminAccountRecord(storage: Storage, owner: string): AdminAccountRecord | null {
  const raw = storage.getItem(storageKey(owner));
  if (raw === null) return null;
  let value: unknown;
  try { value = raw.length <= 2048 ? JSON.parse(raw) : null; } catch { value = null; }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 2 && record.kind === 'pending' && validAdminAccountInput(record.input)) return value as AdminAccountRecord;
    if (Object.keys(record).length === 3 && record.kind === 'completed' && validAdminAccountInput(record.input) &&
      record.input.action === 'provision' && validAdminAccountRow(record.account)) {
      const input = record.input, account = record.account;
      if (account.id === input.id && account.name === input.name &&
        account.role === input.role && account.enabled) return value as AdminAccountRecord;
    }
  }
  throw new Error('This tab’s saved account request is unreadable. Do not send a new request or discard this record until you have checked the account directory.');
}

function persist(storage: Storage, owner: string, record: AdminAccountRecord) {
  const encoded = JSON.stringify(record);
  storage.setItem(storageKey(owner), encoded);
  if (storage.getItem(storageKey(owner)) !== encoded) throw new Error('Could not preserve the account request in this tab. Nothing was sent.');
}

export function saveAdminAccountRequest(storage: Storage, owner: string, input: AdminAccountInput) {
  if (!validAdminAccountInput(input)) throw new Error('Invalid account request. Nothing was sent.');
  const previous = readAdminAccountRecord(storage, owner);
  if (previous && (previous.kind !== 'pending' || JSON.stringify(previous.input) !== JSON.stringify(input)))
    throw new Error('Resolve the saved account request before sending another.');
  persist(storage, owner, { kind: 'pending', input });
}

export function completeAdminAccountRequest(storage: Storage, owner: string, input: AdminAccountInput, result: AdminAccountResult) {
  if (!validAdminAccountResult(result, input)) throw new Error('The server did not confirm this exact account request. Keep the saved retry.');
  const previous = readAdminAccountRecord(storage, owner);
  if (!previous || previous.kind !== 'pending' || JSON.stringify(previous.input) !== JSON.stringify(input))
    throw new Error('The saved account request changed. Keep it and inspect the directory.');
  if (input.action === 'provision') persist(storage, owner, { kind: 'completed', input, account: result.account });
  else clearAdminAccountRecord(storage, owner);
}

export function clearAdminAccountRecord(storage: Storage, owner: string) {
  storage.removeItem(storageKey(owner));
  if (storage.getItem(storageKey(owner)) !== null) throw new Error('Could not clear the saved account request in this tab.');
}
