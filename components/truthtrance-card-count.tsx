'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { TRUTH_CARD_NAMES } from '@/game/truthtrance';
import type { CardCountFact } from '@/game/truthtrance-card-count';
import {
  HAND_INVENTORY_LABELS,
  type HandInventoryFact,
} from '@/game/truthtrance-hand-inventory';

export function CardCountFields<T extends CardCountFact | HandInventoryFact>({
  value,
  onChange,
}: {
  value: T;
  onChange: (fact: T) => void;
}) {
  const id = useId();
  const invalid = !Number.isSafeInteger(value.value) || value.value < 0;
  return (
    <>
      {value.kind === 'handCount' ? (
        <label>
          Card name
          <select
            value={value.name}
            onChange={(event) =>
              onChange({ ...value, name: event.target.value })
            }
          >
            {TRUTH_CARD_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Cards to count
          <select
            value={value.category}
            onChange={(event) =>
              onChange({
                ...value,
                category: event.target.value as HandInventoryFact['category'],
              })
            }
          >
            {Object.entries(HAND_INVENTORY_LABELS).map(([category, label]) => (
              <option key={category} value={category}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
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
        {value.kind === 'handCount' ? 'Number of copies' : 'Number of cards'}
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
        {value.kind === 'handCount'
          ? 'Counts copies of this exact named card'
          : value.category === 'all'
            ? 'Counts all physical cards'
            : 'Counts physical cards of the selected primary role'}{' '}
        in the player’s hand now. Cards in the deck, discard pile, or a separate
        cache do not count. The answer reveals only whether the comparison is
        true.
      </p>
      {value.kind === 'handInventory' && value.category !== 'all' && (
        <p className="fine">
          Primary roles follow the cards: Weirding Way is a weapon and Chemistry
          is a defense. Worthless cards stay separate, including for Bene
          Gesserit or CHOAM. Alternate uses and faction powers do not change
          this count.
        </p>
      )}
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
