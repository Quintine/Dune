'use client';

import { parseBribeClaim, type BribeClaim } from '@/game/bribe-promises';
import { Input } from './ui/input';

type Recipient = { id: string; name: string };
export function bribeClaimInputError(value: unknown, recipients?: readonly Recipient[]): string | null {
  try {
    const claim = parseBribeClaim(value);
    return recipients && !recipients.some(recipient => recipient.id === claim.recipient)
      ? 'Choose one of the current bribe recipients.' : null;
  } catch (error) { return error instanceof Error ? error.message : 'Choose a recipient and a positive safe whole minimum.'; }
}

/** The parent supplies this turn and its current public recipient choices. */
export function BribeClaimFields(props: {
  value: BribeClaim;
  onChange: (claim: BribeClaim) => void;
  recipients: readonly Recipient[];
  disabled?: boolean;
}) {
  const error = bribeClaimInputError(props.value, props.recipients);
  const change = (value: unknown) => {
    if (!props.disabled && !bribeClaimInputError(value, props.recipients)) props.onChange(parseBribeClaim(value));
  };
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Future ordinary bribe condition">
    <legend>Future ordinary bribe payments</legend>
    <p>Turn {props.value.turn}</p>
    <label htmlFor="truth-bribe-recipient">Bribe recipient</label>
    <select id="truth-bribe-recipient" disabled={props.disabled}
      value={props.recipients.some(recipient => recipient.id === props.value.recipient) ? props.value.recipient : ''}
      onChange={event => change({ ...props.value, recipient: event.currentTarget.value })}>
      <option value="">Choose a recipient</option>
      {props.recipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
    </select>
    <label htmlFor="truth-bribe-minimum">Minimum future ordinary bribe payments in spice</label>
    <Input id="truth-bribe-minimum" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required disabled={props.disabled}
      value={Number.isFinite(props.value.minimum) ? props.value.minimum : ''} aria-invalid={!!error}
      aria-describedby="truth-bribe-help"
      onChange={event => change({ ...props.value, minimum: event.currentTarget.valueAsNumber })} />
    {error && <p role="alert">{error}</p>}
    <p className="fine" id="truth-bribe-help">
      Count cumulative future ordinary bribe payments to this recipient after the answer; smaller payments add together.
      Earlier payments, gifts and ally aid do not count. The sender pays now; the recipient collects the payment at the start of Mentat Pause.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.
    </p>
  </fieldset>;
}
