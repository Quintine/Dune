import type { Game, Player } from './engine';
import {
  eliteRevivalRemaining,
  forceRevivalRemaining,
  normalRevivalAllowance,
  revivalPrevented,
} from './revival';

export const FREMEN_NEXUS_FREE_FORCES = 3;
const POLICY = 'ordinary-free-quota-three' as const;
type RevivalPools = {
  reserves: number; tanks: number; eliteReserves: number; eliteTanks: number;
  eliteRevived: number; revived: number; freeForcesRevived: number; spice: number;
};
type LegacyReturn = { elite: number; before: RevivalPools; after: RevivalPools };
export type FremenNexusRevival = {
  version: 2;
  event: string;
  owner: string;
  turn: number;
  phase: 4;
  faction: Player['faction'];
  advanced: boolean;
  revivedAtUse: number;
  freeAtUse: number;
  policy: typeof POLICY;
  legacyReturn?: LegacyReturn;
  signature: string;
};
export const fremenNexusRevivalEvent = (turn: number, owner: string) =>
  JSON.stringify(['nexusFremenSecretRevival', turn, owner]);
export const fremenNexusRevivalSignature = (record: FremenNexusRevival) =>
  JSON.stringify({ ...record, signature: undefined });

const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function shape(value: unknown, keys: string): value is Record<string, unknown> {
  return plain(value) && Object.keys(value).sort().join(',') === keys;
}
function freeUsed(p: Player): number | null {
  if (!count(p.revived)) return null;
  if (p.freeForcesRevived === undefined) return p.revived === 0 ? 0 : null;
  return count(p.freeForcesRevived) && p.freeForcesRevived <= p.revived
    ? p.freeForcesRevived : null;
}

/** Spending enables a phase-bound ordinary quota; it never returns a force,
 * raises the ordinary total limit, or doubles the fixed quota with Recruits. */
export function fremenNexusRevivalOffer(g: Game, owner: string) {
  const p = g.players.find(seat => seat.id === owner);
  if (!p || !g.nexusCards?.cards ||
    g.nexusCards.cards.hands[owner] !== 'fremen' ||
    g.players.some(seat => seat.faction === 'fremen')) return null;
  const used = freeUsed(p);
  let blocked: string | null = null;
  if (p.ally) blocked = 'An allied player cannot use a Nexus card.';
  else if (g.status !== 'playing' || g.phase !== 4)
    blocked = 'Use Fremen Secret Ally during Revival.';
  else if (g.response || g.decision || g.truthtrance || g.phaseOpening || g.pendingRevival ||
    g.pendingKarama || g.pendingTreacheryDiscard || g.pendingNullentropy ||
    g.pendingExchange || g.pendingRicheseGift || g.pendingAmbassador || g.pendingCapture ||
    g.battle || g.nexusTraitorPending || g.nexusCards.phase?.stage === 'drawing')
    blocked = 'Finish the current interaction before using Fremen Secret Ally.';
  else if (g.nexusFremenRevivalEvents?.includes(fremenNexusRevivalEvent(g.turn, owner)) ||
    g.nexusFremenRevivalHistory?.some(record => record.turn === g.turn) ||
    (g.revivalRules?.nexusFremen?.turn === g.turn &&
      g.revivalRules.nexusFremen.owners.includes(owner)))
    blocked = 'Fremen Secret Ally has already been used this turn.';
  else if (used === null)
    blocked = 'Prior free-force revival usage is unknown; the Fremen quota cannot be granted safely.';
  else if (revivalPrevented(g, owner))
    blocked = 'Tleilaxu prevention blocks ordinary revival this turn.';
  else if (g.revivalRules?.freeBlocked?.includes(owner))
    blocked = 'Free ordinary revival is blocked for this player.';

  let freeRemaining = 0, maxForces = 0, ordinaryRemaining = 0;
  if (used !== null) {
    const native = normalRevivalAllowance(g, p);
    ordinaryRemaining = native.remaining;
    const eligible = Math.max(0, p.tanks - (p.elites?.tanks ?? 0)) +
      eliteRevivalRemaining(p, g.advanced);
    const ordinaryForces = forceRevivalRemaining(g, p);
    if (!g.revivalRules?.freeBlocked?.includes(owner)) {
      freeRemaining = Math.min(ordinaryRemaining,
        Math.max(0, Math.max(native.freeRate, FREMEN_NEXUS_FREE_FORCES) - used));
      maxForces = Math.min(ordinaryForces, freeRemaining, eligible);
    }
    if (!blocked && native.freeRate >= FREMEN_NEXUS_FREE_FORCES)
      blocked = 'The native free revival quota is already at least three; this card adds nothing.';
    if (!blocked && maxForces <= Math.min(ordinaryForces, eligible,
      Math.max(0, native.freeRate - used)))
      blocked = 'Fremen Secret Ally cannot improve the available free revival quota.';
    if (!blocked && maxForces < 1)
      blocked = 'No eligible ordinary force return remains in Tanks.';
  }
  return {
    event: fremenNexusRevivalEvent(g.turn, owner), blocked,
    quota: FREMEN_NEXUS_FREE_FORCES, freeRemaining, maxForces, ordinaryRemaining,
    policy: 'Enable a fixed ordinary free quota of three for this Revival phase, then use the normal revival controls. Prior free returns count; paid returns are not refunded. Native limits, typed-force caps, prevention and higher free rates still apply; Recruits does not double this fixed quota.',
  };
}

