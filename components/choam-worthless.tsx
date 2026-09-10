'use client';
import { useState } from 'react';
import { ChoamPowerCost, useChoamPower } from './choam-power-cost';
import { choamPowerAction, choamPowerPlays } from '@/game/choam-power-options';
import { HelpTip } from './help-tip';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';
export function ChoamWorthless({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState('');
  const power = useChoamPower(g, g.phase === 4 ? 'laLaLa' : 'kulon');
  const reactive = g.decision?.kind === 'choamFreeRevival';
  if (!g.choamWorthless || ![4, 5].includes(g.phase)) return null;
  const selected = g.choamWorthless.targets.includes(target)
    ? target
    : g.choamWorthless.targets[0];
  const recipient =
    g.decision?.kind === 'choamFreeRevival' ? g.decision.recipient : selected;
  return (
    <section className="notice">
      <h3>
        CHOAM Worthless powers <HelpTip topic="choamWorthless" />
      </h3>
      <p>
        {g.phase === 4
          ? 'La La La prevents a player’s free force revivals for the rest of Revival. If it stops a pending request, the player can choose a paid revival.'
          : 'Kulon adds one territory to your movement range this turn, including movement with ornithopters.'}{' '}
        A Karama response precedes discarding the card.
      </p>
      {g.phase === 4 && !reactive && (
        <label>
          Player to deny free revival{' '}
          <select
            value={recipient ?? ''}
            onChange={(e) => setTarget(e.target.value)}
          >
            {g.choamWorthless.targets.map((id) => (
              <option key={id} value={id}>
                {g.players.find((p) => p.id === id)?.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {reactive && (
        <p>
          {g.players.find((p) => p.id === recipient)?.name} is requesting free
          force revival.
        </p>
      )}
      <ChoamPowerCost {...power} busy={busy} />
      {power.play && (
        <Button
          disabled={
            busy ||
            (g.phase === 4 && !recipient) ||
            !choamPowerAction(g, power.play)
          }
          onClick={() => {
            const action = choamPowerAction(
              g,
              power.play!,
              g.phase === 4 ? { target: recipient } : {},
            );
            if (action) act(action);
          }}
        >
          Use {g.phase === 4 ? 'La La La' : 'Kulon'}
        </Button>
      )}
      {choamPowerPlays(g, 'kull').some(
        (play) => play.source === 'nexus' && play.effect === 'kull',
      ) && (
        <p className="fine">
          Kull Wahad’s Karama prevention effect is not implemented. CHOAM
          Cunning cannot use it yet.
        </p>
      )}
      {reactive && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Allow this free revival
        </Button>
      )}
    </section>
  );
}
