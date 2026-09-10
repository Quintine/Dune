import { FACTIONS, type FactionId } from './catalog';
import { reserveShipmentCost } from './shipment-price';

export type NexusRicheseContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusRicheseReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  phase: 5;
  mode: 'secretAlly';
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
export type NexusRicheseShipmentQuote = {
  physicalAmount: number;
  pricedAmount: 1;
  cost: number;
  source: 'nexusRichese';
};
function requireRichese(value: unknown, message: string): asserts value {
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

/** Only the price basis changes. The engine validates actual typed reserve
 * custody, destination, native Fremen geography, payment and arrival timing. */
export function quoteNexusRicheseShipment(
  player: { faction: FactionId; halfRate: boolean },
  territoryType: string,
  amount: number,
): NexusRicheseShipmentQuote {
  requireRichese(
    player &&
      faction(player.faction) &&
      player.faction !== 'richese' &&
      typeof player.halfRate === 'boolean' &&
      ['stronghold', 'sand', 'rock', 'polar'].includes(territoryType) &&
      Number.isSafeInteger(amount) &&
      amount >= 1 &&
      amount <= 5,
    'Richese Secret Ally needs one to five physical reserve forces and a valid ordinary shipment price.',
  );
  return {
    physicalAmount: amount,
    pricedAmount: 1,
    cost: reserveShipmentCost(player, territoryType, 1),
    source: 'nexusRichese',
  };
}
function roster(context: NexusRicheseContext) {
  requireRichese(
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
      !context.players.some((p) => p.faction === 'richese'),
    'Richese Secret Ally needs a valid original faction roster with Richese absent.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function signature(receipt: NexusRicheseReceipt) {
  return JSON.stringify([
    'nexusRicheseReceipt',
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
export function validateNexusRichese(
  context: NexusRicheseContext,
  receipt: NexusRicheseReceipt,
): void {
  const seats = roster(context);
  requireRichese(
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
        JSON.stringify(['nexusRichese', receipt.turn, receipt.owner]) &&
      Array.isArray(receipt.roster) &&
      receipt.roster.every(
        (p) => plain(p) && Object.keys(p).sort().join(',') === 'faction,id',
      ) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats) &&
      receipt.signature === signature(receipt),
    'Richese Secret Ally has lost its original owner, turn, phase or faction roster.',
  );
}
export function createNexusRichese(
  context: NexusRicheseContext,
  owner: string,
): NexusRicheseReceipt {
  const receipt: NexusRicheseReceipt = {
    version: 1,
    event: JSON.stringify(['nexusRichese', context.turn, owner]),
    owner,
    turn: context.turn,
    phase: 5,
    mode: 'secretAlly',
    roster: roster(context),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusRichese(context, receipt);
  return receipt;
}
