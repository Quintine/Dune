import type { Game, Player } from './engine';
import { retentionReservesCard } from './moritani-retention';
import { committedPlanElements } from './battle-inspections';
/** Only cards not already fixed into a battle may be converted into spice. */
export function cashInCards(
  g: Pick<Game, 'battle' | 'moritaniRetention' | 'pendingWinnerDiscards'>,
  p: Pick<Player, 'id' | 'hand'>,
) {
  const plan = g.battle?.plans[p.id];
  const commitments = g.battle ? committedPlanElements(g.battle, p.id) : [];
  return p.hand.filter(
    (c) =>
      !(
        g.pendingWinnerDiscards?.player === p.id &&
        [
          ...g.pendingWinnerDiscards.cards,
          ...g.pendingWinnerDiscards.optional,
        ].includes(c.id)
      ) &&
      !retentionReservesCard(g, p.id, c.id) &&
      (!plan || ![plan.weapon, plan.defense, plan.leader].includes(c.id)) &&
      !commitments.some((element) => element.value === c.id),
  );
}
