export type AdminArchiveInput = {
  operationId: string;
  expectedVersion: number;
  expectedRevision: number;
  archived: boolean;
  reason: string;
};

export type AdminArchiveView = {
  closed: boolean;
  removed: boolean;
  code: string;
  version: number;
  archived: boolean;
  revision: number;
  archivedAt: number | null;
  updatedAt: number | null;
  paused: boolean;
  joinLocked: boolean;
};

export type AdminArchiveResult = {
  operationId: string;
  replayed: boolean;
  appliedRevision: number;
  appliedVersion: number;
  room: AdminArchiveView;
};

export function validAdminArchiveInput(
  value: unknown,
): value is AdminArchiveInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const fields = [
    'operationId',
    'expectedVersion',
    'expectedRevision',
    'archived',
    'reason',
  ];
  return (
    Object.keys(input).length === fields.length &&
    fields.every((field) => Object.hasOwn(input, field)) &&
    typeof input.operationId === 'string' &&
    input.operationId.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.operationId,
    ) &&
    [input.expectedVersion, input.expectedRevision].every(
      (version) =>
        Number.isSafeInteger(version) &&
        Number(version) >= 0 &&
        Number(version) < Number.MAX_SAFE_INTEGER,
    ) &&
    typeof input.archived === 'boolean' &&
    typeof input.reason === 'string' &&
    !!input.reason.trim() &&
    input.reason.length <= 300 &&
    !input.reason
      .split('')
      .some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  );
}
