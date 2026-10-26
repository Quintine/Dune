'use client';

import { parseAllianceClaim, type AllianceClaim } from '@/game/alliance-promises';

type Partner = { id: string; name: string };
export function allianceClaimInputError(value: unknown, partners?: readonly Partner[]): string | null {
  try {
    const claim = parseAllianceClaim(value);
    return partners && !partners.some(partner => partner.id === claim.partner)
      ? 'Choose one of the current alliance partners.' : null;
  } catch (error) { return error instanceof Error ? error.message : 'Choose the current turn and another player.'; }
}

/** The parent supplies this Nexus turn and its current named-other choices. */
export function AllianceClaimFields(props: {
  value: AllianceClaim;
  onChange: (claim: AllianceClaim) => void;
  partners: readonly Partner[];
  disabled?: boolean;
}) {
  const error = allianceClaimInputError(props.value, props.partners);
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Final alliance at this Nexus close">
    <legend>Final alliance at this Nexus close</legend>
    <p>Turn {props.value.turn} · Current Nexus</p>
    <label htmlFor="truth-alliance-partner">Named alliance partner</label>
    <select id="truth-alliance-partner" disabled={props.disabled}
      value={props.partners.some(partner => partner.id === props.value.partner) ? props.value.partner : ''}
      onChange={event => {
        const next = { ...props.value, partner: event.currentTarget.value };
        if (!props.disabled && !allianceClaimInputError(next, props.partners)) props.onChange(parseAllianceClaim(next));
      }}>
      <option value="">Choose another player</option>
      {props.partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
    </select>
    {error && <p role="alert">{error}</p>}
    <p className="fine">
      This asks about actual membership when this Nexus closes. Offers alone are not alliances.
      A Yes needs an existing alliance or a real reciprocal invitation; it cannot promise the other player’s consent.
      Otherwise No or unknown may apply, and the holder can ask again or save the card.
    </p>
  </fieldset>;
}
