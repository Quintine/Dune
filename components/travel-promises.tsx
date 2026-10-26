'use client';

import type { Action, GameView } from '@/game/engine';
import { nativePromiseScopeSupported } from '@/game/native-promise-scope';
import { truthQuestionText, type TruthAnswer } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { Button } from './ui/button';

type TravelProps = { game: GameView; busy: boolean; act: (action: Action) => void };

/** Forward the exact current native packet without choosing a branch or route. */
export function TravelPromiseGuideButton(props: TravelProps) {
  const game = props.game, guide = game.travelPromiseGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, event = guide.event, action = guide.action;
  const signature = JSON.stringify(action);
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    const paidBox = action.type === 'decision' && current.decision?.kind === 'nullentropy' &&
      current.decision.player === actor && !!current.nullentropy?.search &&
      current.nullentropy.search.event === action.event && !current.nullentropy.blocked;
    const opportunity = paidBox || action.type === 'guildShip' && action.from === 'reserves' ||
      ['ship', 'move', 'endMovement', 'card', 'prepareAdvisors', 'revealNoField'].includes(action.type);
    return !props.busy && current === game && nativePromiseScopeSupported(current) && current.status === 'playing' &&
      phase === 5 && current.phase === phase && current.turn === turn && current.me === actor && current.active === actor &&
      current.travelPromiseGuide === guide && guide.event === event && guide.action === action &&
      action.travelPromiseEvent === event && JSON.stringify(action) === signature && opportunity &&
      current.travelPromises.some(promise => promise.event === event && promise.player === actor && promise.turn === turn &&
        !promise.fulfilled && !promise.released) &&
      !!me && !me.autopilot && !current.truthtrance && !current.response && (!current.decision || paidBox) &&
      !current.phaseOpening && !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const amount = action.forces && typeof action.forces === 'object'
    ? Object.values(action.forces as Record<string, number>).reduce((sum, count) => sum + count, 0)
    : typeof action.amount === 'number' ? action.amount : 0;
  const destination = game.combatLocations.find(location => location.id === action.territory)?.name ?? 'the quoted destination';
  const sector = typeof action.sector === 'number' ? `, sector ${action.sector}` : '';
  const label = action.type === 'ship' || action.type === 'guildShip' ? `Ship ${amount} physical forces from reserves to ${destination}${sector}${action.type === 'guildShip' ? ' using Guild transport' : ''} while honoring your whole answer`
    : action.type === 'move' ? `Move ${amount} physical forces to ${destination}${sector} while honoring your whole answer`
    : action.type === 'endMovement' ? 'Finish movement while honoring your whole answer'
    : action.type === 'decision' ? 'Complete your paid Box search for your whole answer'
    : action.type === 'prepareAdvisors' ? `Prepare advisors in ${destination} for your whole answer`
    : action.type === 'revealNoField' ? 'Reveal your No-Field to prepare physical forces for your whole answer'
    : 'Use the offered native card preparation for your whole answer';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="travel-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.act(action); }}>{label}</Button>;
}

/** Retain own raw history, never a compiled branch or individual factual answer. */
export function TravelPromises(props: TravelProps) {
  const game = props.game, own = game.travelPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance shipment and movement promises" id="travel-promise-guidance">
    <h3>Your shipment and movement promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'travel', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding until your Movement turn ends this round.'}
    </li>)}</ul>
    <p>AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.
      Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.</p>
    <p className="fine">Shipment conditions concern one future original reserve shipment after the answer.
      Ground-movement conditions count the maximum physical forces in one actual future move, never the sum of smaller moves.
      Earlier actions do not count. A shipment can prepare a move; each action counts only for its own conditions.
      Original shipment rights, movement opportunities, cards, preparation and costs still apply.
      This claim grants no extra shipment or movement.</p>
    {live && game.active !== game.me && <p>Your Movement turn is still ahead. Keep the needed forces, spice and cards available;
      native controls appear on your turn.</p>}
    {live && <TravelPromiseGuideButton {...props} />}
  </section>;
}

/** One whole answer, using only the current target's offered native choices. */
export function TravelAnswers(props: TravelProps) {
  const game = props.game, window = game.truthtrance, question = window?.question;
  if (window?.stage !== 'answer' || question?.kind !== 'travel' || question.target !== game.me || !game.truthTravelAnswers) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, source = window.queue[0], answers = game.truthTravelAnswers;
  const signature = JSON.stringify(question), sourceSignature = JSON.stringify(source);
  const canAnswer = (answer: TruthAnswer) => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    return !props.busy && current === game && current.status === 'playing' && phase === 5 && current.phase === phase &&
      current.turn === turn && current.me === actor && question.turn === turn &&
      current.truthtrance === window && window.stage === 'answer' && window.question === question && question.target === actor &&
      JSON.stringify(question) === signature && !!source && window.queue[0] === source && JSON.stringify(source) === sourceSignature &&
      current.truthTravelAnswers === answers && answers.includes(answer) &&
      !!me && !me.autopilot && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <section aria-label="Answer the whole shipment and movement question" className="space-y-3">
    <p className="notice">Answer the whole shipment and ground-movement expression. Current facts freeze now.
      OR preserves legal alternatives; No keeps the whole expression false.
      Only a future original reserve shipment and actual future ground moves count, with physical forces in one action.
      Original rights, preparation and costs still apply. Only your whole answer is shared.</p>
    {answers.map(answer => {
      const action: Action = { type: 'truthAnswer', answer };
      return <Button key={answer} className="game-action min-h-11 whitespace-normal" data-travel-answer={answer}
        disabled={!canAnswer(answer)} onClick={() => { if (canAnswer(answer)) props.act(action); }}>
        {answer === 'unknown' ? 'I don’t know yet' : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`}
      </Button>;
    })}
  </section>;
}
