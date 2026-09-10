'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import {
  nexusTraitorDrawAction,
  nexusTraitorReturnAction,
} from '@/game/nexus-traitor-options';
import {
  LeaderInspector,
  type LeaderDisplayIdentity,
} from './leader-inspector';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
function identityFor(game: GameView, id: string): LeaderDisplayIdentity | null {
  if (id === CHEAP_HERO_TRAITOR)
    return {
      name: 'Cheap Hero / Heroine',
      factionName: 'Any faction',
      strength: 0,
      cheapHero: true,
    };
  const leader = game.allLeaders.find((leader) => leader.id === id);
  return leader
    ? {
        id: leader.id,
        name: leader.name,
        factionName: faction(leader.faction).name,
        strength: leaderStrengthLabel(leader),
      }
    : null;
}

export function NexusTraitors({ game, act, busy }: Props) {
  const state = game.nexusTraitors;
  if (!state) return null;
  if (state.pending) {
    // Branch on the public owner before touching private choice identities.
    if (state.pending.owner !== game.me)
      return (
        <section aria-label="Harkonnen Nexus exchange">
          <p className="notice">
            Waiting for{' '}
            {game.players.find((player) => player.id === state.pending!.owner)
              ?.name ?? 'the card holder'}{' '}
            to return {state.pending.count}{' '}
            {state.pending.count === 1 ? 'card' : 'cards'} privately.
          </p>
        </section>
      );
    return (
      <ReturnCards
        key={state.pending.event}
        game={game}
        act={act}
        busy={busy}
      />
    );
  }
  const offer = state.offer;
  if (!offer) return null;
  const action = nexusTraitorDrawAction(game, offer.event, offer.mode);
  const dancers =
    game.players.find((player) => player.id === game.me)?.faction ===
    'tleilaxu';
  const label = dancers ? 'Face Dancer' : 'Traitor';
  return (
    <section
      aria-label="Harkonnen Nexus exchange"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>
        Harkonnen Nexus ·{' '}
        {offer.mode === 'cunning'
          ? 'Cunning'
          : offer.mode === 'secretAlly'
            ? 'Secret Ally'
            : 'Betrayal'}
      </h3>
      {offer.blocked ? (
        <p className="fine">{offer.blocked}</p>
      ) : offer.mode === 'betrayal' ? (
        <p className="fine">
          The traitor cancellation response is not available yet.
        </p>
      ) : (
        <>
          <p>
            Draw {offer.draw} {label} {offer.draw === 1 ? 'card' : 'cards'},
            then choose {offer.draw} from your hand to shuffle back. Newly drawn
            cards may be returned.
          </p>
          <p className="fine">
            This uses your Harkonnen Nexus card. Your selections remain private.
          </p>
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={busy || !action}
            onClick={() => {
              if (!busy && action) act(action);
            }}
          >
            Draw {offer.draw} {label} {offer.draw === 1 ? 'card' : 'cards'}
          </Button>
        </>
      )}
    </section>
  );
}

function ReturnCards({ game, act, busy }: Props) {
  const pending = game.nexusTraitors!.pending!;
  const [selected, setSelected] = useState<string[]>([]);
  const dancers =
    game.players.find((player) => player.id === game.me)?.faction ===
    'tleilaxu';
  const label = dancers ? 'Face Dancer' : 'Traitor';
  const action = nexusTraitorReturnAction(game, pending.event, selected);
  const blocked = busy || !!game.truthtrance;
  return (
    <section
      aria-label="Choose Nexus cards to return"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>
        Return {pending.count} {label} {pending.count === 1 ? 'card' : 'cards'}
      </h3>
      <p>
        Choose exactly {pending.count} to shuffle into the Traitor Deck. Your
        other cards stay in your hand.
      </p>
      <p className="fine">
        The previous game action is paused until this return finishes.
      </p>
      {dancers && (
        <p className="fine">
          Previously revealed Face Dancers are not available for this return.
        </p>
      )}
      <div className="space-y-2">
        {pending.choices.map((choice) => {
          const identity = identityFor(game, choice.id);
          if (!identity)
            return (
              <p key={choice.id} className="notice">
                This card’s identity is unavailable. Refresh before choosing it.
              </p>
            );
          const checked = selected.includes(choice.id);
          return (
            <div
              key={choice.id}
              className="flex flex-col items-start gap-2 rounded border border-[#a88b60]/40 p-3"
            >
              <label
                aria-label={`Return ${identity.name}, ${identity.factionName}, strength ${identity.strength}`}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={checked}
                  disabled={
                    blocked || (!checked && selected.length >= pending.count)
                  }
                  onChange={() =>
                    setSelected((old) =>
                      old.includes(choice.id)
                        ? old.filter((id) => id !== choice.id)
                        : [...old, choice.id],
                    )
                  }
                />
                <span>
                  <strong>{identity.name}</strong>
                  <span className="block text-sm text-[#b6b6a4]">
                    {identity.factionName} · Strength {identity.strength}
                    {choice.drawn ? ' · Newly drawn' : ''}
                    {choice.revealed ? ' · Previously revealed' : ''}
                  </span>
                </span>
              </label>
              <LeaderInspector
                identity={identity}
                kind={dancers ? 'faceDancer' : 'traitor'}
              />
            </div>
          );
        })}
      </div>
      <p className="fine" aria-live="polite">
        {selected.length} of {pending.count} selected.
      </p>
      {game.truthtrance && (
        <p className="notice">
          Finish Truthtrance before returning these cards.
        </p>
      )}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={blocked || !action}
        onClick={() => {
          if (!blocked && action) act(action);
        }}
      >
        Return selected {pending.count === 1 ? 'card' : 'cards'}
      </Button>
    </section>
  );
}
