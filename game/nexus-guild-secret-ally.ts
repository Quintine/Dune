import { FACTIONS, type FactionId } from './catalog';
import { guildShipmentCost } from './shipment-price';

export type NexusGuildSecretAllyContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusGuildSecretAllyReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  phase: 5;
  mode: 'secretAlly';
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
function requireGuild(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const faction = (value: unknown): value is FactionId =>
  FACTIONS.some((candidate) => candidate.id === value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !['__proto__', 'prototype', 'constructor'].includes(value);
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** The caller validates route permission and actual physical custody. */
export function quoteNexusGuildSecretShipment(destinationType: string, amount: number) {
  requireGuild(['stronghold','sand','rock','polar','reserves','homeworld'].includes(destinationType) &&
    Number.isSafeInteger(amount) && amount > 0 && amount <= 20,
    'Guild Secret Ally requires a valid destination and one to twenty physical forces.');
  return {physicalAmount:amount,cost:guildShipmentCost(destinationType === 'homeworld' ? 'reserves' : destinationType,amount),source:'nexusGuildSecretAlly' as const};
}
function roster(context: NexusGuildSecretAllyContext) {
  requireGuild(
    context &&
      Number.isSafeInteger(context.turn) &&
      context.turn > 0 &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      context.players.every(
        (p) => p && identifier(p.id) && faction(p.faction),
      ) &&
      new Set(context.players.map((p) => p.id)).size ===
        context.players.length &&
      new Set(context.players.map((p) => p.faction)).size ===
        context.players.length &&
      !context.players.some((p) => p.faction === 'guild'),
    'Guild Secret Ally needs a valid original faction roster with the native Guild absent.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function signature(receipt: NexusGuildSecretAllyReceipt) {
  return JSON.stringify([
    'nexusGuildSecretAllyReceipt',
    receipt.version,
    receipt.event,
    receipt.owner,
    receipt.turn,
    receipt.phase,
    receipt.mode,
    receipt.roster.map((p) => [p.id, p.faction]),
  ]);
}
/** Historical evidence stays valid after later card use, alliances and turns.
 * Signatures establish consistency, not cryptographic authentication. */
export function validateNexusGuildSecretAlly(
  context: NexusGuildSecretAllyContext,
  receipt: NexusGuildSecretAllyReceipt,
): void {
  const seats = roster(context);
  requireGuild(
    plain(receipt) &&
      Object.keys(receipt).sort().join(',') ===
        'event,mode,owner,phase,roster,signature,turn,version' &&
      receipt.version === 1 &&
      receipt.phase === 5 &&
      receipt.mode === 'secretAlly' &&
      Number.isSafeInteger(receipt.turn) &&
      receipt.turn > 0 &&
      receipt.turn <= context.turn &&
      identifier(receipt.owner) &&
      seats.some((p) => p.id === receipt.owner) &&
      receipt.event ===
        JSON.stringify(['nexusGuildSecretAlly', receipt.turn, receipt.owner]) &&
      Array.isArray(receipt.roster) &&
      receipt.roster.every(
        (p) => plain(p) && Object.keys(p).sort().join(',') === 'faction,id',
      ) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats) &&
      receipt.signature === signature(receipt),
    'Guild Secret Ally has lost its original owner, turn, phase or faction roster.',
  );
}
export function createNexusGuildSecretAlly(
  context: NexusGuildSecretAllyContext,
  owner: string,
): NexusGuildSecretAllyReceipt {
  const receipt: NexusGuildSecretAllyReceipt = {
    version: 1,
    event: JSON.stringify(['nexusGuildSecretAlly', context.turn, owner]),
    owner,
    turn: context.turn,
    phase: 5,
    mode: 'secretAlly',
    roster: roster(context),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusGuildSecretAlly(context, receipt);
  return receipt;
}
