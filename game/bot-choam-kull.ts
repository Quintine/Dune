import type { Action, GameView } from './engine';

/** Legal participation uses only this seat's projected offer and public allies. */
export function botChoamKullActions(g: GameView): Action[] {
  const offer = g.kullReaction;
  if (g.status !== 'playing' || !offer?.event || offer.player !== g.me ||
      !offer.canDecline) return [];
  const own = g.players.find((player) => player.id === g.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  const play = !offer.blocked && offer.target !== own.ally
    ? offer.plays.find((candidate) => !candidate.blocked)
    : undefined;
  return play
    ? [{
        type: 'kullDecision', event: offer.event,
        source: play.source, card: play.card.id,
      }]
    : [{ type: 'kullDecision', event: offer.event, decline: true }];
}

/** Kull's counter is an ordinary response: never reuse the reserved attempt or
 * propose voluntary actions while the public prevention is being settled. */
export function botChoamKullCounterActions(g: GameView): Action[] {
  if (g.status !== 'playing' || !g.kullCounterEvent || !g.response ||
      g.responseControls?.hasPassed) return [];
  const own = g.players.find((player) => player.id === g.me);
  if (!(own?.bot ?? own?.autopilot)) return [];
  const card = own.hand?.find((candidate) =>
    g.responseControls?.cancelCards.includes(candidate.id),
  );
  if (!card) return [];
  const protect = g.response.kind === 'choamWorthless' &&
    g.response.intent === 'Kull Wahad' &&
    (g.response.recipient === own.id || g.response.recipient === own.ally);
  return protect
    ? [{ type: 'card', mode: 'cancel', card: card.id }]
    : [{ type: 'passResponse' }];
}
