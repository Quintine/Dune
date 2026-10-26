'use client';

import type { Action, GameView } from '@/game/engine';
import { liveMovementExpressionPromises, movementExpressionTerritories, movementExpressionText } from '@/game/movement-expression-promises';
import { liveMovementPromises } from '@/game/movement-promises';
import { nativePromiseScopeSupported } from '@/game/native-promise-scope';
import { Button } from './ui/button';

type MovementExpressionPromiseProps = { game: GameView; busy: boolean; send: (action: Action) => void };
const destinationName = (game: GameView, id: string) => game.combatLocations.find(location => location.id === id)?.name ?? id;

/** Forward one exact native quote. This guide does not choose a future branch
 * or reconstruct physical forces, card entitlement or payment legality. */
export function MovementExpressionPromiseGuideButton(props: MovementExpressionPromiseProps) {
  const game = props.game, guide = game.movementExpressionPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = guide.phase, action = guide.action;
  const event = action.movementExpressionPromiseEvent, signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === current.me);
    const paidBox = action.type === 'decision' && current.decision?.kind === 'nullentropy' &&
      current.decision.player === actor && !!current.nullentropy?.search &&
      current.nullentropy.search.event === action.event && !current.nullentropy.blocked;
    const payment = phase === 3 && action.type === 'decision' &&
      current.decision?.kind === 'auctionPayment' && current.decision.player === actor;
    const native = current.richeseAuction;
    const nativePass = phase === 3 && action.type === 'richeseBid' && native &&
      native.event === action.event && !native.outcome && native.eligible.includes(actor) &&
      (native.method === 'silent' ? !native.submitted.includes(actor) && action.amount === 0
        : native.active === actor && action.amount === null) && action.allyPayment === 0;
    const revivalOrder = current.revivalOrder;
    const opportunity = paidBox || (phase === 2
      ? !current.ready.includes(actor) && (action.type === 'charity' || action.type === 'ready')
      : phase === 3
        ? payment || nativePass || action.type === 'passBid' && !native && current.auction?.active === actor
        : phase === 4
          ? !current.ready.includes(actor) && (action.type === 'revive' || action.type === 'ready') &&
            (!revivalOrder || revivalOrder.turn === turn && revivalOrder.remaining[0] === actor && current.active === actor)
          : phase === 5 && current.active === actor &&
            ['move', 'ship', 'endMovement', 'card', 'prepareAdvisors', 'revealNoField'].includes(action.type));
    return !props.busy && current === game && nativePromiseScopeSupported(current) && current.status === 'playing' &&
      Number.isSafeInteger(phase) && phase >= 0 && phase <= 5 && current.phase === phase && current.turn === turn && current.me === actor &&
      current.movementExpressionPromiseGuide === guide && current.movementExpressionPromiseGuide.phase === phase &&
      current.movementExpressionPromiseGuide.action === action && JSON.stringify(action) === signature && opportunity &&
      typeof event === 'string' && liveMovementExpressionPromises(current.movementExpressionPromises, actor, turn).some(promise => promise.event === event) &&
      !!me && !me.autopilot && !current.truthtrance && !current.response && (!current.decision || paidBox || payment) &&
      !current.phaseOpening && !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const amount = action.forces && typeof action.forces === 'object'
    ? Object.values(action.forces as Record<string, number>).reduce((sum, count) => sum + count, 0)
    : typeof action.amount === 'number' ? action.amount : 0;
  const destination = typeof action.territory === 'string' ? destinationName(game, action.territory) : 'the chosen destination';
  const sector = typeof action.sector === 'number' ? action.sector : 0;
  // These already-projected own faces supply labels only, never eligibility.
  const card = (action.type === 'card' || action.type === 'decision')
    ? game.players.find(player => player.id === actor)?.hand?.find(card => card.id === action.card) : undefined;
  const recovered = action.type === 'decision' && game.decision?.kind === 'nullentropy'
    ? game.nullentropy?.search?.cards.find(card => card.id === action.card) : undefined;
  const payment = action.type === 'decision' && game.decision?.kind === 'auctionPayment';
  const label = payment ? action.karama === true ? `Use ${card?.name ?? 'your card'} for the current auction payment` : 'Pay the current auction price'
    : action.type === 'decision' ? `Choose ${recovered?.name ?? 'the required card'} in your paid Box search`
    : action.type === 'charity' ? 'Claim Charity for your later movement'
    : action.type === 'revive' ? `Revive ${amount} forces for your later movement`
    : action.type === 'ready' ? 'Finish this preparation phase while preserving your promises'
    : action.type === 'passBid' ? 'Pass this bid and preserve later movement'
    : action.type === 'richeseBid' ? action.amount === 0 ? 'Submit zero in this Silent auction and preserve later movement' : 'Pass this Richese bid and preserve later movement'
    : action.type === 'card' && action.mode === 'shipment' ? `Use ${card?.name ?? 'your card'} for Guild shipment rates`
    : action.type === 'card' && card?.effect === 'nullentropyBox' ? 'Pay 2 spice and search with Nullentropy Box'
    : action.type === 'card' && card?.effect === 'ghola' ? `Play Ghola to return ${amount} ${amount === 1 ? 'force' : 'forces'} to reserves for the required movement`
    : action.type === 'card' && action.mode === 'choam' ? 'Play Kulon to extend the required movement'
    : action.type === 'prepareAdvisors' ? `Prepare advisors in ${destination} for the required movement`
    : action.type === 'revealNoField' ? 'Reveal your No-Field to prepare physical forces for the required movement'
    : action.type === 'card' ? 'Play Hajr to prepare the required movement'
    : action.type === 'ship' && action.noField ? `Ship a concealed No-Field to ${destination}, sector ${sector}, before the required movement`
    : action.type === 'ship' ? `Ship ${amount} forces to ${destination}, sector ${sector}, before the required movement`
    : action.type === 'endMovement' ? 'Finish movement while honoring the whole expression'
    : action.noField && !amount ? `Move your concealed No-Field to ${destination}, sector ${sector}, to prepare the required movement`
    : action.noField ? `Move ${amount} physical forces with your No-Field to ${destination}, sector ${sector}`
    : `${action.movementCard ? 'Use Ornithopter and move' : 'Move'} ${amount} forces to ${destination}, sector ${sector}`;
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="movement-expression-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.send(action); }}>{label}</Button>;
}

