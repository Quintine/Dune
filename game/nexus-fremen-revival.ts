import type { Game, Player } from './engine';
import { eliteRevivalRemaining, forceRevivalLimit, freeRevivalRate } from './revival';

export const FREMEN_NEXUS_FREE_FORCES = 3;
type RevivalPools = { reserves: number; tanks: number; eliteReserves: number; eliteTanks: number;
  eliteRevived: number; revived: number; freeForcesRevived: number; spice: number };
export type FremenNexusRevival = {
  event: string;
  owner: string;
  turn: number;
  phase: 4;
  faction: Player['faction'];
  advanced: boolean;
  elite: number;
  before: RevivalPools;
  after: RevivalPools;
  signature: string;
};
export function fremenNexusRevivalPools(p: Player): RevivalPools {
  return {
    reserves: p.reserves, tanks: p.tanks,
    eliteReserves: p.elites?.reserves ?? 0, eliteTanks: p.elites?.tanks ?? 0,
    eliteRevived: p.elites?.revived ?? 0, revived: p.revived,
    freeForcesRevived: p.freeForcesRevived ?? 0, spice: p.spice,
  };
}
export const fremenNexusRevivalEvent = (turn: number, owner: string) =>
  JSON.stringify(['nexusFremenSecretRevival', turn, owner]);
export const fremenNexusRevivalSignature = (record: FremenNexusRevival) =>
  JSON.stringify({ ...record, signature: undefined });

/** Bounded first path: base-faction, ordinary force allowance, no competing
 * revival modifiers or prior force returns. Other combinations stay gated. */
export function fremenNexusRevivalOffer(g: Game, owner: string) {
  const p = g.players.find(seat => seat.id === owner);
  if (!p || g.nexusCards?.cards?.hands[owner] !== 'fremen' ||
    g.players.some(seat => seat.faction === 'fremen')) return null;
  let blocked: string | null = null;
  if (p.ally) blocked = 'An allied player cannot use a Nexus card.';
  else if (g.status !== 'playing' || g.phase !== 4) blocked = 'Use Fremen Secret Ally during Revival.';
  else if (g.expansions.length || g.homeworlds || g.leaderSkills || g.discoveryEnabled ||
    g.discoveries || g.discoveryStash || g.greatMaker || g.ecazTreachery ||
    g.techTokens || g.strongholdCards ||
    g.players.some(seat => !['atreides', 'harkonnen', 'emperor', 'guild', 'beneGesserit'].includes(seat.faction)))
    blocked = 'Combined expansion and module revival interactions remain unavailable.';
  else if (g.response || g.decision || g.truthtrance || g.phaseOpening || g.pendingRevival ||
    g.pendingKarama || g.pendingTreacheryDiscard || g.pendingNullentropy ||
    g.pendingExchange || g.pendingRicheseGift || g.pendingAmbassador || g.pendingCapture ||
    g.battle || g.nexusTraitorPending || g.nexusCards?.phase?.stage === 'drawing')
    blocked = 'Finish the current interaction before using Fremen Secret Ally.';
  else if (g.recruits?.turn === g.turn || g.revivalRules?.limitBlocked ||
    g.revivalRules?.expanded.length || g.revivalRules?.freeBlocked?.length ||
    g.freeRevival.includes(owner) || g.revivalPrevention?.turn === g.turn ||
    forceRevivalLimit(g,p) !== 3 || freeRevivalRate(g,p) >= 3)
    blocked = 'Combined or higher-rate revival accounting remains unavailable.';
  else if (p.revived !== 0 || (p.freeForcesRevived ?? 0) !== 0)
    blocked = 'Use this free-three return before ordinary force revivals; late accounting remains unavailable.';
  const eliteOptions: number[] = [];
  for (let elite = 0; elite <= FREMEN_NEXUS_FREE_FORCES; elite++)
    if (elite <= eliteRevivalRemaining(p,g.advanced) &&
      elite <= (p.elites?.tanks ?? 0) &&
      FREMEN_NEXUS_FREE_FORCES - elite <= p.tanks - (p.elites?.tanks ?? 0))
      eliteOptions.push(elite);
  if (!blocked && !eliteOptions.length)
    blocked = 'An exact three-force return is unavailable; a smaller return awaits a ruling.';
  return { event: fremenNexusRevivalEvent(g.turn,owner), blocked, eliteOptions };
}

export function validateFremenNexusRevival(g: Game, record: FremenNexusRevival) {
  const p = g.players.find(seat => seat.id === record?.owner);
  const before = record?.before, after = record?.after;
  if (!p || !g.nexusCards?.cards || !record ||
    Object.keys(record).sort().join(',') !== 'advanced,after,before,elite,event,faction,owner,phase,signature,turn' ||
    record.phase !== 4 || record.faction !== p.faction || record.advanced !== g.advanced ||
    !Number.isSafeInteger(record.turn) || record.turn < 1 || record.turn > g.turn ||
    record.event !== fremenNexusRevivalEvent(record.turn,record.owner) ||
    record.signature !== fremenNexusRevivalSignature(record) ||
    !Number.isSafeInteger(record.elite) || record.elite < 0 || record.elite > 3 ||
    !before || !after ||
    Object.keys(before).sort().join(',') !== 'eliteReserves,eliteRevived,eliteTanks,freeForcesRevived,reserves,revived,spice,tanks' ||
    Object.keys(after).sort().join(',') !== 'eliteReserves,eliteRevived,eliteTanks,freeForcesRevived,reserves,revived,spice,tanks' ||
    Object.values(before).some(n => !Number.isSafeInteger(n) || n < 0) ||
    Object.values(after).some(n => !Number.isSafeInteger(n) || n < 0) ||
    before.eliteReserves > before.reserves || before.eliteTanks > before.tanks ||
    before.reserves + before.tanks > 20 || before.revived !== 0 || before.freeForcesRevived !== 0 ||
    before.tanks < 3 || record.elite > before.eliteTanks ||
    3 - record.elite > before.tanks - before.eliteTanks ||
    (g.advanced && before.eliteRevived + record.elite > 1) ||
    (p.faction !== 'emperor' && (record.elite || before.eliteReserves || before.eliteTanks)) ||
    JSON.stringify(after) !== JSON.stringify({
      ...before,
      reserves: before.reserves + 3, tanks: before.tanks - 3,
      eliteReserves: before.eliteReserves + record.elite,
      eliteTanks: before.eliteTanks - record.elite,
      eliteRevived: before.eliteRevived + record.elite,
      revived: 3, freeForcesRevived: 3,
    }))
    throw new Error('Fremen Nexus revival lost its original physical return.');
}
