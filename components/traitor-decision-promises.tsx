'use client';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function TraitorDecisionAnswers(props: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const { game, act } = props, window = game.truthtrance, question = window?.question, battle = game.battle;
  if (window?.stage !== 'answer' || (question?.kind !== 'traitorCall' && question?.kind !== 'mixedTraitorCall') ||
    question.target !== game.me || !battle?.revealed || question.battle !== battle.event || question.territory !== battle.territory) return null;
  const mixed = question.kind === 'mixedTraitorCall';
  const answers = mixed ? game.truthMixedTraitorAnswers : game.truthTraitorAnswers;
  const actor = game.me, turn = game.turn, event = battle.event, territory = battle.territory;
  const source = window.queue[0], sourceSignature = JSON.stringify(source), signature = JSON.stringify(question);
  const canAnswer = (answer: 'yes' | 'no' | 'unknown') => !props.busy && props.game === game && props.act === act &&
    game.me === actor && game.turn === turn && game.truthtrance === window && window.stage === 'answer' &&
    window.queue[0] === source && JSON.stringify(source) === sourceSignature &&
    window.question === question && question.target === actor && JSON.stringify(question) === signature &&
    game.battle === battle && battle.revealed && battle.event === event && battle.territory === territory &&
    question.battle === event && question.territory === territory && battle.traitorVoters.includes(actor) &&
    !battle.traitorSubmitted.includes(actor) &&
    (mixed ? game.truthMixedTraitorAnswers : game.truthTraitorAnswers) === answers && !!answers?.includes(answer);
  return <section aria-label="Your Truthtrance Traitor answer">
    {mixed ? <p className="notice">Answer the whole mixed claim. Current facts are snapshotted at the answer; No makes the whole expression false, not each condition separately.
      A constant whole answer needs no declaration commitment. A remaining commitment concerns your original Reveal or decline declaration,
      so a later Karama or betrayal response can still prevent its effect.</p>
      : <p className="notice">Yes binds Reveal for this original Traitor decision; No binds decline. This concerns your declaration, so a later Karama or betrayal response can still prevent its effect.</p>}
    {(answers ?? []).map(answer => <Button key={answer} className="game-action min-h-11" disabled={!canAnswer(answer)}
      onClick={() => { if (canAnswer(answer)) act({ type: 'truthAnswer', answer }); }}>Answer {answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'I don’t know'}</Button>)}
  </section>;
}

export function TraitorDecisionPromises({ game }: { game: GameView }) {
  const promises = game.battle?.ownTraitorPromises?.filter(promise => !promise.fulfilled && !promise.released) ?? [];
  if (!promises.length) return null;
  return <section className="notice" aria-label="Your Traitor declaration promise">
    <p>Your Truthtrance answer requires {promises[0].answer ? 'Reveal traitor' : 'No traitor'} for this battle.</p>
    <p className="fine">The original declaration fulfills your answer. Later Karama or betrayal prevention can still change its effect.</p>
  </section>;
}
