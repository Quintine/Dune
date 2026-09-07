'use client';

import { useId } from 'react';
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
import type { SpiceCard } from '@/game/cards';
import { territory } from '@/game/board';
import { PHASE_HELP } from '@/game/reference';

/** Only the supplied visible face is read. No deck, discard pile or game is accepted. */
export type SpiceCardInspectorProps = {
  card: Readonly<SpiceCard>;
  context?: string;
};

export function spiceCardTitle(card: Readonly<SpiceCard>): string {
  if ('territory' in card)
    return `${territory(card.territory).name} · ${card.amount} spice · sector ${card.sector}`;
  if ('sandtrout' in card) return 'Sandtrout';
  return `Shai-Hulud${card.thumper ? ' · Thumper encounter' : ''}${card.suppressed ? ' · suppressed' : ''}`;
}

/** Original vector illustration, with no claim to reproduce a printed card face. */
function SpiceIllustration({
  kind,
}: {
  kind: 'territory' | 'worm' | 'sandtrout';
}) {
  const paint = `${useId()}-dune`;
  return (
    <svg
      viewBox="0 0 260 190"
      className="my-5 w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={paint} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            stopColor={kind === 'sandtrout' ? '#344a42' : '#4f3d29'}
          />
          <stop offset="1" stopColor="#171b17" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="258"
        height="188"
        rx="90"
        fill={`url(#${paint})`}
        stroke="#ac8c54"
        strokeOpacity="0.5"
      />
      <circle cx="194" cy="47" r="16" fill="#dfbd7b" opacity="0.65" />
      <path
        d="M 12 121 Q 62 72 126 119 T 248 119 M 8 151 Q 76 95 144 147 T 252 143 M 30 174 Q 104 129 228 172"
        fill="none"
        stroke="#c5a76b"
        strokeWidth="2"
        strokeOpacity="0.65"
      />
      {kind === 'territory' ? (
        <g fill="#dfb976" stroke="#fff0c4" strokeWidth="1.5">
          <path d="M 97 105 L 110 69 L 122 105 L 110 123 Z" />
          <path d="M 126 112 L 144 58 L 161 112 L 144 135 Z" />
          <path d="M 164 118 L 174 93 L 184 118 L 174 132 Z" />
        </g>
      ) : kind === 'worm' ? (
        <g fill="none" stroke="#dec18a">
          <path
            d="M 59 136 C 66 88 67 59 106 45 C 143 31 170 73 165 127"
            strokeWidth="8"
          />
          <ellipse
            cx="116"
            cy="77"
            rx="31"
            ry="37"
            fill="#141814"
            strokeWidth="3"
          />
          <ellipse cx="116" cy="77" rx="20" ry="25" strokeWidth="1" />
          <path
            d="M 116 42 V 58 M 116 96 V 113 M 85 77 H 99 M 134 77 H 147 M 94 51 L 103 61 M 131 94 L 140 103 M 94 103 L 103 94 M 131 61 L 140 51"
            strokeWidth="2"
          />
        </g>
      ) : (
        <g fill="#7c9579" fillOpacity="0.3" stroke="#c6d1aa" strokeWidth="2">
          <path d="M 72 90 C 80 45 122 39 150 70 C 191 56 204 95 167 114 C 144 145 109 137 103 114 C 76 127 53 113 72 90 Z" />
          <path
            d="M 83 87 Q 120 63 159 87 M 96 107 Q 127 86 164 101"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}

export function SpiceCardInspector({ card, context }: SpiceCardInspectorProps) {
  const kind =
    'territory' in card
      ? 'territory'
      : 'sandtrout' in card
        ? 'sandtrout'
        : 'worm';
  const title = spiceCardTitle(card);
  const faceName =
    'territory' in card
      ? territory(card.territory).name
      : kind === 'worm'
        ? 'Shai-Hulud'
        : 'Sandtrout';
  const description =
    kind === 'territory'
      ? 'This spice blow names the territory, sector and base spice amount. The storm and card effects can change how much spice actually appears.'
      : kind === 'worm'
        ? 'A Shai-Hulud encounter can consume forces and spice in the territory identified by the preceding card in its spice discard pile. Resolve protection, Nexus and riding decisions through the table.'
        : 'Sandtrout breaks existing alliances and waits for the next active drawn Shai-Hulud. It suppresses that encounter, then the immediate replacement determines whether a spice blow is doubled.';
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="min-h-11 min-w-11 motion-reduce:transition-none"
          />
        }
        aria-label={`Inspect spice card: ${title}${context ? ` · ${context}` : ''}`}
      >
        <Eye aria-hidden="true" />
        Inspect spice card
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
            <span className="text-xs font-semibold tracking-[0.16em] text-[#ddbc77] uppercase">
              Spice card inspection
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
              <article className="min-w-0 rounded-xl border border-[#a58b5c] bg-gradient-to-br from-[#493d29] via-[#2f3023] to-[#171b17] p-5 shadow-lg sm:p-6">
                <p className="m-0 text-sm font-semibold tracking-wider text-[#f1d79f] uppercase">
                  {kind === 'territory'
                    ? 'Spice blow'
                    : kind === 'worm'
                      ? 'Worm encounter'
                      : 'Sandtrout'}
                </p>
                <SpiceIllustration kind={kind} />
                <DialogTitle className="break-words font-serif text-3xl leading-tight text-[#fff3d6] sm:text-4xl">
                  {faceName}
                </DialogTitle>
                {'territory' in card && (
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-[#b59a64]/40 py-4">
                    <div>
                      <dt className="text-sm text-[#d6c9ad]">Card amount</dt>
                      <dd className="m-0 mt-1 font-serif text-4xl text-[#f6e4b9]">
                        {card.amount}
                        <span className="block font-sans text-sm">spice</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[#d6c9ad]">Sector</dt>
                      <dd className="m-0 mt-1 font-serif text-4xl text-[#f6e4b9]">
                        {card.sector}
                      </dd>
                    </div>
                  </dl>
                )}
                {'worm' in card && card.thumper && (
                  <p className="mt-4 text-base leading-7 text-[#eee5d2]">
                    Thumper-created encounter
                  </p>
                )}
                {'worm' in card && card.suppressed && (
                  <p className="mt-4 text-base leading-7 text-[#eee5d2]">
                    Suppressed by Sandtrout
                  </p>
                )}
                <p className="mt-5 mb-0 text-xs tracking-wider text-[#cebea0] uppercase">
                  Spice · gameplay guide
                </p>
              </article>
              <section
                className="flex min-w-0 flex-col gap-5"
                aria-label="Spice card guidance"
              >
                {context && (
                  <p className="m-0 text-sm font-semibold text-[#ddbc77]">
                    {context}
                  </p>
                )}
                <DialogDescription className="m-0 text-base leading-7 text-[#eee5d2]">
                  {description}
                </DialogDescription>
                <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                  Inspection does not draw a card or resolve an effect. Close
                  this view to use the table’s phase controls.
                </p>
                {kind === 'territory' ? (
                  <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                    Spice cannot appear in the storm’s sector. A fresh blow
                    remains open for Harvester before acceptance. The amount on
                    this face is the card’s base value, not the total spice
                    currently on the board.
                  </p>
                ) : kind === 'worm' ? (
                  <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                    First-turn drawn worms are ignored and later shuffled back.
                    A worm suppressed by Sandtrout does not devour the preceding
                    territory or create its own Nexus or Fremen ride. A normal
                    encounter follows the table’s worm and alliance decisions.
                  </p>
                ) : (
                  <>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Territories drawn before the next active Shai-Hulud
                      receive their usual spice. Sandtrout remains pending until
                      that worm is suppressed, even across spice blows or turns.
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      If the immediate replacement is a territory, double its
                      spice; Harvester may enhance that fresh blow again. If the
                      replacement is another Shai-Hulud, resolve it normally and
                      do not double a later territory. Spice still cannot appear
                      in the storm.
                    </p>
                  </>
                )}
                <p className="m-0 rounded-lg border border-[#454b3c] bg-[#1d221b] p-4 text-base leading-7 text-[#e0e4d8]">
                  {PHASE_HELP[1]}
                </p>
              </section>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
