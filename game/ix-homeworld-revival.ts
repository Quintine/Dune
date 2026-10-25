import type { Game } from './engine';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

type IxHomeworldContext = Pick<Game, 'advanced' | 'players' | 'homeworlds'>;
export type IxSuboidBonusInput = {
  enabled: boolean;
  amount: number;
  elite: number;
  free: number;
  freeElite: number;
  normalTanks: number;
};

export class IxHomeworldRevivalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IxHomeworldRevivalError';
  }
}

/** Printed native High benefit in either rules band. Actual revival timing,
 * cost and eligibility belong to the original revival quote. */
export function ixHomeworldRevivalEnabled(context: IxHomeworldContext, playerId: string): boolean {
  if (!context.homeworlds?.custody ||
    !context.players.some(player => player.id === playerId && player.faction === 'ixians')) return false;
  return homeworldPopulations(homeworldContext(context), context.homeworlds.custody)
    .some(home => home.native === playerId && home.card === 'ix' && home.side === 'high');
}

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Additional physical Suboids for paid Cyborgs, after reserving every ordinary
 * Suboid in the declared group. A shortage reduces only this bonus. */
export function quoteIxSuboidBonus(input: IxSuboidBonusInput): number {
  const { enabled, amount, elite, free, freeElite, normalTanks } = input;
  if (typeof enabled !== 'boolean' ||
    ![amount, elite, free, freeElite, normalTanks].every(count) ||
    amount < 1 || amount > 20 || elite > amount || free > amount ||
    freeElite > elite || freeElite > free || free - freeElite > amount - elite ||
    normalTanks < amount - elite)
    throw new IxHomeworldRevivalError('Choose valid physical revival counts, free counter types and available Suboids.');
  return enabled ? Math.min(2 * (elite - freeElite), normalTanks - (amount - elite)) : 0;
}
