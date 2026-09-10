import type { FactionId } from './catalog';

export type NexusSardaukarContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusSardaukarReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  battle: string;
  territory: string;
  normal: number;
  elite: 0;
  count: 5;
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
function requireSardaukar(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function roster(context: NexusSardaukarContext) {
  requireSardaukar(
    Number.isSafeInteger(context.turn) &&
      context.turn > 0 &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      context.players.every(
        (p) => p && identifier(p.id) && identifier(p.faction),
      ) &&
      new Set(context.players.map((p) => p.id)).size ===
        context.players.length &&
      new Set(context.players.map((p) => p.faction)).size ===
        context.players.length,
    'The Sardaukar Nexus needs its original faction roster and turn.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function signature(receipt: NexusSardaukarReceipt): string {
  return JSON.stringify([
    receipt.version,
    receipt.event,
    receipt.owner,
    receipt.turn,
    receipt.battle,
    receipt.territory,
    receipt.normal,
    receipt.elite,
    receipt.count,
    receipt.roster.map((p) => [p.id, p.faction]),
  ]);
}
/** Historical evidence does not depend on forces surviving this battle. */
export function validateNexusSardaukar(
  context: NexusSardaukarContext,
  receipt: NexusSardaukarReceipt,
): void {
  const seats = roster(context);
  requireSardaukar(
    receipt &&
      typeof receipt === 'object' &&
      !Array.isArray(receipt) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(receipt)) &&
      Object.keys(receipt).sort().join(',') ===
        'battle,count,elite,event,normal,owner,roster,signature,territory,turn,version' &&
      receipt.version === 1 &&
      identifier(receipt.battle) &&
      identifier(receipt.territory) &&
      Number.isSafeInteger(receipt.turn) &&
      receipt.turn > 0 &&
      receipt.turn <= context.turn &&
      Number.isSafeInteger(receipt.normal) &&
      receipt.normal >= 5 &&
      receipt.normal <= 20 &&
      receipt.elite === 0 &&
      receipt.count === 5 &&
      seats.some((p) => p.id === receipt.owner && p.faction === 'emperor') &&
      receipt.event ===
        JSON.stringify([
          'nexusSardaukar',
          receipt.turn,
          receipt.battle,
          receipt.owner,
        ]) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats) &&
      receipt.signature === signature(receipt),
    'The Sardaukar Nexus has lost its original battle, five-counter group or owner.',
  );
}
export function createNexusSardaukar(
  context: NexusSardaukarContext,
  owner: string,
  battle: string,
  territory: string,
  normal: number,
): NexusSardaukarReceipt {
  const receipt: NexusSardaukarReceipt = {
    version: 1,
    event: JSON.stringify(['nexusSardaukar', context.turn, battle, owner]),
    owner,
    turn: context.turn,
    battle,
    territory,
    normal,
    elite: 0,
    count: 5,
    roster: roster(context),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusSardaukar(context, receipt);
  return receipt;
}
