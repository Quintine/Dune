'use client';

import { useId } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

type BoxProps = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

/** Before payment this renders only the owned Box, never discard candidates. */
export function NullentropyBox({ game, act, busy }: BoxProps) {
  const id = useId();
  const box = game.nullentropy;
  if (!box) return null;
  if (box.search)
    return (
      <p className="notice">
        Your Nullentropy Box search is paid. Complete the private card choice in
        the decision panel above.
      </p>
    );
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Nullentropy Box: paid discard search
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Pay 2 spice to the bank to privately search the Treachery discard
          pile. Choose one card other than any Nullentropy Box. The remaining
          pile is shuffled, then your played Box is discarded on top.
        </p>
        <p className="fine">
          Payment begins the search. There is no free cancellation after seeing
          the cards. If only one card is eligible, the server takes it
          automatically.
        </p>
        <CardRules card={box.card} />
        <CardInspector card={box.card} />
        {box.blocked && (
          <p id={`${id}-reason`} className="notice">
            {box.blocked}
          </p>
        )}
        <Button
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={busy || !!box.blocked}
          aria-describedby={box.blocked ? `${id}-reason` : undefined}
          onClick={() => {
            if (!busy && !box.blocked) act({ type: 'card', card: box.card.id });
          }}
        >
          Pay 2 spice and search privately
        </Button>
      </div>
    </details>
  );
}

/** Only the paid, entitled projection supplies these temporary discard faces. */
export function NullentropySearch({ game, act, busy }: BoxProps) {
  const search = game.nullentropy?.search;
  if (
    game.decision?.kind !== 'nullentropy' ||
    game.decision.player !== game.me ||
    !search
  )
    return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p>
        You have paid 2 spice. Choose one card for your hand. This finishes the
        search and discards your Box on top of the shuffled remainder.
      </p>
      <p className="fine">
        These discard cards are visible only to you during this paid search.
        Inspection does not select a card.
      </p>
      <div
        className="grid min-w-0 gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))' }}
      >
        {search.cards.map((card) => (
          <article
            key={card.id}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#65644b] p-4"
          >
            <h3>{card.name}</h3>
            <CardRules card={card} />
            <CardInspector card={card} />
            <Button
              className="min-h-11 whitespace-normal motion-reduce:transition-none"
              disabled={busy}
              onClick={() => {
                if (!busy)
                  act({ type: 'decision', event: search.event, card: card.id });
              }}
            >
              Take {card.name} and finish search
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
