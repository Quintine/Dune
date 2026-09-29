import type { Game } from './engine';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';

export type FremenNexusBetrayal = {
  event: string;
  owner: string;
  target: string;
  turn: number;
  phase: 5;
  signature: string;
};
export const fremenBetrayalEvent = (turn: number, owner: string, target: string) =>
  JSON.stringify(['nexusFremenBetrayal', turn, owner, target]);
export const fremenBetrayalSignature = (record: FremenNexusBetrayal) =>
  JSON.stringify({ ...record, signature: undefined });

/** Clean pre-movement use prevents retroactive suppression and never tests
 * secret card custody of another seat when constructing public turn state. */
export function fremenBetrayalOffer(g: Game, owner: string, automaticPending = false) {
  const holder = g.players.find(p => p.id === owner);
  const fremen = g.players.find(p => p.faction === 'fremen');
  if (!holder || !fremen || g.nexusCards?.cards?.hands[owner] !== 'fremen' ||
    holder.faction === 'fremen') return null;
  let blocked: string | null = null;
  if (holder.ally) blocked = 'An allied player cannot use a Nexus card.';
  else if (g.status !== 'playing' || g.phase !== 5)
    blocked = 'Use Fremen Betrayal before Fremen move during Shipment and Movement.';
  else if (g.expansions.length || g.homeworlds || g.leaderSkills || g.discoveryEnabled ||
    g.discoveries || g.discoveryStash || g.greatMaker || g.ecazTreachery ||
    g.techTokens || g.strongholdCards ||
    g.players.some(p => !['atreides','harkonnen','emperor','fremen','guild','beneGesserit'].includes(p.faction)))
    blocked = 'Combined expansion and module movement interactions remain unavailable.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using Fremen Betrayal.';
  else if (!g.movementRemaining?.includes(fremen.id) || fremen.moved !== 0 ||
    fremen.fremenNexusMovementBlockedTurn === g.turn)
    blocked = 'Fremen have already moved or completed their turn.';
  return { event: fremenBetrayalEvent(g.turn,owner,fremen.id), blocked, target: fremen.id };
}

export function validateFremenBetrayal(g: Game, record: FremenNexusBetrayal) {
  if (!record || Object.keys(record).sort().join(',') !== 'event,owner,phase,signature,target,turn' ||
    !Number.isSafeInteger(record.turn) || record.turn < 1 || record.turn > g.turn ||
    record.phase !== 5 || record.owner === record.target ||
    !g.players.some(p => p.id === record.owner && p.faction !== 'fremen') ||
    !g.players.some(p => p.id === record.target && p.faction === 'fremen') ||
    record.event !== fremenBetrayalEvent(record.turn,record.owner,record.target) ||
    record.signature !== fremenBetrayalSignature(record))
    throw new Error('Fremen Betrayal has lost its original movement restriction.');
}
