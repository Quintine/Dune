'use client';

import { splitLocation, territory } from '@/game/board';
import type { Action } from '@/game/engine';
import type { SandmasterVictorySpiceOffer } from '@/game/leader-skill-battle-board';
import { Button } from './ui/button';

type Props = {
  offer: SandmasterVictorySpiceOffer | null | undefined;
  busy: boolean;
  act: (action: Action) => void;
};

export function SandmasterVictorySpice({ offer, busy, act }: Props) {
  if (!offer) return null;
  const name = territory(offer.territory).name;
  return (
    <section className="notice min-w-0 space-y-3" aria-label="Your Sandmaster victory spice placement">
      <h3>Sandmaster · victory spice · {name}</h3>
      <p>Place the mandatory +3 board spice on one existing pile. This grants no direct faction income.</p>
      <p className="fine">Provisional allocation policy: the winning owner selects an existing pile. This is a prototype choice, not a publisher sector-placement ruling.</p>
      <div className="space-y-2">
        {offer.piles.map((pile) => {
          const sector = splitLocation(pile.key).sector;
          return (
            <div key={pile.key} className="space-y-1">
              <p>{name}, sector {sector}: {pile.before} → {pile.after} spice (+3).</p>
              <Button
                className="game-action min-h-11 w-full whitespace-normal"
                disabled={busy}
                data-testid={`sandmaster-victory-spice-${pile.key}`}
                onClick={() => { if (!busy) act({ type: 'decision', event: offer.event, key: pile.key }); }}
              >
                Place +3 spice in sector {sector}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
