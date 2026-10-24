'use client';
import { TERRITORIES } from '@/game/board';
import { validMovementClaim, type MovementClaim } from '@/game/movement-promises';
import { Input } from './ui/input';

export function MovementClaimFields({ id, value, onChange }: {
  id: string; value: MovementClaim; onChange: (value: MovementClaim) => void;
}) {
  return <fieldset className="grid gap-2">
    <legend>Ground-movement condition</legend>
    <label htmlFor={`${id}-territory`}>Ground-movement destination</label>
    <select id={`${id}-territory`} value={value.territory}
      onChange={event => onChange({ ...value, territory: event.target.value })}>
      {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
    </select>
    <label htmlFor={`${id}-minimum`}>Minimum physical forces in one ground move</label>
    <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required
      value={Number.isNaN(value.minimum) ? '' : value.minimum} aria-invalid={!validMovementClaim(value)}
      onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
  </fieldset>;
}
