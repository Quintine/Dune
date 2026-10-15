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
      <p>Known controller: {offer.dukeController ? controller?.name ?? 'another player' : 'none'}.</p>
      <p>Spend your physical Ecaz Nexus card to take the one shared Duke this turn, including from actual capture or the Tanks. Capture reclaim ends captivity. A Tanked acquisition preserves his death history without payment or an ordinary revival slot. Battle use or unused turn expiry sets him aside.</p>
      <p className="fine">Provisional return policy: no previous captor is restored after Nexus use. Independent Tanks resurrection clears prior battle use; taking a living Duke does not. Only Ecaz may revive him, including with a real Ghola card; that return is set aside before a separate Cunning play. Foreign-Ghola custody is not created. Wider profile and combination gates remain.</p>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Discard Ecaz Nexus · take Duke this turn
      </Button>
    </section>
  );
}
