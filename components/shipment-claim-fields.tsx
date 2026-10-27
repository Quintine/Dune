'use client';
import { TERRITORIES } from '@/game/board';
import { Input } from '@/components/ui/input';

export type ShipmentClauseInput = { territory: string; minimum: number; sector?: number };
export function invalidShipmentClause(claim: ShipmentClauseInput) {
  return !Number.isSafeInteger(claim.minimum) || claim.minimum < 1 || claim.minimum > 20 ||
    claim.sector !== undefined && (!Number.isSafeInteger(claim.sector) ||
      !TERRITORIES.find(destination => destination.id === claim.territory)?.sectors.includes(claim.sector));
}

/** Destination and physical minimum shared by flat and nested question builders. */
export function ShipmentClauseFields({ id, value, onChange }: {
  id: string;
  value: ShipmentClauseInput;
  onChange: (claim: ShipmentClauseInput) => void;
}) {
  const printed = TERRITORIES.find(destination => destination.id === value.territory);
  // Mixed-shipment leaves have their own `kind` and remain on their existing
  // territory-only parser until that separate question family is integrated.
  const allowSector = !('kind' in value);
  return <>
    <label htmlFor={`${id}-territory`}>This-turn shipment destination</label>
    <select id={`${id}-territory`} value={value.territory}
      onChange={event => {
        const next = { ...value, territory: event.target.value };
        delete next.sector;
        onChange(next);
      }}>
      {TERRITORIES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
    {allowSector && <>
      <label htmlFor={`${id}-sector`}>Shipment sector</label>
      <select id={`${id}-sector`} value={value.sector === undefined ? '' : String(value.sector)}
        aria-invalid={value.sector !== undefined && !printed?.sectors.includes(value.sector)} onChange={event => {
          const selected = event.currentTarget.value;
          if (selected === '') {
            const next = { ...value }; delete next.sector; onChange(next);
          } else {
            const sector = Number(selected);
            if (printed?.sectors.includes(sector)) onChange({ ...value, sector });
          }
        }}>
        <option value="">Any sector in this territory</option>
        {printed?.sectors.map(sector => <option key={sector} value={sector}>Sector {sector}</option>)}
      </select>
    </>}
    <label htmlFor={`${id}-minimum`}>Minimum physical forces from reserves</label>
    <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required
      value={Number.isNaN(value.minimum) ? '' : value.minimum}
      aria-invalid={invalidShipmentClause(value)} aria-describedby={`${id}-help`}
      onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
    <p className="fine" id={`${id}-help`}>
      A whole minimum of one to twenty physical forces in the same shipment from reserves this turn.
      Skipping makes this shipment condition false.
    </p>
  </>;
}

export function ShipmentClaimFields({ id, clauses, join, onClauses, onJoin }: {
  id: string;
  clauses: ShipmentClauseInput[];
  join: 'single' | 'and' | 'or';
  onClauses: (clauses: ShipmentClauseInput[]) => void;
  onJoin: (join: 'single' | 'and' | 'or') => void;
}) {
  return <>
    <label htmlFor={`${id}-join`}>Combine shipment conditions</label>
    <select id={`${id}-join`} value={join} onChange={event => onJoin(event.target.value as typeof join)}>
      <option value="single">One condition</option>
      <option value="and">Both conditions (AND)</option>
      <option value="or">At least one condition (OR)</option>
    </select>
    {clauses.slice(0, join === 'single' ? 1 : 2).map((claim, index) => {
      const update = (next: ShipmentClauseInput) => onClauses(clauses.map((previous, i) => i === index ? next : previous));
      return <fieldset key={index} className="grid gap-2">
        <legend>Shipment condition {index + 1}</legend>
        <ShipmentClauseFields id={`${id}-${index}`} value={claim} onChange={update} />
      </fieldset>;
    })}
    <p className="fine" id={`${id}-help`}>
      All conditions describe the same shipment from reserves. AND requires both;
      OR requires at least one. A No answer requires the whole statement to be false.
      Skipping shipment makes every shipment condition false.
    </p>
  </>;
}
