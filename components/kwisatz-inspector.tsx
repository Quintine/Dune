'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, X } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog';
import { KWISATZ_RULES, kwisatzAvailability, type KwisatzBattleContext, type KwisatzDisplayState } from '@/game/kwisatz-display';

export function KwisatzCardFace() {
  return <figure aria-label="Kwisatz Haderach companion card" className="mx-auto my-0 w-full max-w-sm overflow-hidden rounded-xl border-2 border-[#96815a] bg-[#252b25] text-[#f5e8c9]">
    <figcaption className="p-4 text-center font-serif text-2xl">Kwisatz Haderach</figcaption>
    <Image unoptimized src="/art/leaders/kwisatz-haderach-v1.png" alt="Original portrait of Kwisatz Haderach, with blue eyes and a green desert mantle" width={1254} height={1254} className="aspect-square w-full object-cover" />
    <div className="space-y-2 p-4 text-base leading-7">
      <p className="m-0 font-semibold">Atreides · Advanced game · +2 strength</p>
      <p className="m-0">A battle companion for a leader or Cheap Hero. The bonus counts if the accompanying leader survives; that leader cannot turn traitor.</p>
      <p className="m-0">Available after seven Atreides battle-force losses. One territory per turn.</p>
    </div>
  </figure>;
}

export function KwisatzPrivateStatus({ state, battle, usedTerritoryName }: {
  state: KwisatzDisplayState;
  battle?: KwisatzBattleContext;
  usedTerritoryName?: string;
}) {
  return <section aria-label="Your private Kwisatz Haderach status" className="space-y-2 rounded-lg border border-[#647555] bg-[#243023] p-4 text-base leading-7">
    <h3 className="m-0 font-semibold">Your private status</h3>
    <p className="m-0">{state.losses} of 7 battle losses{state.active ? ' · awakened' : ''}</p>
    <progress aria-label="Atreides battle losses toward Kwisatz Haderach" max={7} value={Math.min(7, Math.max(0, state.losses))} className="h-3 w-full accent-[#c9ad70]" />
    <p className="m-0">{kwisatzAvailability(state, battle)}</p>
    {state.usedAt && <p className="m-0">Used this turn in {usedTerritoryName ?? state.usedAt}.</p>}
  </section>;
}

/** State is supplied only from me.kwisatz; reference inspection has no live state. */
export function KwisatzInspector({ state, battle, usedTerritoryName, context = 'reference' }: {
  state?: KwisatzDisplayState;
  battle?: KwisatzBattleContext;
  usedTerritoryName?: string;
  context?: 'reference' | 'plan';
}) {
  const label = state ? 'private status' : context === 'plan' ? 'plan component' : 'rules reference';
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="min-h-11 max-w-full whitespace-normal motion-reduce:transition-none" />} aria-label={`Inspect Kwisatz Haderach · ${label}`}>
      <Eye aria-hidden="true" />Inspect Kwisatz Haderach
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
      <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
          <span className="text-sm font-semibold text-[#ddbc77]">{state ? 'Private component inspection' : context === 'plan' ? 'Included in this plan' : 'Rules reference'}</span>
          <DialogClose render={<Button variant="outline" className="min-h-11 min-w-11 motion-reduce:transition-none" />}><X aria-hidden="true" />Close</DialogClose>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus this independently scrolling rules region. */}
        <section aria-label="Kwisatz Haderach details" tabIndex={0} className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5 focus-visible:outline-2 focus-visible:outline-[#ddbc77] sm:p-6">
          <DialogTitle className="m-0 font-serif text-2xl text-[#fff3d6]">Kwisatz Haderach</DialogTitle>
          <DialogDescription className="m-0 text-base leading-7 text-[#d9d4c7]">{state ? 'Your battle-loss count and availability are private. Opening this view does not reveal them.' : context === 'plan' ? 'Kwisatz Haderach is included in this plan you are allowed to inspect. No private loss count or current availability is shown.' : 'The Atreides battle companion for the Advanced game. This reference does not show any game’s private loss count or battle plan.'}</DialogDescription>
          {state && <KwisatzPrivateStatus state={state} battle={battle} usedTerritoryName={usedTerritoryName} />}
          <KwisatzCardFace />
          <ol className="m-0 list-decimal space-y-3 pl-5 text-base leading-7">{KWISATZ_RULES.map(rule => <li key={rule}>{rule}</li>)}</ol>
        </section>
      </DialogPrimitive.Popup>
    </DialogPortal>
  </Dialog>;
}

export function KwisatzReferenceCard() {
  return <section aria-label="Kwisatz Haderach component" className="space-y-4">
    <KwisatzCardFace />
    <KwisatzInspector />
  </section>;
}
