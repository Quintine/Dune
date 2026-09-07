'use client';

import { useId } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

export function PortableSnooper({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const snooper = game.portableSnooper;
  if (!snooper) return null;
  const reason =
    snooper.blocked ??
    (!snooper.event ? 'A revealed battle is required for late defense.' : null);
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Portable Snooper: poison defense
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Choose this card as your normal battle defense, or play it after plans
          are revealed when you have room for a late defense. Finish any current
          interaction and play before submitting your traitor decision. It
          protects against ordinary poison, but does not stop Poison Tooth.
        </p>
        <CardRules card={snooper.card} />
        <CardInspector card={snooper.card} />
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
            if (!busy && !reason && snooper.event)
              act({
                type: 'portableSnooper',
                card: snooper.card.id,
                event: snooper.event,
              });
          }}
        >
          Play Portable Snooper as a late defense
        </Button>
      </div>
    </details>
  );
}
