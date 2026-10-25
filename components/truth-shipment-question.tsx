'use client';

import type { Action, GameView } from '@/game/engine';
import {
  parseShipmentExpression,
  ShipmentClaimError,
  shipmentExpressionOf,
  type ShipmentExpression,
} from '@/game/shipment-promises';
import { shipmentExpressionInputError } from '@/game/shipment-expression-input';
import { truthQuestionText, type TruthQuestion } from '@/game/truthtrance';
import { ShipmentExpressionFields } from './shipment-expression-fields';
import { Button } from './ui/button';

/** Public authoring only. Feasibility and answer choices stay authoritative. */
export function TruthShipmentQuestion({ game, question, busy, act, onChange }: {
  game: GameView;
  question: Extract<TruthQuestion, { kind: 'shipment' }>;
  busy: boolean;
  act: (action: Action) => void;
  onChange: (expression: ShipmentExpression) => void;
}) {
  const ownsQuestion = () => !!game.me && game.players.some(player => player.id === game.me) &&
    game.truthtrance?.stage === 'ask' && game.truthtrance.queue[0]?.player === game.me;
  const hasTarget = () => question.target !== game.me && game.players.some(player => player.id === question.target);
  const supported = () => hasTarget() && game.truthShipmentTargets.includes(question.target);
  const inputError = () => {
    try {
      parseShipmentExpression(shipmentExpressionOf(question), { allowConstants: false });
      return null;
    } catch (error) {
      if (error instanceof ShipmentClaimError) return error.message;
      throw error;
    }
  };
  const blocked = () => busy || !ownsQuestion() || !supported() || !!inputError();
  const error = inputError();
  return <>
    {hasTarget() ? <ShipmentExpressionFields value={shipmentExpressionOf(question)}
      disabled={busy || !ownsQuestion() || !supported()} onChange={next => {
        if (!busy && ownsQuestion() && supported() && !shipmentExpressionInputError(next)) onChange(next);
      }} /> : <p className="notice">Choose another seated player for this question.</p>}
    {!supported() && <p className="notice">Choose an eligible respondent with an unused shipment this turn and finish pending decisions.</p>}
    <blockquote data-testid="truth-shipment-preview">
      {error ?? truthQuestionText(question,
        id => game.allLeaders.find(leader => leader.id === id)?.name ?? id,
        id => game.combatLocations.find(location => location.id === id)?.name ?? id)}
    </blockquote>
    {error && <p className="notice" role="alert">{error}</p>}
    <Button className="game-action" data-testid="truth-shipment-ask" disabled={blocked()}
      onClick={() => { if (!blocked()) act({ type: 'truthAsk', question }); }}>Ask publicly</Button>
  </>;
}
