'use client';

import { CardInspector } from './card-inspector';
import {
  LeaderInspector,
  type LeaderDisplayIdentity,
} from './leader-inspector';
import type { VisibleCard } from '@/game/card-presentation';

/** The parent supplies only faces already authorized by its private game view. */
export function BattleComponentInspection({
  cards,
  leader,
  playerName,
}: {
  cards: readonly VisibleCard[];
  leader?: LeaderDisplayIdentity;
  playerName: string;
}) {
  if (!cards.length && !leader) return null;
  return (
    <details className="battle-component-inspection">
      <summary>Inspect {playerName}’s plan components</summary>
      <div className="visible-component-list">
        {leader && (
          <div>
            <strong>{leader.name}</strong>
            <LeaderInspector identity={leader} />
          </div>
        )}
        {cards.map((card) => (
          <div key={card.id}>
            <strong>{card.name}</strong>
            <CardInspector card={card} />
          </div>
        ))}
      </div>
    </details>
  );
}
