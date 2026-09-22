/** Public room operations only. Reasons and administrator identities stay private. */
export type RoomControl = {
  paused: boolean;
  joinLocked: boolean;
  revision: number;
  updatedAt: number | null;
};

export const DEFAULT_ROOM_CONTROL: Readonly<RoomControl> = Object.freeze({
  paused: false,
  joinLocked: false,
  revision: 0,
  updatedAt: null,
});

export type AdminRoomControlInput = {
  operationId: string;
  expectedRevision: number;
  paused: boolean;
  joinLocked: boolean;
  reason: string;
};

export function validAdminRoomControlInput(
  value: unknown,
): value is AdminRoomControlInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    Object.keys(input).length === 5 &&
    Object.keys(input).every((key) =>
      [
        'operationId',
        'expectedRevision',
        'paused',
        'joinLocked',
        'reason',
      ].includes(key),
    ) &&
    typeof input.operationId === 'string' &&
    input.operationId.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      input.operationId,
    ) &&
    Number.isSafeInteger(input.expectedRevision) &&
    Number(input.expectedRevision) >= 0 &&
    Number(input.expectedRevision) < Number.MAX_SAFE_INTEGER &&
    typeof input.paused === 'boolean' &&
    typeof input.joinLocked === 'boolean' &&
    typeof input.reason === 'string' &&
    input.reason.trim().length > 0 &&
    input.reason.length <= 300 &&
    input.reason
      .split('')
      .every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
  );
}
