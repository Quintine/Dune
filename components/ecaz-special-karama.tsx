'use client';

import { useId, useState } from 'react';
import type { Action } from '@/game/engine';
import type { EcazSpecialKaramaQuote } from '@/game/ecaz-special-karama';
import { Button } from './ui/button';
import { CardInspector } from './card-inspector';

/** The parent supplies this private quote only to its Ecaz owner. */
export function EcazSpecialKarama({
  quote,
  act,
  busy,
}: {
  quote: EcazSpecialKaramaQuote | null;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [selection, setSelection] = useState('');
  if (!quote) return null;
  const karama = quote.cards.find((card) => card.id === selection) ?? quote.cards[0];
  const reason = quote.blocked ??
    (!quote.event ? 'No current battle event is available.' :
      !karama ? 'You need an available Karama card.' : null);
  return (
    <details className="my-4" open={quote.declared}>
      <summary className="min-h-11 cursor-pointer py-3">
        Ecaz special Karama: leader-disc difference
      </summary>
      <div className="flex flex-col gap-4 py-3">
        <p>
          Before Battle Plans are revealed, spend one Karama to declare your
          once-per-game special power. Your Battle Plan must contain neither a
          weapon nor a defense. You may declare before sealing your plan.
        </p>
        <p className="fine">
          Provisional prototype policy, not a publisher ruling: after reveal,
          the absolute difference between the printed or copied leader-disc
          values adds virtual dial strength. Other leader modifiers are excluded.
          This adds no physical forces, spice support payments or casualties.
          The bonus is not quoted from your opponent’s hidden plan.
        </p>
        {quote.declared ? (
          <output className="notice">
            Declared for this battle. Keep both your weapon and defense slots
            empty; the leader-disc bonus is determined after reveal.
          </output>
        ) : (
          <>
            {quote.cards.length > 0 && (
              <>
                <label htmlFor={`${id}-card`}>Karama to spend</label>
                <select
                  id={`${id}-card`}
                  className="min-h-11"
                  value={karama?.id ?? ''}
                  disabled={busy || !!reason}
                  onChange={(event) => setSelection(event.target.value)}
                >
                  {quote.cards.map((card) => (
                    <option value={card.id} key={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
                {karama && <CardInspector card={karama} />}
              </>
            )}
            {reason && (
              <p id={`${id}-reason`} className="notice">
                {reason}
              </p>
            )}
            <Button
              className="min-h-11 whitespace-normal"
              disabled={busy || !!reason}
              aria-describedby={reason ? `${id}-reason` : undefined}
              onClick={() => {
                if (!busy && !reason && quote.event && karama)
                  act({
                    type: 'card',
                    mode: 'special',
                    card: karama.id,
                    event: quote.event,
                  });
              }}
            >
              Spend Karama to declare the Ecaz leader-disc bonus
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
