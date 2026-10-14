'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusFremenRevivalAction } from '@/game/nexus-fremen-revival-options';
import { Button } from '@/components/ui/button';

export function NexusFremenRevival({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.nexusFremenRevival;
  if (!offer || game.phase !== 4 || game.nexusCards?.card !== 'fremen') return null;
  const action = nexusFremenRevivalAction(game);
  return (
    <section className="min-w-0 space-y-3" aria-label="Fremen Secret Ally revival">
      <h3 className="font-serif text-xl">Fremen Secret Ally</h3>
      <p className="text-base leading-7">
        Spend your Fremen Nexus to enable a total ordinary free quota of three
        for this Revival phase. Then choose partial forces and actual elite
        counters with the normal revival controls below.
      </p>
      <p className="notice">Provisional policy: {offer.policy}</p>
      <p className="fine">
        {offer.freeRemaining} free returns may remain after activation;
        {offer.maxForces} are currently available from your eligible Tanks.
        No force moves automatically and the ordinary leader slot is unchanged.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Spend Nexus · Enable free revival quota
      </Button>
    </section>
  );
}
