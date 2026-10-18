import { TERRITORIES, splitLocation, validLocation } from './board';
import type { Player } from './engine';
import type { TerrorToken } from './moritani-terror';
import { TERROR_STRONGHOLDS } from './moritani-terror';

/** The sole Aftermath piece and the ally affected at activation belong in saved Game state. */
export type AtomicsAftermath = Readonly<{
  territory: string;
  turn: number;
  moritaniId: string;
  allyAtActivation: string | null;
  /** Provisional permanent targets: Moritani and its ally at activation. */
  alliancePolicy: 'activation-targets';
  /** Original Moritani Cunning grant for an otherwise non-stronghold target. */
  nexusPlacement?: string;
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
  /** The engine authenticates the original physical Cunning placement. */
  nexusPlacement?: string;
}): AtomicsQuote {
  const { token, players, moritaniId, turn, territory } = input;
  requireAtomics(token.kind === 'atomics' && token.status === 'placed' &&
    token.location === territory && (TERROR_STRONGHOLDS.includes(territory) ||
      (typeof input.nexusPlacement === 'string' && input.nexusPlacement.length > 0 &&
        TERRITORIES.some(entry => entry.id === territory))),
  'Atomics requires its still-placed token and an ordinary stronghold or original Nexus placement.');
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
    // The engine materializes any caught No-Field in a detached forecast before
    // quoting this physical effect. The pure calculator never invents counters.
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
      'Atomics needs valid typed forces in the territory.');
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
      allyAtActivation: ally?.id ?? null, alliancePolicy: 'activation-targets',
      ...(!TERROR_STRONGHOLDS.includes(territory) ? { nexusPlacement: input.nexusPlacement! } : {}) },
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

