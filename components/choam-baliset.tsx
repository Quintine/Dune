'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpTip } from './help-tip';
import type { Action, GameView } from '@/game/engine';
import { gameTerritories } from '@/game/board';

export function ChoamBaliset({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState('');
  const [territory, setTerritory] = useState('');
  if (!g.choamWorthless || g.phase !== 5) return null;
  const d = g.decision?.kind === 'choamMovement' ? g.decision : null;
  const card = g.choamWorthless.cards.find((c) => c.name === 'Baliset');
  if (!card && !d) return null;
  const players = g.players.filter((p) => p.faction !== 'choam');
  const selectedPlayer =
    d?.mover ?? players.find((p) => p.id === target)?.id ?? players[0]?.id;
  const territories = g.choamWorthless.baliset.filter(
    (t) =>
      !g.balisetRestrictions.some(
        (b) => b.territory === t && b.player === selectedPlayer,
      ),
  );
  const selectedTerritory =
    d?.territory ??
    (territories.includes(territory) ? territory : territories[0]);
  const name = (id?: string) =>
    gameTerritories(g).find((t) => t.id === id)?.name;
  return (
    <section className="notice">
      <h3>
        Baliset <HelpTip topic="choamWorthless" />
      </h3>
      <p>
        Prevent a player from moving into one territory you occupy this phase.
        Shipment remains possible. Karama may cancel the effect.
      </p>
      {d ? (
        <p>
          {g.players.find((p) => p.id === d.mover)?.name} has declared a move of{' '}
          {d.amount} forces into {name(d.territory)}, sector {d.sector}. No
          forces have moved yet.
        </p>
      ) : (
        card && (
          <>
            <label>
              Player{' '}
              <select
                value={selectedPlayer ?? ''}
                onChange={(e) => setTarget(e.target.value)}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Territory{' '}
              <select
                value={selectedTerritory ?? ''}
                onChange={(e) => setTerritory(e.target.value)}
              >
                {territories.map((t) => (
                  <option key={t} value={t}>
                    {name(t)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )
      )}
      {card && (
        <Button
          disabled={busy || !selectedPlayer || !selectedTerritory}
          onClick={() =>
            act({
              type: 'card',
              mode: 'choam',
              card: card.id,
              target: selectedPlayer,
              territory: selectedTerritory,
            })
          }
        >
          Prevent movement
        </Button>
      )}
      {!card && d && <p className="fine">No available Baliset play.</p>}
      {d && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Allow movement
        </Button>
      )}
    </section>
  );
}
