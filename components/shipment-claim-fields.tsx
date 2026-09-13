'use client';
import { TERRITORIES } from '@/game/board';
import { Input } from '@/components/ui/input';

export type ShipmentClauseInput = { territory: string; minimum: number };
export function invalidShipmentClause(claim: ShipmentClauseInput) {
  return !Number.isSafeInteger(claim.minimum) || claim.minimum < 1 || claim.minimum > 20;
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
        <label htmlFor={`${id}-territory-${index}`}>Shipment destination</label>
        <select id={`${id}-territory-${index}`} value={claim.territory} onChange={event => update({ ...claim, territory: event.target.value })}>
          {TERRITORIES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label htmlFor={`${id}-minimum-${index}`}>Minimum physical forces</label>
        <Input id={`${id}-minimum-${index}`} type="number" min={1} max={20} step={1} required
          value={Number.isNaN(claim.minimum) ? '' : claim.minimum}
          aria-invalid={invalidShipmentClause(claim)} aria-describedby={`${id}-help`}
          onChange={event => update({ ...claim, minimum: event.currentTarget.valueAsNumber })} />
      </fieldset>;
    })}
    <p className="fine" id={`${id}-help`}>
      All conditions describe the same shipment from reserves. AND requires both;
      OR requires at least one. A No answer requires the whole statement to be false.
      Skipping shipment makes every shipment condition false.
    </p>
  </>;
}
