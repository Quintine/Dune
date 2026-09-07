import { FACTIONS, type FactionId } from './catalog';

/** Physical inventory only. Ordinary revival allowances, private information,
 * prices, timing and Ambassador ownership belong to the caller. */
export type TleilaxuAmbassadorForceContext = Readonly<{
  faction: FactionId;
  reserves: number;
  tanks: number;
  elites?: Readonly<{ reserves: number; tanks: number; revived: number }>;
}>;
export type TleilaxuAmbassadorForceInventory = {
  reserves: number;
  tanks: number;
  eliteReserves: number;
  eliteTanks: number;
};
export type TleilaxuAmbassadorForceQuote = {
  amount: number;
  ordinary: number;
  elite: number;
  before: TleilaxuAmbassadorForceInventory;
  after: TleilaxuAmbassadorForceInventory;
  eliteRevivedNext: number;
};
export class TleilaxuAmbassadorForceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TleilaxuAmbassadorForceError';
  }
}
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireForces(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TleilaxuAmbassadorForceError(message);
}

/** Quote one nonzero physical return under E3's fixed maximum four. Zero is a
 * caller-owned no-return selection. The global Fedaykin/Sardaukar turn limit
 * survives this independent source; Ixian cyborgs have no equivalent cap.
 * This function never commits the return or decides ordinary usage/income. */
export function quoteTleilaxuAmbassadorForces(
  player: TleilaxuAmbassadorForceContext,
  amount: number,
  selectedElite?: number,
): TleilaxuAmbassadorForceQuote {
  requireForces(
    record(player) && FACTIONS.some((f) => f.id === player.faction),
    'Choose a valid faction force inventory.',
  );
  requireForces(
    whole(player.reserves) && whole(player.tanks),
    'The reserve and Tanks counts must be safe whole numbers.',
  );
  const typed = player.elites;
  requireForces(
    typed === undefined ||
      (record(typed) &&
        whole(typed.reserves) &&
        whole(typed.tanks) &&
        whole(typed.revived)),
    'The elite inventory and revival count must be safe whole numbers.',
  );
  const eliteReserves = typed?.reserves ?? 0;
  const eliteTanks = typed?.tanks ?? 0;
  const eliteRevived = typed?.revived ?? 0;
  requireForces(
    eliteReserves <= player.reserves && eliteTanks <= player.tanks,
    'Elite forces must be included in the physical reserve and Tanks totals.',
  );
  requireForces(
    ['fremen', 'emperor', 'ixians'].includes(player.faction) ||
      (eliteReserves === 0 && eliteTanks === 0 && eliteRevived === 0),
    'This faction has no elite force inventory.',
  );
  requireForces(
    whole(amount) && amount >= 1 && amount <= Math.min(4, player.tanks),
    'Choose one to four physical forces available in the Tanks.',
  );
  requireForces(
    selectedElite === undefined || whole(selectedElite),
    'Choose a safe whole number of elite forces.',
  );
  const ordinaryTanks = player.tanks - eliteTanks;
  const elite = selectedElite ?? Math.max(0, amount - ordinaryTanks);
  requireForces(
    whole(elite) &&
      elite <= amount &&
      elite <= eliteTanks &&
      amount - elite <= ordinaryTanks,
    'The selected ordinary and elite forces must be available in the Tanks.',
  );
  requireForces(
    player.faction === 'ixians' || elite <= Math.max(0, 1 - eliteRevived),
    'Only one Fedaykin or Sardaukar may be revived per turn.',
  );
  const before = {
    reserves: player.reserves,
    tanks: player.tanks,
    eliteReserves,
    eliteTanks,
  };
  const after = {
    reserves: player.reserves + amount,
    tanks: player.tanks - amount,
    eliteReserves: eliteReserves + elite,
    eliteTanks: eliteTanks - elite,
  };
  const eliteRevivedNext = eliteRevived + elite;
  requireForces(
    Object.values(after).every(whole) && whole(eliteRevivedNext),
    'The returned forces would overflow their physical inventory or elite usage.',
  );
  return {
    amount,
    ordinary: amount - elite,
    elite,
    before,
    after,
    eliteRevivedNext,
  };
}
