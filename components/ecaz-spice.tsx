'use client';

import { useId, useState } from 'react';
import type { AllocationState } from '@/game/ecaz-spice-allocation';
import { territory } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';

const buttonClass = 'min-h-11 whitespace-normal motion-reduce:transition-none';

/** Parent key: event + allocation.index + allocation.player. A new lot or
 * negotiating turn starts with a fresh draft rather than an old proposal. */
export function EcazSpice({
  event,
  allocation,
  me,
  players,
  send,
  busy,
}: {
  event: string;
  allocation: AllocationState;
  me: string;
  players: readonly { id: string; name: string }[];
  send: (action: { type: string; [key: string]: unknown }) => void;
  busy: boolean;
}) {
  const id = useId();
  const lot = allocation.lots[allocation.index];
  const [draft, setDraft] = useState(() =>
    String(Math.floor((lot?.amount ?? 0) / 2)),
  );
  if (!lot || allocation.player !== me) return null;
  const name = (player: string) =>
    players.find((p) => p.id === player)?.name ?? player;
  const ecazName = name(lot.ecaz);
  const allyName = name(lot.ally);
  const ecazShare = Number(draft);
  const valid =
    draft.trim() !== '' &&
    Number.isSafeInteger(ecazShare) &&
    ecazShare >= 0 &&
    ecazShare <= lot.amount;
  const equalEcaz = Math.floor(lot.amount / 2);
  const equalAlly = lot.amount - equalEcaz;
  const offer = allocation.offer;
  return (
    <section
      className="notice flex min-w-0 flex-col gap-4"
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className="m-0 font-serif text-xl">
        Share spice from {territory(lot.territory).name}
      </h3>
      <p id={`${id}-pool`} className="m-0 text-sm leading-6">
        Divide this shared pool of <strong>{lot.amount} spice</strong> between{' '}
        {ecazName} (Ecaz{me === lot.ecaz ? ', you' : ''}) and {allyName} (ally
        {me === lot.ally ? ', you' : ''}). This choice applies only to the
        shared spice collected here.
      </p>
      {offer && (
        <output className="m-0 text-sm leading-6">
          {name(offer.by)} proposes {offer.ecazShare} spice for {ecazName} and{' '}
          {lot.amount - offer.ecazShare} for {allyName}. Accept this split or
          propose another.
        </output>
      )}
      <form
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !valid) return;
          send({
            type: 'decision',
            event,
            allocation: { kind: 'propose', ecazShare },
          });
        }}
      >
        <label className="flex flex-col gap-2" htmlFor={`${id}-share`}>
          Ecaz share · {ecazName}
          <Input
            id={`${id}-share`}
            className="min-h-11"
            type="number"
            min={0}
            max={lot.amount}
            step={1}
            value={draft}
            disabled={busy}
            aria-invalid={!valid}
            aria-describedby={`${id}-shares`}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <p
          id={`${id}-shares`}
          className="m-0 text-sm leading-6"
          aria-live="polite"
        >
          {valid
            ? `Proposed split: ${ecazShare} for ${ecazName}, ${lot.amount - ecazShare} for ${allyName}.`
            : `Enter a whole number from 0 to ${lot.amount}.`}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            className={buttonClass}
            disabled={busy || !valid}
          >
            {offer ? 'Send counterproposal' : 'Propose split'}
          </Button>
          {offer && (
            <Button
              type="button"
              className={buttonClass}
              variant="outline"
              disabled={busy || offer.by === me}
              onClick={() =>
                send({
                  type: 'decision',
                  event,
                  allocation: { kind: 'accept' },
                })
              }
            >
              Accept proposed split
            </Button>
          )}
        </div>
      </form>
      <p className="m-0 text-sm leading-6">
        Equal fallback: {equalEcaz} spice for {ecazName}, {equalAlly} for{' '}
        {allyName}. The ally receives any odd remainder.
      </p>
      <Button
        type="button"
        className={buttonClass}
        variant="outline"
        disabled={busy}
        onClick={() =>
          send({ type: 'decision', event, allocation: { kind: 'equal' } })
        }
      >
        Use equal split
      </Button>
    </section>
  );
}
