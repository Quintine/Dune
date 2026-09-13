'use client';

import { useState } from 'react';
import type { Action, Decision } from '@/game/engine';
import type { SukRescueOption } from '@/game/suk-graduate';
import { splitLocation } from '@/game/board';
import { Button } from '@/components/ui/button';

export function sukRescueLabel(option: SukRescueOption): string {
  const total = option.normal + option.elite;
  if (!total) return 'Do not rescue any forces';
  const kept = option.kept
    ? `keep 1 ${option.kept.kind === 'normal' ? 'ordinary' : 'elite'} in sector ${splitLocation(option.kept.key).sector}; `
    : '';
  return `Save ${option.normal} ordinary + ${option.elite} elite: ${kept}return ${total - (option.kept ? 1 : 0)} to reserves`;
}

export function SukGraduatePanel({ decision, act, busy }: {
  decision: Extract<Decision, { kind: 'sukRescue' }>;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  return <section aria-label="Suk Graduate rescue" className="space-y-3">
    <h3>Suk Graduate rescue</h3>
    <p>{decision.mode === 'normal'
      ? 'Your skilled leader remained face up. Return one of your selected casualties to reserves instead of the Tanks.'
      : 'Your skilled leader survived. You may save up to three selected casualties. One stays in its original sector; the rest return to reserves.'}</p>
    <p className="muted">Ordinary and elite counters keep their identity. Your paid battle support is unchanged.</p>
    <label className="block">Forces to save
      <select aria-label="Forces to save with Suk Graduate" className="w-full" disabled={busy}
        value={choice ?? ''} onChange={(event) => setChoice(event.target.value === '' ? null : Number(event.target.value))}>
        <option value="">Choose your rescue</option>
        {decision.options.map((option, index) => <option key={index} value={index}>{sukRescueLabel(option)}</option>)}
      </select>
    </label>
    {choice !== null && <p>{sukRescueLabel(decision.options[choice])}</p>}
    <Button disabled={busy || choice === null} onClick={() => {
      if (choice !== null && !busy) act({ type: 'decision', event: decision.event, choice });
    }}>Resolve rescue</Button>
  </section>;
}
