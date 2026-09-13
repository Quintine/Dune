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
      choices: readonly Readonly<{ dialed: Casualties; amount: number }>[];
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
 * the income, the quote preserves those choices instead of inventing one.
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
  const dialed = casualtyOptions(
    forces,
    input.opponentDial,
    input.opponentSupport,
  ).filter(
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
