'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, Wind, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog';
import { STORM_CARD_DISTANCES, isStormCardDistance, stormCardDistance, type StormCardDistance } from '@/game/storm-cards';

const sectors = (distance: number) => `${distance} ${distance === 1 ? 'sector' : 'sectors'}`;
const contexts = {
  forecast: {
    label: 'Private forecast',
    description: 'This is your private forecast for the next turn. Inspecting it does not reveal it to other players.',
  },
  reveal: {
    label: 'Public reveal',
    description: 'This card was revealed during a Storm phase. It records that revealed face, not the next private forecast.',
  },
  reference: {
    label: 'Rules reference',
    description: 'This is one of the six possible Storm Card faces. The reference does not show which card a game has drawn.',
  },
} as const;

function StormCardFace({ distance }: { distance: StormCardDistance }) {
  return <figure className="mx-auto my-0 flex min-h-52 w-full max-w-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-[#96815a] bg-[#252b25] p-5 text-center text-[#f5e8c9]" aria-label={`Storm Card: ${sectors(distance)}`}>
    <div className="flex items-center gap-2 text-base font-semibold tracking-widest uppercase"><Wind aria-hidden="true" size={20} />Storm</div>
    <strong className="font-serif text-7xl leading-none" aria-hidden="true">{distance}</strong>
    <span className="text-base">{distance === 1 ? 'Sector' : 'Sectors'} counterclockwise</span>
  </figure>;
}

/** Accept one already-authorized face, never a game, deck or forecast authority. */
export function StormCardInspector({ distance, context = 'reference' }: {
  distance: unknown;
  context?: keyof typeof contexts;
}) {
  if (!isStormCardDistance(distance)) return null;
  const guide = contexts[context];
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="min-h-11 max-w-full whitespace-normal text-sm motion-reduce:transition-none" />}
      aria-label={`Inspect Storm Card: ${sectors(distance)} · ${guide.label}`}>
      <Eye aria-hidden="true" />Inspect Storm Card
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
      <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
          <span className="text-sm font-semibold text-[#ddbc77]">{guide.label}</span>
          <DialogClose render={<Button variant="outline" className="min-h-11 min-w-11 motion-reduce:transition-none" />}><X aria-hidden="true" />Close</DialogClose>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <DialogTitle className="m-0 font-serif text-2xl leading-tight text-[#fff3d6]">Storm Card — {sectors(distance)}</DialogTitle>
          <DialogDescription className="m-0 text-base leading-7 text-[#d9d4c7]">{guide.description}</DialogDescription>
          <StormCardFace distance={distance} />
          <p className="m-0 text-base leading-7">In the Advanced game with Fremen, the first storm uses the Battle Wheels.
            For later turns, the selected Storm Card is revealed and supplies the storm’s counterclockwise distance.
            It returns to the deck before the next forecast is drawn.</p>
          <p className="m-0 text-base leading-7">This face shows the card’s value. Weather Control and other effects can change
            the actual movement; the table’s storm result records that movement.</p>
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  </Dialog>;
}

export function StormCardLogInspector({ component }: { component: unknown }) {
  const distance = stormCardDistance(component);
  return distance === null ? null : <StormCardInspector distance={distance} context="reveal" />;
}

export function StormCardGallery() {
  return <section aria-label="Storm Card collection" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {STORM_CARD_DISTANCES.map(distance => <article key={distance} className="flex min-w-0 flex-col items-center gap-3 rounded-lg border border-[#454b3c] bg-[#1d221b] p-4">
      <h3 className="m-0 font-serif text-xl text-[#efd9a8]">Storm Card {distance}</h3>
      <StormCardFace distance={distance} />
      <StormCardInspector distance={distance} />
    </article>)}
  </section>;
}
