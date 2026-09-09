import { HOMEWORLD_CARDS, type HomeworldId } from './homeworld-cards';
import type { FactionId } from './catalog';
import type { HomeworldForces } from './homeworld-custody';

/** The location adapter supplies the current face and exact native army.
 * Occupation timing belongs to that adapter, not to the battle calculator. */
export type HomeworldBattleRules = {
  native: string;
  card: HomeworldId;
  side: 'high' | 'low';
  nativeForces: HomeworldForces;
};
export type HomeworldExplosionLosses = {
  player: string;
  amount: number;
  options: HomeworldForces[];
};

export function quoteHomeworldBattleRules(
  location: string,
  participants: readonly { id: string; faction: FactionId }[],
  rules: HomeworldBattleRules,
) {
  const card = HOMEWORLD_CARDS.find((c) => c.id === rules?.card);
  const native = participants.find((p) => p.id === rules?.native);
  if (
    !card ||
    !native ||
    native.faction !== card.faction ||
    location !==
      `homeworld:${card.faction}${card.id === 'salusa_secundus' ? ':salusa' : ''}` ||
    !['high', 'low'].includes(rules.side) ||
    !rules.nativeForces ||
    typeof rules.nativeForces !== 'object' ||
    Array.isArray(rules.nativeForces) ||
    Object.keys(rules.nativeForces).length !== 2 ||
    !['normal', 'elite'].every((key) =>
      Object.hasOwn(rules.nativeForces, key),
    ) ||
    !Object.values(rules.nativeForces).every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    rules.nativeForces.normal + rules.nativeForces.elite > 20
  )
    throw new Error(
      'The Homeworld battle needs its seated native, canonical card face and physical native army.',
    );
  const strength = card[rules.side].battleStrength;
  const amount = Math.min(
    strength,
    rules.nativeForces.normal + rules.nativeForces.elite,
  );
  const options: HomeworldForces[] = [];
  for (
    let elite = Math.max(0, amount - rules.nativeForces.normal);
    elite <= Math.min(amount, rules.nativeForces.elite);
    elite++
  )
    options.push({ normal: amount - elite, elite });
  return {
    native: native.id,
    strength,
    explosion: { player: native.id, amount, options },
  };
}
