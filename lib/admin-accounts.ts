import type { AdminRole } from '../db/admin-access';

export type AdminAccountRow = {
  id: string; name: string; role: AdminRole; enabled: boolean; createdAt: number; updatedAt: number;
};
export type AdminAccountsDirectory = { accounts: AdminAccountRow[]; total: number; page: number; pageSize: 25 };
export type AdminAccountInput =
  | { action: 'provision'; operationId: string; id: string; key: string; name: string; role: AdminRole; reason: string }
  | { action: 'role'; operationId: string; target: string; expectedUpdatedAt: number; role: AdminRole; reason: string }
  | { action: 'disable'; operationId: string; target: string; expectedUpdatedAt: number; reason: string };
export type AdminAccountResult = { operationId: string; replayed: boolean; account: AdminAccountRow };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const control = (value: string) => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
};
const exact = (value: Record<string, unknown>, fields: string[]) =>
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const role = (value: unknown): value is AdminRole => value === 'owner' || value === 'operator' || value === 'viewer';
const reason = (value: unknown) => typeof value === 'string' && value.trim().length >= 1 && value.length <= 300 && !control(value) && !/dune-admin\.|[0-9a-f]{64}/i.test(value);
const timestamp = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 8640000000000000;

export function validAdminAccountInput(value: unknown): value is AdminAccountInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.operationId !== 'string' || !uuid.test(input.operationId) || !reason(input.reason)) return false;
  if (input.action === 'provision')
    return exact(input, ['action','operationId','id','key','name','role','reason']) &&
      typeof input.id === 'string' && uuid.test(input.id) &&
      typeof input.key === 'string' && input.key === `dune-admin.${input.id}.${input.key.slice(-64)}` &&
      /^dune-admin\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/.test(input.key) &&
      typeof input.name === 'string' && input.name.trim().length >= 1 && input.name.length <= 80 && !control(input.name) && role(input.role);
  if (input.action === 'role')
    return exact(input, ['action','operationId','target','expectedUpdatedAt','role','reason']) &&
      typeof input.target === 'string' && uuid.test(input.target) && timestamp(input.expectedUpdatedAt) && role(input.role);
  if (input.action === 'disable')
    return exact(input, ['action','operationId','target','expectedUpdatedAt','reason']) &&
      typeof input.target === 'string' && uuid.test(input.target) && timestamp(input.expectedUpdatedAt);
  return false;
}
