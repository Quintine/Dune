'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { nexusEmperorPurchaseAction, nexusEmperorRevivalAction } from '@/game/nexus-emperor-secret-ally-options';
import { Button } from '@/components/ui/button';

export function NexusEmperorSecretAlly({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selectedElite, setSelectedElite] = useState<number | null>(null);
  const offer = game.nexusEmperorSecretAlly;
  const owner = game.players.find((player) => player.id === game.me);
  const emperorSeated = game.players.some((player) => player.faction === 'emperor');
  const purchase =
    offer?.purchase &&
    game.nexusCards?.card === 'emperor' &&
    !!owner &&
    !emperorSeated &&
    game.status === 'playing' &&
    game.phase === 3 &&
    game.decision?.kind === 'auctionPayment' &&
    game.decision.player === game.me
      ? offer.purchase
      : null;
  if (purchase) {
    const action = nexusEmperorPurchaseAction(game);
    const blocked = busy || !action;
    const reason = purchase.blocked ??
      (!action
        ? (owner?.spice ?? 0) < purchase.price
          ? `You need ${purchase.price} spice in your own supply for this bid.`
          : 'Finish the current interaction before spending the Emperor Nexus card.'
        : null);
    return (
      <section className="min-w-0 space-y-3" aria-label="Emperor Secret Ally purchase">
        <h3 className="font-serif text-xl">Emperor Secret Ally</h3>
        <p className="text-base leading-7">
          Your final bid is {purchase.price} spice. You must have all {purchase.price} spice
          in your own supply without ally aid. Spend the Emperor Nexus card to keep that
          spice instead of paying the bank; you receive the auction card normally.
        </p>
        {reason && <p className="notice">{reason}</p>}
        <Button
          className="min-h-11 whitespace-normal"
          disabled={blocked}
          onClick={() => {
            if (!blocked && action) act(action);
          }}
        >
          Spend Emperor Nexus card · retain {purchase.price} spice
        </Button>
      </section>
    );
  }
  const eligible =
    offer?.revival &&
    game.nexusCards?.card === 'emperor' &&
    !!owner &&
    !owner.ally &&
    !emperorSeated &&
    game.status === 'playing' &&
    game.phase === 4 &&
    !game.response &&
    !game.decision &&
    !game.truthtrance &&
    !game.phaseOpening &&
    !game.automaticContinuationPending &&
    game.nexusCards.waiting.length === 0 &&
    !game.nexusTraitors?.pending;
  if (!eligible) return null;

  const options = offer.revival.eliteOptions;
  const elite = options.length === 1
    ? options[0]
    : selectedElite !== null && options.includes(selectedElite)
      ? selectedElite
      : null;
  const action = elite === null ? null : nexusEmperorRevivalAction(game, elite);
  const blocked = busy || !action;
  return (
    <section className="min-w-0 space-y-3" aria-label="Emperor Secret Ally revival">
      <h3 className="font-serif text-xl">Emperor Secret Ally</h3>
      <p className="text-base leading-7">
        Spend the Emperor Nexus card to revive 3 additional forces for free,
        beyond your ordinary revival quota. The elite cap still applies.
      </p>
      {offer.revival.blocked && <p className="notice">{offer.revival.blocked}</p>}
      {options.length > 1 && (
        <label className="block space-y-2">
          <span className="font-semibold">Elite forces to revive</span>
          <select
            aria-label="Elite forces to revive"
            className="min-h-11 w-full rounded border border-[#65644b] bg-[#171b17] px-3 py-2"
            value={elite ?? ''}
            disabled={busy || !!offer.revival.blocked}
            onChange={(event) => setSelectedElite(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
          >
            <option value="">Choose an elite count</option>
            {options.map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>
      )}
      <Button
        className="min-h-11 whitespace-normal"
        disabled={blocked}
        onClick={() => {
          if (!blocked && action) act(action);
        }}
      >
        Revive 3 additional forces{elite === null ? '' : ` · ${elite} elite`}
      </Button>
    </section>
  );
}
