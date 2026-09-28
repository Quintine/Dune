'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { battleCardLabel } from '@/game/battle-cards';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

export function MoritaniRetention({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const decision = game.decision;
  if (decision?.kind !== 'moritaniRetention' || decision.player !== game.me)
    return null;
  const nexus = decision.source === 'nexus';
  const canKeep = !nexus || !!game.nexusMoritaniRetention?.canKeep;
  const choose = (keep: string | null): Action => nexus
    ? { type: 'decision', event: decision.event, keep }
    : { type: 'decision', keep };
  const me = game.players.find((player) => player.id === game.me);
  if (!me) return null;
  const cards = (me.hand ?? []).filter((card) =>
    decision.cards.includes(card.id),
  );
  const selectedCard = cards.find((card) => card.id === selected);
  const owner = game.players.find((player) => player.id === decision.owner);
  const location = game.combatLocations.find(place => place.id === decision.territory)?.name
    ?? decision.territory;
  const disabled = busy || !!game.response || !!game.truthtrance;
  return (
    <section
      className="min-w-0 space-y-4"
      aria-label={nexus ? 'Postbattle Moritani Nexus choice' : 'Moritani allied card retention'}
    >
      {nexus ? (
        <>
          <p>
            You lost the battle in {location}. Every
            loser with an eligible played card gets this choice. If you hold the
            Moritani Nexus card while unallied, spend it to retain one played
            card a winner could keep; otherwise continue.
          </p>
          <p className="fine">
            Used cards with mandatory discard cannot be retained. Spending the
            Nexus card is public; your other hand cards remain private.
          </p>
        </>
      ) : (
        <>
          <p>
            You lost the battle in {location}. Your
            Moritani ally{owner ? `, ${owner.name},` : ''} lets you choose one
            eligible card played in that battle to keep. Using this ability is
            optional.
          </p>
          <p className="fine">
            Declare one card, then the table may respond with Karama before you
            retain it. If the power is canceled, all these cards are discarded.
            Declining also discards them.
          </p>
        </>
      )}
      <fieldset
        className="m-0 min-w-0 space-y-3 border-0 p-0"
        disabled={disabled}
      >
        <legend className="mb-3 font-semibold">
          Choose one card to retain
        </legend>
        {cards.map((card) => (
          <article
            key={card.id}
            className={`treachery-card card-${card.kind} min-w-0`}
          >
            <label
              htmlFor={`${groupId}-${card.id}`}
              className="flex min-h-11 cursor-pointer items-center gap-3 break-words"
            >
              <input
                id={`${groupId}-${card.id}`}
                type="radio"
                name={groupId}
                value={card.id}
                checked={selectedCard?.id === card.id}
                onChange={() => setSelected(card.id)}
                className="size-5 shrink-0 accent-[#d7b673]"
              />
              <span className="min-w-0 font-semibold">{card.name}</span>
            </label>
            <p className="eyebrow">{battleCardLabel(card.kind)}</p>
            <CardRules card={card} />
            <CardInspector card={card} />
          </article>
        ))}
      </fieldset>
      {!cards.length && (
        <p className="fine">
          No eligible card remains in your hand. Decline to continue.
        </p>
      )}
      <Button
        className="min-h-11 w-full whitespace-normal"
        disabled={disabled || !selectedCard || !canKeep}
        onClick={() => selectedCard && canKeep && act(choose(selectedCard.id))}
      >
        {nexus ? 'Spend Moritani Nexus · retain selected card' : 'Declare selected card'}
      </Button>
      <Button
        variant="outline"
        className="min-h-11 w-full whitespace-normal"
        disabled={disabled}
        onClick={() => act(choose(null))}
      >
        {nexus ? 'Continue without retention' : 'Decline retention'}
      </Button>
    </section>
  );
}
