'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

/** Gift cards come only from this viewer's explicit server projection. */
export function RicheseGift({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [selection, setSelection] = useState('');
  const gift = game.richeseGift;
  if (!gift) return null;
  const owner = game.players.find((player) => player.id === gift.owner);
  const recipient = game.players.find(
    (player) => player.id === (gift.pending?.recipient ?? gift.recipient),
  );
  const mine = gift.owner === game.me;
  const pending = gift.pending;

  if (pending) {
    if (![pending.owner, pending.recipient].includes(game.me)) return null;
    return (
      <section
        className="my-4 flex min-w-0 flex-col gap-3"
        aria-labelledby={`${id}-pending`}
      >
        <h3 id={`${id}-pending`}>Richese gift awaiting resolution</h3>
        <p>
          {mine
            ? 'You are giving'
            : `${owner?.name ?? 'Richese'} is giving you`}{' '}
          {pending.card?.name ?? 'a Richese card'}
          {mine ? ` to ${recipient?.name ?? 'your ally'}` : ''}. Resolve the
          current response before the card transfers. Inspecting it does not
          transfer the card.
        </p>
        {pending.card && (
          <div className="flex min-w-0 flex-col gap-3">
            <CardRules card={pending.card} />
            <CardInspector card={pending.card} />
          </div>
        )}
      </section>
    );
  }
  if (!mine) return null;

  const card =
    gift.cards.find((candidate) => candidate.id === selection) ?? gift.cards[0];
  const reason =
    gift.blocked ??
    (!recipient
      ? 'You need an ally to give a Richese card.'
      : !card
        ? 'No Richese card in your hand is available to give.'
        : null);
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Give a Richese card to your ally
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Give one Richese card from your hand to{' '}
          {recipient?.name ?? 'your ally'}. Your ally must have room. Karama can
          prevent this alliance power before the card transfers.
        </p>
        {gift.cards.length > 0 && (
          <>
            <label htmlFor={`${id}-card`}>Card to give</label>
            <select
              id={`${id}-card`}
              className="min-h-11 w-full min-w-0"
              value={card?.id ?? ''}
              disabled={busy}
              onChange={(event) => setSelection(event.target.value)}
            >
              {gift.cards.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            {card && (
              <div className="flex min-w-0 flex-col gap-3">
                <CardRules card={card} />
                <CardInspector card={card} />
              </div>
            )}
          </>
        )}
        {reason && (
          <p id={`${id}-reason`} className="notice">
            {reason}
          </p>
        )}
        <Button
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={busy || !!reason}
          aria-describedby={reason ? `${id}-reason` : undefined}
          onClick={() => {
            if (!busy && !reason && card)
              act({ type: 'richeseGift', card: card.id });
          }}
        >
          Give {card?.name ?? 'a Richese card'} to{' '}
          {recipient?.name ?? 'your ally'}
        </Button>
        {gift.unavailable.length > 0 && (
          <div
            className="flex min-w-0 flex-col gap-3"
            aria-labelledby={`${id}-unavailable`}
          >
            <h4 id={`${id}-unavailable`}>Cards unavailable to give</h4>
            <ul className="flex list-none flex-col gap-4 p-0">
              {gift.unavailable.map(
                ({ card: unavailable, reason: unavailableReason }) => (
                  <li
                    key={unavailable.id}
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <strong>{unavailable.name}</strong>
                    <p>{unavailableReason}</p>
                    <CardInspector card={unavailable} />
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
