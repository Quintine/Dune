'use client';

import type { GameView } from '@/game/engine';
import type { NativeReserveSelections } from '@/game/homeworld-native-reserves';
import { homeworldName } from '@/game/homeworld-shipment-options';

export function reinforcementsSourceLabel(game: GameView, sources: NativeReserveSelections): string {
  return Object.entries(sources).map(([world, forces]) =>
    `${homeworldName(game, world)}: ${forces.normal} normal + ${forces.elite} special`).join('; ');
}

export function ReinforcementsSources({ game, choices, selected, onChange, busy }: {
  game: GameView;
  choices: readonly NativeReserveSelections[];
  selected: number;
  onChange: (index: number) => void;
  busy: boolean;
}) {
  if (!choices.length) return null;
  return <fieldset disabled={busy} className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
    <legend>Reinforcements reserve sources</legend>
    <p className="fine">Three original native reserves go to the Tanks, normal first. These are not the invading army or future Harass returns.</p>
    {choices.length > 1 ? <label className="block space-y-1">
      <span>Native reserve fee allocation</span>
      <select value={selected} onChange={event => onChange(Number(event.target.value))}>
        {choices.map((sources, index) => <option key={index} value={index}>
          {reinforcementsSourceLabel(game, sources)}
        </option>)}
      </select>
    </label> : <p className="fine">{reinforcementsSourceLabel(game, choices[0])}</p>}
    {choices.length > 1 && <p className="fine" aria-live="polite">
      Selected fee: {reinforcementsSourceLabel(game, choices[selected])}.
    </p>}
    <p className="notice">Provisional own-World composition: counters paying the fee cannot also fund your physical dial. The original printed face and support traits stay fixed; the bonus adds no physical counters.</p>
  </fieldset>;
}
