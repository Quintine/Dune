'use client';

import type { Action, GameView } from '@/game/engine';
import { truthFactExpressionError } from '@/game/truth-fact-expression';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { truthQuestionText, type TruthFact, type TruthQuestion } from '@/game/truthtrance';
import { invalidTruthFact } from './mixed-shipment-fields';
import { TruthFactExpressionFields } from './truth-fact-expression-fields';
import { Button } from './ui/button';

/** Current-fact authoring uses only the caller's entitled public projection. */
export function TruthFactQuestion({ game, question, busy, act, onChange }: {
  game: GameView;
  question: Extract<TruthQuestion, { kind: 'fact' }>;
  busy: boolean;
  act: (action: Action) => void;
  onChange: (fact: TruthFact) => void;
}) {
  const ownsQuestion = () => !!game.me && game.players.some(player => player.id === game.me) &&
    game.truthtrance?.stage === 'ask' && game.truthtrance.queue[0]?.player === game.me;
  const hasTarget = () => question.target !== game.me && game.players.some(player => player.id === question.target);
  const inputError = () => truthFactExpressionError(question.fact) ||
    (hasTarget() && invalidTruthFact(question.fact, game, question.target)
      ? 'Resolve the marked current-fact fields before asking.' : null);
  const blocked = () => busy || !ownsQuestion() || !hasTarget() || !!inputError();
  const error = inputError();
  return <>
    {hasTarget() ? <TruthFactExpressionFields value={question.fact} game={game} target={question.target}
      disabled={busy || !ownsQuestion() || !hasTarget()} onChange={next => {
        if (!busy && ownsQuestion() && hasTarget() && !truthFactExpressionError(next)) onChange(next);
      }} /> : <p className="notice">Choose another seated player for this question.</p>}
    <blockquote data-testid="truth-fact-preview">
      {truthQuestionText(question,
        id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
        id => game.combatLocations.find(location => location.id === id)?.name ?? id)}
    </blockquote>
    {error && <p className="notice" role="alert">{error}</p>}
    <Button className="game-action" data-testid="truth-fact-ask" disabled={blocked()}
      onClick={() => { if (!blocked()) act({ type: 'truthAsk', question }); }}>
      Ask publicly
    </Button>
  </>;
}
