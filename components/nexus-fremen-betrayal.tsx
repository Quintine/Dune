'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusCardReference } from '@/game/nexus-card-reference';
import { fremenBetrayalAction } from '@/game/nexus-fremen-betrayal-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function NexusFremenBetrayal({ game, act, busy }: Props) {
  const offer = game.nexusFremenBetrayal;
  if (!offer || game.nexusCards?.card !== 'fremen') return null;
  const action = fremenBetrayalAction(game);
  const fremen = game.players.find(player => player.id === offer.target);
  return (
    <section aria-label="Fremen Nexus Betrayal" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Fremen Nexus · Betrayal</h3>
      <p>{nexusCardReference('fremen').betrayal}</p>
      {fremen && <p className="fine">This bounded use suppresses {fremen.name}’s native two-territory movement advantage for the rest of this turn. Independent ornithopters remain available. Suppressing worm riding is not yet connected.</p>}
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Use Betrayal: suppress Fremen movement range
      </Button>
    </section>
  );
}
