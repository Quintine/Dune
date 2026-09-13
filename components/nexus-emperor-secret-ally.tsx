'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { nexusEmperorRevivalAction } from '@/game/nexus-emperor-secret-ally-options';
import { Button } from '@/components/ui/button';

export function NexusEmperorSecretAlly({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selectedElite, setSelectedElite] = useState<number | null>(null);
  const offer = game.nexusEmperorSecretAlly;
  const owner = game.players.find((player) => player.id === game.me);
  const emperorSeated = game.players.some((player) => player.faction === 'emperor');
  const eligible =
    offer?.revival &&
    game.nexusCards?.card === 'emperor' &&
    !!owner &&
    !owner.ally &&
    !emperorSeated &&
    game.status === 'playing' &&
    game.phase === 4 &&
    !game.response &&
    !game.decision &&
    !game.truthtrance &&
    !game.phaseOpening &&
    !game.automaticContinuationPending &&
    game.nexusCards.waiting.length === 0 &&
    !game.nexusTraitors?.pending;
  if (!eligible) return null;

  const options = offer.revival.eliteOptions;
  const elite = options.length === 1
    ? options[0]
    : selectedElite !== null && options.includes(selectedElite)
      ? selectedElite
      : null;
  const action = elite === null ? null : nexusEmperorRevivalAction(game, elite);
  const blocked = busy || !action;
  return (
    <section className="min-w-0 space-y-3" aria-label="Emperor Secret Ally revival">
      <h3 className="font-serif text-xl">Emperor Secret Ally</h3>
      <p className="text-base leading-7">
        Spend the Emperor Nexus card to revive 3 additional forces for free,
        beyond your ordinary revival quota. The elite cap still applies.
      </p>
      {offer.revival.blocked && <p className="notice">{offer.revival.blocked}</p>}
      {options.length > 1 && (
        <label className="block space-y-2">
          <span className="font-semibold">Elite forces to revive</span>
          <select
            aria-label="Elite forces to revive"
            className="min-h-11 w-full rounded border border-[#65644b] bg-[#171b17] px-3 py-2"
            value={elite ?? ''}
            disabled={busy || !!offer.revival.blocked}
            onChange={(event) => setSelectedElite(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
          >
            <option value="">Choose an elite count</option>
            {options.map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>
      )}
      <Button
        className="min-h-11 whitespace-normal"
        disabled={blocked}
        onClick={() => {
          if (!blocked && action) act(action);
        }}
      >
        Revive 3 additional forces{elite === null ? '' : ` · ${elite} elite`}
      </Button>
    </section>
  );
}
