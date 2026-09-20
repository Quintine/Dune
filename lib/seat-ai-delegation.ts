import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

/** This is consent metadata, never a seat credential or another player's view. */
export type SeatAiDelegationView = Readonly<{
  grantId: string;
  ownerId: string;
  delegateId: string;
  difficulty: Difficulty;
  expiresAt: number;
  usedAt: number | null;
}>;
export type SetSeatAiDelegateInput = Readonly<{
  grantId: string;
  delegateId: string;
  difficulty: Difficulty;
}>;
export type UseSeatAiDelegateInput = Readonly<{
  ownerId: string;
  grantId: string;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const validSeatAiGrantId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);
const hasOnly = (
  value: unknown,
  keys: string[],
): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
export function validSetSeatAiDelegateInput(
  value: unknown,
): value is SetSeatAiDelegateInput {
  return (
    hasOnly(value, ['grantId', 'delegateId', 'difficulty']) &&
    validSeatAiGrantId(value.grantId) &&
    validSeatAiGrantId(value.delegateId) &&
    DIFFICULTIES.some((difficulty) => difficulty === value.difficulty)
  );
}
export function validUseSeatAiDelegateInput(
  value: unknown,
): value is UseSeatAiDelegateInput {
  return (
    hasOnly(value, ['ownerId', 'grantId']) &&
    validSeatAiGrantId(value.ownerId) &&
    validSeatAiGrantId(value.grantId)
  );
}

export type SeatAiDelegateRequest =
  | ({ type: 'setSeatAiDelegate'; version: number } & SetSeatAiDelegateInput)
  | { type: 'revokeSeatAiDelegate'; version: number; grantId: string }
  | ({ type: 'useSeatAiDelegate'; version: number } & UseSeatAiDelegateInput);

export function validSeatAiDelegateRequest(
  value: unknown,
): value is SeatAiDelegateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { type, version, ...input } = value as Record<string, unknown>;
  if (!Number.isSafeInteger(version) || (version as number) < 0) return false;
  if (type === 'setSeatAiDelegate') return validSetSeatAiDelegateInput(input);
  if (type === 'useSeatAiDelegate') return validUseSeatAiDelegateInput(input);
  return (
    type === 'revokeSeatAiDelegate' &&
    hasOnly(input, ['grantId']) &&
    validSeatAiGrantId(input.grantId)
  );
}

export const seatAiDelegateStorageKey = (room: string, seat: string) =>
  `dune.pending-ai-permission.v1.${room}.${seat}`;
export function parseSeatAiDelegateRequest(
  text: string,
): SeatAiDelegateRequest {
  if (text.length > 2000)
    throw new Error('The saved AI permission request is invalid.');
  const value: unknown = JSON.parse(text);
  if (!validSeatAiDelegateRequest(value))
    throw new Error('The saved AI permission request is invalid.');
  return Object.freeze(value);
}
export function storeSeatAiDelegateRequest(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  key: string,
  request: SeatAiDelegateRequest | null,
) {
  const text = request ? JSON.stringify(request) : null;
  const existing = storage.getItem(key);
  if (request && existing !== null && existing !== text)
    throw new Error(
      'Resolve the saved AI permission request before starting another.',
    );
  if (text === null) storage.removeItem(key);
  else storage.setItem(key, text);
  if (storage.getItem(key) !== text)
    throw new Error(
      'The AI permission request could not be saved in this tab.',
    );
}