/** Pure receipt creation: custody and permission are committed by the engine. */
export function createFremenNexusRevival(g: Game, owner: string): FremenNexusRevival {
  const offer = fremenNexusRevivalOffer(g, owner);
  if (!offer || offer.blocked)
    throw new Error(offer?.blocked ?? 'Hold an eligible Fremen Secret Ally card.');
  const p = g.players.find(seat => seat.id === owner)!;
  const record: FremenNexusRevival = {
    version: 2, event: offer.event, owner, turn: g.turn, phase: 4,
    faction: p.faction, advanced: g.advanced,
    revivedAtUse: p.revived, freeAtUse: freeUsed(p)!, policy: POLICY, signature: '',
  };
  record.signature = fremenNexusRevivalSignature(record);
  return record;
}

function validIdentity(g: Game, record: Record<string, unknown>) {
  const p = g.players.find(seat => seat.id === record.owner);
  return !!p && !!g.nexusCards?.cards && typeof record.owner === 'string' &&
    record.owner.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(record.owner) &&
    record.phase === 4 && record.faction === p.faction && record.advanced === g.advanced &&
    count(record.turn) && record.turn >= 1 && record.turn <= g.turn &&
    record.event === fremenNexusRevivalEvent(record.turn, record.owner);
}
function validLegacyReturn(g: Game, owner: string, value: unknown): value is LegacyReturn {
  if (!shape(value, 'after,before,elite')) return false;
  const { before, after, elite } = value;
  const keys = 'eliteReserves,eliteRevived,eliteTanks,freeForcesRevived,reserves,revived,spice,tanks';
  if (!shape(before, keys) || !shape(after, keys) ||
    !Object.values(before).every(count) || !Object.values(after).every(count) ||
    !count(elite) || elite > FREMEN_NEXUS_FREE_FORCES) return false;
  const b = before as RevivalPools, a = after as RevivalPools;
  const p = g.players.find(seat => seat.id === owner)!;
  return b.eliteReserves <= b.reserves && b.eliteTanks <= b.tanks &&
    b.reserves + b.tanks <= 20 && b.revived === 0 && b.freeForcesRevived === 0 &&
    b.tanks >= 3 && elite <= b.eliteTanks && 3 - elite <= b.tanks - b.eliteTanks &&
    (!g.advanced || b.eliteRevived + elite <= 1) &&
    (p.faction === 'emperor' || !(elite || b.eliteReserves || b.eliteTanks)) &&
    JSON.stringify(a) === JSON.stringify({
      ...b, reserves: b.reserves + 3, tanks: b.tanks - 3,
      eliteReserves: b.eliteReserves + elite, eliteTanks: b.eliteTanks - elite,
      eliteRevived: b.eliteRevived + elite, revived: 3, freeForcesRevived: 3,
    });
}

export function validateFremenNexusRevival(g: Game, record: FremenNexusRevival): void {
  const keys = 'advanced,event,faction,freeAtUse,owner,phase,policy,revivedAtUse,signature,turn,version';
  if (!(shape(record, keys) ||
    shape(record, 'advanced,event,faction,freeAtUse,legacyReturn,owner,phase,policy,revivedAtUse,signature,turn,version')) ||
    !validIdentity(g, record) || record.version !== 2 || record.policy !== POLICY ||
    !count(record.revivedAtUse) || !count(record.freeAtUse) ||
    record.freeAtUse > record.revivedAtUse ||
    record.signature !== fremenNexusRevivalSignature(record) ||
    (Object.hasOwn(record, 'legacyReturn') &&
      (!validLegacyReturn(g, record.owner, record.legacyReturn) ||
        record.revivedAtUse !== 0 || record.freeAtUse !== 0)))
    throw new Error('Fremen Nexus revival lost its ordinary free-quota source grant.');
}

/** Saved exact-three receipts are adopted as source metadata only. Their
 * original physical return stays evidence, never another gameplay mutation. */
export function upgradeFremenNexusRevival(g: Game, value: unknown): FremenNexusRevival {
  if (plain(value) && value.version === 2) {
    validateFremenNexusRevival(g, value as FremenNexusRevival);
    return value as FremenNexusRevival;
  }
  if (!shape(value, 'advanced,after,before,elite,event,faction,owner,phase,signature,turn') ||
    !validIdentity(g, value) ||
    value.signature !== JSON.stringify({ ...value, signature: undefined }) ||
    !validLegacyReturn(g, value.owner as string,
      { elite: value.elite, before: value.before, after: value.after }))
    throw new Error('Fremen Nexus revival lost its original physical return.');
  const record: FremenNexusRevival = {
    version: 2, event: value.event as string, owner: value.owner as string,
    turn: value.turn as number, phase: 4, faction: value.faction as Player['faction'],
    advanced: value.advanced as boolean, revivedAtUse: 0, freeAtUse: 0, policy: POLICY,
    legacyReturn: {
      elite: value.elite as number,
      before: { ...value.before as RevivalPools }, after: { ...value.after as RevivalPools },
    }, signature: '',
  };
  record.signature = fremenNexusRevivalSignature(record);
  validateFremenNexusRevival(g, record);
  return record;
}
