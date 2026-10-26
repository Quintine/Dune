'use client';

import { parseLeaderRevivalClaim, type LeaderRevivalClaim } from '@/game/leader-revival-promises';

type LeaderChoice = { id: string; name: string };
export function leaderRevivalClaimInputError(value: unknown, leaders?: readonly LeaderChoice[]): string | null {
  try {
    const claim = parseLeaderRevivalClaim(value);
    return leaders && !leaders.some(leader => leader.id === claim.leader)
      ? 'Choose one of the current named leaders.' : null;
  } catch (error) { return error instanceof Error ? error.message : 'Choose the current turn and a named leader.'; }
}

/** The parent supplies the current turn and authorized public name choices.
 * Eligibility and the native return quote remain authoritative on the server. */
export function LeaderRevivalClaimFields(props: {
  value: LeaderRevivalClaim;
  onChange: (claim: LeaderRevivalClaim) => void;
  leaders: readonly LeaderChoice[];
  disabled?: boolean;
}) {
  const error = leaderRevivalClaimInputError(props.value, props.leaders);
  return <fieldset className="grid gap-2" disabled={props.disabled} aria-label="Named ordinary leader Revival condition">
    <legend>Future ordinary leader Revival</legend>
    <p>Turn {props.value.turn}</p>
    <label htmlFor="truth-leader-revival-leader">Named leader</label>
    <select id="truth-leader-revival-leader" disabled={props.disabled}
      value={props.leaders.some(leader => leader.id === props.value.leader) ? props.value.leader : ''}
      onChange={event => {
        const next = { ...props.value, leader: event.currentTarget.value };
        if (!props.disabled && !leaderRevivalClaimInputError(next, props.leaders)) props.onChange(parseLeaderRevivalClaim(next));
      }}>
      <option value="">Choose a named leader</option>
      {props.leaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
    </select>
    {error && <p role="alert">{error}</p>}
    <p className="fine">
      Ask whether this named leader will actually return through ordinary native Revival after the answer this turn.
      A request alone is not a return. Native revival cycles, costs and turn order still apply;
      Ghola, foreign leaders and special card returns do not count.
    </p>
  </fieldset>;
}
