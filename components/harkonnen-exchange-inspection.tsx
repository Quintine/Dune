'use client';

import type { GameView } from '@/game/engine';
import { CardInspector, CardRules } from './card-inspector';

/** Historical observations arrive only in the inspecting player's projection. */
export function HarkonnenExchangeInspection({ game }: { game: GameView }) {
  const record = game.harkonnenExchangeInspection;
  if (!record || record.owner !== game.me) return null;
  const target = game.players.find(player => player.id === record.target);
  return (
    <details className="notice harkonnen-exchange-inspection">
      <summary>Your Harkonnen inspection · Turn {record.turn}</summary>
      <p>
        {record.kind === 'draw'
          ? `Cards you took and inspected from ${target?.name ?? 'the other player'} during Bidding.`
          : `Cards in your hand before the automatic return to ${target?.name ?? 'the other player'} during Bidding.`}
        {' '}This is a record of what you saw then. These cards may have changed hands since.
      </p>
      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
        {record.cards.map(card => (
          <li key={card.id} className="min-w-0 rounded border border-white/15 p-3">
            <strong>{card.name}</strong>
            <CardRules card={card} />
            <CardInspector card={card} />
          </li>
        ))}
      </ul>
    </details>
  );
}
