'use client';

import { useId, useState } from 'react';
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
import type { Action, GameView } from '@/game/engine';
import type { AmbassadorToken } from '@/game/ecaz-ambassadors';
import {
  AMBASSADOR_COMMON_GUIDANCE,
  AMBASSADOR_REFERENCE,
} from '@/game/ambassador-reference';
import { TERRITORIES } from '@/game/board';
import { faction } from '@/game/catalog';

export const AMBASSADOR_COVERAGE =
  'Development coverage: Ambassador placement, Ecaz’s direct Duke acquisition and consensual alliance, Emperor, Atreides, Harkonnen, CHOAM, Ixian, Richese, Fremen and Guild entry effects are supported, plus Bene Gesserit copies of those eight ordinary effects. Duke loan choices, other effects and some competing arrival reactions remain unfinished; full Ecaz starts remain disabled.';
function tokenLocation(token: AmbassadorToken) {
  if (token.zone === 'placed')
    return `Placed in ${TERRITORIES.find((t) => t.id === token.location)?.name ?? 'a stronghold'}`;
  return {
    pool: 'Unused pool',
    supply: 'Available supply',
    used: 'Triggered · set aside',
    removed: 'Permanently removed',
  }[token.zone];
}
function AmbassadorArt({
  token,
  large = false,
}: {
  token: AmbassadorToken;
  large?: boolean;
}) {
  const identity = faction(token.effect);
  return (
    <svg
      viewBox="0 0 120 120"
      className={large ? 'mx-auto my-5 size-40 max-w-full' : 'size-14 shrink-0'}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="60"
        cy="60"
        r="55"
        fill="#182725"
        stroke={identity.color}
        strokeWidth="4"
      />
      <circle cx="60" cy="60" r="45" fill="none" stroke="#dac594" />
      <path
        d="M60 9l5 10-5 10-5-10zM60 91l5 10-5 10-5-10zM9 60l10-5 10 5-10 5zM91 60l10-5 10 5-10 5z"
        fill="#dac594"
      />
      <text
        x="60"
        y="75"
        textAnchor="middle"
        fill="#f2dfb9"
        fontFamily="Georgia,serif"
        fontSize="40"
      >
        {identity.sigil}
      </text>
    </svg>
  );
}
/** Inspection accepts one already-public token; no private deck or game state is consulted. */
export function AmbassadorInspector({ token }: { token: AmbassadorToken }) {
  const guide = AMBASSADOR_REFERENCE[token.effect];
  const status = tokenLocation(token);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-auto min-h-11 w-full min-w-0 justify-start gap-3 whitespace-normal px-3 py-3 text-left motion-reduce:transition-none"
          />
        }
        aria-label={`Inspect ${guide.name} Ambassador: ${status}`}
      >
        <AmbassadorArt token={token} />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-base">{guide.name}</span>
          <span className="block text-xs leading-5">{status}</span>
        </span>
        <Eye aria-hidden="true" className="size-4 shrink-0" />
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 motion-reduce:animate-none" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#8c815c] bg-[#17231f] p-5 text-[#e8e9dc] shadow-2xl outline-none sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="m-0 font-serif text-2xl text-[#efd9a8]">
                {guide.name} Ambassador
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6">
                Gameplay guide · {status}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11 shrink-0 motion-reduce:transition-none"
                />
              }
              aria-label="Close Ambassador inspection"
            >
              <X aria-hidden="true" />
            </DialogClose>
          </div>
          <AmbassadorArt token={token} large />
          <p className="text-base leading-7">{guide.gameplay}</p>
          <h3 className="mt-6 font-serif text-xl text-[#efd9a8]">
            Using Ambassadors
          </h3>
          {AMBASSADOR_COMMON_GUIDANCE.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6">
              {paragraph}
            </p>
          ))}
          <p className="mt-5 border-t border-[#68705a] pt-4 text-sm leading-6">
            {AMBASSADOR_COVERAGE}
          </p>
          <p className="text-xs leading-5">
            Original illustration and gameplay explanation.
          </p>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function AmbassadorSupply({ game }: { game: GameView }) {
  if (!game.ambassadors) return null;
  const supplyCount = game.ambassadors.tokens.filter(
    (token) => token.zone === 'supply',
  ).length;
  const placedCount = game.ambassadors.tokens.filter(
    (token) => token.zone === 'placed',
  ).length;
  const zones: AmbassadorToken['zone'][] = [
    'supply',
    'placed',
    'used',
    'removed',
    'pool',
  ];
  const names = {
    supply: 'Available supply',
    placed: 'On the board',
    used: 'Triggered this group',
    removed: 'Permanently removed',
    pool: 'Unused pool',
  };
  return (
    <details className="notice min-w-0">
      <summary className="min-h-11 cursor-pointer py-2 leading-7 focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="font-serif text-xl">Ecaz Ambassadors</span>{' '}
        <span className="text-sm">
          · {supplyCount} in supply · {placedCount} placed · Inspect tokens
        </span>
      </summary>
      <p className="text-sm leading-6">
        Inspect any token to read its effect and current location.
      </p>
      {zones.map((zone) => {
        const tokens = game.ambassadors!.tokens.filter(
          (token) => token.zone === zone,
        );
        if (!tokens.length) return null;
        return (
          <div key={zone} className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">
              {names[zone]} · {tokens.length}
            </h4>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {tokens.map((token) => (
                <AmbassadorInspector token={token} key={token.id} />
              ))}
            </div>
          </div>
        );
      })}
      <p className="mt-4 text-sm leading-6">{AMBASSADOR_COVERAGE}</p>
    </details>
  );
}

