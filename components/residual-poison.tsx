'use client';

import { useId } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

type PreparationProps = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

export function ResidualPoison({ game, act, busy }: PreparationProps) {
  const id = useId();
  const poison = game.residualPoison;
  if (!poison) return null;
  const target = game.players.find((player) => player.id === poison.target);
  const reason =
    poison.blocked ??
    (!target || !poison.event
      ? 'Use this card against your opponent before battle leaders are chosen.'
      : null);
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Residual Poison: before choosing leaders
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Play against your actual battle opponent. One available opposing
          leader is randomly sent to the Tanks, with no spice bounty, then
          Residual Poison is discarded. You do not choose the leader.
        </p>
        <CardRules card={poison.card} />
        <CardInspector card={poison.card} />
        {reason && (
          <p className="notice" id={`${id}-reason`}>
            {reason}
          </p>
        )}
        <Button
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={busy || !!reason}
          aria-describedby={reason ? `${id}-reason` : undefined}
          onClick={() => {
            if (!busy && !reason && poison.target && poison.event)
              act({
                type: 'card',
                card: poison.card.id,
                target: poison.target,
                event: poison.event,
              });
          }}
        >
          Play Residual Poison against {target?.name ?? 'your battle opponent'}
        </Button>
      </div>
    </details>
  );
}

/** Neutral public timing controls must never depend on either player's hand. */
export function BattleLeaderOpportunity({ game, act, busy }: PreparationProps) {
  const id = useId(),
    battle = game.battle,
    stage = battle?.preLeader;
  if (!battle || !stage || stage.closed) return null;
  const combatants = [battle.attacker, battle.defender];
  const mine = combatants.includes(game.me),
    ready = stage.ready.includes(game.me);
  const interrupted = !!(
    game.truthtrance ||
    game.response ||
    game.decision ||
    game.phaseOpening
  );
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Before choosing battle leaders</h3>
      <p>
        Both combatants have an opportunity to use available preparations before
        either commits a leader. Continue when you are ready to choose leaders.
      </p>
      <ul>
        {combatants.map((player) => (
          <li key={player}>
            {game.players.find((p) => p.id === player)?.name ?? 'Combatant'}:{' '}
            {stage.ready.includes(player)
              ? 'Ready to choose leaders'
              : 'Preparing'}
          </li>
        ))}
      </ul>
      {mine &&
        (!ready ? (
          <>
            {interrupted && (
              <p className="notice" id={`${id}-reason`}>
                Resolve the current interaction before continuing.
              </p>
            )}
            <Button
              className="min-h-11 whitespace-normal motion-reduce:transition-none"
              disabled={busy || interrupted}
              aria-describedby={interrupted ? `${id}-reason` : undefined}
              onClick={() => {
                if (!busy && !interrupted)
                  act({ type: 'battlePreparationReady', event: stage.event });
              }}
            >
              Ready to choose leaders
            </Button>
          </>
        ) : (
          <p className="fine">
            You are ready. Waiting for the other combatant.
          </p>
        ))}
      {!mine && (
        <p className="fine">
          Waiting for the combatants to finish preparation.
        </p>
      )}
    </section>
  );
}
