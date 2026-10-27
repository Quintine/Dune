'use client';

import { parsePhaseBidClaim, type PhaseBidClaim } from '@/game/turn-bid-promises';
import { Input } from './ui/input';

export function phaseBidClaimInputError(value: unknown): string | null {
  try { parsePhaseBidClaim(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a positive whole bid minimum.'; }
}

/** Turn is fixed by the authoritative question context; the asker chooses the threshold. */
export function PhaseBidClaimFields(props: {
  value: PhaseBidClaim;
  onChange: (claim: PhaseBidClaim) => void;
  disabled?: boolean;
}) {
  const error = phaseBidClaimInputError(props.value);
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Bidding phase condition">
    <legend>Bid during this turn</legend>
    <p>Turn {props.value.turn} · Remaining ordinary Bidding phase</p>
    <label htmlFor="truth-phase-bid-minimum">Minimum bid in spice</label>
    <Input id="truth-phase-bid-minimum" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required
      disabled={props.disabled} value={Number.isFinite(props.value.minimum) ? props.value.minimum : ''}
      aria-invalid={!!error} aria-describedby="truth-phase-bid-help"
      onChange={event => {
        if (props.disabled) return;
        const next = { ...props.value, minimum: event.currentTarget.valueAsNumber };
        if (phaseBidClaimInputError(next)) return;
        props.onChange(parsePhaseBidClaim(next));
      }} />
    {error && <p role="alert">{error}</p>}
    <p className="fine" id="truth-phase-bid-help">
      This asks about one accepted bid of at least this size after the answer,
      before Bidding ends this turn. Earlier bids do not count; it does not
      promise a win or change the winning payment.
    </p>
  </fieldset>;
}
