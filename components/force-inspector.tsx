'use client';

import { useState, type CSSProperties } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, Star, X } from 'lucide-react';
import { FACTIONS, faction, type FactionId } from '@/game/catalog';
import { forceCounterName, forceInventory, type ForcePool, type PublicForcePlayer, type PublicForceWorld } from '@/game/force-inventory';
import { Button } from './ui/button';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog';

type CounterKind = 'force' | 'special' | 'advisor';

/** Original diagrammatic counter faces. Text stays crisp at enlarged sizes. */
export function ForceCounterFace({ factionId, kind }: { factionId: FactionId; kind: CounterKind }) {
  const house = faction(factionId);
  const name = forceCounterName(factionId, kind);
  return <figure className="force-example" aria-label={`${house.name} ${name} counter`} style={{ '--counter-color': house.color } as CSSProperties}>
    <div className={`force-disc force-disc-${kind}`} aria-hidden="true">
      <span>{house.sigil}</span>
      {kind === 'special' && <Star className="force-star" />}
      {kind === 'advisor' && <span className="force-stance">Advisor</span>}
    </div>
    <figcaption>{house.name}<strong>{name}</strong></figcaption>
  </figure>;
}

function Examples({ factionId, split = true }: { factionId: FactionId; split?: boolean }) {
  const special = ['emperor', 'fremen', 'ixians'].includes(factionId) && split;
  return <div className="force-examples">
    <ForceCounterFace factionId={factionId} kind="force" />
    {special && <ForceCounterFace factionId={factionId} kind="special" />}
    {factionId === 'beneGesserit' && <ForceCounterFace factionId={factionId} kind="advisor" />}
  </div>;
}

function PoolList({ rows, player, split }: { rows: ForcePool[]; player: PublicForcePlayer; split: boolean }) {
  return <dl className="force-pools">{rows.map(row => <div key={row.id}>
    <dt>{row.name}</dt>
    <dd>
      <strong>{row.total}</strong> {row.total === 1 ? 'counter' : 'counters'}
      {split && <span>{row.normal} {player.faction === 'ixians' ? 'Suboid' : 'normal'} · {row.elite} {forceCounterName(player.faction, 'special')}</span>}
      {row.advisors && <span>Advisor face · included in this count</span>}
    </dd>
  </div>)}</dl>;
}

export function ForceInventoryDetails({ player, worlds = null }: { player: PublicForcePlayer; worlds?: readonly PublicForceWorld[] | null }) {
  const inventory = forceInventory(player, worlds);
  if (!inventory) return <output className="force-notice">Force counts could not be reconciled. Refresh the table to read its latest state.</output>;
  return <div className="force-details">
    <Examples factionId={player.faction} split={inventory.split} />
    <p className="force-notice"><strong>{inventory.total} physical force counters</strong> across reserves, the Tanks and deployed groups. This is a counter count, not battle strength.</p>
    {!inventory.split && ['emperor', 'fremen'].includes(player.faction) && <p>This table shows a combined force count; starred counters are not listed separately.</p>}
    <PoolList rows={inventory.rows} player={player} split={inventory.split} />
    {inventory.nativeReserves.length > 0 && <section aria-label="Native Homeworld reserve breakdown">
      <h3>Reserves on native Homeworlds</h3>
      <p>These counters are already included in Reserves above.</p>
      <PoolList rows={inventory.nativeReserves} player={player} split={inventory.split} />
    </section>}
    {player.faction === 'beneGesserit' && <p>{inventory.advisors} deployed counters currently show their advisor face. Advisors are the same physical counters; reserves and the Tanks have no deployed stance.</p>}
    {inventory.marker && <section className="force-marker" aria-label="Concealed No-Field marker">
      <span className="force-marker-back" aria-hidden="true">?</span>
      <div><h3>Concealed No-Field</h3><p>{inventory.marker.name}</p><p>Counts as one force for board presence until revealed. It is a separate marker, not an extra physical force counter. Its hidden force value is not shown here. Revelation draws from the reserves available then.</p></div>
    </section>}
    <p>Inspecting counters does not move them or commit a Battle Plan. Spice support, temporary powers and leaders may change battle strength without adding counters.</p>
    <a href="/rules?topic=force-counters#force-counters">Force counter guide</a>
  </div>;
}

export function ForceInspector({ player, worlds }: { player: PublicForcePlayer; worlds?: readonly PublicForceWorld[] | null }) {
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="force-inspect-trigger" />} aria-label={`Inspect forces: ${player.name} · ${faction(player.faction).name}`}><Eye aria-hidden="true" />Inspect forces</DialogTrigger>
    <DialogPortal>
      <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
      <DialogPrimitive.Popup className="force-dialog">
        <div className="force-dialog-header"><span>Public force counters</span><DialogClose render={<Button variant="outline" className="min-h-11 min-w-11" />}><X aria-hidden="true" />Close</DialogClose></div>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- This separately scrolling inspection region needs keyboard access. */}
        <section className="force-dialog-scroll" aria-label="Force counter details" tabIndex={0}>
          <DialogTitle>{player.name} · {faction(player.faction).name}</DialogTitle>
          <DialogDescription>Enlarged counter faces and the force locations visible to everyone at this table.</DialogDescription>
          <ForceInventoryDetails player={player} worlds={worlds} />
        </section>
      </DialogPrimitive.Popup>
    </DialogPortal>
  </Dialog>;
}

export function ForceReferenceGallery() {
  const [selected, setSelected] = useState<FactionId>('atreides');
  return <section className="force-reference" aria-label="Force counter gallery">
    <label>Faction<select value={selected} onChange={event => setSelected(event.target.value as FactionId)}>{FACTIONS.map(house => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
    <Examples factionId={selected} />
    <p>Counter faces are enlarged diagrams. Each is one physical counter; the current rules and powers determine its strength. The gallery shows component types, not a saved table’s quantities.</p>
    {selected === 'beneGesserit' && <p>Fighter and advisor are two faces of the same counter, not two separate forces.</p>}
  </section>;
}
