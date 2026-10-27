'use client';

import { Button } from '@/components/ui/button';
import { FACTIONS } from '@/game/catalog';
import type { Action, GameView } from '@/game/engine';

/** Swaps require the recipient's explicit consent; the server owns the offer. */
export function FactionSwap({ game, send, busy }: {
  game: GameView;
  send: (action: Action) => Promise<void>;
  busy: boolean;
}) {
  if (game.status !== 'lobby') return null;

  const factionName = (id: string) => FACTIONS.find((faction) => faction.id === id)?.name ?? id;
  const seatName = (id: string) => game.players.find((player) => player.id === id)?.name ?? 'Unknown player';
  const swap = game.factionSwap;
  if (swap) return <section className="notice" aria-label="Faction swap offer">
    <h2>Faction swap offer</h2>
    <p>{seatName(swap.from)} offers to exchange {factionName(swap.fromFaction)} with {seatName(swap.to)}&apos;s {factionName(swap.toFaction)}.</p>
    <p>Both players must agree. The factions change only if {seatName(swap.to)} accepts.</p>
    <p>Lobby changes and starting the game are paused until the offer is accepted, declined, or canceled.</p>
    {game.me === swap.to && <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={() => void send({ type: 'factionSwapRespond', event: swap.event, accept: true })}>
        Accept swap
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void send({ type: 'factionSwapRespond', event: swap.event, accept: false })}>
        Decline swap
      </Button>
    </div>}
    {game.me === swap.from && <Button type="button" variant="outline" disabled={busy}
      onClick={() => void send({ type: 'factionSwapCancel', event: swap.event })}>
      Cancel swap offer
    </Button>}
  </section>;

  const self = game.players.find((player) => player.id === game.me);
  const targets = game.players.filter((player) => player.id !== game.me && !player.bot);
  return <section className="notice" aria-label="Faction swaps">
    <h2>Swap factions</h2>
    <p>Offer to exchange factions with another player. The other player must accept before either faction changes.</p>
    {game.factionDraft && <p>Finish or cancel the faction draft before offering a swap.</p>}
    {game.players.some((player) => player.bot) && <p className="fine">AI seats cannot receive swap offers yet.</p>}
    {self && !self.bot && targets.length > 0 ? <div className="flex flex-wrap gap-2">
      {targets.map((player) => <Button key={player.id} type="button" variant="outline" disabled={busy || !!game.factionDraft}
        onClick={() => void send({ type: 'factionSwapOffer', target: player.id })}>
        {`Offer swap to ${player.name} (${factionName(player.faction)})`}
      </Button>)}
    </div> : <p className="fine">A second human seat is needed to offer a swap.</p>}
  </section>;
}
