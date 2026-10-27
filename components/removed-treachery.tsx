import type { Card } from '@/game/cards';
import { CardInspector } from './card-inspector';

/** Only receives the public faces of cards already removed from the game. */
export function RemovedTreachery({ cards }: { cards: readonly Card[] }) {
  if (cards.length === 0) return null;

  return (
    <details className="rounded-lg border border-[#454b3c] p-3" aria-label="Removed Treachery cards">
      <summary className="cursor-pointer font-semibold">
        Removed from game ({cards.length} {cards.length === 1 ? 'card' : 'cards'})
      </summary>
      <p className="mt-3 text-sm">
        These used cards cannot be drawn, reshuffled or recovered from discard.
      </p>
      <ul className="mt-3 grid list-none gap-3 p-0 sm:grid-cols-2">
        {cards.map((card) => (
          <li className="flex flex-col gap-2 rounded-md border border-[#454b3c] p-3" key={card.id}>
            <strong>{card.name}</strong>
            <CardInspector card={card} />
          </li>
        ))}
      </ul>
    </details>
  );
}
