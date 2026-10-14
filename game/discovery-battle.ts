import {
  casualtyOptions,
  validCombatForces,
  type Casualties,
  type CombatForces,
} from './combat';
import { JACURUTU_SIETCH } from './discoveries';

/** GF9 Ecaz & Moritani rulebook, p. 13. */
export const JACURUTU_BATTLE_INCOME_RULE =
  'If you win a battle in Jacurutu Sietch, gain one spice for each opposing undialed force sent to the Tanks.';

export type JacurutuTankLosses = Readonly<{
  normal: number;
  elite: number;
}>;

/** One legal physical reading of the revealed opposing dial. */
export type JacurutuDialChoice = Readonly<{
  /** The physical ordinary/elite counters the defeated player committed to the
   * revealed dial, with the plan's paid support split. */
  dialed: Casualties;
  /** Bank spice the winner collects for the counters left undialed. */
  amount: number;
}>;

/** The defeated player's pre-settlement choice between legal physical readings
 * of a single revealed dial. */
export type JacurutuDialOffer = Readonly<{
  event: string;
  /** The defeated player, who owns the physical allocation of their own dial. */
  owner: string;
  winner: string;
  choices: readonly JacurutuDialChoice[];
}>;

export type JacurutuBattleIncomeQuote =
  | Readonly<{
      kind: 'income';
      winner: string;
      opponent: string;
      amount: number;
      sentToTanks: JacurutuTankLosses;
      dialed: readonly Casualties[];
    }>
  | Readonly<{
      kind: 'allocationRequired';
      winner: string;
      opponent: string;
      sentToTanks: JacurutuTankLosses;
      choices: readonly JacurutuDialChoice[];
    }>;

export type JacurutuBattleIncomeInput = Readonly<{
  territory: string;
  jacurutuRevealed: boolean;
  winner: string | null;
  opponent: string | null;
  opponentForces: CombatForces | null;
  opponentDial: number | null;
  opponentSupport: number | null;
  /** Actual opposing counters destroyed by this battle, after any future
   * withdrawal or other non-Tanks movement has been removed from the pool. */
  sentToTanks: JacurutuTankLosses | null;
  /** The defeated player's own physical allocation for the revealed dial, once
   * they have selected one. Absent while the automatic single reading, or a
   * saved choice, remains pending. */
  selectedDial?: Casualties | null;
}>;

export class JacurutuBattleIncomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JacurutuBattleIncomeError';
  }
}

function whole(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Quotes the automatic bank income from exact settled-battle evidence.
 *
 * A numeric Battle Wheel dial is not a physical counter count in Advanced
 * combat. When different legal ordinary/elite dial allocations would change
 * the income, the quote preserves those choices instead of inventing one. A
 * supplied `selectedDial` must equal one offered reading exactly, including its
 * paid support split: the same counters with a different paid distribution
 * describe a different committed strength.
 */
export function quoteJacurutuBattleIncome(
  input: JacurutuBattleIncomeInput,
): JacurutuBattleIncomeQuote | null {
  if (
    input.territory !== JACURUTU_SIETCH ||
    !input.jacurutuRevealed ||
    input.winner === null
  )
    return null;
  const forces = input.opponentForces;
  const sent = input.sentToTanks;
  if (
    !input.opponent ||
    input.opponent === input.winner ||
    !forces ||
    !validCombatForces(forces) ||
    input.opponentDial === null ||
    input.opponentSupport === null ||
    !sent ||
    !whole(sent.normal) ||
    !whole(sent.elite) ||
    sent.normal > forces.normal ||
    sent.elite > forces.elite
  )
    throw new JacurutuBattleIncomeError(
      'Jacurutu income needs the opposing plan and exact forces sent to the Tanks.',
    );
  const eligible = casualtyOptions(
    forces,
    input.opponentDial,
    input.opponentSupport,
  );
  if (!eligible.length)
    throw new JacurutuBattleIncomeError(
      'Jacurutu income has no physical dial allocation matching the opposing plan.',
    );
  const selected = input.selectedDial;
  if (selected != null) {
    // All four canonical fields must match one offered reading: the same
    // ordinary/elite counters with the same paid support describe a different
    // committed strength than a different paid distribution of those counters.
    const match = eligible.find(
      (choice) =>
        choice.normal === selected.normal &&
        choice.elite === selected.elite &&
        choice.paidNormal === selected.paidNormal &&
        choice.paidElite === selected.paidElite,
    );
    if (!match)
      throw new JacurutuBattleIncomeError(
        'The chosen Jacurutu dial allocation is not a legal physical allocation of the opposing revealed forces, dial and support.',
      );
    if (match.normal > sent.normal || match.elite > sent.elite)
      throw new JacurutuBattleIncomeError(
        'The chosen Jacurutu dial allocation exceeds the opposing counters actually sent to the Tanks.',
      );
    return {
      kind: 'income',
      winner: input.winner,
      opponent: input.opponent,
      amount: sent.normal + sent.elite - match.normal - match.elite,
      sentToTanks: { ...sent },
      dialed: [{ ...match }],
    };
  }
  const dialed = eligible.filter(
    (choice) => choice.normal <= sent.normal && choice.elite <= sent.elite,
  );
  if (!dialed.length)
    throw new JacurutuBattleIncomeError(
      'Jacurutu income has no physical dial allocation matching the settled Tanks losses.',
    );
  const choices = dialed.map((choice) => ({
    dialed: { ...choice },
    amount: sent.normal + sent.elite - choice.normal - choice.elite,
  }));
  const amounts = new Set(choices.map((choice) => choice.amount));
  if (amounts.size > 1)
    return {
      kind: 'allocationRequired',
      winner: input.winner,
      opponent: input.opponent,
      sentToTanks: { ...sent },
      choices,
    };
  return {
    kind: 'income',
    winner: input.winner,
    opponent: input.opponent,
    amount: choices[0].amount,
    sentToTanks: { ...sent },
    dialed: choices.map((choice) => choice.dialed),
  };
}

/** Resolves the canonical saved choice index to its exact physical allocation. */
export function jacurutuDialSelection(
  offer: JacurutuDialOffer,
  allocation: number,
): Casualties | null {
  if (!Number.isSafeInteger(allocation) || allocation < 0) return null;
  const choice = offer.choices[allocation];
  return choice ? { ...choice.dialed } : null;
}
