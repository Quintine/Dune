'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { homeworldCard } from '@/game/homeworld-cards';
import { CardInspector, CardRules } from './card-inspector';
import { HomeworldFace } from './homeworld-cards';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
type Offer = NonNullable<GameView['homeworldTupileCleanup']>;

export function HomeworldTupileCleanup({ game, act, busy }: Props) {
  const offer = game.homeworldTupileCleanup;
  if (!offer || offer.player !== game.me) return null;
  const authorized = game.decision?.kind === 'homeworldTupileCleanup' &&
    game.decision.player === game.me && game.decision.event === offer.event;
  if (!authorized && !offer.blocked) return null;
  return <CleanupChoice key={`${game.me}:${offer.event}`} game={game} offer={offer}
    act={act} busy={busy || !authorized} />;
}

function CleanupChoice({ game, offer, act, busy }: Props & { offer: Offer }) {
  const [selection, setSelection] = useState<string[]>([]);
  const me = game.players.find((player) => player.id === game.me);
  const eligibleIds = new Set(offer.eligibleCards);
  const cards = (me?.hand ?? []).filter((card) => eligibleIds.has(card.id));
  const heldIds = new Set(cards.map((card) => card.id));
  const selected = selection.filter((id) => heldIds.has(id));
  const countsValid = Number.isSafeInteger(offer.limit) && offer.limit >= 0 &&
    Number.isSafeInteger(offer.excess) && offer.excess > 0;
  const blocked = offer.blocked ?? (!countsValid
    ? 'The original hand-limit cleanup is unavailable.'
    : heldIds.size < offer.excess
      ? 'Not enough eligible held cards are available. Committed and reserved cards remain protected.'
      : null);
  const valid = !blocked && selected.length === offer.excess &&
    new Set(selected).size === selected.length;
  const source = homeworldCard('tupile');
  return (
    <section aria-label="Your occupied Tupile hand-limit cleanup" className="space-y-3">
      <h3>{offer.playerName} · Tupile hand-limit cleanup</h3>
      <p>
        The occupied Tupile hand slot is no longer available. Discard exactly {offer.excess}{' '}
        {offer.excess === 1 ? 'card' : 'cards'} from your eligible held cards to return to
        the normal limit of {offer.limit}.
      </p>
      <p className="fine">
        Only the server-offered original held cards can be selected. Committed and reserved
        cards are protected. This settles the lost slot; normal discard effects remain separate.
      </p>
      <p className="notice">
        Development preview · Advanced rulebook page 22 retains the original occupation
        benefit until the occupier’s last own force leaves; contests, native high population
        and turn changes do not end it. A new sole occupier after departure starts a new
        occupation epoch. Basic unresolved expiry and competing-owner cases remain guarded.
        Not complete or certified Homeworld rules.
      </p>
      <p className="fine break-all">Original occupation cleanup event: {offer.event}</p>
      {source && (
        <details className="rounded-lg border border-[#a88b60]/50 p-3">
          <summary className="cursor-pointer py-2">Inspect Tupile source card</summary>
          <HomeworldFace card={source} />
        </details>
      )}
      <output className="notice block" aria-live="polite">
        Normal limit: {offer.limit} · Cards owed: {offer.excess} · Selected: {selected.length}
      </output>
      {blocked && <output className="notice block">{blocked}</output>}
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (!busy && valid) act({ type: 'decision', event: offer.event, cards: selected });
      }}>
        <fieldset className="space-y-3">
          <legend>Your eligible held cards</legend>
          {cards.map((card) => (
            <div key={card.id} className="space-y-2 rounded-lg border border-[#a88b60]/50 p-3">
              <label className="decision-checkbox">
                <input type="checkbox" checked={selected.includes(card.id)}
                  disabled={busy || !!blocked || (!selected.includes(card.id) && selected.length >= offer.excess)}
                  onChange={(event) => setSelection(event.target.checked
                    ? [...selected, card.id]
                    : selected.filter((id) => id !== card.id))} />
                <span>{card.name}</span>
              </label>
              <CardRules card={card} />
              <CardInspector card={card} />
            </div>
          ))}
          {!cards.length && <p className="muted">No eligible held cards are available.</p>}
        </fieldset>
        {!blocked && <Button type="submit" className="game-action" disabled={busy || !valid}>
          Discard {offer.excess} {offer.excess === 1 ? 'card' : 'cards'} to the normal limit
        </Button>}
      </form>
    </section>
  );
}
