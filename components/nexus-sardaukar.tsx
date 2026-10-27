'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusSardaukarAction } from '@/game/nexus-sardaukar-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusSardaukar({ game, act, busy }: Props) {
  const state = game.nexusSardaukar;
  if (!state) return null;
  const count = state.shortCount ?? 5;
  const countText = count === 5 ? 'five' : String(count);
  const shortage = count < 5 && <p className="notice">
    Provisional shortage policy: use all {count} available ordinary force{count === 1 ? '' : 's'}.
    This interpretation is not publisher clarification.
  </p>;
  if (state.pending)
    return (
      <section aria-label="Emperor Nexus response" className="notice">
        <p>
          {game.players.find((p) => p.id === state.pending!.owner)?.name ??
            'Emperor'}{' '}
          declared Cunning. Karama may cancel the entire enhancement before the{' '}
          {countText} counter{count === 1 ? '' : 's'} count{count === 1 ? 's' : ''} as Sardaukar.
        </p>
        {shortage}
      </section>
    );
  if (state.active)
    return (
      <section aria-label="Emperor Nexus active" className="notice">
        <p>
          Cunning declared {countText} ordinary Emperor counter{count === 1 ? '' : 's'} as Sardaukar for this
          battle. An own-Homeworld reserve fee can reduce that group;
          the selected plan shows the remaining combat pool. These counters
          retain their ordinary physical identity and go to the ordinary Tanks
          when lost.
        </p>
        {shortage}
      </section>
    );
  const offer = state.offer;
  if (!offer) return null;
  const action = nexusSardaukarAction(game, offer.event);
  return (
    <section
      aria-label="Emperor Nexus Cunning"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>Emperor Nexus · Cunning</h3>
      <p>
        Count {countText} of your ordinary forces as Sardaukar for this battle. Use
        this before submitting your plan, with no actual Sardaukar in the
        battle.
      </p>
      <p className="fine">
        This spends your Nexus card once. Karama may cancel the enhancement. The{' '}
        {countText} counter{count === 1 ? '' : 's'} keep{count === 1 ? 's its' : ' their'} ordinary physical identity, including when
        lost.
      </p>
      {shortage}
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={busy || !action}
        onClick={() => {
          if (!busy && action) act(action);
        }}
      >
        Use {countText} force{count === 1 ? '' : 's'} as Sardaukar
      </Button>
    </section>
  );
}
