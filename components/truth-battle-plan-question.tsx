'use client';

import type { Action, GameView } from '@/game/engine';
import { parsePlanClaim, type PlanClaim } from '@/game/battle-promises';
import { battleClaimExpressionError } from '@/game/battle-claim-expression';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { truthQuestionText, type TruthQuestion } from '@/game/truthtrance';
import { BattleClaimExpressionFields } from './battle-claim-expression-fields';
import { Button } from './ui/button';

/** Authoring uses public identities; the server determines feasible promises. */
export function TruthBattlePlanQuestion({ game, question, busy, act, onChange }: {
  game: GameView;
  question: Extract<TruthQuestion, { kind: 'battlePlan' }>;
  busy: boolean;
  act: (action: Action) => void;
  onChange: (claim: PlanClaim) => void;
}) {
  const ownsQuestion = () => !!game.me && game.players.some(player => player.id === game.me) &&
    game.truthtrance?.stage === 'ask' && game.truthtrance.queue[0]?.player === game.me;
  const hasTarget = () => question.target !== game.me && game.players.some(player => player.id === question.target) &&
    !!game.battle && [game.battle.attacker, game.battle.defender].includes(question.target) &&
    question.territory === game.battle.territory;
  const inputError = () => {
    const structureError = battleClaimExpressionError(question.claim);
    if (structureError) return structureError;
    try {
      parsePlanClaim(question.claim, game.allLeaders.map(leader => leader.id));
      return null;
    } catch {
      return 'Resolve the battle-plan fields before asking.';
    }
  };
  const blocked = () => busy || !ownsQuestion() || !hasTarget() || !!inputError();
  const error = inputError();
  return <>
    {hasTarget() ? <BattleClaimExpressionFields value={question.claim} game={game}
      disabled={busy || !ownsQuestion() || !hasTarget()} onChange={next => {
        if (!busy && ownsQuestion() && hasTarget() && !battleClaimExpressionError(next)) onChange(next);
      }} /> : <p className="notice">Choose another seated combatant in the current battle.</p>}
    <blockquote data-testid="truth-battle-plan-preview">
      {truthQuestionText(question,
        id => id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
        id => game.combatLocations.find(location => location.id === id)?.name ?? id)}
    </blockquote>
    {error && <p className="notice" role="alert">{error}</p>}
    <Button className="game-action" data-testid="truth-battle-plan-ask" disabled={blocked()}
      onClick={() => { if (!blocked()) act({ type: 'truthAsk', question }); }}>
      Ask publicly
    </Button>
  </>;
}
