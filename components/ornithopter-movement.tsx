'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  validateCohortSelection,
  type OrnithopterMode,
} from '@/game/ornithopter';
import { location, splitLocation, gameTerritories } from '@/game/board';
import { isAdvisor } from '@/game/advisors';
import { botGroundMoveAllowed } from '@/game/bot-mobility';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

/** The parent supplies its existing ordinary/elite/multi-sector/marker draft. */
export function OrnithopterMovement({
  game,
  act,
  busy,
  move,
  unavailableReason,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  move: Action | null;
  unavailableReason?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState<OrnithopterMode>('range3');
  const card = game.ornithopter;
  const me = game.players.find((p) => p.id === game.me);
  if (!card || !me) return null;
  const active = card.active;
  const mode =
    active?.mode ??
    (
      card.modes.find(
        (option) => option.mode === selected && !option.blocked,
      ) ??
      card.modes.find((option) => !option.blocked) ??
      card.modes[0]
    )?.mode;
  let reason =
    unavailableReason ??
    card.blocked ??
    (!active
      ? card.modes.find((option) => option.mode === mode)?.blocked
      : null) ??
    (!move || move.type !== 'move'
      ? 'Select a valid movement group and destination above.'
      : null);
  if (!reason && mode === 'twoGroups' && me.fremenMovementBlocked && move) {
    const selectedForces = typeof move.from === 'string'
      ? { [move.from]: Number(move.amount) }
      : (move.forces as Record<string, number> | undefined) ?? {};
    if (Object.entries(selectedForces).some(([from, count]) => count > 0 &&
      !botGroundMoveAllowed(game, me, from,
        location(String(move.territory), Number(move.sector)), 0)))
      reason = 'Karama removed this group’s two-territory advantage. Choose a reachable destination within the remaining normal range.';
  }
  const physicalSource =
    typeof move?.from === 'string'
      ? move.from
      : move?.forces && typeof move.forces === 'object'
        ? Object.keys(move.forces)[0]
        : undefined;
  if (
    !reason &&
    physicalSource &&
    isAdvisor(me, splitLocation(physicalSource).territory)
  )
    reason = 'Advanced advisor use of the Ornithopter card awaits its ruling.';
  if (!reason && active?.cohort && move) {
    const forces =
      (move.forces as Record<string, number> | undefined) ??
      (typeof move.from === 'string'
        ? { [move.from]: Number(move.amount) }
        : {});
    const elites =
      (move.eliteForces as Record<string, number> | undefined) ??
      (typeof move.from === 'string'
        ? { [move.from]: Number(move.elite ?? 0) }
        : {});
    const marker =
      game.richeseNoField?.owner === game.me
        ? game.richeseNoField.private?.deployed
        : null;
    try {
      validateCohortSelection(
        active.cohort,
        me.forces,
        me.elites?.forces ?? {},
        forces,
        elites,
        typeof move.noField === 'string' && marker
          ? {
              tokenId: move.noField,
              event: typeof move.event === 'string' ? move.event : '',
              from: location(marker.location.territory, marker.location.sector),
            }
          : undefined,
      );
    } catch (error) {
      reason =
        error instanceof Error && /cohort|original unmoved|marker/i.test(error.message)
          ? 'Choose forces that have not moved with this card. The first group cannot move again.'
          : 'The selected force counts are no longer available. Choose an available group.';
    }
  }
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-4"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>
        {active
          ? 'Ornithopter movement in progress'
          : 'Use Ornithopter for this movement'}
      </h3>
      <CardRules card={card.card} />
      <CardInspector card={card.card} />
      {active ? (
        <>
          <p>
            {active.completed} group moved · {active.remaining} remaining.{' '}
            {active.mode === 'twoGroups'
              ? 'The next group must use different original forces.'
              : 'This group has a maximum range of three territories.'}
          </p>
          {!!active.cohort && (
            <div className="flex flex-col gap-2">
              <p>Original unmoved forces available for selection:</p>
              <ul>
                {Object.entries(active.cohort.forces)
                  .filter(([, n]) => n > 0)
                  .map(([key, n]) => {
                    const source = splitLocation(key);
                    return (
                      <li key={key}>
                        {gameTerritories(game).find(
                          (t) => t.id === source.territory,
                        )?.name ?? source.territory}
                        , sector {source.sector}: {n} forces{me.elites ? `, including ${active.cohort!.elites[key] ?? 0} elite` : ''}.
                      </li>
                    );
                  })}
                {active.cohort.noField && (
                  <li>
                    One original unmoved concealed No-Field; select its current
                    source above.
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <label htmlFor={`${id}-mode`}>Card movement mode</label>
          <select
            id={`${id}-mode`}
            className="min-h-11 w-full min-w-0"
            value={mode}
            disabled={busy}
            onChange={(e) => setSelected(e.target.value as OrnithopterMode)}
          >
            {card.modes.map((option) => (
              <option
                key={option.mode}
                value={option.mode}
                disabled={!!option.blocked}
              >
                {option.mode === 'range3'
                  ? 'One group, up to three territories'
                  : 'Two different groups, normal movement'}
              </option>
            ))}
          </select>
          {card.modes
            .filter((option) => option.blocked)
            .map((option) => (
              <p className="fine" key={option.mode}>
                {option.mode === 'range3'
                  ? 'Three-territory mode'
                  : 'Two-group mode'}
                : {option.blocked}
              </p>
            ))}
          <p className="fine">
            Uses the forces, elite mix, No-Field and destination selected above.
            The card is played with the first move and discarded when its use
            ends. Storm and entry rules still apply.
          </p>
        </>
      )}
      {reason && (
        <p className="notice" id={`${id}-reason`}>
          {reason}
        </p>
      )}
      <Button
        className="min-h-11 whitespace-normal motion-reduce:transition-none"
        disabled={busy || !!reason}
        aria-describedby={reason ? `${id}-reason` : undefined}
        onClick={() => {
          if (busy || reason || !move || !mode) return;
          const action = { ...move };
          delete action.movementCard;
          delete action.ornithopter;
          delete action.ornithopterEvent;
          act({
            ...action,
            ...(active
              ? { ornithopterEvent: active.event }
              : { movementCard: card.card.id, ornithopter: mode }),
          });
        }}
      >
        {active
          ? 'Move next selected group'
          : 'Play Ornithopter and move selected group'}
      </Button>
    </section>
  );
}
