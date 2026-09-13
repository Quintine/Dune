'use client';

import { useId } from 'react';
import { FACTIONS } from '@/game/catalog';
import type { TruthFact } from '@/game/truthtrance';
import { knowledgeFactInputError } from '@/game/truthtrance-knowledge';
import { Input } from '@/components/ui/input';

type KnowledgeFact = Extract<TruthFact, { kind: 'prediction' | 'stormDial' | 'stormForecast' }>;
type NumericKnowledgeFact = Exclude<KnowledgeFact, { kind: 'prediction'; field: 'faction' }>;
function isNumericKnowledgeFact(fact: KnowledgeFact): fact is NumericKnowledgeFact {
  return fact.kind !== 'prediction' || fact.field === 'turn';
}

export function KnowledgeFactFields({
  value,
  onChange,
}: {
  value: KnowledgeFact;
  onChange: (fact: KnowledgeFact) => void;
}) {
  const id = useId();
  const isFaction = !isNumericKnowledgeFact(value);
  const numericValue = isNumericKnowledgeFact(value) ? value : null;
  const isTurn = numericValue?.kind === 'prediction' && numericValue.field === 'turn';
  const min = isTurn ? 1 : numericValue?.kind === 'stormForecast' ? 1 : 0;
  const max = isTurn ? 10 : numericValue?.kind === 'stormForecast' ? 6 : 20;
  const invalid = knowledgeFactInputError(value);
  return (
    <>
      {isFaction ? (
        <label>
          Predicted faction
          <select
            value={value.faction}
            onChange={(event) => onChange({ ...value, faction: event.target.value as typeof value.faction })}
          >
            {FACTIONS.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}
          </select>
        </label>
      ) : numericValue && (
        <>
          {(isTurn || numericValue.kind === 'stormDial' || numericValue.kind === 'stormForecast') && (
            <label>
              Compare stored value
              <select
                value={numericValue.compare}
                onChange={(event) => onChange({ ...numericValue, compare: event.target.value as typeof numericValue.compare })}
              >
                <option value="eq">Exactly</option><option value="gte">At least</option><option value="lte">At most</option>
              </select>
            </label>
          )}
          <label htmlFor={`${id}-value`}>
            {numericValue.kind === 'stormDial' ? 'Storm dial value' : numericValue.kind === 'stormForecast' ? 'Storm forecast sector' : 'Turn number'}
            <Input
              id={`${id}-value`}
              type="number"
              min={min}
              max={max}
              step={1}
              required
              value={Number.isNaN(numericValue.value) ? '' : numericValue.value}
              aria-invalid={!!invalid}
              aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`}
              onChange={(event) => onChange({ ...numericValue, value: event.currentTarget.valueAsNumber })}
            />
          </label>
          <p id={`${id}-help`} className="fine">
            This asks about an already recorded choice or a forecast the target currently knows. If no such value is available, the answer is I don’t know. Only the answer is published.
          </p>
        </>
      )}
      {isFaction && <p className="fine">This asks about an already recorded faction choice. If no such value is available, the answer is I don’t know. Only the answer is published.</p>}
      {invalid && <p id={`${id}-error`} className="notice" role="alert">{invalid}</p>}
    </>
  );
}
