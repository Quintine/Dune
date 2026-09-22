export type AdminClosureInput = {
  operationId: string;
  expectedVersion: number;
  expectedRevision: number;
  closed: boolean;
  reason: string;
};

export type AdminClosureView = {
  removed: boolean;
  code: string;
  version: number;
  closed: boolean;
  revision: number;
  closedAt: number | null;
  updatedAt: number | null;
  paused: boolean;
  joinLocked: boolean;
};

export type AdminClosureResult = {
  operationId: string;
  replayed: boolean;
  appliedRevision: number;
  appliedVersion: number;
  room: AdminClosureView;
};

export function validAdminClosureInput(
  value: unknown,
): value is AdminClosureInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const fields = [
    'operationId',
    'expectedVersion',
    'expectedRevision',
    'closed',
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
    typeof input.closed === 'boolean' &&
    typeof input.reason === 'string' &&
    !!input.reason.trim() &&
    input.reason.length <= 300 &&
    !input.reason
      .split('')
      .some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  );
}
