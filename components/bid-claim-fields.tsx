'use client';

import { parseBidClaim, type BidClaim } from '@/game/bid-promises';
import { Input } from './ui/input';

export function bidClaimInputError(value: unknown): string | null {
  try { parseBidClaim(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a positive whole bid minimum.'; }
}

/** The parent supplies the public current lot; only the minimum is editable. */
export function BidClaimFields(props: {
  value: BidClaim;
  onChange: (claim: BidClaim) => void;
  disabled?: boolean;
}) {
  const error = bidClaimInputError(props.value);
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Ordinary lot bid condition">
    <legend>Current ordinary-lot bid</legend>
    <p>Turn {props.value.turn} · Ordinary lot {props.value.lot}</p>
    <label htmlFor="truth-bid-minimum">Minimum bid in spice</label>
    <Input id="truth-bid-minimum" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required
      disabled={props.disabled} value={Number.isFinite(props.value.minimum) ? props.value.minimum : ''}
      aria-invalid={!!error} aria-describedby="truth-bid-help"
      onChange={event => {
        if (props.disabled) return;
        const next = { ...props.value, minimum: event.currentTarget.valueAsNumber };
        if (bidClaimInputError(next)) return;
        props.onChange(parseBidClaim(next));
      }} />
    {error && <p role="alert">{error}</p>}
    <p className="fine" id="truth-bid-help">
      This asks whether you will place at least one bid of this size from now until this lot closes.
      It does not promise a win. If you win, the original payment rules still apply. Ordinary bank auctions only;
      optional modules and native special auctions are excluded.
    </p>
  </fieldset>;
}
