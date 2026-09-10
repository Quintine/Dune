'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusSardaukarAction } from '@/game/nexus-sardaukar-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusSardaukar({ game, act, busy }: Props) {
  const state = game.nexusSardaukar;
  if (!state) return null;
  if (state.pending)
    return (
      <section aria-label="Emperor Nexus response" className="notice">
        <p>
          {game.players.find((p) => p.id === state.pending!.owner)?.name ??
            'Emperor'}{' '}
          declared Cunning. Karama may cancel the entire enhancement before the
          five counters count as Sardaukar.
        </p>
      </section>
    );
  if (state.active)
    return (
      <section aria-label="Emperor Nexus active" className="notice">
        <p>
          Five ordinary Emperor counters count as Sardaukar for this battle.
          They remain ordinary physical counters; any losses go to the ordinary
          Tanks.
        </p>
      </section>
    );
  const offer = state.offer;
  if (!offer) return null;
  const action = nexusSardaukarAction(game, offer.event);
  return (
    <section
      aria-label="Emperor Nexus Cunning"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>Emperor Nexus · Cunning</h3>
      <p>
        Count five of your ordinary forces as Sardaukar for this battle. Use
        this before submitting your plan, with no actual Sardaukar in the
        battle.
      </p>
      <p className="fine">
        This spends your Nexus card once. Karama may cancel the enhancement. The
        five counters keep their ordinary physical identity, including when
        lost.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={busy || !action}
        onClick={() => {
          if (!busy && action) act(action);
        }}
      >
        Use five forces as Sardaukar
      </Button>
    </section>
  );
}
