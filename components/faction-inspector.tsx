'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, X } from 'lucide-react';
import { FACTIONS, faction, type FactionId } from '@/game/catalog';
import { FACTION_RULES } from '@/game/faction-reference';
import { HOMEWORLD_CARDS } from '@/game/homeworld-cards';
import { Button } from './ui/button';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog';

/** Static public reference only: no player, holdings, hidden choices or action callback. */
export function FactionSheet({ factionId, advanced }: { factionId: FactionId; advanced: boolean }) {
  const house = faction(factionId);
  const rules = FACTION_RULES[factionId];
  const world = HOMEWORLD_CARDS.find(card => card.faction === factionId)!;
  return <article className="faction-sheet" aria-label={`${house.name} faction sheet`} style={{ borderTopColor: house.color }}>
    <header>
      <p className="faction-sheet-label">Faction sheet · {advanced ? 'Advanced' : 'Basic'}</p>
      <h3>{house.name}</h3>
      <p>{house.title}</p>
    </header>
    <Image src={`/art/homeworlds/${world.id}-v1.png`} alt="" width={1536} height={768} unoptimized loading="lazy" className="faction-sheet-art" />
    <section aria-label={`${house.name} Basic powers and alliances`}>
      <h4>Basic powers and alliances</h4>
      <ol>{rules.basic.map(text => <li key={text}>{text}</li>)}</ol>
    </section>
    {advanced && <section aria-label={`${house.name} Advanced powers`}>
      <h4>Advanced powers</h4>
      <p>Use these with the Basic powers above and the Advanced game rules.</p>
      <ol>{rules.advanced.map(text => <li key={text}>{text}</li>)}</ol>
    </section>}
    <footer>
      <p>The rules and game are still being completed. This sheet describes faction powers; table controls show the choices currently available. Optional modules can add or change powers.</p>
      <Link href={`/rules?topic=faction-${factionId}#faction-${factionId}`}>Full {house.name} reference</Link>
      {advanced && <Link href={`/rules?topic=advanced-${factionId}#advanced-${factionId}`}>Advanced {house.name} reference</Link>}
    </footer>
  </article>;
}

function FactionSheetReader({ factionId, tableAdvanced }: { factionId: FactionId; tableAdvanced?: boolean }) {
  const [advanced, setAdvanced] = useState(tableAdvanced ?? false);
  return <div className="faction-sheet-reader">
    {tableAdvanced !== undefined && <p className="force-notice">This table uses <strong>{tableAdvanced ? 'Advanced' : 'Basic'} rules</strong>.{advanced !== tableAdvanced && ' You are previewing the other rules mode; the table has not changed.'}</p>}
    <label className="faction-sheet-toggle"><input type="checkbox" checked={advanced} onChange={event => setAdvanced(event.target.checked)} /> Include Advanced powers</label>
    <FactionSheet factionId={factionId} advanced={advanced} />
  </div>;
}

export function FactionInspector({ factionId, advanced }: { factionId: FactionId; advanced: boolean }) {
  const house = faction(factionId);
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="min-h-11 min-w-11 motion-reduce:transition-none" />} aria-label={`Inspect faction: ${house.name}`}>
      <Eye aria-hidden="true" />Inspect faction
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
      <DialogPrimitive.Popup className="force-dialog">
        <div className="force-dialog-header"><span>Public faction sheet</span><DialogClose render={<Button variant="outline" className="min-h-11 min-w-11" />}><X aria-hidden="true" />Close</DialogClose></div>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The long faction sheet scrolls independently and needs keyboard access. */}
        <section className="force-dialog-scroll" aria-label="Faction sheet details" tabIndex={0}>
          <DialogTitle>{house.name} faction sheet</DialogTitle>
          <DialogDescription>Read public faction powers and alliance guidance without changing the game.</DialogDescription>
          <FactionSheetReader key={`${factionId}:${advanced}`} factionId={factionId} tableAdvanced={advanced} />
          <Link className="faction-sheet-help" href="/rules?topic=faction-sheets#faction-sheets">Faction sheet help</Link>
        </section>
      </DialogPrimitive.Popup>
    </DialogPortal>
  </Dialog>;
}

export function FactionSheetGallery() {
  const [selected, setSelected] = useState<FactionId>('atreides');
  return <section className="force-reference" aria-label="Faction sheet gallery">
    <label>Faction sheet<select value={selected} onChange={event => setSelected(event.target.value as FactionId)}>{FACTIONS.map(house => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
    <FactionSheetReader key={selected} factionId={selected} />
  </section>;
}
