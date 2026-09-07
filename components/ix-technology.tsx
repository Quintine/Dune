'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpTip } from './help-tip';
import { CardInspector } from './card-inspector';
import type { Action, GameView } from '@/game/engine';
export function IxTechnology({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const kind = g.decision?.kind;
  const me = g.players.find((p) => p.id === g.me)!;
  const [position, setPosition] = useState('bottom');
  const cards =
    kind === 'ixSetup'
      ? g.ixTechnology?.setup
      : kind === 'ixAuction'
        ? g.ixTechnology?.pool
        : me.hand;
  if (kind === 'ixAllyCard')
    return (
      <>
        <p>
          You purchased{' '}
          <strong>
            {g.ixPurchased?.name ?? 'a card that is no longer in your hand'}
          </strong>
          . Your Ixian alliance lets you keep it or discard it for the top card
          of the deck. The replacement stays private.{' '}
          <HelpTip topic="ixTechnology" />
        </p>
        {g.ixPurchased && <CardInspector card={g.ixPurchased} />}
        <Button
          className="game-action"
          disabled={busy}
          onClick={() => act({ type: 'decision', accept: false })}
        >
          Keep purchase
        </Button>
        <Button
          variant="outline"
          disabled={busy || !g.ixPurchased}
          onClick={() => act({ type: 'decision', accept: true })}
        >
          Request replacement
        </Button>
      </>
    );
  return (
    <>
      <p>
        {kind === 'ixSetup'
          ? 'Choose your starting card. The remaining cards are shuffled and dealt privately, one to each other faction; Harkonnen then draws its extra card.'
          : kind === 'ixAuction'
            ? 'Privately choose one card to return to the deck. The remaining pool will be shuffled for auction.'
            : 'Exchange one card from your hand for the upcoming card, before Atreides looks. You commit your offered card before learning what you receive. This advantage can be attempted once this round.'}{' '}
        <HelpTip topic="ixTechnology" />
      </p>
      {kind === 'ixAuction' && (
        <label>
          Return chosen card to
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="bottom">Bottom of deck</option>
            <option value="top">Top of deck</option>
          </select>
        </label>
      )}
      <div className="card-choices grid min-w-0 gap-3">
        {cards?.map((c) => (
          <article
            key={c.id}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#454b3c] bg-[#1d221b] p-3"
          >
            <h3 className="m-0 break-words text-base font-semibold text-[#efd9a8]">
              {c.name}
            </h3>
            <CardInspector card={c} />
            <Button
              variant="outline"
              className="game-action min-h-11"
              aria-label={`${kind === 'ixAuction' ? 'Return card' : kind === 'ixSetup' ? 'Choose starting card' : 'Offer this card'}: ${c.name}`}
              disabled={busy}
              onClick={() =>
                act({
                  type: 'decision',
                  card: c.id,
                  ...(kind === 'ixAuction' ? { position } : {}),
                })
              }
            >
              {kind === 'ixAuction'
                ? 'Return card'
                : kind === 'ixSetup'
                  ? 'Choose starting card'
                  : 'Offer this card'}
            </Button>
          </article>
        ))}
      </div>
      {kind === 'ixTechnology' && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Save technology for a later card
        </Button>
      )}
    </>
  );
}
