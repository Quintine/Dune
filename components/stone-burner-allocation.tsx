'use client';

import { Button } from './ui/button';

export function StoneBurnerAllocation({
  event,
  totals,
  onCommit,
  busy,
}: {
  event: string;
  totals: readonly number[];
  onCommit: (undialed: number) => void;
  busy: boolean;
}) {
  const choices = [...new Set(totals)].filter(total => Number.isSafeInteger(total) && total >= 0)
    .sort((a, b) => a - b);
  if (!event || !choices.length) return null;
  return (
    <section aria-label="Stone Burner undialed force commitment" className="notice space-y-3" data-event={event}>
      <h4>Commit undialed physical forces</h4>
      <p>
        Provisional timing: choose the number of your undialed physical counters
        for this Stone Burner comparison. Each ordinary or elite counter counts
        as one. Choices stay sealed until everyone has committed.
      </p>
      <p>
        The winner chooses their ordinary and elite losses afterward, consistent
        with the committed total. This choice does not change your dial or spice.
      </p>
      <div className="flex flex-wrap gap-2">
        {choices.map(total => (
          <Button key={`${event}:${total}`} type="button" className="min-h-11 whitespace-normal text-base" disabled={busy}
            onClick={() => { if (!busy) onCommit(total); }}>
            Commit {total} undialed physical forces
          </Button>
        ))}
      </div>
    </section>
  );
}
