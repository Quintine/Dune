'use client';

import type { Action, GameView } from '@/game/engine';
import { CardInspector, CardRules } from './card-inspector';
import { Button } from './ui/button';

export function SemutaReaction({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.semutaReaction;
  if (!reaction) return null;

  return (
    <section aria-label="Semuta Drug response" className="notice min-w-0 space-y-3">
      <h4>Fresh Treachery discard</h4>
      <p className="fine">
        Response event <code>{reaction.event}</code>
      </p>
      {reaction.stage === 'offer' ? (
        <>
          <p>A Treachery card was just discarded. Continue when you are ready.</p>
          {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
          {reaction.passed ? (
            <p aria-live="polite">You continued. Waiting for other seats.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                className="game-action min-h-11 whitespace-normal"
                disabled={busy}
                onClick={() => {
                  if (!busy) act({ type: 'semutaPass', event: reaction.event });
                }}
              >
                Continue
              </Button>
              {reaction.canCommit && (
                <Button
                  className="game-action min-h-11 whitespace-normal"
                  disabled={busy}
                  onClick={() => {
                    if (!busy) act({ type: 'semutaCommit', event: reaction.event });
                  }}
                >
                  Commit Semuta Drug
                </Button>
              )}
            </div>
          )}
        </>
      ) : reaction.candidates.length ? (
        <>
          <p>
            You committed Semuta Drug. Choose one eligible freshly discarded
            Treachery card to claim. This choice cannot be declined or canceled.
          </p>
          <div
            className="grid min-w-0 gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}
          >
            {reaction.candidates.map((card) => (
              <article
                key={card.id}
                className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#65644b] p-4"
              >
                <h5 className="m-0 break-words font-serif text-lg">{card.name}</h5>
                <p className="fine">Card ID: {card.id}</p>
                <CardRules card={card} />
                <CardInspector card={card} />
                <Button
                  className="game-action min-h-11 whitespace-normal"
                  disabled={busy}
                  onClick={() => {
                    if (!busy)
                      act({ type: 'semutaSelect', event: reaction.event, card: card.id });
                  }}
                >
                  Claim {card.name} ({card.id})
                </Button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p aria-live="polite">Waiting for the Semuta Drug claim to finish.</p>
      )}
    </section>
  );
}
