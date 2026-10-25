'use client';

export type RicheseHomeworldForcesProps = {
  enabled: boolean;
  amount: number;
  max: number;
  busy: boolean;
  onChange: (amount: number) => void;
};

export function RicheseHomeworldForces({ enabled, amount, max, busy, onChange }: RicheseHomeworldForcesProps) {
  const blocked = amount > 0 && !enabled
    ? 'Paid forces alongside a No-Field require Richese at High population. Set the amount to 0 to continue without paid reserve forces.'
    : amount > max ? `Only ${max} physical reserve ${max === 1 ? 'force is' : 'forces are'} available for this selection. Reduce the amount before shipping.` : null;
  return (
    <section className="space-y-2" aria-label="Richese Homeworld shipment">
      <label className="block space-y-1">
        <span>Paid reserve forces with No-Field</span>
        <input
          aria-label="Paid reserve forces with No-Field"
          type="number"
          min={0}
          max={max}
          step={1}
          value={amount}
          disabled={busy}
          aria-invalid={!!blocked}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!busy && Number.isSafeInteger(next) && next >= 0 && next <= max && (enabled || next === 0)) onChange(next);
          }}
        />
      </label>
      <p className="fine">
        Paid forces enter the destination now. The No-Field’s concealed forces
        stay in reserves until revelation, which uses the reserves then available.
        Each paid force adds to the marker’s shipment price.
      </p>
      {blocked ? <p className="notice" aria-live="polite">{blocked}</p>
        : !enabled && <p className="fine">Adding paid reserve forces requires native Richese at High population.</p>}
    </section>
  );
}
