'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusSuboidsAction } from '@/game/nexus-suboid-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusSuboids({ game, act, busy }: Props) {
  const state = game.nexusSuboids;
  if (!state?.offer && !state?.active) return null;
  if (state.active)
    return (
      <section aria-label="Ixian Nexus active">
        <p className="notice">
          Ixian Suboids fight at full strength without spice support for the
          rest of this turn. Cyborgs keep their usual strength and support
          rules.
        </p>
      </section>
    );
  const offer = state.offer!;
  const action = nexusSuboidsAction(game, offer.event);
  return (
    <section
      aria-label="Ixian Nexus Cunning"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>Ixian Nexus · Cunning</h3>
      <p>
        For the rest of this turn, your Suboids fight at full strength without
        spice support. Cyborgs keep their usual strength and support rules.
      </p>
      <p className="fine">
        Use this before submitting your battle plan. This spends your Ixian
        Nexus card.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={busy || !action}
        onClick={() => {
          if (!busy && action) act(action);
        }}
      >
        Strengthen Suboids for this turn
      </Button>
    </section>
  );
}
