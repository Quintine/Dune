'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { territory } from '@/game/board';
import { Button } from '@/components/ui/button';
import { LeaderInspector } from './leader-inspector';

export function MoritaniAssassinate({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState('');
  const offer = game.moritaniAssassinate;
  const decision = game.decision;
  if (
    !offer?.pending ||
    decision?.kind !== 'moritaniAssassinate' ||
    decision.player !== game.me ||
    decision.event !== offer.pending.event ||
    offer.owner !== game.me
  )
    return null;
  const pending = offer.pending;
  const card = pending.cards.find((candidate) => candidate.card === selected) ?? pending.cards[0];
  const blocked = busy || !!game.response || !!game.truthtrance;
  const opponent = game.players.find((player) => player.id === pending.opponent);
  const factionName = opponent ? faction(opponent.faction).name : 'the opposing faction';
  const selectedLeader = card && game.allLeaders.find((leader) => leader.id === card.card);
  return (
    <section className="min-w-0 space-y-3" aria-label="Moritani Assassinate Leaders">
      <h3 className="font-serif text-xl">Assassinate Leaders</h3>
      <p className="text-base leading-7">
        After losing this battle, you may reveal one Traitor Card for {factionName},
        naming a different opposing leader. The physical card is revealed publicly;
        it is replaced automatically during Mentat Pause.
      </p>
      <p className="fine">
        This advantage is available once against each faction. It cannot be canceled
        with Karama. A dead target remains a legal choice, but yields no spice.
      </p>
      {pending.blocked && <p className="notice">{pending.blocked}</p>}
      {pending.cards.length > 0 ? (
        <>
          <label className="block space-y-2">
            <span className="font-semibold">Traitor Card to reveal</span>
            <select
              aria-label="Traitor Card to reveal"
              className="min-h-11 w-full rounded border border-[#65644b] bg-[#171b17] px-3 py-2"
              value={card?.card ?? ''}
              disabled={blocked}
              onChange={(event) => setSelected(event.currentTarget.value)}
            >
              {pending.cards.map((candidate) => (
                <option key={candidate.card} value={candidate.card}>
                  {candidate.name}{candidate.dead ? ' · dead target · 0 spice' : ` · ${candidate.bounty} spice`}
                </option>
              ))}
            </select>
          </label>
          {card && (
            <div className="rounded-lg border border-[#485542] p-4 space-y-2">
              <p className="m-0"><strong>{card.name}</strong> · {card.dead ? '0 spice; target already dead' : `${card.bounty} spice bounty`}</p>
              <p className="m-0 text-sm">Printed leader strength: {selectedLeader?.strength ?? 'unknown'}</p>
              <LeaderInspector
                kind="traitor"
                assassination="choice"
                identity={{ name: card.name, factionName, strength: selectedLeader?.strength ?? 0 }}
              />
            </div>
          )}
          <Button
            className="min-h-11 whitespace-normal"
            disabled={blocked || !card}
            onClick={() => card && !blocked && act({ type: 'decision', event: pending.event, card: card.card })}
          >
            Reveal {card?.name ?? 'selected Traitor Card'} publicly
          </Button>
        </>
      ) : (
        <p className="notice">No eligible opposing-faction Traitor Card is available for this advantage.</p>
      )}
      <Button
        variant="outline"
        className="min-h-11 whitespace-normal"
        disabled={blocked}
        onClick={() => !blocked && act({ type: 'decision', event: pending.event, decline: true })}
      >
        {pending.cards.length ? 'Decline Assassinate Leaders' : 'Continue'}
      </Button>
    </section>
  );
}

export function MoritaniAssassinateHistory({ game }: { game: GameView }) {
  const history = game.moritaniAssassinate?.history ?? [];
  if (!history.length) return null;
  return (
    <section className="min-w-0 space-y-3" aria-label="Moritani Assassinate Leaders history">
      <h3 className="font-serif text-xl">Assassinate Leaders revealed cards</h3>
      <p className="fine">
        These physical Traitor Cards were revealed publicly. A replaced card is
        set aside face up; replacement happens during Mentat Pause.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {history.map((entry) => {
          const leader = game.allLeaders.find((candidate) => candidate.id === entry.card);
          const leaderName = leader?.name ?? entry.card;
          const factionName = faction(entry.faction).name;
          return (
            <article key={entry.event} className="min-w-0 space-y-2 rounded-lg border border-[#485542] p-4">
              <p className="m-0 text-sm uppercase tracking-wide text-[#ddbc77]">
                {entry.stage === 'replaced' ? 'Set aside face up · replaced' : 'Revealed · awaiting replacement'}
              </p>
              <h4 className="font-serif text-lg break-words">{leaderName}</h4>
              <p className="m-0 text-sm leading-6">
                {factionName} · {territory(entry.territory).name} · {entry.bounty} spice bounty · Turn {entry.turn}
              </p>
              <LeaderInspector
                kind="traitor"
                assassination={entry.stage === 'replaced' ? 'retired' : 'revealed'}
                identity={{
                  id: entry.card,
                  name: leaderName,
                  factionName,
                  strength: leader?.strength ?? 0,
                }}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
