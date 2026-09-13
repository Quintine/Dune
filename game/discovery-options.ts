import type { Action, GameView } from './engine';

/** Human and AI choices use only the requesting seat's quoted physical tokens. */
export function discoveryAction(game: GameView, token: string, reveal: boolean): Action | null {
  const offer = game.discoveries;
  if (!offer || offer.blocked || game.status !== 'playing' || game.phase !== 7 ||
    game.automaticContinuationPending || game.truthtrance || game.response || game.decision ||
    typeof reveal !== 'boolean' ||
    !(reveal ? offer.canReveal : offer.canInspect).some(id => id === token)) return null;
  return { type: 'discovery', token, reveal };
}

/** The stash has already drawn its card. Any card in this seat's hand may leave. */
export function discoveryDiscardAction(game: GameView, card: string): Action | null {
  const decision = game.decision;
  if (game.status !== 'playing' || decision?.kind !== 'discoveryDiscard' ||
    decision.player !== game.me || game.truthtrance || game.response ||
    game.automaticContinuationPending ||
    !game.players.find(player => player.id === game.me)?.hand?.some(held => held.id === card)) return null;
  return { type: 'decision', event: decision.event, card };
}

/** Inspect first, then reconsider the newly visible face through a fresh view. */
export function discoveryBotActions(game: GameView): Action[] {
  if (game.decision?.kind === 'discoveryDiscard') {
    const hand = game.players.find(player => player.id === game.me)?.hand ?? [];
    return [...hand]
      .sort((a, b) => Number(b.kind === 'worthless') - Number(a.kind === 'worthless'))
      .flatMap(card => {
        const action = discoveryDiscardAction(game, card.id);
        return action ? [action] : [];
      });
  }
  const offer = game.discoveries;
  if (!offer) return [];
  return [
    ...offer.canInspect.map(token => discoveryAction(game, token, false)),
    ...offer.canReveal.map(token => discoveryAction(game, token, true)),
  ].filter((action): action is Action => action !== null);
}
