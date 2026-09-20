'use client';

import { CardInspector } from './card-inspector';
import { KwisatzInspector } from './kwisatz-inspector';
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
  kwisatz,
}: {
  cards: readonly VisibleCard[];
  leader?: LeaderDisplayIdentity;
  playerName: string;
  kwisatz?: boolean;
}) {
  if (!cards.length && !leader && !kwisatz) return null;
  return (
    <details className="battle-component-inspection">
      <summary>Inspect {playerName}’s plan components</summary>
      <div className="visible-component-list">
        {kwisatz && <KwisatzInspector context="plan" />}
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
