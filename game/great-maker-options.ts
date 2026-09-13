import type { Action, GameView } from './engine';

export function greatMakerRideAction(
  game: GameView,
  territory: string,
  sector: number,
  amount: number,
  elite: number,
): Action | null {
  const d = game.decision,
    offer = game.greatMaker?.ride;
  if (
    d?.kind !== 'greatMakerRide' ||
    d.player !== game.me ||
    !offer ||
    game.truthtrance ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > offer.max ||
    !Number.isSafeInteger(elite) ||
    elite < Math.max(0, amount - (offer.max - offer.eliteMax)) ||
    elite > Math.min(amount, offer.eliteMax) ||
    !offer.destinations.some(
      (to) => to.territory === territory && to.sector === sector,
    )
  )
    return null;
  return {
    type: 'decision',
    event: d.event,
    accept: true,
    territory,
    sector,
    amount,
    elite,
  };
}
export function greatMakerBotActions(game: GameView): Action[] {
  const d = game.decision;
  if (!d || d.player !== game.me || game.truthtrance) return [];
  if (d.kind === 'greatMakerVote')
    return [
      {
        type: 'decision',
        event: d.event,
        yes: !game.players.find((p) => p.id === game.me)?.ally,
      },
    ];
  if (d.kind !== 'greatMakerRide') return [];
  const offer = game.greatMaker?.ride,
    to = offer?.destinations.find((to) => to.territory !== 'polar_sink');
  const actions: Action[] = [];
  if (offer && to) {
    const amount = Math.min(5, offer.max),
      elite = Math.min(amount, offer.eliteMax);
    const action = greatMakerRideAction(
      game,
      to.territory,
      to.sector,
      amount,
      elite,
    );
    if (action) actions.push(action);
  }
  return [...actions, { type: 'decision', event: d.event, accept: false }];
}
