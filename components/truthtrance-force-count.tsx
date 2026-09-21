'use client';

import { useId } from 'react';
import { gameTerritories, type MobileBoard } from '@/game/board';
import { forceCountCounterError, parseForceCountFact, type ForceCountFact, type ForceCountPlayer } from '@/game/truthtrance-force-count';
import { Input } from './ui/input';

type CounterPlayer = Pick<ForceCountPlayer, 'faction' | 'elites'>;

export function forceCountInputError(value: ForceCountFact, game: MobileBoard, player: CounterPlayer): string | null {
  try {
    parseForceCountFact(value, gameTerritories(game).flatMap(t =>
      t.sectors.map(sector => ({ territory: t.id, sector }))));
    return forceCountCounterError(player, value.counter);
  } catch (error) {
    return error instanceof Error ? error.message : 'Choose a valid physical force count.';
  }
}

export function ForceCountFields({ value, game, player, onChange }: {
  value: ForceCountFact;
  game: MobileBoard;
  player: CounterPlayer;
  onChange: (value: ForceCountFact) => void;
}) {
  const id = useId();
  const territories = gameTerritories(game);
  const zone = value.zone;
  const selected = zone.kind === 'location' ? territories.find(t => t.id === zone.territory) : null;
  const error = forceCountInputError(value, game, player);
  return <>
    <label>Force pool<select value={value.zone.kind} onChange={event => {
      const kind = event.target.value;
      onChange({ ...value, zone: kind === 'location'
        ? { kind, territory: territories[0].id, sector: territories[0].sectors[0] }
        : { kind: kind as 'reserves' | 'tanks' } });
    }}>
      <option value="reserves">Reserves</option>
      <option value="tanks">Tleilaxu Tanks</option>
      <option value="location">One board location</option>
    </select></label>
    {value.zone.kind === 'location' && <>
      <label>Force territory<select value={value.zone.territory} onChange={event => {
        const target = territories.find(t => t.id === event.target.value)!;
        onChange({ ...value, zone: { kind: 'location', territory: target.id, sector: target.sectors[0] } });
      }}>{territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Force sector<select value={value.zone.sector} onChange={event => {
        if (value.zone.kind === 'location') onChange({ ...value, zone: { ...value.zone, sector: Number(event.target.value) } });
      }}>{selected?.sectors.map(sector => <option key={sector} value={sector}>{sector === 0 ? 'Interior / whole location' : `Sector ${sector}`}</option>)}</select></label>
    </>}
    <label>Counter type<select value={value.counter} onChange={event => onChange({ ...value, counter: event.target.value as ForceCountFact['counter'] })}>
      <option value="total">All physical force counters</option>
      <option value="normal" disabled={!!forceCountCounterError(player, 'normal')}>Normal counters</option>
      <option value="elite" disabled={!!forceCountCounterError(player, 'elite')}>Elite counters</option>
    </select></label>
    <label>Compare force count<select value={value.compare} onChange={event => onChange({ ...value, compare: event.target.value as ForceCountFact['compare'] })}>
      <option value="eq">Exactly</option><option value="gte">At least</option><option value="lte">At most</option>
    </select></label>
    <label htmlFor={`${id}-count`}>Number of force counters<Input id={`${id}-count`} type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} required
      value={Number.isNaN(value.value) ? '' : value.value} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      onChange={event => onChange({ ...value, value: event.currentTarget.valueAsNumber })} /></label>
    <p id={`${id}-help`} className="fine">Each physical counter counts once, including advisors. The total includes elites; the normal count excludes them. Concealed No-Field markers and their hidden values do not count. Reserves includes counters on native Homeworlds. This asks about current custody, not combat strength or a promise to keep forces there.</p>
    {!!forceCountCounterError(player, 'elite') && <p className="fine">This table does not track this faction’s starred counters separately. Choose all physical force counters.</p>}
    {error && <p id={`${id}-error`} className="notice" role="alert">{error}</p>}
  </>;
}
