export type SeatRecoveryKit = Readonly<{
  format: 'dune-seat-recovery';
  version: 1;
  roomCode: string;
  playerId: string;
  recoverySecret: string;
}>;
export type SeatRecoveryAttempt = Readonly<{
  type: 'recoverSeat';
  playerId: string;
  recoverySecret: string;
  operationId: string;
  newSessionToken: string;
}>;
const ROOM = /^[A-Z2-9]{8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = /^[0-9a-f]{64}$/;

/** Secrets remain in caller memory. This module has no storage or network access. */
function secret256(): string {
  return Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function createRecoveryKit(
  roomCode: string,
  playerId: string,
): SeatRecoveryKit {
  if (!ROOM.test(roomCode) || !UUID.test(playerId))
    throw new Error(
      'The current room or seat identifier is invalid. Refresh the table before creating a recovery kit.',
    );
  return Object.freeze({
    format: 'dune-seat-recovery',
    version: 1,
    roomCode,
    playerId,
    recoverySecret: secret256(),
  });
}

export function serializeRecoveryKit(kit: SeatRecoveryKit): string {
  return JSON.stringify(kit, null, 2);
}

export function parseRecoveryKit(text: string): SeatRecoveryKit {
  if (text.length > 4096)
    throw new Error(
      'This recovery kit is too large. Paste only the saved kit.',
    );
  let data: unknown;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error(
      'Paste the complete saved recovery kit, including its opening and closing braces.',
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('This is not a Dune seat recovery kit.');
  const candidate = data as Record<string, unknown>;
  if (candidate.format !== 'dune-seat-recovery' || candidate.version !== 1)
    throw new Error('This recovery kit format is not supported.');
  if (
    Object.keys(candidate).some(
      (key) =>
        ![
          'format',
          'version',
          'roomCode',
          'playerId',
          'recoverySecret',
        ].includes(key),
    )
  )
    throw new Error(
      'The recovery kit contains unexpected fields. Paste only the original saved kit.',
    );
  if (
    typeof candidate.roomCode !== 'string' ||
    !ROOM.test(candidate.roomCode) ||
    typeof candidate.playerId !== 'string' ||
    !UUID.test(candidate.playerId) ||
    typeof candidate.recoverySecret !== 'string' ||
    !SECRET.test(candidate.recoverySecret)
  )
    throw new Error(
      'The recovery kit has an invalid room, seat identifier or recovery key.',
    );
  return Object.freeze({
    format: 'dune-seat-recovery',
    version: 1,
    roomCode: candidate.roomCode,
    playerId: candidate.playerId,
    recoverySecret: candidate.recoverySecret,
  });
}

/** Generate once per explicit attempt. Reuse this exact object for every retry. */
export function createRecoveryAttempt(
  kit: SeatRecoveryKit,
): SeatRecoveryAttempt {
  return Object.freeze({
    type: 'recoverSeat',
    playerId: kit.playerId,
    recoverySecret: kit.recoverySecret,
    operationId: globalThis.crypto.randomUUID(),
    newSessionToken: secret256(),
  });
}
