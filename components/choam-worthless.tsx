'use client';
import { useState } from 'react';
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
  const me = g.players.find((p) => p.id === g.me)!;
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
      {g.choamWorthless.cards
        .filter((c) =>
          g.phase === 4 ? c.name === 'La La La' : c.name === 'Kulon',
        )
        .map((c) => (
          <Button
            key={c.id}
            disabled={
              busy ||
              (g.phase === 5 &&
                (g.active !== me.id ||
                  (me.moved ?? 0) >= (me.movesAllowed ?? 1))) ||
              (g.phase === 4 && !recipient)
            }
            onClick={() =>
              act({
                type: 'card',
                mode: 'choam',
                card: c.id,
                target: recipient,
              })
            }
          >
            Use {c.name}
          </Button>
        ))}
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
