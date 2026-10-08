'use client';

import { useId, useState } from 'react';
import { splitLocation, territory } from '@/game/board';
import { defaultSmugglerBattleAllocation, type SmugglerBattleCollectionOffer } from '@/game/smuggler-battle';
import { Button } from './ui/button';
import { Input } from './ui/input';

function initialAllocation(offer: SmugglerBattleCollectionOffer): Record<string, string> {
  const allocations = defaultSmugglerBattleAllocation(offer.piles, offer.amount);
  return Object.fromEntries(Object.keys(offer.piles).map(key => [key, String(allocations[key] ?? 0)]));
}

export function SmugglerBattleCollection({ offer, busy, act }: {
  offer: SmugglerBattleCollectionOffer;
  busy: boolean;
  act: (action: { type: 'decision'; event: string; allocations: Record<string, number> }) => void;
}) {
  const id = useId();
  const [selection, setSelection] = useState(() => ({ event: offer.event, values: initialAllocation(offer) }));
  const values = selection.event === offer.event ? selection.values : initialAllocation(offer);
  const entries = Object.entries(offer.piles).sort(([a], [b]) => a.localeCompare(b));
  const allocations: Record<string, number> = {};
  let total = 0;
  let legal = true;
  for (const [key, available] of entries) {
    const text = values[key] ?? '';
    const amount = Number(text);
    if (!text.trim() || !Number.isSafeInteger(amount) || amount < 0 || amount > available) legal = false;
    if (amount > 0) allocations[key] = amount;
    total += amount;
  }
  legal = legal && total === offer.amount;

  return (
    <section aria-label="Smuggler battle collection sectors" className="notice space-y-3">
      <h4>Choose Smuggler collection sectors</h4>
      <p>
        Your Smuggler survived. Collect exactly {offer.amount} spice from the
        revealed piles in {territory(offer.territory).name} before battle settlement.
      </p>
      <p className="text-sm">
        <strong>Provisional allocation policy:</strong> you choose the sectors.
        This prototype policy is not a publisher ruling; the total and unmodified
        leader-strength cap do not change.
      </p>
      {entries.map(([key, available], index) => (
        <label key={key} htmlFor={`${id}-${index}`} className="block">
          Sector {splitLocation(key).sector}: collect 0–{available} spice
          <Input
            id={`${id}-${index}`}
            type="number"
            min={0}
            max={available}
            step={1}
            disabled={busy}
            value={values[key] ?? ''}
            onChange={(event) => setSelection({
              event: offer.event,
              values: { ...values, [key]: event.target.value },
            })}
          />
        </label>
      ))}
      <output className="block" aria-live="polite">
        {legal ? `${total} of ${offer.amount} spice selected.` :
          `Choose whole spice within each pile's limit, totaling exactly ${offer.amount}.`}
      </output>
      <Button disabled={busy || !legal} onClick={() => {
        if (legal && !busy) act({ type: 'decision', event: offer.event, allocations });
      }}>
        Collect {offer.amount} spice
      </Button>
    </section>
  );
}
