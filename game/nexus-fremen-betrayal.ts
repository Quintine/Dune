import type { Game } from './engine';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';

export type FremenNexusBetrayal = {
  event: string;
  owner: string;
  target: string;
  turn: number;
  phase: 1 | 5;
  mode: 'worm' | 'movement';
  signature: string;
};
/** The first movement-only checkpoint wrote this six-field physical receipt. */
export type StoredFremenNexusBetrayal = FremenNexusBetrayal |
  (Omit<FremenNexusBetrayal, 'mode' | 'phase'> & { phase: 5; mode?: never });
export type FremenBetrayalOffer = {
  event: string;
  blocked: string | null;
  target: string;
  mode: FremenNexusBetrayal['mode'];
};
export const fremenBetrayalEvent = (
  turn: number, owner: string, target: string, mode: FremenNexusBetrayal['mode'],
) => JSON.stringify(['nexusFremenBetrayal', turn, owner, target, mode]);
export const fremenBetrayalSignature = (record: FremenNexusBetrayal) =>
  JSON.stringify({ ...record, signature: undefined });

/** Clean advance declarations avoid a holder-dependent worm interruption
 * while preserving both mutually exclusive printed alternatives. */
export function fremenBetrayalOffer(
  g: Game, owner: string, automaticPending = false,
): FremenBetrayalOffer | null {
  const holder = g.players.find(p => p.id === owner);
  const fremen = g.players.find(p => p.faction === 'fremen');
  if (!holder || !fremen || g.nexusCards?.cards?.hands[owner] !== 'fremen' ||
    holder.faction === 'fremen') return null;
  const mode = g.phase === 1 ? 'worm' : 'movement';
  let blocked: string | null = null;
  if (holder.ally) blocked = 'An allied player cannot use a Nexus card.';
  else if (g.status !== 'playing' || (g.phase !== 1 && g.phase !== 5))
    blocked = 'Use Fremen Betrayal before the first Spice Blow or before Fremen movement.';
  else if (g.expansions.length || g.homeworlds || g.leaderSkills || g.discoveryEnabled ||
    g.discoveries || g.discoveryStash || g.greatMaker || g.ecazTreachery ||
    g.techTokens || g.strongholdCards ||
    g.players.some(p => !['atreides','harkonnen','emperor','fremen','guild','beneGesserit'].includes(p.faction)))
    blocked = 'Combined expansion and module interactions remain unavailable.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using Fremen Betrayal.';
  else if (g.nexusFremenBetrayalHistory?.some(record => record.turn === g.turn))
    blocked = 'Fremen Betrayal already spent its one physical card this turn.';
  else if (mode === 'worm') {
    if (g.spiceSequence || g.spiceResolution || g.spiceWindow || g.nexus ||
      g.wormRides.length || g.summonedBeforeBlow || g.nexusFremenCunningOffer ||
      g.nexusFremenCunningRides?.some(row => row.stage !== 'complete'))
      blocked = 'Declare worm-riding prevention before the first worm or spice blow this turn.';
  } else if (!g.movementRemaining?.includes(fremen.id) || fremen.moved !== 0 ||
    fremen.fremenNexusMovementBlockedTurn === g.turn)
    blocked = 'Fremen have already moved or completed their turn.';
  return { event: fremenBetrayalEvent(g.turn, owner, fremen.id, mode),
    blocked, target: fremen.id, mode };
}

export function validateFremenBetrayal(
  g: Game, record: StoredFremenNexusBetrayal,
): FremenNexusBetrayal['mode'] {
  const keys = record && Object.keys(record).sort().join(',');
  const legacy = keys === 'event,owner,phase,signature,target,turn';
  const mode = legacy ? 'movement' : record?.mode;
  if (!record ||
    (!legacy && keys !== 'event,mode,owner,phase,signature,target,turn') ||
    !Number.isSafeInteger(record.turn) || record.turn < 1 || record.turn > g.turn ||
    (mode !== 'worm' && mode !== 'movement') ||
    record.phase !== (mode === 'worm' ? 1 : 5) ||
    record.owner === record.target ||
    !g.players.some(p => p.id === record.owner && p.faction !== 'fremen') ||
    !g.players.some(p => p.id === record.target && p.faction === 'fremen') ||
    record.event !== (legacy
      ? JSON.stringify(['nexusFremenBetrayal', record.turn, record.owner, record.target])
      : fremenBetrayalEvent(record.turn, record.owner, record.target, mode)) ||
    record.signature !== JSON.stringify({ ...record, signature: undefined }))
    throw new Error('Fremen Betrayal has lost its original turn-long restriction.');
  return mode;
}
