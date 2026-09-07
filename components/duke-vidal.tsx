'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { GameView } from '@/game/engine';
import { DUKE_VIDAL_RULES } from '@/game/duke-vidal';
import { specialLeaderArt } from '@/game/special-leader-art';

/** Original Ecaz medallion; identity and strength have equivalent HTML text. */
function VidalDisc({ large = false }: { large?: boolean }) {
  const gradient = useId();
  return (
    <svg
      viewBox="0 0 160 160"
      className={large ? 'mx-auto my-6 size-48 max-w-full' : 'size-20 shrink-0'}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradient} cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#795577" />
          <stop offset="1" stopColor="#251b31" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="83" r="74" fill="#100f15" />
      <circle
        cx="80"
        cy="79"
        r="73"
        fill={`url(#${gradient})`}
        stroke="#d6bc80"
        strokeWidth="2"
      />
      <circle
        cx="80"
        cy="79"
        r="65"
        fill="none"
        stroke="#c9b385"
        strokeOpacity="0.65"
      />
      <path
        d="M 80 18 L 86 27 L 80 36 L 74 27 Z M 32 79 Q 32 39 63 30 M 128 79 Q 128 39 97 30 M 32 91 Q 41 125 64 133 M 128 91 Q 119 125 96 133"
        fill="none"
        stroke="#ddc892"
        strokeWidth="2"
      />
      <path
        d="M 55 48 L 67 59 L 80 43 L 93 59 L 105 48 L 98 69 H 62 Z"
        fill="none"
        stroke="#f0dca7"
        strokeWidth="2"
      />
      <text
        x="80"
        y="121"
        textAnchor="middle"
        fill="#fff1c9"
        fontFamily="Georgia, serif"
        fontSize="56"
      >
        6
      </text>
    </svg>
  );
}

/** Uses only the shared disc identity supplied by the public projection. */
function VidalPortrait({
  id,
  name,
  large = false,
}: {
  id?: string;
  name: string;
  large?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const art = specialLeaderArt(id, name);
  if (!art || failedSource === art.src) return <VidalDisc large={large} />;
  return (
    <span
      className={`relative block shrink-0 ${large ? 'mx-auto my-6 size-48 max-w-full' : 'size-20'}`}
    >
      <span className="absolute inset-0 overflow-hidden rounded-full border-2 border-[#d6bc80] bg-[#251b31]">
        <Image
          src={art.src}
          alt=""
          width={1254}
          height={1254}
          sizes={large ? '192px' : '80px'}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(art.src)}
          className="h-full w-full object-cover"
          style={{ objectPosition: art.objectPosition }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 rounded-full border border-[#e6ce99]/40"
        />
      </span>
    </span>
  );
}

/** Read-only shared component. Custody comes exclusively from the public projection. */
export function DukeVidal({ game }: { game: GameView }) {
  const duke = game.dukeVidal;
  if (!duke) return null;
  const controller = duke.controller
    ? game.players.find((player) => player.id === duke.controller)
    : undefined;
  const status = duke.leader.dead
    ? 'In the Tanks'
    : duke.controller
      ? `Controlled by ${controller?.name ?? 'another player'}`
      : 'Set aside';
  return (
    <section
      aria-label="Duke Prad Vidal shared leader"
      className="min-w-0 rounded-xl border border-[#75617a] bg-[#241f29] p-4 text-[#eee7de]"
    >
      <div className="flex flex-wrap items-center gap-4">
        <VidalPortrait id={duke.leader.id} name={duke.leader.name} />
        <div className="min-w-0 flex-1 basis-40">
          <p className="m-0 text-xs font-semibold tracking-[0.16em] text-[#d5b888] uppercase">
            Ecaz · shared leader · strength 6
          </p>
          <h3 className="mt-1 mb-2 break-words font-serif text-xl text-[#fff0d4]">
            Duke Prad Vidal
          </h3>
          <p className="m-0 break-words text-sm">{status}</p>
          <p className="mt-1 mb-0 text-sm text-[#cbbbcc]">No Traitor Card</p>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="min-h-11 min-w-11 motion-reduce:transition-none"
              />
            }
            aria-label="Inspect Duke Prad Vidal"
          >
            <Eye aria-hidden="true" /> Inspect Duke
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
            <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#9c815c] bg-[#19161d] text-[#eee7de] shadow-2xl outline-none motion-reduce:animate-none motion-reduce:transition-none">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#4c3b51] px-4 py-3">
                <span className="text-xs font-semibold tracking-[0.16em] text-[#dec18b] uppercase">
                  Shared leader inspection
                </span>
                <DialogClose
                  render={
                    <Button
                      variant="outline"
                      className="min-h-11 min-w-11 motion-reduce:transition-none"
                    />
                  }
                >
                  <X aria-hidden="true" /> Close
                </DialogClose>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <article className="min-w-0 rounded-xl border border-[#a08967] bg-gradient-to-br from-[#4a334e] to-[#221d28] p-5">
                    <p className="m-0 text-sm tracking-wider text-[#e5cea6] uppercase">
                      House Ecaz
                    </p>
                    <VidalPortrait
                      id={duke.leader.id}
                      name={duke.leader.name}
                      large
                    />
                    <DialogTitle className="break-words font-serif text-3xl leading-tight text-[#fff1d5]">
                      {DUKE_VIDAL_RULES.name}
                    </DialogTitle>
                    <dl className="my-5 space-y-3 border-y border-[#a08967]/50 py-4">
                      <div>
                        <dt className="text-sm text-[#d6c2cc]">
                          Leader strength
                        </dt>
                        <dd className="m-0 font-serif text-4xl">6</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-[#d6c2cc]">
                          Current state
                        </dt>
                        <dd className="m-0 break-words text-base">{status}</dd>
                      </div>
                    </dl>
                    <p className="mb-0 text-sm leading-6">
                      One shared disc. No Traitor Card.
                    </p>
                  </article>
                  <div className="min-w-0 space-y-5">
                    <DialogDescription className="m-0 text-base leading-7 text-[#ece0ce]">
                      {DUKE_VIDAL_RULES.summary}
                    </DialogDescription>
                    {DUKE_VIDAL_RULES.gameplay.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="m-0 text-base leading-7 text-[#ddd4df]"
                      >
                        {paragraph}
                      </p>
                    ))}
                    <p className="m-0 rounded-lg border border-[#675071] bg-[#2c2232] p-4 text-sm leading-6 text-[#e5d3df]">
                      Current support covers Moritani acquisition, direct Ecaz
                      Ambassador acquisition for Ecaz, battle use and death.
                      Unused Ecaz custody survives the turn; unused Moritani
                      custody expires. Ecaz alliance and loan alternatives,
                      reacquisition while already controlled, revival, and
                      captured or ghola custody remain unfinished. Full Ecaz and
                      Moritani games are unavailable. Inspection does not select
                      a battle leader.
                    </p>
                  </div>
                </div>
              </div>
            </DialogPrimitive.Popup>
          </DialogPortal>
        </Dialog>
      </div>
    </section>
  );
}
