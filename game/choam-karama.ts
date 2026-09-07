import type { Game, Player } from './engine';
import { retentionReservesCard } from './moritani-retention';
/** Only cards not already fixed into a battle may be converted into spice. */
export function cashInCards(
  g: Pick<Game, 'battle' | 'moritaniRetention'>,
  p: Pick<Player, 'id' | 'hand'>,
) {
  const plan = g.battle?.plans[p.id];
  const insight = g.battle?.prescience;
  return p.hand.filter(
    (c) =>
      !retentionReservesCard(g, p.id, c.id) &&
      (!plan || ![plan.weapon, plan.defense, plan.leader].includes(c.id)) &&
      (!insight || insight.player === p.id || insight.value !== c.id),
  );
}
