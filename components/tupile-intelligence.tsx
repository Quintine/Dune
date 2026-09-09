'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction, PHASES } from '@/game/catalog';
import type { TupileIntelligenceCategory } from '@/game/tupile-intelligence';
import {
  tupileIntelligenceCanAct,
  tupileIntelligenceChoice,
} from '@/game/tupile-intelligence-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function TupileIntelligence({ game, act, busy }: Props) {
  if (!game.tupileIntelligence || game.tupileIntelligence.owner !== game.me)
    return null;
  return <IntelligencePanel key={game.me} game={game} act={act} busy={busy} />;
}

function IntelligencePanel({ game, act, busy }: Props) {
  const offer = game.tupileIntelligence!;
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<TupileIntelligenceCategory>('weapons');
  const currentTarget = target || offer.targets.find((candidate) => !candidate.blocked)?.player || '';
  const canAct = tupileIntelligenceCanAct(game);
  const choice = tupileIntelligenceChoice(game, currentTarget, category);
  const eligible = offer.targets.some((candidate) => !candidate.blocked);
  const disabled = busy || !canAct || !eligible;
  return (
    <section aria-label="Your Tupile intelligence" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h4>Your Tupile intelligence</h4>
      <p>Once per faction, learn their current spice and one card count.</p>
      <label className="block space-y-1">
        <span>Opposing faction</span>
        <select
          aria-label="Opposing faction"
          className="w-full"
          value={currentTarget}
          disabled={disabled}
          onChange={(event) => setTarget(event.target.value)}
        >
          {!eligible && <option value="">No eligible faction</option>}
          {offer.targets.map((candidate) => (
            <option key={candidate.player} value={candidate.player} disabled={!!candidate.blocked}>
              {faction(candidate.faction).name}
              {candidate.blocked ? ' — unavailable' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span>Card count</span>
        <select
          aria-label="Card count"
          className="w-full"
          value={category}
          disabled={disabled}
          onChange={(event) => setCategory(event.target.value as TupileIntelligenceCategory)}
        >
          <option value="weapons">Weapons</option>
          <option value="defenses">Defenses</option>
        </select>
      </label>
      {offer.blocked && <p className="fine" aria-live="polite">{offer.blocked}</p>}
      {!eligible && (
        <div className="fine space-y-1" aria-live="polite">
          <p>No faction is currently available for a request.</p>
          {!!offer.targets.length && (
            <ul className="space-y-1">
              {offer.targets.map((candidate) => (
                <li key={candidate.player}>
                  <strong>{faction(candidate.faction).name}</strong>: {candidate.blocked}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {eligible && !offer.blocked && choice.blocked && (
        <p className="fine" aria-live="polite">{choice.blocked}</p>
      )}
      <Button
          className="game-action"
          disabled={busy || !choice.action}
          onClick={() => { if (choice.action) act(choice.action); }}
      >Request intelligence</Button>
      {!!offer.receipts.length && (
        <div className="space-y-2">
          <h4>Your private observations</h4>
          <p className="fine">These are past observations. They do not update when a hand or balance changes.</p>
          <ul className="space-y-2 text-sm">
            {[...offer.receipts].reverse().map((receipt) => (
              <li key={receipt.event}>
                <strong>{faction(receipt.faction).name}</strong>: {receipt.spice} spice, {receipt.count}{' '}
                {receipt.category === 'weapons'
                  ? receipt.count === 1 ? 'weapon' : 'weapons'
                  : receipt.count === 1 ? 'defense' : 'defenses'}.
                <span className="fine block">Turn {receipt.turn} · {PHASES[receipt.phase]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
