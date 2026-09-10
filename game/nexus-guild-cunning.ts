import { FACTIONS, type FactionId } from './catalog';

export type NexusGuildCunningContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId; ally?: string | null }[];
};
export type NexusGuildCunningBefore = {
  shipped: boolean;
  moved: number;
  hajrUsed: boolean;
};
export type NexusGuildCunningReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  phase: 5;
  mode: 'cunning';
  roster: { id: string; faction: FactionId }[];
  before: NexusGuildCunningBefore;
  signature: string;
};

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
function validateBefore(before: NexusGuildCunningBefore) {
  requireGuild(
    plain(before) &&
      Object.keys(before).sort().join(',') === 'hajrUsed,moved,shipped' &&
      typeof before.shipped === 'boolean' &&
      typeof before.hajrUsed === 'boolean' &&
      Number.isSafeInteger(before.moved) &&
      before.moved >= 0 &&
      before.moved <= (before.hajrUsed ? 2 : 1),
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
    [receipt.before.shipped, receipt.before.moved, receipt.before.hajrUsed],
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
      receipt.version === 1 &&
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
  validateBefore(receipt.before);
  requireGuild(
    receipt.signature === signature(receipt),
    'Guild Cunning has changed its original combined turn.',
  );
}
export function createNexusGuildCunning(
  context: NexusGuildCunningContext & { phase: number; active: string | null },
  owner: string,
  before: NexusGuildCunningBefore,
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
  validateBefore(before);
  const receipt: NexusGuildCunningReceipt = {
    version: 1,
    event: JSON.stringify(['nexusGuildCunning', context.turn, owner]),
    owner,
    turn: context.turn,
    phase: 5,
    mode: 'cunning',
    roster: seats,
    before: { ...before },
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusGuildCunning(context, receipt);
  return receipt;
}
/** Ending ordinary movement forgoes at least its first slot. Hajr supplies only
 * the still-unused extra slot, whether played before or after the shipment. */
export function nexusGuildCunningMoves(
  receipt: NexusGuildCunningReceipt,
  currentHajrUsed: boolean,
  movesAfterSecond = 0,
): 0 | 1 {
  validateNexusGuildCunning(
    { turn: receipt.turn, players: receipt.roster },
    receipt,
  );
  requireGuild(
    typeof currentHajrUsed === 'boolean' &&
      (!receipt.before.hajrUsed || currentHajrUsed) &&
      Number.isSafeInteger(movesAfterSecond) &&
      movesAfterSecond >= 0 &&
      movesAfterSecond <= 1,
    'Guild Cunning has changed its remaining Hajr movement.',
  );
  const available = currentHajrUsed
    ? Math.max(0, 2 - Math.max(1, receipt.before.moved))
    : 0;
  requireGuild(
    movesAfterSecond <= available,
    'Guild Cunning cannot supply another ordinary movement.',
  );
  return (available - movesAfterSecond) as 0 | 1;
}
