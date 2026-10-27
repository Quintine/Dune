'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';

type Mode = 'finish' | 'continue' | 'accept';

/** An event-bound action button; display data is never sent as authority. */
export function VictoryContinuationButton({
  event, mode, extra, busy, act, children,
}: {
  event: string;
  mode: Mode;
  extra?: number;
  busy: boolean;
  act: (action: Action) => void;
  children: string;
}) {
  return (
    <Button
      className="min-h-11 whitespace-normal"
      variant={mode === 'finish' ? 'outline' : 'default'}
      disabled={busy}
      onClick={() => {
        if (!busy) act({ type: 'victoryContinuation', event, mode,
          ...(mode === 'continue' ? { extra } : {}) });
      }}
    >
      {children}
    </Button>
  );
}

/** All viewers see the same offer. Only its current participant may respond. */
export function VictoryContinuation({
  game, act, busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const vote = game.victoryContinuation;
  const id = useId();
  const [extraText, setExtraText] = useState('0');
  if (!vote) return null;

  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? id;
  const sides = vote.sides.map(side => side.map(name).join(' and ')).join('; ');
  const actor = name(vote.actor);
  const extra = Number(extraText);
  const validExtra = /^\d+$/.test(extraText) && Number.isSafeInteger(extra) && extra <= vote.maxExtra;
  const ownTurn = vote.actor === game.me;
  const proposal = vote.extra === null
    ? null
    : vote.extra === 0
      ? 'Continue with the current stronghold targets.'
      : `Continue and increase the stronghold targets by ${vote.extra}.`;

  return (
    <section className="min-w-0 space-y-3" aria-label="Simultaneous victory decision">
      <h3 className="font-serif text-xl">Simultaneous victory</h3>
      <p>The qualifying sides are {sides}. They can finish the game, or unanimously agree to play another turn.</p>
      {proposal && <p className="notice">Proposal: {proposal}</p>}
      {!ownTurn ? (
        <p aria-live="polite">Waiting for {actor} to decide.</p>
      ) : (
        <>
          {vote.extra === null && (
            <label className="block" htmlFor={`${id}-extra`}>
              Increase the stronghold targets by
              <input
                id={`${id}-extra`}
                className="ml-2 w-20 rounded border px-2 py-1"
                type="number"
                min={0}
                max={vote.maxExtra}
                step={1}
                value={extraText}
                disabled={busy}
                onChange={event => setExtraText(event.currentTarget.value)}
              />
              <span className="fine block">Choose zero to keep the existing targets. Every qualifying participant must agree.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {vote.extra === null ? (
              <VictoryContinuationButton event={vote.event} mode="continue" extra={extra}
                busy={busy || !validExtra} act={act}>
                Propose another turn
              </VictoryContinuationButton>
            ) : (
              <VictoryContinuationButton event={vote.event} mode="accept" busy={busy} act={act}>
                Agree to continue
              </VictoryContinuationButton>
            )}
            <VictoryContinuationButton event={vote.event} mode="finish" busy={busy} act={act}>
              Finish the game
            </VictoryContinuationButton>
          </div>
        </>
      )}
    </section>
  );
}
