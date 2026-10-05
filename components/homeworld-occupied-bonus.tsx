'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { FACTIONS } from '@/game/catalog';
import { homeworldCard } from '@/game/homeworld-cards';
import { HomeworldFace } from './homeworld-cards';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
type Offer = NonNullable<GameView['homeworldOccupiedBonus']>;

export function HomeworldOccupiedBonus({ game, act, busy }: Props) {
  const offer = game.homeworldOccupiedBonus;
  if (!offer) return null;
  const authorized = game.decision?.kind === 'homeworldOccupiedBonus' &&
    game.decision.player === game.me && game.decision.event === offer.event && offer.owner === game.me;
  if (!authorized && !offer.blocked) return null;
  return <BonusChoice key={offer.event} offer={offer} game={game} act={act} busy={busy || !authorized} />;
}

function BonusChoice({ offer, act, busy }: Props & { offer: Offer }) {
  const [recipient, setRecipient] = useState(offer.owner);
  const selected = offer.recipients.find((player) => player.player === recipient) ?? offer.recipients[0];
  return (
    <section aria-label="Occupied Giedi Prime bonus card" className="space-y-3">
      <h3>Giedi Prime · occupied purchase bonus</h3>
      <p>
        {offer.ownerName} chooses who receives one real treachery card from the original purchase bonus.
        Only the server-listed eligible recipients can receive it. The card stays private to its recipient.
      </p>
      <p className="fine">
        This printed Homeworld effect is separate from the ordinary cancelable Harkonnen advantage and cannot be canceled by Karama.
        This is one card, not one card per recipient.
      </p>
      <p className="notice">
        Development preview · Advanced occupation benefits are retained until your last occupying force leaves. Basic lifecycle and unresolved competing-owner cases remain guarded. Not complete or certified Homeworld rules.
      </p>
      <details className="rounded-lg border border-[#a88b60]/50 p-3">
        <summary className="cursor-pointer py-2">Inspect Giedi Prime source card</summary>
        <HomeworldFace card={homeworldCard('giedi_prime')!} />
      </details>
      {offer.blocked ? <output className="notice block">{offer.blocked}</output> : !selected ? (
        <p className="notice">No eligible recipient is available.</p>
      ) : (
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!busy) act({ type: 'decision', event: offer.event, recipient: selected.player });
        }}>
          <label className="block space-y-1">
            <span>Bonus card recipient</span>
            <select aria-label="Occupied bonus card recipient" className="min-h-11 max-w-full"
              value={selected.player} disabled={busy} onChange={(event) => setRecipient(event.target.value)}>
              {offer.recipients.map((player) => (
                <option key={player.player} value={player.player}>
                  {player.name} · {FACTIONS.find((faction) => faction.id === player.faction)?.name ?? player.faction}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="game-action" disabled={busy}>Give one bonus card to {selected.name}</Button>
        </form>
      )}
    </section>
  );
}
