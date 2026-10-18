import { FACTIONS, type FactionId } from './catalog';

export type NexusGuildCunningContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId; ally?: string | null }[];
};
export type NexusGuildCunningBefore = {
  shipped: boolean;
  moved: number;
  hajrUsed: boolean;
  hajrPlays?: never;
};
export type NexusGuildCunningCountedBefore = {
  shipped: boolean;
  moved: number;
  hajrPlays: number;
  hajrUsed?: never;
};
type NexusGuildCunningReceiptFields = {
  event: string;
  owner: string;
  turn: number;
  phase: 5;
  mode: 'cunning';
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
export type NexusGuildCunningLegacyReceipt = NexusGuildCunningReceiptFields & {
  version: 1;
  before: NexusGuildCunningBefore;
};
export type NexusGuildCunningCountedReceipt = NexusGuildCunningReceiptFields & {
  version: 2;
  before: NexusGuildCunningCountedBefore;
};
export type NexusGuildCunningReceipt =
  | NexusGuildCunningLegacyReceipt
  | NexusGuildCunningCountedReceipt;
type Before = NexusGuildCunningBefore | NexusGuildCunningCountedBefore;

function requireGuild(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
function roster(context: NexusGuildCunningContext) {
  requireGuild(
    context &&
      Number.isSafeInteger(context.turn) &&
      context.turn > 0 &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      context.players.every(
        (p) =>
          p && identifier(p.id) && FACTIONS.some((f) => f.id === p.faction),
      ) &&
      new Set(context.players.map((p) => p.id)).size ===
        context.players.length &&
      new Set(context.players.map((p) => p.faction)).size ===
        context.players.length,
    'Guild Cunning requires its original faction roster and turn.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function validPlayCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 &&
    Number.isSafeInteger(value + 1);
}
function validateBefore(before: Before, version: 1 | 2) {
  requireGuild(
    plain(before) &&
      Object.keys(before).sort().join(',') ===
        (version === 1 ? 'hajrUsed,moved,shipped' : 'hajrPlays,moved,shipped') &&
      typeof before.shipped === 'boolean' &&
      (version === 1 ? typeof before.hajrUsed === 'boolean' : validPlayCount(before.hajrPlays)) &&
      Number.isSafeInteger(before.moved) &&
      before.moved >= 0 &&
      before.moved <= 1 + (version === 1 ? Number(before.hajrUsed) : before.hajrPlays!),
    'Guild Cunning needs the original ordinary shipment and Hajr movement allowance.',
  );
}
function signature(receipt: NexusGuildCunningReceipt) {
  return JSON.stringify([
    'nexusGuildCunningReceipt',
    receipt.version,
    receipt.event,
    receipt.owner,
    receipt.turn,
    receipt.phase,
    receipt.mode,
    receipt.roster.map((p) => [p.id, p.faction]),
    [receipt.before.shipped, receipt.before.moved,
      receipt.version === 1 ? receipt.before.hajrUsed : receipt.before.hajrPlays],
  ]);
}
/** Validates historical facts, not current cards, alliances, resources or movement.
 * The engine binds this receipt to its actual completed first combined turn. */
export function validateNexusGuildCunning(
  context: NexusGuildCunningContext,
  receipt: NexusGuildCunningReceipt,
): void {
  const seats = roster(context);
  requireGuild(
    plain(receipt) &&
      Object.keys(receipt).sort().join(',') ===
        'before,event,mode,owner,phase,roster,signature,turn,version' &&
      (receipt.version === 1 || receipt.version === 2) &&
      receipt.phase === 5 &&
      receipt.mode === 'cunning' &&
      Number.isSafeInteger(receipt.turn) &&
      receipt.turn > 0 &&
      receipt.turn <= context.turn &&
      identifier(receipt.owner) &&
      seats.some((p) => p.id === receipt.owner && p.faction === 'guild') &&
      receipt.event ===
        JSON.stringify(['nexusGuildCunning', receipt.turn, receipt.owner]) &&
      Array.isArray(receipt.roster) &&
      receipt.roster.every(
        (p) => plain(p) && Object.keys(p).sort().join(',') === 'faction,id',
      ) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats),
    'Guild Cunning has changed its original owner, turn or faction roster.',
  );
  validateBefore(receipt.before, receipt.version);
  requireGuild(
    receipt.signature === signature(receipt),
    'Guild Cunning has changed its original combined turn.',
  );
}
export function createNexusGuildCunning(
  context: NexusGuildCunningContext & { phase: number; active: string | null },
  owner: string,
  before: NexusGuildCunningBefore,
): NexusGuildCunningLegacyReceipt;
export function createNexusGuildCunning(
  context: NexusGuildCunningContext & { phase: number; active: string | null },
  owner: string,
  before: NexusGuildCunningCountedBefore,
): NexusGuildCunningCountedReceipt;
export function createNexusGuildCunning(
  context: NexusGuildCunningContext & { phase: number; active: string | null },
  owner: string,
  before: Before,
): NexusGuildCunningReceipt;
export function createNexusGuildCunning(
  context: NexusGuildCunningContext & { phase: number; active: string | null },
  owner: string,
  before: Before,
): NexusGuildCunningReceipt {
  const seats = roster(context);
  requireGuild(
    context.phase === 5 &&
      context.active === owner &&
      context.players.some(
        (p) => p.id === owner && p.faction === 'guild' && !p.ally,
      ),
    'Guild Cunning requires the unallied native Guild at the end of its own combined turn.',
  );
  const version = plain(before) && Object.hasOwn(before, 'hajrPlays') ? 2 : 1;
  validateBefore(before, version);
  const fields: Omit<NexusGuildCunningReceiptFields, 'signature'> = {
    event: JSON.stringify(['nexusGuildCunning', context.turn, owner]),
    owner,
    turn: context.turn,
    phase: 5,
    mode: 'cunning',
    roster: seats,
  };
  const receipt: NexusGuildCunningReceipt = version === 1
    ? { version: 1, ...fields, before: { ...before as NexusGuildCunningBefore }, signature: '' }
    : { version: 2, ...fields, before: { ...before as NexusGuildCunningCountedBefore }, signature: '' };
  receipt.signature = signature(receipt);
  validateNexusGuildCunning(context, receipt);
  return receipt;
}
/** Ending ordinary movement forgoes at least its first slot. Every actual Hajr
 * play supplies one extra slot; the engine owns card custody and play timing.
 * Legacy boolean callers/receipts retain their original zero-or-one meaning. */
export function nexusGuildCunningMoves(
  receipt: NexusGuildCunningReceipt,
  currentHajrUsed: boolean | number,
  movesAfterSecond = 0,
): number {
  validateNexusGuildCunning(
    { turn: receipt.turn, players: receipt.roster },
    receipt,
  );
  const currentCount = typeof currentHajrUsed === 'boolean' ? Number(currentHajrUsed) : currentHajrUsed;
  const beforeCount = receipt.version === 1 ? Number(receipt.before.hajrUsed) : receipt.before.hajrPlays;
  requireGuild(
    validPlayCount(currentCount) && currentCount >= beforeCount &&
      Number.isSafeInteger(movesAfterSecond) &&
      movesAfterSecond >= 0,
    'Guild Cunning has changed its remaining Hajr movement.',
  );
  const available = Math.max(0, 1 + currentCount - Math.max(1, receipt.before.moved));
  requireGuild(
    movesAfterSecond <= available,
    'Guild Cunning cannot supply another ordinary movement.',
  );
  return available - movesAfterSecond;
}
