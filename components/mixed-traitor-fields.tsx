'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import {
  MIXED_TRAITOR_MAX_DEPTH, MIXED_TRAITOR_MAX_LEAVES, parseTraitorActionClaim, type TraitorActionClaim,
} from '@/game/mixed-traitor-question';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';

/** Question authors choose an original native declaration, never its private
 * physical eligibility or the branch needed to honor the aggregate answer. */
const config: MixedActionConfig<TraitorActionClaim> = {
  prefix: 'mixed-traitor',
  legend: 'Mixed current-fact / this battle’s Traitor declaration',
  actionLabel: 'Traitor declaration condition',
  actionTiming: 'Traitor declaration · this revealed battle',
  actionHelp: <>Traitor conditions concern the respondent’s one original Reveal or decline declaration in this revealed battle,
    including a native Harkonnen declaration for an ally. Current facts are snapshotted at the answer.
    An unknown current fact uses the conservative declaration commitment that guarantees the whole answer;
    if no such answer is possible, the answer is I don’t know. A constant whole answer needs no declaration commitment.
    The original declaration fulfills a remaining commitment before a later Karama or betrayal response can prevent its effect.
    Native voter eligibility and physical Traitor rules still apply.</>,
  fallbackError: 'Choose a current fact and a Traitor declaration condition.',
  maxLeaves: MIXED_TRAITOR_MAX_LEAVES,
  maxDepth: MIXED_TRAITOR_MAX_DEPTH,
  newAction: () => ({ call: true }),
  parseAction: value => parseTraitorActionClaim(value),
  renderAction: ({ value, id, disabled, onChange }) => <>
    <label htmlFor={`${id}-call`}>Traitor declaration</label>
    <select id={`${id}-call`} value={value.call ? 'reveal' : 'decline'} disabled={disabled}
      aria-invalid={typeof value.call !== 'boolean'} onChange={event => {
        if (event.currentTarget.value === 'reveal') onChange({ call: true });
        if (event.currentTarget.value === 'decline') onChange({ call: false });
      }}>
      <option value="reveal">Reveal traitor</option>
      <option value="decline">Decline traitor</option>
    </select>
  </>,
};

export function mixedTraitorInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}

export function MixedTraitorFields(props: {
  value: MixedActionExpression<TraitorActionClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<TraitorActionClaim>) => void;
}) {
  return MixedActionFields({ ...props, config });
}
