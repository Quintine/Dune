import type { GameView } from '../game/engine';

export const HANDOVER_CLAIM_STORAGE_KEY = 'dune.pending-seat-handover.v1';
export const handoverOwnerStorageKey = (room: string, player: string) =>
  `dune.handover-offer.v1.${room}.${player}`;
/** Confirmed owner recovery revokes the issuer; its old kit must not remain advertised. */
export function clearHandoverOwner(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  room: string,
  player: string,
) {
  const key = handoverOwnerStorageKey(room, player);
  storage.removeItem(key);
  if (storage.getItem(key) !== null)
    throw new Error(
      'The invalidated handover kit could not be removed from this tab. Retry recovery to confirm cleanup.',
    );
}
const ROOM = /^[A-Z2-9]{8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = /^[0-9a-f]{64}$/;
const invalid = () =>
  new Error(
    'Paste the complete original Dune handover kit. Its format or identifiers are invalid.',
  );
const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]) =>
  Object.keys(value).length === names.length &&
  names.every((name) => Object.hasOwn(value, name));

export type SeatHandoverKit = Readonly<{
  format: 'dune-seat-handover';
  version: 1;
  roomCode: string;
  playerId: string;
  offerId: string;
  handoverSecret: string;
}>;
export type SeatHandoverAttempt = Readonly<{
  type: 'claimSeatHandover';
  playerId: string;
  offerId: string;
  handoverSecret: string;
  operationId: string;
  newSessionToken: string;
}>;
export type SavedHandoverClaim = Readonly<{
  kit: SeatHandoverKit;
  attempt: SeatHandoverAttempt;
}>;

export function parseHandoverKit(text: string): SeatHandoverKit {
  if (text.length > 4096) throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalid();
  }
  if (
    !object(value) ||
    !keys(value, [
      'format',
      'version',
      'roomCode',
      'playerId',
      'offerId',
      'handoverSecret',
    ]) ||
    value.format !== 'dune-seat-handover' ||
    value.version !== 1 ||
    typeof value.roomCode !== 'string' ||
    !ROOM.test(value.roomCode) ||
    typeof value.playerId !== 'string' ||
    !UUID.test(value.playerId) ||
    typeof value.offerId !== 'string' ||
    !UUID.test(value.offerId) ||
    typeof value.handoverSecret !== 'string' ||
    !SECRET.test(value.handoverSecret)
  )
    throw invalid();
  return Object.freeze(value as SeatHandoverKit);
}
export const serializeHandoverKit = (kit: SeatHandoverKit) =>
  JSON.stringify(kit, null, 2);
export function createHandoverKit(
  roomCode: string,
  playerId: string,
): SeatHandoverKit {
  return parseHandoverKit(
    JSON.stringify({
      format: 'dune-seat-handover',
      version: 1,
      roomCode,
      playerId,
      offerId: crypto.randomUUID(),
      handoverSecret: secret(),
    }),
  );
}
export function createHandoverClaim(kit: SeatHandoverKit): SavedHandoverClaim {
  return Object.freeze({
    kit,
    attempt: Object.freeze({
      type: 'claimSeatHandover',
      playerId: kit.playerId,
      offerId: kit.offerId,
      handoverSecret: kit.handoverSecret,
      operationId: crypto.randomUUID(),
      newSessionToken: secret(),
    }),
  });
}
export function parseHandoverClaim(text: string): SavedHandoverClaim {
  if (text.length > 4096) throw invalid();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalid();
  }
  if (!object(value) || !keys(value, ['kit', 'attempt'])) throw invalid();
  const kit = parseHandoverKit(JSON.stringify(value.kit));
  const a = value.attempt;
  if (
    !object(a) ||
    !keys(a, [
      'type',
      'playerId',
      'offerId',
      'handoverSecret',
      'operationId',
      'newSessionToken',
    ]) ||
    a.type !== 'claimSeatHandover' ||
    a.playerId !== kit.playerId ||
    a.offerId !== kit.offerId ||
    a.handoverSecret !== kit.handoverSecret ||
    typeof a.operationId !== 'string' ||
    !UUID.test(a.operationId) ||
    typeof a.newSessionToken !== 'string' ||
    !SECRET.test(a.newSessionToken) ||
    a.newSessionToken === kit.handoverSecret
  )
    throw invalid();
  return Object.freeze({
    kit,
    attempt: Object.freeze(a as SeatHandoverAttempt),
  });
}
export function saveHandoverClaim(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  claim: SavedHandoverClaim,
) {
  const text = JSON.stringify(claim),
    existing = storage.getItem(HANDOVER_CLAIM_STORAGE_KEY);
  if (existing !== null && existing !== text)
    throw new Error(
      'Resolve the saved handover request before starting another.',
    );
  storage.setItem(HANDOVER_CLAIM_STORAGE_KEY, text);
  if (storage.getItem(HANDOVER_CLAIM_STORAGE_KEY) !== text)
    throw new Error(
      'The retry details could not be saved. No handover request was sent.',
    );
}
export function clearHandoverClaim(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
) {
  storage.removeItem(HANDOVER_CLAIM_STORAGE_KEY);
  if (storage.getItem(HANDOVER_CLAIM_STORAGE_KEY) !== null)
    throw new Error(
      'The saved handover details could not be removed. Keep this tab open.',
    );
}
/** Confirm both the claim receipt and the cookie-authorized follow-up read. */
export function handoverClaimConfirmed(
  claim: SavedHandoverClaim,
  response: unknown,
  read: unknown,
): read is GameView {
  const seat = (value: unknown) =>
    object(value) &&
    value.code === claim.kit.roomCode &&
    value.me === claim.kit.playerId &&
    Number.isSafeInteger(value.version) &&
    (value.version as number) >= 0 &&
    Array.isArray(value.players) &&
    value.players.some(
      (player) => object(player) && player.id === claim.kit.playerId,
    );
  return (
    object(response) &&
    response.transferred === true &&
    typeof response.replayed === 'boolean' &&
    seat(response.view) &&
    seat(read) &&
    (read as GameView).version >= (response.view as GameView).version
  );
}
