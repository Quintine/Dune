'use client';

import { useState } from 'react';
import type { Action, Decision } from '@/game/engine';
import type { SukReserveDestinations, SukRescueOption } from '@/game/suk-graduate';
import { splitLocation } from '@/game/board';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function sukRescueLabel(option: SukRescueOption): string {
  const total = option.normal + option.elite;
  if (!total) return 'Do not rescue any forces';
  const kept = option.kept
    ? `keep 1 ${option.kept.kind === 'normal' ? 'ordinary' : 'elite'} ${option.kept.key.startsWith('homeworld:') ? 'in the original Homeworld pool' : `in sector ${splitLocation(option.kept.key).sector}`}; `
    : '';
  const origins = option.eliteReserves ? ` (cyborgs: ${Object.entries(option.eliteReserves)
    .map(([key, count]) => `${count} from sector ${splitLocation(key).sector}`).join(', ')})` : '';
  return `Save ${option.normal} ordinary + ${option.elite} elite: ${kept}return ${total - (option.kept ? 1 : 0)} to reserves${origins}`;
}

export function SukGraduatePanel({ decision, act, busy }: {
  decision: Extract<Decision, { kind: 'sukRescue' }>;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [secondaryAllocation, setSecondaryAllocation] = useState({ normal: 0, elite: 0 });
  const option = choice === null ? null : decision.options[choice];
  const returned = {
    normal: (option?.normal ?? 0) - (option?.kept?.kind === 'normal' ? 1 : 0),
    elite: (option?.elite ?? 0) - (option?.kept?.kind === 'elite' ? 1 : 0),
  };
  const primary = decision.reserveHomes?.find(home => !home.secondary);
  const secondary = decision.reserveHomes?.find(home => home.secondary);
  const allocate = !!primary && !!secondary && returned.normal + returned.elite > 0;
  const allocationValid = !allocate || (['normal', 'elite'] as const).every(kind =>
    Number.isSafeInteger(secondaryAllocation[kind]) && secondaryAllocation[kind] >= 0 &&
    secondaryAllocation[kind] <= returned[kind]);
  return <section aria-label="Suk Graduate rescue" className="space-y-3">
    <h3>Suk Graduate rescue</h3>
    <p>{decision.mode === 'normal'
      ? 'Your skilled leader remained face up. Return one of your selected casualties to reserves instead of the Tanks.'
      : 'Your skilled leader survived. You may save up to three selected casualties. One stays in its original battle pool; the rest return to reserves.'}</p>
    <p className="muted">Ordinary and elite counters keep their identity. Your paid battle support is unchanged.</p>
    {decision.territory.startsWith('homeworld:') && <p className="muted">
      Saved counters already in your own Homeworld reserves stay in that same pool. This rescue does not move them between Homeworlds.
    </p>}
    <label className="block">Forces to save
      <select aria-label="Forces to save with Suk Graduate" className="w-full" disabled={busy}
        value={choice ?? ''} onChange={(event) => {
          setChoice(event.target.value === '' ? null : Number(event.target.value));
          setSecondaryAllocation({ normal: 0, elite: 0 });
        }}>
        <option value="">Choose your rescue</option>
        {decision.options.map((option, index) => <option key={index} value={index}>{sukRescueLabel(option)}</option>)}
      </select>
    </label>
    {choice !== null && <p>{sukRescueLabel(decision.options[choice])}</p>}
    {allocate && primary && secondary && <fieldset disabled={busy} className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <legend>Rescue return destinations</legend>
      <p className="fine">
        Choose how many returning counters go to {secondary.name}. The remainder goes to {primary.name}.
        The visible default sends all returning counters to {primary.name}; this is a placement choice, not the Emperor revival rule.
      </p>
      {(['normal', 'elite'] as const).map(kind => <label key={kind} className="block space-y-1">
        <span>{kind === 'normal' ? 'Ordinary forces' : 'Elite forces'} returning to {secondary.name} (0–{returned[kind]})</span>
        <Input type="number" min={0} max={returned[kind]} step={1} value={secondaryAllocation[kind]}
          onChange={event => setSecondaryAllocation(current => ({ ...current, [kind]: Number(event.target.value) }))} />
        <span className="fine">{returned[kind] - secondaryAllocation[kind]} return to {primary.name}</span>
      </label>)}
    </fieldset>}
    <Button disabled={busy || choice === null || !allocationValid} onClick={() => {
      if (choice === null || busy || !allocationValid) return;
      const destinations: SukReserveDestinations | undefined = allocate && primary && secondary ? {
        [primary.id]: { normal: returned.normal - secondaryAllocation.normal, elite: returned.elite - secondaryAllocation.elite },
        [secondary.id]: { ...secondaryAllocation },
      } : undefined;
      act({ type: 'decision', event: decision.event, choice, ...(destinations ? { destinations } : {}) });
    }}>Resolve rescue</Button>
  </section>;
}
