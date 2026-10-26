'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { BRIBE_EXPRESSION_MAX_DEPTH, BRIBE_EXPRESSION_MAX_LEAVES } from '@/game/bribe-expression-promises';
import { parseBribePaymentClaim, type BribePaymentClaim } from '@/game/mixed-bribe-question';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

const recipients = (game: GameView, target: string) => {
  const player = game.players.find(player => player.id === target);
  return player ? game.players.filter(recipient => recipient.id !== target && recipient.id !== player.ally) : [];
};
const config: MixedActionConfig<BribePaymentClaim> = {
  prefix: 'mixed-bribe',
  legend: 'Mixed current-fact / future ordinary bribe claim',
  actionLabel: 'ordinary bribe condition',
  actionTiming: 'Future ordinary bribes · this turn',
  actionHelp: <>Count cumulative future ordinary bribe payments after the answer this turn; smaller payments to the same recipient add together.
    Prior payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
    Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause. Original payment and timing rules still apply.</>,
  fallbackError: 'Choose a current fact and a future ordinary bribe condition.',
  maxLeaves: BRIBE_EXPRESSION_MAX_LEAVES,
  maxDepth: BRIBE_EXPRESSION_MAX_DEPTH,
  newAction: () => ({ recipient: '', minimum: 1 }),
  parseAction: (value, game, target) => {
    const action = parseBribePaymentClaim(value);
    if (!recipients(game, target).some(recipient => recipient.id === action.recipient))
      throw new Error('Choose a public non-allied recipient for the future ordinary bribe.');
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = recipients(game, target), validRecipient = choices.some(recipient => recipient.id === value.recipient);
    return <>
      <label htmlFor={`${id}-recipient`}>Bribe recipient</label>
      <select id={`${id}-recipient`} value={validRecipient ? value.recipient : ''} disabled={disabled} aria-invalid={!validRecipient}
        onChange={event => {
          const recipient = event.currentTarget.value;
          if (recipient === '' || choices.some(choice => choice.id === recipient)) onChange({ ...value, recipient });
        }}>
        <option value="">Choose a recipient</option>
        {choices.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
      </select>
      <label htmlFor={`${id}-minimum`}>Minimum future ordinary bribe payments in spice</label>
      <Input id={`${id}-minimum`} type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required disabled={disabled}
        value={Number.isFinite(value.minimum) ? value.minimum : ''}
        aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1}
        onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
    </>;
  },
};

export function mixedBribeInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}
export function MixedBribeFields(props: {
  value: MixedActionExpression<BribePaymentClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<BribePaymentClaim>) => void;
}) {
  return MixedActionFields({ ...props, config });
}
