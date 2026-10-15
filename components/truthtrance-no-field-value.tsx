'use client';

import type { NoFieldValueFact } from '@/game/truthtrance-no-field-value';

export function NoFieldValueFields({ value, onChange }: {
  value: NoFieldValueFact;
  onChange: (value: NoFieldValueFact) => void;
}) {
  return <>
    <label>Printed No-Field value<select value={value.value} onChange={event => onChange({ kind: 'noFieldValue', value: Number(event.target.value) as NoFieldValueFact['value'] })}>
      <option value={0}>0</option>
      <option value={3}>3</option>
      <option value={5}>5</option>
    </select></label>
    <p className="fine">This asks whether the respondent currently has a concealed No-Field with this printed value. No deployed token, or an already revealed token, means No, including for value 0. This is not a prospective force count or a commitment to use a future token. The public answer does not physically reveal the token.</p>
  </>;
}
