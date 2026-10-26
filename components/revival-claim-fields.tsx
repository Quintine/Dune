'use client';

import { parseRevivalClaim, type RevivalClaim } from '@/game/revival-promises';
import { Input } from './ui/input';

export function revivalClaimInputError(value: unknown): string | null {
  try { parseRevivalClaim(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a whole physical-force minimum from 1 to 20.'; }
}

/** The parent fixes this turn; the editor chooses physical counters and a
 * cumulative minimum without reconstructing native revival feasibility. */
export function RevivalClaimFields(props: {
  value: RevivalClaim;
  onChange: (claim: RevivalClaim) => void;
  disabled?: boolean;
}) {
  const error = revivalClaimInputError(props.value);
  const change = (value: unknown) => {
    if (!props.disabled && !revivalClaimInputError(value)) props.onChange(parseRevivalClaim(value));
  };
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Ordinary native Revival condition">
    <legend>Future ordinary Revival returns</legend>
    <p>Turn {props.value.turn}</p>
    <label htmlFor="truth-revival-counter">Physical force counters</label>
    <select id="truth-revival-counter" value={props.value.counter} disabled={props.disabled}
      onChange={event => change({ ...props.value, counter: event.currentTarget.value })}>
      <option value="total">All physical forces</option>
      <option value="normal">Normal forces</option>
      <option value="elite">Elite forces</option>
    </select>
    <label htmlFor="truth-revival-minimum">Minimum future ordinary returns</label>
    <Input id="truth-revival-minimum" type="number" min={1} max={20} step={1} required disabled={props.disabled}
      value={Number.isFinite(props.value.minimum) ? props.value.minimum : ''} aria-invalid={!!error}
      aria-describedby="truth-revival-help"
      onChange={event => change({ ...props.value, minimum: event.currentTarget.valueAsNumber })} />
    {error && <p role="alert">{error}</p>}
    <p className="fine" id="truth-revival-help">
      Count cumulative future ordinary native returns after the answer. Total counts normal and elite counters together;
      each physical counter counts once. Earlier returns, card effects, Ghola and Emperor extra revivals do not count.
    </p>
  </fieldset>;
}
