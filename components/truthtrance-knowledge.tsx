'use client';

import { useId } from 'react';
import { FACTIONS } from '@/game/catalog';
import { territory } from '@/game/board';
import { knowledgeFactInputError, PRESCIENCE_LEADER_NAMES, SPICE_PEEK_VALUES, type KnowledgeFact } from '@/game/truthtrance-knowledge';
import { TRUTH_CARD_NAMES } from '@/game/truthtrance-card-names';
import { Input } from '@/components/ui/input';

type NumericKnowledgeFact = Exclude<KnowledgeFact, { kind: 'prediction'; field: 'faction' } | { kind: 'spicePeek' } | { kind: 'auctionPeek' } | { kind: 'cacheLot' } | { kind: 'ixPoolPeek' } | { kind: 'presciencePeek' }>;
function isNumericKnowledgeFact(fact: KnowledgeFact): fact is NumericKnowledgeFact {
  return fact.kind !== 'spicePeek' && fact.kind !== 'auctionPeek' && fact.kind !== 'cacheLot' && fact.kind !== 'ixPoolPeek' && fact.kind !== 'presciencePeek' && (fact.kind !== 'prediction' || fact.field === 'turn');
}

export function KnowledgeFactFields({
  value,
  onChange,
}: {
  value: KnowledgeFact;
  onChange: (fact: KnowledgeFact) => void;
}) {
  const id = useId();
  const isFaction = value.kind === 'prediction' && value.field === 'faction';
  const numericValue = isNumericKnowledgeFact(value) ? value : null;
  const isTurn = numericValue?.kind === 'prediction' && numericValue.field === 'turn';
  const min = isTurn ? 1 : numericValue?.kind === 'stormForecast' ? 1 : 0;
  const max = isTurn ? 10 : numericValue?.kind === 'stormForecast' ? 6 : 20;
  const invalid = knowledgeFactInputError(value);
  return (
    <>
      {value.kind === 'presciencePeek' ? (
        <>
          <label>
            Inspected battle plan field
            <select value={value.field} onChange={(event) => {
              const field = event.target.value;
              if (field === 'dial') onChange({ kind: 'presciencePeek', field, value: 0 });
              else if (field === 'leader' || field === 'weapon' || field === 'defense')
                onChange({ kind: 'presciencePeek', field, name: 'None' });
            }}>
              <option value="leader">Leader</option>
              <option value="weapon">Weapon</option>
              <option value="defense">Defense</option>
              <option value="dial">Dial</option>
            </select>
          </label>
          {value.field === 'dial' ? <label htmlFor={`${id}-prescience-dial`}>
            Inspected dial value
            <Input id={`${id}-prescience-dial`} type="number" min={0} step={0.5} required
              value={Number.isNaN(value.value) ? '' : value.value}
              aria-invalid={!!invalid}
              aria-describedby={`${id}-prescience-help${invalid ? ` ${id}-error` : ''}`}
              onChange={(event) => onChange({ ...value, value: event.currentTarget.valueAsNumber })} />
          </label> : <label>
            Inspected {value.field} name
            <select value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })}>
              <option value="None">None</option>
              {(value.field === 'leader' ? PRESCIENCE_LEADER_NAMES : TRUTH_CARD_NAMES)
                .filter(name => name !== 'None')
                .map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>}
          <p id={`${id}-prescience-help`} className="fine">This asks what the target currently knows from Prescience in this battle. If that field is unknown or no longer available, the answer is I don’t know. Only the answer is published.</p>
        </>
      ) : value.kind === 'ixPoolPeek' ? (
        <>
          <label>
            Recorded Ixian inspected auction pool includes
            <select value={value.name} onChange={(event) => onChange({ kind: 'ixPoolPeek', name: event.target.value })}>
              {TRUTH_CARD_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <p className="fine">In Basic Bidding, this asks whether the named card is in the Ixian’s recorded inspected auction pool. If that knowledge is unavailable, the answer is I don’t know. Only the answer is published; the pool itself remains private.</p>
        </>
      ) : value.kind === 'cacheLot' ? (
        <>
          <label>
            Public Basic Richese cache auction card
            <select value={value.name} onChange={(event) => onChange({ kind: 'cacheLot', name: event.target.value })}>
              {TRUTH_CARD_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <p className="fine">This asks about the current public Richese cache auction card in Basic play. If that auction is unavailable, the answer is I don’t know. Only the answer is published.</p>
        </>
      ) : value.kind === 'auctionPeek' ? (
        <>
          <label>
            Inspected auction card
            <select value={value.name} onChange={(event) => onChange({ kind: 'auctionPeek', name: event.target.value })}>
              {TRUTH_CARD_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <p className="fine">This asks about the current ordinary auction card the target has privately inspected. If no current card is known, the answer is I don’t know. Only the answer is published.</p>
        </>
      ) : value.kind === 'spicePeek' ? (
        <>
          <label>
            Next Spice Blow card
            <select value={value.value} onChange={(event) => onChange({ kind: 'spicePeek', value: event.target.value })}>
              {SPICE_PEEK_VALUES.map((option) => <option key={option} value={option}>
                {option === 'worm' ? 'Sandworm' : option === 'sandtrout' ? 'Sandtrout' : territory(option).name}
              </option>)}
            </select>
          </label>
          <p className="fine">This asks about the card the target currently knows from their private Spice Blow peek. If no card is known, the answer is I don’t know. Only the answer is published.</p>
        </>
      ) : isFaction ? (
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
