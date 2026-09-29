import { splitLocation, validLocation } from './board';
import type { Player } from './engine';
import type { TerrorToken } from './moritani-terror';
import { TERROR_STRONGHOLDS } from './moritani-terror';

/** The sole Aftermath piece and the ally affected at activation belong in saved Game state. */
export type AtomicsAftermath = Readonly<{
  territory: string;
  turn: number;
  moritaniId: string;
  allyAtActivation: string | null;
  /** A later alliance change has no source-backed hand-limit interpretation yet. */
  alliancePolicy: 'unresolved';
}>;

export type AtomicsPlayer = Pick<
  Player,
  'id' | 'faction' | 'forces' | 'elites' | 'advisors' | 'ally' | 'noField' | 'tanks'
> & { handSize: number; baseHandLimit: number };

export type AtomicsCasualty = Readonly<{
  playerId: string;
  location: string;
  normal: number;
  elite: number;
  advisor: number;
}>;
export type AtomicsHandReduction = Readonly<{
  playerId: string;
  limit: number;
  randomDiscards: number;
}>;
export type AtomicsQuote = Readonly<{
  casualties: readonly AtomicsCasualty[];
  aftermath: AtomicsAftermath;
  handReductions: readonly AtomicsHandReduction[];
}>;

const whole = (value: number) => Number.isSafeInteger(value) && value >= 0;
function requireAtomics(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Plan, but never apply, the single revealed token's initial effect. No card identities enter this quote. */
export function quoteMoritaniAtomics(input: {
  token: TerrorToken;
  territory: string;
  players: readonly AtomicsPlayer[];
  moritaniId: string;
  turn: number;
  aftermath: AtomicsAftermath | null;
}): AtomicsQuote {
  const { token, players, moritaniId, turn, territory } = input;
  requireAtomics(token.kind === 'atomics' && token.status === 'placed' &&
    token.location === territory && TERROR_STRONGHOLDS.includes(territory),
  'Atomics requires its still-placed token in the entered ordinary stronghold.');
  requireAtomics(input.aftermath === null, 'Atomics Aftermath is already on the board.');
  requireAtomics(Number.isSafeInteger(turn) && turn >= 1, 'Atomics needs a valid turn.');
  requireAtomics(players.length > 0 && new Set(players.map(p => p.id)).size === players.length &&
    players.every(p => !!p.id), 'Atomics needs distinct physical players.');
  const moritani = players.find(p => p.id === moritaniId);
  requireAtomics(moritani?.faction === 'moritani', 'Atomics requires Moritani ownership.');
  const ally = moritani.ally === null ? null : players.find(p => p.id === moritani.ally);
  requireAtomics(moritani.ally === null || (!!ally && ally.id !== moritani.id &&
    ally.ally === moritani.id), 'Atomics requires a current mutual ally.');

  const casualties: AtomicsCasualty[] = [];
  for (const p of players) {
    requireAtomics(whole(p.tanks) && (!p.elites ||
      (whole(p.elites.tanks) && p.elites.tanks <= p.tanks)),
    'Atomics needs valid Tanks custody.');
    let total = 0, eliteTotal = 0;
    // A marker with zero counters is not a casualty. A concealed No-Field with
    // physical counters needs its own reveal/custody ruling before this effect.
    requireAtomics(p.noField?.deployed?.location.territory !== token.location,
      'Atomics with a concealed No-Field awaits its reveal and casualty rules.');
    for (const key of new Set([...Object.keys(p.forces),
      ...Object.keys(p.elites?.forces ?? {})])) {
      const { territory, sector } = splitLocation(key);
      if (territory !== token.location) continue;
      const amount = p.forces[key] ?? 0;
      const elite = p.elites?.forces[key] ?? 0;
      requireAtomics(key === `${territory}:${sector}` && validLocation(territory, sector) &&
        whole(amount) && whole(elite) && elite <= amount,
      'Atomics needs valid typed forces in the stronghold.');
      total += amount;
      eliteTotal += elite;
      if (amount) casualties.push({ playerId: p.id, location: key,
        normal: amount - elite, elite,
        advisor: p.faction === 'beneGesserit' && p.advisors?.[territory]
          ? amount : 0 });
    }
    requireAtomics(whole(p.tanks + total) && (!p.elites ||
      whole(p.elites.tanks + eliteTotal)), 'Atomics casualties overflow Tanks.');
  }

  const handReductions = [moritani, ...(ally ? [ally] : [])].map(p => {
    requireAtomics(whole(p.handSize) && Number.isSafeInteger(p.baseHandLimit) &&
      p.baseHandLimit >= 1, 'Atomics requires authoritative hand counts and limits.');
    const limit = p.baseHandLimit - 1;
    return { playerId: p.id, limit, randomDiscards: Math.max(0, p.handSize - limit) };
  });
  return {
    casualties,
    aftermath: { territory: token.location, turn, moritaniId,
      allyAtActivation: ally?.id ?? null, alliancePolicy: 'unresolved' },
    handReductions,
  };
}

/** Ordinary and Fremen shipments are both blocked; movement and Sneak Attack are not shipments. */
export function atomicsShipmentBlocked(
  aftermath: AtomicsAftermath | null | undefined,
  destinationTerritory: string,
): boolean {
  return aftermath?.territory === destinationTerritory;
}

/** A public pre-offer guard avoids promises whose acceptance would change Moritani's unresolved penalty recipient. */
export function atomicsAllianceChangeBlocked(
  aftermath: Pick<AtomicsAftermath, 'moritaniId' | 'allyAtActivation'> | null | undefined,
  actor: string,
  target: string | null,
): boolean {
  return !!aftermath && (actor === aftermath.moritaniId ||
    actor === aftermath.allyAtActivation ||
    target === aftermath.moritaniId ||
    target === aftermath.allyAtActivation);
}

/** Must be checked before interpreting lasting hand limits after any ally change. */
export function atomicsAllianceStatus(
  aftermath: AtomicsAftermath,
  currentAllyId: string | null,
): 'activation-alliance' | 'clarification-required' {
  return aftermath.alliancePolicy === 'unresolved' &&
    currentAllyId === aftermath.allyAtActivation
    ? 'activation-alliance' : 'clarification-required';
}

/** A queried player retains the initial reduction only while the alliance remains unchanged. */
export function atomicsEffectiveHandLimit(
  aftermath: AtomicsAftermath | null | undefined,
  playerId: string,
  currentAllyId: string | null,
  baseLimit: number,
): number {
  requireAtomics(Number.isSafeInteger(baseLimit) && baseLimit >= 1,
    'Atomics requires an authoritative base hand limit.');
  if (!aftermath) return baseLimit;
  requireAtomics(atomicsAllianceStatus(aftermath, currentAllyId) === 'activation-alliance',
    'A later Moritani alliance change needs an authoritative Atomics hand-limit ruling.');
  return playerId === aftermath.moritaniId ||
    playerId === aftermath.allyAtActivation ? baseLimit - 1 : baseLimit;
}
