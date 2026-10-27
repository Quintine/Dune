'use client';

import { Input } from './ui/input';

/** Minimum is public, positive and precisely representable in the action. */
export function richeseBidMinimumError(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? null : 'Choose a positive whole bid minimum.';
}

export function RicheseBidPromiseFields(props: {
  minimum: number;
  onMinimum: (value: number) => void;
  disabled: boolean;
  method?: 'onceAround' | 'silent';
}) {
  const silent = props.method === 'silent';
  const error = richeseBidMinimumError(props.minimum);
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label={`Richese ${silent ? 'Silent' : 'Once Around'} bid condition`}>
    <legend>Bid in this {silent ? 'Silent' : 'Once Around'} auction</legend>
    <label htmlFor="truth-richese-bid-minimum">Minimum bid in spice</label>
    <Input id="truth-richese-bid-minimum" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required
      disabled={props.disabled} value={Number.isFinite(props.minimum) ? props.minimum : ''}
      aria-invalid={!!error} aria-describedby="truth-richese-bid-help"
      onChange={event => {
        const value = event.currentTarget.valueAsNumber;
        if (!props.disabled && !richeseBidMinimumError(value)) props.onMinimum(value);
      }} />
    {error && <p role="alert">{error}</p>}
    <p className="fine" id="truth-richese-bid-help">
      {silent
        ? 'This asks about the bidder’s unsubmitted sealed bid in this Silent lot. A zero submission is permitted when compatible with the answer; submitted amounts remain private until bids are revealed.'
        : 'This asks about the bidder’s remaining opportunity in this Once Around lot. Earlier declarations do not count.'}
      {' '}A qualifying bid does not promise a win or change the winning payment.
    </p>
  </fieldset>;
}
