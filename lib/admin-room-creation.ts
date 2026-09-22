import { FACTIONS, type FactionId } from '../game/catalog';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

export type AdminRoomCreationInput = {
  operationId: string;
  sessionToken: string;
  name: string;
  faction: FactionId;
  advanced: boolean;
  techTokens: boolean;
  strongholdCards: boolean;
  bots: { faction: FactionId; difficulty: Difficulty }[];
  reason: string;
};

/** Only creation confirmation; it never contains a game or another seat's data. */
export type AdminRoomCreationResult = {
  operationId: string;
  code: string;
  hostId: string;
  replayed: boolean;
  hostAccess: boolean;
  roomRemoved?: true;
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const baseFaction = (value: unknown): value is FactionId =>
  FACTIONS.some(
    (faction) => faction.id === value && faction.expansion === 'base',
  );
const noControls = (value: string) =>
  value
    .split('')
    .every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);

/** Matches the admitted ordinary lobby profile; actual engine actions construct it. */
export function validAdminRoomCreationInput(
  value: unknown,
): value is AdminRoomCreationInput {
  if (
    !object(value) ||
    !exactKeys(value, [
      'operationId',
      'sessionToken',
      'name',
      'faction',
      'advanced',
      'techTokens',
      'strongholdCards',
      'bots',
      'reason',
    ]) ||
    typeof value.operationId !== 'string' ||
    value.operationId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value.operationId,
    ) ||
    typeof value.sessionToken !== 'string' ||
    value.sessionToken.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(value.sessionToken) ||
    typeof value.name !== 'string' ||
    value.name.length > 256 ||
    value.name.trim().length < 1 ||
    value.name.trim().length > 32 ||
    !noControls(value.name) ||
    !baseFaction(value.faction) ||
    typeof value.advanced !== 'boolean' ||
    typeof value.techTokens !== 'boolean' ||
    typeof value.strongholdCards !== 'boolean' ||
    (value.strongholdCards && !value.advanced) ||
    !Array.isArray(value.bots) ||
    value.bots.length > 5 ||
    typeof value.reason !== 'string' ||
    !value.reason.trim() ||
    value.reason.length > 300 ||
    !noControls(value.reason)
  )
    return false;
  const factions = new Set([value.faction]);
  for (const bot of value.bots) {
    if (
      !object(bot) ||
      !exactKeys(bot, ['faction', 'difficulty']) ||
      !baseFaction(bot.faction) ||
      !DIFFICULTIES.some((difficulty) => difficulty === bot.difficulty) ||
      factions.has(bot.faction)
    )
      return false;
    factions.add(bot.faction);
  }
  return true;
}
