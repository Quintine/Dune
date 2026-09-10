'use client';
import { useState } from 'react';
import type { GameView } from '@/game/engine';
import {
  choamPowerKey,
  choamPowerPlays,
  CHOAM_POWER_NAMES,
  type ChoamPowerEffect,
  type ChoamPowerPlay,
} from '@/game/choam-power-options';
import { CardInspector } from './card-inspector';

export function useChoamPower(game: GameView, effect: ChoamPowerEffect) {
  const [selected, select] = useState('');
  const plays = choamPowerPlays(game, effect);
  const play =
    plays.find((candidate) => choamPowerKey(candidate) === selected) ??
    plays.find((candidate) => !candidate.blocked) ??
    plays[0];
  return { plays, play, select };
}

export function ChoamPowerCost({
  plays,
  play,
  select,
  busy,
}: {
  plays: ChoamPowerPlay[];
  play?: ChoamPowerPlay;
  select: (key: string) => void;
  busy: boolean;
}) {
  if (!play) return null;
  return (
    <div className="space-y-2">
      {plays.length > 1 && (
        <label>
          Card to use for {CHOAM_POWER_NAMES[play.effect]}
          <select
            value={choamPowerKey(play)}
            disabled={busy}
            onChange={(event) => select(event.target.value)}
          >
            {plays.map((candidate) => (
              <option
                key={choamPowerKey(candidate)}
                value={choamPowerKey(candidate)}
              >
                {candidate.card.name} ·{' '}
                {candidate.source === 'nexus'
                  ? 'CHOAM Nexus Cunning'
                  : 'printed power'}
                {candidate.blocked ? ' · unavailable' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        Use <strong>{play.card.name}</strong> for{' '}
        {CHOAM_POWER_NAMES[play.effect]}.
        {play.source === 'nexus' &&
          ' This spends CHOAM Nexus Cunning once. Karama can prevent the effect and leave this Treachery Card in hand; the Nexus stays spent.'}
      </p>
      <CardInspector card={play.card} />
      {play.blocked && <p className="fine">{play.blocked}</p>}
    </div>
  );
}
