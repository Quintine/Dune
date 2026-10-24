'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export type AmbassadorNoFieldOffer = NonNullable<
  NonNullable<GameView['ambassadorEntry']>['noField']
>;

const titles: Record<AmbassadorNoFieldOffer['stage'], string> = {
  own: 'Use your No-Field',
  request: 'Request an allied No-Field',
  supply: 'Supply an allied No-Field',
  consent: 'Confirm allied No-Field shipment',
};

const submitLabels: Record<AmbassadorNoFieldOffer['stage'], string> = {
  own: 'Confirm No-Field choice',
  request: 'Request selected No-Field shipment',
  supply: 'Offer selected No-Field shipment',
  consent: 'Accept selected No-Field offer',
};

/** Receives complete server actions; selecting a marker never edits a physical shipment. */
export function AmbassadorNoFieldChoice({
  offer,
  event,
  selectedKey,
  onSelect,
  act,
  busy,
  id = 'ambassador-no-field-choice',
}: {
  offer: AmbassadorNoFieldOffer;
  event: string;
  selectedKey: string;
  onSelect: (key: string) => void;
  act: (action: Action) => void;
  busy: boolean;
  id?: string;
}) {
  const selected = offer.options.find((option) => option.key === selectedKey);
  const reason = selected?.blocked ??
    (selected ? null : 'Choose a No-Field option.');
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded border p-3"
      aria-label="Ambassador No-Field shipment"
      data-event={event}
      data-stage={offer.stage}
    >
      <h4 className="m-0 font-semibold">{titles[offer.stage]}</h4>
      <p className="m-0 text-sm leading-6">
        Choose a No-Field as the entire Ambassador shipment grant.
      </p>
      <p className="m-0 text-sm leading-6">{offer.policy}</p>
      <label className="flex flex-col gap-2" htmlFor={`${id}-option`}>
        No-Field choice
        <select
          id={`${id}-option`}
          className="min-h-11"
          value={selected?.key ?? ''}
          disabled={busy || !offer.options.length}
          onChange={(e) => {
            if (!busy) onSelect(e.target.value);
          }}
        >
          <option value="">Choose a No-Field option</option>
          {offer.options.map((option) => (
            <option key={option.key} value={option.key} disabled={!!option.blocked}>
              {option.label}{option.blocked ? ` · ${option.blocked}` : ''}
            </option>
          ))}
        </select>
      </label>
      {reason && <p id={`${id}-reason`} className="m-0 text-sm">{reason}</p>}
      <Button
        data-testid="ambassador-no-field-submit"
        className="min-h-11 whitespace-normal"
        disabled={busy || !!reason}
        aria-describedby={reason ? `${id}-reason` : undefined}
        onClick={() => {
          if (!busy && selected && !selected.blocked) act(selected.action);
        }}
      >
        {submitLabels[offer.stage]}
      </Button>
      {offer.decline && (
        <Button
          data-testid="ambassador-no-field-decline"
          className="min-h-11 whitespace-normal"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!busy && offer.decline) act(offer.decline);
          }}
        >
          {offer.declineLabel ?? 'Decline No-Field offer'}
        </Button>
      )}
    </section>
  );
}

function AmbassadorNoFieldSelection({
  offer,
  event,
  act,
  busy,
}: {
  offer: AmbassadorNoFieldOffer;
  event: string;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [selectedKey, setSelectedKey] = useState('');
  return (
    <AmbassadorNoFieldChoice
      id={id}
      offer={offer}
      event={event}
      selectedKey={selectedKey}
      onSelect={setSelectedKey}
      act={act}
      busy={busy}
    />
  );
}

export function AmbassadorNoField({
  game,
  act,
  busy,
  destination,
  sector,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  destination?: string;
  sector?: number;
}) {
  const entry = game.ambassadorEntry;
  if (
    entry?.stage !== 'ship' ||
    game.decision?.kind !== 'ecazAmbassador' ||
    game.decision.player !== game.me ||
    !entry.noField
  ) return null;
  const offer = entry.noField;
  const filtered = offer.stage === 'own' || offer.stage === 'request'
    ? {
        ...offer,
        options: offer.options.filter((option) =>
          !option.territory ||
          ((!destination || option.territory === destination) &&
            (sector === undefined || option.sector === sector)),
        ),
      }
    : offer;
  return (
    <AmbassadorNoFieldSelection
      key={`${entry.event}:${offer.stage}:${destination ?? ''}:${sector ?? ''}`}
      offer={filtered}
      event={entry.event}
      act={act}
      busy={busy}
    />
  );
}
