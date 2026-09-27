'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';
import { moritaniBetrayalAction } from '@/game/nexus-moritani-betrayal-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusMoritaniBetrayal({ game, act, busy }: Props) {
  const [selected, select] = useState('');
  const offer = game.nexusMoritaniBetrayal;
  if (!offer) return null;
  const token = offer.tokens.find(choice => choice.id === selected) ?? offer.tokens[0];
  const action = token ? moritaniBetrayalAction(game, token.id) : null;
  return (
    <section aria-label="Moritani Nexus Betrayal" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Moritani Nexus · Betrayal</h3>
      <p>Return one placed Terror token to Moritani’s hidden supply without revealing its face. Spend this Nexus card.</p>
      {offer.tokens.length > 1 && <label className="block">Placed token
        <select value={token?.id ?? ''} disabled={busy || !!offer.blocked} onChange={event => select(event.target.value)}>
          {offer.tokens.map(choice => <option key={choice.id} value={choice.id}>{territory(choice.territory).name}</option>)}
        </select>
      </label>}
      {token && <p>Selected: {territory(token.territory).name}</p>}
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Return hidden Terror token
      </Button>
    </section>
  );
}
