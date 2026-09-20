import type { SandmasterWormCollection } from '@/game/sandmaster-worm';

export function SandmasterWormChoice({ quote, collect, onChange }: {
  quote: SandmasterWormCollection | null;
  collect: boolean;
  onChange: (collect: boolean) => void;
}) {
  if (!quote) return null;
  return <div className="notice" aria-label="Sandmaster worm collection">
    {quote.blocked ? <p>{quote.blocked} You may still ride without collecting.</p> : <>
      <label><input type="checkbox" checked={collect}
        onChange={event => onChange(event.target.checked)} />
        Collect 1 spice with Sandmaster at the destination
      </label>
      <p className="fine">Collect once for this ride, even when several forces or source
        sectors participate. The source and intervening territories earn nothing.
        This does not use your normal movement.</p>
    </>}
  </div>;
}
