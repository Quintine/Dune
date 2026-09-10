'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusFaceDancersAction } from '@/game/nexus-tleilaxu-options';
import { nexusCardMode } from '@/game/nexus-cards';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function NexusTleilaxu({ game, act, busy }: Props) {
  const offer = game.nexusTleilaxu?.cunning;
  if (!offer) {
    const owner = game.players.find((player) => player.id === game.me);
    if (!owner || game.nexusCards?.card !== 'tleilaxu') return null;
    const mode = nexusCardMode(
      'tleilaxu',
      owner.faction,
      game.players.map((player) => player.faction),
    );
    if (mode === 'cunning') return null;
    return (
      <section aria-label="Tleilaxu Nexus availability">
        <p className="notice">
          {mode === 'secretAlly'
            ? 'Secret Ally revival is unavailable while its revival-limit ruling is pending.'
            : 'Betrayal is unavailable while its private response timing is pending.'}
        </p>
      </section>
    );
  }
  const action = nexusFaceDancersAction(game, offer.event);
  return (
    <section
      aria-label="Tleilaxu Nexus Cunning"
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h3>Tleilaxu Nexus · Cunning</h3>
      <p>
        Set aside all your revealed Face Dancers and secretly draw their
        replacements. Then shuffle the set-aside cards into the Traitor Deck.
        Your unrevealed Face Dancers stay in your hand.
      </p>
      <p className="fine">
        This uses your Tleilaxu Nexus card. All {offer.count} revealed{' '}
        {offer.count === 1 ? 'card is' : 'cards are'} replaced together.
      </p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button
        className="game-action min-h-11 whitespace-normal"
        disabled={busy || !action}
        onClick={() => {
          if (!busy && action) act(action);
        }}
      >
        Replace {offer.count} revealed Face{' '}
        {offer.count === 1 ? 'Dancer' : 'Dancers'}
      </Button>
    </section>
  );
}