export function MovementExpressionPromises(props: MovementExpressionPromiseProps) {
  const game = props.game, own = game.movementExpressionPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const live = liveMovementExpressionPromises(own, game.me, game.turn).length > 0;
  const waiting = live && (game.phase < 5 || game.phase === 5 && game.active !== game.me);
  return <section className="notice space-y-3" aria-label="Your Truthtrance movement expression promises" id="movement-expression-promise-guidance">
    <h3>Your movement expression promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {movementExpressionText(promise.claim)}.
      {' '}Largest future ground move to each destination: {movementExpressionTerritories(promise.claim).map(territory =>
        `${destinationName(game, territory)}: ${promise.progress.find(progress => progress.territory === territory)?.maximum ?? 0} physical forces`).join('; ')}.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This whole answer is binding until your Movement turn ends this round.'}
    </li>)}</ul>
    <p>
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.
      Each condition requires one actual future ground move of the named minimum after the answer.
      Smaller moves never add together; progress records the maximum in one move to each destination.
      Prior moves and shipments do not count. A shipment can prepare a move but does not fulfill a condition.
    </p>
    <p className="fine">
      Yes must be completed before your Movement turn ends this round. No remains binding through every later Hajr or Ornithopter move.
      Original movement, shipment, preparation, payment and turn rules still apply.
      A paid Box search must finish before moving; its fee is paid only once.
      Opposing effects release an answer only if it becomes impossible.
      {' '}<a href="/rules#truthtrance-movement-expression">Movement expression rules</a>.
    </p>
    {waiting && <p>Your Movement turn is still ahead. Keep the needed forces, spice and cards available; movement controls appear on your turn.
      {game.phase < 5 && ' Complete any current preparation below before confirming readiness.'}
      {game.decision?.kind === 'nullentropy' && game.decision.player === game.me && ' Your already-paid Box search can finish now.'}
    </p>}
    {!liveMovementPromises(game.movementPromises ?? [], game.me, game.turn).length && <MovementExpressionPromiseGuideButton {...props} />}
  </section>;
}
