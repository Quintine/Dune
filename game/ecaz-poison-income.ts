import type { Card } from './cards';
import type { Game } from './engine';
import type { EffectiveWeapon } from './effective-weapons';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';
import { richeseCardDefinition } from './richese-cards';

export type EcazPoisonDiscard = {
  card: Card;
  /** The actual validated plan slot at disposal, not a possible card role. */
  battleSlot?: 'weapon' | 'defense' | 'leader';
  /** Retained validated copy result for a played Mirror, never a client claim. */
  effectiveWeapon?: EffectiveWeapon;
};
export class EcazPoisonIncomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcazPoisonIncomeError';
  }
}

/** Current native population only. The caller proves the physical discard and
 * pays the quote once; neither card custody nor balances are changed here.
 * Source composition and retained-role contract: ECAZ_POISON_INCOME_RULES.md. */
export function quoteEcazPoisonIncome(
  context: Pick<Game, 'advanced' | 'players' | 'homeworlds'>,
  discarded: readonly EcazPoisonDiscard[],
): { player: string; amount: number; count: number } | null {
  const ids = new Set<string>();
  for (const entry of discarded) {
    if (
      !entry?.card ||
      typeof entry.card.id !== 'string' ||
      !entry.card.id ||
      ids.has(entry.card.id) ||
      (entry.battleSlot !== undefined &&
        !['weapon', 'defense', 'leader'].includes(entry.battleSlot))
    )
      throw new EcazPoisonIncomeError(
        'Poison income needs distinct physical discards and valid original battle slots.',
      );
    ids.add(entry.card.id);
  }
  if (!context.homeworlds?.custody || !discarded.length) return null;
  const home = homeworldPopulations(
    homeworldContext(context),
    context.homeworlds.custody,
  ).find((candidate) => candidate.card === 'ecaz' && candidate.side === 'high');
  if (!home) return null;
  let count = 0;
  for (const { card, battleSlot, effectiveWeapon } of discarded) {
    const richese = richeseCardDefinition(card);
    if (richese?.card.effect === 'mirrorWeapon' && battleSlot === 'weapon') {
      if (
        !effectiveWeapon ||
        effectiveWeapon.physicalId !== card.id ||
        (effectiveWeapon.kind === null
          ? effectiveWeapon.copiedFrom !== null
          : typeof effectiveWeapon.copiedFrom !== 'string' ||
            !effectiveWeapon.copiedFrom ||
            effectiveWeapon.copiedFrom === card.id ||
            ![
              'projectile',
              'poison',
              'lasgun',
              'poisonBlade',
              'poisonTooth',
              'chemistry',
              'weirdingWay',
              'artillery',
              'stoneBurner',
            ].includes(effectiveWeapon.kind))
      )
        throw new EcazPoisonIncomeError(
          'The discarded Mirror needs its retained validated copied weapon role.',
        );
      if (
        ['poison', 'poisonBlade', 'poisonTooth', 'chemistry'].includes(
          effectiveWeapon.kind ?? '',
        )
      )
        count++;
      continue;
    }
    // Richese physical identities cannot become ordinary poison through a
    // forged kind or a name containing "Poison".
    if (richese || card.id.startsWith('richese-')) continue;
    if (
      card.kind === 'poison' ||
      card.kind === 'poisonBlade' ||
      card.kind === 'poisonTooth' ||
      (card.kind === 'chemistry' && battleSlot === 'weapon')
    )
      count++;
  }
  return count ? { player: home.native, amount: 3 * count, count } : null;
}
