import type { SmugglerShipment } from '../game/smuggler-shipment';

export function SmugglerShipmentChoice({
  quote,
  use,
  busy,
  onChange,
}: {
  quote: SmugglerShipment | null;
  use: boolean;
  busy: boolean;
  onChange: (use: boolean) => void;
}) {
  if (!quote) return null;
  return (
    <section aria-label="Smuggler shipment choice" className="notice space-y-2">
      <label className="decision-checkbox">
        <input
          type="checkbox"
          checked={use}
          disabled={busy}
          onChange={(event) => onChange(event.target.checked)}
        />
        Use Smuggler for one free accompanying force
      </label>
      <output className="fine block">
        All {quote.amount} selected forces leave reserves.
        {use
          ? ` The price is for ${quote.amount - 1}; the free force is included in your selected total.`
          : ' The ordinary price applies to every selected force.'}{' '}
        The destination is currently empty.
      </output>
    </section>
  );
}
