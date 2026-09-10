'use client';
import { useState } from 'react';
import { ChoamPowerCost, useChoamPower } from './choam-power-cost';
import { choamPowerAction } from '@/game/choam-power-options';
import { Button } from '@/components/ui/button';
import { HelpTip } from './help-tip';
import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';

export function ChoamStorm({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const power = useChoamPower(g, 'jubba');
  const [selected, setSelected] = useState('');
  const decision = g.decision?.kind === 'choamStorm' ? g.decision : null;
  if (!decision || decision.player !== g.me) return null;
  const choice =
    decision.territories.find((t) => t.territory === selected) ??
    decision.territories[0];
  return (
    <section className="notice">
      <h3>
        Jubba Cloak <HelpTip topic="choamWorthless" />
      </h3>
      <p>
        Protect your own forces in one territory from this storm movement. Spice
        and other factions’ forces remain exposed. Karama may cancel this
        effect.
      </p>
      {decision.protected.length > 0 && (
        <p>
          Protected:{' '}
          {decision.protected.map((t) => territory(t).name).join(', ')}.
        </p>
      )}
      <label>
        Threatened territory{' '}
        <select
          value={choice?.territory ?? ''}
          onChange={(e) => setSelected(e.target.value)}
        >
          {decision.territories.map((t) => (
            <option key={t.territory} value={t.territory}>
              {territory(t.territory).name} · {t.amount} forces · sectors{' '}
              {t.sectors.join(', ')}
            </option>
          ))}
        </select>
      </label>
      <ChoamPowerCost {...power} busy={busy} />
      {power.play ? (
        <Button
          disabled={
            busy || !choice || !power.play || !choamPowerAction(g, power.play)
          }
          onClick={() => {
            const action = choamPowerAction(g, power.play!, {
              territory: choice.territory,
            });
            if (action) act(action);
          }}
        >
          Protect this territory
        </Button>
      ) : (
        <p className="fine">
          No available Jubba Cloak play. Continue when ready to accept the
          remaining losses.
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => act({ type: 'decision', decline: true })}
      >
        Continue storm
      </Button>
    </section>
  );
}
