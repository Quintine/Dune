'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { MIXED_BID_MAX_DEPTH, MIXED_BID_MAX_LEAVES, parseBidActionClaim, type BidActionClaim } from '@/game/mixed-bid-question';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

const config: MixedActionConfig<BidActionClaim> = {
  prefix: 'mixed-bid',
  legend: 'Mixed current-fact / future ordinary-lot bid claim',
  actionLabel: 'ordinary-lot bid condition',
  actionTiming: 'Future bid · this ordinary lot',
  actionHelp: <>Count one future accepted native bid declaration after the answer and before this ordinary lot closes.
    Smaller bids do not add together. A qualifying declaration counts even if another player wins; this does not promise a purchase.
    If you win, the original payment rules still apply. Existing funding, Karama and prepaid ally aid rules still apply.
    Ordinary bank auctions only; optional modules and native special auctions are excluded.
    An unknown current fact uses the conservative future commitment that guarantees the whole answer.
    If no such value is available, the answer is I don’t know.</>,
  fallbackError: 'Choose a current fact and a future ordinary-lot bid condition.',
  maxLeaves: MIXED_BID_MAX_LEAVES,
  maxDepth: MIXED_BID_MAX_DEPTH,
  newAction: () => ({ minimum: 1 }),
  parseAction: value => parseBidActionClaim(value),
  renderAction: ({ value, id, disabled, onChange }) => <>
    <label htmlFor={`${id}-minimum`}>Minimum bid in spice</label>
    <Input id={`${id}-minimum`} type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required disabled={disabled}
      value={Number.isFinite(value.minimum) ? value.minimum : ''}
      aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1}
      onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
  </>,
};

export function mixedBidInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}
export function MixedBidFields(props: {
  value: MixedActionExpression<BidActionClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<BidActionClaim>) => void;
}) {
  const lot = props.game.bidPromiseLot;
  return MixedActionFields({ ...props, config: lot
    ? { ...config, legend: `${config.legend} · Turn ${lot.turn} · Ordinary lot ${lot.lot}` }
    : config });
}
