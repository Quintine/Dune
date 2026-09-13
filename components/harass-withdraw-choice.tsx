'use client';

import { useId, useState } from 'react';
import { splitLocation, territory } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import {
  defaultHarassWithdrawAllocation,
  harassWithdrawCommitments,
  quoteHarassWithdraw,
  type HarassWithdrawContext,
  type HarassWithdrawForces,
  type HarassWithdrawSelection,
} from '@/game/harass-withdraw';
import { Button } from './ui/button';
import { Input } from './ui/input';

function compactSelection(selection: HarassWithdrawSelection) {
  return Object.fromEntries(
    Object.entries(selection)
      .filter(([, group]) => group.normal || group.elite)
      .map(([key, group]) => [key, { ...group }]),
  );
}

export function harassWithdrawChoiceState(
  context: HarassWithdrawContext,
  dial: number,
  support: number,
  selection: HarassWithdrawSelection,
) {
  try {
    const quote = quoteHarassWithdraw(
      context,
      dial,
      support,
      compactSelection(selection),
    );
    return { blocked: null, quote };
  } catch (error) {
    return {
      blocked:
        error instanceof Error
          ? error.message
          : 'Choose the exact forces that return.',
      quote: null,
    };
  }
}

function locationLabel(key: string) {
  const location = splitLocation(key);
  return `${territory(location.territory).name} · sector ${location.sector}`;
}

export function HarassWithdrawChoice({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const decision = g.decision;
  const offer = g.battle?.harassAllocation;
  const current =
    decision?.kind === 'harassWithdraw' &&
    decision.player === g.me &&
    offer?.event === decision.event;
  const context = offer?.context;
  const commitments = context
    ? harassWithdrawCommitments(context, offer.dial, offer.support)
    : [];
  const initial = context
    ? (offer?.selection ??
      defaultHarassWithdrawAllocation(
        context,
        offer.dial,
        offer.support,
        commitments[0],
      ))
    : {};
  const [selection, setSelection] = useState<HarassWithdrawSelection>(initial);
  if (!current || !offer || !context) return null;

  const state = harassWithdrawChoiceState(
    context,
    offer.dial,
    offer.support,
    selection,
  );
  const selectedCommitment = state.quote?.remaining;
  const commitmentValue = selectedCommitment
    ? `${selectedCommitment.normal}:${selectedCommitment.elite}`
    : '';
  const update = (
    key: string,
    kind: keyof HarassWithdrawForces,
    value: number,
  ) =>
    setSelection((previous) => ({
      ...previous,
      [key]: {
        normal: previous[key]?.normal ?? 0,
        elite: previous[key]?.elite ?? 0,
        [kind]: value,
      },
    }));

  return (
    <section
      aria-label="Harass and Withdraw force allocation"
      className="notice space-y-3"
    >
      <h4>Choose Harass &amp; Withdraw forces</h4>
      <p>
        Your Battle Plan is revealed. Choose the exact undialed counters that
        return to reserves before the Traitor decision.
      </p>
      <label htmlFor={`${id}-commitment`}>Dialed physical commitment</label>
      <select
        id={`${id}-commitment`}
        value={commitmentValue}
        onChange={(event) => {
          const commitment = commitments.find(
            (candidate) =>
              `${candidate.normal}:${candidate.elite}` === event.target.value,
          );
          if (commitment)
            setSelection(
              defaultHarassWithdrawAllocation(
                context,
                offer.dial,
                offer.support,
                commitment,
              ),
            );
        }}
      >
        {!selectedCommitment && (
          <option value="" disabled>
            Complete the return allocation
          </option>
        )}
        {commitments.map((commitment) => (
          <option
            key={`${commitment.normal}:${commitment.elite}`}
            value={`${commitment.normal}:${commitment.elite}`}
          >
            {commitment.normal} ordinary · {commitment.elite} elite
          </option>
        ))}
      </select>
      {Object.entries(context.locations)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, available]) => (
          <fieldset key={key} className="grid gap-2 rounded-lg border p-3">
            <legend>{locationLabel(key)}</legend>
            {(['normal', 'elite'] as const).map((kind) => (
              <label key={kind}>
                Return {kind === 'normal' ? 'ordinary' : 'elite'} (0–
                {available[kind]})
                <Input
                  type="number"
                  min={0}
                  max={available[kind]}
                  step={1}
                  value={selection[key]?.[kind] ?? 0}
                  onChange={(event) =>
                    update(key, kind, Number(event.target.value))
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
      {state.quote ? (
        <p>
          Return {state.quote.returned.normal} ordinary and{' '}
          {state.quote.returned.elite} elite forces.
        </p>
      ) : (
        <output className="block">{state.blocked}</output>
      )}
      <Button
        disabled={busy || !state.quote}
        onClick={() =>
          act({
            type: 'decision',
            event: decision.event,
            returns: compactSelection(selection),
          })
        }
      >
        Confirm returned forces
      </Button>
    </section>
  );
}
