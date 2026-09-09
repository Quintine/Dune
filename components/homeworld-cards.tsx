'use client';

import Image from 'next/image';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { FACTIONS } from '@/game/catalog';
import { HOMEWORLD_CARDS, type HomeworldCard } from '@/game/homeworld-cards';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

function HomeworldPopulation({
  card,
  side,
  enlarged,
}: {
  card: HomeworldCard;
  side: 'high' | 'low';
  enlarged: boolean;
}) {
  const face = card[side];
  return (
    <section
      aria-label={`${side === 'high' ? 'High' : 'Low'} population rules`}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#a88b60]/40 pb-3">
        <h4 className="m-0 font-serif text-xl">
          {side === 'high' ? 'High' : 'Low'} population
        </h4>
        <span className="rounded border border-[#a88b60]/60 px-3 py-1 text-base tabular-nums">
          {face.reserves.min}–{face.reserves.max}{' '}
          {card.reserveType === 'sardaukar' ? 'Sardaukar' : 'reserves'}
        </span>
      </div>
      {face.gameplay.map((text) => (
        <p
          key={text}
          className={
            enlarged ? 'm-0 text-xl! leading-8!' : 'm-0 text-base! leading-7!'
          }
        >
          {text}
        </p>
      ))}
      <div className="grid gap-2 border-t border-[#a88b60]/40 pt-3 text-sm leading-6 sm:grid-cols-2">
        <p className="m-0">
          <strong className="text-[#edcc8c]">
            +{face.battleStrength} battle strength
          </strong>
          <br />
          Added to the native faction’s dial here.
        </p>
        <p className="m-0">
          <strong className="text-[#edcc8c]">
            {face.battleStrength} explosion losses
          </strong>
          <br />
          Native forces lost to a Lasgun/Shield explosion here.
        </p>
      </div>
    </section>
  );
}

export function HomeworldFace({
  card,
  enlarged = false,
}: {
  card: HomeworldCard;
  enlarged?: boolean;
}) {
  const faction = FACTIONS.find((item) => item.id === card.faction)!;
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[#a88b60] bg-[#20271f] text-[#f2e8d3] shadow-lg">
      <header
        className="flex min-h-24 flex-wrap items-center gap-3 border-b border-[#a88b60]/50 px-4 py-4"
        style={{ borderTop: `4px solid ${faction.color}` }}
      >
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm leading-6 text-[#d1c7b0]">
            {faction.name} · Homeworld
          </p>
          <h3 className="m-0 break-words font-serif text-2xl leading-tight text-[#fff1d4]">
            {card.name}
          </h3>
        </div>
        {card.id === 'salusa_secundus' && (
          <span className="text-sm text-[#edcc8c]">Advanced only</span>
        )}
      </header>
      <Image
        src={`/art/homeworlds/${card.id}-v1.png`}
        alt=""
        width={1536}
        height={768}
        unoptimized
        loading="lazy"
        className="block aspect-[2/1] w-full object-cover"
      />
      <Tabs defaultValue="high" className="gap-4 p-4">
        <TabsList
          aria-label={`${card.name} card face`}
          className="grid h-auto! w-full grid-cols-2 bg-[#101912] p-1"
        >
          <TabsTrigger
            value="high"
            className="min-h-11 whitespace-normal px-2 text-[#d1c7b0] data-active:bg-[#3f513b] data-active:text-white"
          >
            High face
          </TabsTrigger>
          <TabsTrigger
            value="reverse"
            className="min-h-11 whitespace-normal px-2 text-[#d1c7b0] data-active:bg-[#3f513b] data-active:text-white"
          >
            Low / occupied face
          </TabsTrigger>
        </TabsList>
        <TabsContent value="high">
          <HomeworldPopulation card={card} side="high" enlarged={enlarged} />
        </TabsContent>
        <TabsContent value="reverse" className="space-y-6">
          <HomeworldPopulation card={card} side="low" enlarged={enlarged} />
          <section
            aria-label="Occupied rules"
            className="space-y-4 border-t-2 border-[#a88b60] pt-4"
          >
            <h4 className="m-0 font-serif text-xl">Occupied</h4>
            {card.occupied.gameplay.map((text) => (
              <p
                key={text}
                className={
                  enlarged
                    ? 'm-0 text-xl! leading-8!'
                    : 'm-0 text-base! leading-7!'
                }
              >
                {text}
              </p>
            ))}
            <p className="m-0 flex items-center gap-2 text-sm leading-6 text-[#edcc8c]">
              <span aria-hidden="true" className="text-xl">
                {'◆'.repeat(card.occupied.spiceIcons)}
              </span>
              {card.occupied.spiceIcons} bank spice during Spice Collection
            </p>
            <p className="m-0 text-sm leading-6 text-[#d1c7b0]">
              The low-population penalty continues while occupied.
            </p>
          </section>
        </TabsContent>
      </Tabs>
      {card.id === 'salusa_secundus' && (
        <p className="m-0 px-4 pb-4 text-sm leading-6 text-[#d1c7b0]">
          Both printed ranges include 2. The module’s minimum-high rule makes 2
          Sardaukar high population.
        </p>
      )}
      {!enlarged && (
        <div className="px-4 pb-4">
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  className="min-h-11 w-full whitespace-normal"
                />
              }
            >
              Inspect {card.name}
            </DialogTrigger>
            <DialogPortal>
              <DialogOverlay className="bg-black/75 motion-reduce:animate-none" />
              <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#a88b60] bg-[#171d18] text-[#f2e8d3] shadow-2xl outline-none motion-reduce:animate-none">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#a88b60]/40 px-4 py-3">
                  <DialogTitle className="text-base leading-6">
                    {card.name}
                  </DialogTitle>
                  <DialogClose
                    render={
                      <Button variant="outline" className="min-h-11 min-w-16" />
                    }
                  >
                    Close
                  </DialogClose>
                </div>
                <DialogDescription className="sr-only">
                  Both faces of the Homeworld card, including population ranges,
                  native battle values and occupied effects.
                </DialogDescription>
                <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
                  <HomeworldFace card={card} enlarged />
                </div>
              </DialogPrimitive.Popup>
            </DialogPortal>
          </Dialog>
        </div>
      )}
      <footer className="border-t border-[#a88b60]/40 px-4 py-3 text-xs leading-5 tracking-wide text-[#c9baa0]">
        Ecaz &amp; Moritani · 1 two-sided card + 1 world token
      </footer>
    </article>
  );
}

export function HomeworldCardGallery() {
  return (
    <section aria-label="Homeworld card collection" className="space-y-4">
      <p className="m-0 text-base leading-7 text-[#d1c7b0]">
        13 worlds · Inspect either face to read its complete gameplay effects.
        Homeworld games are not yet available.
      </p>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {HOMEWORLD_CARDS.map((card) => (
          <HomeworldFace key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
