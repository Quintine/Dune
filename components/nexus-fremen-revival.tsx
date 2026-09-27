'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { nexusFremenRevivalAction } from '@/game/nexus-fremen-revival-options';
import { Button } from '@/components/ui/button';

export function NexusFremenRevival({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selectedElite, setSelectedElite] = useState<number | null>(null);
  const offer = game.nexusFremenRevival;
  if (!offer || game.phase !== 4 || game.nexusCards?.card !== 'fremen') return null;
  const options = offer.eliteOptions;
  const elite = options.length === 1 ? options[0] :
    selectedElite !== null && options.includes(selectedElite) ? selectedElite : null;
  const action = elite === null ? null : nexusFremenRevivalAction(game, elite);
  return (
    <section className="min-w-0 space-y-3" aria-label="Fremen Secret Ally revival">
      <h3 className="font-serif text-xl">Fremen Secret Ally</h3>
      <p className="text-base leading-7">Spend your Fremen Nexus card to return 3 forces from Tanks to reserves for free. This uses your ordinary three-force Revival allowance; the Advanced elite cap still applies.</p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      {options.length > 1 && (
        <label className="block space-y-2">
          <span className="font-semibold">Elite forces to revive</span>
          <select aria-label="Fremen Nexus elite forces to revive"
            className="min-h-11 w-full rounded border border-[#65644b] bg-[#171b17] px-3 py-2"
            value={elite ?? ''} disabled={busy || !!offer.blocked}
            onChange={event => setSelectedElite(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}>
            <option value="">Choose an elite count</option>
            {options.map(count => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}
      <Button className="min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Revive 3 free forces{elite === null ? '' : ` · ${elite} elite`}
      </Button>
    </section>
  );
}
