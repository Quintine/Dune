'use client';

import type { Action, GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import type { MovementClaim } from '@/game/movement-promises';
import { liveMovementPromises } from '@/game/movement-promises';
import { liveMovementExpressionPromises } from '@/game/movement-expression-promises';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { MovementExpressionPromiseGuideButton } from './movement-expression-promises';

const destinationName = (game: GameView, id: string) => game.combatLocations.find(location => location.id === id)?.name ?? id;
function destinations(mixed: MixedActionExpression<MovementClaim>): string[] {
  const found = new Set<string>();
  const visit = (node: MixedActionExpression<MovementClaim>): void => {
    if (node.kind === 'action') found.add(node.action.territory);
    else if (node.kind === 'and' || node.kind === 'or') node.terms.forEach(visit);
  };
  visit(mixed);
  return [...found];
}

/** Display only the original question, aggregate answer and physical progress.
 * No current-fact evaluation or reduced future branch is projected or inferred. */
export function MixedMovementPromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.mixedMovementPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  const waiting = live && (game.phase < 5 || game.phase === 5 && game.active !== game.me);
  const sharedGuideElsewhere = liveMovementPromises(game.movementPromises ?? [], game.me, game.turn).length > 0 ||
    liveMovementExpressionPromises(game.movementExpressionPromises, game.me, game.turn).length > 0;
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed movement promises" id="mixed-movement-promise-guidance">
    <h3>Your mixed movement promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedMovement', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => destinationName(game, id), id => game.players.find(player => player.id === id)?.name ?? id)}
      {' '}Largest future ground move to each named destination: {destinations(promise.mixed).map(territory =>
        `${destinationName(game, territory)}: ${promise.progress.find(progress => progress.territory === territory)?.maximum ?? 0} physical forces`).join('; ')}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding until your Movement turn ends this round.'}
    </li>)}</ul>
    <p>Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.</p>
    <p className="fine">Future movement progress records the maximum physical forces in one actual move after the answer, never the sum of smaller moves.
      Prior moves and shipments do not count. A shipment can prepare a move but does not fulfill a movement condition.
      The original movement, shipment, preparation, payment and turn rules still apply; this claim grants no extra movement opportunity.
      A paid Box search must finish before moving; its fee is paid only once.
      {' '}<a href="/rules#truthtrance-mixed-movement">Mixed movement rules</a>.</p>
    {waiting && <p>Your Movement turn is still ahead. Keep any needed forces, spice and cards available; movement controls appear on your turn.
      {game.phase < 5 && ' Complete any current preparation below before confirming readiness.'}
      {game.decision?.kind === 'nullentropy' && game.decision.player === game.me && ' Your already-paid Box search can finish now.'}
    </p>}
    {live && !sharedGuideElsewhere && <MovementExpressionPromiseGuideButton {...props} />}
  </section>;
}
