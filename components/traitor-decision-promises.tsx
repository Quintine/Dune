'use client';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function TraitorDecisionAnswers({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  if (game.truthtrance?.stage !== 'answer' || game.truthtrance.question?.kind !== 'traitorCall' ||
    game.truthtrance.question.target !== game.me) return null;
  return <section aria-label="Your Truthtrance Traitor answer">
    <p className="notice">Yes binds Reveal for this original Traitor decision; No binds decline. This concerns your declaration, so a later Karama or betrayal response can still prevent its effect.</p>
    {(game.truthTraitorAnswers ?? []).map(answer => <Button key={answer} className="game-action min-h-11" disabled={busy}
      onClick={() => { if (!busy) act({ type: 'truthAnswer', answer }); }}>Answer {answer === 'yes' ? 'Yes' : 'No'}</Button>)}
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
