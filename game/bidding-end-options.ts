import type { Card } from './cards';
import type { Action, GameView } from './engine';

/** These controls consume only the requesting seat's projected opportunity. */
export function biddingEndCanAct(g: GameView): boolean {
  return !!(
    g.status === 'playing' &&
    g.phase === 3 &&
    g.biddingEnd?.canAct &&
    g.biddingEnd.owners.includes(g.me) &&
    !g.decision &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending
  );
}

export function biddingEndDiscardChoice(g: GameView, selected: string[]) {
  const me = g.players.find((p) => p.id === g.me);
  const end = g.biddingEnd;
  const cost = selected.length * 2;
  let blocked: string | null = null;
  if (!biddingEndCanAct(g)) blocked = 'Wait for the current choice to finish.';
  else if (end?.kaitain?.owner !== g.me || !end.kaitain.eligible)
    blocked = 'Paid discards require high-population Kaitain.';
  else if (!selected.length) blocked = 'Choose at least one card to discard.';
  else if (
    new Set(selected).size !== selected.length ||
    selected.some((id) => !me?.hand?.some((card) => card.id === id))
  )
    blocked = 'Choose cards that are still in your hand.';
  else if (cost > (me?.spice ?? 0))
    blocked = `You need ${cost} spice to discard these cards.`;
  return {
    cost,
    blocked,
    action: blocked
      ? null
      : ({
          type: 'biddingEnd',
          event: end!.event,
          mode: 'discard',
          cards: selected,
        } as Action),
  };
}

/** The same CHOAM policy is used by the ordinary and shared market windows. */
export function choamMarketPolicy(
  g: GameView,
  value: (card: Card) => number,
  preserve?: unknown,
): Action {
  const market = g.choamMarket!;
  const me = g.players.find((p) => p.id === g.me)!;
  const sales = market.sales?.filter((sale) => sale.card !== preserve);
  const sale = sales?.find((candidate) => candidate.price === 3) ?? sales?.[0];
  if (sale)
    return {
      type: 'decision',
      mode: 'sell',
      card: sale.card,
      witness: sale.witness,
    };
  const offerable = me.hand?.filter((card) => card.id !== preserve) ?? [];
  if (market.canTrade && !market.tradeAttempted && offerable.length) {
    const offered = [...offerable].sort((a, b) => value(a) - value(b))[0];
    return { type: 'decision', mode: 'trade', card: offered.id };
  }
  return { type: 'decision', done: true };
}

export function biddingEndActions(
  g: GameView,
  level: number,
  value: (card: Card) => number,
  preserve?: unknown,
): Action[] {
  if (!biddingEndCanAct(g)) return [];
  const end = g.biddingEnd!;
  const me = g.players.find((p) => p.id === g.me)!;
  if (!(me.bot ?? me.autopilot)) return [];
  if (end.kaitain?.owner === g.me && end.kaitain.eligible) {
    // Preserve a shipment/revival budget. Emptying a useful hand merely to pay
    // for new cards next turn is not beneficial, including for the Easy bot.
    const budget = Math.max(0, (me.spice ?? 0) - [2, 3, 4, 4][level]);
    const unwanted = (me.hand ?? [])
      .filter((card) => card.kind === 'worthless' && card.id !== preserve)
      .slice(0, Math.floor(budget / 2));
    if (unwanted.length) {
      const choice = biddingEndDiscardChoice(
        g,
        unwanted.map((card) => card.id),
      );
      if (choice.action) return [choice.action];
    }
  }
  if (g.choamMarket?.owner === g.me) {
    const action = choamMarketPolicy(g, value, preserve);
    if (!action.done)
      return [{ ...action, type: 'biddingEnd', event: end.event }];
  }
  return end.ready.includes(g.me)
    ? []
    : [{ type: 'biddingEnd', event: end.event, mode: 'ready' }];
}
