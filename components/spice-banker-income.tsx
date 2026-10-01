import type { GameView } from '@/game/engine';

/** Only the projected physical front-shield piles are public, not their payment receipts. */
export function SpiceBankerIncome({ game }: { game: GameView }) {
  const state = game.spiceBankerIncome;
  if (!state || state.deferred.length === 0) return null;
  const name = (owner: string) => game.players.find(player => player.id === owner)?.name ?? owner;
  return (
    <section className="notice block min-w-0 space-y-2 break-words" aria-label="Spice Banker front-shield income">
      <h3>Spice Banker · deferred income</h3>
      <ul className="m-0 list-none p-0">
        {state.deferred.map(pile => (
          <li key={pile.owner}>{name(pile.owner)}: {pile.amount} spice in front of the shield.</li>
        ))}
      </ul>
      <p className="fine m-0">
        This earned spice is not spendable yet. The original gaining faction collects it automatically
        at the current Mentat opening; it cannot fund a bid, shipment, revival or Battle Plan beforehand.
      </p>
      <a href="/rules?topic=spice-banker-income#spice-banker-income">Income timing and preview limits</a>
    </section>
  );
}
