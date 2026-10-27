'use client';

import { TERRITORIES } from '@/game/board';
import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { parseTravelActionClaim, TRAVEL_MAX_DEPTH, TRAVEL_MAX_LEAVES, type TravelActionClaim } from '@/game/travel-expression-promises';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

type TravelExpression = MixedActionExpression<TravelActionClaim>;
const config: MixedActionConfig<TravelActionClaim> = {
  prefix: 'travel',
  legend: 'Future shipment / ground-movement claim, with optional current facts',
  actionLabel: 'shipment or ground-movement condition',
  actionTiming: 'Future shipment or ground move · this turn',
  actionHelp: <>Shipment conditions concern your single future original reserve shipment after the answer.
    Choose any sector or one exact printed sector in that territory; only that sector satisfies an exact condition.
    Ground-movement conditions concern one actual future ground move before your Movement turn ends this round; its sector may also be named.
    Count physical forces in one action; smaller moves never add together. Earlier actions do not count.
    OR keeps legal shipment and movement alternatives available. No makes the whole expression false.
    Original costs, movement rights, cards and preparation still apply; this claim grants no extra shipment or movement.</>,
  fallbackError: 'Choose a future shipment or ground-movement condition, with optional current facts.',
  maxLeaves: TRAVEL_MAX_LEAVES,
  maxDepth: TRAVEL_MAX_DEPTH,
  requireFact: false,
  newAction: () => ({ kind: 'ship', territory: 'carthag', minimum: 1 }),
  parseAction: parseTravelActionClaim,
  renderAction: ({ value, id, disabled, onChange }) => <>
    <label htmlFor={`${id}-action`}>Future action</label>
    <select id={`${id}-action`} value={value.kind} disabled={disabled} onChange={event => {
      const kind = event.currentTarget.value;
      if ((kind === 'ship' || kind === 'move') && kind !== value.kind)
        onChange({ kind, territory: value.territory, minimum: value.minimum });
    }}>
      <option value="ship">Ship from reserves</option>
      <option value="move">Make ground movement</option>
    </select>
    <label htmlFor={`${id}-territory`}>{value.kind === 'ship' ? 'Reserve-shipment destination' : 'Ground-movement destination'}</label>
    <select id={`${id}-territory`} value={TERRITORIES.some(destination => destination.id === value.territory) ? value.territory : ''}
      disabled={disabled} aria-invalid={!TERRITORIES.some(destination => destination.id === value.territory)}
      onChange={event => {
        const destination = event.currentTarget.value;
        onChange({ kind: value.kind, territory: destination, minimum: value.minimum });
      }}>
      <option value="">Choose a printed Arrakis territory</option>
      {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
    </select>
    {(value.kind === 'ship' || value.kind === 'move') && (() => {
      const printed = TERRITORIES.find(destination => destination.id === value.territory);
      return <>
        <label htmlFor={`${id}-sector`}>{value.kind === 'ship' ? 'Shipment sector' : 'Ground-movement sector'}</label>
        <select id={`${id}-sector`} disabled={disabled} value={value.sector === undefined ? '' : String(value.sector)}
          aria-invalid={value.sector !== undefined && !printed?.sectors.includes(value.sector)} onChange={event => {
            const selected = event.currentTarget.value;
            if (selected === '') onChange({ kind: value.kind, territory: value.territory, minimum: value.minimum });
            else {
              const sector = Number(selected);
              if (printed?.sectors.includes(sector)) onChange({ ...value, sector });
            }
          }}>
          <option value="">Any sector in this territory</option>
          {printed?.sectors.map(sector => <option key={sector} value={sector}>Sector {sector}</option>)}
        </select>
      </>;
    })()}
    <label htmlFor={`${id}-minimum`}>Minimum physical forces in one {value.kind === 'ship' ? 'reserve shipment' : 'ground move'}</label>
    <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
      value={Number.isNaN(value.minimum) ? '' : value.minimum}
      aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 || value.minimum > 20}
      onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
  </>,
};

/** Only public printed choices belong here; native eligibility stays on the server. */
export function travelClaimInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}

export function TravelClaimFields(props: {
  value: TravelExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: TravelExpression) => void;
}) {
  return MixedActionFields({ ...props, config });
}
