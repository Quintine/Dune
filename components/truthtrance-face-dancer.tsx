'use client';

import { DUKE_VIDAL_ID } from '@/game/duke-vidal';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { parseFaceDancerFact, type FaceDancerFact } from '@/game/truthtrance-face-dancer';

export function FaceDancerFactFields({
  value,
  leaders,
  onChange,
}: {
  value: FaceDancerFact;
  leaders: readonly { id: string; name: string }[];
  onChange: (fact: FaceDancerFact) => void;
}) {
  const identities = [
    ...leaders.filter((leader) => leader.id !== DUKE_VIDAL_ID && leader.id !== CHEAP_HERO_TRAITOR),
    { id: CHEAP_HERO_TRAITOR, name: 'Cheap Hero / Heroine' },
  ];
  const allowed = identities.map((identity) => identity.id);
  let error: string | null = null;
  try { parseFaceDancerFact(value, allowed); }
  catch (cause) { error = cause instanceof Error ? cause.message : 'Choose a printed Face Dancer identity.'; }
  return (
    <>
      <label>
        Face Dancer identity
        <select
          aria-label="Face Dancer identity"
          value={value.leader}
          aria-invalid={!!error}
          onChange={(event) => {
            try {
              onChange(parseFaceDancerFact({ kind: 'faceDancer', leader: event.currentTarget.value }, allowed));
            } catch { return; }
          }}
        >
          {identities.map((identity) => (
            <option key={identity.id} value={identity.id}>{identity.name}</option>
          ))}
        </select>
      </label>
      <p className="fine">
        This asks whether the respondent currently holds an unrevealed Face
        Dancer for this printed identity. A revealed, absent or returned card
        means No.
      </p>
      <p className="fine">
        This is a current fact at the answer, not a promise to reveal a Face
        Dancer later. Ordinary traitor questions still ask only about ordinary
        Traitor Cards.
      </p>
      <p className="fine">
        Only the aggregate Truthtrance answer is published. This does not
        physically reveal a Face Dancer or identify which part of an AND/OR
        claim is true.
      </p>
      {error && <p className="notice" role="alert">{error}</p>}
    </>
  );
}
