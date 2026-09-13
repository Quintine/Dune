'use client';

import type { GameView } from '@/game/engine';
import { controlsLeader } from '@/game/leader-control';
import {
  spiceBankerBattleMaximum,
  spiceBankerModeSupported,
} from '@/game/spice-banker';
import { Input } from '@/components/ui/input';

export function spiceBankerControlState(
  game: GameView,
  selectedLeader: string,
  ownSupport: number,
) {
  if (!spiceBankerModeSupported(game)) return { eligible: false, maximum: 0 };
  const me = game.players.find((player) => player.id === game.me);
  if (!me) return { eligible: false, maximum: 0 };
  const leader = me.leaders.find(
    (candidate) =>
      candidate.id === selectedLeader &&
      !candidate.dead &&
      controlsLeader(me, candidate) &&
      (!candidate.usedAt || candidate.usedAt === game.battle?.territory),
  );
  const assignments =
    game.leaderSkills?.assignments.filter(
      (assignment) => assignment.controller === game.me,
    ) ?? [];
  const eligible =
    !!leader && spiceBankerBattleMaximum(assignments, leader.id, 3, 0) > 0;
  return {
    eligible,
    maximum: eligible
      ? spiceBankerBattleMaximum(
          assignments,
          leader.id,
          me.spice ?? 0,
          ownSupport,
        )
      : 0,
  };
}

export function SpiceBankerControl({
  game,
  selectedLeader,
  ownSupport,
  value,
  onChange,
  disabled = false,
}: {
  game: GameView;
  selectedLeader: string;
  ownSupport: number;
  value: number;
  onChange: (amount: number) => void;
  disabled?: boolean;
}) {
  const state = spiceBankerControlState(game, selectedLeader, ownSupport);
  if (!state.eligible) return null;
  const commitment = Number.isFinite(value)
    ? Math.max(0, Math.min(Math.trunc(value), state.maximum))
    : 0;
  return (
    <div className="notice" aria-label="Spice Banker battle commitment">
      <label htmlFor="battle-banker-spice">
        Spice Banker commitment
        <Input
          id="battle-banker-spice"
          type="number"
          min={0}
          max={state.maximum}
          value={commitment}
          disabled={disabled || state.maximum === 0}
          onChange={(event) =>
            onChange(
              Math.max(
                0,
                Math.min(Math.trunc(Number(event.target.value)), state.maximum),
              ),
            )
          }
        />
      </label>
      <p>
        Plan funding: {ownSupport} own spice for force support + {commitment}{' '}
        committed to Spice Banker = {ownSupport + commitment} own spice total.
      </p>
      <p className="fine">
        You may commit up to {state.maximum} own spice after your own
        force-support payment. Bank and CHOAM support are separate. Each
        committed spice adds 1 strength if this skilled leader survives. The
        commitment goes to the Bank after a win or loss, including if the leader
        dies. A sole winner through a traitor call spends no Battle Plan spice.
      </p>
    </div>
  );
}
