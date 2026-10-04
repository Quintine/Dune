'use client';

import { useState } from 'react';
import type { Action } from '@/game/engine';
import { homeworldCard } from '@/game/homeworld-cards';
import type { HomeworldOccupiedIncomeOffer } from '@/game/homeworld-occupied-income';
import { HomeworldFace } from './homeworld-cards';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type HomeworldOccupiedIncomeProps = {
  offer: HomeworldOccupiedIncomeOffer | null;
  act: (action: Action) => void;
  busy: boolean;
};

export function HomeworldOccupiedIncome({ offer, act, busy }: HomeworldOccupiedIncomeProps) {
  if (!offer) return null;
  return <IncomeChoice key={`${offer.event}:${offer.world}`} offer={offer} act={act} busy={busy} />;
}

function IncomeChoice({ offer, act, busy }: HomeworldOccupiedIncomeProps & { offer: HomeworldOccupiedIncomeOffer }) {
  const [ownAmount, setOwnAmount] = useState(offer.amount);
  const valid = Number.isSafeInteger(ownAmount) && ownAmount >= offer.minOwnAmount && ownAmount <= offer.maxOwnAmount;
  const card = homeworldCard(offer.card)!;
  return (
    <section aria-label="Occupied Homeworld bank income" className="space-y-3">
      <h3>{offer.name} · occupied bank income</h3>
      <p>
        Collect {offer.amount} spice from the Bank. Keep all of it
        {offer.allyName ? `, or immediately allocate any portion to ${offer.allyName}.` : '; you have no reciprocal ally to share with.'}
      </p>
      <p className="fine">
        This is the printed Homeworld bank award, not a percentage of payments or a bribe from your personal spice.
        Homeworld effects cannot be canceled by Karama.
      </p>
      <details className="rounded-lg border border-[#a88b60]/50 p-3">
        <summary className="cursor-pointer py-2">Inspect {offer.name} source card</summary>
        <HomeworldFace card={card} />
      </details>
      {offer.blocked && <output className="notice block">{offer.blocked}</output>}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !offer.blocked && valid)
            act({ type: 'decision', event: offer.event, world: offer.world, ownAmount });
        }}
      >
        {offer.ally && (
          <>
            <label className="block space-y-1">
              <span>Spice to keep · {offer.minOwnAmount}–{offer.maxOwnAmount}</span>
              <Input
                aria-label="Occupied bank spice to keep"
                type="number"
                min={offer.minOwnAmount}
                max={offer.maxOwnAmount}
                step={1}
                value={Number.isNaN(ownAmount) ? '' : ownAmount}
                disabled={busy || !!offer.blocked}
                onChange={(event) => setOwnAmount(event.target.value === '' ? Number.NaN : Number(event.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy || !!offer.blocked} onClick={() => setOwnAmount(offer.amount)}>
                Keep all
              </Button>
              <Button type="button" variant="outline" disabled={busy || !!offer.blocked} onClick={() => setOwnAmount(0)}>
                Give all to {offer.allyName}
              </Button>
            </div>
          </>
        )}
        <output className="notice block" aria-live="polite">
          {valid
            ? `Bank credits: ${offer.ownerName} ${ownAmount}${offer.allyName ? ` · ${offer.allyName} ${offer.amount - ownAmount}` : ''}. Total ${offer.amount}.`
            : `Keep a whole number from ${offer.minOwnAmount} through ${offer.maxOwnAmount}.`}
        </output>
        <Button type="submit" className="game-action" disabled={busy || !!offer.blocked || !valid}>
          Settle {offer.name} bank award
        </Button>
      </form>
    </section>
  );
}
