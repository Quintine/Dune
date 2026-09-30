'use client';

import type { Action, GameView } from '@/game/engine';
import { CardInspector, CardRules } from './card-inspector';
import { Button } from './ui/button';

export function ChoamKull({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.kullReaction;
  if (!reaction) return null;
  const reactor = game.players.find((player) => player.id === reaction.player);
  const target = game.players.find((player) => player.id === reaction.target);
  const ownsOffer = game.me === reaction.player && reaction.canDecline;
  const disabled = busy || game.status !== 'playing';

  return (
    <section aria-label="Kull Wahad response" className="notice min-w-0 space-y-3">
      <h3>Kull Wahad · attempted Karama play</h3>
      <p>
        {target?.name ?? 'The activating player'} is attempting {reaction.intent}.
        The attempted card remains unplayed while {reactor?.name ?? 'CHOAM'} responds.
      </p>
      {!ownsOffer ? (
        <p aria-live="polite">Waiting for {reactor?.name ?? 'CHOAM'} to respond.</p>
      ) : (
        <>
          <p>
            Decline to continue the original play, or use a listed physical Kull
            Wahad card. Successful Kull retains the attempted card and prevents
            that player’s Karama activations for this phase. A different eligible
            Karama can prevent Kull before that restriction takes effect.
          </p>
          {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => {
              if (!disabled)
                act({ type: 'kullDecision', event: reaction.event, decline: true });
            }}
          >
            Decline Kull · allow the attempted play
          </Button>
          {!reaction.blocked && (
            <div
              className="grid min-w-0 gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}
            >
              {reaction.cards.map((card) => (
                <article key={card.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#65644b] p-4">
                  <h4 className="m-0 break-words font-serif text-lg">{card.name}</h4>
                  <p className="fine">Physical cost: {card.id}</p>
                  <CardRules card={card} />
                  <CardInspector card={card} />
                  <Button
                    className="game-action min-h-11 whitespace-normal"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled)
                        act({ type: 'kullDecision', event: reaction.event, card: card.id });
                    }}
                  >
                    Use {card.name} ({card.id})
                  </Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
