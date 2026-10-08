import { splitLocation } from '@/game/board';
import type { SandmasterDestinationCollection } from '@/game/sandmaster-movement';

export function SandmasterWormChoice({ quote, collect, onChange, onPileChange }: {
  quote: SandmasterDestinationCollection | null;
  collect: boolean;
  onChange: (collect: boolean) => void;
  onPileChange: (key: string) => void;
}) {
  if (!quote) return null;
  return <div className="notice space-y-3" aria-label="Sandmaster worm collection">
    {quote.blocked ? <p>{quote.blocked} You may still ride without collecting.</p> : <>
      <label className="flex min-h-11 items-start gap-2"><input className="mt-1 shrink-0" type="checkbox" checked={collect}
        onChange={event => onChange(event.target.checked)} />
        Collect 1 spice with Sandmaster at the destination
      </label>
      {quote.piles.length > 1 && <>
        <label className="flex flex-col gap-2">Destination spice pile
          <select className="min-h-11 w-full" disabled={!collect} value={quote.key ?? ''} onChange={event => onPileChange(event.target.value)}>
            {quote.piles.map(pile => <option key={pile.key} value={pile.key}>
              Sector {splitLocation(pile.key).sector}: {pile.before} → {pile.before - 1} spice
            </option>)}
          </select>
        </label>
        <p className="fine">Provisional multi-pile policy: you choose which sector supplies
          the one spice; this is not a publisher allocation ruling.</p>
      </>}
      <p className="fine">Sector {splitLocation(quote.key!).sector}: {quote.before} → {quote.before - 1} spice if collected.</p>
      <p className="fine">Collect once for this ride, even when several forces or source
        sectors participate. The source and intervening territories earn nothing.
        This does not use your normal movement.</p>
    </>}
  </div>;
}