export function EcazPlacement({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const me = game.players.find((player) => player.id === game.me);
  const state = game.ambassadors;
  if (
    !state ||
    me?.faction !== 'ecaz' ||
    game.decision?.kind !== 'ecazPlacement' ||
    game.decision.player !== me.id
  )
    return null;
  const supply = state.tokens.filter((token) => token.zone === 'supply');
  const destinations = TERRITORIES.filter(
    (territory) =>
      territory.type === 'stronghold' &&
      !territory.sectors.includes(game.storm) &&
      !state.tokens.some(
        (token) => token.zone === 'placed' && token.location === territory.id,
      ),
  );
  const token = supply.find((candidate) => candidate.id === selectedToken);
  const destination = destinations.find(
    (candidate) => candidate.id === selectedTerritory,
  );
  const affordable = (me.spice ?? 0) >= state.nextCost;
  const disabled =
    busy || state.blocked || !token || !destination || !affordable;
  return (
    <section
      className="notice flex min-w-0 flex-col gap-3"
      aria-label="Place an Ecaz Ambassador"
    >
      <h3 className="m-0 font-serif text-xl">Place an Ambassador</h3>
      <p className="m-0 text-sm leading-6">
        Next placement: <strong>{state.nextCost} spice</strong> · Your available
        spice: {me.spice ?? 0}. Each placement this turn increases the next cost
        by one.
      </p>
      <label htmlFor={`${id}-token`}>
        Ambassador
        <select
          id={`${id}-token`}
          className="min-h-11 w-full"
          value={token?.id ?? ''}
          disabled={busy || state.blocked}
          onChange={(event) => setSelectedToken(event.target.value)}
        >
          <option value="">Choose from your supply</option>
          {supply.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {AMBASSADOR_REFERENCE[candidate.effect].name}
            </option>
          ))}
        </select>
      </label>
      {token && (
        <>
          <p className="m-0 text-sm leading-6">
            {AMBASSADOR_REFERENCE[token.effect].gameplay}
          </p>
          <AmbassadorInspector token={token} />
        </>
      )}
      <label htmlFor={`${id}-territory`}>
        Stronghold
        <select
          id={`${id}-territory`}
          className="min-h-11 w-full"
          value={destination?.id ?? ''}
          disabled={busy || state.blocked}
          onChange={(event) => setSelectedTerritory(event.target.value)}
        >
          <option value="">Choose a stronghold outside the storm</option>
          {destinations.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      {state.blocked && (
        <p className="m-0 text-sm leading-6">
          Ambassador placement is blocked for this turn.
        </p>
      )}
      {!supply.length && (
        <p className="m-0 text-sm leading-6">
          No Ambassador is available in your supply.
        </p>
      )}
      {!destinations.length && (
        <p className="m-0 text-sm leading-6">
          No ordinary stronghold is currently available for an Ambassador.
        </p>
      )}
      {!affordable && (
        <p className="m-0 text-sm leading-6">
          You need {state.nextCost - (me.spice ?? 0)} more spice for this
          placement.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={disabled}
          onClick={() => {
            if (!disabled && token && destination)
              act({
                type: 'decision',
                token: token.id,
                territory: destination.id,
              });
          }}
        >
          Place Ambassador · {state.nextCost} spice
        </Button>
        <Button
          variant="outline"
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Finish Ambassador placement
        </Button>
      </div>
      <p className="m-0 text-sm leading-6">{AMBASSADOR_COVERAGE}</p>
    </section>
  );
}
