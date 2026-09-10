'use client';
import { useState } from 'react';
import { ChoamPowerCost, useChoamPower } from './choam-power-cost';
import { choamPowerAction } from '@/game/choam-power-options';
import { HelpTip } from './help-tip';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';
import { gameTerritories, splitLocation } from '@/game/board';
export function ChoamGamont({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const power = useChoamPower(g, 'gamont');
  const [selection, setSelection] = useState('');
  if (!g.choamWorthless || g.phase !== 8) return null;
  const options = g.choamWorthless.gamont;
  const key = (o: (typeof options)[number]) =>
    `${o.target}/${o.key}/${o.elite}`;
  const chosen = options.find((o) => key(o) === selection) ?? options[0];
  return (
    <section className="notice">
      <h3>
        Trip to Gamont <HelpTip topic="choamWorthless" />
      </h3>
      <p>
        Return one other player’s force to its reserves. Choose its sector and
        force type. Karama may stop the return; victory is checked after this
        opportunity. A No-Field in the selected sector must reveal first; the
        card is used even if no force is there to return.
      </p>
      <ChoamPowerCost {...power} busy={busy} />
      {power.play && options.length > 0 && (
        <>
          <label>
            Force to return{' '}
            <select
              value={chosen ? key(chosen) : ''}
              onChange={(e) => setSelection(e.target.value)}
            >
              {options.map((o) => {
                const loc = splitLocation(o.key),
                  owner = g.players.find((p) => p.id === o.target)!;
                const type = o.noField
                  ? 'No-Field — reveal, then return one if present'
                  : o.elite
                    ? owner.faction === 'ixians'
                      ? 'cyborg'
                      : 'elite'
                    : owner.faction === 'ixians'
                      ? 'suboid'
                      : 'ordinary';
                return (
                  <option key={key(o)} value={key(o)}>
                    {owner.name} ·{' '}
                    {
                      gameTerritories(g).find((t) => t.id === loc.territory)
                        ?.name
                    }{' '}
                    · sector {loc.sector} · {type}
                  </option>
                );
              })}
            </select>
          </label>
          <Button
            disabled={
              busy || !chosen || !power.play || !choamPowerAction(g, power.play)
            }
            onClick={() => {
              const action = choamPowerAction(g, power.play!, {
                target: chosen.target,
                from: chosen.key,
                elite: chosen.elite,
              });
              if (action) act(action);
            }}
          >
            Return this force
          </Button>
        </>
      )}
      {(!power.play || !options.length) && (
        <p className="fine">No available Trip to Gamont play.</p>
      )}
      {g.decision?.kind === 'choamMentat' && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', done: true })}
        >
          Finish and check victory
        </Button>
      )}
    </section>
  );
}
