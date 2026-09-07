import { EXPANSIONS, FACTIONS } from '../game/catalog';
import { requestMayHaveCompleted } from './client-request';

/** Tab-scoped proof for one explicit create/join. Never place this record in a URL or log. */
export const ROOM_ENTRY_STORAGE_KEY = 'dune.pending-room-entry.v1';
export type RoomEntryAttempt = Readonly<{
  schemaVersion: 1;
  createdAt: number;
  kind: 'create' | 'join';
  roomCode: string | null;
  bodyText: string;
}>;
type EntryFields = {
  name: string;
  faction: string;
  expansions: string[];
  advanced: boolean;
};
const ROOM = /^[A-Z2-9]{8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const invalid = () =>
  new Error(
    'The saved room request is invalid or uses an unsupported format. It has been kept in this tab; do not retry it with changed details.',
  );
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

export function parseRoomEntry(text: string): RoomEntryAttempt {
  if (text.length > 8192) throw invalid();
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    throw invalid();
  }
  if (
    !object(record) ||
    !keys(record, [
      'schemaVersion',
      'createdAt',
      'kind',
      'roomCode',
      'bodyText',
    ]) ||
    record.schemaVersion !== 1 ||
    typeof record.createdAt !== 'number' ||
    !Number.isSafeInteger(record.createdAt) ||
    record.createdAt < 0 ||
    (record.kind !== 'create' && record.kind !== 'join') ||
    (record.kind === 'create'
      ? record.roomCode !== null
      : typeof record.roomCode !== 'string' || !ROOM.test(record.roomCode)) ||
    typeof record.bodyText !== 'string'
  )
    throw invalid();
  let body: unknown;
  try {
    body = JSON.parse(record.bodyText);
  } catch {
    throw invalid();
  }
  if (
    !object(body) ||
    JSON.stringify(body) !== record.bodyText ||
    !keys(
      body,
      record.kind === 'join'
        ? ['type', 'name', 'faction', 'entry']
        : ['name', 'faction', 'expansions', 'advanced', 'entry'],
    ) ||
    typeof body.name !== 'string' ||
    body.name.length > 256 ||
    !body.name.trim() ||
    body.name.trim().length > 32 ||
    !FACTIONS.some((faction) => faction.id === body.faction) ||
    !object(body.entry) ||
    !keys(body.entry, ['operationId', 'sessionToken']) ||
    typeof body.entry.operationId !== 'string' ||
    !UUID.test(body.entry.operationId) ||
    typeof body.entry.sessionToken !== 'string' ||
    !TOKEN.test(body.entry.sessionToken)
  )
    throw invalid();
  if (record.kind === 'join') {
    if (body.type !== 'join') throw invalid();
  } else if (
    typeof body.advanced !== 'boolean' ||
    !Array.isArray(body.expansions) ||
    body.expansions.length > 3 ||
    !body.expansions.every((id) =>
      EXPANSIONS.some((expansion) => expansion.id === id),
    )
  )
    throw invalid();
  return Object.freeze(record as RoomEntryAttempt);
}

export function createRoomEntry(
  fields: EntryFields,
  roomCode?: string,
): RoomEntryAttempt {
  const entry = {
    operationId: globalThis.crypto.randomUUID(),
    sessionToken: Array.from(
      globalThis.crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join(''),
  };
  const body =
    roomCode === undefined
      ? { ...fields, entry }
      : { type: 'join', name: fields.name, faction: fields.faction, entry };
  return parseRoomEntry(
    JSON.stringify({
      schemaVersion: 1,
      createdAt: Date.now(),
      kind: roomCode === undefined ? 'create' : 'join',
      roomCode: roomCode ?? null,
      bodyText: JSON.stringify(body),
    }),
  );
}

export function roomEntryUrl(attempt: RoomEntryAttempt): string {
  return attempt.kind === 'create'
    ? '/api/rooms'
    : `/api/rooms/${attempt.roomCode}`;
}

/** A cookie-only GET is not evidence that this operation created the returned seat. */
export function roomEntryConfirmed(
  attempt: RoomEntryAttempt,
  response: unknown,
  firstDispatch = false,
): boolean {
  if (
    !object(response) ||
    typeof response.code !== 'string' ||
    !ROOM.test(response.code) ||
    typeof response.me !== 'string' ||
    !UUID.test(response.me) ||
    !Array.isArray(response.players) ||
    !response.players.some(
      (player) => object(player) && player.id === response.me,
    ) ||
    typeof response.version !== 'number' ||
    !Number.isSafeInteger(response.version) ||
    response.version < 0 ||
    (attempt.kind === 'join' && response.code !== attempt.roomCode)
  )
    return false;
  const { entry } = JSON.parse(attempt.bodyText);
  if (Object.hasOwn(response, 'entryReceipt'))
    return (
      object(response.entryReceipt) &&
      response.entryReceipt.operationId === entry.operationId &&
      typeof response.entryReceipt.replayed === 'boolean'
    );
  return (
    firstDispatch && attempt.kind === 'join' && response.alreadySeated === true
  );
}

export function saveRoomEntry(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  attempt: RoomEntryAttempt,
): void {
  const text = JSON.stringify(attempt);
  const existing = storage.getItem(ROOM_ENTRY_STORAGE_KEY);
  if (existing !== null && existing !== text)
    throw new Error(
      'Another saved room request is still present. Resolve it before starting a different request.',
    );
  storage.setItem(ROOM_ENTRY_STORAGE_KEY, text);
  if (storage.getItem(ROOM_ENTRY_STORAGE_KEY) !== text)
    throw new Error(
      'The room request could not be saved in this tab. No request was sent.',
    );
}
export function clearRoomEntry(
  storage: Pick<Storage, 'removeItem' | 'getItem'>,
): void {
  storage.removeItem(ROOM_ENTRY_STORAGE_KEY);
  if (storage.getItem(ROOM_ENTRY_STORAGE_KEY) !== null)
    throw new Error(
      'The saved room request could not be removed. Its private retry proof is still stored in this tab.',
    );
}

/** Only the first POST's definite rejection permits editing without abandoning uncertain work. */
export function roomEntryRejectedBeforeCommit(
  firstDispatch: boolean,
  error: unknown,
): boolean {
  return firstDispatch && !requestMayHaveCompleted(error);
}
