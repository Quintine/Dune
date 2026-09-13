'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function IxRicheseTechnology({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.ixRicheseTechnology;
  if (
    !offer ||
    offer.player !== game.me ||
    game.decision?.kind !== 'ixRicheseTechnology' ||
    game.decision.player !== game.me ||
    game.decision.event !== offer.event
  )
    return null;
  return (
    <section
      className="flex flex-col gap-4"
      aria-label="Ixian Technology on a Richese lot"
    >
      <p>
        Richese is offering a{' '}
        {offer.source === 'cache' ? 'cache' : 'Black Market'} card. Bidding will
        begin after you decline Technology for this lot.
      </p>
      <p className="notice">{offer.exchangeBlocked}</p>
      <p>
        Declining leaves your once-per-round Technology use available for later
        lots. Your hand and the offered card stay unchanged.
      </p>
      <Button
        className="min-h-11 whitespace-normal"
        disabled={busy}
        onClick={() => {
          if (!busy)
            act({ type: 'decision', event: offer.event, decline: true });
        }}
      >
        Decline Technology for this lot
      </Button>
    </section>
  );
}
