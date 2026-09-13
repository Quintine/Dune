'use client';

import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';
import { useState } from 'react';
import { Button } from './ui/button';
import { CardInspector } from './card-inspector';

function playerName(game: GameView, id: string) {
  return game.players.find((player) => player.id === id)?.name ?? id;
}

export function MentatQuestion({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [weapon, setWeapon] = useState('');
  const pending = game.mentat?.pending;
  const decision = game.decision;
  if (
    !pending ||
    decision?.kind !== 'mentatQuestion' ||
    decision.player !== game.me ||
    decision.event !== pending.event ||
    pending.player !== game.me ||
    (pending.stage !== 'name' && pending.stage !== 'reveal')
  )
    return null;

  const owner = playerName(game, pending.owner);
  const target = playerName(game, pending.target);
  if (pending.stage === 'name')
    return (
      <section className="min-w-0 space-y-3" aria-label="Mentat question">
        <h3 className="font-serif text-xl">Ask the Mentat question</h3>
        <p className="text-base leading-7">
          Name one specific weapon. {target} will privately show that card if
          it is held, or choose another card from their hand.
        </p>
        {pending.blocked && <p className="notice">{pending.blocked}</p>}
        {pending.weapons.length > 0 && (
          <label className="block space-y-2">
            <span className="font-semibold">Weapon to name</span>
            <select
              aria-label="Weapon to name for Mentat"
              className="min-h-11 w-full rounded border border-[#65644b] bg-[#171b17] px-3 py-2"
              defaultValue=""
              disabled={busy || !!pending.blocked}
              onChange={(event) => setWeapon(event.currentTarget.value)}
            >
              <option value="">Choose a weapon</option>
              {pending.weapons.map((weapon) => (
                <option key={weapon} value={weapon}>
                  {weapon}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy || !weapon || !!pending.blocked}
          onClick={() =>
            !busy && weapon && !pending.blocked &&
            act({ type: 'decision', event: pending.event, weapon })
          }
        >
          Ask about {weapon || 'a weapon'}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() =>
            !busy && act({ type: 'decision', event: pending.event, decline: true })
          }
        >
          Decline Mentat question
        </Button>
      </section>
    );

  const namedCards = pending.cards.filter((card) => card.name === pending.weapon);
  const hasNamedCard = namedCards.length > 0;
  return (
    <section className="min-w-0 space-y-3" aria-label="Mentat card choice">
      <h3 className="font-serif text-xl">Mentat card shown privately</h3>
      <p className="text-base leading-7">
        {owner} named <strong>{pending.weapon}</strong>.{' '}
        {hasNamedCard
          ? 'Show the named card privately.'
          : 'Choose one card from your hand to show privately.'}{' '}
        The card stays in your hand.
      </p>
      {pending.blocked && <p className="notice">{pending.blocked}</p>}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {pending.cards.map((card) => (
          <article
            key={card.id}
            className="min-w-0 space-y-3 rounded-lg border border-[#485542] p-4"
          >
            <h4 className="font-serif text-xl break-words">{card.name}</h4>
            <CardInspector card={card} />
            <Button
              className="min-h-11 w-full whitespace-normal"
              disabled={busy || !!pending.blocked}
              onClick={() =>
                !busy &&
                !pending.blocked &&
                act({ type: 'decision', event: pending.event, card: card.id })
              }
            >
              Show {card.name} privately
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MentatHistory({ game }: { game: GameView }) {
  const history = game.mentat?.history ?? [];
  if (!history.length) return null;
  return (
    <section className="min-w-0 space-y-3" aria-label="Mentat history">
      <h3 className="font-serif text-xl">Your Mentat observations</h3>
      <p className="fine">
        These private observations were true when each question resolved. Later
        hand changes can make an observation stale.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {history.map((entry) => (
          <article
            key={entry.event}
            className="min-w-0 space-y-2 rounded-lg border border-[#485542] p-4"
          >
            <h4 className="font-serif text-lg break-words">{entry.card.name}</h4>
            <p className="m-0 text-sm leading-6">
              Turn {entry.turn} · {territory(entry.territory).name} · {playerName(game, entry.owner)}{' '}
              asked {playerName(game, entry.target)} for <strong>{entry.weapon}</strong>.
            </p>
            <CardInspector card={entry.card} />
          </article>
        ))}
      </div>
    </section>
  );
}
