'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { TRUTH_CARD_NAMES } from '@/game/truthtrance';
import type { CardCountFact } from '@/game/truthtrance-card-count';

export function CardCountFields({
  value,
  onChange,
}: {
  value: CardCountFact;
  onChange: (fact: CardCountFact) => void;
}) {
  const id = useId();
  const invalid = !Number.isSafeInteger(value.value) || value.value < 0;
  return (
    <>
      <label>
        Card name
        <select
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        >
          {TRUTH_CARD_NAMES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        Compare card count
        <select
          value={value.compare}
          onChange={(event) =>
            onChange({
              ...value,
              compare: event.target.value as CardCountFact['compare'],
            })
          }
        >
          <option value="eq">Exactly</option>
          <option value="gte">At least</option>
          <option value="lte">At most</option>
        </select>
      </label>
      <label htmlFor={`${id}-count`}>
        Number of copies
        <Input
          id={`${id}-count`}
          type="number"
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          required
          value={Number.isNaN(value.value) ? '' : value.value}
          aria-invalid={invalid}
          aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`}
          onChange={(event) =>
            onChange({ ...value, value: event.currentTarget.valueAsNumber })
          }
        />
      </label>
      <p id={`${id}-help`} className="fine">
        Counts copies of this exact named card in the player’s hand now. Cards
        in the deck, discard pile, or a separate cache do not count. The answer
        reveals only whether the comparison is true.
      </p>
      {invalid && (
        <p id={`${id}-error`} className="notice" role="alert">
          {Number.isInteger(value.value) &&
          value.value > Number.MAX_SAFE_INTEGER
            ? 'That card count is too large.'
            : 'Enter a whole card count of zero or more.'}
        </p>
      )}
    </>
  );
}
