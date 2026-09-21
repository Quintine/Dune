import { cardPresentation, type VisibleCard } from '@/game/card-presentation';
import { CardInspector } from './card-inspector';
import { LeaderInspector, type LeaderDisplayIdentity } from './leader-inspector';
import { LeaderPortrait } from './leader-portrait';

function PlayedCard({ label, card }: { label: string; card?: VisibleCard }) {
  if (!card) return <article className="revealed-piece revealed-piece-empty" aria-label={`${label}: None`}>
    <p className="revealed-piece-label">{label}</p><h4>None</h4>
  </article>;
  const face = cardPresentation(card);
  return <article className={`revealed-piece revealed-piece-${face.role}`} aria-label={`${label}: ${card.name}`}>
    <p className="revealed-piece-label">{label} · {face.category}</p>
    <h4>{card.name}</h4>
    <p className="revealed-piece-rules">{face.guidance}</p>
    <CardInspector card={card} />
  </article>;
}

/** Read-only components. The caller must supply only a publicly revealed plan. */
export function RevealedPlanPieces({ dial, leader, leaderCard, weapon, defense, lateDefense }: {
  dial: number;
  leader?: LeaderDisplayIdentity;
  leaderCard?: VisibleCard;
  weapon?: VisibleCard;
  defense?: VisibleCard;
  lateDefense?: VisibleCard;
}) {
  return <div className="revealed-plan-pieces">
    <div className="revealed-plan-leader">
      <dl className="revealed-dial" aria-label="Revealed force dial">
        <dt>Forces dialed</dt><dd>{dial}</dd>
      </dl>
      {leader ? <article className="revealed-piece revealed-leader" aria-label={`Leader: ${leader.name}`}>
        <LeaderPortrait identityId={leader.id} name={leader.name} className="size-20 shrink-0" sizes="80px" fallback={<span aria-hidden="true">◆</span>} />
        <div><p className="revealed-piece-label">{leader.factionName} · Leader</p><h4>{leader.name}</h4>
          <p className="revealed-piece-rules">Printed strength {leader.strength}</p>
        </div>
        <LeaderInspector identity={leader} />
      </article> : <PlayedCard label="Leader" card={leaderCard} />}
    </div>
    <div className="revealed-plan-cards">
      <PlayedCard label="Weapon" card={weapon} />
      <PlayedCard label="Defense in original plan" card={defense} />
      {lateDefense && <PlayedCard label="Added after reveal" card={lateDefense} />}
    </div>
  </div>;
}
