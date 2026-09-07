'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, Shield, Sparkles, Swords, UserRound, X } from 'lucide-react';
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
import { cardPresentation, type VisibleCard } from '@/game/card-presentation';

/** Always pass a card from the requesting player's authorized view, never a deck. */
type CardProps = { card: VisibleCard };

export function CardRules({ card }: CardProps) {
  return (
    <p className="card-rules text-sm leading-relaxed text-[#e2d9c6]">
      {cardPresentation(card).guidance}
    </p>
  );
}

const faceColors = {
  weapon: 'from-[#512f28] via-[#302622] to-[#171b17]',
  defense: 'from-[#284544] via-[#243330] to-[#171b17]',
  leader: 'from-[#4b3c23] via-[#353123] to-[#171b17]',
  utility: 'from-[#38344b] via-[#2d2c34] to-[#171b17]',
};
const roleIcons = {
  weapon: Swords,
  defense: Shield,
  leader: UserRound,
  utility: Sparkles,
};

/** Read-only inspection. It cannot play a card, read game state, or reveal another card. */
export function CardInspector({ card }: CardProps) {
  const presentation = cardPresentation(card);
  const Icon = roleIcons[presentation.role];
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="min-h-11 w-full motion-reduce:transition-none"
          />
        }
        aria-label={`Inspect card: ${card.name}`}
      >
        <Eye aria-hidden="true" />
        Inspect card
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
            <span className="text-xs font-semibold tracking-[0.16em] text-[#ddbc77] uppercase">
              Card inspection
            </span>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="min-h-11 min-w-11 motion-reduce:transition-none"
                />
              }
            >
              <X aria-hidden="true" />
              Close
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <article
                className={`min-w-0 rounded-xl border border-[#a58b5c] bg-gradient-to-br ${faceColors[presentation.role]} p-5 shadow-lg sm:p-6`}
              >
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#b59a64]/40 pb-4">
                  <span className="text-xs font-semibold tracking-[0.12em] text-[#f1d79f] uppercase">
                    {presentation.category}
                  </span>
                  <Icon
                    className="size-6 shrink-0 text-[#edce90]"
                    aria-hidden="true"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="mx-auto mb-6 flex size-24 rotate-45 items-center justify-center rounded-2xl border border-[#c5a86d]/40 bg-[#d7bd81]/5"
                >
                  <Icon className="size-12 -rotate-45 text-[#ddbc77]" />
                </div>
                <DialogTitle className="break-words font-serif text-3xl leading-tight text-[#fff3d6] sm:text-4xl">
                  {card.name}
                </DialogTitle>
                <DialogDescription className="mt-5 text-base leading-7 text-[#eee5d2]">
                  {presentation.guidance}
                </DialogDescription>
                <div className="mt-6 border-t border-[#b59a64]/40 pt-3 text-xs tracking-wider text-[#cebea0] uppercase">
                  Treachery · gameplay guide
                </div>
              </article>
              <section
                className="flex min-w-0 flex-col gap-5"
                aria-label={`How to use ${card.name}`}
              >
                <p className="m-0 text-sm leading-6 text-[#c1c5b8]">
                  {presentation.availability ??
                    'Inspecting a card does not play it. Close this view to use the table’s action controls.'}
                </p>
                {presentation.gameplay && (
                  <div className="flex flex-col gap-4 rounded-lg border border-[#454b3c] bg-[#1d221b] p-4 text-base leading-7 text-[#e0e4d8]">
                    <h3 className="m-0 text-base font-semibold text-[#efd9a8]">
                      Playing {card.name}
                    </h3>
                    {presentation.gameplay.map((paragraph) => (
                      <p className="m-0" key={paragraph}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
                {presentation.topics.map((topic, index) => (
                  <details
                    key={topic.id}
                    open={index === 0}
                    className="rounded-lg border border-[#454b3c] bg-[#1d221b]"
                  >
                    <summary className="cursor-pointer rounded-lg px-4 py-3 text-base font-semibold text-[#efd9a8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddbc77]">
                      {topic.title}
                    </summary>
                    <div className="flex flex-col gap-3 border-t border-[#454b3c] p-4 text-base leading-7 text-[#e0e4d8]">
                      {topic.steps.map((step) => (
                        <p className="m-0" key={step}>
                          {step}
                        </p>
                      ))}
                      {topic.example && (
                        <p className="m-0 rounded border-l-2 border-[#ddbc77] bg-[#ddbc77]/5 p-3">
                          <strong>Example: </strong>
                          {topic.example}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </section>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
