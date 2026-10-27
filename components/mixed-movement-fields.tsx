'use client';

import type { GameView } from '@/game/engine';
import { TERRITORIES } from '@/game/board';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { MOVEMENT_EXPRESSION_MAX_DEPTH, MOVEMENT_EXPRESSION_MAX_LEAVES } from '@/game/movement-expression-promises';
import { parseMovementClaim, type MovementClaim } from '@/game/movement-promises';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

type MixedMovementExpression = MixedActionExpression<MovementClaim>;
const config: MixedActionConfig<MovementClaim> = {
  prefix: 'mixed-movement',
  legend: 'Mixed current-fact / future ground-movement claim',
  actionLabel: 'ground-movement condition',
  actionTiming: 'Future ground move · this turn',
  actionHelp: <>Each movement condition needs one actual future ground move after the answer, before your Movement turn ends this round.
    You may name an exact sector. Smaller moves never add together. Prior moves and shipments do not count. The claim grants no extra movement opportunity.</>,
  fallbackError: 'Choose a current fact and a future ground-movement condition.',
  maxLeaves: MOVEMENT_EXPRESSION_MAX_LEAVES,
  maxDepth: MOVEMENT_EXPRESSION_MAX_DEPTH,
  newAction: () => ({ territory: 'carthag', minimum: 1 }),
  parseAction: parseMovementClaim,
  renderAction: ({ value, id, disabled, onChange }) => <>
    <label htmlFor={`${id}-territory`}>Ground-movement destination</label>
    <select id={`${id}-territory`} value={TERRITORIES.some(destination => destination.id === value.territory) ? value.territory : ''}
      disabled={disabled} aria-invalid={!TERRITORIES.some(destination => destination.id === value.territory)}
      onChange={event => onChange({ territory: event.currentTarget.value, minimum: value.minimum })}>
      <option value="">Choose a printed Arrakis territory</option>
      {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
    </select>
    <label htmlFor={`${id}-sector`}>Ground-movement sector</label>
    <select id={`${id}-sector`} disabled={disabled} value={value.sector === undefined ? '' : String(value.sector)}
      aria-invalid={value.sector !== undefined && !TERRITORIES.find(row => row.id === value.territory)?.sectors.includes(value.sector)}
      onChange={event => {
        const selected = event.currentTarget.value, printed = TERRITORIES.find(row => row.id === value.territory);
        if (selected === '') onChange({ territory: value.territory, minimum: value.minimum });
        else { const sector = Number(selected); if (printed?.sectors.includes(sector)) onChange({ ...value, sector }); }
      }}>
      <option value="">Any sector in this territory</option>
      {TERRITORIES.find(row => row.id === value.territory)?.sectors.map(sector => <option key={sector} value={sector}>Sector {sector}</option>)}
    </select>
    <label htmlFor={`${id}-minimum`}>Minimum physical forces in one ground move</label>
    <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
      value={Number.isNaN(value.minimum) ? '' : value.minimum}
      aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 || value.minimum > 20}
      onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
  </>,
};

/** Keep the movement API and rendered control identifiers stable. */
export function mixedMovementInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}
export function MixedMovementFields(props: {
  value: MixedMovementExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedMovementExpression) => void;
}) {
  return MixedActionFields({ ...props, config });
}
