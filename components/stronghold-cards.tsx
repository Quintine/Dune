'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from './ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import type { Action } from '@/game/engine';
import {
  STRONGHOLD_CARDS,
  type StrongholdId,
  type StrongholdState,
} from '@/game/stronghold-cards';

type StrongholdDefinition = (typeof STRONGHOLD_CARDS)[number];

/** Original, bundled artwork; rules remain independent selectable text. */
function StrongholdIllustration({ id }: { id: StrongholdId }) {
  return (
    <Image
      src={`/art/strongholds/${id}-v1.png`}
      alt=""
      unoptimized
      width={1774}
      height={887}
      loading="lazy"
      className="block aspect-[2/1] w-full object-cover"
    />
  );
}

function StrongholdFace({
  card,
  ownership,
  children,
  enlarged = false,
}: {
  enlarged?: boolean;
  card: StrongholdDefinition;
  ownership?: string;
  children?: ReactNode;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[#a88b60] bg-[#24271f] text-[#f2e8d3] shadow-lg">
      <div className="m-2 overflow-hidden rounded-lg border border-[#ab8a58]/60">
        <header className="flex min-h-20 items-center gap-3 bg-[#65362f] px-4 py-3">
          <h3 className="m-0 min-w-0 flex-1 break-words font-serif text-xl leading-tight text-[#fff1d4]">
            {card.name}
          </h3>
          <svg
            viewBox="0 0 32 32"
            className="h-8 w-8 shrink-0"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="16" cy="16" r="14" fill="none" stroke="#e2c18b" />
            <path d="M8 24V13h5v11m1 0V7h5v17m1 0v-9h4v9" fill="#e2c18b" />
          </svg>
        </header>
        <StrongholdIllustration id={card.id} />
        <div className="space-y-4 p-4">
          {ownership && (
            <p className="m-0 break-words border-b border-[#a88b60]/40 pb-3 text-sm font-semibold leading-6 text-[#edcc8c]">
              {ownership}
            </p>
          )}
          {card.gameplay.map((paragraph) => (
            <p
              key={paragraph}
              className={
                enlarged ? 'm-0 text-xl leading-8' : 'm-0 text-base leading-7'
              }
            >
              {paragraph}
            </p>
          ))}
          {!enlarged && (
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
                        <Button
                          variant="outline"
                          className="min-h-11 min-w-16"
                        />
                      }
                    >
                      Close
                    </DialogClose>
                  </div>
                  <DialogDescription className="sr-only">
                    Full Stronghold Card with its public ownership and gameplay
                    text.
                  </DialogDescription>
                  <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
                    <StrongholdFace
                      card={card}
                      ownership={ownership}
                      enlarged
                    />
                  </div>
                </DialogPrimitive.Popup>
              </DialogPortal>
            </Dialog>
          )}
          {children}
          <p className="m-0 border-t border-[#a88b60]/40 pt-3 text-xs leading-5 tracking-wide text-[#c9baa0]">
            CHOAM &amp; Richese · Advanced Stronghold
          </p>
        </div>
      </div>
    </article>
  );
}

export function StrongholdCardGallery({
  state,
  players,
}: {
  state: StrongholdState;
  players: { id: string; name: string }[];
}) {
  return (
    <section aria-label="Advanced Stronghold cards" className="space-y-4">
      <div>
        <h2 className="m-0 font-serif text-2xl text-[#f2e8d3]">
          Advanced Stronghold cards
        </h2>
        <p className="mt-2 mb-0 text-sm leading-6 text-[#c9baa0]">
          CHOAM &amp; Richese · Optional module
          {state.claimedTurn > 0
            ? ` · Last claim: turn ${state.claimedTurn}`
            : ' · Initial claims pending'}
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STRONGHOLD_CARDS.map((card) => {
          const owner = state.owners[card.id];
          const name = players.find((player) => player.id === owner)?.name;
          return (
            <StrongholdFace
              key={card.id}
              card={card}
              ownership={owner ? `Held by ${name ?? owner}` : 'Unclaimed'}
            />
          );
        })}
      </div>
    </section>
  );
}

export function StrongholdCopyChoice({
  event,
  choices,
  act,
  busy,
}: {
  event: string;
  choices: StrongholdId[];
  act: (action: Action) => void;
  busy: boolean;
}) {
  const available = STRONGHOLD_CARDS.filter((card) =>
    choices.includes(card.id),
  );
  return (
    <section
      aria-label="Choose the mobile stronghold advantage"
      className="space-y-4"
      aria-busy={busy}
    >
      <p className="m-0 text-base leading-7">
        Choose the controlled stronghold advantage to copy before making battle
        plans.
      </p>
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        {available.map((card) => (
          <StrongholdFace key={card.id} card={card}>
            <button
              type="button"
              disabled={busy}
              className="min-h-12 w-full whitespace-normal rounded-lg border border-[#eed29a] bg-[#d4b171] px-4 py-3 text-base font-semibold leading-6 text-[#1c211b] enabled:cursor-pointer enabled:hover:bg-[#edcc8c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#edcc8c] disabled:cursor-wait disabled:opacity-50"
              onClick={() =>
                act({ type: 'decision', event, stronghold: card.id })
              }
            >
              Copy {card.name}
            </button>
          </StrongholdFace>
        ))}
      </div>
    </section>
  );
}
