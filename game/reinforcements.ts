import type { Card } from './cards';
import { ecazTreacheryDefinition } from './ecaz-cards';

export const REINFORCEMENTS_CARD = 'ecaz-reinforcements' as const;

export class ReinforcementsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReinforcementsError';
  }
}

/** A matching id alone does not establish the physical variant card's identity. */
export function isReinforcements(card: Card | undefined): boolean {
  return !!card && card.id === REINFORCEMENTS_CARD &&
    Object.keys(card).sort().join(',') === 'effect,id,kind,name' &&
    ecazTreacheryDefinition(card)?.card.effect === 'reinforcements';
}

/** Spend exactly three own reserve counters, ordinary before elite; never dial them. */
export function quoteReinforcements(
  normalReserves: number,
  eliteReserves: number,
): { normal: number; elite: number; bonus: 2 } {
  if (![normalReserves, eliteReserves].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0))
    throw new ReinforcementsError('Reinforcements needs valid nonnegative reserve counts.');
  if (normalReserves < 3 && eliteReserves < 3 - normalReserves)
    throw new ReinforcementsError('Reinforcements needs at least three own forces in reserves.');
  const normal = Math.min(3, normalReserves);
  return { normal, elite: 3 - normal, bonus: 2 };
}
