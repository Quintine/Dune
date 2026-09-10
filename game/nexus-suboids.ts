import type { FactionId } from './catalog';
export type NexusSuboidContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusSuboidReceipt = {
  version: 1; event: string; owner: string; turn: number; battle: string;
  roster: { id: string; faction: FactionId }[]; signature: string;
};
function requireSuboids(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function signature(receipt: NexusSuboidReceipt) {
  return JSON.stringify([receipt.version, receipt.event, receipt.owner, receipt.turn, receipt.battle,
    receipt.roster.map(p => [p.id, p.faction])]);
}
function roster(context: NexusSuboidContext) {
  return context.players.map(({id, faction}) => ({id, faction})).sort((a, b) => a.id.localeCompare(b.id));
}
export function validateNexusSuboids(context: NexusSuboidContext, history: readonly NexusSuboidReceipt[]) {
  requireSuboids(Number.isSafeInteger(context.turn) && context.turn > 0 && Array.isArray(history),
    'Invalid Suboid Nexus turn or history.');
  const turns = new Set<number>();
  for (const receipt of history) {
    requireSuboids(receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
      Object.keys(receipt).sort().join(',') === 'battle,event,owner,roster,signature,turn,version' &&
      receipt.version === 1 && typeof receipt.battle === 'string' && receipt.battle.length > 0 &&
      Number.isSafeInteger(receipt.turn) && receipt.turn > 0 && receipt.turn <= context.turn &&
      !turns.has(receipt.turn) &&
      context.players.some(p => p.id === receipt.owner && p.faction === 'ixians') &&
      receipt.event === JSON.stringify(['nexusSuboids', receipt.turn, receipt.battle, receipt.owner]) &&
      JSON.stringify(receipt.roster) === JSON.stringify(roster(context)) &&
      receipt.signature === signature(receipt),
    'The Suboid Nexus effect has lost its original battle, owner or turn.');
    turns.add(receipt.turn);
  }
}
export function createNexusSuboids(context: NexusSuboidContext, owner: string, battle: string): NexusSuboidReceipt {
  const receipt: NexusSuboidReceipt = { version: 1, owner, turn: context.turn, battle,
    event: JSON.stringify(['nexusSuboids', context.turn, battle, owner]), roster: roster(context), signature: '' };
  receipt.signature = signature(receipt);
  validateNexusSuboids(context, [receipt]);
  return receipt;
}
/** A completed play applies to every battle in its own turn only. */
export function nexusSuboidsActive(context: NexusSuboidContext, history: readonly NexusSuboidReceipt[] | undefined, owner: string) {
  return history?.some(receipt => receipt.owner === owner && receipt.turn === context.turn) ?? false;
}
