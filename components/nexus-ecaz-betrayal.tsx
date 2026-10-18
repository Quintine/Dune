'use client';

import { useState } from 'react';
import { territory as boardTerritory } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { nexusCardReference } from '@/game/nexus-card-reference';
import { ecazBetrayalAction } from '@/game/nexus-ecaz-betrayal-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function NexusEcazBetrayal({ game, act, busy }: Props) {
  const [selected, select] = useState('');
  const offer = game.nexusEcazBetrayal;
  if (!offer || game.nexusCards?.card !== 'ecaz' ||
    !game.players.some(player => player.id === game.me)) return null;
  const choice = offer.territories.find(candidate => candidate.territory === selected) ?? offer.territories[0];
  const action = choice ? ecazBetrayalAction(game, choice.territory) : null;
  const ally = game.players.find(player => player.id === offer.ally);
  return (
    <section aria-label="Ecaz Nexus Betrayal" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Ecaz Nexus · Betrayal</h3>
      <p>{nexusCardReference('ecaz').betrayal}</p>
      {ally && <p className="fine">Ecaz’s ally: {ally.name}. Their entire group in the selected territory returns to reserves if the Karama response allows Betrayal.</p>}
      {offer.territories.length > 1 && <label className="block space-y-1">
        <span>Shared territory</span>
        <select className="min-h-11 w-full" value={choice?.territory ?? ''} disabled={busy || !!offer.blocked}
          onChange={event => select(event.target.value)}>
          {offer.territories.map(candidate => <option key={candidate.territory} value={candidate.territory}>{boardTerritory(candidate.territory).name}</option>)}
        </select>
      </label>}
      {choice && <p>Selected: {boardTerritory(choice.territory).name} · {choice.total.normal} visible normal · {choice.total.elite} visible elite forces{choice.concealed ? ' · one concealed No-Field' : ''}</p>}
      {choice?.concealed && <p className="fine">The No-Field returns face-down without revealing its value. Cancellation leaves the marker and all forces in place.</p>}
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Use Betrayal: return ally’s forces
      </Button>
    </section>
  );
}
