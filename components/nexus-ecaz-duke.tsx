'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusEcazDukeAction } from '@/game/nexus-ecaz-duke-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function NexusEcazDuke({ game, act, busy }: Props) {
  const offer = game.nexusEcazDuke;
  const owner = game.players.find(player => player.id === game.me);
  if (!offer || owner?.faction !== 'ecaz' || owner.ally || game.nexusCards?.card !== 'ecaz') return null;
  const controller = game.players.find(player => player.id === offer.dukeController);
  const action = nexusEcazDukeAction(game);
  return (
    <section aria-label="Your Ecaz Nexus Duke Cunning" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Ecaz Nexus · Cunning · Duke Prad Vidal</h3>
      <p>Current public controller: {offer.dukeController ? controller?.name ?? 'another player' : 'none'}.</p>
      <p>Spend and discard your physical Ecaz Nexus card to take the uncaptured, non-Ghola Duke for this turn, even from Moritani or the Tanks. A Tanked acquisition revives the same shared disc without a separate paid revival and preserves his death history. If unused, this temporary control expires at turn end; using him in battle sets the shared Duke aside.</p>
      <p className="fine">This independent resurrection clears his prior battle-use stamp and permits a new battle use. Taking a living Duke does not clear a battle-use stamp. That use composition is provisional; capture and Ghola acquisition/return destinations remain unsupported, as does Duke battle use with Advanced Harkonnen.</p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Discard Ecaz Nexus · take Duke this turn
      </Button>
    </section>
  );
}
