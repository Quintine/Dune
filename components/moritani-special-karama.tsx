'use client';

import { useId, useState } from 'react';
import type { Action } from '@/game/engine';
import type { MoritaniSpecialKaramaView } from '@/game/moritani-special-karama';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

type Props = {
  quote: MoritaniSpecialKaramaView | null;
  act: (action: Action) => void;
  busy: boolean;
  /** The engine owns the opportunity's decline action; no Karama is spent. */
  declineAction: Action;
};

type Disposition = 'unchanged' | 'keep' | 'discard';

export function MoritaniSpecialKarama({ quote, act, busy, declineAction }: Props) {
  if (!quote) return null;
  return (
    <MoritaniSpecialKaramaChoice
      key={`${quote.source.event}:${quote.source.owner}:${quote.source.opponent}`}
      quote={quote}
      act={act}
      busy={busy}
      declineAction={declineAction}
    />
  );
}

function MoritaniSpecialKaramaChoice({ quote, act, busy, declineAction }: Omit<Props, 'quote'> & {
  quote: MoritaniSpecialKaramaView;
}) {
  const id = useId();
  const [activation, setActivation] = useState('');
  const [choices, setChoices] = useState<Record<string, Disposition>>({});
  const karama = quote.karamas.find(card => card.id === activation) ?? quote.karamas[0];
  const keep = quote.playedCards
    .filter(card => choices[card.id] === 'keep' && quote.keepableIds.includes(card.id))
    .map(card => card.id);
  const discard = quote.playedCards.filter(card => choices[card.id] === 'discard').map(card => card.id);
  const reason = !karama
    ? 'You need an available Karama Card.'
    : keep.length + discard.length === 0
      ? 'Force at least one card to be kept or discarded, or decline without spending a Karama.'
      : null;

  return (
    <section className="my-4 flex flex-col gap-4" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Moritani special Karama: opponent’s played cards</h3>
      <p>
        After your battle loss, spend one of your Karama Cards to force your opponent
        to keep or discard selected publicly revealed cards they played. Unchanged
        cards remain their choice. This uses your once-per-game special power.
      </p>
      <p className="fine">{quote.boundary}</p>
      <label htmlFor={`${id}-activation`}>Karama to spend</label>
      <select
        id={`${id}-activation`}
        className="min-h-11"
        value={karama?.id ?? ''}
        disabled={busy || !quote.karamas.length}
        onChange={event => setActivation(event.target.value)}
      >
        {quote.karamas.map(card => (
          <option value={card.id} key={card.id}>{card.name}</option>
        ))}
      </select>
      {karama && <CardInspector card={karama} />}
      {quote.playedCards.map((card, index) => {
        const keepable = quote.keepableIds.includes(card.id);
        const selected = choices[card.id] ?? 'unchanged';
        const disposition = selected === 'keep' && !keepable ? 'unchanged' : selected;
        return (
          <div className="flex flex-col gap-3" key={card.id}>
            <label htmlFor={`${id}-card-${index}`}>{card.name}: disposition</label>
            <select
              id={`${id}-card-${index}`}
              className="min-h-11"
              value={disposition}
              disabled={busy}
              onChange={event => setChoices(previous => ({
                ...previous,
                [card.id]: event.target.value as Disposition,
              }))}
            >
              <option value="unchanged">Unchanged — opponent chooses normally</option>
              <option value="keep" disabled={!keepable}>Force keep</option>
              <option value="discard">Force discard</option>
            </select>
            {!keepable && <p className="fine">Force keep is unavailable under the provisional mandatory-disposal precedence.</p>}
            <CardRules card={card} />
            <CardInspector card={card} />
          </div>
        );
      })}
      {reason && <p className="notice" id={`${id}-reason`}>{reason}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy || !!reason}
          aria-describedby={reason ? `${id}-reason` : undefined}
          onClick={() => {
            if (!busy && !reason && karama) act({
              type: 'card',
              mode: 'special',
              card: karama.id,
              event: quote.source.event,
              keep,
              discard,
            });
          }}
        >
          Spend Karama and force {keep.length + discard.length} card disposition(s)
        </Button>
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() => { if (!busy) act(declineAction); }}
        >
          Decline — keep your Karama
        </Button>
      </div>
    </section>
  );
}
